import { useEffect } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "convex/react";
// @ts-ignore
import { api } from "../../convex/_generated/api";
import { printableSchoolName } from "../lib/brand";

// One student's diagnostic card: total, level, and every skill with a bar —
// the sheet the Excel file could only produce by hand, one student at a time.

const GRADE_LABELS: Record<number, string> = { 10: "العاشر", 11: "الحادي عشر", 12: "الثاني عشر" };

function pct(v: number, digits = 0) {
    return `${(v * 100).toFixed(digits)}%`;
}

function levelOf(p: number): string {
    if (p >= 0.9) return "ممتاز";
    if (p >= 0.8) return "جيد جدًا";
    if (p >= 0.7) return "جيد";
    if (p >= 0.6) return "مقبول";
    return "دون المستوى";
}

function barColor(p: number, threshold: number) {
    if (p >= 0.9) return "#059669";
    if (p >= threshold) return "#0891b2";
    if (p >= threshold * 0.75) return "#f59e0b";
    return "#e11d48";
}

export default function DiagnosticsPrint() {
    const { testId, studentId } = useParams();

    const report = useQuery(api.diagnostics.getStudentReport,
        testId && studentId ? { testId: testId as any, studentId: studentId as any } : "skip" as any
    ) as any;

    useEffect(() => {
        if (report) document.title = `تقرير تشخيصي - ${report.studentName}`;
    }, [report]);

    if (report === undefined) {
        return <div dir="rtl" className="p-10 text-center font-bold text-slate-500">جاري تجهيز التقرير…</div>;
    }
    if (!report) {
        return <div dir="rtl" className="p-10 text-center font-bold text-slate-500">لا توجد درجات مرصودة لهذا الطالب.</div>;
    }

    const threshold = report.test.masteryThreshold;
    const weakest = report.skills.filter((s: any) => !s.mastered);

    return (
        <div dir="rtl" className="diag-print bg-white text-slate-900">
            <style>{`
                @page { size: A4 portrait; margin: 12mm; }
                @media print { .no-print { display: none !important; } }
                .diag-print table { border-collapse: collapse; width: 100%; }
                .diag-print th, .diag-print td { border: 1px solid #94a3b8; padding: 4px 6px; font-size: 11px; }
                .diag-print th { background: #f1f5f9; font-weight: 700; }
                .bar-track { background: #e2e8f0; height: 10px; border-radius: 5px; overflow: hidden; }
                .bar-fill { height: 100%; border-radius: 5px; }
            `}</style>

            <div className="no-print p-4 flex items-center gap-3 bg-slate-100 border-b border-slate-200">
                <button onClick={() => window.print()} className="px-5 py-2 rounded-xl bg-qatar-maroon text-white font-black text-sm">
                    طباعة
                </button>
            </div>

            <div className="p-4 space-y-4">
                <div className="text-center">
                    <p className="font-black text-sm">مدرسة / {printableSchoolName(report.schoolName)}</p>
                    <p className="font-black text-lg">تقرير الاختبار التشخيصي</p>
                    <p className="text-xs font-bold text-slate-600">{report.test.title}</p>
                </div>

                <table>
                    <tbody>
                        <tr>
                            <th style={{ width: "22%" }}>اسم الطالب</th>
                            <td className="font-black">{report.studentName}</td>
                            <th style={{ width: "16%" }}>الشعبة</th>
                            <td>{report.className}</td>
                        </tr>
                        <tr>
                            <th>المادة</th>
                            <td>{report.test.subjectName}</td>
                            <th>الصف</th>
                            <td>{GRADE_LABELS[report.test.grade] ?? report.test.grade}</td>
                        </tr>
                        <tr>
                            <th>الدرجة</th>
                            <td className="font-black">{report.total} من {report.test.totalMarks}</td>
                            <th>النسبة</th>
                            <td className="font-black">{pct(report.percent)}</td>
                        </tr>
                        <tr>
                            <th>المستوى</th>
                            <td className="font-black">{levelOf(report.percent)}</td>
                            <th>الإتقان (حد {pct(threshold)})</th>
                            <td className="font-black" style={{ color: report.mastered ? "#059669" : "#e11d48" }}>
                                {report.mastered ? "متقن" : "غير متقن"}
                            </td>
                        </tr>
                    </tbody>
                </table>

                <div>
                    <p className="font-black text-sm mb-2">التحليل حسب المهارات</p>
                    <table>
                        <thead>
                            <tr>
                                <th style={{ width: "34%" }}>المهارة</th>
                                <th style={{ width: "10%" }}>الأسئلة</th>
                                <th style={{ width: "14%" }}>الدرجة</th>
                                <th style={{ width: "12%" }}>النسبة</th>
                                <th>المؤشر</th>
                                <th style={{ width: "12%" }}>الحالة</th>
                            </tr>
                        </thead>
                        <tbody>
                            {report.skills.map((s: any) => (
                                <tr key={s.label}>
                                    <td className="font-bold">{s.label}</td>
                                    <td className="text-center">{s.questionCount}</td>
                                    <td className="text-center">{s.score} / {s.maxMark}</td>
                                    <td className="text-center font-black">{pct(s.percent)}</td>
                                    <td>
                                        <div className="bar-track">
                                            <div className="bar-fill" style={{
                                                width: `${s.percent * 100}%`,
                                                background: barColor(s.percent, threshold),
                                            }}/>
                                        </div>
                                    </td>
                                    <td className="text-center font-black"
                                        style={{ color: s.mastered ? "#059669" : "#e11d48" }}>
                                        {s.mastered ? "متقن" : "يحتاج دعم"}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {weakest.length > 0 && (
                    <div>
                        <p className="font-black text-sm mb-1">المهارات التي تحتاج خطة علاجية</p>
                        <p className="text-xs font-bold leading-relaxed">
                            {weakest.map((s: any) => `${s.label} (${pct(s.percent)})`).join(" · ")}
                        </p>
                    </div>
                )}

                <div>
                    <p className="font-black text-sm mb-2">تفصيل الأسئلة</p>
                    <table>
                        <thead>
                            <tr>
                                <th style={{ width: "10%" }}>السؤال</th>
                                <th>المهارة</th>
                                <th style={{ width: "14%" }}>الدرجة</th>
                                <th style={{ width: "14%" }}>من</th>
                            </tr>
                        </thead>
                        <tbody>
                            {report.questions.map((q: any) => (
                                <tr key={q.n}>
                                    <td className="text-center font-black">{q.n}</td>
                                    <td>{q.skillLabel}</td>
                                    <td className="text-center font-bold">{q.score ?? "—"}</td>
                                    <td className="text-center text-slate-500">{q.maxMark}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <table style={{ border: "none" }}>
                    <tbody>
                        <tr>
                            <td style={{ border: "none" }} className="text-center font-bold py-4">
                                معلم المادة<br/>................................
                            </td>
                            <td style={{ border: "none" }} className="text-center font-bold py-4">
                                منسق المادة<br/>................................
                            </td>
                            <td style={{ border: "none" }} className="text-center font-bold py-4">
                                النائب الأكاديمي<br/>................................
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    );
}
