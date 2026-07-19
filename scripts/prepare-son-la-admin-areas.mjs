import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

const EXPECTED_SOURCE_HASH = '83c1ca1776ec1eae391a297a38261168c24ccb68643171ead6ea73d8b22e3e85'
const SOURCE_COMMIT = '86361845ba60ee779905ef07f04d7db33c798d04'
const SOURCE_VERSION = 'son-la-75-qdt19-2025-gis-20260311-86361845'
const VALID_FROM = '2025-07-01'

const officialUnits = new Map(
  `03646\tPhường Tô Hiệu
03664\tPhường Chiềng An
03670\tPhường Chiềng Cơi
03679\tPhường Chiềng Sinh
03979\tPhường Mộc Sơn
03980\tPhường Mộc Châu
03982\tPhường Thảo Nguyên
04033\tPhường Vân Sơn
03688\tXã Mường Chiên
03694\tXã Mường Giôn
03703\tXã Quỳnh Nhai
03712\tXã Mường Sại
03721\tXã Thuận Châu
03724\tXã Bình Thuận
03727\tXã Mường É
03754\tXã Chiềng La
03757\tXã Mường Khiêng
03760\tXã Mường Bám
03763\tXã Long Hẹ
03781\tXã Co Mạ
03784\tXã Nậm Lầu
03799\tXã Muổi Nọi
03808\tXã Mường La
03814\tXã Chiềng Lao
03820\tXã Ngọc Chiến
03847\tXã Mường Bú
03850\tXã Chiềng Hoa
03856\tXã Bắc Yên
03862\tXã Xím Vàng
03868\tXã Tà Xùa
03871\tXã Pắc Ngà
03880\tXã Tạ Khoa
03892\tXã Chiềng Sại
03901\tXã Suối Tọ
03907\tXã Mường Cơi
03910\tXã Phù Yên
03922\tXã Gia Phù
03943\tXã Mường Bang
03958\tXã Tường Hạ
03961\tXã Kim Bon
03970\tXã Tân Phong
03985\tXã Chiềng Sơn
03997\tXã Tân Yên
04000\tXã Đoàn Kết
04006\tXã Song Khủa
04018\tXã Tô Múa
04045\tXã Lóng Sập
04048\tXã Vân Hồ
04057\tXã Xuân Nha
04075\tXã Yên Châu
04078\tXã Chiềng Hặc
04087\tXã Yên Sơn
04096\tXã Lóng Phiêng
04099\tXã Phiêng Khoài
04105\tXã Mai Sơn
04108\tXã Chiềng Sung
04117\tXã Mường Chanh
04123\tXã Chiềng Mung
04132\tXã Chiềng Mai
04136\tXã Tà Hộc
04144\tXã Phiêng Cằm
04159\tXã Phiêng Pằn
04168\tXã Sông Mã
04171\tXã Bó Sinh
04183\tXã Mường Lầm
04186\tXã Nậm Ty
04195\tXã Chiềng Sơ
04204\tXã Chiềng Khoong
04210\tXã Huổi Một
04219\tXã Mường Hung
04222\tXã Chiềng Khương
04228\tXã Púng Bánh
04231\tXã Sốp Cộp
04240\tXã Mường Lèo
04246\tXã Mường Lạn`
    .split('\n')
    .map((line) => line.split('\t')),
)

