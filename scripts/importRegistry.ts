/**
 * Import a "سجل القيد" registry workbook into the live Convex deployment.
 *
 *   npm run import-registry -- "path/to/سجل_القيد.xlsx"          # add to existing
 *   npm run import-registry -- "path/to/سجل_القيد.xlsx" --replace # new school year
 *
 * Same parsing rules as the in-app import screen (src/pages/ImportStudents.tsx):
 * every sheet is read, the header row is located, and the class is resolved
 * with convex/classHelpers.
 */
import fs from "node:fs";
import { ConvexHttpClient } from "convex/browser";
import * as xlsx from "xlsx";
import { api } from "../convex/_generated/api";
import { resolveClass, UNASSIGNED_LABEL } from "../convex/classHelpers";

const COLUMNS = {
    nationalId: ["الرقم", "الرقم الشخصي", "رقم الطالب", "ID"],
    fullName:   ["الاسم", "اسم الطالب", "Name"],
    grade:      ["الصف", "المرحلة", "Grade"],
    section:    ["الشعبة الصفية", "الشعبة", "Class", "Section"],
    phones:     ["رقم الهاتف", "رقم التليفون", "الهاتف", "Phone"],
};

type Row = {
    fullName: string;
    className: string;
    phones: string;
    nationalId: string;
    sourceGrade: string;
};

// The ministry's export writes a dimension of four rows however many students
// a sheet holds, so a plain read stops after the first one. Rebuild the range
// from the cells that are actually there.
function repairRange(ws: any): void {
    const addresses = Object.keys(ws).filter(k => !k.startsWith("!"));
    if (addresses.length === 0) return;
    const range = { s: { r: Infinity, c: Infinity }, e: { r: -1, c: -1 } };
    for (const a of addresses) {
        const { r, c } = xlsx.utils.decode_cell(a);
        range.s.r = Math.min(range.s.r, r);
        range.s.c = Math.min(range.s.c, c);
        range.e.r = Math.max(range.e.r, r);
        range.e.c = Math.max(range.e.c, c);
    }
    ws["!ref"] = xlsx.utils.encode_range(range as any);
}

// Newer exports name the class in the sheet's own title instead of in columns:
//   «سجل القيد (الشعبة الصفية: 11/4[Technology])»
//   «سجل القيد (الصف: 11)»  ← every student of a grade, no section
function titleClass(title: string): { section: string; source: string } | null {
    const m = title.match(/الشعبة الصفية:\s*([^)]+)\)/);
    if (!m) return null;
    const raw = m[1].trim();                      // "11/4[Technology]" · "10/ESE"
    return { section: raw.replace(/\[.*$/, "").trim(), source: raw };
}

