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
    pattern: /^map-workspace-[\w-]+\.js$/,
    rawBytes: 1_100_000,
  },
  {
    gzipBytes: 20_000,
    label: 'CSS ứng dụng',
    pattern: /^index-[\w-]+\.css$/,
    rawBytes: 100_000,
  },
]

const files = readdirSync(assetsDirectory)
const failures = []

function kilobytes(bytes) {
  return `${(bytes / 1000).toFixed(2)} kB`
}

for (const budget of budgets) {
  const matches = files.filter((file) => budget.pattern.test(file))
  if (matches.length !== 1) {
    console.error(`✗ ${budget.label}: cần đúng một asset, tìm thấy ${matches.length}.`)
    failures.push(budget.label)
    continue
  }
  const content = readFileSync(new URL(matches[0], assetsDirectory))
  const gzipBytes = gzipSync(content).byteLength
  const ok = content.byteLength <= budget.rawBytes && gzipBytes <= budget.gzipBytes
  console.log(
    `${ok ? '✓' : '✗'} ${budget.label}: ${kilobytes(content.byteLength)} raw, ${kilobytes(gzipBytes)} gzip`,
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
