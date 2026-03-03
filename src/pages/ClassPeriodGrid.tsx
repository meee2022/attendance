import { useQuery, useMutation } from "convex/react";
// @ts-ignore
import { api } from "../../convex/_generated/api";

const PERIOD_LABELS = [
    "الأولى",
    "الثانية",
    "الثالثة",
    "الرابعة",
    "الخامسة",
    "السادسة",
    "السابعة",
];

interface ClassPeriodGridProps {
    classId: string;
    schoolId: string;
    date: string;
    periodsPerDay: number;
}

export default function ClassPeriodGrid({ classId, schoolId, date, periodsPerDay }: ClassPeriodGridProps) {
    const data = useQuery(api.attendance.getClassPeriodGrid, {
        classId: classId as any,
        date,
        periodsPerDay,
    });

    const toggle = useMutation(api.attendance.toggleAttendance);

    const handleToggle = (studentId: string, periodNumber: number) => {
        toggle({
            schoolId: schoolId as any,
            classId: classId as any,
            studentId: studentId as any,
            date,
            periodNumber,
        });
    };

    if (data === undefined) {
        return (
            <div className="text-center p-8 text-slate-500 font-bold">
                جاري تحميل بيانات الحصص...
            </div>
        );
    }

    if (!data) {
        return (
            <div className="text-center p-8 text-red-500 font-bold">
                الصف غير موجود
            </div>
        );
    }

    const { rows, periodSummary } = data;

    if (rows.length === 0) {
        return (
            <div className="text-center p-8 text-slate-500 font-bold">
                لا يوجد طلاب مسجلين في هذا الصف
            </div>
        );
    }

    return (
        <div className="overflow-x-auto pb-2">
            <table className="min-w-max w-full border-collapse border-2 border-slate-700 text-center font-bold text-sm whitespace-nowrap">
                {/* Header Row */}
                <thead>
                    <tr>
                        <th className="bg-[#009b9f] text-white py-2 px-2 border border-slate-700 min-w-[30px]">
                            م
                        </th>
                        <th className="bg-[#009b9f] text-white py-2 px-4 border border-slate-700 min-w-[200px] text-right">
                            الاسم
                        </th>
                        <th className="bg-[#009b9f] text-white py-2 px-2 border border-slate-700 min-w-[50px]">
                            المقبل
                        </th>
                        {Array.from({ length: periodsPerDay }, (_, i) => (
                            <th
                                key={i}
                                className="bg-[#4fc3f7] text-white py-2 px-2 border border-slate-700 min-w-[60px]"
                            >
                                {PERIOD_LABELS[i] || `${i + 1}`}
                            </th>
                        ))}
                        <th className="bg-[#009b9f] text-white py-2 px-2 border border-slate-700 min-w-[50px]">
                            حصص اليوم
                        </th>
                        <th className="bg-[#009b9f] text-white py-2 px-2 border border-slate-700 min-w-[50px]">
                            حصص الحضور
                        </th>
                        <th className="bg-[#009b9f] text-white py-2 px-2 border border-slate-700 min-w-[50px]">
                            حصص الغياب
                        </th>
                        <th className="bg-[#009b9f] text-white py-2 px-2 border border-slate-700 min-w-[60px]">
                            نسبة الحضور
                        </th>
                        <th className="bg-[#009b9f] text-white py-2 px-2 border border-slate-700 min-w-[80px]">
                            جوال
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row: any) => {
                        const attendanceRate =
                            row.totalRecordedPeriods > 0
                                ? Math.round((row.presentCount / row.totalRecordedPeriods) * 100)
                                : 0;

                        return (
                            <tr key={row.studentId} className="hover:bg-blue-50/30 transition-colors">
                                {/* Row number */}
                                <td className="bg-slate-50 text-slate-700 py-1.5 px-2 border border-slate-700">
                                    {row.index}
                                </td>
                                {/* Student name */}
                                <td className="bg-white text-slate-900 py-1.5 px-3 border border-slate-700 text-right">
                                    {row.studentName}
                                </td>
                                {/* Class section */}
                                <td className="bg-slate-50 text-slate-600 py-1.5 px-2 border border-slate-700 text-xs">
                                    {row.classSection}
                                </td>
                                {/* Period cells — CLICKABLE */}
                                {row.periods.map((p: any) => {
                                    const isAbsent = p.status === "absent";
                                    const isPresent = p.status === "present";
                                    const noData = p.status === "no_data";

                                    return (
                                        <td
                                            key={p.periodNumber}
                                            onClick={() => handleToggle(row.studentId, p.periodNumber)}
                                            className={`py-1.5 px-2 border border-slate-700 cursor-pointer select-none transition-all active:scale-90 ${isAbsent
                                                    ? "bg-[#ffcdd2] hover:bg-[#ef9a9a]"
                                                    : isPresent
                                                        ? "bg-[#c8e6c9] hover:bg-[#a5d6a7]"
                                                        : "bg-slate-100 hover:bg-slate-200"
                                                }`}
                                            title={`اضغط لتبديل الحضور/الغياب - الحصة ${PERIOD_LABELS[p.periodNumber - 1] || p.periodNumber}`}
                                        >
                                            {isAbsent && (
                                                <span className="text-red-700 text-lg font-extrabold">✗</span>
                                            )}
                                            {isPresent && (
                                                <span className="text-green-800 text-lg">✓</span>
                                            )}
                                            {noData && (
                                                <span className="text-slate-400 text-sm">0</span>
                                            )}
                                        </td>
                                    );
                                })}
                                {/* Periods today */}
                                <td className="bg-white text-slate-800 py-1.5 px-2 border border-slate-700">
                                    {row.totalRecordedPeriods}
                                </td>
                                {/* Periods present */}
                                <td className="bg-white text-slate-800 py-1.5 px-2 border border-slate-700">
                                    {row.presentCount}
                                </td>
                                {/* Periods absent */}
                                <td className={`py-1.5 px-2 border border-slate-700 ${row.absentCount > 0 ? "bg-[#ffcdd2] text-red-900" : "bg-white text-slate-800"
                                    }`}>
                                    {row.absentCount}
                                </td>
                                {/* Attendance rate */}
                                <td className="bg-white text-slate-800 py-1.5 px-2 border border-slate-700">
                                    {row.totalRecordedPeriods > 0 ? `${attendanceRate}%` : "─"}
                                </td>
                                {/* Phone */}
                                <td className="bg-white text-slate-600 py-1.5 px-2 border border-slate-700 text-xs" dir="ltr">
                                    {row.guardianPhone || "─"}
                                </td>
                            </tr>
                        );
                    })}

                    {/* Summary Row — Absents per period */}
                    <tr className="border-t-4 border-slate-800">
                        <td
                            colSpan={3}
                            className="bg-[#fff9c4] text-slate-900 py-2 px-4 border border-slate-700 text-right"
                        >
                            عدد الغائبين
                        </td>
                        {periodSummary.map((ps: any) => (
                            <td
                                key={`abs-${ps.periodNumber}`}
                                className={`py-2 px-2 border border-slate-700 font-extrabold ${ps.absent > 0
                                        ? "bg-[#ffcdd2] text-red-900"
                                        : "bg-[#c8e6c9] text-green-900"
                                    }`}
                            >
                                {ps.absent}
                            </td>
                        ))}
                        <td colSpan={4} className="bg-[#fff9c4] border border-slate-700"></td>
                        <td className="bg-[#fff9c4] border border-slate-700"></td>
                    </tr>
                    {/* Summary Row — Present per period */}
                    <tr>
                        <td
                            colSpan={3}
                            className="bg-[#c8e6c9] text-green-900 py-2 px-4 border border-slate-700 text-right"
                        >
                            عدد الحاضرين
                        </td>
                        {periodSummary.map((ps: any) => (
                            <td
                                key={`pres-${ps.periodNumber}`}
                                className="bg-[#c8e6c9] text-green-900 py-2 px-2 border border-slate-700 font-extrabold"
                            >
                                {ps.present}
                            </td>
                        ))}
                        <td colSpan={4} className="bg-[#c8e6c9] border border-slate-700"></td>
                        <td className="bg-[#c8e6c9] border border-slate-700"></td>
                    </tr>
                </tbody>
            </table>

            {/* Legend */}
            <div className="flex items-center gap-6 mt-3 text-xs text-slate-600 justify-end px-2">
                <div className="flex items-center gap-1">
                    <span className="inline-block w-4 h-4 bg-[#c8e6c9] border border-slate-400 rounded-sm"></span>
                    <span>حاضر (اضغط للتبديل)</span>
                </div>
                <div className="flex items-center gap-1">
                    <span className="inline-block w-4 h-4 bg-[#ffcdd2] border border-slate-400 rounded-sm"></span>
                    <span>غائب (اضغط للتبديل)</span>
                </div>
                <div className="flex items-center gap-1">
                    <span className="inline-block w-4 h-4 bg-slate-100 border border-slate-400 rounded-sm"></span>
                    <span>لم يتم الرصد</span>
                </div>
            </div>
        </div>
    );
}
