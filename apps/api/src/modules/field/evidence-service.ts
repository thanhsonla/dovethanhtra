import { createHash, randomUUID } from 'node:crypto'

import type { Attachment, PresignAttachmentRequest } from '@dove/contracts'
import { sql } from 'kysely'

import { AppError } from '../../platform/app-error.js'
import type { AppDatabase, QueryExecutor } from '../../platform/database.js'
import type { ObjectStorageHandle } from '../../platform/object-storage.js'
import { isoDateTime } from '../../platform/serialization.js'
import type { AuditRepository } from '../audit/audit-repository.js'
import type { MalwareScanner } from './malware-scanner.js'
import type { Thumbnailer } from './thumbnailer.js'

interface AttachmentRow extends Omit<Attachment, 'createdAt' | 'completedAt'> {
  createdAt: Date | string
  completedAt: Date | string | null
  expectedSha256: string
  expectedSizeBytes: number | string
  objectKey: string
  scanStatus: Attachment['scanStatus']
  thumbnailObjectKey: string | null
}

const columns = sql.raw(`a.id, a.measurement_id AS "measurementId",
  a.case_work_item_id AS "workItemId", a.original_name AS "originalName",
  a.mime_type AS "mimeType", a.size_bytes AS "sizeBytes", a.sha256,
  a.upload_status AS "uploadStatus", a.created_at AS "createdAt",
  a.completed_at AS "completedAt", a.expected_sha256 AS "expectedSha256",
  a.expected_size_bytes AS "expectedSizeBytes", a.object_key AS "objectKey",
  a.scan_status AS "scanStatus", a.thumbnail_object_key AS "thumbnailObjectKey"`)

function map(row: AttachmentRow): Attachment {
  return {
    id: row.id,
    measurementId: row.measurementId,
    workItemId: row.workItemId,
    originalName: row.originalName,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes === null ? null : Number(row.sizeBytes),
    sha256: row.sha256,
    uploadStatus: row.uploadStatus,
    scanStatus: row.scanStatus,
    thumbnailAvailable: Boolean(row.thumbnailObjectKey),
    createdAt: isoDateTime(row.createdAt),
    completedAt: row.completedAt ? isoDateTime(row.completedAt) : null,
  }
}

export class EvidenceService {
  constructor(
    private readonly database: AppDatabase,
    private readonly storage: ObjectStorageHandle,
    private readonly audit: AuditRepository,
    private readonly malwareScanner: MalwareScanner,
    private readonly thumbnailer: Thumbnailer,
  ) {}

  private requireStorage() {
    if (
      !this.storage.presignPut ||
      !this.storage.getObject ||
      !this.storage.putObject ||
      !this.storage.stat
    ) {
      throw new AppError(503, 'OBJECT_STORAGE_UNAVAILABLE', 'Kho tệp chưa sẵn sàng.')
    }
  }

  async listForWork(workItemId: string, ownerId: string): Promise<Attachment[]> {
    const result = await sql<AttachmentRow>`SELECT ${columns} FROM attachment a
      LEFT JOIN measurement m ON m.id=a.measurement_id
      JOIN case_work_item w ON w.id=COALESCE(a.case_work_item_id,m.case_work_item_id)
      JOIN inspection_case c ON c.id=w.inspection_case_id
      WHERE w.id=${workItemId}::uuid AND c.owner_id=${ownerId}::uuid
        AND a.upload_status='completed' AND a.deleted_at IS NULL
        AND w.deleted_at IS NULL AND c.deleted_at IS NULL
      ORDER BY a.created_at DESC LIMIT 200`.execute(this.database)
    return result.rows.map(map)
  }

  async listDeletedForWork(workItemId: string, ownerId: string): Promise<Attachment[]> {
    const result = await sql<AttachmentRow>`SELECT ${columns} FROM attachment a
      LEFT JOIN measurement m ON m.id=a.measurement_id
      JOIN case_work_item w ON w.id=COALESCE(a.case_work_item_id,m.case_work_item_id)
      JOIN inspection_case c ON c.id=w.inspection_case_id
      WHERE w.id=${workItemId}::uuid AND c.owner_id=${ownerId}::uuid
        AND a.deleted_at IS NOT NULL AND w.deleted_at IS NULL AND c.deleted_at IS NULL
      ORDER BY a.deleted_at DESC LIMIT 200`.execute(this.database)
    return result.rows.map(map)
  }

