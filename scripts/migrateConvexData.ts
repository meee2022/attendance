/**
 * Convex Data Migration Script
 * OLD deployment  →  NEW deployment
 *
 * Required env vars:
 *   OLD_CONVEX_URL        e.g. https://wonderful-ibis-323.convex.cloud
 *   OLD_CONVEX_ADMIN_KEY  Convex admin key for the OLD deployment
 *   NEW_CONVEX_URL        https://hidden-badger-532.convex.cloud
 *   NEW_CONVEX_ADMIN_KEY  Convex admin key for the NEW deployment
 *
 * Run once:
 *   npx tsx scripts/migrateConvexData.ts
 */

import { ConvexHttpClient } from "convex/browser";

// ─── helpers ────────────────────────────────────────────────────────────────

function env(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`Missing env var: ${key}`);
  return v;
}

/** Fetch ALL documents from a table via the admin listDocuments REST endpoint */
async function fetchAll(baseUrl: string, adminKey: string, table: string): Promise<any[]> {
  const url = `${baseUrl}/api/json_query`;
  // Use Convex HTTP API to run a full table scan
  const body = {
    path: "_system/listDocuments",
    args: { table, numItems: 10000, cursor: null },
    format: "json",
  };

  // Convex doesn't expose a public listDocuments — we use the admin REST API instead
  const restUrl = `${baseUrl}/api/query`;
  const res = await fetch(restUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Convex ${adminKey}`,
    },
    body: JSON.stringify({
      path: "migrations:listTable",
      args: { table },
      format: "json",
    }),
  });

  if (!res.ok) {
    // Fall back to export endpoint
    return fetchViaExport(baseUrl, adminKey, table);
  }
  const json = await res.json();
  return json.value ?? [];
}

/** Fetch all documents via the Convex data export REST endpoint */
async function fetchViaExport(baseUrl: string, adminKey: string, table: string): Promise<any[]> {
  // Use the Convex admin export endpoint: GET /api/export/tables/{table}
  const url = `${baseUrl}/api/export/tables/${table}`;
  const res = await fetch(url, {
    headers: { Authorization: `Convex ${adminKey}` },
  });

  if (!res.ok) {
    const txt = await res.text();
    console.error(`  ✗ Export failed for ${table}: ${res.status} ${txt.slice(0, 200)}`);
    return [];
  }

  const text = await res.text();
  // Convex exports as newline-delimited JSON
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

/** Insert a document into the NEW deployment using the admin REST API */
async function insertDoc(
  baseUrl: string,
  adminKey: string,
  table: string,
  doc: Record<string, any>
): Promise<string> {
  const url = `${baseUrl}/api/mutation`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Convex ${adminKey}`,
    },
    body: JSON.stringify({
      path: "migrations:insertDocument",
      args: { table, document: doc },
      format: "json",
    }),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Insert failed for ${table}: ${res.status} ${txt.slice(0, 300)}`);
  }

  const json = await res.json();
  return json.value as string; // returns new _id
}

// ─── Migration Convex functions (we need to deploy these first) ──────────────
// We'll use the HTTP admin API directly — no need for extra Convex functions.

// ─── main ────────────────────────────────────────────────────────────────────

async function migrate() {
  const OLD_URL = env("OLD_CONVEX_URL");
  const OLD_KEY = env("OLD_CONVEX_ADMIN_KEY");
  const NEW_URL = env("NEW_CONVEX_URL");
  const NEW_KEY = env("NEW_CONVEX_ADMIN_KEY");

  console.log("🚀 Starting migration...");
  console.log(`   OLD: ${OLD_URL}`);
  console.log(`   NEW: ${NEW_URL}\n`);

  const counts: Record<string, number> = {};

  // ── ID Maps ──────────────────────────────────────────────────────────────
  const schoolIdMap   = new Map<string, string>();
  const classIdMap    = new Map<string, string>();
  const studentIdMap  = new Map<string, string>();
  const subjectIdMap  = new Map<string, string>();
  const teacherIdMap  = new Map<string, string>();
  const periodIdMap   = new Map<string, string>();

  // ── 1. schools ────────────────────────────────────────────────────────────
  console.log("📦 Migrating schools...");
  const schools = await fetchViaExport(OLD_URL, OLD_KEY, "schools");
  for (const doc of schools) {
    const oldId = doc._id;
    const { _id, _creationTime, ...data } = doc;
    const newId = await insertDoc(NEW_URL, NEW_KEY, "schools", data);
    schoolIdMap.set(oldId, newId);
  }
  counts.schools = schools.length;
  console.log(`   ✓ schools: ${schools.length}`);

  // ── 2. classes ────────────────────────────────────────────────────────────
  console.log("📦 Migrating classes...");
  const classes = await fetchViaExport(OLD_URL, OLD_KEY, "classes");
  for (const doc of classes) {
    const oldId = doc._id;
    const { _id, _creationTime, ...data } = doc;
    data.schoolId = schoolIdMap.get(data.schoolId) ?? data.schoolId;
    const newId = await insertDoc(NEW_URL, NEW_KEY, "classes", data);
    classIdMap.set(oldId, newId);
  }
  counts.classes = classes.length;
  console.log(`   ✓ classes: ${classes.length}`);

  // ── 3. subjects ───────────────────────────────────────────────────────────
  console.log("📦 Migrating subjects...");
  const subjects = await fetchViaExport(OLD_URL, OLD_KEY, "subjects");
  for (const doc of subjects) {
    const oldId = doc._id;
    const { _id, _creationTime, ...data } = doc;
    data.schoolId = schoolIdMap.get(data.schoolId) ?? data.schoolId;
    const newId = await insertDoc(NEW_URL, NEW_KEY, "subjects", data);
    subjectIdMap.set(oldId, newId);
  }
  counts.subjects = subjects.length;
  console.log(`   ✓ subjects: ${subjects.length}`);

  // ── 4. teachers ───────────────────────────────────────────────────────────
  console.log("📦 Migrating teachers...");
  const teachers = await fetchViaExport(OLD_URL, OLD_KEY, "teachers");
  for (const doc of teachers) {
    const oldId = doc._id;
    const { _id, _creationTime, ...data } = doc;
    data.schoolId = schoolIdMap.get(data.schoolId) ?? data.schoolId;
    const newId = await insertDoc(NEW_URL, NEW_KEY, "teachers", data);
    teacherIdMap.set(oldId, newId);
  }
  counts.teachers = teachers.length;
  console.log(`   ✓ teachers: ${teachers.length}`);

  // ── 5. students ───────────────────────────────────────────────────────────
  console.log("📦 Migrating students...");
  const students = await fetchViaExport(OLD_URL, OLD_KEY, "students");
  for (const doc of students) {
    const oldId = doc._id;
    const { _id, _creationTime, ...data } = doc;
    data.schoolId = schoolIdMap.get(data.schoolId) ?? data.schoolId;
    data.classId  = classIdMap.get(data.classId)   ?? data.classId;
    const newId = await insertDoc(NEW_URL, NEW_KEY, "students", data);
    studentIdMap.set(oldId, newId);
  }
  counts.students = students.length;
  console.log(`   ✓ students: ${students.length}`);

  // ── 6. periods ────────────────────────────────────────────────────────────
  console.log("📦 Migrating periods...");
  const periods = await fetchViaExport(OLD_URL, OLD_KEY, "periods");
  for (const doc of periods) {
    const oldId = doc._id;
    const { _id, _creationTime, ...data } = doc;
    data.schoolId  = schoolIdMap.get(data.schoolId)   ?? data.schoolId;
    data.classId   = classIdMap.get(data.classId)     ?? data.classId;
    data.subjectId = subjectIdMap.get(data.subjectId) ?? data.subjectId;
    if (data.teacherId) {
      data.teacherId = teacherIdMap.get(data.teacherId) ?? data.teacherId;
    }
    const newId = await insertDoc(NEW_URL, NEW_KEY, "periods", data);
    periodIdMap.set(oldId, newId);
  }
  counts.periods = periods.length;
  console.log(`   ✓ periods: ${periods.length}`);

  // ── 7. attendance ─────────────────────────────────────────────────────────
  console.log("📦 Migrating attendance...");
  const attendance = await fetchViaExport(OLD_URL, OLD_KEY, "attendance");
  let attCount = 0;
  for (const doc of attendance) {
    const { _id, _creationTime, ...data } = doc;
    data.schoolId = schoolIdMap.get(data.schoolId) ?? data.schoolId;
    data.classId  = classIdMap.get(data.classId)   ?? data.classId;
    data.periodId = periodIdMap.get(data.periodId) ?? data.periodId;
    if (data.studentId) {
      data.studentId = studentIdMap.get(data.studentId) ?? data.studentId;
    }
    await insertDoc(NEW_URL, NEW_KEY, "attendance", data);
    attCount++;
    if (attCount % 500 === 0) process.stdout.write(`   ... ${attCount} records\r`);
  }
  counts.attendance = attCount;
  console.log(`   ✓ attendance: ${attCount}            `);

  // ── 8. messageTemplates ───────────────────────────────────────────────────
  console.log("📦 Migrating messageTemplates...");
  const templates = await fetchViaExport(OLD_URL, OLD_KEY, "messageTemplates");
  for (const doc of templates) {
    const { _id, _creationTime, ...data } = doc;
    data.schoolId = schoolIdMap.get(data.schoolId) ?? data.schoolId;
    await insertDoc(NEW_URL, NEW_KEY, "messageTemplates", data);
  }
  counts.messageTemplates = templates.length;
  console.log(`   ✓ messageTemplates: ${templates.length}`);

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log("\n✅ Migration complete!\n");
  console.log("Migrated:");
  for (const [table, count] of Object.entries(counts)) {
    console.log(`  - ${table}: ${count}`);
  }
  console.log("\n⚠️  Remember to deploy Convex functions to the new deployment:");
  console.log(`   npx convex deploy --url ${NEW_URL}`);
}

migrate().catch((err) => {
  console.error("\n❌ Migration failed:", err.message);
  process.exit(1);
});
