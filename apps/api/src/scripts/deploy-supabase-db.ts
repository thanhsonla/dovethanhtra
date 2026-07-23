import { execSync } from "node:child_process";
import pg from "pg";

const { Client } = pg;

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("❌ LỖI: Chưa cung cấp biến môi trường DATABASE_URL.");
  console.error("Cách dùng: DATABASE_URL=\"postgresql://...\" pnpm db:deploy:supabase");
  process.exit(1);
}

const activeUrl: string = databaseUrl;

console.log("🚀 Bắt đầu khởi tạo & triển khai cơ sở dữ liệu trên Supabase...\n");

async function setupSupabaseDatabase() {
  const connectionUrlWithoutParams = activeUrl.split("?")[0];
  const client = new Client({
    connectionString: connectionUrlWithoutParams,
    ssl: { rejectUnauthorized: false },
  });

  try {
    console.log("1️⃣ Đang kết nối tới Supabase PostgreSQL...");
    await client.connect();
    console.log("   ✅ Kết nối thành công!");

    console.log("2️⃣ Đang bật các extension PostGIS và pgcrypto...");
    await client.query("CREATE EXTENSION IF NOT EXISTS postgis;");
    await client.query("CREATE EXTENSION IF NOT EXISTS pgcrypto;");
    const res = await client.query<{ postgis_full_version: string }>("SELECT PostGIS_Full_Version();");
    const version = res.rows[0]?.postgis_full_version.split(" ")[0] ?? "unknown";
    console.log(`   ✅ PostGIS đã sẵn sàng: ${version}`);

    await client.end();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("❌ Lỗi khi kết nối hoặc tạo extensions:", message);
    process.exit(1);
  }

  const env = {
    ...process.env,
    NODE_TLS_REJECT_UNAUTHORIZED: "0",
    MINIO_ROOT_USER: process.env.MINIO_ROOT_USER || "dove_local",
    MINIO_ROOT_PASSWORD: process.env.MINIO_ROOT_PASSWORD || "local-only-change-me",
    MINIO_ENDPOINT: process.env.MINIO_ENDPOINT || "127.0.0.1",
    MINIO_PORT: process.env.MINIO_PORT || "9000",
    MINIO_USE_SSL: process.env.MINIO_USE_SSL || "false",
    MINIO_BUCKET: process.env.MINIO_BUCKET || "dove-evidence-production",
    BOOTSTRAP_OWNER_EMAIL: process.env.BOOTSTRAP_OWNER_EMAIL || "owner@example.local",
    BOOTSTRAP_OWNER_PASSWORD: process.env.BOOTSTRAP_OWNER_PASSWORD || "local-demo-password",
    BOOTSTRAP_OWNER_NAME: process.env.BOOTSTRAP_OWNER_NAME || "Quản trị viên Hệ thống",
  };

  try {
    console.log("\n3️⃣ Đang thực thi migrations (pnpm db:migrate)...");
    execSync("pnpm --filter @dove/api db:migrate", { stdio: "inherit", env });

    console.log("\n4️⃣ Đang nạp danh mục địa giới gốc 75 xã/phường Sơn La (2025)...");
    execSync(
      "pnpm --filter @dove/api db:admin-area:import -- ../../data/admin-areas/son-la-75-communes-2025.geojson",
      { stdio: "inherit", env }
    );

    console.log("\n5️⃣ Đang nạp danh mục địa giới chuẩn hóa topology (2026)...");
    execSync(
      "pnpm --filter @dove/api db:admin-area:import -- ../../data/admin-areas/son-la-75-communes-topology-2026.geojson",
      { stdio: "inherit", env }
    );

    console.log("\n6️⃣ Đang nạp danh mục dịch vụ hệ thống (pnpm db:seed)...");
    execSync("pnpm --filter @dove/api db:seed", { stdio: "inherit", env });

    console.log("\n🎉 HOÀN THÀNH: Cơ sở dữ liệu Supabase đã khởi tạo thành công và sẵn sàng phục vụ!");
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("\n❌ Lỗi trong quá trình chạy migration/seed:", message);
    process.exit(1);
  }
}

void setupSupabaseDatabase();
