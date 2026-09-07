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

function parseWorkbook(filePath: string): Row[] {
    const wb = xlsx.read(fs.readFileSync(filePath), { type: "buffer" });
    const rows: Row[] = [];

    for (const sheetName of wb.SheetNames) {
        const grid = xlsx.utils.sheet_to_json<any[]>(wb.Sheets[sheetName], {
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
                sourceGrade: cell(row, idx.grade),
                className:   cell(row, idx.section),
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
}

main().catch(err => { console.error(err); process.exit(1); });
