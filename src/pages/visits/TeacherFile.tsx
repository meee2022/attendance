import { useMemo } from "react";
import { Printer, TrendingUp, TrendingDown } from "lucide-react";
import { DOMAINS, DOMAIN_LABELS, ROLE_LABELS, formatDate, parseRatings, type VisitorRole } from "../../../convex/visitMath";
import { countByRole, criterionAverages, pct, scoreTone, submittedOnly, type VisitRow } from "../../lib/visitStats";

// One teacher across the year: the visits in order, where each domain stands,
// the strongest and weakest criteria, and — for the weakest — how the rating
// moved from one visit to the next, which is how a recommendation is followed up.

export default function TeacherFile({ setup, visits, teacherId, onChangeTeacher, onPrint }: {
    setup: any;
    visits: VisitRow[];
    teacherId: string;
    onChangeTeacher: (id: string) => void;
    onPrint: (id: string) => void;
}) {
    const teacher = setup.teachers.find((t: any) => t._id === teacherId);
    const mine = useMemo(() => submittedOnly(visits)
        .filter(v => v.teacherId === teacherId)
        .sort((a, b) => a.visitDate.localeCompare(b.visitDate)), [visits, teacherId]);

    const stats = criterionAverages(mine, setup.criteria);
    const measured = stats.criteria.filter(c => c.average !== null);
    const strongest = [...measured].sort((a, b) => b.average! - a.average!).slice(0, 3);
    const weakest = [...measured].sort((a, b) => a.average! - b.average!).slice(0, 3);
    const byRole = countByRole(mine);
    const required: Record<VisitorRole, number> = {
        coordinator: setup.settings.requiredCoordinator,
        supervisor: setup.settings.requiredSupervisor,
        deputy: setup.settings.requiredDeputy,
    };

    const departments: string[] = setup.departments;

    return (
        <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-3 flex flex-wrap gap-2 items-center">
                <select value={teacher?.department ?? ""} aria-label="القسم"
                    onChange={e => {
                        const first = setup.teachers.find((t: any) => t.department === e.target.value);
                        onChangeTeacher(first?._id ?? "");
                    }}
                    className="border-2 border-slate-100 rounded-xl px-3 py-2 text-sm font-bold bg-slate-50">
                    <option value="">— القسم —</option>
                    {departments.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
                <select value={teacherId} onChange={e => onChangeTeacher(e.target.value)} aria-label="المعلم"
                    className="border-2 border-slate-100 rounded-xl px-3 py-2 text-sm font-bold bg-slate-50 min-w-[240px]">
                    <option value="">— اختر المعلم —</option>
                    {setup.teachers
                        .filter((t: any) => !teacher || t.department === teacher.department)
                        .map((t: any) => <option key={t._id} value={t._id}>{t.fullName}</option>)}
                </select>
            </div>

            {!teacher ? (
                <p className="bg-white rounded-2xl border border-slate-100 p-8 text-center text-sm font-bold text-slate-400">
                    اختر معلماً لعرض ملفه.
                </p>
            ) : (
                <>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-3">
                            <div>
                                <p className="text-lg font-black text-slate-800">{teacher.fullName}</p>
                                <p className="text-xs font-bold text-slate-500">{teacher.department}{teacher.email ? ` · ${teacher.email}` : ""}</p>
                            </div>
                            <p className="text-4xl font-black" style={{ color: scoreTone(stats.overall) }}>{pct(stats.overall, 1)}</p>
                            <div className="space-y-1.5">
                                {(Object.keys(required) as VisitorRole[]).map(r => (
                                    <div key={r} className="flex items-center justify-between text-xs font-bold">
                                        <span className="text-slate-600">زيارات {ROLE_LABELS[r]}</span>
                                        <span className={byRole[r] >= required[r] ? "text-emerald-700" : "text-rose-700"}>
                                            {byRole[r]} من {required[r]}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-3">
                            <p className="font-bold text-slate-700 text-sm">المجالات</p>
                            {DOMAINS.map(d => (
                                <div key={d}>
                                    <div className="flex justify-between text-xs font-bold mb-1">
                                        <span className="text-slate-600">{DOMAIN_LABELS[d]}</span>
                                        <span style={{ color: scoreTone(stats.domains[d]) }}>{pct(stats.domains[d])}</span>
                                    </div>
                                    <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                                        <div className="h-full rounded-full" style={{
                                            width: `${(stats.domains[d] ?? 0) * 100}%`, background: scoreTone(stats.domains[d]),
                                        }}/>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-3">
                            <p className="font-bold text-slate-700 text-sm">تطور المعدل</p>
                            {mine.length === 0 ? (
                                <p className="text-xs font-bold text-slate-400">لا توجد زيارات معتمدة بعد.</p>
                            ) : (
                                <div className="flex items-end gap-2 h-32">
                                    {mine.map(v => (
                                        <div key={v._id} className="flex-1 flex flex-col items-center gap-1 min-w-0"
                                            title={`${formatDate(v.visitDate)} · ${ROLE_LABELS[v.visitorRole]} · ${pct(v.averageScore, 1)}`}>
                                            <span className="text-[10px] font-black" style={{ color: scoreTone(v.averageScore) }}>{pct(v.averageScore)}</span>
                                            <div className="w-full rounded-t-md" style={{
                                                height: `${Math.max(4, (v.averageScore ?? 0) * 100)}%`, background: scoreTone(v.averageScore),
                                            }}/>
                                            <span className="text-[9px] font-bold text-slate-400 truncate w-full text-center">{formatDate(v.visitDate).slice(0, 5)}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {measured.length > 0 && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            <CriteriaList title="نقاط القوة" icon={<TrendingUp className="w-4 h-4 text-emerald-600"/>}
                                items={strongest} visits={mine} criteria={setup.criteria}/>
                            <CriteriaList title="أولويات التحسين" icon={<TrendingDown className="w-4 h-4 text-rose-600"/>}
                                items={weakest} visits={mine} criteria={setup.criteria} showTrail/>
                        </div>
                    )}

                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                        <div className="px-5 py-3 border-b border-slate-100">
                            <p className="font-bold text-slate-700 text-sm">الزيارات ({mine.length})</p>
                        </div>
                        {mine.length === 0 ? (
                            <p className="p-6 text-center text-sm font-bold text-slate-400">لم يُزَر هذا المعلم بعد.</p>
                        ) : (
                            <div className="divide-y divide-slate-100">
                                {[...mine].reverse().map(v => (
                                    <div key={v._id} className="p-4 space-y-2">
                                        <div className="flex items-center gap-3 flex-wrap">
                                            <span className="font-black text-slate-800">{formatDate(v.visitDate)}</span>
                                            <span className="text-xs font-bold text-slate-500">
                                                {ROLE_LABELS[v.visitorRole]} · {v.visitorName} · {v.className} · {v.lessonTopic}
                                            </span>
                                            <span className="font-black mr-auto" style={{ color: scoreTone(v.averageScore) }}>{pct(v.averageScore, 1)}</span>
                                            <button onClick={() => onPrint(v._id)} title="الاستمارة (PDF)"
                                                className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-qatar-maroon">
                                                <Printer className="w-4 h-4"/>
                                            </button>
                                        </div>
                                        {[["التخطيط", v.planningRec], ["تنفيذ الدرس", v.executionRec],
                                          ["التقويم والإدارة الصفية", v.evalMgmtRec], ["عامة", v.notes]]
                                            .filter(([, t]) => t && t.trim())
                                            .map(([k, t]) => (
                                                <p key={k} className="text-xs text-slate-600 leading-relaxed whitespace-pre-line">
                                                    <span className="font-black text-slate-700">توصيات {k}: </span>{t}
                                                </p>
                                            ))}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}

function CriteriaList({ title, icon, items, visits, criteria, showTrail }: {
    title: string; icon: React.ReactNode; items: any[]; visits: VisitRow[]; criteria: any[]; showTrail?: boolean;
}) {
    return (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-3">
            <p className="font-bold text-slate-700 text-sm flex items-center gap-2">{icon}{title}</p>
            {items.map(c => {
                const trail = visits.map(v => parseRatings(v.ratings)[c._id]).filter(r => r !== undefined && r !== "not_measured") as number[];
                return (
                    <div key={c._id} className="text-xs">
                        <div className="flex justify-between gap-3">
                            <span className="font-bold text-slate-700">
                                <span className="text-slate-400">{criteria.findIndex((x: any) => x._id === c._id) + 1}. </span>{c.text}
                            </span>
                            <span className="font-black shrink-0" style={{ color: scoreTone(c.average) }}>{pct(c.average)}</span>
                        </div>
                        {showTrail && trail.length > 1 && (
                            <p className="text-[10px] font-bold text-slate-400 mt-0.5">
                                التقدير عبر الزيارات: {trail.join(" ← ")}
                                {trail[trail.length - 1] > trail[0] ? " · تحسّن" : trail[trail.length - 1] < trail[0] ? " · تراجع" : " · ثابت"}
                            </p>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
