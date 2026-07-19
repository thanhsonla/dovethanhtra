import { createHash } from 'node:crypto'

import { AppError } from '../../platform/app-error.js'
import type { AppDatabase } from '../../platform/database.js'
import type { ObjectStorageHandle } from '../../platform/object-storage.js'
import type { AuditRepository } from '../audit/audit-repository.js'
import type { ComparisonService } from '../comparison/comparison-service.js'
import type { ExportDataset, ExportProvider } from './export-provider.js'
import type { ExportRepository } from './export-repository.js'
import type { SnapshotRepository } from './snapshot-repository.js'

export class ExportService {
  private readonly requestTimes = new Map<string, number[]>()

  constructor(
    private readonly database: AppDatabase,
    private readonly repository: ExportRepository,
    private readonly snapshots: SnapshotRepository,
    private readonly comparison: ComparisonService,
    private readonly audit: AuditRepository,
    private readonly provider: ExportProvider,
    private readonly storage?: ObjectStorageHandle,
  ) {}

  private consumeQuota(ownerId: string) {
    const cutoff = Date.now() - 60_000
    const current = (this.requestTimes.get(ownerId) ?? []).filter((time) => time > cutoff)
    if (current.length >= 10)
      throw new AppError(429, 'EXPORT_RATE_LIMITED', 'Bạn đã yêu cầu xuất quá nhiều lần.')
    current.push(Date.now())
    this.requestTimes.set(ownerId, current)
  }

  async resumePending() {
    if (!this.storage?.putObject || !this.storage.getObject) return
    const jobs = await this.repository.recoverPending()
    for (const job of jobs) {
      queueMicrotask(
        () =>
          void this.processJob(
            job.id,
            job.caseId,
            job.format,
            job.ownerId,
            `export-recovery-${job.id}`,
            job.filters,
          ),
      )
    }
  }

  async create(
    caseId: string,
    format: 'geojson' | 'xlsx',
    ownerId: string,
    traceId: string,
    filters: Record<string, unknown> = {},
  ) {
    this.consumeQuota(ownerId)
    const base = await this.repository.dataset(caseId, ownerId)
    if (!base) throw new AppError(404, 'CASE_NOT_FOUND', 'Không tìm thấy hồ sơ.')
    if (base.inspectionCase.status !== 'locked')
      throw new AppError(
        409,
        'CASE_MUST_BE_LOCKED_FOR_EXPORT',
        'Hãy khóa hồ sơ trước khi xuất để bảo đảm snapshot và tệp nhất quán.',
      )
    const comparison = await this.comparison.get(caseId, ownerId)
    const generatedAt = new Date().toISOString()
    const dataset: ExportDataset = { ...base, comparison, generatedAt }
    const artifact = await this.provider.create(format, dataset)
    const fileHash = createHash('sha256').update(artifact.bytes).digest('hex')
    const fileName = `${base.inspectionCase.caseCode}-${generatedAt.slice(0, 10)}.${artifact.extension}`
    return this.database.transaction().execute(async (transaction) => {
      const summary = await this.snapshots.summary(transaction, caseId, ownerId)
      if (!summary) throw new AppError(404, 'CASE_NOT_FOUND', 'Không tìm thấy hồ sơ.')
      const snapshot = await this.snapshots.create(transaction, caseId, 'export', summary, ownerId)
      const exportId = await this.repository.record(transaction, {
        caseId,
        snapshotId: snapshot.id,
        format,
        fileName,
        fileHash,
        sizeBytes: artifact.bytes.length,
        filters,
        ownerId,
      })
      await this.audit.append(transaction, {
        action: 'exported',
        actorId: ownerId,
        afterData: {
          exportId,
          fileHash,
          format,
          sizeBytes: artifact.bytes.length,
          snapshotId: snapshot.id,
          snapshotHash: snapshot.snapshotHash,
          filters,
        },
        entityId: exportId,
        entityType: 'export_record',
        inspectionCaseId: caseId,
        traceId,
      })
      return { ...artifact, exportId, fileHash, fileName, snapshot }
    })
  }

