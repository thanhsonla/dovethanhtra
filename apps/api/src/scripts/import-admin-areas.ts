import { readFile, stat } from 'node:fs/promises'
import { isAbsolute, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { loadConfig } from '../config.js'
import {
  importAdminAreas,
  parseAdminAreaGeoJson,
} from '../modules/admin-areas/admin-area-import.js'
import { createDatabase } from '../platform/database.js'

const argument = process.argv.slice(2).find((value) => value !== '--')
if (!argument) {
  throw new Error('Cách dùng: pnpm db:admin-area:import -- /đường/dẫn/ranh-gioi.geojson')
}

const candidates = isAbsolute(argument)
  ? [argument]
  : [
      resolve(process.cwd(), argument),
      resolve(fileURLToPath(new URL('../../../../', import.meta.url)), argument),
    ]
let path = candidates[0]!
for (const candidate of candidates) {
  try {
    if ((await stat(candidate)).isFile()) {
      path = candidate
      break
    }
  } catch {
    // Thử vị trí tiếp theo để hỗ trợ chạy script từ workspace root hoặc package API.
  }
}

const file = await stat(path)
if (!file.isFile()) throw new Error('Đường dẫn import không phải tệp.')
if (file.size > 20_000_000) throw new Error('GeoJSON vượt giới hạn 20 MB.')

const parsed = parseAdminAreaGeoJson(await readFile(path))
const database = createDatabase(loadConfig().databaseUrl)
try {
  const result = await database.query
    .transaction()
    .execute((transaction) => importAdminAreas(transaction, parsed))
  process.stdout.write(
    `Import địa giới hoàn tất: ${result.inserted} mới, ${result.skipped} đã tồn tại; source hash ${parsed.sourceHash}.\n`,
  )
} finally {
  await database.destroy()
}
