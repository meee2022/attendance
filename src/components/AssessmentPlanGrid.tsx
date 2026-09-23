import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
// @ts-ignore
import { api } from "../../convex/_generated/api";
import { CalendarDays, Download, Printer, Loader2 } from "lucide-react";
import { EmptyState } from "./ui";
import { weeksFor } from "../lib/planMath";
import { downloadWorkbook, safeFileName, SIGNATURE_LINES } from "../lib/excelExport";
import { printableSchoolName } from "../lib/brand";

// The school's own grid, editable in place: subjects down the side, the term's
// weeks across the top, a mark where a short assessment falls. A subject keeps
// one row for every grade until someone gives a grade its own rhythm, which is
// what the science subjects need — their marks cover two grades at once.

const GRADE_LABELS: Record<number, string> = { 10: "العاشر", 11: "الحادي عشر", 12: "الثاني عشر" };

export default function AssessmentPlanGrid({ grades }: { grades: number[] }) {
    // @ts-ignore
    const plan = useQuery(api.assessmentPlan.getPlan) as any;
    // @ts-ignore
    const toggleCell = useMutation(api.assessmentPlan.toggleCell);
    // @ts-ignore
    const splitSubject = useMutation(api.assessmentPlan.splitSubjectByGrade);
    // @ts-ignore
    const clearSubjectGrade = useMutation(api.assessmentPlan.clearSubjectGrade);

    const [scope, setScope] = useState<number | "all">("all");
    const [busy, setBusy] = useState<string | null>(null);
    const [exporting, setExporting] = useState(false);

    if (!plan) return <div className="h-64 rounded-2xl border border-slate-100 bg-white animate-pulse"/>;

    if (!plan.weeks.length) {
        return <EmptyState icon={<CalendarDays className="w-6 h-6"/>} title="لم يُستورد جدول الأسابيع بعد"
            description="استورد ملف «جدول التقييمات القصيرة حسب الأسابيع» ليعرف النظام موعد كل تقييم، وعندها يظهر المتأخر عن موعده في متابعة الرصد."/>;
    }

    const scopeGrade = scope === "all" ? undefined : scope;
    const subjects: { name: string }[] = plan.subjects;

    const hasOwnRows = (subjectName: string) =>
        scopeGrade !== undefined && plan.entries.some((e: any) =>
            e.subjectName === subjectName && e.grade === scopeGrade);

    const onCell = async (subjectName: string, week: number) => {
        const key = `${subjectName}|${week}`;
        setBusy(key);
        try {
            // First edit for a grade starts from the shared row, so nothing is lost
            if (scopeGrade !== undefined && !hasOwnRows(subjectName)) {
                await splitSubject({ subjectName, grade: scopeGrade });
            }
            await toggleCell({ subjectName, grade: scopeGrade, week });
        } finally {
            setBusy(null);
        }
    };

    const exportExcel = async () => {
        setExporting(true);
        try {
            const title = scope === "all"
                ? "جدول التقييمات القصيرة حسب الأسابيع"
                : `جدول التقييمات القصيرة — الصف ${GRADE_LABELS[scope] ?? scope}`;
            await downloadWorkbook(safeFileName(title), [{
                name: "جدول التقييمات",
                title,
                meta: [
                    printableSchoolName(plan.schoolName),
                    plan.weeks.map((w: any) => `أ${w.week}: ${w.label}`).join(" · "),
                    `تاريخ التصدير: ${new Date().toLocaleString("ar-EG")}`,
                ],
                columns: [
                    { header: "المادة", width: 28, bold: true },
                    ...plan.weeks.map((w: any) => ({
                        header: `أ${w.week}\n${w.label}${w.note ? `\n${w.note}` : ""}`,
                        width: 9, align: "center" as const,
                    })),
                    { header: "عدد التقييمات", width: 12, align: "center" as const, bold: true },
                ],
                freezeColumns: 1,
                orientation: "landscape",
                rows: subjects.map(s => {
                    const mine = weeksFor(plan.entries, s.name, scopeGrade);
                    return [
                        s.name,
                        ...plan.weeks.map((w: any) => (mine.includes(w.week) ? "✓" : null)),
                        mine.length,
                    ];
                }),
                tone: (row, col) => (col > 0 && col <= plan.weeks.length && row[col] === "✓" ? "good" : undefined),
                notes: [
                    "✓ = موعد تقييم قصير للمادة في ذلك الأسبوع",
                    plan.weeks.filter((w: any) => w.note)
                        .map((w: any) => `أ${w.week}: ${w.note}`).join(" · "),
                ],
                signatures: SIGNATURE_LINES,
            }]);
        } finally {
            setExporting(false);
        }
    };

    const printUrl = `/grades/print/plan?autoprint=1${scope === "all" ? "" : `&grade=${scope}`}`;

    return (
        <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 space-y-3">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                        <p className="font-black text-slate-800 text-sm">جدول التقييمات القصيرة حسب الأسابيع</p>
                        <p className="text-xs font-bold text-slate-500 mt-0.5">
                            اضغط على أي خانة لتحديد أو إلغاء موعد تقييم · الأسبوع الحالي {plan.currentWeek ?? "—"}
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={exportExcel} disabled={exporting}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-black disabled:opacity-60">
                            {exporting ? <Loader2 className="w-4 h-4 animate-spin"/> : <Download className="w-4 h-4"/>}
                            Excel
                        </button>
                        <a href={printUrl} target="_blank" rel="noreferrer"
                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-qatar-maroon text-white text-xs font-black">
                            <Printer className="w-4 h-4"/>PDF
                        </a>
                    </div>
                </div>

                <div className="flex gap-2 flex-wrap">
                    {([{ key: "all" as const, label: "كل الصفوف" },
                       ...grades.map(g => ({ key: g, label: `الصف ${GRADE_LABELS[g] ?? g}` }))])
                        .map(t => (
                            <button key={String(t.key)} onClick={() => setScope(t.key as any)} aria-pressed={scope === t.key}
                                className={`px-4 py-2 rounded-xl text-xs font-black border transition-colors ${
                                    scope === t.key ? "bg-qatar-maroon text-white border-transparent"
                                                    : "bg-white text-slate-500 border-slate-200 hover:border-qatar-maroon"}`}>
                                {t.label}
                            </button>
                        ))}
                </div>
                {scopeGrade !== undefined && (
                    <p className="text-[11px] font-bold text-slate-500">
                        المواد بخلفية رمادية تتبع جدول «كل الصفوف». أول تعديل لأي مادة هنا ينسخ مواعيدها لهذا الصف وحده.
                    </p>
                )}
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="overflow-auto max-h-[65vh]">
                    <table className="text-xs border-collapse">
                        <thead className="sticky top-0 bg-slate-50 z-10">
                            <tr>
                                <th className="px-3 py-2 text-right font-semibold text-slate-600 sticky right-0 bg-slate-50 min-w-[160px]">
                                    المادة
                                </th>
                                {plan.weeks.map((w: any) => (
                                    <th key={w.week} title={`${w.label}${w.note ? ` · ${w.note}` : ""}`}
                                        className={`px-1 py-2 text-center font-semibold min-w-[52px] ${
                                            w.week === plan.currentWeek ? "bg-amber-100 text-amber-900" : "text-slate-600"}`}>
                                        أ{w.week}
                                        <div className="text-[9px] font-bold text-slate-400">{w.label}</div>
                                        {w.note && <div className="text-[9px] font-black text-rose-500">{w.note}</div>}
                                    </th>
                                ))}
                                <th className="px-2 py-2 text-center font-semibold text-slate-600">العدد</th>
                            </tr>
                        </thead>
                        <tbody>
                            {subjects.map(s => {
                                const mine = weeksFor(plan.entries, s.name, scopeGrade);
                                const inherited = scopeGrade !== undefined && !hasOwnRows(s.name);
                                return (
                                    <tr key={s.name} className="border-t border-slate-100">
                                        <td className={`px-3 py-2 text-right font-black sticky right-0 bg-white ${
                                            inherited ? "text-slate-400" : "text-slate-700"}`}>
                                            {s.name}
                                            {!inherited && scopeGrade !== undefined && (
                                                <button onClick={() => clearSubjectGrade({ subjectName: s.name, grade: scopeGrade })}
                                                    className="block text-[9px] font-bold text-slate-400 hover:text-rose-600">
                                                    إرجاعها لجدول كل الصفوف
                                                </button>
                                            )}
                                        </td>
                                        {plan.weeks.map((w: any) => {
                                            const marked = mine.includes(w.week);
                                            const key = `${s.name}|${w.week}`;
                                            return (
                                                <td key={w.week} className="p-0.5 text-center">
                                                    <button onClick={() => onCell(s.name, w.week)} disabled={busy === key}
                                                        aria-pressed={marked}
                                                        aria-label={`${s.name} — الأسبوع ${w.week}`}
                                                        className={`w-full h-7 rounded-md font-black transition-colors ${
                                                            marked
                                                                ? inherited ? "bg-slate-200 text-slate-500" : "bg-emerald-100 text-emerald-700"
                                                                : "bg-slate-50 text-transparent hover:bg-slate-100"}`}>
                                                        {marked ? String(mine.indexOf(w.week) + 1) : "·"}
                                                    </button>
                                                </td>
                                            );
                                        })}
                                        <td className="px-2 py-2 text-center font-black text-slate-500">{mine.length}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