  async enqueue(
    caseId: string,
    format: 'geojson' | 'xlsx',
    ownerId: string,
    traceId: string,
    filters: Record<string, unknown> = {},
  ) {
    this.consumeQuota(ownerId)
    if (!this.storage?.putObject || !this.storage.getObject) {
      throw new AppError(503, 'OBJECT_STORAGE_UNAVAILABLE', 'Kho tệp chưa hỗ trợ export queue.')
    }
    const base = await this.repository.dataset(caseId, ownerId)
    if (!base) throw new AppError(404, 'CASE_NOT_FOUND', 'Không tìm thấy hồ sơ.')
    if (base.inspectionCase.status !== 'locked') {
      throw new AppError(409, 'CASE_MUST_BE_LOCKED_FOR_EXPORT', 'Hãy khóa hồ sơ trước khi xuất.')
    }
    const extension = format === 'xlsx' ? 'xlsx' : 'geojson'
    const fileName = `${base.inspectionCase.caseCode}-${new Date().toISOString().slice(0, 10)}.${extension}`
    const exportId = await this.database.transaction().execute(async (transaction) => {
      const summary = await this.snapshots.summary(transaction, caseId, ownerId)
      if (!summary) throw new AppError(404, 'CASE_NOT_FOUND', 'Không tìm thấy hồ sơ.')
      const snapshot = await this.snapshots.create(transaction, caseId, 'export', summary, ownerId)
      const id = await this.repository.enqueue(transaction, {
        caseId,
        snapshotId: snapshot.id,
        format,
        fileName,
        filters,
        ownerId,
      })
      await this.audit.append(transaction, {
        action: 'export_queued',
        actorId: ownerId,
        afterData: {
          exportId: id,
          filters,
          format,
          snapshotHash: snapshot.snapshotHash,
          snapshotId: snapshot.id,
        },
        entityId: id,
        entityType: 'export_record',
        inspectionCaseId: caseId,
        traceId,
      })
      return id
    })
    const job = await this.repository.getJob(exportId, ownerId)
    if (!job) throw new AppError(500, 'EXPORT_QUEUE_FAILED', 'Không thể đọc export job.')
    queueMicrotask(() => void this.processJob(job.id, caseId, format, ownerId, traceId, filters))
    const { objectKey, ...publicJob } = job
    void objectKey
    return publicJob
  }

  private async processJob(
    id: string,
    caseId: string,
    format: 'geojson' | 'xlsx',
    ownerId: string,
    traceId: string,
    filters: Record<string, unknown>,
  ) {
    if (!(await this.repository.claim(id))) return
    try {
      const base = await this.repository.dataset(caseId, ownerId)
      if (!base) throw new AppError(404, 'CASE_NOT_FOUND', 'Không tìm thấy hồ sơ.')
      const comparison = await this.comparison.get(caseId, ownerId)
      const artifact = await this.provider.create(format, {
        ...base,
        comparison,
        generatedAt: new Date().toISOString(),
      })
      const fileHash = createHash('sha256').update(artifact.bytes).digest('hex')
      const job = await this.repository.getJob(id, ownerId)
      if (!job) throw new AppError(404, 'EXPORT_NOT_FOUND', 'Không tìm thấy export job.')
      const objectKey = `exports/${caseId}/${id}/${job.fileName}`
      await this.storage!.putObject!(objectKey, artifact.bytes, artifact.contentType)
      await this.database.transaction().execute(async (transaction) => {
        await this.repository.complete(transaction, id, {
          fileHash,
          objectKey,
          sizeBytes: artifact.bytes.length,
        })
        await this.audit.append(transaction, {
          action: 'exported',
          actorId: ownerId,
          afterData: { exportId: id, fileHash, filters, format, sizeBytes: artifact.bytes.length },
          entityId: id,
          entityType: 'export_record',
          inspectionCaseId: caseId,
          traceId,
        })
      })
    } catch (error) {
      await this.repository.fail(
        id,
        error instanceof AppError ? error.code : 'EXPORT_FAILED',
        error instanceof Error ? error.message : 'Không thể tạo export artifact.',
      )
    }
  }

  async getJob(id: string, ownerId: string) {
    const job = await this.repository.getJob(id, ownerId)
    if (!job) throw new AppError(404, 'EXPORT_NOT_FOUND', 'Không tìm thấy export job.')
    const { objectKey, ...publicJob } = job
    void objectKey
    return publicJob
  }

  async download(id: string, ownerId: string) {
    const job = await this.repository.getJob(id, ownerId)
    if (!job) throw new AppError(404, 'EXPORT_NOT_FOUND', 'Không tìm thấy export job.')
    if (job.status !== 'completed' || !job.objectKey || !job.fileHash) {
      throw new AppError(409, 'EXPORT_NOT_READY', 'Export job chưa có artifact hoàn tất.')
    }
    if (!this.storage?.getObject)
      throw new AppError(503, 'OBJECT_STORAGE_UNAVAILABLE', 'Kho tệp chưa sẵn sàng.')
    return { ...job, stream: await this.storage.getObject(job.objectKey) }
  }
}
