import { useMemo, useState } from "react";
import { Plus, Download, ArrowUp, ArrowDown } from "lucide-react";
import { DOMAINS, DOMAIN_LABELS, ROLE_LABELS, formatDate } from "../../../convex/visitMath";
import {
    applyFilters, countByRole, criterionAverages, departmentTable, monthLabel, monthlyCounts, pct, scoreTone,
    submittedOnly, teacherCoverage, type Filters, type VisitRow,
} from "../../lib/visitStats";
import { downloadWorkbook } from "../../lib/excelExport";
import FiltersBar, { periodPresets } from "./FiltersBar";

// What the academic deputy opens first, in the same shape as the short
// assessments' «متابعة الرصد»: one line that says how much of the staff has
// been visited, the departments ranked, and the names still waiting.

export default function VisitsDashboard({ setup, visits, onOpenTeacher, onNewVisit, onOpenDrafts }: {
    setup: any;
    visits: VisitRow[];
    onOpenTeacher: (teacherId: string) => void;
    onNewVisit: () => void;
    onOpenDrafts: () => void;
}) {
    const year = periodPresets(setup)[0];
    const [filters, setFilters] = useState<Filters>({ department: "", teacherId: "", role: "", from: year.from, to: year.to });

    const teachers = useMemo(() => setup.teachers.filter((t: any) =>
        !filters.department || t.department === filters.department), [setup.teachers, filters.department]);

    const scoped = useMemo(() => submittedOnly(applyFilters(visits, filters)), [visits, filters]);
    const drafts = visits.filter(v => v.status === "draft").length;
    const thisMonth = scoped.filter(v => v.visitDate.slice(0, 7) === setup.today.slice(0, 7)).length;
    const roles = countByRole(scoped);

    const averages = criterionAverages(scoped, setup.criteria);
    const deptRows = departmentTable(scoped, setup.teachers, setup.criteria)
        .filter(r => !filters.department || r.department === filters.department);
    const coverage = teacherCoverage(scoped, teachers, {
        coordinator: setup.settings.requiredCoordinator,
        supervisor: setup.settings.requiredSupervisor,
        deputy: setup.settings.requiredDeputy,
    });
    const unvisited = coverage.filter(c => c.total === 0);
    const visitedCount = teachers.length - unvisited.length;
    const coveredPct = teachers.length ? visitedCount / teachers.length : 0;
    const coverTone = coveredPct >= 0.8 ? "#059669" : coveredPct >= 0.4 ? "#f59e0b" : "#e11d48";
    const monthly = monthlyCounts(scoped);
    const maxMonth = Math.max(1, ...monthly.map(m => m.total));
    const unvisitedByDept = [...new Set(unvisited.map(c => c.teacher.department))]
        .map(d => ({ department: d, list: unvisited.filter(c => c.teacher.department === d) }))
        .sort((a, b) => b.list.length - a.list.length);

    const exportExcel = () => downloadWorkbook(`لوحة متابعة الزيارات الصفية - ${setup.settings.academicYear}`, [{
        name: "الأقسام",
        title: "الإحصائيات العامة للزيارات الصفية",
        meta: [
            setup.settings.schoolNameOnForm,
            `الفترة: ${filters.from ? formatDate(filters.from) : "البداية"} — ${filters.to ? formatDate(filters.to) : "اليوم"}`
                + (filters.role ? ` · ${ROLE_LABELS[filters.role]}` : ""),
        ],
        columns: [
            { header: "الترتيب", width: 8, align: "center" },
            { header: "القسم", width: 26, bold: true },
            { header: "المنسق", width: 9, align: "center" },
            { header: "الموجّه", width: 9, align: "center" },
            { header: "النائب", width: 9, align: "center" },
            { header: "الإجمالي", width: 9, align: "center", bold: true },
            { header: "المعلمون", width: 9, align: "center" },
            { header: "بلا زيارة", width: 9, align: "center" },
            ...DOMAINS.map(d => ({ header: DOMAIN_LABELS[d], width: 11, align: "center" as const, numFmt: "0.0%" })),
            { header: "المعدل", width: 10, align: "center" as const, bold: true, numFmt: "0.0%" },
            { header: "مقارنة بالمدرسة", width: 12, align: "center" as const, numFmt: "+0.0%;-0.0%" },
        ],
        rows: deptRows.map(r => [
            r.rank, r.department, r.coordinator, r.supervisor, r.deputy, r.total, r.teachers, r.withoutVisit,
            ...DOMAINS.map(d => r.domains[d]), r.average, r.vsSchool,
        ]),
        tone: (row, col) => (col === 7 && Number(row[7]) > 0 ? "warn" : undefined),
        orientation: "landscape",
    }, {
        name: "معلمون بلا زيارة",
        title: "معلمون لم تُسجَّل لهم زيارة في الفترة",
        columns: [
            { header: "م", width: 5, align: "center" },
            { header: "المعلم", width: 34, bold: true },
            { header: "القسم", width: 26 },
        ],
        rows: unvisited.map((c, i) => [i + 1, c.teacher.fullName, c.teacher.department]),
    }]);

    return (
        <div className="space-y-4">
            <FiltersBar setup={setup} value={filters} onChange={setFilters}/>

            {/* One summary card, as «متابعة الرصد» has */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-3">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                        <p className="font-black text-slate-800">{visitedCount} من {teachers.length} معلم تمت زيارتهم</p>
                        <p className="text-xs font-bold text-slate-500 mt-0.5">
                            {scoped.length} زيارة معتمدة · {thisMonth} هذا الشهر ·
                            منسق {roles.coordinator} · موجّه {roles.supervisor} · نائب {roles.deputy}
                        </p>
                        <p className="text-xs font-black mt-1" style={{ color: scoreTone(averages.overall) }}>
                            المعدل العام {pct(averages.overall, 1)}
                        </p>
                    </div>
                    <span className="text-3xl font-black" style={{ color: coverTone }}>{pct(coveredPct)}</span>
                </div>
                <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${coveredPct * 100}%`, background: coverTone }}/>
                </div>
                <div className="flex gap-2 flex-wrap">
                    <button onClick={onNewVisit}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black bg-qatar-maroon text-white">
                        <Plus className="w-4 h-4"/>زيارة جديدة
                    </button>
                    {drafts > 0 && (
                        <button onClick={onOpenDrafts}
                            className="px-4 py-2 rounded-xl text-xs font-black border border-amber-200 bg-amber-50 text-amber-800">
                            {drafts} {drafts === 1 ? "مسودة" : "مسودات"} لم تُعتمد
                        </button>
                    )}
                </div>
            </div>

            {/* Departments — the workbook's «sts» sheet */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between gap-2">
                    <h3 className="font-bold text-slate-700 text-sm">الأقسام — الأعلى معدلاً أولاً</h3>
                    <button onClick={exportExcel}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 text-xs font-bold hover:border-qatar-maroon hover:text-qatar-maroon">
                        <Download className="w-3.5 h-3.5"/>Excel
                    </button>
                </div>
                <div className="overflow-auto">
                    <table className="w-full text-xs">
                        <thead className="bg-slate-50">
                            <tr>
                                {["القسم", "منسق", "موجّه", "نائب", "الإجمالي", "المعلمون", "بلا زيارة",
                                  ...DOMAINS.map(d => DOMAIN_LABELS[d]), "المعدل", "عن المدرسة"].map((h, i) => (
                                    <th key={h} className={`px-3 font-semibold text-slate-600 whitespace-nowrap ${i === 0 ? "text-right" : "text-center"}`}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {deptRows.map(r => (
                                <tr key={r.department} className="border-t border-slate-100">
                                    <td className="px-3 text-right font-black text-slate-700 whitespace-nowrap">
                                        <span className="text-slate-400 font-bold ml-1">{r.rank ?? "—"}</span>{r.department}
                                    </td>
                                    <td className="px-3 text-center">{r.coordinator || "—"}</td>
                                    <td className="px-3 text-center">{r.supervisor || "—"}</td>
                                    <td className="px-3 text-center">{r.deputy || "—"}</td>
                                    <td className="px-3 text-center font-black">{r.total}</td>
                                    <td className="px-3 text-center">{r.teachers}</td>
                                    <td className="px-3 text-center">
                                        <span className={`px-2 py-0.5 rounded-lg font-black ${r.withoutVisit ? "bg-rose-100 text-rose-800" : "bg-emerald-50 text-emerald-700"}`}>
                                            {r.withoutVisit}
                                        </span>
                                    </td>
                                    {DOMAINS.map(d => (
                                        <td key={d} className="px-3 text-center font-bold" style={{ color: scoreTone(r.domains[d]) }}>{pct(r.domains[d])}</td>
                                    ))}
                                    <td className="px-3 text-center font-black" style={{ color: scoreTone(r.average) }}>{pct(r.average, 1)}</td>
                                    <td className="px-3 text-center font-bold">
                                        {r.vsSchool === null ? "—" : (
                                            <span className={`inline-flex items-center gap-0.5 ${r.vsSchool >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                                                {r.vsSchool >= 0 ? <ArrowUp className="w-3 h-3"/> : <ArrowDown className="w-3 h-3"/>}
                                                {Math.abs(r.vsSchool * 100).toFixed(1)}%
                                            </span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Teachers nobody has visited — one row per department */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b border-slate-100">
                    <h3 className="font-bold text-slate-700 text-sm">معلمون لم تتم زيارتهم ({unvisited.length})</h3>
                </div>
                {unvisited.length === 0 ? (
                    <p className="px-5 py-4 text-sm font-black text-emerald-700">تمت زيارة كل المعلمين في هذه الفترة ✓</p>
                ) : (
                    <div className="overflow-auto max-h-[60vh] divide-y divide-slate-100 text-xs">
                        {unvisitedByDept.map(({ department, list }) => (
                            <div key={department} className="px-5 py-2.5 flex flex-col sm:flex-row gap-2 sm:items-start">
                                <div className="flex items-center gap-2 sm:w-56 shrink-0">
                                    <span className="font-black text-slate-700">{department}</span>
                                    <span className="px-2 py-0.5 rounded-lg bg-rose-100 text-rose-800 font-black">{list.length}</span>
                                </div>
                                <div className="flex flex-wrap gap-1">
                                    {list.map(c => (
                                        <button key={c.teacher._id} onClick={() => onOpenTeacher(c.teacher._id)}
                                            className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-bold text-[11px] hover:bg-qatar-maroon hover:text-white">
                                            {c.teacher.fullName}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {monthly.length > 1 && (
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-2">
                    <h3 className="font-bold text-slate-700 text-sm mb-2">الزيارات شهرياً</h3>
                    {monthly.map(m => (
                        <div key={m.month} className="flex items-center gap-3 text-xs">
                            <span className="w-24 font-bold text-slate-600 shrink-0">{monthLabel(m.month)}</span>
                            <div className="flex-1 flex h-2.5 rounded-full overflow-hidden bg-slate-100">
                                {([["coordinator", "#5C1523"], ["supervisor", "#2563eb"], ["deputy", "#059669"]] as const).map(([k, c]) =>
                                    m[k] ? <div key={k} title={`${ROLE_LABELS[k]}: ${m[k]}`} style={{ width: `${(m[k] / maxMonth) * 100}%`, background: c }}/> : null)}
                            </div>
                            <span className="w-8 font-black text-slate-700 text-left">{m.total}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