const isGradeSheet = (title: string) => /\(\s*الصف\s*:/.test(title);

function parseWorkbook(filePath: string): Row[] {
    const wb = xlsx.read(fs.readFileSync(filePath), { type: "buffer" });
    const rows: Row[] = [];

    // A workbook that carries per-section sheets also repeats every student in
    // a per-grade sheet; those rows have no section, so they are skipped.
    const titleOf = (name: string) => {
        repairRange(wb.Sheets[name]);
        return String(wb.Sheets[name]?.["A1"]?.v ?? "");
    };
    const hasSectionSheets = wb.SheetNames.some(n => titleClass(titleOf(n)));

    for (const sheetName of wb.SheetNames) {
        const ws = wb.Sheets[sheetName];
        repairRange(ws);
        const title = String(ws?.["A1"]?.v ?? "");
        const fromTitle = titleClass(title);
        if (hasSectionSheets && !fromTitle && isGradeSheet(title)) continue;

        const grid = xlsx.utils.sheet_to_json<any[]>(ws, {
            header: 1, raw: false, defval: "",
        });

        const headerIndex = grid.findIndex(r =>
            r.some(cell => COLUMNS.fullName.includes(String(cell ?? "").trim())));
        if (headerIndex === -1) continue;

        const header = grid[headerIndex].map(c => String(c ?? "").trim());
        const columnOf = (aliases: string[]) => header.findIndex(h => aliases.includes(h));
        const idx = {
            nationalId: columnOf(COLUMNS.nationalId),
            fullName:   columnOf(COLUMNS.fullName),
            grade:      columnOf(COLUMNS.grade),
            section:    columnOf(COLUMNS.section),
            phones:     columnOf(COLUMNS.phones),
        };
        if (idx.fullName === -1) continue;

        const cell = (row: any[], i: number) => (i === -1 ? "" : String(row[i] ?? "").trim());

        for (const row of grid.slice(headerIndex + 1)) {
            const fullName = cell(row, idx.fullName);
            if (!fullName) continue;
            rows.push({
                fullName,
                nationalId:  cell(row, idx.nationalId),
                sourceGrade: cell(row, idx.grade) || fromTitle?.source || "",
                className:   cell(row, idx.section) || fromTitle?.section || "",
                phones:      cell(row, idx.phones),
            });
        }
    }
    return rows;
}

async function main() {
    const filePath = process.argv[2];
    const replace = process.argv.includes("--replace");
    if (!filePath) {
        console.error('Usage: npm run import-registry -- "<file.xlsx>" [--replace]');
        process.exit(1);
    }

    const url = process.env.VITE_CONVEX_URL;
    if (!url) {
        console.error("VITE_CONVEX_URL is not set (check .env.local).");
        process.exit(1);
    }

    const rows = parseWorkbook(filePath);
    console.log(`Parsed ${rows.length} students from ${filePath}`);

    const unassigned = rows.filter(r =>
        resolveClass(r.sourceGrade, r.className)?.className.includes(UNASSIGNED_LABEL)).length;
    console.log(`  · ${unassigned} without a section → "${UNASSIGNED_LABEL}" classes`);

    if (process.argv.includes("--dry")) {
        const perClass: Record<string, number> = {};
        for (const r of rows) {
            const target = resolveClass(r.sourceGrade, r.className);
            const key = target ? `${target.className} [${target.track}]` : "UNRESOLVED";
            perClass[key] = (perClass[key] || 0) + 1;
        }
        Object.entries(perClass)
            .sort((a, b) => a[0].localeCompare(b[0], "ar", { numeric: true }))
            .forEach(([k, v]) => console.log(`  ${k.padEnd(34)} ${v}`));
        console.log(`\nDry run — nothing was written.`);
        return;
    }

    const client = new ConvexHttpClient(url);
    const { schools } = await client.query(api.setup.getInitialData, {});
    const school = schools[0];
    if (!school) throw new Error("No school found in the deployment.");

    if (replace) {
        let removed = 0;
        for (let guard = 0; guard < 500; guard++) {
            const res = await client.mutation(api.students.deleteAllStudentsAndAttendance, {
                schoolId: school._id,
                includeGrades: true,
            });
            removed += res.students;
            process.stdout.write(`\r  deleting… ${removed} students`);
            if (res.done) break;
        }
        console.log(`\r  deleted ${removed} students from the previous roster.`);
    }

    const result = await client.mutation(api.students.importStudentsFromSheet, {
        schoolId: school._id,
        rows,
        deactivateMissingClasses: true,
    });

    console.log("\nImport complete:");
    console.log(`  new students        : ${result.importedCount}`);
    console.log(`  updated in place    : ${result.updatedCount}`);
    console.log(`  skipped             : ${result.skippedCount}`);
    console.log(`  classes in roster   : ${result.totalClasses}`);
    console.log(`  created classes     : ${result.createdClasses.join(", ") || "—"}`);
    console.log(`  retracked classes   : ${result.updatedClasses.join(", ") || "—"}`);
    console.log(`  deactivated classes : ${result.deactivatedClasses.join(", ") || "—"}`);
    console.log(`  without a section   : ${result.unassignedCount}`);
    console.log(`  moved sections      : ${result.movedCount ?? 0}`);
    for (const m of result.movedStudents ?? []) {
        const carried = [
            m.grades ? `${m.grades} درجة` : "",
            m.diagnostics ? `${m.diagnostics} تشخيصي` : "",
            m.followUp ? `${m.followUp} متابعة` : "",
            m.practical ? `${m.practical} عملي` : "",
            m.attendance ? `${m.attendance} حضور` : "",
        ].filter(Boolean).join(" · ") || "لا سجلات";
        console.log(`    ${m.fullName}: ${m.from} → ${m.to} (${carried})`);
    }
}

main().catch(err => { console.error(err); process.exit(1); });
