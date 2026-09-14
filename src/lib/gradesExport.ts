import type { ExcelCell, ExcelSheetSpec, ExcelTone } from "./excelExport";
import { SIGNATURE_LINES } from "./excelExport";
import { printableSchoolName } from "./brand";

// Turns grades.getClassExport into sheets. The arithmetic mirrors the entry
// grid exactly, so the archived file says what the teacher saw on screen.

export const GRADE_LABELS: Record<number, string> = { 10: "العاشر", 11: "الحادي عشر", 12: "الثاني عشر" };

const SLOTS = ["a1", "a2", "a3", "a4", "a5"] as const;

export type GradeSettings = {
    maxPerAssessment: number;
    finalScoreOutOf: number;
    passThreshold: number;
    excellenceThreshold: number;
    assessmentLabels: string[];
};

export function assessmentLabelsOf(settings: GradeSettings): string[] {
    return SLOTS.map((_, i) => settings.assessmentLabels?.[i]?.trim() || `تقييم ${i + 1}`);
}

export function formatMark(v: unknown): ExcelCell {
    if (v === "absent") return "غ";
    if (v === "excused") return "م";
    return typeof v === "number" ? v : null;
}

export function summaryOf(row: Record<string, unknown>, settings: GradeSettings) {
    const values = SLOTS.map(k => row[k]);
    let sum = 0;
    for (const v of values) if (typeof v === "number") sum += v;
    const hasAny = values.some(v => v !== null && v !== undefined && v !== "");
    const totalMax = SLOTS.length * settings.maxPerAssessment;
    const finalScore = totalMax > 0 ? (sum / totalMax) * settings.finalScoreOutOf : 0;
    return { sum, hasAny, finalScore: Math.round(finalScore * 100) / 100 };
}

export function statusOf(
    summary: { hasAny: boolean; finalScore: number },
    settings: GradeSettings,
): { label: string; tone?: ExcelTone } {
    if (!summary.hasAny) return { label: "لم يُرصد", tone: "muted" };
    if (summary.finalScore >= settings.excellenceThreshold) return { label: "متميز", tone: "good" };
    if (summary.finalScore >= settings.passThreshold) return { label: "ناجح" };
    return { label: "دون حد النجاح", tone: "bad" };
}

// One row per student across every exported subject: the final score in each.
export function classSummary(data: any) {
    const settings: GradeSettings = data.settings;
    const subjects: string[] = data.sheets.map((s: any) => s.subjectName);
    const byName = new Map<string, { studentName: string; nationalId: string; finals: (number | null)[] }>();

    data.sheets.forEach((sheet: any, si: number) => {
        for (const st of sheet.students) {
            const key = String(st.studentName).trim();
            const entry = byName.get(key) ?? {
                studentName: st.studentName,
                nationalId: st.nationalId ?? "",
                finals: subjects.map(() => null),
            };
            const sm = summaryOf(st, settings);
            entry.finals[si] = sm.hasAny ? sm.finalScore : null;
            if (!entry.nationalId && st.nationalId) entry.nationalId = st.nationalId;
            byName.set(key, entry);
        }
    });

    return {
        subjects,
        rows: [...byName.values()].map(e => {
            const graded = e.finals.filter((f): f is number => f !== null);
            return {
                ...e,
                average: graded.length
                    ? Math.round((graded.reduce((a, b) => a + b, 0) / graded.length) * 100) / 100
                    : null,
                belowPass: graded.filter(f => f < settings.passThreshold).length,
            };
        }),
    };
}

