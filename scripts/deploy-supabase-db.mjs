import { execSync } from 'node:child_process'
import pg from 'pg'

const { Client } = pg

const databaseUrl = process.env.DATABASE_URL

if (!databaseUrl) {
  console.error('❌ LỖI: Chưa cung cấp biến môi trường DATABASE_URL.')
  console.error('Cách dùng: DATABASE_URL="postgresql://..." node scripts/deploy-supabase-db.mjs')
  process.exit(1)
}

console.log('🚀 Bắt đầu khởi tạo & triển khai cơ sở dữ liệu trên Supabase...\n')

async function setupSupabaseDatabase() {
  const client = new Client({
    connectionString: databaseUrl,
    ssl:
      databaseUrl.includes('localhost') || databaseUrl.includes('127.0.0.1')
        ? false
        : { rejectUnauthorized: false },
  })

  try {
    console.log('1️⃣ Đang kết nối tới Supabase PostgreSQL...')
    await client.connect()
    console.log('   ✅ Kết nối thành công!')

    console.log('2️⃣ Đang bật extension PostGIS...')
    await client.query('CREATE EXTENSION IF NOT EXISTS postgis;')
    const res = await client.query('SELECT PostGIS_Full_Version();')
    console.log(`   ✅ PostGIS đã sẵn sàng: ${res.rows[0].postgis_full_version.split(' ')[0]}`)

    await client.end()
  } catch (err) {
    console.error('❌ Lỗi khi khởi tạo extension PostGIS:', err.message)
    process.exit(1)
  }

  try {
    console.log('\n3️⃣ Đang thực thi migrations (pnpm db:migrate)...')
    execSync('pnpm db:migrate', { stdio: 'inherit', env: process.env })

    console.log('\n4️⃣ Đang nạp danh mục 75 xã/phường Sơn La (pnpm db:admin-area:import)...')
    execSync('pnpm db:admin-area:import', { stdio: 'inherit', env: process.env })

    console.log('\n5️⃣ Đang nạp danh mục dịch vụ hệ thống (pnpm db:seed)...')
    execSync('pnpm db:seed', { stdio: 'inherit', env: process.env })

    console.log(
      '\n🎉 HOÀN THÀNH: Cơ sở dữ liệu Supabase đã khởi tạo thành công và sẵn sàng phục vụ!',
    )
  } catch (err) {
    console.error('\n❌ Lỗi trong quá trình chạy migration/seed:', err.message)
    process.exit(1)
  }
}

setupSupabaseDatabase()
