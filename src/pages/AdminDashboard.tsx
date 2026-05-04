import { useState, useMemo } from "react";
import { useQuery } from "convex/react";
import { format } from "date-fns";
import { Calendar, Users, UserCheck, UserX, Activity, BarChart3, Sigma, Check, X } from "lucide-react";
// @ts-ignore
import { api } from "../../convex/_generated/api";
import StatCard from "../components/StatCard";

function sortClassNameAscending(nameA: string, nameB: string): number {
    const [gradeA, sectionA] = nameA.split("-").map(Number);
    const [gradeB, sectionB] = nameB.split("-").map(Number);
    if (gradeA !== gradeB) return gradeA - gradeB;
    return sectionA - sectionB;
}

const GRADE_LABELS: Record<number, string> = {
    10: "عاشر",
    11: "حادي عشر",
    12: "ثاني عشر",
};

/* ── Badge helpers (styling only) ── */
function PresentBadge({ value }: { value: number }) {
    if (value === 0) return <span className="text-slate-300 font-bold text-sm select-none">—</span>;
    return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-sm font-black bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-sm">
            <Check className="w-3.5 h-3.5" />{value}
        </span>
    );
}
function AbsentBadge({ value }: { value: number }) {
    if (value === 0) return <span className="text-slate-300 font-bold text-sm select-none">—</span>;
    return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-sm font-black bg-rose-50 text-rose-700 border border-rose-200 shadow-sm">
            <X className="w-3.5 h-3.5" />{value}
        </span>
    );
}
function TotalBadge({ value }: { value: number }) {
    return (
        <span className="inline-flex items-center px-3 py-1 rounded-lg text-sm font-black bg-slate-100 text-slate-600 border border-slate-200 shadow-sm">
            {value}
        </span>
    );
}
function PctBadge({ pct }: { pct: number }) {
    if (pct === 0) return <span className="text-slate-300 font-bold text-xs select-none">—</span>;
    const style = pct >= 90
        ? "bg-emerald-100 text-emerald-800 border-emerald-200"
        : pct >= 75
        ? "bg-amber-100 text-amber-800 border-amber-200"
        : "bg-rose-100 text-rose-800 border-rose-200";
    return (
        <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-lg text-sm font-black border shadow-sm ${style}`}>
            {pct.toFixed(1)}%
        </span>
    );
}

export default function AdminDashboard() {
    const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
    const [selectedGrade, setSelectedGrade] = useState<number>(10);
    const data = useQuery(api.attendance.getDailySummary, { date });

    const tableData = useMemo(() => {
        if (!data || !data.classes) return null;

        const { classes } = data;

        const gradeClasses = classes
            .filter((c: any) => c.grade === selectedGrade)
            .sort((a: any, b: any) => sortClassNameAscending(a.name, b.name));

        const totalStudents = gradeClasses.reduce((acc: number, c: any) => acc + c.totalStudents, 0);
        const totalPresent  = gradeClasses.reduce((acc: number, c: any) => acc + c.dayPresent, 0);
        const totalAbsent   = gradeClasses.reduce((acc: number, c: any) => acc + c.dayAbsent, 0);
        const percentage    = totalStudents > 0 ? (totalPresent / totalStudents) * 100 : 0;

        return {
            classes: gradeClasses,
            summary: { totalStudents, totalPresent, totalAbsent, percentage },
        };
    }, [data, selectedGrade]);

    if (data === undefined) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] text-slate-500">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-qatar-maroon mb-4"></div>
                <p className="font-bold">جاري تحميل البيانات...</p>
            </div>
        );
    }

    const { summary, classes } = tableData || { classes: [], summary: null };
    const formattedDate = format(new Date(date), "d/MM/yyyy");
    const gradeLabel = GRADE_LABELS[selectedGrade];

    const formatArabicDate = (d: string) => {
        const date = new Date(d);
        const months = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
        return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
    };

    return (
        <div dir="rtl" className="max-w-7xl mx-auto space-y-6 font-sans transition-all animate-in fade-in duration-500">

            {/* Hero Header — modern minimal */}
            <div className="relative">
                <div className="absolute inset-0 rounded-3xl opacity-5"
                     style={{ background: "radial-gradient(circle at 30% 50%, #5C1A1B 0%, transparent 50%)" }}/>
                <div className="relative flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
                    <div>
                        <p className="text-xs font-black text-qatar-maroon tracking-widest mb-1">DAILY OVERVIEW · {formatArabicDate(date)}</p>
                        <h1 className="text-3xl sm:text-4xl font-black text-slate-800 tracking-tight">
                            مرحباً بك
                        </h1>
                        <p className="text-slate-500 font-medium text-sm mt-1">إليك ملخص اليوم في مدرسة ابن تيمية الثانوية للبنين</p>
                    </div>
                    <div className="flex items-center gap-2 bg-white border border-slate-200 px-4 py-2.5 rounded-2xl shadow-sm">
                        <Calendar className="w-4 h-4 text-qatar-maroon" />
                        <input
                            type="date"
                            className="bg-transparent border-none outline-none font-black text-slate-700 cursor-pointer text-sm"
                            value={date}
                            onChange={e => setDate(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            {/* Summary Statistics Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
                <StatCard
                    label="طلاب مكتشفون اليوم"
                    value={data?.summary?.totalStudents || 0}
                    subValue={`من أصل ${data?.summary?.totalCapacity || 0}`}
                    icon={<Users className="w-6 h-6" />}
                    color="maroon"
                />
                <StatCard
                    label="حاضرون فعلياً"
                    value={data?.summary?.totalPresent || 0}
                    icon={<UserCheck className="w-6 h-6" />}
                    color="green"
                />
                <StatCard
                    label="غائبون فعلياً"
                    value={data?.summary?.totalAbsent || 0}
                    icon={<UserX className="w-6 h-6" />}
                    color="rose"
                />
                <StatCard
                    label="نسبة الحضور الحقيقية"
                    value={data?.summary?.percentage ? `${data.summary.percentage.toFixed(1)}%` : "0%"}
                    subValue={data?.summary?.totalStudents ? `لـ ${data.summary.totalStudents} طالب` : ""}
                    icon={<Activity className="w-6 h-6" />}
                    color="amber"
                />
                <StatCard
                    label="الصفوف المكتملة"
                    value={data?.summary?.classesImported || 0}
                    subValue={`من أصل ${data?.summary?.totalClasses || 0}`}
                    icon={<BarChart3 className="w-6 h-6" />}
                    color="blue"
                />
            </div>

            {/* Grade Pills - segmented control style */}
            <div className="flex justify-end">
                <div className="inline-flex bg-slate-100 rounded-full p-1">
                    {([10, 11, 12] as const).map((grade) => (
                        <button
                            key={grade}
                            onClick={() => setSelectedGrade(grade)}
                            className={`px-5 py-1.5 rounded-full font-black text-sm transition-all ${
                                selectedGrade === grade
                                    ? "bg-white text-qatar-maroon shadow-sm"
                                    : "text-slate-500 hover:text-slate-700"
                            }`}
                        >
                            {GRADE_LABELS[grade]}
                        </button>
                    ))}
                </div>
            </div>

            {/* Main Table Section */}
            <div className="bg-white rounded-2xl qatar-card-shadow border border-qatar-gray-border overflow-hidden">
                <div className="bg-qatar-maroon px-6 sm:px-8 py-5 flex justify-between items-center">
                    <h2 className="text-xl font-black text-white flex items-center gap-3">
                        <BarChart3 className="w-6 h-6 text-white/70" />
                        تقرير الحضور والغياب - الصف ال{gradeLabel}
                    </h2>
                    <div className="bg-white/10 px-4 py-1 rounded-full text-white/90 text-sm font-bold backdrop-blur-md border border-white/20">
                        {formattedDate}
                    </div>
                </div>

                <div className="overflow-x-auto">
                    {(!classes || classes.length === 0) ? (
                        <div className="p-20 text-center flex flex-col items-center gap-4">
                            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center">
                                <Users className="w-10 h-10 text-slate-200" />
                            </div>
                            <h3 className="text-xl font-black text-slate-400">لا توجد بيانات لهذا التاريخ</h3>
                        </div>
                    ) : (
                        <table className="w-full border-collapse text-right">
                            <thead>
                                <tr style={{ background: "linear-gradient(135deg, #1e293b 0%, #334155 100%)" }}>
                                    <th className="py-4 px-6 text-sm font-black text-white text-right">صف دراسي</th>
                                    <th className="py-4 px-6 text-sm font-black text-slate-300 text-center">العدد الكلي</th>
                                    <th className="py-4 px-6 text-sm font-black text-emerald-300 text-center">الحضور</th>
                                    <th className="py-4 px-6 text-sm font-black text-rose-300 text-center">الغياب</th>
                                    <th className="py-4 px-6 text-sm font-black text-slate-300 text-center">نسبة الحضور</th>
                                </tr>
                            </thead>
                            <tbody>
                                {classes.map((cls: any, idx: number) => {
                                    const hasActivity = cls.dayPresent > 0 || cls.dayAbsent > 0;
                                    const hasAbsence  = cls.dayAbsent > 0;
                                    return (
                                        <tr
                                            key={cls._id}
                                            className={`border-b border-slate-100 transition-all cursor-default group ${
                                                hasAbsence
                                                    ? "bg-rose-50/30 hover:bg-rose-50/70"
                                                    : idx % 2 === 0 ? "bg-white hover:bg-slate-50" : "bg-slate-50/40 hover:bg-slate-50"
                                            }`}
                                        >
                                            {/* Class name */}
                                            <td className="py-3.5 px-6 text-right">
                                                <div className="flex items-center gap-2.5">
                                                    <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 transition-transform group-hover:scale-125 ${
                                                        hasActivity
                                                            ? hasAbsence ? "bg-rose-400" : "bg-emerald-400"
                                                            : "bg-slate-200"
                                                    }`} />
                                                    <span className="font-black text-slate-700 group-hover:text-qatar-maroon transition-colors text-sm">
                                                        {cls.name}
                                                    </span>
                                                </div>
                                            </td>

                                            {/* Total */}
                                            <td className="py-3.5 px-6 text-center">
                                                <TotalBadge value={cls.totalStudents} />
                                            </td>

                                            {/* Present */}
                                            <td className="py-3.5 px-6 text-center">
                                                <PresentBadge value={cls.dayPresent} />
                                            </td>

                                            {/* Absent */}
                                            <td className="py-3.5 px-6 text-center">
                                                <AbsentBadge value={cls.dayAbsent} />
                                            </td>

                                            {/* Pct + bar */}
                                            <td className="py-3.5 px-6">
                                                <div className="flex flex-col items-center gap-1.5">
                                                    <PctBadge pct={cls.presentPercentage} />
                                                    {cls.presentPercentage > 0 && (
                                                        <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden hidden sm:block">
                                                            <div
                                                                className={`h-full rounded-full transition-all duration-700 ${
                                                                    cls.presentPercentage >= 90 ? "bg-emerald-500"
                                                                    : cls.presentPercentage >= 75 ? "bg-amber-500"
                                                                    : "bg-qatar-maroon"
                                                                }`}
                                                                style={{ width: `${cls.presentPercentage}%` }}
                                                            />
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}

                                {/* Grade Total Row */}
                                {summary && (
                                    <tr style={{ background: "linear-gradient(135deg, #fff1f2 0%, #ffe4e6 100%)" }}
                                        className="border-t-2 border-rose-200">
                                        <td className="py-4 px-6 text-right">
                                            <div className="flex items-center gap-2">
                                                <Sigma className="w-4 h-4 text-qatar-maroon flex-shrink-0" />
                                                <span className="font-black text-qatar-maroon text-sm">إجمالي الصف ال{gradeLabel}</span>
                                            </div>
                                        </td>
                                        <td className="py-4 px-6 text-center">
                                            <span className="inline-flex items-center px-3 py-1 rounded-lg text-sm font-black bg-white text-slate-700 border border-slate-300 shadow-sm">
                                                {summary.totalStudents}
                                            </span>
                                        </td>
                                        <td className="py-4 px-6 text-center">
                                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-sm font-black bg-emerald-600 text-white shadow-sm">
                                                <Check className="w-3.5 h-3.5" />{summary.totalPresent}
                                            </span>
                                        </td>
                                        <td className="py-4 px-6 text-center">
                                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-sm font-black bg-qatar-maroon text-white shadow-sm">
                                                <X className="w-3.5 h-3.5" />{summary.totalAbsent}
                                            </span>
                                        </td>
                                        <td className="py-4 px-6 text-center">
                                            <PctBadge pct={summary.percentage} />
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

        </div>
    );
}
