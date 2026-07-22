export function MapAlert(props: { message: string; onClose(): void }) {
  return (
    <div className="alert map-alert" role="alert">
      <span>{props.message}</span>
      <button aria-label="Đóng thông báo lỗi" onClick={() => props.onClose()} type="button">
        ×
      </button>
    </div>
  )
}