function object(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} phải là object.`)
  }
  return value
}

function normalizeReviewedGeometry(code, geometry) {
  if (code !== '03760') return { geometry, normalization: null }

  const normalized = structuredClone(geometry)
  const ring = normalized.coordinates?.[0]?.[0]
  const expected = [
    [103.425493, 21.39496],
    [103.425494, 21.39496],
    [103.425493, 21.39496],
  ]
  if (!Array.isArray(ring) || JSON.stringify(ring.slice(154, 157)) !== JSON.stringify(expected)) {
    throw new Error('Mẫu one-point spike đã thẩm định của 03760 không còn khớp nguồn.')
  }

  ring.splice(155, 2)
  return {
    geometry: normalized,
    normalization: {
      action: 'remove-one-point-spike',
      code,
      originalGeometry: geometry,
      originalSequence: expected,
      reason:
        'PostGIS ST_IsValid phát hiện Self-intersection[103.425493 21.39496]; bỏ vòng A-B-A dài một điểm, không dùng ST_MakeValid.',
    },
  }
}

function sourceFeature(value, index) {
  const feature = object(value, `features[${index}]`)
  const properties = object(feature.properties, `features[${index}].properties`)
  const code = String(properties.commune_code ?? '')
  const name = String(properties.commune_full_name ?? '')
  const expectedName = officialUnits.get(code)

  if (!expectedName || expectedName !== name) {
    throw new Error(`Đơn vị ${code || '(thiếu mã)'}/${name || '(thiếu tên)'} không khớp danh mục.`)
  }
  if (feature.geometry?.type !== 'MultiPolygon') {
    throw new Error(`Hình học ${code} phải là MultiPolygon; không tự chuyển hoặc làm sạch.`)
  }

  const reviewed = normalizeReviewedGeometry(code, feature.geometry)

  return {
    feature: {
      type: 'Feature',
      properties: {
        code,
        name,
        areaType: name.startsWith('Phường ') ? 'ward' : 'commune',
        source:
          'Tên/mã: NQ 1681/NQ-UBTVQH15 và QĐ 19/2025/QĐ-TTg; hình học tham khảo: vietnamese-provinces-database (MIT), geojson_11Mar2026',
        sourceVersion: SOURCE_VERSION,
        validFrom: VALID_FROM,
        validTo: null,
        normalizationReason: reviewed.normalization?.reason ?? null,
      },
      geometry: reviewed.geometry,
    },
    normalization: reviewed.normalization,
  }
}

const [inputArgument, outputArgument] = process.argv
  .slice(2)
  .filter((argument) => argument !== '--')
if (!inputArgument || !outputArgument) {
  throw new Error(
    'Cách dùng: node scripts/prepare-son-la-admin-areas.mjs <nguồn.geojson> <đích.geojson>',
  )
}

const inputPath = resolve(inputArgument)
const outputPath = resolve(outputArgument)
const sourceBytes = await readFile(inputPath)
const sourceHash = createHash('sha256').update(sourceBytes).digest('hex')
if (sourceHash !== EXPECTED_SOURCE_HASH) {
  throw new Error(
    `Checksum nguồn đã thay đổi (${sourceHash}); phải thẩm định và tạo sourceVersion mới.`,
  )
}

const input = object(JSON.parse(sourceBytes.toString('utf8')), 'GeoJSON nguồn')
if (input.type !== 'FeatureCollection' || !Array.isArray(input.features)) {
  throw new Error('Nguồn phải là GeoJSON FeatureCollection.')
}
if (input.features.length !== officialUnits.size) {
  throw new Error(`Nguồn phải có đúng ${officialUnits.size} địa bàn.`)
}

const reviewedFeatures = input.features.map(sourceFeature)
const features = reviewedFeatures.map((item) => item.feature)
if (new Set(features.map((feature) => feature.properties.code)).size !== officialUnits.size) {
  throw new Error('Mã đơn vị hành chính bị trùng.')
}

const output = {
  type: 'FeatureCollection',
  provenance: {
    administrativeList: ['1681/NQ-UBTVQH15', '19/2025/QĐ-TTg'],
    geometryClassification: 'reference-not-legal-boundary-dossier',
    geometrySnapshotDate: '2026-03-11',
    license: 'MIT',
    sourceCommit: SOURCE_COMMIT,
    sourceHash,
    sourceProject: 'sonla-map-project/public/data/son-la-75-communes.geojson',
  },
  geometryNormalizations: reviewedFeatures
    .map((item) => item.normalization)
    .filter((item) => item !== null),
  features,
}

await mkdir(dirname(outputPath), { recursive: true })
await writeFile(outputPath, `${JSON.stringify(output)}\n`, 'utf8')
const outputBytes = await readFile(outputPath)
const outputHash = createHash('sha256').update(outputBytes).digest('hex')
process.stdout.write(
  `Đã tạo ${features.length} địa bàn (${outputBytes.byteLength} byte), SHA-256 ${outputHash}.\n`,
)
