import { useState } from "react";
import { useConvex } from "convex/react";
import { Download, FileSpreadsheet, FileText } from "lucide-react";
// @ts-ignore
import { api } from "../../convex/_generated/api";
import { downloadWorkbook, safeFileName } from "../lib/excelExport";
import { buildGradesSheets } from "../lib/gradesExport";
import { buildDiagnosticsSheets } from "../lib/diagnosticsExportBuild";

// "Save a copy" buttons that sit on the entry screens themselves, so keeping a
// record is one click right after recording instead of a trip to another tab.

// A cell saves when it loses focus, and pressing an export button is what takes
// the focus away from the last one — give that save a moment to land first.
const settle = () => new Promise(resolve => setTimeout(resolve, 600));

const excelBtn = "flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black text-emerald-700 bg-white border border-emerald-200 hover:bg-emerald-50 disabled:opacity-50 disabled:pointer-events-none";
const pdfBtn = "flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black text-qatar-maroon bg-white border border-rose-200 hover:bg-rose-50";

function useExcelExport() {
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const run = async (task: () => Promise<void>) => {
        setBusy(true);
        setError("");
        try {
            await settle();
            await task();
        } catch (e: any) {
            setError(e?.message ?? "تعذّر إنشاء الملف");
        } finally {
            setBusy(false);
        }
    };
    return { busy, error, run };
}

export function GradesExportButtons({ className, subjectName }: { className: string; subjectName: string }) {
    const convex = useConvex();
    const [scope, setScope] = useState<"subject" | "all">("subject");
    const { busy, error, run } = useExcelExport();

    const exportExcel = () => run(async () => {
        const data = await convex.query(api.grades.getClassExport, {
            className,
            ...(scope === "subject" ? { subjectName } : {}),
        });
        if (!data) throw new Error("تعذّر تحميل درجات الشعبة.");
        const stem = ["التقييمات القصيرة", className, scope === "subject" ? subjectName : "كل المواد"].join(" - ");
        await downloadWorkbook(safeFileName(stem), buildGradesSheets(data));
    });

    const pdfHref = `/grades/print/class?class=${encodeURIComponent(className)}`
        + (scope === "subject" ? `&subject=${encodeURIComponent(subjectName)}` : "")
        + "&autoprint=1";

    return (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-4 py-3 flex items-center gap-2 flex-wrap">
            <span className="flex items-center gap-1.5 text-xs font-black text-slate-600 ml-1">
                <Download className="w-4 h-4 text-qatar-maroon"/>حفظ نسخة من الرصد
            </span>
            <div className="flex rounded-xl border border-slate-200 overflow-hidden text-[11px] font-black" role="group" aria-label="نطاق التصدير">
                {([
                    { key: "subject" as const, label: `مادة ${subjectName}` },
                    { key: "all" as const, label: "كل مواد الشعبة" },
                ]).map(o => (
                    <button key={o.key} type="button" onClick={() => setScope(o.key)} aria-pressed={scope === o.key}
                        className={`px-3 py-2 transition-colors ${
                            scope === o.key ? "bg-qatar-maroon text-white" : "bg-white text-slate-500 hover:bg-slate-50"}`}>
                        {o.label}
                    </button>
                ))}
            </div>
            <button type="button" onClick={exportExcel} disabled={busy} className={excelBtn}>
                <FileSpreadsheet className="w-4 h-4"/>{busy ? "جاري التجهيز…" : "Excel"}
            </button>
            <a href={pdfHref} target="_blank" rel="noopener noreferrer" className={pdfBtn}>
                <FileText className="w-4 h-4"/>PDF
            </a>
            <span className="text-[11px] font-bold text-slate-400 mr-auto">
                PDF يفتح نافذة الطباعة — اختر «حفظ بصيغة PDF»
            </span>
            {error && <span role="alert" className="w-full text-xs font-black text-red-700">{error}</span>}
        </div>
    );
}

export function DiagnosticsExportButtons({ testId, className }: { testId: string; className: string }) {
    const convex = useConvex();
    const { busy, error, run } = useExcelExport();

    const exportExcel = () => run(async () => {
        const data = await convex.query(api.diagnostics.getExportData, { testId: testId as any, className });
        if (!data) throw new Error("تعذّر تحميل درجات الشعبة.");
        await downloadWorkbook(safeFileName([data.test.title, className].join(" - ")), buildDiagnosticsSheets(data));
    });

    const pdfHref = `/diagnostics/print/sheet/${testId}?class=${encodeURIComponent(className)}&subject=&autoprint=1`;

    return (
        <div className="flex items-center gap-1.5 flex-wrap">
            <button type="button" onClick={exportExcel} disabled={busy || !className}
                title={`تنزيل درجات الشعبة ${className} بصيغة Excel`} className={excelBtn}>
                <FileSpreadsheet className="w-4 h-4"/>{busy ? "…" : "Excel"}
            </button>
            <a href={pdfHref} target="_blank" rel="noopener noreferrer"
                title={`كشف الشعبة ${className} للطباعة أو الحفظ PDF`} className={pdfBtn}>
                <FileText className="w-4 h-4"/>PDF
            </a>
            {error && <span role="alert" className="text-[11px] font-black text-red-700">{error}</span>}
        </div>
    );
}
