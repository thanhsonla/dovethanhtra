import { readFileSync, readdirSync } from 'node:fs'
import { gzipSync } from 'node:zlib'

const assetsDirectory = new URL('../apps/web/dist/assets/', import.meta.url)
const budgets = [
  {
    gzipBytes: 75_000,
    label: 'JavaScript khởi động',
    pattern: /^index-[\w-]+\.js$/,
    rawBytes: 250_000,
  },
  {
    gzipBytes: 300_000,
    label: 'JavaScript bản đồ lazy-load',
    pattern: /^map-workspace-(?!drawers-)[\w-]+\.js$/,
    rawBytes: 1_100_000,
  },
  {
    gzipBytes: 20_000,
    label: 'CSS khởi động',
    pattern: /^index-[\w-]+\.css$/,
    rawBytes: 100_000,
  },
  {
    gzipBytes: 19_000,
    label: 'CSS bản đồ lazy-load',
    pattern: /^map-workspace-[\w-]+\.css$/,
    rawBytes: 112_000,
  },
  {
    aggregate: true,
    gzipBytes: 25_000,
    label: 'JavaScript bảng thông tin theo yêu cầu',
    minimumMatches: 2,
    pattern:
      /^(?:map-workspace-drawers|map-feature-card|measurement-summary|offline-store)-[\w-]+\.js$/,
    rawBytes: 85_000,
  },
]

const files = readdirSync(assetsDirectory)
const failures = []

function kilobytes(bytes) {
  return `${(bytes / 1000).toFixed(2)} kB`
}

for (const budget of budgets) {
  const matches = files.filter((file) => budget.pattern.test(file))
  const validMatchCount = budget.aggregate
    ? matches.length >= (budget.minimumMatches ?? 1)
    : matches.length === 1
  if (!validMatchCount) {
    const expectation = budget.aggregate
      ? `ít nhất ${budget.minimumMatches ?? 1} asset`
      : 'đúng một asset'
    console.error(`✗ ${budget.label}: cần ${expectation}, tìm thấy ${matches.length}.`)
    failures.push(budget.label)
    continue
  }
  const contents = matches.map((file) => readFileSync(new URL(file, assetsDirectory)))
  const rawBytes = contents.reduce((total, content) => total + content.byteLength, 0)
  const gzipBytes = contents.reduce((total, content) => total + gzipSync(content).byteLength, 0)
  const ok = rawBytes <= budget.rawBytes && gzipBytes <= budget.gzipBytes
  console.log(
    `${ok ? '✓' : '✗'} ${budget.label}: ${kilobytes(rawBytes)} raw, ${kilobytes(gzipBytes)} gzip`,
  )
  if (!ok) {
    console.error(
      `  Ngân sách: ${kilobytes(budget.rawBytes)} raw, ${kilobytes(budget.gzipBytes)} gzip.`,
    )
    failures.push(budget.label)
  }
}

if (failures.length > 0) {
  console.error(`Bundle vượt ngân sách: ${failures.join(', ')}.`)
  process.exitCode = 1
} else {
  console.log('Bundle nằm trong ngân sách hiệu năng Mốc 4.')
}
