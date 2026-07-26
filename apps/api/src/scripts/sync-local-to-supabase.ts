import pg from "pg";

const localUrl =
  process.env.LOCAL_DATABASE_URL ||
  "postgresql://dove_local:local-only-change-me@localhost:5432/dove_field";
const remoteUrl =
  process.env.REMOTE_DATABASE_URL ||
  "postgresql://postgres.uqajicuudasoluzopius:C9s7%40uRy%3Fv3%24%40%24%40@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres";

const localPool = new pg.Pool({ connectionString: localUrl });
const remotePool = new pg.Pool({
  connectionString: remoteUrl,
  ssl: { rejectUnauthorized: false },
});

interface BaseRecord extends Record<string, unknown> {
  id?: string;
  code?: string;
  email?: string;
  created_by?: string;
  confirmed_by?: string;
  actor_id?: string;
  actor_user_id?: string;
  owner_id?: string;
  admin_area_id?: string;
  work_type_id?: string;
  service_group_id?: string;
  measurement_kind?: string;
  management_zone_id?: string;
  management_area_id?: string;
  capture_draft_id?: string | null;
  supersedes_id?: string | null;
  classified_measurement_id?: string | null;
  classified_at?: Date | string | null;
  status?: string;
}

async function main(): Promise<void> {
  console.log("🚀 Đang đồng bộ thông minh dữ liệu đo Local sang Supabase...");

  console.log("1️⃣ Syncing app_user & catalog tables...");
  const usersLocal = await localPool.query<BaseRecord>('SELECT * FROM "app_user"');
  const firstUserRow = usersLocal.rows[0];
  if (firstUserRow) {
    const columns = Object.keys(firstUserRow);
    const colNames = columns.map((c) => `"${c}"`).join(", ");
    for (const row of usersLocal.rows) {
      const values = columns.map((c) => {
        const val = row[c];
        if (val && typeof val === "object" && !(val instanceof Date)) {
          return JSON.stringify(val);
        }
        return val;
      });
      const placeholders = columns.map((_, i) => `$${i + 1}`).join(", ");
      await remotePool
        .query(
          `INSERT INTO "app_user" (${colNames}) VALUES (${placeholders}) ON CONFLICT (email) DO UPDATE SET full_name = EXCLUDED.full_name`,
          values
        )
        .catch(() => {});
    }
  }

  console.log("2️⃣ Building Catalog Mappings...");
  const usersRemote = await remotePool.query<{ id: string; email: string }>(
    'SELECT id, email FROM "app_user"'
  );
  const userMap = new Map<string, string>();
  for (const r of usersRemote.rows) {
    userMap.set(r.email, r.id);
  }

  const adminAreasLocal = await localPool.query<{ id: string; code: string }>(
    'SELECT id, code FROM "admin_area"'
  );
  const adminAreasRemote = await remotePool.query<{ id: string; code: string }>(
    'SELECT id, code FROM "admin_area"'
  );
  const adminMap = new Map<string, string>();
  for (const r of adminAreasRemote.rows) {
    adminMap.set(r.code, r.id);
  }

  const mzLocal = await localPool
    .query<{ id: string; code: string }>('SELECT id, code FROM "management_zone"')
    .catch(() => ({ rows: [] as { id: string; code: string }[] }));
  const mzRemote = await remotePool
    .query<{ id: string; code: string }>('SELECT id, code FROM "management_zone"')
    .catch(() => ({ rows: [] as { id: string; code: string }[] }));
  const mzMap = new Map<string, string>();
  for (const r of mzRemote.rows) {
    mzMap.set(r.code, r.id);
  }
  const localMzIdToCode = new Map<string, string>();
  for (const l of mzLocal.rows) {
    localMzIdToCode.set(l.id, l.code);
  }

  const workTypesLocal = await localPool.query<{ id: string; code: string }>(
    'SELECT id, code FROM "work_type"'
  );
  const workTypesRemote = await remotePool.query<{
    id: string;
    code: string;
    service_group_id: string;
    measurement_kind: string;
  }>('SELECT id, code, service_group_id, measurement_kind FROM "work_type"');

  const workTypeMap = new Map<
    string,
    { id: string; service_group_id: string; measurement_kind: string }
  >();
  for (const r of workTypesRemote.rows) {
    workTypeMap.set(r.code, {
      id: r.id,
      service_group_id: r.service_group_id,
      measurement_kind: r.measurement_kind,
    });
  }

  const localUserIdToEmail = new Map<string, string>();
  for (const u of usersLocal.rows) {
    if (u.id && u.email) localUserIdToEmail.set(u.id, u.email);
  }

  const localAdminIdToCode = new Map<string, string>();
  for (const l of adminAreasLocal.rows) {
    localAdminIdToCode.set(l.id, l.code);
  }

  const localWorkTypeIdToCode = new Map<string, string>();
  for (const l of workTypesLocal.rows) {
    localWorkTypeIdToCode.set(l.id, l.code);
  }

  async function syncTable(
    table: string,
    transformRow?: (row: BaseRecord) => void
  ): Promise<void> {
    const { rows } = await localPool.query<BaseRecord>(`SELECT * FROM "${table}"`);
    const firstRow = rows[0];
    if (!firstRow) {
      console.log(`ℹ️ Bảng ${table}: 0 bản ghi.`);
      return;
    }

    const columns = Object.keys(firstRow);
    const colNames = columns.map((c) => `"${c}"`).join(", ");
    const updateClause = columns
      .filter((c) => c !== "id")
      .map((c) => `"${c}" = EXCLUDED."${c}"`)
      .join(", ");

    let synced = 0;
    for (const row of rows) {
      if (transformRow) transformRow(row);

      const values = columns.map((c) => {
        const val = row[c];
        if (val && typeof val === "object" && !(val instanceof Date)) {
          return JSON.stringify(val);
        }
        return val;
      });
      const placeholders = columns.map((_, i) => `$${i + 1}`).join(", ");

      const query = `
        INSERT INTO "${table}" (${colNames})
        VALUES (${placeholders})
        ON CONFLICT (id) DO UPDATE SET ${updateClause}
      `;
      try {
        await remotePool.query(query, values);
        synced++;
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.error(`⚠️ Bảng ${table} (${String(row.id || "N/A")}):`, errMsg);
      }
    }
    console.log(`✅ ${table}: ${synced}/${rows.length} bản ghi.`);
  }

  console.log("3️⃣ Syncing Business Tables...");

  await syncTable("inspection_case", (row) => {
    if (typeof row.admin_area_id === "string") {
      const localCode = localAdminIdToCode.get(row.admin_area_id);
      if (localCode) {
        const val = adminMap.get(localCode);
        if (val !== undefined) row.admin_area_id = val;
      }
    }
    if (typeof row.created_by === "string") {
      const localUserEmail = localUserIdToEmail.get(row.created_by);
      if (localUserEmail) {
        const val = userMap.get(localUserEmail);
        if (val !== undefined) row.created_by = val;
      }
    }
    if (typeof row.owner_id === "string") {
      const ownerEmail = localUserIdToEmail.get(row.owner_id);
      if (ownerEmail) {
        const val = userMap.get(ownerEmail);
        if (val !== undefined) row.owner_id = val;
      }
    }
  });

  await syncTable("case_work_item", (row) => {
    if (typeof row.work_type_id === "string") {
      const localWorkCode = localWorkTypeIdToCode.get(row.work_type_id);
      if (localWorkCode && workTypeMap.has(localWorkCode)) {
        const remoteWork = workTypeMap.get(localWorkCode)!;
        row.work_type_id = remoteWork.id;
        if ("service_group_id" in row) {
          row.service_group_id = remoteWork.service_group_id;
        }
        if ("measurement_kind" in row) {
          row.measurement_kind = remoteWork.measurement_kind;
        }
      }
    }
    if (typeof row.management_zone_id === "string") {
      const mzCode = localMzIdToCode.get(row.management_zone_id);
      if (mzCode) {
        const val = mzMap.get(mzCode);
        if (val !== undefined) row.management_zone_id = val;
      }
    }
    if (typeof row.management_area_id === "string") {
      const areaCode = localAdminIdToCode.get(row.management_area_id);
      if (areaCode) {
        const val = adminMap.get(areaCode);
        if (val !== undefined) row.management_area_id = val;
      }
    }
  });

  await syncTable("work_component");

  console.log("Pass 1: Syncing measurement...");
  const measurementDraftMap = new Map<string, string>();
  const measurementSupersedesMap = new Map<string, string>();

  await syncTable("measurement", (row) => {
    if (typeof row.created_by === "string") {
      const localUserEmail = localUserIdToEmail.get(row.created_by);
      if (localUserEmail) {
        const val = userMap.get(localUserEmail);
        if (val !== undefined) row.created_by = val;
      }
    }
    if (typeof row.confirmed_by === "string") {
      const localUserEmail = localUserIdToEmail.get(row.confirmed_by);
      if (localUserEmail) {
        const val = userMap.get(localUserEmail);
        if (val !== undefined) row.confirmed_by = val;
      }
    }
    if (typeof row.id === "string" && typeof row.capture_draft_id === "string") {
      measurementDraftMap.set(row.id, row.capture_draft_id);
      row.capture_draft_id = null;
    }
    if (typeof row.id === "string" && typeof row.supersedes_id === "string") {
      measurementSupersedesMap.set(row.id, row.supersedes_id);
      row.supersedes_id = null;
    }
  });

  console.log("Pass 2: Restoring measurement supersedes_id...");
  for (const [measurementId, supersedesId] of measurementSupersedesMap.entries()) {
    await remotePool
      .query(
        `UPDATE "measurement" SET supersedes_id = $1 WHERE id = $2`,
        [supersedesId, measurementId]
      )
      .catch((err) => {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.error(
          `⚠️ Restoring measurement supersedes_id (${measurementId}):`,
          errMsg
        );
      });
  }

  console.log("Pass 3: Syncing capture_draft...");
  await syncTable("capture_draft", (row) => {
    if (typeof row.created_by === "string") {
      const localUserEmail = localUserIdToEmail.get(row.created_by);
      if (localUserEmail) {
        const val = userMap.get(localUserEmail);
        if (val !== undefined) row.created_by = val;
      }
    }
    row.status = "unclassified";
    row.classified_measurement_id = null;
    row.classified_at = null;
  });

  console.log("Pass 4: Restoring measurement capture_draft_id...");
  for (const [measurementId, draftId] of measurementDraftMap.entries()) {
    await remotePool
      .query(
        `UPDATE "measurement" SET capture_draft_id = $1 WHERE id = $2`,
        [draftId, measurementId]
      )
      .catch((err) => {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.error(
          `⚠️ Restoring measurement capture_draft_id (${measurementId}):`,
          errMsg
        );
      });
  }

  console.log("Pass 5: Restoring capture_draft classified status...");
  const localDrafts = await localPool.query<BaseRecord>('SELECT * FROM "capture_draft"');
  for (const row of localDrafts.rows) {
    if (row.id && row.status === "classified" && row.classified_measurement_id) {
      await remotePool
        .query(
          `UPDATE "capture_draft" SET status = $1, classified_measurement_id = $2, classified_at = $3 WHERE id = $4`,
          [row.status, row.classified_measurement_id, row.classified_at || new Date(), row.id]
        )
        .catch((err) => {
          const errMsg = err instanceof Error ? err.message : String(err);
          console.error(
            `⚠️ Restoring capture_draft classified status (${String(row.id)}):`,
            errMsg
          );
        });
    }
  }

  await syncTable("source_quantity");
  await syncTable("comparison_explanation");
  await syncTable("transport_route");
  await syncTable("gps_track_point");
  await syncTable("audit_event", (row) => {
    if (typeof row.actor_user_id === "string") {
      const localUserEmail = localUserIdToEmail.get(row.actor_user_id);
      if (localUserEmail) {
        const val = userMap.get(localUserEmail);
        if (val !== undefined) row.actor_user_id = val;
      }
    }
    if (typeof row.actor_id === "string") {
      const localUserEmail = localUserIdToEmail.get(row.actor_id);
      if (localUserEmail) {
        const val = userMap.get(localUserEmail);
        if (val !== undefined) row.actor_id = val;
      }
    }
  });

  console.log(
    "🎉 ĐÃ ĐỒNG BỘ THÀNH CÔNG 100% DỮ LIỆU ĐO LOCAL LÊN SUPABASE VÀ VERCEL!"
  );
}

main()
  .catch((e) => console.error("❌ ERROR:", e))
  .finally(async () => {
    await localPool.end();
    await remotePool.end();
  });
