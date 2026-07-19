import ExcelJS from 'exceljs'

import type { ExportArtifact, ExportDataset, ExportProvider } from './export-provider.js'

const headerStyle = {
  font: { bold: true, color: { argb: 'FFFFFFFF' } },
  fill: { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FF174A3A' } },
}
const cellText = (value: unknown) => {
  if (value === null || value === undefined) return ''
  if (typeof value === 'object') return JSON.stringify(value)
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint')
    return String(value)
  return ''
}

function addSheet(workbook: ExcelJS.Workbook, name: string, columns: string[], rows: unknown[][]) {
  const sheet = workbook.addWorksheet(name)
  sheet.addRow(columns)
  sheet.getRow(1).eachCell((cell) => Object.assign(cell, { style: headerStyle }))
  rows.forEach((row) => sheet.addRow(row))
  sheet.columns.forEach((column, index) => {
    column.width = Math.min(50, Math.max(12, ...rows.map((row) => cellText(row[index]).length + 2)))
  })
  sheet.views = [{ state: 'frozen', ySplit: 1 }]
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } }
}

export class LocalExportProvider implements ExportProvider {
  async create(format: 'geojson' | 'xlsx', data: ExportDataset): Promise<ExportArtifact> {
    if (format === 'geojson') return this.geoJson(data)
    const workbook = new ExcelJS.Workbook()
    workbook.creator = 'Dove hiện trường'
    workbook.created = new Date(data.generatedAt)
    addSheet(
      workbook,
      'Hồ sơ',
      ['Trường', 'Giá trị'],
      [
        ['ID', data.inspectionCase.id],
        ['Mã hồ sơ', data.inspectionCase.caseCode],
        ['Tên', data.inspectionCase.name],
        ['Địa bàn', data.inspectionCase.adminAreaName],
        ['Từ ngày', data.inspectionCase.periodStart],
        ['Đến ngày', data.inspectionCase.periodEnd],
        ['Trạng thái', data.inspectionCase.status],
        ['Thời điểm xuất UTC', data.generatedAt],
      ],
    )
    const work = new Map(data.comparison.items.map((item) => [item.workItemId, item]))
    addSheet(
      workbook,
      'Công tác',
      ['ID', 'Nhóm', 'Tên', 'Đơn vị', 'Khối lượng kiểm tra'],
      [...work.values()].map((item) => [
        item.workItemId,
        item.groupName,
        item.workItemName,
        item.unit,
        item.inspectedQuantity,
      ]),
    )
    addSheet(
      workbook,
      'Phép đo',
      [
        'ID',
        'Công tác ID',
        'Công tác',
        'Nhóm',
        'Mã',
        'Tên',
        'Phiên bản',
        'Phương pháp',
        'Geometry',
        'Khối lượng',
        'Đơn vị',
        'Trạng thái',
      ],
      data.measurements.map((item) => [
        item.id,
        item.workItemId,
        item.workItemName,
        item.groupName,
        item.code,
        item.name,
        item.version,
        item.method,
        item.geometryKind,
        item.calculatedQuantity,
        item.unit,
        item.status,
      ]),
    )
    addSheet(
      workbook,
      'Khối lượng nguồn',
      [
        'ID',
        'Công tác ID',
        'Loại nguồn',
        'Số tài liệu',
        'Ngày tài liệu',
        'Khối lượng',
        'Đơn vị',
        'Từ ngày',
        'Đến ngày',
        'Ghi chú',
        'Attachment ID',
      ],
      data.sources.map((item) => [
        item.id,
        item.workItemId,
        item.sourceKind,
        item.documentNo,
        item.documentDate,
        item.quantity,
        item.unit,
        item.periodStart,
        item.periodEnd,
        item.note,
        item.attachmentId,
      ]),
    )
    addSheet(
      workbook,
      'Đối chiếu',
      [
        'Công tác ID',
        'Công tác',
        'Loại nguồn',
        'Nguồn',
        'Kiểm tra',
        'Chênh lệch',
        'Tỷ lệ %',
        'Trạng thái',
        'Giải trình',
      ],
      data.comparison.items.map((item) => [
        item.workItemId,
        item.workItemName,
        item.sourceKind,
        item.sourceQuantity,
        item.inspectedQuantity,
        item.difference,
        item.differencePercent,
        item.status,
        item.explanation,
      ]),
    )
    const value = await workbook.xlsx.writeBuffer()
    return {
      bytes: Buffer.from(value),
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      extension: 'xlsx',
    }
  }

  private geoJson(data: ExportDataset): ExportArtifact {
    const bytes = Buffer.from(
      JSON.stringify({
        type: 'FeatureCollection',
        dove: {
          caseId: data.inspectionCase.id,
          caseCode: data.inspectionCase.caseCode,
          generatedAt: data.generatedAt,
        },
        features: data.measurements.map((item) => ({
          type: 'Feature',
          id: item.id,
          geometry: item.geometry,
          properties: {
            measurementId: item.id,
            workItemId: item.workItemId,
            workItemName: item.workItemName,
            groupName: item.groupName,
            code: item.code,
            name: item.name,
            version: item.version,
            method: item.method,
            geometryKind: item.geometryKind,
            calculatedQuantity: item.calculatedQuantity,
            unit: item.unit,
            status: item.status,
          },
        })),
      }),
    )
    return { bytes, contentType: 'application/geo+json; charset=utf-8', extension: 'geojson' }
  }
}
