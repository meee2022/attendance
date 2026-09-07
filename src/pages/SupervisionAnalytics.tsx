import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
// @ts-ignore
import { api } from "../../convex/_generated/api";
import { BarChart3, Users, ClipboardCheck, TrendingUp, FileSignature, Filter } from "lucide-react";

type VisitorRole = "coordinator" | "supervisor" | "deputy";
type Domain = "planning" | "execution" | "evaluation" | "management";

const ROLE_LABELS: Record<VisitorRole, string> = { coordinator: "المنسق", supervisor: "الموجه", deputy: "النائب الأكاديمي" };
const ROLE_COLORS: Record<VisitorRole, string> = { coordinator: "#5C1523", supervisor: "#1e40af", deputy: "#065f46" };
const DOMAIN_LABELS: Record<Domain, string> = { planning: "التخطيط", execution: "تنفيذ الدرس", evaluation: "التقويم", management: "الإدارة الصفية" };
const DOMAIN_COLORS: Record<Domain, string> = { planning: "#3b82f6", execution: "#10b981", evaluation: "#f59e0b", management: "#8b5cf6" };
const DOMAIN_ORDER: Domain[] = ["planning", "execution", "evaluation", "management"];

const SUBJECTS = [
    "الرياضيات", "التربية الإسلامية", "اللغة الإنجليزية", "اللغة العربية",
    "الكيمياء", "الفيزياء", "الأحياء", "العلوم الاجتماعية",
    "الحوسبة وتكنولوجيا المعلومات", "العلوم", "التربية الرياضية", "المهارات الحياتية",
];

function pctColor(p: number) { return p >= 0.8 ? "#10b981" : p >= 0.6 ? "#f59e0b" : "#ef4444"; }

// SVG Radar
function RadarChart({ data, size = 280 }: { data: { label: string; value: number; color: string }[]; size?: number }) {
    if (data.length < 3) return null;
    const cx = size / 2, cy = size / 2;
    const r = size * 0.35;
    const angleFor = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / data.length;
    const point = (i: number, val: number) => {
        const a = angleFor(i);
        const dist = val * r;
        return [cx + Math.cos(a) * dist, cy + Math.sin(a) * dist];
    };
    const polygon = data.map((d, i) => point(i, d.value).join(",")).join(" ");
    return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            {[0.25, 0.5, 0.75, 1].map(level => {
                const pts = data.map((_, i) => {
                    const a = angleFor(i);
                    const dist = level * r;
                    return [cx + Math.cos(a) * dist, cy + Math.sin(a) * dist].join(",");
                }).join(" ");
                return <polygon key={level} points={pts} fill="none" stroke="#e2e8f0" strokeWidth="1"/>;
            })}
            {data.map((_, i) => {
                const [x, y] = point(i, 1);
                return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="#e2e8f0" strokeWidth="1"/>;
            })}
            <polygon points={polygon} fill="#5C152333" stroke="#5C1523" strokeWidth="2"/>
            {data.map((d, i) => {
                const [px, py] = point(i, d.value);
                return <circle key={i} cx={px} cy={py} r="4" fill={d.color} stroke="#fff" strokeWidth="2"/>;
            })}
            {data.map((d, i) => {
                const a = angleFor(i);
                const lx = cx + Math.cos(a) * (r + 24);
                const ly = cy + Math.sin(a) * (r + 24);
                return (
                    <text key={i} x={lx} y={ly} textAnchor="middle" dominantBaseline="middle"
                        fontSize="10" fontWeight="900" fill="#475569">{d.label}</text>
                );
            })}
        </svg>
    );
}

function HBar({ label, value, color, total }: { label: string; value: number; color: string; total?: string }) {
    return (
        <div>
            <div className="flex items-center justify-between mb-1 gap-2">
                <span className="text-[11px] font-bold text-slate-700 truncate flex-1">{label}</span>
                <span className="text-[11px] font-black flex-shrink-0" style={{ color }}>
                    {(value * 100).toFixed(0)}%{total && <span className="text-slate-400 mr-1 font-bold">{total}</span>}
                </span>
            </div>
            <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-700" style={{ width: `${value * 100}%`, background: `linear-gradient(90deg,${color},${color}dd)` }}/>
            </div>
        </div>
    );
}

