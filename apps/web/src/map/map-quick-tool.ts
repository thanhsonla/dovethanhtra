import type { DrawableMeasurementGeometryKind, WorkItem, WorkType } from '@dove/contracts'

import type { MapMode } from './measurement-map.js'
import { measurementKindForWork } from './map-workspace-state.js'

const modeLabels: Record<MapMode, string> = {
  area: 'Vẽ vùng',
  edit: 'Hiệu chỉnh',
  line: 'Vẽ tuyến',
  measure: 'Đo nháp',
  point: 'Vẽ điểm',
  view: 'Xem',
}

export function mapModeLabel(mode: MapMode): string {
  return modeLabels[mode]
}

export function quickToolWork(
  kind: DrawableMeasurementGeometryKind,
  selected: WorkItem | null,
  workItems: WorkItem[],
  workTypes: WorkType[],
): WorkItem | null {
  if (selected && measurementKindForWork(selected, workTypes) === kind) return selected
  return workItems.find((item) => measurementKindForWork(item, workTypes) === kind) ?? null
}

export function quickToolDecision(
  kind: DrawableMeasurementGeometryKind,
  locked: boolean,
  selected: WorkItem | null,
  workItems: WorkItem[],
  workTypes: WorkType[],
): { error?: string; openData?: boolean; target?: WorkItem } {
  if (locked) return { error: 'Hồ sơ đã khóa nên không thể bắt đầu phép đo mới.' }
  const target = quickToolWork(kind, selected, workItems, workTypes)
  return target
    ? { target }
    : {
        error: `Chưa có công tác ${mapModeLabel(kind).toLocaleLowerCase('vi')}. Hãy tạo trong ngăn Dữ liệu.`,
        openData: true,
      }
}
