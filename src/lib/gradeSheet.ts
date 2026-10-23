// «كشف درجات الشعبة» exported from the ministry system: a title row, the
// period, then for every subject two columns — «التقييم الرئيسي» (out of 30)
// and «منتصف الفصل الأول» (its half, out of 15) — and a row per student with
// the national number, name and section. A mark is a number, «غائب»
// (absent from the exam) or «محروم» (barred), or empty when the student does
// not take the subject or it is not entered yet.
//
// The analysis reads the first component (the main mark); the second is kept
// for the student's record and the exported sheets.

export type Mark = number | "غائب" | "محروم" | null;
export type GradeSheet = {
    title: string;
    period: string;
    fileName: string;
    grade: number;
    components: string[];          // e.g. ["التقييم الرئيسي", "منتصف الفصل الاول"]
    maxes: number[];               // what each component is out of
    subjects: string[];
    // [national number, name, section, ...for each subject the marks of each component]
    students: { id: string; name: string; cls: string; marks: Mark[][] }[];
};

const clean = (v: unknown) => String(v ?? "").replace(/[‏‎ ]/g, " ").replace(/\s+/g, " ").trim();
const digits = (s: string) => s.replace(/[٠-٩]/g, d => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));

export function markOf(v: unknown): Mark {
    if (typeof v === "number") return Number.isFinite(v) ? v : null;
    const t = digits(clean(v));
    if (!t) return null;
    if (/^غا?ئب$|^غياب$/.test(t)) return "غائب";
    if (/^محروم/.test(t)) return "محروم";
    const n = Number(t.replace(/[٫,]/g, "."));
    return Number.isFinite(n) ? n : null;
}

// A component's scale: what most subjects reach at most (30, 15…); a stray
// mark above it is a data error, not a new scale
function scaleOf(highs: number[]) {
    const counts = new Map<number, number>();
    for (const h of highs) {
        const s = [5, 10, 15, 20, 25, 30, 40, 50, 60, 70, 80, 100].find(x => x >= h) ?? Math.ceil(h);
        counts.set(s, (counts.get(s) ?? 0) + 1);
    }
    return [...counts].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]?.[0] ?? 0;
}

export function readGradeSheet(table: unknown[][], fileName: string): GradeSheet {
    const rows = table.map(r => (r ?? []).map(c => c));
    const h = rows.findIndex(r => r.some(c => clean(c) === "الاسم"));
    if (h < 1) throw new Error("لم نجد صف العناوين («الرقم» و«الاسم») — ارفع كشف درجات الشعبة كما يُصدَّر من النظام.");
    const head = rows[h].map(clean), above = rows[h - 1].map(clean);
    const idCol = head.indexOf("الرقم"), nameCol = head.indexOf("الاسم");
    const body = rows.slice(h + 1).filter(r => clean(r[nameCol]));
    let clsCol = above.findIndex(x => x.includes("الشعبة"));
    if (clsCol < 0) clsCol = head.findIndex((_, i) => body.slice(0, 20).every(r => /^\d{1,2}\s*\/\s*\S+$/.test(clean(r[i]))));
    if (nameCol < 0 || clsCol < 0) throw new Error("لم نجد عمود الشعبة في الملف.");
    // a subject's name sits over its first column; its components follow until the next name
    const start = Math.max(idCol, nameCol, clsCol) + 1;
    const groups: { name: string; cols: number[] }[] = [];
    for (let c = start; c < Math.max(head.length, above.length); c++) {
        if (head[c]) groups.push({ name: head[c], cols: [c] });
        else if (groups.length && above[c]) groups.at(-1)!.cols.push(c);
    }
    if (!groups.length || !body.length) throw new Error("الملف لا يحتوي مواد ودرجات طلاب.");
    const width = Math.max(...groups.map(g => g.cols.length));
    const components = Array.from({ length: width }, (_, k) => above[groups.find(g => g.cols[k] !== undefined)!.cols[k]] || `الدرجة ${k + 1}`);
    const students = body.map(r => ({
        id: clean(r[idCol]),
        name: clean(r[nameCol]),
        cls: clean(r[clsCol]).replace(/\s+/g, ""),
        marks: groups.map(g => Array.from({ length: width }, (_, k) => g.cols[k] === undefined ? null : markOf(r[g.cols[k]]))),
    }));
    const maxes = components.map((_, k) => scaleOf(groups.map((_, s) =>
        Math.max(0, ...students.map(st => st.marks[s][k]).filter((m): m is number => typeof m === "number"))).filter(x => x > 0)));
    const grades = students.map(s => Number(s.cls.split("/")[0])).filter(n => n >= 1 && n <= 12);
    const titleRow = clean(rows[0]?.find(c => clean(c)));
    const periodRow = rows.slice(0, h).map(r => r.map(clean).join(" ")).find(t => t.includes("الفترة")) ?? "";
    return {
        title: titleRow || clean(fileName).replace(/\.(xlsx|xls|csv)$/i, ""),
        period: periodRow.replace(/.*الفترة\s*:?\s*/, "").trim(),
        fileName: clean(fileName),
        grade: grades.length ? Math.round(grades.reduce((a, b) => a + b, 0) / grades.length) : 0,
        components, maxes,
        subjects: groups.map(g => g.name),
        students,
    };
}

