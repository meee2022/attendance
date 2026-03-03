import React, { useState } from "react";
import { useQuery } from "convex/react";
import { format } from "date-fns";
import {
    Calendar, TrendingUp, Users, UserX, UserCheck, Download,
    TableProperties, BarChart3, Check, X,
} from "lucide-react";
// @ts-ignore
import { api } from "../../convex/_generated/api";
import StatCard from "../components/StatCard";

const GRADE_LABELS: Record<number, string> = { 10: "عاشر", 11: "حادي عشر", 12: "ثاني عشر" };

/* ── Reusable badge helpers (styling only, no logic) ── */
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
function PctBadge({ pct, type }: { pct: number; type: "present" | "absent" }) {
    if (pct === 0) return <span className="text-slate-300 font-bold text-xs select-none">—</span>;
    const style = type === "present"
        ? (pct >= 80 ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                     : "bg-amber-100 text-amber-800 border-amber-200")
        : (pct < 20  ? "bg-orange-50 text-orange-700 border-orange-200"
                     : "bg-rose-100 text-rose-800 border-rose-200");
    return (
        <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-lg text-sm font-black border shadow-sm ${style}`}>
            {type === "present" ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
            {pct.toFixed(1)}%
        </span>
    );
}

/* ─────────────────── Page ─────────────────── */
export default function ReportsPage() {
    const [activeTab, setActiveTab] = useState<"summary" | "matrix">("summary");
    const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));

    const initData = useQuery(api.setup.getInitialData);
    const schoolId = initData?.schools?.[0]?._id;
    const periodsPerDay: number = initData?.schools?.[0]?.periodsPerDay ?? 8;

    const report = useQuery(api.attendance.getAttendanceReport,
        schoolId ? { schoolId, date } : "skip"
    );

    if (!report || !initData) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] text-slate-500">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-qatar-maroon mb-4" />
                <p className="font-black">جاري تحميل التقارير...</p>
            </div>
        );
    }

    const totalTealPresent = report.gradeTotals.reduce((acc: number, g: any) => acc + g.teal.present, 0);
    const totalTealAbsent  = report.gradeTotals.reduce((acc: number, g: any) => acc + g.teal.absent, 0);
    const totalRedAbsent   = report.gradeTotals.reduce((acc: number, g: any) => acc + g.red.absent, 0);
    const totalRedPresent  = report.gradeTotals.reduce((acc: number, g: any) => acc + g.red.present, 0);

    const tabs = [
        { id: "summary", label: "الملخص الإجمالي",          icon: <BarChart3 className="w-4 h-4" /> },
        { id: "matrix",  label: "تفصيل الحضور حسب الصفوف", icon: <TableProperties className="w-4 h-4" /> },
    ] as const;

    return (
        <div className="max-w-7xl mx-auto space-y-6 pb-20 font-sans animate-in fade-in duration-500">

            {/* Header */}
            <div className="rounded-2xl overflow-hidden qatar-card-shadow"
                 style={{ background: "linear-gradient(135deg, #9B1239 0%, #C0184C 50%, #9B1239 100%)" }}>
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-5 sm:p-8">
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-black text-white flex items-center gap-3">
                            <TrendingUp className="w-7 h-7 text-white/80" />
                            التقارير الإحصائية
                        </h1>
                        <p className="text-white/70 font-medium mr-10 mt-1 text-sm">عرض وتحليل حالة الحضور والغياب اليومي</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-2 bg-white/15 backdrop-blur-sm px-4 py-2 rounded-xl border border-white/20">
                            <Calendar className="w-4 h-4 text-white" />
                            <input
                                type="date"
                                value={date}
                                onChange={e => setDate(e.target.value)}
                                className="bg-transparent border-none outline-none font-black text-white cursor-pointer text-sm"
                            />
                        </div>
                        <button className="flex items-center gap-2 text-sm font-black bg-white/20 backdrop-blur-sm text-white px-5 py-2.5 rounded-xl hover:bg-white/30 transition-all border border-white/20 active:scale-95">
                            <Download className="w-4 h-4" />
                            تصدير
                        </button>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 bg-white p-1.5 rounded-2xl border border-qatar-gray-border qatar-card-shadow w-fit">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-black text-sm transition-all ${
                            activeTab === tab.id
                                ? "bg-qatar-maroon text-white shadow-md"
                                : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                        }`}
                    >
                        {tab.icon}
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* ─── TAB 1: Summary ─── */}
            {activeTab === "summary" && (
                <div className="space-y-8 animate-in fade-in duration-300">
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <StatCard label="إجمالي طلاب المدرسة" value={report.totalStudents}
                            icon={<Users className="w-5 h-5" />} color="maroon" />
                        <StatCard label="حاضرون (فعلي)" value={totalTealPresent}
                            icon={<UserCheck className="w-5 h-5" />} color="green" />
                        <StatCard label="غائبون (فعلي)" value={totalRedAbsent}
                            icon={<UserX className="w-5 h-5" />} color="rose" />
                        <StatCard
                            label="نسبة الحضور العامة"
                            value={report.totalStudents > 0 ? `${((totalTealPresent / report.totalStudents) * 100).toFixed(1)}%` : "0%"}
                            icon={<TrendingUp className="w-5 h-5" />} color="blue" />
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 items-start">
                        <SummaryCard
                            title="المعيار الأول: الاحتساب حسب الحضور"
                            subtitle="الطالب الذي حضر حصة واحدة فأكثر = حاضر"
                            headerClass="bg-qatar-maroon"
                            totalPresent={totalTealPresent}
                            totalAbsent={totalTealAbsent}
                            report={report}
                            mode="teal"
                        />
                        <SummaryCard
                            title="المعيار الثاني: الاحتساب حسب الغياب"
                            subtitle="الطالب الذي غاب حصتين فأكثر = غائب"
                            headerClass="bg-slate-800"
                            totalPresent={totalRedPresent}
                            totalAbsent={totalRedAbsent}
                            report={report}
                            mode="red"
                        />
                    </div>
                </div>
            )}

            {/* ─── TAB 2: Matrix ─── */}
            {activeTab === "matrix" && (
                <MatrixTab date={date} periodsPerDay={periodsPerDay} />
            )}
        </div>
    );
}

