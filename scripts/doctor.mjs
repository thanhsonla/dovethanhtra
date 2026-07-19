import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

const root = new URL('../', import.meta.url)
const packageJson = JSON.parse(readFileSync(new URL('package.json', root), 'utf8'))
const expectedNode = readFileSync(new URL('.node-version', root), 'utf8').trim()
const expectedPnpm = packageJson.packageManager.replace(/^pnpm@/, '')
const checkServices = process.argv.includes('--services')
const failures = []

function command(name, args) {
  return spawnSync(name, args, {
    cwd: root,
    encoding: 'utf8',
    env: process.env,
  })
}

function report(label, ok, detail) {
  const marker = ok ? '✓' : '✗'
  console.log(`${marker} ${label}: ${detail}`)
  if (!ok) failures.push(label)
}

report(
  'Node.js',
  process.versions.node === expectedNode,
  `${process.versions.node} (cần ${expectedNode})`,
)

const pnpm = command('pnpm', ['--version'])
const pnpmVersion = pnpm.stdout.trim()
report(
  'pnpm',
  pnpm.status === 0 && pnpmVersion === expectedPnpm,
  pnpm.status === 0 ? `${pnpmVersion} (cần ${expectedPnpm})` : 'không tìm thấy',
)

const docker = command('docker', ['version', '--format', '{{.Server.Version}}'])
report(
  'Docker daemon',
  docker.status === 0,
  docker.status === 0 ? docker.stdout.trim() : 'không truy cập được',
)

const compose = command('docker', ['compose', 'config', '--quiet'])
report(
  'Docker Compose',
  compose.status === 0,
  compose.status === 0 ? 'cấu hình hợp lệ' : 'lỗi cấu hình',
)

if (checkServices && docker.status === 0 && compose.status === 0) {
  const services = command('docker', ['compose', 'ps', '--format', 'json'])
  const rows = services.stdout
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line))
  for (const service of ['postgis', 'minio', 'clamav']) {
    const row = rows.find((item) => item.Service === service)
    const healthy = row?.State === 'running' && row.Health === 'healthy'
    report(
      service,
      healthy,
      row ? `${row.State}/${row.Health || 'không có healthcheck'}` : 'chưa chạy',
    )
  }
}

if (failures.length > 0) {
  console.error(`Môi trường chưa đạt: ${failures.join(', ')}.`)
  process.exitCode = 1
} else {
  console.log('Môi trường phát triển đạt yêu cầu.')
}