  async presign(input: PresignAttachmentRequest, ownerId: string, traceId: string) {
    this.requireStorage()
    if (Boolean(input.measurementId) === Boolean(input.workItemId))
      throw new AppError(
        422,
        'ATTACHMENT_PARENT_INVALID',
        'Ảnh phải liên kết đúng một phép đo hoặc công tác.',
      )
    return this.database.transaction().execute(async (transaction) => {
      const caseId = await this.parentCase(transaction, input, ownerId)
      const id = randomUUID()
      const extension =
        input.mimeType === 'image/jpeg' ? 'jpg' : input.mimeType === 'image/png' ? 'png' : 'webp'
      const objectKey = `evidence/${caseId}/${id}/original.${extension}`
      await sql`INSERT INTO attachment (id, measurement_id, case_work_item_id, object_key,
        original_name, mime_type, expected_size_bytes, expected_sha256, created_by)
      VALUES (${id}::uuid, ${input.measurementId ?? null}::uuid, ${input.workItemId ?? null}::uuid,
        ${objectKey}, ${input.originalName}, ${input.mimeType}, ${input.sizeBytes}, ${input.sha256},
        ${ownerId}::uuid)`.execute(transaction)
      const attachment = await this.get(transaction, id, ownerId)
      const expiresInSeconds = 900
      const uploadUrl = await this.storage.presignPut!(objectKey, expiresInSeconds)
      await this.audit.append(transaction, {
        action: 'upload_started',
        actorId: ownerId,
        afterData: { attachmentId: id, mimeType: input.mimeType, sizeBytes: input.sizeBytes },
        entityId: id,
        entityType: 'attachment',
        inspectionCaseId: caseId,
        traceId,
      })
      return { attachment: map(attachment!), uploadUrl, expiresInSeconds }
    })
  }

  async complete(attachmentId: string, ownerId: string, traceId: string): Promise<Attachment> {
    this.requireStorage()
    const pending = await this.get(this.database, attachmentId, ownerId)
    if (!pending)
      throw new AppError(404, 'ATTACHMENT_NOT_FOUND', 'Không tìm thấy ảnh chờ hoàn tất.')
    if (pending.uploadStatus === 'completed') return map(pending)
    if (pending.scanStatus === 'infected') {
      throw new AppError(422, 'ATTACHMENT_INFECTED', 'Tệp đã bị cách ly do phát hiện mã độc.')
    }
    let stat: { size: number; contentType: string | null }
    try {
      stat = await this.storage.stat!(pending.objectKey)
    } catch {
      throw new AppError(
        409,
        'ATTACHMENT_UPLOAD_INCOMPLETE',
        'Object chưa tải xong; ảnh chưa được đánh dấu hoàn tất.',
      )
    }
    if (
      stat.size !== Number(pending.expectedSizeBytes) ||
      (stat.contentType && stat.contentType !== pending.mimeType)
    ) {
      await this.fail(pending.id)
      throw new AppError(
        422,
        'ATTACHMENT_METADATA_MISMATCH',
        'Kích thước hoặc MIME của object không khớp khai báo.',
      )
    }
    const stream = await this.storage.getObject!(pending.objectKey)
    const chunks: Buffer[] = []
    for await (const chunk of stream as unknown as AsyncIterable<Uint8Array>)
      chunks.push(Buffer.from(chunk))
    const bytes = Buffer.concat(chunks)
    const sha256 = createHash('sha256').update(bytes).digest('hex')
    if (sha256 !== pending.expectedSha256) {
      await this.fail(pending.id)
      throw new AppError(422, 'ATTACHMENT_HASH_MISMATCH', 'SHA-256 của object không khớp khai báo.')
    }
    let scan
    try {
      scan = await this.malwareScanner.scan(bytes)
    } catch {
      await this.updateScanFailure(pending.id, 'error', null, null)
      throw new AppError(
        503,
        'MALWARE_SCANNER_UNAVAILABLE',
        'Không thể quét tệp; ảnh chưa hoàn tất.',
      )
    }
    if (scan.status === 'infected') {
      await this.updateScanFailure(pending.id, 'infected', scan.provider, scan.version)
      throw new AppError(422, 'ATTACHMENT_INFECTED', 'Tệp bị cách ly do phát hiện mã độc.', {
        signature: scan.signature,
      })
    }
    let thumbnail
    try {
      thumbnail = await this.thumbnailer.create(bytes)
    } catch {
      throw new AppError(
        422,
        'ATTACHMENT_IMAGE_INVALID',
        'Byte tệp không giải mã được thành ảnh hợp lệ.',
      )
    }
    const thumbnailSha256 = createHash('sha256').update(thumbnail.bytes).digest('hex')
    const caseBeforeStore = await this.caseForAttachment(this.database, attachmentId)
    if (caseBeforeStore.status === 'locked') {
      throw new AppError(423, 'CASE_LOCKED', 'Hồ sơ đã khóa và không thể hoàn tất ảnh.')
    }
    const thumbnailObjectKey = `evidence/${caseBeforeStore.id}/${attachmentId}/thumbnail.webp`
    await this.storage.putObject!(thumbnailObjectKey, thumbnail.bytes, thumbnail.contentType)
    try {
      return await this.database.transaction().execute(async (transaction) => {
        const caseState = await this.caseForAttachment(transaction, attachmentId, true)
        if (caseState.status === 'locked')
          throw new AppError(423, 'CASE_LOCKED', 'Hồ sơ đã khóa và không thể hoàn tất ảnh.')
        const update = await sql`UPDATE attachment SET upload_status = 'completed',
          size_bytes = ${stat.size},sha256 = ${sha256},completed_at = now(),scan_status='clean',
          scan_provider=${scan.provider},scan_version=${scan.version},scanned_at=now(),
          thumbnail_object_key=${thumbnailObjectKey},thumbnail_mime_type=${thumbnail.contentType},
          thumbnail_size_bytes=${thumbnail.bytes.length},thumbnail_sha256=${thumbnailSha256}
          WHERE id = ${attachmentId}::uuid AND upload_status = 'pending'`.execute(transaction)
        if (Number(update.numAffectedRows ?? 0) !== 1) {
          throw new AppError(
            409,
            'ATTACHMENT_COMPLETE_CONFLICT',
            'Ảnh đã thay đổi trạng thái; hãy nạp lại dữ liệu.',
          )
        }
        const completed = await this.get(transaction, attachmentId, ownerId)
        if (!completed)
          throw new AppError(500, 'ATTACHMENT_COMPLETE_FAILED', 'Không thể hoàn tất ảnh.')
        await this.audit.append(transaction, {
          action: 'upload_completed',
          actorId: ownerId,
          afterData: {
            attachmentId,
            sha256,
            sizeBytes: stat.size,
            scanProvider: scan.provider,
            scanVersion: scan.version,
            thumbnailSha256,
          },
          entityId: attachmentId,
          entityType: 'attachment',
          inspectionCaseId: caseState.id,
          traceId,
        })
        return map(completed)
      })
    } catch (error) {
      await this.storage.remove?.(thumbnailObjectKey).catch(() => undefined)
      throw error
    }
  }