/* ─────────────────── Summary Card ─────────────────── */
function SummaryCard({
    title, subtitle, headerClass, totalPresent, totalAbsent, report, mode
}: {
    title: string; subtitle: string; headerClass: string;
    totalPresent: number; totalAbsent: number; report: any; mode: "teal" | "red";
}) {
    const table = mode === "teal" ? "tealTable" : "redTable";
    const gradeTotalField = mode === "teal" ? "teal" : "red";

    return (
        <div className="bg-white rounded-2xl qatar-card-shadow border border-qatar-gray-border overflow-hidden">
            <div className={`${headerClass} p-5 text-center text-white`}>
                <h2 className="text-lg font-black">{title}</h2>
                <p className="text-white/70 text-xs font-bold mt-0.5">{subtitle}</p>
            </div>

            {/* Totals bar */}
            <div className="p-5 grid grid-cols-2 gap-4 border-b border-qatar-gray-border bg-slate-50/50">
                <div className="text-center">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">إجمالي الحاضرين</p>
                    <p className="text-2xl font-black text-emerald-700">{totalPresent}</p>
                </div>
                <div className="text-center">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">إجمالي الغائبين</p>
                    <p className="text-2xl font-black text-rose-700">{totalAbsent}</p>
                </div>
            </div>

            {/* Per-class table */}
            <div className="overflow-x-auto">
                <table className="w-full text-right border-collapse">
                    <thead>
                        <tr style={{ background: "linear-gradient(135deg, #1e293b 0%, #334155 100%)" }}>
                            <th className="py-3.5 px-4 text-xs font-black text-white text-right">الشعبة</th>
                            <th className="py-3.5 px-4 text-xs font-black text-emerald-300 text-center">حضر</th>
                            <th className="py-3.5 px-4 text-xs font-black text-rose-300 text-center">غاب</th>
                            <th className="py-3.5 px-4 text-xs font-black text-blue-300 text-center">% حضور</th>
                            <th className="py-3.5 px-4 text-xs font-black text-slate-300 text-center">الإجمالي</th>
                        </tr>
                    </thead>
                    <tbody>
                        {[10, 11, 12].map((grade: number) => {
                            const gradeClasses = report.classStats.filter((c: any) => c.grade === grade);
                            const gradeTotal = report.gradeTotals.find((g: any) => g.grade === grade);
                            return (
                                <React.Fragment key={grade}>
                                    {gradeClasses.map((cls: any, idx: number) => {
                                        const present = cls[table].present as number;
                                        const absent  = cls[table].absent  as number;
                                        const total   = cls.total as number;
                                        const pct     = cls.studentsWithData > 0 ? (present / cls.studentsWithData) * 100 : 0;
                                        const hasActivity = cls.hasData as boolean;
                                        return (
                                            <tr
                                                key={cls.classId}
                                                className={`border-b border-slate-100 text-center transition-all cursor-default group ${
                                                    hasActivity && absent > 0
                                                        ? "bg-rose-50/30 hover:bg-rose-50/70"
                                                        : idx % 2 === 0 ? "bg-white hover:bg-slate-50" : "bg-slate-50/40 hover:bg-slate-50"
                                                }`}
                                            >
                                                <td className="py-3 px-4 text-right">
                                                    <div className="flex items-center gap-2">
                                                        <span className={`w-2 h-2 rounded-full flex-shrink-0 transition-transform group-hover:scale-125 ${
                                                            hasActivity
                                                                ? absent > 0 ? "bg-rose-400" : "bg-emerald-400"
                                                                : "bg-slate-200"
                                                        }`} />
                                                        <span className="font-black text-slate-700 group-hover:text-qatar-maroon transition-colors text-sm">
                                                            {cls.className}
                                                        </span>
                                                        {grade !== 10 && cls.track && (
                                                            <span className="text-[10px] text-slate-400 font-bold">{cls.track}</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="py-3 px-4">
                                                    {hasActivity ? <PresentBadge value={present} /> : <span className="text-slate-300 text-xs font-bold">—</span>}
                                                </td>
                                                <td className="py-3 px-4">
                                                    {hasActivity ? <AbsentBadge value={absent} /> : <span className="text-slate-300 text-xs font-bold">—</span>}
                                                </td>
                                                <td className="py-3 px-4">
                                                    {hasActivity && cls.studentsWithData > 0
                                                        ? <PctBadge pct={pct} type="present" />
                                                        : <span className="text-slate-200 text-xs">—</span>
                                                    }
                                                </td>
                                                <td className="py-3 px-4 text-center">
                                                    <TotalBadge value={total} />
                                                </td>
                                            </tr>
                                        );
                                    })}

                                    {/* Grade total row */}
                                    {gradeTotal && (
                                        <tr style={{ background: "linear-gradient(135deg, #fff1f2 0%, #ffe4e6 100%)" }}
                                            className="border-y-2 border-rose-200 text-center">
                                            <td className="py-3.5 px-4 text-right">
                                                <div className="flex items-center gap-2">
                                                    <span className="w-2 h-2 rounded-full bg-qatar-maroon flex-shrink-0" />
                                                    <span className="font-black text-qatar-maroon text-sm">إجمالي الصف {grade}</span>
                                                </div>
                                            </td>
                                            <td className="py-3.5 px-4">
                                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-sm font-black bg-emerald-600 text-white shadow-sm">
                                                    <Check className="w-3.5 h-3.5" />{gradeTotal[gradeTotalField].present}
                                                </span>
                                            </td>
                                            <td className="py-3.5 px-4">
                                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-sm font-black bg-qatar-maroon text-white shadow-sm">
                                                    <X className="w-3.5 h-3.5" />{gradeTotal[gradeTotalField].absent}
                                                </span>
                                            </td>
                                            <td className="py-3.5 px-4">
                                                {gradeTotal.total > 0 && (
                                                    <PctBadge
                                                        pct={(gradeTotal[gradeTotalField].present / gradeTotal.total) * 100}
                                                        type="present"
                                                    />
                                                )}
                                            </td>
                                            <td className="py-3.5 px-4">
                                                <span className="inline-flex items-center px-3 py-1 rounded-lg text-sm font-black bg-white text-slate-700 border border-slate-300 shadow-sm">
                                                    {gradeTotal.total}
                                                </span>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

/* ─────────────────── Matrix Tab ─────────────────── */
function MatrixTab({ date, periodsPerDay }: { date: string; periodsPerDay: number }) {
    const [selectedGrade, setSelectedGrade] = useState<10 | 11 | 12>(10);
    const [selectedPeriod, setSelectedPeriod] = useState<number | undefined>(undefined);

    const matrix = useQuery(api.attendance.getMatrixReport, {
        date,
        periodNumber: selectedPeriod,
    });

    const gradeClasses = matrix?.classStats.filter((c: any) => c.grade === selectedGrade) ?? [];
    const gradeTotal   = matrix?.gradeTotals.find((g: any) => g.grade === selectedGrade);
    const schoolTotal  = matrix?.schoolTotal;
    const periodOptions = Array.from({ length: periodsPerDay }, (_, i) => i + 1);

    return (
        <div className="space-y-6 animate-in fade-in duration-300">

            {/* Filter Bar */}
            <div className="bg-white rounded-2xl border border-qatar-gray-border qatar-card-shadow p-4 sm:p-5">
                <div className="flex flex-wrap items-center gap-3 justify-between">
                    <div className="flex gap-1.5 flex-wrap">
                        {([10, 11, 12] as const).map(g => (
                            <button key={g} onClick={() => setSelectedGrade(g)}
                                className={`px-4 py-2 rounded-xl font-black text-sm transition-all border ${
                                    selectedGrade === g
                                        ? "bg-qatar-maroon text-white border-qatar-maroon shadow-sm"
                                        : "bg-slate-50 text-slate-600 border-slate-200 hover:border-qatar-maroon/40 hover:text-qatar-maroon"
                                }`}
                            >
                                {GRADE_LABELS[g]}
                            </button>
                        ))}
                    </div>
                    <div className="flex items-center gap-2">
                        <select
                            value={selectedPeriod ?? ""}
                            onChange={e => setSelectedPeriod(e.target.value === "" ? undefined : parseInt(e.target.value))}
                            className="bg-qatar-gray-bg border border-qatar-gray-border rounded-xl px-3 py-2 font-black text-sm text-slate-700 outline-none cursor-pointer"
                        >
                            <option value="">جميع الحصص</option>
                            {periodOptions.map(p => (
                                <option key={p} value={p}>الحصة {p}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {matrix === undefined && (
                <div className="flex items-center justify-center py-20">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-qatar-maroon" />
                </div>
            )}

            {matrix && (
                <div className="space-y-6">
                    {/* School overview chips */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <StatCard label="إجمالي المدرسة" value={schoolTotal?.totalStudents ?? 0} icon={<Users className="w-5 h-5" />} color="maroon" />
                        <StatCard label="حاضرون" value={schoolTotal?.presentCount ?? 0} icon={<UserCheck className="w-5 h-5" />} color="green" />
                        <StatCard label="غائبون" value={schoolTotal?.absentCount ?? 0} icon={<UserX className="w-5 h-5" />} color="rose" />
                        <StatCard label="نسبة الحضور" value={`${(schoolTotal?.presentPct ?? 0).toFixed(1)}%`} icon={<TrendingUp className="w-5 h-5" />} color="blue" />
                    </div>

                    {/* Matrix Table */}
                    <div className="bg-white rounded-2xl border border-qatar-gray-border qatar-card-shadow overflow-hidden">
                        <div className="bg-qatar-maroon px-5 py-4 flex items-center justify-between">
                            <h2 className="text-white font-black flex items-center gap-2">
                                <TableProperties className="w-5 h-5 text-white/70" />
                                تقرير الصف ال{GRADE_LABELS[selectedGrade]}
                                {selectedPeriod ? ` — الحصة ${selectedPeriod}` : " — جميع الحصص"}
                            </h2>
                            <span className="bg-white/10 text-white/80 text-xs font-bold px-3 py-1 rounded-full border border-white/20">
                                {date}
                            </span>
                        </div>

                        {gradeClasses.length === 0 ? (
                            <div className="py-16 text-center">
                                <TableProperties className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                                <p className="font-black text-slate-400">لا توجد صفوف لهذه المرحلة</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="border-collapse text-center" style={{ minWidth: "100%" }}>
                                    <thead>
                                        <tr style={{ background: "linear-gradient(135deg, #1e293b 0%, #334155 100%)" }}>
                                            <th className="text-white font-black text-sm px-4 py-3.5 text-right sticky right-0 z-10 min-w-[130px] border-b border-slate-700"
                                                style={{ background: "linear-gradient(135deg, #1e293b 0%, #334155 100%)" }}>
                                                الصف
                                            </th>
                                            {gradeClasses.map((cls: any) => {
                                                const active = cls.hasData && (cls.presentCount > 0 || cls.absentCount > 0);
                                                return (
                                                    <th key={cls.classId}
                                                        className={`font-black text-sm px-4 py-3.5 min-w-[100px] border-b whitespace-nowrap transition-colors ${
                                                            active
                                                                ? "bg-emerald-700 text-white border-emerald-800"
                                                                : "bg-slate-600 text-slate-300 border-slate-700"
                                                        }`}
                                                    >
                                                        <div className="flex flex-col items-center gap-1">
                                                            {cls.className}
                                                            <span className={`w-2 h-2 rounded-full ${active ? "bg-emerald-300" : "bg-slate-500"}`} />
                                                        </div>
                                                    </th>
                                                );
                                            })}
                                            <th className="bg-qatar-maroon text-white font-black text-sm px-4 py-3.5 min-w-[100px] border-b border-rose-800 whitespace-nowrap">
                                                {GRADE_LABELS[selectedGrade]}
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {/* Total students row */}
                                        <tr>
                                            <td className="bg-slate-700 text-white font-black text-sm px-4 py-3 text-right sticky right-0 z-10 border-b border-slate-600 whitespace-nowrap">
                                                العدد الكلي
                                            </td>
                                            {gradeClasses.map((cls: any) => (
                                                <td key={cls.classId} className="bg-slate-50 px-3 py-3 border-b border-r border-slate-100">
                                                    <TotalBadge value={cls.totalStudents} />
                                                </td>
                                            ))}
                                            <td className="bg-slate-100 px-3 py-3 border-b border-slate-200">
                                                <span className="inline-flex items-center px-3 py-1 rounded-lg text-sm font-black bg-white text-slate-700 border border-slate-300 shadow-sm">
                                                    {gradeTotal?.totalStudents ?? 0}
                                                </span>
                                            </td>
                                        </tr>

                                        {/* Present count row */}
                                        <tr>
                                            <td className="bg-emerald-600 text-white font-black text-sm px-4 py-3 text-right sticky right-0 z-10 border-b border-emerald-700 whitespace-nowrap">
                                                الحاضرون
                                            </td>
                                            {gradeClasses.map((cls: any) => (
                                                <td key={cls.classId} className="bg-emerald-50/60 px-3 py-3 border-b border-r border-emerald-100">
                                                    <PresentBadge value={cls.hasData ? cls.presentCount : 0} />
                                                </td>
                                            ))}
                                            <td className="bg-emerald-100 px-3 py-3 border-b border-emerald-200">
                                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-sm font-black bg-emerald-600 text-white shadow-sm">
                                                    <Check className="w-3.5 h-3.5" />{gradeTotal?.presentCount ?? 0}
                                                </span>
                                            </td>
                                        </tr>

                                        {/* Attendance % row */}
                                        <tr>
                                            <td className="bg-emerald-50 text-emerald-800 font-black text-sm px-4 py-3 text-right sticky right-0 z-10 border-b border-emerald-100 whitespace-nowrap">
                                                نسبة الحضور
                                            </td>
                                            {gradeClasses.map((cls: any) => (
                                                <td key={cls.classId} className="bg-white px-3 py-3 border-b border-r border-slate-100">
                                                    {cls.hasData
                                                        ? <PctBadge pct={cls.presentPct} type="present" />
                                                        : <span className="text-slate-300 text-xs">—</span>
                                                    }
                                                </td>
                                            ))}
                                            <td className="bg-emerald-50 px-3 py-3 border-b border-emerald-100">
                                                <PctBadge pct={gradeTotal?.presentPct ?? 0} type="present" />
                                            </td>
                                        </tr>

                                        {/* Absent count row */}
                                        <tr>
                                            <td className="bg-rose-600 text-white font-black text-sm px-4 py-3 text-right sticky right-0 z-10 border-b border-rose-700 whitespace-nowrap">
                                                الغائبون
                                            </td>
                                            {gradeClasses.map((cls: any) => (
                                                <td key={cls.classId} className="bg-rose-50/60 px-3 py-3 border-b border-r border-rose-100">
                                                    <AbsentBadge value={cls.hasData ? cls.absentCount : 0} />
                                                </td>
                                            ))}
                                            <td className="bg-rose-100 px-3 py-3 border-b border-rose-200">
                                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-sm font-black bg-qatar-maroon text-white shadow-sm">
                                                    <X className="w-3.5 h-3.5" />{gradeTotal?.absentCount ?? 0}
                                                </span>
                                            </td>
                                        </tr>

                                        {/* Absence % row */}
                                        <tr>
                                            <td className="bg-rose-50 text-rose-800 font-black text-sm px-4 py-3 text-right sticky right-0 z-10 border-b border-rose-100 whitespace-nowrap">
                                                نسبة الغياب
                                            </td>
                                            {gradeClasses.map((cls: any) => (
                                                <td key={cls.classId} className="bg-white px-3 py-3 border-b border-r border-slate-100">
                                                    {cls.hasData
                                                        ? <PctBadge pct={cls.absentPct} type="absent" />
                                                        : <span className="text-slate-300 text-xs">—</span>
                                                    }
                                                </td>
                                            ))}
                                            <td className="bg-rose-50 px-3 py-3 border-b border-rose-100">
                                                <PctBadge pct={gradeTotal?.absentPct ?? 0} type="absent" />
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    {/* Legend */}
                    <div className="flex flex-wrap gap-3 justify-center">
                        {[
                            { bg: "bg-emerald-700", label: "صف نشط (به بيانات)", text: "text-white" },
                            { bg: "bg-slate-500",   label: "صف بدون بيانات",     text: "text-white" },
                            { bg: "bg-amber-100",   label: "العدد الكلي" },
                            { bg: "bg-emerald-100 border border-emerald-200", label: "نسبة الحضور" },
                            { bg: "bg-rose-100 border border-rose-200",       label: "نسبة الغياب" },
                        ].map(item => (
                            <div key={item.label} className="flex items-center gap-2">
                                <span className={`w-4 h-4 rounded ${item.bg}`} />
                                <span className="text-xs font-bold text-slate-500">{item.label}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