// ── Analysis ─────────────────────────────────────────────────────────────
// «pass» is the pass mark of the main component (half the scale unless set);
// a mark within a tenth of the scale above it is «على الحافة»
export type Options = { pass: number; track: string; cls: string };
export const BANDS = [
    { label: "ممتاز", min: 0.9 }, { label: "جيد جداً", min: 0.8 }, { label: "جيد", min: 0.7 },
    { label: "مقبول", min: 0.5 }, { label: "دون 50%", min: 0 },
] as const;
export type Status = "barred" | "fail" | "edge" | "pass" | "excellent" | "none";
export const STATUS_LABELS: Record<Status, string> = {
    barred: "محروم", fail: "راسب", edge: "على حافة النجاح", pass: "ناجح", excellent: "متفوق", none: "بلا درجات",
};
const num = (m: Mark): m is number => typeof m === "number";
const mean = (xs: number[]) => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
// a subject counts for a section when most of its students have an entry
const takes = (sheet: GradeSheet, s: number, ids: number[]) => ids.filter(i => sheet.students[i].marks[s][0] !== null).length;

// The track of a section from the subjects its students take
export function trackOf(sheet: GradeSheet, cls: string): string {
    const ids = sheet.students.flatMap((st, i) => st.cls === cls ? [i] : []);
    const has = (name: string) => sheet.subjects.some((x, s) => x.includes(name) && takes(sheet, s, ids) >= ids.length / 2);
    if (sheet.grade < 11) return "عام";
    if (has("علوم الحاسب") || has("تكنولوجيا المعلومات") && !has("الحوسبة")) return "تكنولوجي";
    if (has("التاريخ") || has("الجغرافيا") || has("العلوم العامة")) return "أدبي";
    if (has("الفيزياء") || has("الكيمياء") || has("الأحياء")) return "علمي";
    return "عام";
}

export function sectionsOf(sheet: GradeSheet) {
    return [...new Set(sheet.students.map(s => s.cls))]
        .sort((a, b) => a.localeCompare(b, "ar", { numeric: true }))
        .map(cls => ({ cls, track: trackOf(sheet, cls), count: sheet.students.filter(s => s.cls === cls).length }));
}

