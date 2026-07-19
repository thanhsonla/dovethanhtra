import { createHash } from 'node:crypto'

import { AppError } from '../../platform/app-error.js'
import type { AppDatabase } from '../../platform/database.js'
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
  ) {}

  private consumeQuota(ownerId: string) {
    const cutoff = Date.now() - 60_000
    const current = (this.requestTimes.get(ownerId) ?? []).filter((time) => time > cutoff)
    if (current.length >= 10)
      throw new AppError(429, 'EXPORT_RATE_LIMITED', 'Bạn đã yêu cầu xuất quá nhiều lần.')
    current.push(Date.now())
    this.requestTimes.set(ownerId, current)
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
}