  private async fail(id: string) {
    await sql`UPDATE attachment SET upload_status = 'failed' WHERE id = ${id}::uuid AND upload_status = 'pending'`.execute(
      this.database,
    )
  }

  private async updateScanFailure(
    id: string,
    status: 'error' | 'infected',
    provider: string | null,
    version: string | null,
  ) {
    await sql`UPDATE attachment SET scan_status=${status},scan_provider=${provider},
      scan_version=${version},scanned_at=now(),upload_status=CASE WHEN ${status}='infected'
        THEN 'failed' ELSE upload_status END WHERE id=${id}::uuid`.execute(this.database)
  }

  async thumbnail(id: string, ownerId: string) {
    const attachment = await this.get(this.database, id, ownerId)
    if (!attachment?.thumbnailObjectKey || attachment.uploadStatus !== 'completed') {
      throw new AppError(404, 'THUMBNAIL_NOT_FOUND', 'Không tìm thấy thumbnail.')
    }
    return this.storage.getObject!(attachment.thumbnailObjectKey)
  }

  async remove(id: string, ownerId: string, traceId: string) {
    return this.database.transaction().execute(async (transaction) => {
      const attachment = await this.get(transaction, id, ownerId)
      if (!attachment) throw new AppError(404, 'ATTACHMENT_NOT_FOUND', 'Không tìm thấy ảnh.')
      const caseState = await this.caseForAttachment(transaction, id, true)
      if (caseState.status === 'locked') throw new AppError(423, 'CASE_LOCKED', 'Hồ sơ đã khóa.')
      await sql`UPDATE attachment SET deleted_at=now() WHERE id=${id}::uuid AND deleted_at IS NULL`.execute(
        transaction,
      )
      await this.audit.append(transaction, {
        action: 'soft_deleted',
        actorId: ownerId,
        beforeData: { attachmentId: id, sha256: attachment.sha256 },
        entityId: id,
        entityType: 'attachment',
        inspectionCaseId: caseState.id,
        traceId,
      })
    })
  }

