import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

const EXPECTED_SOURCE_HASH = 'f85e38390fb05ee50b2205f14dc1cda911b81465b6951543f996d8c1913472d7'
const SOURCE_WORKBOOK_HASH = 'c9bc37fee36bab86a1c1fe048a08aaa88affb6e91e5e7b0b61bc5fd646db383c'
const EXPECTED_TOTAL_AREA_KM2 = 14_108.89

const [inputArgument, outputArgument] = process.argv.slice(2).filter((value) => value !== '--')
if (!inputArgument || !outputArgument) {
  throw new Error(
    'Cách dùng: node scripts/prepare-son-la-area-targets.mjs <communes.json> <đích.json>',
  )
}

const inputPath = resolve(inputArgument)
const outputPath = resolve(outputArgument)
const sourceBytes = await readFile(inputPath)
const sourceHash = createHash('sha256').update(sourceBytes).digest('hex')
if (sourceHash !== EXPECTED_SOURCE_HASH) {
  throw new Error(`Checksum bảng diện tích đã thay đổi (${sourceHash}); phải thẩm định lại.`)
}

const source = JSON.parse(sourceBytes.toString('utf8'))
if (!Array.isArray(source) || source.length !== 75) {
  throw new Error('Bảng diện tích phải có đúng 75 đơn vị.')
}

const units = source.map((value, index) => {
  const code = String(value?.code ?? '')
  const name = String(value?.name ?? '').trim()
  const targetAreaKm2 = Number(value?.areaKm2)
  if (!/^\d{5}$/.test(code) || !name || !Number.isFinite(targetAreaKm2) || targetAreaKm2 <= 0) {
    throw new Error(`Dòng diện tích ${index + 1} không hợp lệ.`)
  }
  return { code, name, targetAreaKm2 }
})

if (new Set(units.map((unit) => unit.code)).size !== units.length) {
  throw new Error('Bảng diện tích có mã trùng.')
}
const totalAreaKm2 = Number(units.reduce((total, unit) => total + unit.targetAreaKm2, 0).toFixed(2))
if (totalAreaKm2 !== EXPECTED_TOTAL_AREA_KM2) {
  throw new Error(`Tổng diện tích ${totalAreaKm2} không khớp ${EXPECTED_TOTAL_AREA_KM2} km².`)
}

const output = {
  version: 'son-la-area-targets-2026-07-01',
  provenance: {
    preparedAt: '2026-07-01',
    sourceClassification: 'user-provided-pdf-extraction-reference',
    sourceHash,
    sourceProject: 'sonla-map-project/source/src/data/communes.json',
    sourceWorkbook:
      'sonla-map-project/docs/data/Danh_muc_75_xa_phuong_Son_La_dien_tich_dan_so.xlsx',
    sourceWorkbookHash: SOURCE_WORKBOOK_HASH,
    totalAreaKm2,
  },
  units,
}

await mkdir(dirname(outputPath), { recursive: true })
const bytes = Buffer.from(`${JSON.stringify(output, null, 2)}\n`)
await writeFile(outputPath, bytes)
process.stdout.write(
  `Đã tạo ${units.length} diện tích mục tiêu, SHA-256 ${createHash('sha256').update(bytes).digest('hex')}.\n`,
)
