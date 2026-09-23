/**
 * Import the school's published short-assessment grid (subjects × weeks).
 *
 *   npm run import-plan -- "path/to/short_assessments_weeks_grid.xlsx"
 *   npm run import-plan -- "path/to/file.xlsx" --dry     # parse only
 *
 * The sheet has one header row of week numbers (أ1..أ14), a row of date
 * ranges beneath it, then one row per subject with «/» where an assessment
 * falls. Weeks with no assessment for anyone (midterms, the break, revision)
 * are kept with their note so the calendar stays honest.
 */
import fs from "node:fs";
import { ConvexHttpClient } from "convex/browser";
import * as xlsx from "xlsx";
import { api } from "../convex/_generated/api";

const YEAR_START = 2026;   // the grid runs Aug → Dec of the opening year

type Week = { week: number; label: string; startDate: string; endDate: string; note?: string };
type Row = { subjectName: string; weeks: number[] };

// «30/8-3/9» · «7-10/9» · «22-28/11» — the closing part always carries the month
function parseRange(label: string, year = YEAR_START): { startDate: string; endDate: string } | null {
    const clean = label.replace(/\s/g, "");
    const [rawFrom, rawTo] = clean.split("-");
    if (!rawFrom || !rawTo) return null;

    const to = rawTo.split("/").map(Number);
    if (to.length !== 2 || to.some(isNaN)) return null;
    const [toDay, toMonth] = to;

    const from = rawFrom.split("/").map(Number);
    if (from.some(isNaN)) return null;
    const fromDay = from[0];
    const fromMonth = from.length === 2 ? from[1] : toMonth;

    const iso = (d: number, m: number) =>
        `${year}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    return { startDate: iso(fromDay, fromMonth), endDate: iso(toDay, toMonth) };
}

// Notes live in the legend line, e.g. «الأسابيع 7-8 اختبارات المنتصف، 9 إجازة، 14 مراجعة»
function noteFor(week: number, legend: string): string | undefined {
    const rules: [RegExp, string][] = [
        [/الأسابيع?\s*(\d+)\s*-\s*(\d+)\s*اختبارات المنتصف/, "اختبارات المنتصف"],
        [/(\d+)\s*إجازة/, "إجازة"],
        [/(\d+)\s*مراجعة/, "مراجعة"],
    ];
    for (const [re, label] of rules) {
        const m = legend.match(re);
        if (!m) continue;
        const nums = m.slice(1).map(Number).filter(n => !isNaN(n));
        if (nums.length === 2 && week >= nums[0] && week <= nums[1]) return label;
        if (nums.length === 1 && week === nums[0]) return label;
    }
    return undefined;
}

function parseWorkbook(filePath: string) {
    const wb = xlsx.read(fs.readFileSync(filePath), { type: "buffer" });
    const grid = xlsx.utils.sheet_to_json<any[]>(wb.Sheets[wb.SheetNames[0]], {
        header: 1, raw: false, defval: "",
    });

    const headerIndex = grid.findIndex(r => String(r[1] ?? "").trim() === "أ1");
    if (headerIndex < 0) throw new Error("لم يُعثر على صف الأسابيع (أ1 ...)");

    const header = grid[headerIndex].map((c: any) => String(c ?? "").trim());
    const dateRow = grid[headerIndex + 1].map((c: any) => String(c ?? "").trim());
    const legend = grid.map(r => String(r[0] ?? "")).find(t => t.includes("«/»")) ?? "";

    const weeks: Week[] = [];
    const columns: number[] = [];
    for (let c = 1; c < header.length; c++) {
        const m = header[c].match(/^أ\s*(\d+)$/);
        if (!m) continue;
        const week = Number(m[1]);
        const label = dateRow[c];
        const range = parseRange(label);
        if (!range) throw new Error(`تاريخ الأسبوع ${week} غير مفهوم: "${label}"`);
        weeks.push({ week, label, ...range, note: noteFor(week, legend) });
        columns.push(c);
    }

    const rows: Row[] = [];
    for (let r = headerIndex + 2; r < grid.length; r++) {
        const name = String(grid[r][0] ?? "").replace(/←/g, "").trim();
        if (!name || name.includes("«/»")) continue;
        const marked = columns
            .filter(c => String(grid[r][c] ?? "").trim() !== "")
            .map(c => weeks[columns.indexOf(c)].week);
        if (marked.length === 0) continue;
        rows.push({ subjectName: name, weeks: marked });
    }

    return { weeks, rows };
}

// The grid spells «الإسلامية» while the app stores «الاسلامية»: match on a
// form with the alef seats flattened, and keep the app's own spelling.
const flatten = (s: string) => s.replace(/[أإآ]/g, "ا").replace(/\s+/g, " ").trim();

async function main() {
    const args = process.argv.slice(2);
    const filePath = args.find(a => !a.startsWith("--"));
    const dry = args.includes("--dry");

    if (!filePath) {
        console.error('Usage: npm run import-plan -- "path/to/grid.xlsx" [--dry]');
        process.exit(1);
    }

    const { weeks, rows } = parseWorkbook(filePath);
    console.log(`الأسابيع: ${weeks.length} · المواد: ${rows.length}`);
    for (const w of weeks) console.log(`  أ${w.week}  ${w.label}  ${w.startDate} → ${w.endDate}${w.note ? "  · " + w.note : ""}`);
    for (const r of rows) console.log(`  ${r.subjectName}: ${r.weeks.join(", ")} (${r.weeks.length})`);

    if (dry) return;

    const url = process.env.VITE_CONVEX_URL;
    if (!url) {
        console.error("VITE_CONVEX_URL is not set (check .env.local).");
        process.exit(1);
    }
    const client = new ConvexHttpClient(url);

    const plan: any = await client.query(api.assessmentPlan.getPlan, {});
    const bySpelling = new Map<string, string>(
        (plan?.subjects ?? []).map((s: any) => [flatten(s.name), s.name] as [string, string]));
    const named = rows.map(r => ({
        ...r,
        subjectName: bySpelling.get(flatten(r.subjectName)) ?? r.subjectName,
    }));
    for (const r of named) {
        if (!bySpelling.has(flatten(r.subjectName))) {
            console.warn(`  تنبيه: "${r.subjectName}" غير موجودة في مواد النظام`);
        }
    }

    const result = await client.mutation(api.assessmentPlan.importPlan, { weeks, rows: named });
    console.log("تم:", result);
}

main().catch(err => { console.error(err); process.exit(1); });
