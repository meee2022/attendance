import { useQuery } from "convex/react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import { format } from "date-fns";
import { ArrowRight, AlertTriangle, Check, UserMinus } from "lucide-react";
// @ts-ignore
import { api } from "../../convex/_generated/api";

export default function ClassDetails() {
    const { classId } = useParams<{ classId: string }>();
    const [searchParams] = useSearchParams();
    const date = searchParams.get("date") || format(new Date(), "yyyy-MM-dd");

    const data = useQuery(api.attendance.getClassDetails, {
        classId: classId as any,
        date
    });

    if (data === undefined) {
        return <div className="text-center p-10 text-slate-500">جاري التحميل...</div>;
    }

    if (!data) {
        return <div className="text-center p-10 text-red-500">الصف غير موجود!</div>;
    }

    const { cls, periods, studentStats } = data;

    // Sorting students: mostly absent first
    const sortedStudents = [...studentStats].sort((a, b) => b.absentCount - a.absentCount);

    return (
        <div className="space-y-6 max-w-5xl mx-auto">
            {/* Header */}
            <div className="flex items-center gap-4 bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <Link to="/" className="p-2 bg-slate-100 hover:bg-slate-200 rounded-full transition-colors">
                    <ArrowRight className="w-5 h-5 text-slate-600" />
                </Link>
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">
                        تفاصيل الغياب: صف {cls.name}
                    </h1>
                    <p className="text-slate-500 mt-1">تاريخ: <span className="font-semibold text-slate-700">{date}</span> | مسجل {periods.length} حصص</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Student List */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="bg-slate-50 px-6 py-4 border-b border-slate-200">
                        <h3 className="font-bold text-slate-800 flex items-center gap-2">
                            <UserMinus className="w-5 h-5 text-indigo-600" />
                            سجل الطلاب
                        </h3>
                    </div>
                    <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
                        {sortedStudents.map(st => (
                            <div key={st._id} className="p-4 hover:bg-slate-50 flex items-center justify-between">
                                <div>
                                    <p className="font-semibold text-slate-800">{st.fullName}</p>
                                    <p className="text-xs text-slate-500">الرقم: {st.nationalId || 'غير متوفر'}</p>
                                </div>
                                <div>
                                    {st.absentCount > 0 ? (
                                        <span className="inline-flex items-center gap-1 bg-rose-100 text-rose-700 px-3 py-1 rounded-full text-sm font-bold">
                                            غائب في {st.absentCount} حصص
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center gap-1 text-emerald-600 text-sm font-bold">
                                            <Check className="w-4 h-4" /> حاضر
                                        </span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Periods Breakdown */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="bg-slate-50 px-6 py-4 border-b border-slate-200">
                        <h3 className="font-bold text-slate-800 flex items-center gap-2">
                            <AlertTriangle className="w-5 h-5 text-amber-500" />
                            تفاصيل الحصص المدخلة
                        </h3>
                    </div>
                    <div className="p-6">
                        {periods.length === 0 ? (
                            <div className="text-center text-slate-500 py-10">
                                لم يتم رصد أي حصص لهذا اليوم بعد.
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {periods.map((p: any) => {
                                    // Calculate absents for this specific period
                                    const pAbsents = studentStats.filter(st => {
                                        return st.attendances.some((a: any) => a.periodId === p._id && a.status === 'absent');
                                    });


                                    return (
                                        <div key={p._id} className="p-4 border border-slate-200 rounded-lg">
                                            <div className="flex justify-between items-center mb-3">
                                                <div className="font-bold text-lg text-indigo-800">الحصة {p.periodNumber}</div>
                                                <div className="bg-indigo-100 text-indigo-800 px-3 py-1 rounded text-sm font-medium">مكتمل</div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-4 text-center">
                                                <div className="bg-rose-50 p-2 rounded">
                                                    <div className="text-xs text-slate-500 mb-1">الطلاب الغائبين</div>
                                                    <div className="text-lg font-bold text-rose-700">{pAbsents.length}</div>
                                                </div>
                                                <div className="bg-emerald-50 p-2 rounded">
                                                    <div className="text-xs text-slate-500 mb-1">الطلاب الحاضرين</div>
                                                    <div className="text-lg font-bold text-emerald-700">{studentStats.length - pAbsents.length}</div>
                                                </div>
                                            </div>

                                            {pAbsents.length > 0 && (
                                                <div className="mt-4 pt-3 border-t border-slate-100">
                                                    <p className="text-xs font-bold text-slate-500 mb-2">قائمة الغياب:</p>
                                                    <div className="flex flex-wrap gap-2">
                                                        {pAbsents.map(st => (
                                                            <span key={st._id} className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded">
                                                                {st.fullName}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