export function analyzeGrades(sheet: GradeSheet, o: Options) {
    const max = sheet.maxes[0] || 30;
    const edgeTop = o.pass + max / 10;
    const sections = sectionsOf(sheet);
    const trackOfCls = new Map(sections.map(s => [s.cls, s.track]));
    const keep = sheet.students.flatMap((st, i) => (!o.track || trackOfCls.get(st.cls) === o.track) && (!o.cls || st.cls === o.cls) ? [i] : []);
    const shownSections = sections.filter(s => (!o.track || s.track === o.track) && (!o.cls || s.cls === o.cls));

    // ── every student: their marks, what they failed, where they stand ──
    const students = keep.map(i => {
        const st = sheet.students[i];
        const marks = sheet.subjects.map((name, s) => ({ name, s, mark: st.marks[s][0] })).filter(x => x.mark !== null);
        const nums = marks.map(x => x.mark).filter(num);
        const failed = marks.filter(x => num(x.mark) && x.mark < o.pass);
        const edge = marks.filter(x => num(x.mark) && x.mark >= o.pass && x.mark < edgeTop);
        const barred = marks.filter(x => x.mark === "محروم");
        const absent = marks.filter(x => x.mark === "غائب");
        const percent = nums.length ? nums.reduce((a, b) => a + b, 0) / (nums.length * max) : null;
        const status: Status = !marks.length ? "none" : barred.length ? "barred" : failed.length ? "fail"
            : edge.length ? "edge" : percent !== null && percent >= 0.9 ? "excellent" : "pass";
        return { ...st, index: i, track: trackOfCls.get(st.cls) ?? "", entered: marks.length, percent, failed, edge, barred, absent, status };
    });

    // ── every subject, with its sections ──
    const subjects = sheet.subjects.map((name, s) => {
        const marks = keep.map(i => sheet.students[i].marks[s][0]).filter(m => m !== null);
        const nums = marks.filter(num);
        const fail = nums.filter(m => m < o.pass).length;
        return {
            name, s,
            entered: marks.length, count: nums.length,
            absent: marks.filter(m => m === "غائب").length, barred: marks.filter(m => m === "محروم").length,
            mean: mean(nums), high: nums.length ? Math.max(...nums) : null, low: nums.length ? Math.min(...nums) : null,
            fail, edge: nums.filter(m => m >= o.pass && m < edgeTop).length,
            passRate: nums.length ? (nums.length - fail) / nums.length : null,
            bands: BANDS.map((b, k) => nums.filter(m => m / max >= b.min && (k === 0 || m / max < BANDS[k - 1].min)).length),
            bySection: shownSections.map(sec => {
                const n = keep.filter(i => sheet.students[i].cls === sec.cls).map(i => sheet.students[i].marks[s][0]).filter(num);
                const f = n.filter(m => m < o.pass).length;
                return { cls: sec.cls, track: sec.track, count: n.length, mean: mean(n), fail: f, passRate: n.length ? (n.length - f) / n.length : null };
            }).filter(x => x.count),
            // a subject entered for only a few of its section's students is not marked yet
            partial: shownSections.filter(sec => {
                const ids = keep.filter(i => sheet.students[i].cls === sec.cls);
                const n = takes(sheet, s, ids);
                return n > 0 && n < ids.length / 2;
            }).map(sec => sec.cls),
        };
    }).filter(x => x.entered > 0);

    // ── every section ──
    const bySection = shownSections.map(sec => {
        const ids = keep.filter(i => sheet.students[i].cls === sec.cls);
        const means = subjects.map(sub => {
            const nums = ids.map(i => sheet.students[i].marks[sub.s][0]).filter(num);
            return nums.length >= Math.max(3, ids.length / 2) ? mean(nums) : null;
        });
        const mine = students.filter(st => st.cls === sec.cls);
        const rated = mine.filter(st => st.status !== "none");
        const all = ids.flatMap(i => sheet.students[i].marks.map(m => m[0]).filter(num));
        return {
            ...sec, means, mean: mean(all),
            failing: mine.filter(st => st.failed.length).length,
            barred: mine.filter(st => st.barred.length).length,
            passRate: rated.length ? rated.filter(st => st.status === "pass" || st.status === "edge" || st.status === "excellent").length / rated.length : null,
        };
    });

    const all = keep.flatMap(i => sheet.students[i].marks.map(m => m[0]).filter(num));
    const rated = students.filter(s => s.status !== "none");
    const count = (st: Status) => students.filter(s => s.status === st).length;
    return {
        max, pass: o.pass, edgeTop,
        sections: bySection,
        subjects,
        students,
        mean: mean(all),
        summary: {
            students: students.length, rated: rated.length,
            passAll: count("pass") + count("edge") + count("excellent"),
            failAny: students.filter(s => s.failed.length).length,
            failTwo: students.filter(s => s.failed.length >= 2).length,
            edge: count("edge"), excellent: count("excellent"),
            barred: students.filter(s => s.barred.length).length,
            absent: students.filter(s => s.absent.length).length,
            none: count("none"),
        },
    };
}

// Marks that cannot be right: above the scale, or a second component that is
// not the half of the first as the system computes it
export function checkSheet(sheet: GradeSheet) {
    const out: string[] = [];
    sheet.students.forEach(st => sheet.subjects.forEach((name, s) => st.marks[s].forEach((m, k) => {
        if (num(m) && sheet.maxes[k] && m > sheet.maxes[k]) out.push(`${st.name} (${st.cls}) — ${name}: «${sheet.components[k]}» ${m} من ${sheet.maxes[k]}`);
    })));
    return out;
}
