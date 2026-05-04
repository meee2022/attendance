import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
// @ts-ignore
import { api } from "../../convex/_generated/api";
import { TrendingUp, GitCompare, Grid3x3, ChevronLeft, ChevronRight } from "lucide-react";

type VisitorRole = "coordinator" | "supervisor" | "deputy";
type Domain = "planning" | "execution" | "evaluation" | "management";

const ROLE_LABELS: Record<VisitorRole, string> = { coordinator: "المنسق", supervisor: "الموجه", deputy: "النائب الأكاديمي" };
const ROLE_COLORS: Record<VisitorRole, string> = { coordinator: "#5C1A1B", supervisor: "#1e40af", deputy: "#065f46" };
const DOMAIN_LABELS: Record<Domain, string> = { planning: "التخطيط", execution: "تنفيذ الدرس", evaluation: "التقويم", management: "الإدارة الصفية" };
const DOMAIN_COLORS: Record<Domain, string> = { planning: "#3b82f6", execution: "#10b981", evaluation: "#f59e0b", management: "#8b5cf6" };

function pctColor(p: number) { return p >= 0.8 ? "#10b981" : p >= 0.6 ? "#3b82f6" : p >= 0.4 ? "#f59e0b" : "#ef4444"; }

// Heatmap cell color based on value 0..1
function heatColor(v: number, hasData: boolean) {
    if (!hasData) return "#f1f5f9";
    if (v >= 0.83) return "#10b981";  // 3
    if (v >= 0.66) return "#3b82f6";  // 2-3
    if (v >= 0.5) return "#f59e0b";   // 2
    if (v >= 0.33) return "#fb923c";  // 1-2
    if (v >= 0.16) return "#ef4444";  // 1
    return "#7f1d1d";                  // 0
}

