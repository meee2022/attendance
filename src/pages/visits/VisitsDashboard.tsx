import { api } from "../../../convex/_generated/api";
import { useSupervisionQuery } from "../../lib/supervisionSession";
import { useMemo, useState } from "react";
import { Plus, Download, ArrowUp, ArrowDown, ArrowLeft } from "lucide-react";
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

export default function VisitsDashboard({ setup, visits, onOpenTeacher, onNewVisit, onOpenDrafts, onOpenFollowUp }: {
    setup: any;
    visits: VisitRow[];
    onOpenTeacher: (teacherId: string) => void;
    onNewVisit: () => void;
    onOpenDrafts: () => void;
    onOpenFollowUp: () => void;
}) {
    const actions = useSupervisionQuery((api as any).supervisionActions.list) as any[] | undefined;
    const overdue = (actions ?? []).filter(a => a.status === "open" && a.dueDate < setup.today);
    const planned = (actions ?? []).filter(a => a.kind === "visit" && a.status === "open");
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

            <div className="bg-qatar-maroon text-white rounded-2xl p-5 space-y-3">
                <div className="flex items-center justify-between gap-3 flex-wrap"><h2 className="font-bold">ما يحتاج متابعة</h2><button onClick={onOpenFollowUp} className="bg-white text-qatar-maroon px-4 py-2 rounded-lg text-sm font-bold min-h-11">فتح المتابعة والخطة</button></div>
                <div className="flex gap-x-6 gap-y-2 flex-wrap text-sm"><span>{overdue.length} إجراء متأخر</span><span>{planned.length} موعد زيارة مفتوح</span><button onClick={onOpenDrafts} className="underline underline-offset-4">{drafts} مسودة غير معتمدة</button></div>
                <p className="text-sm text-white/85">المواعيد والإجراءات المفتوحة تشمل السنوات السابقة حتى تُنجز أو تُلغى.</p>
            </div>
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

            <section className="visit-results" aria-labelledby="department-results-title">
                <header className="visit-results-heading">
                    <div><h3 id="department-results-title">نتائج الأقسام</h3><p>الزيارات المعتمدة ومتوسطات الأداء في الفترة المحددة</p></div>
                    <button onClick={exportExcel} className="visit-results-export"><Download size={16} aria-hidden="true"/>تصدير Excel</button>
                </header>
                <div className="visit-results-scroll" tabIndex={0} role="region" aria-label="نتائج الأقسام، مرّر أفقيًا لعرض جميع الأعمدة">
                    <table className="visit-results-table">
                        <thead>
                            <tr className="visit-results-groups">
                                <th rowSpan={2} scope="col" className="visit-department-cell">القسم</th>
                                <th colSpan={4} scope="colgroup">الزيارات المعتمدة</th>
                                <th colSpan={2} scope="colgroup">تغطية المعلمين</th>
                                <th colSpan={4} scope="colgroup">متوسطات المجالات</th>
                                <th colSpan={2} scope="colgroup">النتيجة العامة</th>
                            </tr>
                            <tr>{["منسق", "موجّه", "نائب", "الإجمالي", "المعلمون", "بلا زيارة", ...DOMAINS.map(d => DOMAIN_LABELS[d]), "المعدل", "مقارنة بالمدرسة"].map(h => <th key={h} scope="col">{h}</th>)}</tr>
                        </thead>
                        <tbody>
                            {deptRows.map(r => <tr key={r.department}>
                                <th scope="row" className="visit-department-cell">{r.department}</th>
                                <td>{r.coordinator}</td><td>{r.supervisor}</td><td>{r.deputy}</td>
                                <td className="visit-result-total">{r.total}</td><td>{r.teachers}</td>
                                <td><span className={r.withoutVisit ? "visit-missing-count" : "visit-complete-count"}>{r.withoutVisit}</span></td>
                                {DOMAINS.map(d => <td key={d}><span className="visit-domain-value">{pct(r.domains[d])}</span></td>)}
                                <td className="visit-result-average">{pct(r.average, 1)}</td>
                                <td>{r.vsSchool === null ? "—" : Math.abs(r.vsSchool * 100) < .05 ? <span className="visit-result-equal">مماثل للمدرسة</span> :
                                    <span className={`visit-result-difference ${r.vsSchool > 0 ? "is-positive" : "is-negative"}`}>
                                        {r.vsSchool > 0 ? <ArrowUp size={13} aria-hidden="true"/> : <ArrowDown size={13} aria-hidden="true"/>}
                                        <span>{Math.abs(r.vsSchool * 100).toFixed(1)} نقطة {r.vsSchool > 0 ? "أعلى" : "أقل"}</span>
                                    </span>}
                                </td>
                            </tr>)}
                            {!deptRows.length && <tr><td colSpan={13} className="visit-results-empty">لا توجد أقسام ضمن الاختيار الحالي.</td></tr>}
                        </tbody>
                    </table>
                </div>
                <p className="visit-results-note">تُقرأ المتوسطات مع عدد الزيارات ومرات القياس؛ قلة الزيارات قد تجعل المقارنة غير ممثلة لأداء القسم. الفرق عن المدرسة بالنقاط المئوية.</p>
            </section>

            <section className="visit-results" aria-labelledby="unvisited-teachers-title">
                <header className="visit-results-heading">
                    <div><h3 id="unvisited-teachers-title">معلمون بانتظار الزيارة <span className="visit-missing-count">{unvisited.length}</span></h3><p>لم تُسجّل لهم زيارة معتمدة ضمن الفلاتر الحالية. اختر الاسم لفتح ملف المعلم.</p></div>
                </header>
                {unvisited.length === 0 ? <p className="visit-results-empty">{teachers.length ? "لا يوجد معلمون بانتظار الزيارة ضمن الاختيار الحالي." : "لا يوجد معلمون ضمن الاختيار الحالي."}</p> :
                    <div className="visit-unvisited-departments">
                        {unvisitedByDept.map(({ department, list }) => <div key={department} className="visit-unvisited-department">
                            <div className="visit-unvisited-label"><h4>{department}</h4><span>{list.length} بانتظار الزيارة</span></div>
                            <ul className="visit-unvisited-list">
                                {list.map(c => <li key={c.teacher._id}>
                                    <button onClick={() => onOpenTeacher(c.teacher._id)} aria-label={`فتح ملف ${c.teacher.fullName}`}><span>{c.teacher.fullName}</span><ArrowLeft size={15} aria-hidden="true"/></button>
                                </li>)}
                            </ul>
                        </div>)}
                    </div>}
            </section>

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
