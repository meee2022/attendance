import React, { useState, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { CheckCircle2, Layers, XCircle, BarChart3, Users, BookOpen, Filter, EyeOff } from "lucide-react";
// @ts-ignore
import { api } from "../../convex/_generated/api";
import StatCard from "../components/StatCard";

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

export default function AssessmentsPage() {
    const initialData = useQuery(api.setup.getInitialData);
    const [selectedGrade, setSelectedGrade] = useState<number>(10);
    const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
    const [hideCompleted, setHideCompleted] = useState(false);

    const schoolId = initialData?.schools?.[0]?._id;
    
    // We pass undefined if class is not selected to prevent errors, but we typically wait.
    const classAssessments = useQuery(api.assessments.getClassAssessments, 
        (schoolId && selectedClassId) ? { schoolId, classId: selectedClassId as any } : "skip" as any
    );

    const toggleAssessment = useMutation(api.assessments.toggleAssessment);
    const toggleSubjectForAll = useMutation(api.assessments.toggleSubjectForAll);

    const handleToggleAll = async (subjectId: string, isCompleted: boolean) => {
        if (!schoolId || !selectedClassId) return;
        try {
            await toggleSubjectForAll({
                schoolId,
                classId: selectedClassId as any,
                subjectId: subjectId as any,
                isCompleted,
            });
        } catch (e) {
            console.error("Failed to toggle all", e);
        }
    };

    const handleToggle = async (studentId: string, subjectId: string) => {
        if (!schoolId || !selectedClassId) return;
        try {
            await toggleAssessment({
                schoolId,
                classId: selectedClassId as any,
                studentId: studentId as any,
                subjectId: subjectId as any,
            });
        } catch (e) {
            console.error("Failed to toggle assessment", e);
        }
    };

    const gradeClasses = useMemo(() => {
        if (!initialData?.classes) return [];
        return initialData.classes
            .filter((c: any) => c.grade === selectedGrade && c.isActive)
            .sort((a: any, b: any) => {
                const na = parseInt(a.name.split("-")[1] || "0", 10);
                const nb = parseInt(b.name.split("-")[1] || "0", 10);
                return na - nb;
            });
    }, [initialData, selectedGrade]);

    const trackGroups = useMemo(() => {
        const groups: Record<string, any[]> = {};
        for (const cls of gradeClasses) {
            const track = cls.track || "عام";
            if (!groups[track]) groups[track] = [];
            groups[track].push(cls);
        }
        return groups;
    }, [gradeClasses]);

    const trackOrder = Object.keys(trackGroups);

    if (!initialData) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-qatar-maroon"></div>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto space-y-8 font-sans transition-all animate-in fade-in duration-500 pb-20 mt-4">
            {/* Header */}
            <div className="rounded-2xl overflow-hidden qatar-card-shadow"
                 style={{ background: "linear-gradient(135deg, #9B1239 0%, #C0184C 50%, #9B1239 100%)" }}>
                <div className="flex flex-col gap-1 p-5 sm:p-8">
                    <h1 className="text-3xl font-black text-white flex items-center gap-3">
                        <BookOpen className="w-8 h-8 text-white/80" />
                        رصد التطبيقات (التقييمات)
                    </h1>
                    <p className="text-white/70 font-medium mr-11">متابعة حل الطلاب للتطبيقات في جميع المواد الدراسية</p>
                </div>
            </div>

            {/* Class Selector Options */}
            <div className="bg-white rounded-2xl qatar-card-shadow border border-qatar-gray-border overflow-hidden">
                <div className="bg-qatar-maroon px-8 py-5 flex flex-wrap items-center justify-between gap-4">
                    <h2 className="text-xl font-black text-white flex items-center gap-3">
                        <Layers className="w-6 h-6 text-white/50" />
                        اختيار الصف
                    </h2>
                    {/* Grade Toggle Buttons */}
                    <div className="flex gap-2">
                        {([10, 11] as const).map(g => (
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
                
                {/* Class Tabs */}
                <div className="px-6 py-6 space-y-4">
                    {gradeClasses.length === 0 ? (
                        <p className="text-slate-400 font-bold text-sm text-center py-4">لا توجد صفوف لهذه المرحلة</p>
                    ) : trackOrder.map((track) => (
                        <div key={track} className="flex flex-wrap items-center gap-3">
                            {/* Track label */}
                            <span className={`text-xs font-black px-4 py-2 rounded-lg border whitespace-nowrap ${getTrack(track).badge}`}>
                                {track}
                            </span>
                            {/* Class buttons */}
                            {trackGroups[track].map((cls: any) => {
                                const isActive = cls._id === selectedClassId;
                                return (
                                    <button
                                        key={cls._id}
                                        onClick={() => setSelectedClassId(cls._id)}
                                        className={`relative flex items-center gap-1.5 px-6 py-2.5 rounded-xl font-black text-sm transition-all whitespace-nowrap border ${
                                            isActive
                                                ? getTrack(track).active + " border-transparent shadow-md scale-105"
                                                : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 hover:text-qatar-maroon"
                                        }`}
                                    >
                                        {cls.name}
                                    </button>
                                );
                            })}
                        </div>
                    ))}
                </div>
            </div>

            {/* Stats Cards */}
            {selectedClassId && classAssessments && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 animate-in slide-in-from-bottom-4 duration-500">
                    <StatCard
                        label="إجمالي الطلاب"
                        value={classAssessments.summary.totalStudents}
                        icon={<Users className="w-6 h-6" />}
                        color="blue"
                    />
                    <StatCard
                        label="التطبيقات المنجزة كلياً"
                        value={classAssessments.summary.totalCompletedAssessments}
                        icon={<CheckCircle2 className="w-6 h-6" />}
                        color="green"
                    />
                    <StatCard
                        label="نسبة الإنجاز العامة"
                        value={`${classAssessments.summary.overallPercentage.toFixed(1)}%`}
                        icon={<BarChart3 className="w-6 h-6" />}
                        color="amber"
                    />
                </div>
            )}

            {/* Matrix Table */}
            {selectedClassId && classAssessments && (
                <div className="bg-white rounded-2xl qatar-card-shadow border border-qatar-gray-border overflow-hidden animate-in slide-in-from-bottom-6 duration-700">
                    <div className="bg-qatar-maroon px-6 sm:px-8 py-5 flex flex-wrap justify-between items-center gap-3">
                        <h2 className="text-xl font-black text-white flex items-center gap-3">
                            <BookOpen className="w-6 h-6 text-white/70" />
                            جدول رصد التطبيقات - {classAssessments.className}
                        </h2>
                        <button
                            onClick={() => setHideCompleted(prev => !prev)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-black border transition-all shadow-sm ${
                                hideCompleted
                                    ? "bg-white text-qatar-maroon border-white shadow-md"
                                    : "bg-white/10 text-white border-white/30 hover:bg-white/20"
                            }`}
                        >
                            {hideCompleted ? <EyeOff className="w-4 h-4" /> : <Filter className="w-4 h-4" />}
                            {hideCompleted ? "إخفاء المكتملين" : "إظهار غير المكتملين فقط"}
                            {hideCompleted && (
                                <span className="bg-qatar-maroon text-white text-[10px] px-1.5 py-0.5 rounded-full border border-white/30">
                                    {classAssessments.students.filter((s: any) => s.remainingCount > 0).length}
                                </span>
                            )}
                        </button>
                    </div>

                    {hideCompleted && classAssessments.students.filter((s: any) => s.remainingCount > 0).length === 0 && (
                        <div className="flex flex-col items-center gap-3 py-10 text-center">
                            <CheckCircle2 className="w-14 h-14 text-emerald-400" />
                            <p className="text-emerald-700 font-black text-lg">🎉 جميع الطلاب أكملوا جميع التطبيقات!</p>
                            <p className="text-slate-400 text-sm">لا يوجد طلاب متبقيون.</p>
                        </div>
                    )}
                    <div className="overflow-x-auto">
                        {classAssessments.students.length === 0 ? (
                            <div className="p-10 text-center">
                                <p className="text-slate-500 font-bold">لا يوجد طلاب مسجلون في هذا الصف.</p>
                            </div>
                        ) : (
                            <table className="w-full border-collapse text-right min-w-[800px]">
                                <thead>
                                    <tr style={{ background: "linear-gradient(135deg, #1e293b 0%, #334155 100%)" }}>
                                        <th className="py-4 px-4 text-sm font-black text-white sticky right-0 bg-slate-800 z-10 w-48 border-l border-slate-700 text-center">
                                            اسم الطالب
                                        </th>
                                        {classAssessments.subjects.map((sub: any) => {
                                            const uncompletedCount = classAssessments.students.filter((student: any) => 
                                                !student.statuses.find((s: any) => s.subjectId === sub._id)?.isCompleted
                                            ).length;
                                            const isAllCompleted = classAssessments.students.length > 0 && uncompletedCount === 0;

                                            return (
                                                <th key={sub._id} className="py-3 px-2 text-xs font-black text-slate-200 text-center border-l border-slate-700/50 align-top">
                                                    <div className="flex flex-col items-center gap-1.5 cursor-default">
                                                        <span>{sub.name}</span>
                                                        <button 
                                                            onClick={() => handleToggleAll(sub._id, !isAllCompleted)}
                                                            title={isAllCompleted ? "إلغاء التحديد للكل" : "تحديد الكل كمنجز"}
                                                            className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-md transition-colors shadow-sm ${
                                                                isAllCompleted 
                                                                ? "bg-rose-500/20 text-rose-300 hover:bg-rose-500 hover:text-white" 
                                                                : "bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500 hover:text-white"
                                                            }`}
                                                        >
                                                            {isAllCompleted ? <XCircle className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
                                                            {isAllCompleted ? "إلغاء الكل" : "تحديد الكل"}
                                                        </button>
                                                    </div>
                                                </th>
                                            );
                                        })}
                                        <th className="py-4 px-3 text-xs font-black text-emerald-300 text-center border-l border-slate-700/50">إنجاز</th>
                                        <th className="py-4 px-3 text-xs font-black text-rose-300 text-center border-l border-slate-700/50">متبقي</th>
                                        <th className="py-4 px-3 text-xs font-black text-amber-300 text-center">النسبة</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {classAssessments.students
                                        .filter((student: any) => !hideCompleted || student.remainingCount > 0)
                                        .map((student: any, idx: number) => (
                                        <tr key={student.studentId} className={`border-b border-slate-100 hover:bg-slate-50 transition-colors ${idx % 2 === 0 ? "bg-white" : "bg-slate-50/30"}`}>
                                            <td className="py-3 px-4 font-black text-slate-800 text-sm sticky right-0 bg-inherit border-l border-slate-200 shadow-[1px_0_5px_rgba(0,0,0,0.02)] whitespace-nowrap">
                                                {student.studentName}
                                            </td>
                                            
                                            {/* Subjects toggles */}
                                            {student.statuses.map((status: any) => (
                                                <td key={status.subjectId} className="py-2 px-2 text-center border-l border-slate-100">
                                                    <button
                                                        onClick={() => handleToggle(student.studentId, status.subjectId)}
                                                        className={`w-10 h-10 mx-auto rounded-xl flex items-center justify-center transition-all ${
                                                            status.isCompleted
                                                                ? "bg-emerald-100 text-emerald-600 hover:bg-emerald-200"
                                                                : "bg-slate-100 text-slate-300 hover:bg-slate-200 hover:text-slate-500"
                                                        }`}
                                                    >
                                                        {status.isCompleted ? <CheckCircle2 className="w-6 h-6" /> : <span className="font-black text-xs">❌</span>}
                                                    </button>
                                                </td>
                                            ))}

                                            {/* Aggregations */}
                                            <td className="py-3 px-3 text-center border-l border-slate-100">
                                                <span className="inline-flex items-center justify-center min-w-[2rem] px-2 py-1 rounded-lg text-sm font-black bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-sm">
                                                    {student.completedCount}
                                                </span>
                                            </td>
                                            <td className="py-3 px-3 text-center border-l border-slate-100">
                                                <span className="inline-flex items-center justify-center min-w-[2rem] px-2 py-1 rounded-lg text-sm font-black bg-rose-50 text-rose-700 border border-rose-200 shadow-sm">
                                                    {student.remainingCount}
                                                </span>
                                            </td>
                                            <td className="py-3 px-3 text-center">
                                                <div className="flex flex-col items-center justify-center gap-1.5">
                                                    <span className={`inline-flex items-center px-2 py-1 rounded-lg text-xs font-black border shadow-sm ${
                                                        student.completionPercentage >= 90 ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                                                        : student.completionPercentage >= 50 ? "bg-amber-100 text-amber-800 border-amber-200"
                                                        : "bg-rose-100 text-rose-800 border-rose-200"
                                                    }`}>
                                                        {student.completionPercentage.toFixed(0)}%
                                                    </span>
                                                    <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                        <div
                                                            className={`h-full rounded-full transition-all duration-500 ${
                                                                student.completionPercentage >= 90 ? "bg-emerald-500"
                                                                : student.completionPercentage >= 50 ? "bg-amber-500"
                                                                : "bg-rose-500"
                                                            }`}
                                                            style={{ width: `${student.completionPercentage}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
