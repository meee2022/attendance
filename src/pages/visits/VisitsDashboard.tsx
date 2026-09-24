import { useMemo, useState } from "react";
import {
    CalendarCheck, Users, UserX, Gauge, FilePen, Plus, Download, ArrowUp, ArrowDown,
} from "lucide-react";
import { KPICard } from "../../components/ui";
import { DOMAINS, DOMAIN_LABELS, ROLE_LABELS, formatDate } from "../../../convex/visitMath";
import {
    applyFilters, criterionAverages, departmentTable, monthLabel, monthlyCounts, pct, scoreTone,
    submittedOnly, teacherCoverage, type Filters, type VisitRow,
} from "../../lib/visitStats";
import { downloadWorkbook } from "../../lib/excelExport";
import FiltersBar, { periodPresets } from "./FiltersBar";

// What the academic deputy opens first: how many visits, how much of the staff
// they cover, which departments are behind, and the names of the teachers
// nobody has visited yet.

export default function VisitsDashboard({ setup, visits, onOpenTeacher, onNewVisit }: {
    setup: any;
    visits: VisitRow[];
    onOpenTeacher: (teacherId: string) => void;
    onNewVisit: () => void;
}) {
    const year = periodPresets(setup)[0];
    const [filters, setFilters] = useState<Filters>({ department: "", teacherId: "", role: "", from: year.from, to: year.to });

    const teachers = useMemo(() => setup.teachers.filter((t: any) =>
        !filters.department || t.department === filters.department), [setup.teachers, filters.department]);

    const scoped = useMemo(() => submittedOnly(applyFilters(visits, filters)), [visits, filters]);
    const drafts = visits.filter(v => v.status === "draft").length;
    const thisMonth = submittedOnly(visits).filter(v => v.visitDate.slice(0, 7) === setup.today.slice(0, 7)
        && (!filters.department || v.department === filters.department)).length;

    const averages = criterionAverages(scoped, setup.criteria);
    const deptRows = departmentTable(scoped, setup.teachers, setup.criteria)
        .filter(r => !filters.department || r.department === filters.department);
    const coverage = teacherCoverage(scoped, teachers, {
        coordinator: setup.settings.requiredCoordinator,
        supervisor: setup.settings.requiredSupervisor,
        deputy: setup.settings.requiredDeputy,
    });
    const unvisited = coverage.filter(c => c.total === 0);
    const coveredPct = teachers.length ? (teachers.length - unvisited.length) / teachers.length : null;
    const monthly = monthlyCounts(scoped);
    const maxMonth = Math.max(1, ...monthly.map(m => m.total));

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

            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
                <KPICard label="زيارات معتمدة في الفترة" value={scoped.length} icon={<CalendarCheck className="w-5 h-5"/>}/>
                <KPICard label="زيارات هذا الشهر" value={thisMonth} icon={<CalendarCheck className="w-5 h-5"/>} color="#2563eb"/>
                <KPICard label="تغطية المعلمين" value={pct(coveredPct)} icon={<Users className="w-5 h-5"/>}
                    color="#059669" subValue={`${teachers.length - unvisited.length} من ${teachers.length} معلم`}/>
                <KPICard label="معلمون بلا زيارة" value={unvisited.length} icon={<UserX className="w-5 h-5"/>}
                    color={unvisited.length ? "#dc2626" : "#059669"}/>
                <KPICard label="المعدل العام" value={pct(averages.overall, 1)} icon={<Gauge className="w-5 h-5"/>}
                    color={scoreTone(averages.overall)}/>
                <KPICard label="مسودات لم تُعتمد" value={drafts} icon={<FilePen className="w-5 h-5"/>}
                    color={drafts ? "#d97706" : "#64748b"}/>
            </div>

            {scoped.length === 0 && (
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8 text-center space-y-3">
                    <p className="font-black text-slate-700">لا توجد زيارات معتمدة في هذه الفترة بعد.</p>
                    <button onClick={onNewVisit}
                        className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-qatar-maroon text-white font-black text-sm">
                        <Plus className="w-4 h-4"/>تسجيل زيارة
                    </button>
                </div>
            )}

            {/* Department table — the workbook's «sts» sheet */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between gap-2 flex-wrap">
                    <h3 className="font-black text-slate-800 text-sm">الأقسام — مرتبة بالمعدل</h3>
                    <button onClick={exportExcel}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-black">
                        <Download className="w-3.5 h-3.5"/>Excel
                    </button>
                </div>
                <div className="overflow-auto">
                    <table className="w-full text-xs">
                        <thead className="bg-slate-50 text-slate-600">
                            <tr>
                                {["#", "القسم", "منسق", "موجّه", "نائب", "الإجمالي", "المعلمون", "بلا زيارة",
                                  ...DOMAINS.map(d => DOMAIN_LABELS[d]), "المعدل", "عن المدرسة"].map(h => (
                                    <th key={h} className="px-2 py-2 font-semibold text-center first:text-right whitespace-nowrap">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {deptRows.map(r => (
                                <tr key={r.department} className="border-t border-slate-100 hover:bg-slate-50">
                                    <td className="px-2 py-2 font-black text-slate-400">{r.rank ?? "—"}</td>
                                    <td className="px-2 py-2 font-black text-slate-800 whitespace-nowrap">{r.department}</td>
                                    <td className="px-2 py-2 text-center">{r.coordinator || ""}</td>
                                    <td className="px-2 py-2 text-center">{r.supervisor || ""}</td>
                                    <td className="px-2 py-2 text-center">{r.deputy || ""}</td>
                                    <td className="px-2 py-2 text-center font-black">{r.total}</td>
                                    <td className="px-2 py-2 text-center">{r.teachers}</td>
                                    <td className={`px-2 py-2 text-center font-black ${r.withoutVisit ? "text-rose-700" : "text-emerald-700"}`}>
                                        {r.withoutVisit}
                                    </td>
                                    {DOMAINS.map(d => (
                                        <td key={d} className="px-2 py-2 text-center font-bold" style={{ color: scoreTone(r.domains[d]) }}>
                                            {pct(r.domains[d])}
                                        </td>
                                    ))}
                                    <td className="px-2 py-2 text-center font-black" style={{ color: scoreTone(r.average) }}>{pct(r.average, 1)}</td>
                                    <td className="px-2 py-2 text-center font-bold">
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

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Teachers nobody has visited yet */}
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                    <div className="px-5 py-3 border-b border-slate-100">
                        <h3 className="font-black text-slate-800 text-sm">معلمون بلا زيارة ({unvisited.length})</h3>
                    </div>
                    <div className="p-4 max-h-[420px] overflow-auto space-y-3">
                        {unvisited.length === 0 ? (
                            <p className="text-sm font-black text-emerald-700">كل المعلمين تمت زيارتهم في هذه الفترة ✓</p>
                        ) : (
                            [...new Set(unvisited.map(c => c.teacher.department))].map(dept => (
                                <div key={dept}>
                                    <p className="text-[11px] font-black text-slate-400 mb-1">{dept}</p>
                                    <div className="flex flex-wrap gap-1.5">
                                        {unvisited.filter(c => c.teacher.department === dept).map(c => (
                                            <button key={c.teacher._id} onClick={() => onOpenTeacher(c.teacher._id)}
                                                className="px-2 py-1 rounded-lg bg-rose-50 text-rose-800 text-xs font-bold hover:bg-rose-100">
                                                {c.teacher.fullName}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Visits per month */}
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                    <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
                        <h3 className="font-black text-slate-800 text-sm">الزيارات شهرياً</h3>
                        <div className="flex gap-3 text-[10px] font-bold text-slate-500">
                            <Legend color="#5C1523" label="منسق"/><Legend color="#1e40af" label="موجّه"/><Legend color="#065f46" label="نائب"/>
                        </div>
                    </div>
                    <div className="p-4 space-y-2">
                        {monthly.length === 0 && <p className="text-xs font-bold text-slate-400">لا توجد بيانات.</p>}
                        {monthly.map(m => (
                            <div key={m.month} className="flex items-center gap-2">
                                <span className="w-24 text-xs font-bold text-slate-600 shrink-0">{monthLabel(m.month)}</span>
                                <div className="flex-1 flex h-5 rounded-md overflow-hidden bg-slate-100">
                                    {([["coordinator", "#5C1523"], ["supervisor", "#1e40af"], ["deputy", "#065f46"]] as const).map(([k, c]) =>
                                        m[k] ? <div key={k} title={`${ROLE_LABELS[k]}: ${m[k]}`}
                                            style={{ width: `${(m[k] / maxMonth) * 100}%`, background: c }}/> : null)}
                                </div>
                                <span className="w-8 text-xs font-black text-slate-700 text-left">{m.total}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

function Legend({ color, label }: { color: string; label: string }) {
    return <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: color }}/>{label}</span>;
}
