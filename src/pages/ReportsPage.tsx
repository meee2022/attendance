import React, { useState } from "react";
import { useQuery } from "convex/react";
import { format } from "date-fns";
import { Calendar, TrendingUp, Users, UserX, UserCheck, Download } from "lucide-react";
// @ts-ignore
import { api } from "../../convex/_generated/api";

export default function ReportsPage() {
    const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));

    // Fetch school ID from initial data
    const initData = useQuery(api.setup.getInitialData);
    const schoolId = initData?.schools?.[0]?._id;

    const report = useQuery(api.attendance.getAttendanceReport,
        schoolId ? { schoolId, date } : "skip"
    );

    if (!report) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] text-slate-500">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-qatar-maroon mb-4"></div>
                <p className="font-bold font-black">جاري تحميل التقارير...</p>
            </div>
        );
    }

    // Aggregate stats from gradeTotals
    const totalTealPresent = report.gradeTotals.reduce((acc, g) => acc + g.teal.present, 0);
    const totalTealAbsent = report.gradeTotals.reduce((acc, g) => acc + g.teal.absent, 0);
    const totalRedAbsent = report.gradeTotals.reduce((acc, g) => acc + g.red.absent, 0);
    const totalRedPresent = report.gradeTotals.reduce((acc, g) => acc + g.red.present, 0);

    return (
        <div className="max-w-7xl mx-auto space-y-10 pb-20 font-sans transition-all animate-in fade-in duration-500">
            {/* Header & Filter */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-white p-8 rounded-2xl qatar-card-shadow border border-qatar-gray-border">
                <div>
                    <h1 className="text-3xl font-black text-slate-800 flex items-center gap-4">
                        <TrendingUp className="w-8 h-8 text-qatar-maroon" />
                        التقارير الإحصائية المجمعة
                    </h1>
                    <p className="text-qatar-gray-text font-medium mr-12 mt-1">عرض وتحليل حالة الغياب اليومي لجميع المراحل الدراسية</p>
                </div>

                <div className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-3 bg-qatar-gray-bg p-3 px-5 rounded-xl border border-qatar-gray-border shadow-inner">
                        <Calendar className="w-5 h-5 text-qatar-maroon" />
                        <input
                            type="date"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                            className="bg-transparent border-none outline-none font-black text-slate-700 cursor-pointer"
                        />
                    </div>

                    <button className="flex items-center gap-2 text-sm font-black bg-slate-800 text-white px-6 py-3 rounded-xl hover:bg-slate-700 transition-all shadow-md active:scale-95">
                        <Download className="w-4 h-4" />
                        تصدير التقرير
                    </button>
                </div>
            </div>

            {/* School Overall Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                    label="إجمالي طلاب المدرسة"
                    value={report.totalStudents}
                    icon={<Users className="w-6 h-6" />}
                    maroon
                />
                <StatCard
                    label="طلاب حاضرون (فعلي)"
                    value={totalTealPresent}
                    icon={<UserCheck className="w-6 h-6" />}
                    color="text-emerald-600 bg-emerald-50"
                />
                <StatCard
                    label="طلاب غائبون (فعلي)"
                    value={totalRedAbsent}
                    icon={<UserX className="w-6 h-6" />}
                    color="text-rose-600 bg-rose-50"
                />
                <StatCard
                    label="نسبة الحضور العامة"
                    value={`${((totalTealPresent / report.totalStudents) * 100).toFixed(1)}%`}
                    icon={<TrendingUp className="w-6 h-6" />}
                    color="text-indigo-600 bg-indigo-50"
                />
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-10 items-start">
                {/* Method 1: Present-Based */}
                <div className="space-y-6">
                    <div className="bg-white rounded-2xl qatar-card-shadow border border-qatar-gray-border overflow-hidden">
                        <div className="bg-qatar-maroon p-6 text-center text-white">
                            <h2 className="text-xl font-black mb-1 italic">المعيار الأول: الاحتساب حسب الحضور</h2>
                            <p className="text-white/70 text-xs font-bold font-black underline underline-offset-4">الطالب الذي حضر حصة واحدة فأكثر = حاضر</p>
                        </div>

                        <div className="p-6 grid grid-cols-2 gap-4 border-b border-qatar-gray-border bg-slate-50/50">
                            <SummaryItem label="إجمالي الحاضرين" value={totalTealPresent} color="text-emerald-700" />
                            <SummaryItem label="إجمالي الغائبين" value={totalTealAbsent} color="text-rose-700" />
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-right border-collapse">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-qatar-gray-border text-center">
                                        <th className="py-4 px-6 text-xs font-black text-slate-400 uppercase tracking-widest">الشعبة الدراسة</th>
                                        <th className="py-4 px-6 text-xs font-black text-emerald-600 uppercase tracking-widest">حضر</th>
                                        <th className="py-4 px-6 text-xs font-black text-rose-600 uppercase tracking-widest">غاب</th>
                                        <th className="py-4 px-6 text-xs font-black text-slate-400 uppercase tracking-widest">المجموع</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-qatar-gray-border">
                                    {[10, 11, 12].map(grade => {
                                        const gradeClasses = report.classStats.filter((c: any) => c.grade === grade);
                                        const gradeTotal = report.gradeTotals.find((g: any) => g.grade === grade);

                                        return (
                                            <React.Fragment key={grade}>
                                                {gradeClasses.map((cls: any) => (
                                                    <tr key={cls.classId} className="hover:bg-slate-50/50 transition-colors text-center group">
                                                        <td className="py-4 px-6 font-black text-slate-700 text-right">
                                                            <div className="flex flex-col">
                                                                <span className="group-hover:text-qatar-maroon transition-colors">{cls.className}</span>
                                                                {grade !== 10 && <span className="text-[10px] text-qatar-gray-text font-bold italic mr-1">{cls.track}</span>}
                                                            </div>
                                                        </td>
                                                        <td className="py-4 px-6 font-black text-emerald-700 bg-emerald-50/20">{cls.tealTable.present}</td>
                                                        <td className="py-4 px-6 font-black text-rose-700 bg-rose-50/20">{cls.tealTable.absent}</td>
                                                        <td className="py-4 px-6 font-bold text-slate-500">{cls.total}</td>
                                                    </tr>
                                                ))}
                                                {gradeTotal && (
                                                    <tr className="bg-qatar-gray-bg border-y border-qatar-gray-border text-center">
                                                        <td className="py-4 px-6 font-black text-slate-800 text-right underline underline-offset-4 decoration-qatar-maroon">إجمالي الصف {grade}</td>
                                                        <td className="py-4 px-6 font-black text-emerald-800">{gradeTotal.teal.present}</td>
                                                        <td className="py-4 px-6 font-black text-rose-800">{gradeTotal.teal.absent}</td>
                                                        <td className="py-4 px-6 font-black text-slate-800">{gradeTotal.total}</td>
                                                    </tr>
                                                )}
                                            </React.Fragment>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* Method 2: Absent-Based */}
                <div className="space-y-6">
                    <div className="bg-white rounded-2xl qatar-card-shadow border border-qatar-gray-border overflow-hidden">
                        <div className="bg-slate-800 p-6 text-center text-white">
                            <h2 className="text-xl font-black mb-1 italic">المعيار الثاني: الاحتساب حسب الغياب</h2>
                            <p className="text-white/70 text-xs font-bold font-black underline underline-offset-4">الطالب الذي غاب حصتين فأكثر = غائب</p>
                        </div>

                        <div className="p-6 grid grid-cols-2 gap-4 border-b border-qatar-gray-border bg-slate-50/50 text-center">
                            <SummaryItem label="إجمالي الغائبين" value={totalRedAbsent} color="text-rose-700" />
                            <SummaryItem label="إجمالي الحاضرين" value={totalRedPresent} color="text-emerald-700" />
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-right border-collapse">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-qatar-gray-border text-center">
                                        <th className="py-4 px-6 text-xs font-black text-slate-400 uppercase tracking-widest">الشعبة الدراسة</th>
                                        <th className="py-4 px-6 text-xs font-black text-emerald-600 uppercase tracking-widest">حضر</th>
                                        <th className="py-4 px-6 text-xs font-black text-rose-600 uppercase tracking-widest">غاب</th>
                                        <th className="py-4 px-6 text-xs font-black text-slate-400 uppercase tracking-widest">المجموع</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-qatar-gray-border">
                                    {[10, 11, 12].map(grade => {
                                        const gradeClasses = report.classStats.filter((c: any) => c.grade === grade);
                                        const gradeTotal = report.gradeTotals.find((g: any) => g.grade === grade);

                                        return (
                                            <React.Fragment key={grade}>
                                                {gradeClasses.map((cls: any) => (
                                                    <tr key={cls.classId} className="hover:bg-slate-50/50 transition-colors text-center group">
                                                        <td className="py-4 px-6 font-black text-slate-700 text-right text-right">
                                                            <div className="flex flex-col">
                                                                <span className="group-hover:text-qatar-maroon transition-colors">{cls.className}</span>
                                                                {grade !== 10 && <span className="text-[10px] text-qatar-gray-text font-bold italic mr-1">{cls.track}</span>}
                                                            </div>
                                                        </td>
                                                        <td className="py-4 px-6 font-black text-emerald-700 bg-emerald-50/20">{cls.redTable.present}</td>
                                                        <td className="py-4 px-6 font-black text-rose-700 bg-rose-50/20">{cls.redTable.absent}</td>
                                                        <td className="py-4 px-6 font-bold text-slate-500">{cls.total}</td>
                                                    </tr>
                                                ))}
                                                {gradeTotal && (
                                                    <tr className="bg-qatar-gray-bg border-y border-qatar-gray-border text-center">
                                                        <td className="py-4 px-6 font-black text-slate-800 text-right underline underline-offset-4">إجمالي الصف {grade}</td>
                                                        <td className="py-4 px-6 font-black text-emerald-800">{gradeTotal.red.present}</td>
                                                        <td className="py-4 px-6 font-black text-rose-800">{gradeTotal.red.absent}</td>
                                                        <td className="py-4 px-6 font-black text-slate-800">{gradeTotal.total}</td>
                                                    </tr>
                                                )}
                                            </React.Fragment>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function StatCard({ label, value, icon, color, maroon }: { label: string; value: number | string; icon: React.ReactNode; color?: string; maroon?: boolean }) {
    return (
        <div className="bg-white p-6 rounded-2xl border border-qatar-gray-border qatar-card-shadow flex items-center gap-5 transition-all hover:-translate-y-1 relative overflow-hidden group">
            {maroon && <div className="absolute top-0 right-0 left-0 h-1 bg-qatar-maroon"></div>}
            <div className={`p-4 rounded-xl flex-shrink-0 transition-transform group-hover:scale-110 duration-300 ${maroon ? 'bg-qatar-maroon text-white' : (color || 'bg-slate-100 text-slate-500')}`}>
                {icon}
            </div>
            <div>
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">{label}</p>
                <p className="text-2xl font-black text-slate-800">{value}</p>
            </div>
        </div>
    );
}

function SummaryItem({ label, value, color }: { label: string; value: number | string; color: string }) {
    return (
        <div className="flex flex-col items-center text-center">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 whitespace-nowrap">{label}</span>
            <span className={`text-2xl font-black ${color} flex items-baseline gap-1`}>
                {value}
                <span className="text-xs opacity-50 font-medium">طالب</span>
            </span>
        </div>
    );
}
