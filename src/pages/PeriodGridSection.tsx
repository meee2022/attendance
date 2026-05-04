import { useState, useMemo, useEffect } from "react";
import { useQuery } from "convex/react";
import { Hash, Layers, ClipboardList, CheckCircle2, Clock } from "lucide-react";
// @ts-ignore
import { api } from "../../convex/_generated/api";
import ClassPeriodGrid from "./ClassPeriodGrid";

const GRADE_LABELS: Record<number, string> = {
    10: "الصف العاشر",
    11: "الصف الحادي عشر",
    12: "الصف الثاني عشر",
};
const GRADE_SHORT: Record<number, string> = { 10: "عاشر", 11: "حادي عشر", 12: "ثاني عشر" };

const TRACK_COLORS: Record<string, { active: string; badge: string }> = {
    "علمي":     { active: "bg-blue-600 text-white",    badge: "bg-blue-100 text-blue-800 border-blue-200" },
    "أدبي":     { active: "bg-amber-500 text-white",   badge: "bg-amber-100 text-amber-800 border-amber-200" },
    "تكنولوجي": { active: "bg-purple-600 text-white",  badge: "bg-purple-100 text-purple-800 border-purple-200" },
    "عام":      { active: "bg-qatar-maroon text-white", badge: "bg-rose-100 text-qatar-maroon border-rose-200" },
};

function getTrack(track: string | undefined) {
    return TRACK_COLORS[track || "عام"] || TRACK_COLORS["عام"];
}

interface PeriodGridSectionProps {
    date: string;
    focusClassId?: string | null;
    highlightPeriod?: number | null;
    highlightSubjectName?: string | null;
}

