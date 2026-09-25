import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { DOMAINS, DOMAIN_LABELS, ROLE_LABELS, formatDate } from "../../../convex/visitMath";
import {
    applyFilters, countByRole, criterionAverages, pct, scoreTone, submittedOnly,
    type Filters, type VisitRow,
} from "../../lib/visitStats";
import { downloadWorkbook } from "../../lib/excelExport";
import FiltersBar, { periodPresets } from "./FiltersBar";

// The workbook's analysis sheets in one view: the average of every criterion
// for any department, teacher, visitor type and period; the department ×
// criterion map; and the weakest criteria, which is where training should go.

export default function VisitsAnalysis({ setup, visits }: { setup: any; visits: VisitRow[] }) {
    const year = periodPresets(setup)[0];
    const [filters, setFilters] = useState<Filters>({ department: "", teacherId: "", role: "", from: year.from, to: year.to });

    const scoped = useMemo(() => submittedOnly(applyFilters(visits, filters)), [visits, filters]);
    const stats = criterionAverages(scoped, setup.criteria);
    const roles = countByRole(scoped);
    const criteria: any[] = setup.criteria;

    const departments: string[] = setup.departments.filter((d: string) => !filters.department || d === filters.department);
    const heat = useMemo(() => {
        const periodOnly = submittedOnly(applyFilters(visits, { ...filters, department: "", teacherId: "" }));
        return departments.map(d => ({
            department: d,
            ...criterionAverages(periodOnly.filter(v => v.department === d), criteria),
        }));
    }, [visits, filters, departments, criteria]);

    const weakest = stats.criteria.filter(c => c.average !== null).sort((a, b) => a.average! - b.average!).slice(0, 5);
    const teacherName = setup.teachers.find((t: any) => t._id === filters.teacherId)?.fullName;

    const exportExcel = () => downloadWorkbook(`تحليل الزيارات الصفية - ${filters.department || "كل الأقسام"}`, [{
        name: "تحليل المعايير",
        title: "تحليل الزيارات الصفية حسب المعايير",
        meta: [
            setup.settings.schoolNameOnForm,
            [filters.department || "كل الأقسام", teacherName, filters.role ? ROLE_LABELS[filters.role] : "كل الزائرين",
             `${filters.from ? formatDate(filters.from) : "البداية"} — ${filters.to ? formatDate(filters.to) : "اليوم"}`]
                .filter(Boolean).join(" · "),
            `عدد الزيارات: ${scoped.length} (منسق ${roles.coordinator} · موجّه ${roles.supervisor} · نائب ${roles.deputy})`,
        ],
        columns: [
            { header: "م", width: 5, align: "center" },
            { header: "المجال", width: 14 },
            { header: "المعيار", width: 70 },
            { header: "مرات القياس", width: 11, align: "center" },
            { header: "المتوسط", width: 11, align: "center", bold: true, numFmt: "0.0%" },
        ],
        rows: [
            ...stats.criteria.map((c, i) => [i + 1, DOMAIN_LABELS[c.domain as keyof typeof DOMAIN_LABELS], c.text, c.n, c.average]),
            ...DOMAINS.map(d => [null, DOMAIN_LABELS[d], "متوسط المجال", null, stats.domains[d]]),
            [null, "", "المعدل العام", null, stats.overall],
        ],
        orientation: "landscape",
    }, {
        name: "الأقسام × المعايير",
        title: "متوسط كل معيار في كل قسم",
        columns: [
            { header: "م", width: 5, align: "center" },
            { header: "المعيار", width: 60 },
            ...heat.map(h => ({ header: h.department, width: 11, align: "center" as const, numFmt: "0%" })),
        ],
        rows: criteria.map((c, i) => [i + 1, c.text, ...heat.map(h => h.criteria[i].average)]),
        freezeColumns: 2,
        orientation: "landscape",
    }]);

    return (
        <div className="space-y-4">
            <FiltersBar setup={setup} value={filters} onChange={setFilters} showTeacher/>

            <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3">
                <Tile label="الزيارات" value={String(scoped.length)}
                    sub={`منسق ${roles.coordinator} · موجّه ${roles.supervisor} · نائب ${roles.deputy}`}/>
                <Tile label="المعدل العام" value={pct(stats.overall, 1)} color={scoreTone(stats.overall)}/>
                {DOMAINS.map(d => <Tile key={d} label={DOMAIN_LABELS[d]} value={pct(stats.domains[d], 1)} color={scoreTone(stats.domains[d])}/>)}
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                <div className="xl:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                    <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
                        <h3 className="font-bold text-slate-700 text-sm">متوسط كل معيار</h3>
                        <button onClick={exportExcel}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 text-xs font-bold hover:border-qatar-maroon hover:text-qatar-maroon">
                            <Download className="w-3.5 h-3.5"/>Excel
                        </button>
                    </div>
                    <div className="divide-y divide-slate-100">
                        {DOMAINS.map(d => (
                            <div key={d} className="p-4 space-y-2">
                                <p className="text-xs font-black text-slate-500">
                                    {DOMAIN_LABELS[d]} · <span style={{ color: scoreTone(stats.domains[d]) }}>{pct(stats.domains[d], 1)}</span>
                                </p>
                                {stats.criteria.filter(c => c.domain === d).map(c => (
                                    <div key={c._id} className="grid grid-cols-[1fr_auto] gap-3 items-center">
                                        <div>
                                            <p className="text-xs font-bold text-slate-700 leading-relaxed">
                                                <span className="text-slate-400">{criteria.findIndex(x => x._id === c._id) + 1}. </span>{c.text}
                                            </p>
                                            <div className="h-1.5 rounded-full bg-slate-100 mt-1 overflow-hidden">
                                                <div className="h-full rounded-full" style={{ width: `${(c.average ?? 0) * 100}%`, background: scoreTone(c.average) }}/>
                                            </div>
                                        </div>
                                        <span className="text-xs font-black w-14 text-left" style={{ color: scoreTone(c.average) }}>
                                            {pct(c.average)}<span className="block text-[9px] font-bold text-slate-400">{c.n} قياس</span>
                                        </span>
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-3 h-fit">
                    <h3 className="font-bold text-slate-700 text-sm">الاحتياج التدريبي</h3>
                    <p className="text-[11px] font-bold text-slate-500">معايير أقل متوسطًا في الفترة — أولويات للمراجعة قبل تحديد التدريب، مع مراعاة مرات القياس.</p>
                    {weakest.length === 0 ? <p className="text-xs font-bold text-slate-400">لا توجد بيانات.</p> : weakest.map(c => (
                        <div key={c._id} className="rounded-xl bg-rose-50 p-3">
                            <p className="text-xs font-bold text-rose-900 leading-relaxed">{c.text}</p>
                            <p className="text-[11px] font-black text-rose-700 mt-1">{pct(c.average)} · {DOMAIN_LABELS[c.domain as keyof typeof DOMAIN_LABELS]}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Department × criterion map — the workbook's «stats» sheet */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b border-slate-100">
                    <h3 className="font-bold text-slate-700 text-sm">خريطة الأقسام × المعايير</h3>
                </div>
                <div className="overflow-auto max-h-[70vh]">
                    <table className="text-[11px] border-collapse">
                        <thead className="sticky top-0 bg-slate-50 z-10">
                            <tr>
                                <th className="px-2 py-2 text-right font-semibold text-slate-600 sticky right-0 bg-slate-50 min-w-[260px]">المعيار</th>
                                {heat.map(h => (
                                    <th key={h.department} className="px-1 py-2 font-semibold text-slate-600 min-w-[64px] whitespace-nowrap">{h.department}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {criteria.map((c, i) => (
                                <tr key={c._id} className="border-t border-slate-100">
                                    <td className="px-2 py-1.5 font-bold text-slate-700 sticky right-0 bg-white">
                                        <span className="text-slate-400">{i + 1}. </span>{c.text}
                                    </td>
                                    {heat.map(h => {
                                        const a = h.criteria[i].average;
                                        return (
                                            <td key={h.department} className="text-center font-black"
                                                style={{ background: a === null ? "#f8fafc" : `${scoreTone(a)}22`, color: scoreTone(a) }}>
                                                {a === null ? "" : pct(a)}
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                            <tr className="border-t-2 border-slate-200">
                                <td className="px-2 py-2 font-black text-slate-800 sticky right-0 bg-white">المعدل</td>
                                {heat.map(h => (
                                    <td key={h.department} className="text-center font-black" style={{ color: scoreTone(h.overall) }}>{pct(h.overall)}</td>
                                ))}
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

function Tile({ label, value, sub, color = "#5C1523" }: { label: string; value: string; sub?: string; color?: string }) {
    return (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
            <p className="text-2xl font-black" style={{ color }}>{value}</p>
            <p className="text-xs font-bold text-slate-600 mt-1">{label}</p>
            {sub && <p className="text-[10px] font-bold text-slate-400 mt-0.5">{sub}</p>}
        </div>
    );
}