  async restore(id: string, reason: string, ownerId: string, traceId: string) {
    return this.database.transaction().execute(async (transaction) => {
      const result = await sql<AttachmentRow>`SELECT ${columns} FROM attachment a
        LEFT JOIN measurement m ON m.id=a.measurement_id
        JOIN case_work_item w ON w.id=COALESCE(a.case_work_item_id,m.case_work_item_id)
        JOIN inspection_case c ON c.id=w.inspection_case_id WHERE a.id=${id}::uuid
          AND c.owner_id=${ownerId}::uuid AND a.deleted_at IS NOT NULL
          AND c.deleted_at IS NULL AND w.deleted_at IS NULL FOR UPDATE OF c`.execute(transaction)
      const before = result.rows[0]
      if (!before) throw new AppError(404, 'ATTACHMENT_NOT_FOUND', 'Không tìm thấy ảnh đã xóa.')
      const caseState = await this.caseForAttachment(transaction, id)
      if (caseState.status === 'locked') throw new AppError(423, 'CASE_LOCKED', 'Hồ sơ đã khóa.')
      await sql`UPDATE attachment SET deleted_at=NULL WHERE id=${id}::uuid AND deleted_at IS NOT NULL`.execute(
        transaction,
      )
      const restored = await this.get(transaction, id, ownerId)
      if (!restored) throw new AppError(500, 'ATTACHMENT_RESTORE_FAILED', 'Không thể phục hồi ảnh.')
      await this.audit.append(transaction, {
        action: 'restored',
        actorId: ownerId,
        afterData: { attachmentId: id, sha256: restored.sha256 },
        entityId: id,
        entityType: 'attachment',
        inspectionCaseId: caseState.id,
        reason,
        traceId,
      })
      return map(restored)
    })
  }

  private async parentCase(
    executor: QueryExecutor,
    input: PresignAttachmentRequest,
    ownerId: string,
  ): Promise<string> {
    const result = input.measurementId
      ? await sql<{
          id: string
          status: string
        }>`SELECT c.id,c.status FROM measurement m JOIN case_work_item w ON w.id=m.case_work_item_id
          JOIN inspection_case c ON c.id=w.inspection_case_id WHERE m.id=${input.measurementId}::uuid
          AND c.owner_id=${ownerId}::uuid AND m.deleted_at IS NULL AND c.deleted_at IS NULL
          FOR UPDATE OF c`.execute(executor)
      : await sql<{
          id: string
          status: string
        }>`SELECT c.id,c.status FROM case_work_item w JOIN inspection_case c ON c.id=w.inspection_case_id
          WHERE w.id=${input.workItemId ?? null}::uuid AND c.owner_id=${ownerId}::uuid
          AND w.deleted_at IS NULL AND c.deleted_at IS NULL FOR UPDATE OF c`.execute(executor)
    const parent = result.rows[0]
    if (!parent)
      throw new AppError(
        404,
        'ATTACHMENT_PARENT_NOT_FOUND',
        'Không tìm thấy đối tượng liên kết ảnh.',
      )
    if (parent.status === 'locked')
      throw new AppError(423, 'CASE_LOCKED', 'Hồ sơ đã khóa và không thể thêm ảnh.')
    return parent.id
  }

  private async get(
    executor: QueryExecutor,
    id: string,
    ownerId: string,
  ): Promise<AttachmentRow | null> {
    const result = await sql<AttachmentRow>`SELECT ${columns} FROM attachment a
      LEFT JOIN measurement m ON m.id=a.measurement_id
      JOIN case_work_item w ON w.id=COALESCE(a.case_work_item_id,m.case_work_item_id)
      JOIN inspection_case c ON c.id=w.inspection_case_id
      WHERE a.id=${id}::uuid AND c.owner_id=${ownerId}::uuid AND a.deleted_at IS NULL`.execute(
      executor,
    )
    return result.rows[0] ?? null
  }

  private async caseForAttachment(executor: QueryExecutor, id: string, lock = false) {
    const result = await sql<{
      id: string
      status: string
    }>`SELECT c.id,c.status FROM attachment a LEFT JOIN measurement m ON m.id=a.measurement_id
      JOIN case_work_item w ON w.id=COALESCE(a.case_work_item_id,m.case_work_item_id)
      JOIN inspection_case c ON c.id=w.inspection_case_id WHERE a.id=${id}::uuid
      ${lock ? sql`FOR UPDATE OF c` : sql``}`.execute(executor)
    return result.rows[0]!
  }
}