export default function PeriodGridSection({ date, focusClassId, highlightPeriod, highlightSubjectName }: PeriodGridSectionProps) {
    const [selectedGrade, setSelectedGrade] = useState<number>(10);
    const [selectedClassId, setSelectedClassId] = useState<string | null>(null);

    const initData = useQuery(api.setup.getInitialData);
    const schoolId = initData?.schools?.[0]?._id || null;
    const periodsPerDay: number = initData?.schools?.[0]?.periodsPerDay ?? 5;

    // Per-class period counts for today
    const periodCounts = useQuery(
        api.attendance.getPeriodCountsByDate,
        schoolId ? { schoolId, date } : "skip"
    ) as Record<string, number> | undefined;

    // Auto-focus the class selected in the upload form
    useEffect(() => {
        if (!focusClassId || !initData?.classes) return;
        const cls = initData.classes.find((c: any) => c._id === focusClassId);
        if (cls) {
            setSelectedGrade(cls.grade);
            setSelectedClassId(cls._id);
        }
    }, [focusClassId, initData]);

    const gradeClasses = useMemo(() => {
        if (!initData?.classes) return [];
        return initData.classes
            .filter((c: any) => c.grade === selectedGrade && c.isActive)
            .sort((a: any, b: any) => {
                const na = parseInt(a.name.split("-")[1] || "0", 10);
                const nb = parseInt(b.name.split("-")[1] || "0", 10);
                return na - nb;
            });
    }, [initData, selectedGrade]);

    const trackGroups = useMemo(() => {
        const groups: Record<string, any[]> = {};
        for (const cls of gradeClasses) {
            const track = cls.track || "عام";
            if (!groups[track]) groups[track] = [];
            groups[track].push(cls);
        }
        return groups;
    }, [gradeClasses]);

    const trackOrder = useMemo(() => Object.keys(trackGroups), [trackGroups]);

    const activeClassId = useMemo(() => {
        if (selectedClassId && gradeClasses.some((c: any) => c._id === selectedClassId)) return selectedClassId;
        return gradeClasses.length > 0 ? gradeClasses[0]._id : null;
    }, [gradeClasses, selectedClassId]);

    const activeClass = useMemo(
        () => gradeClasses.find((c: any) => c._id === activeClassId),
        [gradeClasses, activeClassId]
    );

    // Summary: how many classes of this grade have at least one period recorded
    const gradeSummary = useMemo(() => {
        if (!periodCounts) return null;
        let classesWithData = 0;
        let totalPeriods = 0;
        for (const cls of gradeClasses) {
            const count = periodCounts[cls._id] || 0;
            if (count > 0) { classesWithData++; totalPeriods += count; }
        }
        return { classesWithData, totalPeriods, totalClasses: gradeClasses.length };
    }, [periodCounts, gradeClasses]);

    return (
        <div className="space-y-0 mt-10">
            {/* ── Section Header ── */}
            <div className="bg-qatar-maroon rounded-t-2xl px-8 py-5 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                        <ClipboardList className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h2 className="text-white font-black text-lg leading-tight">متابعة غياب الحصص</h2>
                        <p className="text-white/60 text-xs font-bold">استعراض سريع لحالة جميع فصول المدرسة لهذا اليوم</p>
                    </div>
                </div>

                {/* Grade Toggle Buttons */}
                <div className="flex gap-2">
                    {([10, 11, 12] as const).map(g => (
                        <button
                            key={g}
                            onClick={() => { setSelectedGrade(g); setSelectedClassId(null); }}
                            className={`px-4 py-2 rounded-xl font-black text-sm transition-all border ${
                                selectedGrade === g
                                    ? "bg-white text-qatar-maroon border-white shadow"
                                    : "bg-white/10 text-white border-white/20 hover:bg-white/20"
                            }`}
                        >
                            {GRADE_SHORT[g]}
                        </button>
                    ))}
                </div>
            </div>

            {/* ── Status Bar ── */}
            <div className="bg-slate-800 px-8 py-3 flex flex-wrap items-center gap-6">
                <div className="flex items-center gap-2 text-slate-300">
                    <Hash className="w-4 h-4 text-slate-500" />
                    <span className="text-xs font-bold text-slate-400">عدد الحصص في اليوم:</span>
                    <span className="font-black text-white bg-slate-700 px-2 py-0.5 rounded-lg">{periodsPerDay}</span>
                </div>
                {activeClass && (
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-400 font-bold">الصف المحدد:</span>
                        <span className="font-black text-white">{activeClass.name}</span>
                        {activeClass.track && (
                            <span className={`text-[11px] font-black px-2 py-0.5 rounded-full border ${getTrack(activeClass.track).badge}`}>
                                {activeClass.track}
                            </span>
                        )}
                    </div>
                )}
                {/* Grade summary notification */}
                {gradeSummary && gradeSummary.totalClasses > 0 && (
                    <div className="mr-auto flex items-center gap-2">
                        {gradeSummary.classesWithData > 0 ? (
                            <div className="flex items-center gap-2 bg-emerald-900/40 border border-emerald-700/40 px-3 py-1.5 rounded-xl">
                                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                                <span className="text-xs text-emerald-300 font-black">
                                    {gradeSummary.classesWithData} / {gradeSummary.totalClasses} صف سُجِّل فيه بيانات اليوم
                                    <span className="text-emerald-500 mr-1">({gradeSummary.totalPeriods} حصة إجمالاً)</span>
                                </span>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 bg-slate-700/50 border border-slate-600 px-3 py-1.5 rounded-xl">
                                <Clock className="w-4 h-4 text-slate-400 flex-shrink-0" />
                                <span className="text-xs text-slate-400 font-bold">لم يُسجَّل أي بيانات لهذا الصف اليوم</span>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* ── Class Tabs ── */}
            <div className="bg-white border-x border-b border-slate-200 px-6 py-4 space-y-3 overflow-x-auto">
                {gradeClasses.length === 0 ? (
                    <p className="text-slate-400 font-bold text-sm text-center py-4">لا توجد صفوف لهذه المرحلة</p>
                ) : trackOrder.map((track) => (
                    <div key={track} className="flex flex-wrap items-center gap-2">
                        {/* Track label */}
                        <span className={`text-[11px] font-black px-3 py-1.5 rounded-lg border whitespace-nowrap ${getTrack(track).badge}`}>
                            {track}
                        </span>
                        {/* Class buttons */}
                        {trackGroups[track].map((cls: any) => {
                            const isActive = cls._id === activeClassId;
                            const recordedCount = periodCounts?.[cls._id] || 0;
                            const isDone = recordedCount >= periodsPerDay;
                            return (
                                <button
                                    key={cls._id}
                                    onClick={() => setSelectedClassId(cls._id)}
                                    className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-sm transition-all whitespace-nowrap border ${
                                        isActive
                                            ? getTrack(track).active + " border-transparent shadow-md scale-105"
                                            : isDone
                                                ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                                                : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                                    }`}
                                >
                                    {cls.name}
                                    {recordedCount > 0 && (
                                        <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full min-w-[20px] text-center ${
                                            isActive
                                                ? "bg-white/25 text-white"
                                                : isDone
                                                    ? "bg-emerald-200 text-emerald-800"
                                                    : "bg-slate-200 text-slate-600"
                                        }`}>
                                            {recordedCount}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                ))}
            </div>

            {/* ── Per-class period summary pills ── */}
            {periodCounts && gradeClasses.some((c: any) => (periodCounts[c._id] || 0) > 0) && (
                <div className="bg-slate-50 border-x border-b border-slate-200 px-6 py-4">
                    <p className="text-[11px] font-black text-slate-400 uppercase tracking-wider mb-3">حالة الحصص المسجلة لكل صف اليوم</p>
                    <div className="flex flex-wrap gap-3">
                        {gradeClasses.map((cls: any) => {
                            const count = periodCounts[cls._id] || 0;
                            const pct = Math.round((count / periodsPerDay) * 100);
                            return (
                                <div
                                    key={cls._id}
                                    onClick={() => setSelectedClassId(cls._id)}
                                    className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border cursor-pointer transition-all hover:scale-105 ${
                                        count === 0
                                            ? "bg-white border-slate-200 text-slate-400"
                                            : count >= periodsPerDay
                                                ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                                                : "bg-amber-50 border-amber-200 text-amber-800"
                                    }`}
                                >
                                    <span className="font-black text-sm">{cls.name}</span>
                                    <div className="flex flex-col gap-1 min-w-[60px]">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px] font-black">{count}/{periodsPerDay}</span>
                                            <span className="text-[10px] font-bold opacity-70">{pct}%</span>
                                        </div>
                                        <div className="w-full h-1.5 bg-black/10 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full rounded-full transition-all ${count >= periodsPerDay ? 'bg-emerald-500' : count > 0 ? 'bg-amber-500' : 'bg-slate-300'}`}
                                                style={{ width: `${Math.min(pct, 100)}%` }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* ── Period Grid ── */}
            {activeClassId && schoolId && (
                <div className="bg-white border-x border-b border-slate-200 rounded-b-2xl p-6 shadow-sm">
                    <ClassPeriodGrid
                        classId={activeClassId}
                        schoolId={schoolId}
                        date={date}
                        periodsPerDay={periodsPerDay}
                        highlightPeriod={highlightPeriod}
                        highlightSubjectName={highlightSubjectName}
                    />
                </div>
            )}
        </div>
    );
}
