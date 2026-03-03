import { useState, useMemo } from "react";
import { useQuery } from "convex/react";
import { format } from "date-fns";
import { Calendar, Layers, Users, UserCheck, UserX, Activity, BarChart3 } from "lucide-react";
// @ts-ignore
import { api } from "../../convex/_generated/api";

export default function AdminDashboard() {
    const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
    const [selectedGrade, setSelectedGrade] = useState<number>(10);
    const data = useQuery(api.attendance.getDailySummary, { date });

    const tableData = useMemo(() => {
        if (!data || !data.classes) return null;

        const { classes } = data;

        // Filter classes by selected grade
        let gradeClasses = classes.filter((c: any) => c.grade === selectedGrade);

        // Sort descending by name so 10-10 is first, 10-1 is last like in the image
        gradeClasses.sort((a: any, b: any) => {
            // Very simple numeric sort if the name ends with a number
            const numA = parseInt(a.name.split('-')[1] || "0", 10);
            const numB = parseInt(b.name.split('-')[1] || "0", 10);
            return numB - numA;
        });

        const totalStudents = gradeClasses.reduce((acc: number, c: any) => acc + c.totalStudents, 0);
        const totalPresent = gradeClasses.reduce((acc: number, c: any) => acc + c.dayPresent, 0);
        const totalAbsent = gradeClasses.reduce((acc: number, c: any) => acc + c.dayAbsent, 0);
        const percentage = totalStudents > 0 ? (totalPresent / totalStudents) * 100 : 0;
        const absentPercentage = totalStudents > 0 ? (totalAbsent / totalStudents) * 100 : 0;

        return {
            classes: gradeClasses,
            summary: {
                totalStudents,
                totalPresent,
                totalAbsent,
                percentage,
                absentPercentage
            }
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


    // Formatting date
    const parsedDate = new Date(date);
    const formattedDate = format(parsedDate, "d/MM/yyyy");

    const gradeLabel = selectedGrade === 10 ? "عاشر" : selectedGrade === 11 ? "حادي عشر" : "ثاني عشر";

    return (
        <div className="max-w-7xl mx-auto space-y-8 font-sans transition-all animate-in fade-in duration-500">
            {/* Page Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-8 rounded-2xl qatar-card-shadow border border-qatar-gray-border">
                <div className="space-y-2">
                    <h1 className="text-3xl font-black text-slate-800 flex items-center gap-3">
                        <div className="w-2 h-8 bg-qatar-maroon rounded-full"></div>
                        لوحة المتابعة اليومية
                    </h1>
                    <p className="text-qatar-gray-text font-medium mr-5">مدرسة ابن تيمية الثانوية للبنين - Ibn Taymiyyah School</p>
                </div>

                <div className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-3 bg-qatar-gray-bg px-4 py-2 rounded-xl border border-qatar-gray-border">
                        <Calendar className="w-5 h-5 text-qatar-maroon" />
                        <input
                            type="date"
                            className="bg-transparent border-none outline-none font-black text-slate-700 cursor-pointer"
                            value={date}
                            onChange={e => setDate(e.target.value)}
                        />
                    </div>

                    <div className="flex items-center gap-3 bg-qatar-gray-bg px-4 py-2 rounded-xl border border-qatar-gray-border">
                        <Layers className="w-5 h-5 text-qatar-maroon" />
                        <select
                            className="bg-transparent border-none outline-none font-black text-slate-700 cursor-pointer"
                            value={selectedGrade}
                            onChange={(e) => setSelectedGrade(Number(e.target.value))}
                        >
                            <option value={10}>الصف العاشر</option>
                            <option value={11}>الصف الحادي عشر</option>
                            <option value={12}>الصف الثاني عشر</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Summary Statistics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-5">
                <StatCard
                    label="طلاب مكتشفون اليوم"
                    value={data?.summary?.totalStudents || 0}
                    subValue={`من أصل ${data?.summary?.totalCapacity || 0}`}
                    icon={<Users className="w-6 h-6" />}
                    maroon
                />
                <StatCard
                    label="حاضرون فعلياً"
                    value={data?.summary?.totalPresent || 0}
                    icon={<UserCheck className="w-6 h-6" />}
                    trend="success"
                />
                <StatCard
                    label="غائبون فعلياً"
                    value={data?.summary?.totalAbsent || 0}
                    icon={<UserX className="w-6 h-6" />}
                    trend="danger"
                />
                <StatCard
                    label="نسبة الحضور الحقيقية"
                    value={data?.summary?.percentage ? `${data.summary.percentage.toFixed(1)}%` : "0%"}
                    subValue={data?.summary?.totalStudents ? `لـ ${data.summary.totalStudents} طالب` : ""}
                    icon={<Activity className="w-6 h-6" />}
                    trend={data?.summary?.percentage && data.summary.percentage > 90 ? "success" : "warning"}
                />
                <StatCard
                    label="الصفوف المكتملة"
                    value={data?.summary?.classesImported || 0}
                    subValue={`من أصل ${data?.summary?.totalClasses || 0}`}
                    icon={<Layers className="w-6 h-6" />}
                    vibrant
                />
            </div>

            {/* Main Table Section */}
            <div className="bg-white rounded-2xl qatar-card-shadow border border-qatar-gray-border overflow-hidden">
                <div className="bg-qatar-maroon px-8 py-5 flex justify-between items-center">
                    <h2 className="text-xl font-black text-white flex items-center gap-3">
                        <BarChart3 className="w-6 h-6 text-maroon-100" />
                        تقرير الحضور والغياب - {gradeLabel}
                    </h2>
                    <div className="bg-white/10 px-4 py-1 rounded-full text-white/90 text-sm font-bold backdrop-blur-md border border-white/20">
                        للتاريخ: {formattedDate}
                    </div>
                </div>

                <div className="overflow-x-auto">
                    {(!classes || classes.length === 0) ? (
                        <div className="p-20 text-center flex flex-col items-center gap-4">
                            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center">
                                <Users className="w-10 h-10 text-slate-200" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-400 font-black">لا توجد بيانات لهذا التاريخ</h3>
                        </div>
                    ) : (
                        <table className="w-full border-collapse text-right">
                            <thead>
                                <tr className="bg-slate-50 border-b border-qatar-gray-border">
                                    <th className="py-4 px-6 text-sm font-black text-slate-500 uppercase tracking-wider">صف الدراسة</th>
                                    <th className="py-4 px-6 text-sm font-black text-slate-500 uppercase tracking-wider">العدد الكلي</th>
                                    <th className="py-4 px-6 text-sm font-black text-slate-500 uppercase tracking-wider text-teal-600">الحضور</th>
                                    <th className="py-4 px-6 text-sm font-black text-slate-500 uppercase tracking-wider text-red-600">الغياب</th>
                                    <th className="py-4 px-6 text-sm font-black text-slate-500 uppercase tracking-wider">نسبة الحضور</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-qatar-gray-border">
                                {classes.map((cls: any) => (
                                    <tr key={cls._id} className="hover:bg-slate-50/50 transition-colors group">
                                        <td className="py-4 px-6 font-black text-slate-700 group-hover:text-qatar-maroon">{cls.name}</td>
                                        <td className="py-4 px-6 font-bold text-slate-600">{cls.totalStudents}</td>
                                        <td className="py-4 px-6 font-black text-teal-700 bg-teal-50/30">{cls.dayPresent}</td>
                                        <td className="py-4 px-6 font-black text-red-700 bg-red-50/30">{cls.dayAbsent}</td>
                                        <td className="py-4 px-6">
                                            <div className="flex items-center gap-3 justify-end">
                                                <span className={`text-sm font-black ${cls.presentPercentage > 90 ? 'text-teal-600' : 'text-slate-500'}`}>
                                                    {cls.presentPercentage.toFixed(1)}%
                                                </span>
                                                <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden hidden sm:block">
                                                    <div
                                                        className={`h-full rounded-full ${cls.presentPercentage > 90 ? 'bg-teal-500' : cls.presentPercentage > 75 ? 'bg-amber-500' : 'bg-red-500'}`}
                                                        style={{ width: `${cls.presentPercentage}%` }}
                                                    ></div>
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {/* Grade Totals Row */}
                                <tr className="bg-qatar-gray-bg font-black">
                                    <td className="py-6 px-6 text-slate-800">إجمالي {gradeLabel}</td>
                                    <td className="py-6 px-6 text-slate-600 font-black">{summary?.totalStudents}</td>
                                    <td className="py-6 px-6 text-teal-800 font-black">{summary?.totalPresent}</td>
                                    <td className="py-6 px-6 text-red-800 font-black">{summary?.totalAbsent}</td>
                                    <td className="py-6 px-6">
                                        <span className="bg-qatar-maroon text-white px-3 py-1 rounded-lg text-sm">
                                            {summary?.percentage.toFixed(1)}%
                                        </span>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

        </div>
    );
}

function StatCard({ label, value, icon, subValue, maroon, vibrant, trend }: {
    label: string;
    value: string | number;
    icon: React.ReactNode;
    subValue?: string;
    maroon?: boolean;
    vibrant?: boolean;
    trend?: 'success' | 'warning' | 'danger';
}) {
    const trendColors = {
        success: 'text-emerald-600 bg-emerald-50 border-emerald-100',
        warning: 'text-amber-600 bg-amber-50 border-amber-100',
        danger: 'text-rose-600 bg-rose-50 border-rose-100',
    };

    return (
        <div className="bg-white p-6 rounded-2xl qatar-card-shadow border border-qatar-gray-border flex flex-col gap-4 relative overflow-hidden group">
            {maroon && <div className="absolute top-0 right-0 left-0 h-1 bg-qatar-maroon"></div>}

            <div className="flex justify-between items-start">
                <div className={`p-3 rounded-xl ${maroon ? 'bg-qatar-maroon text-white' :
                    vibrant ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'
                    }`}>
                    {icon}
                </div>
                {trend && (
                    <div className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${trendColors[trend]}`}>
                        {trend === 'success' ? 'ممتاز' : trend === 'warning' ? 'متوسط' : 'منخفض'}
                    </div>
                )}
            </div>

            <div>
                <p className="text-xs font-black text-slate-400 uppercase tracking-wider mb-1">{label}</p>
                <div className="flex items-baseline gap-2">
                    <h3 className="text-2xl font-black text-slate-800">{value}</h3>
                    {subValue && <span className="text-xs font-bold text-slate-400">{subValue}</span>}
                </div>
            </div>

            <div className="absolute -bottom-2 -left-2 w-12 h-12 bg-slate-50 rounded-full group-hover:scale-150 transition-transform duration-500 -z-10 opacity-50"></div>
        </div>
    );
}
