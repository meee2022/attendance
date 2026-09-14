import type { ExcelBandSegment, ExcelSheetSpec } from "./excelExport";
import { SIGNATURE_LINES } from "./excelExport";
import { printableSchoolName } from "./brand";
import { GRADE_LABELS } from "./gradesExport";

// Turns diagnostics.getExportData into sheets: a summary across classes, one
// sheet per class with the skill (and subject) bands over the questions, and
// the question map. A blank mark stays blank — "not recorded" is not a zero.

function runs(labels: string[]): ExcelBandSegment[] {
    const out: ExcelBandSegment[] = [];
    for (const label of labels) {
        const last = out[out.length - 1];
        if (last && last.label === label) last.span++;
        else out.push({ label, span: 1 });
    }
    return out;
}

export function buildDiagnosticsSheets(data: any): ExcelSheetSpec[] {
    const subjects: string[] = data.test.subjectNames ?? [];
    const scopedSubject: string | null = data.scope?.subjectName ?? null;
    const combined = subjects.length > 1 && !scopedSubject;
    const school = printableSchoolName(data.schoolName);
    const grade = GRADE_LABELS[data.test.grade] ?? String(data.test.grade);
    const mastery = Math.round(data.test.masteryThreshold * 100);
    const exportedAt = new Date().toLocaleString("ar-EG");
    const subjectLine = scopedSubject
        ? `المادة: ${scopedSubject}`
        : `${subjects.length > 1 ? "المواد" : "المادة"}: ${subjects.join(" + ")}`;

    const questions: any[] = data.questions;
    const lead: ExcelBandSegment = { label: "", span: 3 };
    const tail: ExcelBandSegment = { label: "", span: 4 };

    const bands: ExcelBandSegment[][] = [];
    if (combined) bands.push([lead, ...runs(questions.map(q => q.subjectName)), tail]);
    bands.push([lead, ...runs(questions.map(q => q.skillLabel || "بلا مهارة")), tail]);

    const markStart = 3;
    const pctCol = markStart + questions.length + 1;
    const masteryCol = pctCol + 1;
    const statusCol = masteryCol + 1;

    const classSheets: ExcelSheetSpec[] = data.sheets.map((sheet: any): ExcelSheetSpec => ({
        name: sheet.className,
        title: `كشف رصد الاختبار التشخيصي — ${data.test.title}`,
        meta: [
            `${school} · الصف ${grade} · الشعبة ${sheet.className} (${sheet.track})`,
            `${subjectLine} · الدرجة الكلية ${data.totalMarks} · حد الإتقان ${mastery}%`,
            `تاريخ التصدير: ${exportedAt}`,
        ],
        bands,
        columns: [
            { header: "م", width: 5, align: "center" },
            { header: "الرقم", width: 14, align: "center" },
            { header: "اسم الطالب", width: 32, bold: true },
            ...questions.map(q => ({ header: `س${q.n}\n(${q.maxMark})`, width: 7, align: "center" as const })),
            { header: `المجموع\n(من ${data.totalMarks})`, width: 10, align: "center", bold: true },
            { header: "النسبة", width: 9, align: "center", numFmt: "0%" },
            { header: "الإتقان", width: 10, align: "center" },
            { header: "الحالة", width: 11, align: "center" },
        ],
        freezeColumns: 3,
        orientation: "landscape",
        rows: sheet.students.map((s: any, i: number) => {
            const graded = !s.isAbsent && s.answered > 0;
            return [
                i + 1,
                s.nationalId || null,
                s.studentName,
                ...s.marks.map((m: number | null) => (s.isAbsent ? "—" : m)),
                graded ? s.total : null,
                graded ? s.percent : null,
                graded ? (s.mastered ? "متقن" : "غير متقن") : null,
                s.isAbsent ? "غائب" : s.answered === 0 ? "لم يُرصد" : "مرصود",
            ];
        }),
        tone: (row, col) => {
            const v = row[col];
            if (col === masteryCol) return v === "متقن" ? "good" : v === "غير متقن" ? "bad" : undefined;
            if (col === statusCol) return v === "غائب" ? "warn" : v === "لم يُرصد" ? "muted" : undefined;
            if (col === pctCol && typeof v === "number") return v >= data.test.masteryThreshold ? "good" : "bad";
            return undefined;
        },
        notes: ["الخانة الفارغة تعني أن السؤال لم يُرصد وليست صفراً · «—» للطالب الغائب"],
        signatures: SIGNATURE_LINES,
    }));

    const sheets: ExcelSheetSpec[] = [];

    if (data.sheets.length > 1) {
        let allStudents = 0, allGraded = 0, allAbsent = 0, allMastered = 0, allTotal = 0;

        const rows = data.sheets.map((sheet: any) => {
            const graded = sheet.students.filter((s: any) => !s.isAbsent && s.answered > 0);
            const absent = sheet.students.filter((s: any) => s.isAbsent).length;
            const mastered = graded.filter((s: any) => s.mastered).length;
            const sum = graded.reduce((a: number, s: any) => a + (s.total ?? 0), 0);

            allStudents += sheet.students.length;
            allGraded += graded.length;
            allAbsent += absent;
            allMastered += mastered;
            allTotal += sum;

            const avg = graded.length ? sum / graded.length : null;
            return [
                sheet.className,
                sheet.students.length,
                graded.length,
                absent || null,
                avg === null ? null : Math.round(avg * 10) / 10,
                avg === null || !data.totalMarks ? null : avg / data.totalMarks,
                graded.length ? mastered : null,
                graded.length ? mastered / graded.length : null,
            ];
        });

        const avgAll = allGraded ? allTotal / allGraded : null;
        rows.push([
            "الإجمالي",
            allStudents,
            allGraded,
            allAbsent || null,
            avgAll === null ? null : Math.round(avgAll * 10) / 10,
            avgAll === null || !data.totalMarks ? null : avgAll / data.totalMarks,
            allGraded ? allMastered : null,
            allGraded ? allMastered / allGraded : null,
        ]);

        sheets.push({
            name: "ملخص الشعب",
            title: `ملخص نتائج الاختبار التشخيصي — ${data.test.title}`,
            meta: [
                `${school} · الصف ${grade}`,
                `${subjectLine} · الدرجة الكلية ${data.totalMarks} · حد الإتقان ${mastery}%`,
                `تاريخ التصدير: ${exportedAt}`,
            ],
            columns: [
                { header: "الشعبة", width: 12, align: "center", bold: true },
                { header: "عدد الطلاب", width: 11, align: "center" },
                { header: "المرصودون", width: 11, align: "center" },
                { header: "الغياب", width: 9, align: "center" },
                { header: "متوسط الدرجة", width: 12, align: "center" },
                { header: "النسبة", width: 10, align: "center", numFmt: "0%" },
                { header: "المتقنون", width: 10, align: "center" },
                { header: "نسبة الإتقان", width: 12, align: "center", numFmt: "0%" },
            ],
            orientation: "portrait",
            rows,
            tone: (row, col) => {
                if (row[0] === "الإجمالي") return "muted";
                const v = row[col];
                if ((col === 5 || col === 7) && typeof v === "number") return v >= data.test.masteryThreshold ? "good" : "bad";
                return undefined;
            },
            signatures: SIGNATURE_LINES,
        });
    }

    sheets.push(...classSheets);

    sheets.push({
        name: "الأسئلة والمهارات",
        title: `خريطة أسئلة الاختبار — ${data.test.title}`,
        meta: [`${subjectLine} · الدرجة الكلية ${data.totalMarks}`],
        columns: [
            { header: "السؤال", width: 9, align: "center", bold: true },
            { header: "المادة", width: 20, align: "center" },
            { header: "المهارة", width: 34 },
            { header: "الدرجة", width: 10, align: "center" },
        ],
        orientation: "portrait",
        rows: questions.map(q => [q.n, q.subjectName, q.skillLabel || "—", q.maxMark]),
    });

    return sheets;
}
