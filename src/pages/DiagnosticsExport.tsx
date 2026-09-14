import { useState, useMemo } from "react";
import { useQuery } from "convex/react";
// @ts-ignore
import { api } from "../../convex/_generated/api";
import { Download, FileSpreadsheet, Printer, AlertCircle } from "lucide-react";
import { LoadingSpinner, EmptyState } from "../components/ui";
import { downloadWorkbook, safeFileName } from "../lib/excelExport";
import { buildDiagnosticsSheets } from "../lib/diagnosticsExportBuild";

// Writing the marks out to a file is how the school keeps its record: an .xlsx
// to archive and re-open, and a print sheet the teacher signs.


const ALL = "__all__";


export default function DiagnosticsExport({ testId }: { testId: string }) {
    const [className, setClassName] = useState(ALL);
    const [subjectName, setSubjectName] = useState(ALL);

    const data = useQuery(api.diagnostics.getExportData, {
        testId: testId as any,
        ...(className === ALL ? {} : { className }),
        ...(subjectName === ALL ? {} : { subjectName }),
    }) as any;

    const test = useQuery(api.diagnostics.getTest, { testId: testId as any }) as any;

    const recorded = useMemo(() => {
        if (!data) return 0;
        return data.sheets.reduce((a: number, s: any) =>
            a + s.students.filter((x: any) => x.answered > 0 || x.isAbsent).length, 0);
    }, [data]);

    if (!data || !test) return <LoadingSpinner label="جاري تجهيز البيانات"/>;

    const subjects: string[] = data.test.subjectNames ?? [];
    const isCombined = subjects.length > 1;

    const fileStem = [
        data.test.title,
        className === ALL ? "" : className,
        subjectName === ALL ? "" : subjectName,
    ].filter(Boolean).join(" - ");

    // ── Excel ─────────────────────────────────────────────────────────────
    // Styled workbook: a summary across classes, a sheet per class and the
    // question map — the same layout as the quick button on the entry grid.
    const exportExcel = async () => {
        await downloadWorkbook(safeFileName(fileStem), buildDiagnosticsSheets(data));
    };

    // ── CSV (one flat file, easiest to re-import anywhere) ────────────────
    const exportCsv = () => {
        const header = [
            "الشعبة", "الرقم", "اسم الطالب",
            ...data.questions.map((q: any) => `س${q.n}`),
            "المجموع", "النسبة", "الحالة",
        ];
        const rows = data.sheets.flatMap((sheet: any) =>
            sheet.students.map((s: any) => [
                sheet.className, s.nationalId, s.studentName,
                ...s.marks.map((m: number | null) => (m === null ? "" : m)),
                s.total ?? "",
                s.percent === null ? "" : (s.percent * 100).toFixed(1),
                s.isAbsent ? "غائب" : s.answered === 0 ? "لم يُرصد" : "مرصود",
            ]));

        const csv = [header, ...rows]
            .map(r => r.map((c: any) => {
                const v = String(c ?? "");
                return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
            }).join(","))
            .join("\n");

        // BOM so Excel opens the Arabic correctly
        const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${fileStem}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const printUrl = `/diagnostics/print/sheet/${testId}` +
        `?class=${encodeURIComponent(className === ALL ? "" : className)}` +
        `&subject=${encodeURIComponent(subjectName === ALL ? "" : subjectName)}&autoprint=1`;

    return (
        <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">الشعبة</label>
                    <select value={className} onChange={e => setClassName(e.target.value)}
                        className="w-full border-2 border-slate-100 rounded-xl px-3 py-2.5 text-sm font-bold bg-slate-50 focus:outline-none focus:border-qatar-maroon">
                        <option value={ALL}>كل الشعب ({test.classNames.length})</option>
                        {test.classNames.map((c: string) => <option key={c} value={c}>{c}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">المادة</label>
                    <select value={subjectName} onChange={e => setSubjectName(e.target.value)}
                        disabled={!isCombined}
                        className="w-full border-2 border-slate-100 rounded-xl px-3 py-2.5 text-sm font-bold bg-slate-50 focus:outline-none focus:border-qatar-maroon disabled:opacity-60">
                        <option value={ALL}>كل المواد</option>
                        {subjects.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap text-[11px] font-black">
                <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600">
                    {data.sheets.length} شعبة
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600">
                    {data.questions.length} سؤال · من {data.totalMarks}
                </span>
                <span className={`px-2.5 py-1 rounded-lg ${recorded > 0 ? "bg-emerald-50 text-emerald-700" : "bg-amber-100 text-amber-800"}`}>
                    {recorded} طالب مرصود
                </span>
            </div>

            {recorded === 0 ? (
                <EmptyState icon={<AlertCircle className="w-6 h-6"/>} title="لا توجد درجات في هذا النطاق"
                    description="غيّر الشعبة أو المادة، أو ارصد الدرجات أولاً من تبويب «رصد الدرجات»."/>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <button onClick={exportExcel}
                        className="flex flex-col items-center gap-2 p-5 rounded-2xl bg-white border-2 border-emerald-200 hover:border-emerald-400 transition-colors">
                        <FileSpreadsheet className="w-7 h-7 text-emerald-600"/>
                        <span className="font-black text-sm text-slate-700">تنزيل Excel</span>
                        <span className="text-[11px] font-bold text-slate-400 text-center">
                            منسّق: ملخص الشعب + ورقة لكل شعبة + الأسئلة
                        </span>
                    </button>

                    <button onClick={exportCsv}
                        className="flex flex-col items-center gap-2 p-5 rounded-2xl bg-white border-2 border-slate-200 hover:border-slate-400 transition-colors">
                        <Download className="w-7 h-7 text-slate-600"/>
                        <span className="font-black text-sm text-slate-700">تنزيل CSV</span>
                        <span className="text-[11px] font-bold text-slate-400 text-center">
                            ملف واحد مسطّح لكل الشعب
                        </span>
                    </button>

                    <a href={printUrl} target="_blank" rel="noopener noreferrer"
                        className="flex flex-col items-center gap-2 p-5 rounded-2xl bg-white border-2 border-rose-200 hover:border-qatar-maroon transition-colors">
                        <Printer className="w-7 h-7 text-qatar-maroon"/>
                        <span className="font-black text-sm text-slate-700">طباعة / PDF</span>
                        <span className="text-[11px] font-bold text-slate-400 text-center">
                            كشف موقّع — اختر «حفظ بصيغة PDF» من نافذة الطباعة
                        </span>
                    </a>
                </div>
            )}

            <p className="text-[11px] font-bold text-slate-400 leading-relaxed">
                الخانة الفارغة تعني أن السؤال لم يُرصد وليست صفراً؛ والطالب الغائب يظهر بحالة «غائب» بلا درجات.
            </p>
        </div>
    );
}