export default function SupervisionAdvancedAnalytics() {
    const [view, setView] = useState<"heatmap" | "trend" | "comparison">("heatmap");
    const [selectedTeacher, setSelectedTeacher] = useState<string>("");
    const visits = useQuery(api.supervision.getVisits, {}) as any[] | undefined;
    const criteria = useQuery(api.supervision.getCriteria) as any[] | undefined;

    const teachers = useMemo(() =>
        Array.from(new Set((visits ?? []).filter(v => v.status === "submitted").map(v => v.teacherName))).sort(),
        [visits]);

    if (!visits || !criteria) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-qatar-maroon"/></div>;

    return (
        <div dir="rtl" className="space-y-4">
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-3">
                <div className="flex gap-2 flex-wrap">
                    <button onClick={() => setView("heatmap")}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-black transition-all ${view === "heatmap" ? "bg-qatar-maroon text-white shadow" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
                        <Grid3x3 className="w-3.5 h-3.5"/>الخريطة الحرارية
                    </button>
                    <button onClick={() => setView("trend")}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-black transition-all ${view === "trend" ? "bg-qatar-maroon text-white shadow" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
                        <TrendingUp className="w-3.5 h-3.5"/>تطور المعلم
                    </button>
                    <button onClick={() => setView("comparison")}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-black transition-all ${view === "comparison" ? "bg-qatar-maroon text-white shadow" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
                        <GitCompare className="w-3.5 h-3.5"/>مقارنة الزائرين
                    </button>
                </div>
            </div>

            {view === "heatmap" && <HeatmapView visits={visits.filter(v => v.status === "submitted")} criteria={criteria}/>}
            {view === "trend" && <TrendView visits={visits.filter(v => v.status === "submitted")} teachers={teachers} selected={selectedTeacher} onSelect={setSelectedTeacher}/>}
            {view === "comparison" && <ComparisonView visits={visits.filter(v => v.status === "submitted")} teachers={teachers} selected={selectedTeacher} onSelect={setSelectedTeacher}/>}
        </div>
    );
}

// ── Heatmap: Teachers × Criteria ──────────────────────────────────────────
function HeatmapView({ visits, criteria }: { visits: any[]; criteria: any[] }) {
    const teachers = useMemo(() => Array.from(new Set(visits.map(v => v.teacherName))).sort(), [visits]);
    const sortedCriteria = useMemo(() => {
        const order = { planning: 0, execution: 1, evaluation: 2, management: 3 };
        return [...criteria].sort((a, b) => (order[a.domain as keyof typeof order] - order[b.domain as keyof typeof order]) || a.order - b.order);
    }, [criteria]);

    // Compute teacher × criterion matrix
    const matrix = useMemo(() => {
        const m: Record<string, Record<string, { sum: number; cnt: number }>> = {};
        for (const t of teachers) {
            m[t] = {};
            for (const c of sortedCriteria) m[t][c._id] = { sum: 0, cnt: 0 };
        }
        for (const v of visits) {
            try {
                const r = JSON.parse(v.ratings);
                for (const c of sortedCriteria) {
                    const val = r[c._id];
                    if (typeof val === "number" && val >= 0 && val <= 3) {
                        if (!m[v.teacherName]) continue;
                        m[v.teacherName][c._id].sum += val;
                        m[v.teacherName][c._id].cnt++;
                    }
                }
            } catch {}
        }
        return m;
    }, [visits, teachers, sortedCriteria]);

    if (teachers.length === 0) {
        return <div className="bg-white rounded-2xl border border-slate-100 p-10 text-center text-slate-400 font-bold">لا توجد بيانات</div>;
    }

    return (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between" style={{ background: "linear-gradient(135deg,#0f172a,#1e293b)" }}>
                <div className="flex items-center gap-2 text-[10px] font-black text-white/80 flex-wrap">
                    {[
                        { c: "#10b981", l: "مستكملة" },
                        { c: "#3b82f6", l: "معظم" },
                        { c: "#f59e0b", l: "بعض" },
                        { c: "#ef4444", l: "محدودة" },
                        { c: "#f1f5f9", l: "—", textColor: "#64748b" },
                    ].map((x, i) => (
                        <span key={i} className="flex items-center gap-1">
                            <span className="w-3 h-3 rounded" style={{ background: x.c }}/>
                            <span style={x.textColor ? { color: x.textColor } : {}}>{x.l}</span>
                        </span>
                    ))}
                </div>
                <span className="font-black text-white text-sm">الخريطة الحرارية: المعلمون × المعايير</span>
            </div>
            <div className="overflow-auto max-h-[70vh]">
                <table dir="rtl" className="w-full border-collapse text-[10px]">
                    <thead className="sticky top-0 bg-slate-50 z-10">
                        <tr>
                            <th className="sticky right-0 bg-slate-50 px-2 py-2 text-right font-black text-slate-600 border-l border-slate-200 min-w-[180px]">المعلم</th>
                            {sortedCriteria.map((c, i) => (
                                <th key={c._id} className="px-1 py-2 font-black text-center border-l border-slate-100 min-w-[28px]"
                                    style={{ color: DOMAIN_COLORS[c.domain as Domain] }}
                                    title={c.text}>
                                    {i + 1}
                                </th>
                            ))}
                            <th className="px-2 py-2 font-black text-center text-qatar-maroon">المعدل</th>
                        </tr>
                    </thead>
                    <tbody>
                        {teachers.map(t => {
                            let totalSum = 0, totalCnt = 0;
                            const cells = sortedCriteria.map(c => {
                                const cell = matrix[t]?.[c._id];
                                if (!cell || cell.cnt === 0) return { val: 0, hasData: false };
                                const val = cell.sum / cell.cnt / 3;
                                totalSum += cell.sum;
                                totalCnt += cell.cnt;
                                return { val, hasData: true };
                            });
                            const teacherAvg = totalCnt > 0 ? totalSum / totalCnt / 3 : 0;
                            return (
                                <tr key={t} className="border-t border-slate-100 hover:bg-slate-50">
                                    <td className="sticky right-0 bg-white px-2 py-1.5 text-right font-bold text-slate-700 border-l border-slate-200 truncate max-w-[180px]">{t}</td>
                                    {cells.map((cell, i) => (
                                        <td key={i} className="border-l border-slate-50 p-0">
                                            <div className="w-full h-7" style={{ background: heatColor(cell.val, cell.hasData) }} title={cell.hasData ? `${(cell.val * 100).toFixed(0)}%` : "بدون بيانات"}/>
                                        </td>
                                    ))}
                                    <td className="px-2 py-1.5 text-center font-black border-l border-slate-100" style={{ color: pctColor(teacherAvg) }}>
                                        {totalCnt > 0 ? `${(teacherAvg * 100).toFixed(0)}%` : "—"}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
            <div className="bg-slate-50 px-3 py-2 border-t border-slate-100">
                <p className="text-[10px] font-bold text-slate-500">مرّر فوق الرقم لرؤية نص المعيار · {teachers.length} معلم · {sortedCriteria.length} معيار</p>
            </div>
        </div>
    );
}

// ── Trend: same teacher over visits ───────────────────────────────────────
function TrendView({ visits, teachers, selected, onSelect }: { visits: any[]; teachers: string[]; selected: string; onSelect: (n: string) => void }) {
    const teacherVisits = useMemo(() =>
        visits.filter(v => v.teacherName === selected).sort((a, b) => new Date(a.visitDate).getTime() - new Date(b.visitDate).getTime()),
        [visits, selected]);

    if (!selected) {
        return (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
                <p className="text-xs font-black text-slate-500 mb-3">اختر معلماً لعرض تطور أدائه</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-96 overflow-y-auto">
                    {teachers.map(t => (
                        <button key={t} onClick={() => onSelect(t)}
                            className="text-right px-3 py-2 rounded-lg bg-slate-50 hover:bg-qatar-maroon hover:text-white text-xs font-bold text-slate-700 transition-colors">
                            {t}
                        </button>
                    ))}
                </div>
            </div>
        );
    }

    const w = 600, h = 260, padX = 40, padY = 30;
    const points = teacherVisits.map((v, i) => ({
        x: padX + (i / Math.max(1, teacherVisits.length - 1)) * (w - 2 * padX),
        y: h - padY - v.averageScore * (h - 2 * padY),
        score: v.averageScore,
        date: v.visitDate,
        role: v.visitorRole,
    }));
    const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");

    return (
        <div className="space-y-4">
            <div className="bg-qatar-maroon rounded-2xl px-5 py-3 flex items-center justify-between">
                <button onClick={() => onSelect("")}
                    className="text-white/80 hover:text-white text-sm font-black flex items-center gap-1">
                    <ChevronRight className="w-4 h-4"/>قائمة المعلمين
                </button>
                <p className="font-black text-white text-base">{selected}</p>
            </div>
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b border-slate-100 bg-slate-50">
                    <span className="font-black text-slate-700 text-sm">تطور المعدل العام عبر {teacherVisits.length} زيارة</span>
                </div>
                <div className="p-4 overflow-x-auto">
                    {teacherVisits.length === 0 ? (
                        <p className="text-center py-10 text-slate-400 font-bold">لا توجد زيارات</p>
                    ) : (
                        <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ minWidth: w }}>
                            {/* Y-axis grid */}
                            {[0, 0.25, 0.5, 0.75, 1].map(v => {
                                const y = h - padY - v * (h - 2 * padY);
                                return (
                                    <g key={v}>
                                        <line x1={padX} y1={y} x2={w - padX} y2={y} stroke="#e2e8f0" strokeDasharray="3,3"/>
                                        <text x={padX - 5} y={y + 3} textAnchor="end" fontSize="9" fill="#94a3b8">{(v * 100).toFixed(0)}%</text>
                                    </g>
                                );
                            })}
                            {/* Line */}
                            <path d={pathD} fill="none" stroke="#5C1A1B" strokeWidth="2.5"/>
                            {/* Points */}
                            {points.map((p, i) => (
                                <g key={i}>
                                    <circle cx={p.x} cy={p.y} r="6" fill={ROLE_COLORS[p.role as VisitorRole]} stroke="white" strokeWidth="2"/>
                                    <text x={p.x} y={p.y - 12} textAnchor="middle" fontSize="9" fontWeight="900" fill="#1e293b">
                                        {(p.score * 100).toFixed(0)}%
                                    </text>
                                    <text x={p.x} y={h - 8} textAnchor="middle" fontSize="8" fill="#64748b">
                                        {p.date.slice(5)}
                                    </text>
                                </g>
                            ))}
                        </svg>
                    )}
                </div>
                <div className="px-4 pb-3 flex items-center gap-3 text-[10px] font-bold flex-wrap">
                    {(Object.keys(ROLE_LABELS) as VisitorRole[]).map(r => (
                        <span key={r} className="flex items-center gap-1">
                            <span className="w-2.5 h-2.5 rounded-full" style={{ background: ROLE_COLORS[r] }}/>
                            {ROLE_LABELS[r]}
                        </span>
                    ))}
                </div>
            </div>

            {/* Per-domain trend */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b border-slate-100 bg-slate-50">
                    <span className="font-black text-slate-700 text-sm">تطور كل مجال على حدة</span>
                </div>
                <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {(Object.keys(DOMAIN_LABELS) as Domain[]).map(d => {
                        const dPoints = teacherVisits.map(v => {
                            try { return JSON.parse(v.domainAverages || "{}")[d] || 0; } catch { return 0; }
                        });
                        const maxLine = 100;
                        const dPathW = 280, dPathH = 60, dPadX = 5;
                        const linePts = dPoints.map((val, i) => ({
                            x: dPadX + (i / Math.max(1, dPoints.length - 1)) * (dPathW - 2 * dPadX),
                            y: dPathH - val * (dPathH - 10),
                        }));
                        const path = linePts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
                        const last = dPoints[dPoints.length - 1] || 0;
                        return (
                            <div key={d} className="rounded-xl p-3" style={{ background: `${DOMAIN_COLORS[d]}0a`, border: `1px solid ${DOMAIN_COLORS[d]}30` }}>
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-base font-black" style={{ color: DOMAIN_COLORS[d] }}>{(last * 100).toFixed(0)}%</span>
                                    <span className="text-xs font-black" style={{ color: DOMAIN_COLORS[d] }}>{DOMAIN_LABELS[d]}</span>
                                </div>
                                <svg viewBox={`0 0 ${dPathW} ${dPathH}`} className="w-full h-12">
                                    <path d={path} fill="none" stroke={DOMAIN_COLORS[d]} strokeWidth="2"/>
                                    {linePts.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="2.5" fill={DOMAIN_COLORS[d]}/>)}
                                </svg>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

// ── Comparison: same teacher, 3 visitor roles ─────────────────────────────
function ComparisonView({ visits, teachers, selected, onSelect }: { visits: any[]; teachers: string[]; selected: string; onSelect: (n: string) => void }) {
    if (!selected) {
        return (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
                <p className="text-xs font-black text-slate-500 mb-3">اختر معلماً لمقارنة رؤية الزائرين الثلاثة</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-96 overflow-y-auto">
                    {teachers.map(t => (
                        <button key={t} onClick={() => onSelect(t)}
                            className="text-right px-3 py-2 rounded-lg bg-slate-50 hover:bg-qatar-maroon hover:text-white text-xs font-bold text-slate-700 transition-colors">
                            {t}
                        </button>
                    ))}
                </div>
            </div>
        );
    }

    const teacherVisits = visits.filter(v => v.teacherName === selected);
    const byRole: Record<VisitorRole, any[]> = { coordinator: [], supervisor: [], deputy: [] };
    for (const v of teacherVisits) byRole[v.visitorRole as VisitorRole].push(v);

    const roleStats: Record<VisitorRole, { overall: number; planning: number; execution: number; evaluation: number; management: number; cnt: number }> = {
        coordinator: { overall: 0, planning: 0, execution: 0, evaluation: 0, management: 0, cnt: 0 },
        supervisor:  { overall: 0, planning: 0, execution: 0, evaluation: 0, management: 0, cnt: 0 },
        deputy:      { overall: 0, planning: 0, execution: 0, evaluation: 0, management: 0, cnt: 0 },
    };
    for (const r of Object.keys(byRole) as VisitorRole[]) {
        const list = byRole[r];
        if (list.length === 0) continue;
        roleStats[r].cnt = list.length;
        for (const v of list) {
            try {
                const d = JSON.parse(v.domainAverages || "{}");
                roleStats[r].planning += d.planning || 0;
                roleStats[r].execution += d.execution || 0;
                roleStats[r].evaluation += d.evaluation || 0;
                roleStats[r].management += d.management || 0;
                roleStats[r].overall += v.averageScore || 0;
            } catch {}
        }
        roleStats[r].planning /= list.length;
        roleStats[r].execution /= list.length;
        roleStats[r].evaluation /= list.length;
        roleStats[r].management /= list.length;
        roleStats[r].overall /= list.length;
    }

    return (
        <div className="space-y-4">
            <div className="bg-qatar-maroon rounded-2xl px-5 py-3 flex items-center justify-between">
                <button onClick={() => onSelect("")}
                    className="text-white/80 hover:text-white text-sm font-black flex items-center gap-1">
                    <ChevronRight className="w-4 h-4"/>قائمة المعلمين
                </button>
                <p className="font-black text-white text-base">{selected}</p>
            </div>

            {/* Per-role overall card */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {(Object.keys(ROLE_LABELS) as VisitorRole[]).map(r => (
                    <div key={r} className="rounded-2xl p-4" style={{ background: `${ROLE_COLORS[r]}0a`, border: `2px solid ${ROLE_COLORS[r]}30` }}>
                        <p className="text-[11px] font-black mb-1" style={{ color: ROLE_COLORS[r] }}>{ROLE_LABELS[r]}</p>
                        <p className="text-3xl font-black" style={{ color: ROLE_COLORS[r] }}>
                            {roleStats[r].cnt > 0 ? `${(roleStats[r].overall * 100).toFixed(0)}%` : "—"}
                        </p>
                        <p className="text-[10px] font-bold text-slate-400">{roleStats[r].cnt} زيارة</p>
                    </div>
                ))}
            </div>

            {/* Per-domain comparison */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b border-slate-100" style={{ background: "linear-gradient(135deg,#0f172a,#1e293b)" }}>
                    <span className="font-black text-white text-sm">مقارنة الأداء حسب المجال</span>
                </div>
                <div className="p-4 space-y-4">
                    {(Object.keys(DOMAIN_LABELS) as Domain[]).map(d => (
                        <div key={d}>
                            <p className="text-xs font-black mb-2" style={{ color: DOMAIN_COLORS[d] }}>{DOMAIN_LABELS[d]}</p>
                            <div className="space-y-1.5">
                                {(Object.keys(ROLE_LABELS) as VisitorRole[]).map(r => {
                                    const v = roleStats[r][d];
                                    if (roleStats[r].cnt === 0) return (
                                        <div key={r} className="flex items-center gap-2 text-[10px]">
                                            <span className="w-16 font-bold text-slate-500">{ROLE_LABELS[r]}</span>
                                            <span className="text-slate-300 font-bold">— لا توجد زيارة</span>
                                        </div>
                                    );
                                    return (
                                        <div key={r} className="flex items-center gap-2">
                                            <span className="w-20 text-[10px] font-black" style={{ color: ROLE_COLORS[r] }}>{ROLE_LABELS[r]}</span>
                                            <div className="flex-1 h-5 bg-slate-100 rounded-full overflow-hidden relative">
                                                <div className="h-full rounded-full transition-all duration-500"
                                                    style={{ width: `${v * 100}%`, background: ROLE_COLORS[r] }}/>
                                                <span className="absolute inset-0 flex items-center justify-center text-[9px] font-black text-white drop-shadow">
                                                    {(v * 100).toFixed(0)}%
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
