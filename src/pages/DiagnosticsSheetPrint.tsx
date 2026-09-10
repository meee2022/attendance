import { useEffect } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "convex/react";
// @ts-ignore
import { api } from "../../convex/_generated/api";
import { printableSchoolName } from "../lib/brand";

// The signed record of what was entered: students down, questions across, one
// table per class, with the signature lines the paperwork needs.

const GRADE_LABELS: Record<number, string> = { 10: "العاشر", 11: "الحادي عشر", 12: "الثاني عشر" };

export default function DiagnosticsSheetPrint() {
    const { testId } = useParams();
    const [params] = useSearchParams();
    const className = params.get("class") || "";
    const subjectName = params.get("subject") || "";

    const data = useQuery(api.diagnostics.getExportData, {
        testId: testId as any,
        ...(className ? { className } : {}),
        ...(subjectName ? { subjectName } : {}),
    }) as any;

    useEffect(() => {
        if (data) document.title = `كشف رصد - ${data.test.title}`;
    }, [data]);

    if (data === undefined) {
        return <div dir="rtl" className="p-10 text-center font-bold text-slate-500">جاري تجهيز الكشف…</div>;
    }
    if (!data) {
        return <div dir="rtl" className="p-10 text-center font-bold text-slate-500">الاختبار غير موجود.</div>;
    }

    const isCombined = (data.test.subjectNames?.length ?? 0) > 1;

    return (
        <div dir="rtl" className="sheet-print bg-white text-slate-900">
            <style>{`
                @page { size: A4 landscape; margin: 8mm; }
                @media print {
                    .no-print { display: none !important; }
                    .sheet-print { font-size: 9px; }
                    .class-block { break-after: page; }
                    .class-block:last-child { break-after: auto; }
                }
                .sheet-print table { border-collapse: collapse; width: 100%; }
                .sheet-print th, .sheet-print td { border: 1px solid #64748b; padding: 2px 4px; }
                .sheet-print th { background: #f1f5f9; font-weight: 700; }
                .sheet-print .c { text-align: center; }
            `}</style>

            <div className="no-print p-4 flex items-center gap-3 bg-slate-100 border-b border-slate-200 flex-wrap">
                <button onClick={() => window.print()}
                    className="px-5 py-2 rounded-xl bg-qatar-maroon text-white font-black text-sm">
                    طباعة / حفظ PDF
                </button>
                <span className="text-xs font-bold text-slate-500">
                    {data.sheets.length} شعبة · {data.questions.length} سؤال · من {data.totalMarks}
                    {subjectName ? ` · مادة ${subjectName}` : ""}
                </span>
            </div>

            {data.sheets.map((sheet: any) => (
                <div key={sheet.className} className="class-block p-3">
                    <div className="text-center mb-1">
                        <p className="font-black text-sm">مدرسة / {printableSchoolName(data.schoolName)}</p>
                        <p className="font-black text-base">كشف رصد الاختبار التشخيصي</p>
                        <p className="text-xs font-bold">{data.test.title}</p>
                    </div>

                    <table className="mb-2" style={{ border: "none" }}>
                        <tbody>
                            <tr>
                                <td style={{ border: "none" }} className="text-right font-bold">
                                    الصف: {GRADE_LABELS[data.test.grade] ?? data.test.grade}
                                    {"  ·  "}الشعبة: {sheet.className} ({sheet.track})
                                </td>
                                <td style={{ border: "none" }} className="text-center font-bold">
                                    {isCombined ? "المواد" : "المادة"}:{" "}
                                    {subjectName || (data.test.subjectNames ?? []).join(" + ")}
                                </td>
                                <td style={{ border: "none" }} className="text-left font-bold">
                                    الدرجة الكلية: {data.totalMarks}
                                    {"  ·  "}حد الإتقان: {Math.round(data.test.masteryThreshold * 100)}%
                                </td>
                            </tr>
                        </tbody>
                    </table>

                    <table>
                        <thead>
                            <tr>
                                <th rowSpan={isCombined ? 3 : 2} style={{ width: "22px" }}>م</th>
                                <th rowSpan={isCombined ? 3 : 2} style={{ minWidth: "150px" }}>اسم الطالب</th>
                                <th colSpan={data.questions.length}>الأسئلة</th>
                                <th rowSpan={isCombined ? 3 : 2} style={{ width: "42px" }}>المجموع</th>
                                <th rowSpan={isCombined ? 3 : 2} style={{ width: "42px" }}>النسبة</th>
                                <th rowSpan={isCombined ? 3 : 2} style={{ width: "52px" }}>الحالة</th>
                            </tr>
                            {isCombined && (
                                <tr>
                                    {data.questions.map((q: any) => (
                                        <th key={`s${q.n}`} style={{ fontSize: "7px", fontWeight: 600 }}>
                                            {q.subjectName}
                                        </th>
                                    ))}
                                </tr>
                            )}
                            <tr>
                                {data.questions.map((q: any) => (
                                    <th key={q.n} className="c" style={{ minWidth: "26px" }}>
                                        {q.n}
                                        <div style={{ fontSize: "7px", fontWeight: 400 }}>({q.maxMark})</div>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {sheet.students.map((s: any, i: number) => (
                                <tr key={s.studentName + i}>
                                    <td className="c">{i + 1}</td>
                                    <td className="font-bold">{s.studentName}</td>
                                    {s.marks.map((m: number | null, qi: number) => (
                                        <td key={qi} className="c">{s.isAbsent ? "—" : m === null ? "" : m}</td>
                                    ))}
                                    <td className="c font-bold">{s.total ?? ""}</td>
                                    <td className="c">{s.percent === null ? "" : `${(s.percent * 100).toFixed(0)}%`}</td>
                                    <td className="c" style={{ fontSize: "8px" }}>
                                        {s.isAbsent ? "غائب" : s.answered === 0 ? "لم يُرصد" : s.mastered ? "متقن" : "غير متقن"}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    <table className="mt-3" style={{ border: "none" }}>
                        <tbody>
                            <tr>
                                <td style={{ border: "none" }} className="text-center font-bold py-3">
                                    معلم المادة<br/>................................
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
            ))}
        </div>
    );
}