export default function SupervisionAnalytics() {
    const visits = useQuery(api.supervision.getVisits, {}) as any[] | undefined;
    const criteria = useQuery(api.supervision.getCriteria) as any[] | undefined;
    const [filterRole, setFilterRole] = useState<VisitorRole | "all">("all");
    const [filterSubject, setFilterSubject] = useState<string>("all");
    const [filterTeacher, setFilterTeacher] = useState<string>("all");

    const teachers = useMemo(() => Array.from(new Set((visits ?? []).map(v => v.teacherName))).sort(), [visits]);

    const filtered = useMemo(() => {
        if (!visits) return [];
        return visits.filter(v => v.status === "submitted")
            .filter(v => filterRole === "all" || v.visitorRole === filterRole)
            .filter(v => filterSubject === "all" || v.subjectName === filterSubject)
            .filter(v => filterTeacher === "all" || v.teacherName === filterTeacher);
    }, [visits, filterRole, filterSubject, filterTeacher]);

    if (!visits || !criteria) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-qatar-maroon"/></div>;

    if (filtered.length === 0) {
        return (
            <div dir="rtl" className="bg-white rounded-2xl border border-slate-100 shadow-sm py-16 flex flex-col items-center gap-3">
                <BarChart3 className="w-10 h-10 text-slate-200"/>
                <p className="font-black text-slate-400">لا توجد بيانات للتحليل</p>
                <p className="text-xs text-slate-300 font-bold">يجب إرسال زيارات (ليست مسودات)</p>
            </div>
        );
    }

    // Domain averages overall
    const domainAvgs: Record<Domain, { sum: number; cnt: number }> = {
        planning: { sum: 0, cnt: 0 }, execution: { sum: 0, cnt: 0 },
        evaluation: { sum: 0, cnt: 0 }, management: { sum: 0, cnt: 0 },
    };
    for (const v of filtered) {
        try {
            const d = JSON.parse(v.domainAverages || "{}");
            for (const k of DOMAIN_ORDER) {
                if (typeof d[k] === "number" && d[k] > 0) {
                    domainAvgs[k].sum += d[k]; domainAvgs[k].cnt++;
                }
            }
        } catch {}
    }
    const domainResult = DOMAIN_ORDER.map(d => ({
        domain: d, label: DOMAIN_LABELS[d], color: DOMAIN_COLORS[d],
        value: domainAvgs[d].cnt > 0 ? domainAvgs[d].sum / domainAvgs[d].cnt : 0,
    }));

    // Per-criterion averages
    const critStats: { id: string; text: string; domain: Domain; avg: number; cnt: number }[] = [];
    for (const c of criteria) {
        let sum = 0, cnt = 0;
        for (const v of filtered) {
            try {
                const r = JSON.parse(v.ratings);
                const val = r[c._id];
                if (typeof val === "number" && val >= 0 && val <= 3) { sum += val; cnt++; }
            } catch {}
        }
        critStats.push({ id: c._id, text: c.text, domain: c.domain, avg: cnt > 0 ? sum / cnt / 3 : 0, cnt });
    }
    const topNeeds = [...critStats].filter(c => c.cnt > 0).sort((a, b) => a.avg - b.avg).slice(0, 5);
    const topStrengths = [...critStats].filter(c => c.cnt > 0).sort((a, b) => b.avg - a.avg).slice(0, 5);

    // Per-subject
    const bySubject: Record<string, { sum: number; cnt: number }> = {};
    for (const v of filtered) {
        if (!bySubject[v.subjectName]) bySubject[v.subjectName] = { sum: 0, cnt: 0 };
        bySubject[v.subjectName].sum += v.averageScore;
        bySubject[v.subjectName].cnt++;
    }
    const subjectStats = Object.entries(bySubject).map(([s, { sum, cnt }]) => ({ subject: s, avg: cnt > 0 ? sum / cnt : 0, cnt })).sort((a, b) => b.avg - a.avg);

    // Per role count
    const byRole: Record<VisitorRole, number> = { coordinator: 0, supervisor: 0, deputy: 0 };
    for (const v of filtered) byRole[v.visitorRole as VisitorRole]++;

    // Per teacher (top + bottom)
    const byTeacher: Record<string, { sum: number; cnt: number }> = {};
    for (const v of filtered) {
        if (!byTeacher[v.teacherName]) byTeacher[v.teacherName] = { sum: 0, cnt: 0 };
        byTeacher[v.teacherName].sum += v.averageScore;
        byTeacher[v.teacherName].cnt++;
    }
    const teacherStats = Object.entries(byTeacher).map(([t, { sum, cnt }]) => ({ teacher: t, avg: cnt > 0 ? sum / cnt : 0, cnt })).sort((a, b) => b.avg - a.avg);

    const totalSigned = filtered.filter(v => v.teacherSignedAt).length;
    const overallAvg = filtered.reduce((a, v) => a + v.averageScore, 0) / filtered.length;

    // Score distribution
    const excellent = filtered.filter(v => v.averageScore >= 0.8).length;
    const good = filtered.filter(v => v.averageScore >= 0.6 && v.averageScore < 0.8).length;
    const needsDev = filtered.filter(v => v.averageScore < 0.6).length;

    return (
        <div dir="rtl" className="space-y-5 animate-in fade-in duration-300">
            {/* KPIs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                    { icon: ClipboardCheck, val: filtered.length, label: "زيارة مُقَدَّمة", grad: "from-qatar-maroon to-[#7A1E30]", light: "#5C1523" },
                    { icon: TrendingUp, val: `${(overallAvg * 100).toFixed(0)}%`, label: "المعدل العام", grad: `from-[${pctColor(overallAvg)}] to-[${pctColor(overallAvg)}cc]`, light: pctColor(overallAvg) },
                    { icon: Users, val: teacherStats.length, label: "معلم مُقَيَّم", grad: "from-blue-600 to-blue-500", light: "#2563eb" },
                    { icon: FileSignature, val: totalSigned, label: "موقَّعة من المعلم", grad: "from-emerald-600 to-emerald-500", light: "#059669" },
                ].map(({ icon: Icon, val, label, light }) => (
                    <div key={label} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 hover:shadow-md transition-shadow">
                        <div className="w-8 h-8 rounded-xl flex items-center justify-center mb-2" style={{ background: light + "18" }}>
                            <Icon className="w-4 h-4" style={{ color: light }}/>
                        </div>
                        <p className="text-2xl font-black" style={{ color: light }}>{val}</p>
                        <p className="text-[10px] font-bold text-slate-400 mt-0.5">{label}</p>
                    </div>
                ))}
            </div>

            {/* Score distribution */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                    <span className="text-[10px] font-black text-slate-400">{filtered.length} زيارة</span>
                    <span className="font-black text-slate-700 text-sm flex items-center gap-2"><BarChart3 className="w-3.5 h-3.5 text-slate-400"/>توزيع مستويات الأداء</span>
                </div>
                <div className="p-4">
                    <div className="flex gap-2 mb-3">
                        {[
                            { label: "ممتاز ≥ 80%", cnt: excellent, color: "#10b981" },
                            { label: "جيد 60-79%", cnt: good, color: "#f59e0b" },
                            { label: "يحتاج تطوير < 60%", cnt: needsDev, color: "#ef4444" },
                        ].map(({ label, cnt, color }) => (
                            <div key={label} className="flex-1 rounded-xl p-3 text-center" style={{ background: color + "12" }}>
                                <p className="text-2xl font-black" style={{ color }}>{cnt}</p>
                                <p className="text-[9px] font-black mt-0.5" style={{ color: color + "cc" }}>{label}</p>
                            </div>
                        ))}
                    </div>
                    {/* Stacked bar */}
                    <div className="h-3 rounded-full overflow-hidden flex">
                        {excellent > 0 && <div className="h-full bg-emerald-500 transition-all" style={{ width: `${(excellent/filtered.length)*100}%` }}/>}
                        {good > 0 && <div className="h-full bg-amber-400 transition-all" style={{ width: `${(good/filtered.length)*100}%` }}/>}
                        {needsDev > 0 && <div className="h-full bg-red-400 transition-all" style={{ width: `${(needsDev/filtered.length)*100}%` }}/>}
                    </div>
                    {/* Role breakdown */}
                    <div className="flex gap-2 mt-3 flex-wrap">
                        {(Object.keys(ROLE_LABELS) as VisitorRole[]).map(r => byRole[r] > 0 && (
                            <div key={r} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg" style={{ background: ROLE_COLORS[r] + "12" }}>
                                <span className="w-2 h-2 rounded-full" style={{ background: ROLE_COLORS[r] }}/>
                                <span className="text-[11px] font-black" style={{ color: ROLE_COLORS[r] }}>{ROLE_LABELS[r]}: {byRole[r]}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 space-y-3">
                <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black text-slate-400">{filtered.length} زيارة</span>
                    <span className="text-xs font-black text-slate-600 flex items-center gap-1.5"><Filter className="w-3.5 h-3.5"/>التصفية</span>
                </div>
                <div className="flex flex-wrap gap-2">
                    <button onClick={() => setFilterRole("all")}
                        className={`px-3 py-1.5 rounded-lg text-xs font-black border ${filterRole === "all" ? "bg-qatar-maroon text-white border-transparent" : "bg-white border-slate-200 text-slate-600"}`}>
                        كل الزوار
                    </button>
                    {(Object.keys(ROLE_LABELS) as VisitorRole[]).map(r => (
                        <button key={r} onClick={() => setFilterRole(r)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-black border ${filterRole === r ? "text-white border-transparent" : "bg-white border-slate-200 text-slate-600"}`}
                            style={filterRole === r ? { background: ROLE_COLORS[r] } : {}}>
                            {ROLE_LABELS[r]} ({byRole[r]})
                        </button>
                    ))}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <select value={filterSubject} onChange={e => setFilterSubject(e.target.value)}
                        className="border-2 border-slate-100 rounded-xl px-3 py-2 text-sm font-bold bg-slate-50 focus:outline-none focus:border-qatar-maroon">
                        <option value="all">كل المواد</option>
                        {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <select value={filterTeacher} onChange={e => setFilterTeacher(e.target.value)}
                        className="border-2 border-slate-100 rounded-xl px-3 py-2 text-sm font-bold bg-slate-50 focus:outline-none focus:border-qatar-maroon">
                        <option value="all">كل المعلمين</option>
                        {teachers.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                </div>
            </div>

            {/* Radar */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between" style={{ background: "linear-gradient(135deg,#0f172a,#1e293b)" }}>
                    <span className="bg-white/15 text-white text-[10px] font-black px-2 py-0.5 rounded-full">{filtered.length} زيارة</span>
                    <div className="flex items-center gap-2">
                        <span className="font-black text-white text-sm">رادار المجالات الأربعة</span>
                        <BarChart3 className="w-4 h-4 text-white/60"/>
                    </div>
                </div>
                <div className="p-4 flex flex-col sm:flex-row items-center gap-4">
                    <RadarChart data={domainResult.map(d => ({ label: d.label, value: d.value, color: d.color }))}/>
                    <div className="flex-1 w-full space-y-2">
                        {domainResult.map(d => <HBar key={d.domain} label={d.label} value={d.value} color={d.color}/>)}
                    </div>
                </div>
            </div>

            {/* Subjects ranking */}
            {subjectStats.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                    <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between" style={{ background: "linear-gradient(135deg,#0f172a,#1e293b)" }}>
                        <span className="bg-white/15 text-white text-[10px] font-black px-2 py-0.5 rounded-full">{subjectStats.length} مادة</span>
                        <span className="font-black text-white text-sm">ترتيب المواد حسب الأداء</span>
                    </div>
                    <div className="p-4 space-y-2.5">
                        {subjectStats.map(s => (
                            <HBar key={s.subject} label={s.subject} value={s.avg} color={pctColor(s.avg)} total={` · ${s.cnt} زيارة`}/>
                        ))}
                    </div>
                </div>
            )}

            {/* Top needs (lowest performance) */}
            {topNeeds.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                    <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between" style={{ background: "linear-gradient(135deg,#7c2d12,#5C1523)" }}>
                        <span className="bg-white/15 text-white text-[10px] font-black px-2 py-0.5 rounded-full">5</span>
                        <span className="font-black text-white text-sm">أعلى الاحتياجات (أضعف 5 معايير)</span>
                    </div>
                    <div className="p-4 space-y-2.5">
                        {topNeeds.map(c => (
                            <div key={c.id}>
                                <div className="flex items-center justify-between mb-1 gap-2">
                                    <span className="text-[10px] font-black px-2 py-0.5 rounded text-white" style={{ background: DOMAIN_COLORS[c.domain] }}>
                                        {DOMAIN_LABELS[c.domain]}
                                    </span>
                                    <span className="text-[11px] font-black" style={{ color: pctColor(c.avg) }}>{(c.avg * 100).toFixed(0)}%</span>
                                </div>
                                <p className="text-xs font-bold text-slate-700 leading-relaxed">{c.text}</p>
                                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden mt-1.5">
                                    <div className="h-full" style={{ width: `${c.avg * 100}%`, background: pctColor(c.avg) }}/>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Strengths */}
            {topStrengths.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                    <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between" style={{ background: "linear-gradient(135deg,#065f46,#10b981)" }}>
                        <span className="bg-white/15 text-white text-[10px] font-black px-2 py-0.5 rounded-full">5</span>
                        <span className="font-black text-white text-sm">أعلى نقاط القوة</span>
                    </div>
                    <div className="p-4 space-y-2.5">
                        {topStrengths.map(c => (
                            <div key={c.id}>
                                <div className="flex items-center justify-between mb-1 gap-2">
                                    <span className="text-[10px] font-black px-2 py-0.5 rounded text-white" style={{ background: DOMAIN_COLORS[c.domain] }}>
                                        {DOMAIN_LABELS[c.domain]}
                                    </span>
                                    <span className="text-[11px] font-black text-emerald-600">{(c.avg * 100).toFixed(0)}%</span>
                                </div>
                                <p className="text-xs font-bold text-slate-700 leading-relaxed">{c.text}</p>
                                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden mt-1.5">
                                    <div className="h-full bg-emerald-500" style={{ width: `${c.avg * 100}%` }}/>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Teachers ranking */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between" style={{ background: "linear-gradient(135deg,#0f172a,#1e293b)" }}>
                    <span className="bg-white/15 text-white text-[10px] font-black px-2 py-0.5 rounded-full">{teacherStats.length}</span>
                    <span className="font-black text-white text-sm">ترتيب المعلمين حسب الأداء</span>
                </div>
                <div className="divide-y divide-slate-50 max-h-[500px] overflow-y-auto">
                    {teacherStats.map((t, idx) => {
                        const color = pctColor(t.avg);
                        return (
                            <div key={t.teacher} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors">
                                <span className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black text-white flex-shrink-0"
                                    style={{ background: idx === 0 ? "#f59e0b" : idx === 1 ? "#94a3b8" : idx === 2 ? "#d97706" : "#e2e8f0", color: idx < 3 ? "white" : "#94a3b8" }}>
                                    {idx + 1}
                                </span>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-black text-slate-700 truncate">{t.teacher}</p>
                                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden mt-1">
                                        <div className="h-full rounded-full transition-all" style={{ width: `${t.avg * 100}%`, background: color }}/>
                                    </div>
                                </div>
                                <div className="text-center flex-shrink-0">
                                    <span className="text-base font-black" style={{ color }}>{(t.avg * 100).toFixed(0)}%</span>
                                    <p className="text-[9px] font-bold text-slate-400">{t.cnt} زيارة</p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
