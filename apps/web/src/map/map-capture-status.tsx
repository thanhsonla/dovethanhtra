import type { StoredCaptureDraft } from '../field/offline-store.js'

const labels: Record<StoredCaptureDraft['status'], string> = {
  conflict: 'Cần kiểm tra',
  failed: 'Cần kiểm tra',
  queued: 'Chờ mạng',
  synced: 'Đã đồng bộ',
  syncing: 'Đang đồng bộ',
}

export function MapCaptureStatus(props: { draft: StoredCaptureDraft; onOpen: () => void }) {
  return (
    <button
      className={`map-capture-status is-${props.draft.status}`}
      disabled={!props.draft.serverDraft}
      onClick={props.onOpen}
      type="button"
    >
      Nháp chưa phân loại · {labels[props.draft.status]}
      {props.draft.serverDraft && <span>Phân loại →</span>}
    </button>
  )
}