export function buildGradesSheets(data: any): ExcelSheetSpec[] {
    const settings: GradeSettings = data.settings;
    const labels = assessmentLabelsOf(settings);
    const school = printableSchoolName(data.schoolName);
    const grade = GRADE_LABELS[data.grade] ?? String(data.grade);
    const exportedAt = new Date().toLocaleString("ar-EG");
    const classLine = `${school} · الصف ${grade} · الشعبة ${data.className} (${data.track})`;
    const totalMax = SLOTS.length * settings.maxPerAssessment;

    const firstMark = 3;
    const lastMark = firstMark + SLOTS.length - 1;
    const finalCol = lastMark + 2;
    const statusCol = finalCol + 1;

    const sheets: ExcelSheetSpec[] = data.sheets.map((sheet: any): ExcelSheetSpec => ({
        name: sheet.subjectName,
        title: `كشف التقييمات القصيرة — ${sheet.subjectName}`,
        meta: [
            classLine,
            `الدرجة القصوى لكل تقييم ${settings.maxPerAssessment} · النهائية من ${settings.finalScoreOutOf} · حد النجاح ${settings.passThreshold} · حد التميز ${settings.excellenceThreshold}`,
            `تاريخ التصدير: ${exportedAt}`,
        ],
        columns: [
            { header: "م", width: 5, align: "center" },
            { header: "الرقم", width: 14, align: "center" },
            { header: "اسم الطالب", width: 32, bold: true },
            ...labels.map(l => ({ header: `${l}\n(من ${settings.maxPerAssessment})`, width: 11, align: "center" as const })),
            { header: `المجموع\n(من ${totalMax})`, width: 11, align: "center", bold: true },
            { header: `الدرجة النهائية\n(من ${settings.finalScoreOutOf})`, width: 13, align: "center", bold: true, numFmt: "0.00" },
            { header: "الحالة", width: 14, align: "center" },
        ],
        freezeColumns: 3,
        orientation: "landscape",
        rows: sheet.students.map((st: any, i: number) => {
            const sm = summaryOf(st, settings);
            return [
                i + 1,
                st.nationalId || null,
                st.studentName,
                ...SLOTS.map(k => formatMark(st[k])),
                sm.hasAny ? sm.sum : null,
                sm.hasAny ? sm.finalScore : null,
                statusOf(sm, settings).label,
            ];
        }),
        tone: (row, col) => {
            const v = row[col];
            if (col >= firstMark && col <= lastMark) return v === "غ" ? "warn" : v === "م" ? "muted" : undefined;
            if (col === finalCol && typeof v === "number") {
                return v < settings.passThreshold ? "bad" : v >= settings.excellenceThreshold ? "good" : undefined;
            }
            if (col === statusCol) {
                return v === "متميز" ? "good" : v === "دون حد النجاح" ? "bad" : v === "لم يُرصد" ? "muted" : undefined;
            }
            return undefined;
        },
        notes: [
            "غ = غائب · م = معذور · الخانة الفارغة = لم يُرصد بعد",
            `الدرجة النهائية = مجموع الدرجات ÷ ${totalMax} × ${settings.finalScoreOutOf}`,
        ],
        signatures: SIGNATURE_LINES,
    }));

    if (data.sheets.length > 1) {
        const summary = classSummary(data);
        const firstSubject = 3;
        const averageCol = firstSubject + summary.subjects.length;
        const belowCol = averageCol + 1;

        sheets.unshift({
            name: "ملخص الشعبة",
            title: `ملخص التقييمات القصيرة — الشعبة ${data.className}`,
            meta: [
                classLine,
                `الدرجة النهائية لكل مادة من ${settings.finalScoreOutOf} · حد النجاح ${settings.passThreshold} · حد التميز ${settings.excellenceThreshold}`,
                `تاريخ التصدير: ${exportedAt}`,
            ],
            columns: [
                { header: "م", width: 5, align: "center" },
                { header: "الرقم", width: 14, align: "center" },
                { header: "اسم الطالب", width: 32, bold: true },
                ...summary.subjects.map(s => ({ header: s, width: 12, align: "center" as const, numFmt: "0.00" })),
                { header: "المتوسط", width: 11, align: "center", bold: true, numFmt: "0.00" },
                { header: "مواد دون الحد", width: 12, align: "center" },
            ],
            freezeColumns: 3,
            orientation: "landscape",
            rows: summary.rows.map((row, i) => [
                i + 1, row.nationalId || null, row.studentName,
                ...row.finals, row.average, row.belowPass || null,
            ]),
            tone: (row, col) => {
                const v = row[col];
                if (col >= firstSubject && col <= averageCol && typeof v === "number") {
                    return v < settings.passThreshold ? "bad" : v >= settings.excellenceThreshold ? "good" : undefined;
                }
                if (col === belowCol && typeof v === "number" && v > 0) return "bad";
                return undefined;
            },
            notes: ["الخانة الفارغة = لم تُرصد أي درجة للطالب في هذه المادة"],
            signatures: SIGNATURE_LINES,
        });
    }

    return sheets;
}
