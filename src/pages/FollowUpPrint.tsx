import { useMemo, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "convex/react";
// @ts-ignore
import { api } from "../../convex/_generated/api";
import { printableSchoolName } from "../lib/brand";

// Recreates the official "كشف تقييم يومي للطلاب" layout: one week across the
// page, each day split into the criteria columns, signatures at the bottom.

const MARK_SYMBOL: Record<string, string> = { partial: "±", no: "✗" };

function isoOf(d: Date) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// The school week runs Sunday → Thursday; anchor on the Sunday of `date`.
function weekDates(date: string): string[] {
    const anchor = new Date(date + "T00:00:00");
    if (isNaN(anchor.getTime())) return [date];
    const sunday = new Date(anchor);
    sunday.setDate(anchor.getDate() - anchor.getDay());
    return Array.from({ length: 5 }, (_, i) => {
        const d = new Date(sunday);
        d.setDate(sunday.getDate() + i);
        return isoOf(d);
    });
}

const DAY_NAMES = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس"];

export default function FollowUpPrint() {
    const { classId, subject, date } = useParams();
    const subjectName = decodeURIComponent(subject ?? "");
    const dates = useMemo(() => weekDates(date ?? isoOf(new Date())), [date]);

    const sheet = useQuery(api.followUp.getWeekSheet,
        classId ? { classId: classId as any, subjectName, dates } : "skip" as any
    ) as any;

    useEffect(() => {
        if (sheet) {
            document.title = `كشف المتابعة اليومية - ${sheet.className} - ${subjectName}`;
        }
    }, [sheet, subjectName]);

    if (!sheet) {
        return <div dir="rtl" className="p-10 text-center font-bold text-slate-500">جاري تجهيز الكشف…</div>;
    }

    const teacherName = sheet.days.find((d: any) => d.teacherName)?.teacherName ?? "";
    const cellFor = (day: any, studentId: string, criterionId: string) => {
        const rec = day.byStudent[studentId];
        if (!rec) return "";
        if (rec.isAbsent) return "غ";
        return MARK_SYMBOL[rec.marks[criterionId]] ?? "";
    };

    return (
        <div dir="rtl" className="followup-print bg-white text-slate-900">
            <style>{`
                @page { size: A4 landscape; margin: 8mm; }
                @media print {
                    .no-print { display: none !important; }
                    .followup-print { font-size: 9px; }
                }
                .followup-print table { border-collapse: collapse; width: 100%; }
                .followup-print th, .followup-print td { border: 1px solid #64748b; padding: 2px 3px; }
                .followup-print th { background: #f1f5f9; font-weight: 700; }
                .followup-print .mark { text-align: center; font-weight: 700; min-width: 18px; }
                .followup-print .day-sep { border-right: 2px solid #334155; }
            `}</style>

            <div className="no-print p-4 flex items-center gap-3 bg-slate-100 border-b border-slate-200">
                <button onClick={() => window.print()}
                    className="px-5 py-2 rounded-xl bg-qatar-maroon text-white font-black text-sm">
                    طباعة
                </button>
                <span className="text-xs font-bold text-slate-500">
                    الأسبوع: {dates[0]} — {dates[dates.length - 1]}
                </span>
            </div>

            <div className="p-3">
                {/* Official header */}
                <div className="text-center mb-1">
                    <p className="font-black text-sm">مدرسة / {printableSchoolName(sheet.schoolName)}</p>
                    <p className="font-black text-base">كشف تقييم يومي للطلاب</p>
                </div>
                <table className="mb-2" style={{ border: "none" }}>
                    <tbody>
                        <tr>
                            <td style={{ border: "none" }} className="text-right font-bold">
                                الصف: {sheet.grade === 10 ? "العاشر" : sheet.grade === 11 ? "الحادي عشر" : "الثاني عشر"}
                                {"  ·  "}الشعبة: {sheet.className} ({sheet.track})
                            </td>
                            <td style={{ border: "none" }} className="text-center font-bold">
                                المادة: {sheet.subjectName}
                            </td>
                            <td style={{ border: "none" }} className="text-left font-bold">
                                الأسبوع من {dates[0]} إلى {dates[dates.length - 1]}
                            </td>
                        </tr>
                        <tr>
                            <td style={{ border: "none" }} className="text-right font-bold">
                                اسم المعلم: {teacherName || "................................"}
                            </td>
                            <td style={{ border: "none" }} colSpan={2} className="text-left font-bold">
                                الرموز: ✓ ملتزم · ± جزئي · ✗ غير ملتزم · غ غائب
                            </td>
                        </tr>
                    </tbody>
                </table>

                <table>
                    <thead>
                        <tr>
                            <th rowSpan={2} style={{ width: "22px" }}>م</th>
                            <th rowSpan={2} style={{ minWidth: "160px" }}>اسم الطالب</th>
                            {sheet.days.map((day: any, i: number) => (
                                <th key={day.date} colSpan={sheet.criteria.length} className="day-sep">
                                    {DAY_NAMES[i] ?? ""} {day.date.slice(5)}
                                    {!day.isRecorded && <span className="font-normal"> (لم يُرصد)</span>}
                                </th>
                            ))}
                            <th rowSpan={2} style={{ minWidth: "90px" }}>ملاحظات</th>
                        </tr>
                        <tr>
                            {sheet.days.map((day: any) =>
                                sheet.criteria.map((c: any, ci: number) => (
                                    <th key={day.date + c.id} className={ci === 0 ? "day-sep" : ""}
                                        style={{ writingMode: "vertical-rl", height: "78px", fontSize: "8px", fontWeight: 600 }}>
                                        {c.label}
                                    </th>
                                ))
                            )}
                        </tr>
                    </thead>
                    <tbody>
                        {sheet.students.map((s: any, idx: number) => {
                            const notes = sheet.days
                                .map((d: any) => d.byStudent[s.studentId]?.notes)
                                .filter(Boolean)
                                .join(" · ");
                            return (
                                <tr key={s.studentId}>
                                    <td className="mark">{idx + 1}</td>
                                    <td className="font-bold">{s.fullName}</td>
                                    {sheet.days.map((day: any) =>
                                        sheet.criteria.map((c: any, ci: number) => (
                                            <td key={day.date + c.id} className={`mark ${ci === 0 ? "day-sep" : ""}`}>
                                                {day.isRecorded ? (cellFor(day, s.studentId, c.id) || "✓") : ""}
                                            </td>
                                        ))
                                    )}
                                    <td style={{ fontSize: "8px" }}>{notes}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>

                {/* Signatures — the sheet is not accepted without them */}
                <table className="mt-3" style={{ border: "none" }}>
                    <tbody>
                        <tr>
                            <td style={{ border: "none" }} className="text-center font-bold py-3">
                                معلم المادة<br/>{teacherName || "................................"}
                            </td>
                            <td style={{ border: "none" }} className="text-center font-bold py-3">
                                منسق المادة<br/>................................
                            </td>
                            <td style={{ border: "none" }} className="text-center font-bold py-3">
                                النائب الأكاديمي<br/>................................
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    );
}
