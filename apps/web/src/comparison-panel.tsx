import type {
  Attachment,
  CaseComparison,
  InspectionCase,
  SourceQuantityKind,
  WorkItem,
} from '@dove/contracts'
import { type FormEvent, useEffect, useState } from 'react'

import { api } from './api.js'

const sourceLabels: Record<SourceQuantityKind, string> = {
  accepted: 'Nghiệm thu',
  contract: 'Hợp đồng',
  estimate: 'Dự toán',
  other: 'Khác',
  reported: 'Báo cáo',
}

const number = (value: number | null, digits = 2) =>
  value === null ? '—' : value.toLocaleString('vi-VN', { maximumFractionDigits: digits })
const formString = (values: FormData, name: string) => {
  const value = values.get(name)
  return typeof value === 'string' ? value : ''
}

export function ComparisonPanel(props: {
  inspectionCase: InspectionCase
  workItems: WorkItem[]
  onCaseChanged(value: InspectionCase): void
  onError(value: string): void
}) {
  const [comparison, setComparison] = useState<CaseComparison | null>(null)
  const [selectedWorkId, setSelectedWorkId] = useState(props.workItems[0]?.id ?? '')
  const [reason, setReason] = useState('')
  const [explanations, setExplanations] = useState<Record<string, string>>({})
  const [explanationAttachments, setExplanationAttachments] = useState<Record<string, string>>({})
  const [attachments, setAttachments] = useState<Record<string, Attachment[]>>({})
  const [exportState, setExportState] = useState('')
  const locked = props.inspectionCase.status === 'locked'

  const refresh = async () => setComparison(await api.getComparison(props.inspectionCase.id))
  useEffect(() => {
    void refresh().catch((error: unknown) =>
      props.onError(error instanceof Error ? error.message : 'Không tải được đối chiếu.'),
    )
  }, [props.inspectionCase.id])
  useEffect(() => {
    void Promise.all(
      props.workItems.map(async (work) => [work.id, await api.listAttachments(work.id)] as const),
    )
      .then((entries) => setAttachments(Object.fromEntries(entries)))
      .catch((error: unknown) =>
        props.onError(error instanceof Error ? error.message : 'Không tải được ảnh bằng chứng.'),
      )
  }, [props.inspectionCase.id, props.workItems])

  const submitSource = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = event.currentTarget
    const values = new FormData(form)
    const work = props.workItems.find((item) => item.id === selectedWorkId)
    if (!work) return
    try {
      await api.createSourceQuantity(work.id, {
        sourceKind: formString(values, 'sourceKind') as SourceQuantityKind,
        quantity: Number(formString(values, 'quantity')),
        unit: work.unit,
        documentNo: formString(values, 'documentNo') || null,
        note: null,
        attachmentId: formString(values, 'attachmentId') || null,
      })
      form.reset()
      await refresh()
    } catch (error) {
      props.onError(error instanceof Error ? error.message : 'Không thể lưu khối lượng nguồn.')
    }
  }

  const download = async (format: 'excel' | 'geojson') => {
    try {
      setExportState('Đã xếp hàng tạo tệp…')
      let job = await api.exportCase(props.inspectionCase.id, format)
      for (
        let attempt = 0;
        attempt < 120 && ['pending', 'processing'].includes(job.status);
        attempt += 1
      ) {
        await new Promise((resolve) => window.setTimeout(resolve, 250))
        job = await api.getExportJob(job.id)
        setExportState(`Export ${job.status}…`)
      }
      if (job.status !== 'completed')
        throw new Error(job.errorMessage ?? 'Export job không hoàn tất.')
      const result = await api.downloadExport(job.id)
      const url = URL.createObjectURL(result.blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = result.fileName
      anchor.click()
      URL.revokeObjectURL(url)
      setExportState(`Đã xuất ${result.fileName} · ${result.sha256?.slice(0, 12)}…`)
    } catch (error) {
      setExportState('')
      props.onError(error instanceof Error ? error.message : 'Không thể xuất dữ liệu.')
    }
  }

  const transition = async () => {
    try {
      const result = locked
        ? await api.unlockCase(props.inspectionCase.id, reason)
        : await api.lockCase(props.inspectionCase.id, reason)
      props.onCaseChanged(result.inspectionCase)
      setReason('')
      await refresh()
    } catch (error) {
      props.onError(error instanceof Error ? error.message : 'Không thể đổi trạng thái hồ sơ.')
    }
  }

  return (
    <section className="panel comparison-panel">
      <p className="section-kicker">Mốc 5 · Đối chiếu và xuất</p>
      <h2>Khối lượng nguồn</h2>
      {!locked && (
        <form className="comparison-form" onSubmit={(event) => void submitSource(event)}>
          <label>
            Công tác
            <select
              value={selectedWorkId}
              onChange={(event) => setSelectedWorkId(event.target.value)}
            >
              {props.workItems.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Loại nguồn
            <select name="sourceKind" defaultValue="accepted">
              {Object.entries(sourceLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Khối lượng nguồn
            <input name="quantity" type="number" min="0" step="any" required />
          </label>
          <label>
            Số tài liệu
            <input name="documentNo" maxLength={200} />
          </label>
          <label>
            Ảnh bằng chứng
            <select name="attachmentId" defaultValue="">
              <option value="">Không đính kèm</option>
              {(attachments[selectedWorkId] ?? []).map((attachment) => (
                <option key={attachment.id} value={attachment.id}>
                  {attachment.originalName}
                </option>
              ))}
            </select>
          </label>
          <button className="button">Lưu nguồn</button>
        </form>
      )}

      {!locked && (
        <form
          className="threshold-form"
          onSubmit={(event) => {
            event.preventDefault()
            const values = new FormData(event.currentTarget)
            const absolute = formString(values, 'absolute')
            const percent = formString(values, 'percent')
            void api
              .setCaseComparisonThreshold(props.inspectionCase.id, {
                ...(absolute ? { absolute: Number(absolute) } : {}),
                ...(percent ? { percent: Number(percent) } : {}),
              })
              .then(refresh)
              .catch((error: unknown) =>
                props.onError(error instanceof Error ? error.message : 'Không lưu được ngưỡng.'),
              )
          }}
        >
          <label>
            Ngưỡng tuyệt đối
            <input name="absolute" type="number" min="0" step="any" />
          </label>
          <label>
            Ngưỡng tỷ lệ (%)
            <input name="percent" type="number" min="0" step="any" />
          </label>
          <button className="button button--quiet">Lưu ngưỡng hồ sơ</button>
        </form>
      )}

      <h3>Kết quả đối chiếu</h3>
      <div className="comparison-table-wrap">
        <table className="comparison-table">
          <thead>
            <tr>
              <th>Công tác</th>
              <th>Nguồn</th>
              <th>Kiểm tra</th>
              <th>Chênh</th>
              <th>Tỷ lệ</th>
              <th>Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {comparison?.items.map((item) => (
              <tr key={item.sourceQuantityId ?? item.workItemId}>
                <td>{item.workItemName}</td>
                <td>
                  {item.sourceKind
                    ? `${sourceLabels[item.sourceKind]}: ${number(item.sourceQuantity)}`
                    : 'Chưa có'}
                </td>
                <td>
                  {number(item.inspectedQuantity)} {item.unit}
                </td>
                <td>{number(item.difference)}</td>
                <td>
                  {number(item.differencePercent)}
                  {item.differencePercent === null ? '' : '%'}
                </td>
                <td>
                  {item.status === 'warning'
                    ? 'Cảnh báo'
                    : item.status === 'no_source_baseline'
                      ? 'Chưa có cơ sở tỷ lệ'
                      : 'Trong ngưỡng'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {comparison && comparison.aggregates.length > 0 && (
        <ul className="comparison-aggregates">
          {comparison.aggregates.map((item) => (
            <li key={`${item.groupId ?? 'case'}-${item.sourceKind}-${item.unit}`}>
              {item.groupName} · {sourceLabels[item.sourceKind]}: {number(item.inspectedQuantity)} /{' '}
              {number(item.sourceQuantity)} {item.unit}
            </li>
          ))}
        </ul>
      )}
      {!locked &&
        comparison?.items
          .filter((item) => item.sourceQuantityId)
          .map((item) => (
            <div className="explanation-row" key={`explain-${item.sourceQuantityId}`}>
              <label>
                Giải trình · {item.workItemName}
                <textarea
                  value={explanations[item.sourceQuantityId!] ?? item.explanation ?? ''}
                  onChange={(event) =>
                    setExplanations((current) => ({
                      ...current,
                      [item.sourceQuantityId!]: event.target.value,
                    }))
                  }
                />
              </label>
              <label>
                Ảnh giải trình
                <select
                  value={
                    explanationAttachments[item.sourceQuantityId!] ??
                    item.explanationAttachmentId ??
                    ''
                  }
                  onChange={(event) =>
                    setExplanationAttachments((current) => ({
                      ...current,
                      [item.sourceQuantityId!]: event.target.value,
                    }))
                  }
                >
                  <option value="">Không đính kèm</option>
                  {(attachments[item.workItemId] ?? []).map((attachment) => (
                    <option key={attachment.id} value={attachment.id}>
                      {attachment.originalName}
                    </option>
                  ))}
                </select>
              </label>
              <button
                className="button button--quiet"
                onClick={() =>
                  void api
                    .saveComparisonExplanation(
                      item.sourceQuantityId!,
                      explanations[item.sourceQuantityId!] ?? item.explanation ?? '',
                      explanationAttachments[item.sourceQuantityId!] ??
                        item.explanationAttachmentId ??
                        null,
                    )
                    .then(refresh)
                    .catch((error: unknown) =>
                      props.onError(
                        error instanceof Error ? error.message : 'Không lưu được giải trình.',
                      ),
                    )
                }
              >
                Lưu giải trình
              </button>
            </div>
          ))}

      <div className="button-row">
        <button className="button" disabled={!locked} onClick={() => void download('excel')}>
          Xuất Excel
        </button>
        <button
          className="button button--quiet"
          disabled={!locked}
          onClick={() => void download('geojson')}
        >
          Xuất GeoJSON
        </button>
      </div>
      {!locked && <small>Khóa hồ sơ để cố định snapshot trước khi xuất.</small>}
      {exportState && <small>{exportState}</small>}

      <h3>Toàn vẹn hồ sơ</h3>
      <label>
        Lý do {locked ? 'mở khóa' : 'khóa'}
        <input value={reason} minLength={3} onChange={(event) => setReason(event.target.value)} />
      </label>
      <button
        className="button"
        disabled={reason.trim().length < 3}
        onClick={() => void transition()}
      >
        {locked ? 'Mở khóa hồ sơ' : 'Khóa hồ sơ và tạo snapshot'}
      </button>
    </section>
  )
}
