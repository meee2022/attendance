import { useEffect, useRef } from "react";
import type { CSSProperties } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "convex/react";
// @ts-ignore
import { api } from "../../convex/_generated/api";
import { printableSchoolName } from "../lib/brand";
import { SIGNATURE_LINES } from "../lib/excelExport";
import {
    GRADE_LABELS, assessmentLabelsOf, classSummary, formatMark, statusOf, summaryOf,
} from "../lib/gradesExport";

// Printable copy of a class's short assessments — a page per subject, plus a
// class summary when every subject is exported. Opened from the export button
// it goes straight to the print dialog, where «حفظ بصيغة PDF» saves the file.

const TONE_STYLE: Record<string, CSSProperties> = {
    good: { background: "#d1fae5", color: "#047857", fontWeight: 700 },
    bad: { background: "#fee2e2", color: "#b91c1c", fontWeight: 700 },
    warn: { background: "#fef3c7", color: "#b45309", fontWeight: 700 },
    muted: { color: "#94a3b8" },
};

function Message({ text }: { text: string }) {
    return <div dir="rtl" className="p-10 text-center font-bold text-slate-500">{text}</div>;
}

export default function GradesSheetPrint() {
    const [params] = useSearchParams();
    const className = params.get("class") || "";
    const subjectName = params.get("subject") || "";

    const data = useQuery(api.grades.getClassExport,
        className ? { className, ...(subjectName ? { subjectName } : {}) } : "skip" as any
    ) as any;

    const printed = useRef(false);
    useEffect(() => {
        if (!data) return;
        document.title = ["التقييمات القصيرة", data.className, subjectName || "كل المواد"].join(" - ");
        if (params.get("autoprint") === "1" && !printed.current) {
            printed.current = true;
            setTimeout(() => window.print(), 600);
        }
    }, [data]);

    if (!className) return <Message text="لم تُحدَّد الشعبة."/>;
    if (data === undefined) return <Message text="جاري تجهيز الكشف…"/>;
    if (!data) return <Message text="الشعبة غير موجودة."/>;

    const settings = data.settings;
    const labels = assessmentLabelsOf(settings);
    const school = printableSchoolName(data.schoolName);
    const grade = GRADE_LABELS[data.grade] ?? data.grade;
    const multi = data.sheets.length > 1;
    const summary = multi ? classSummary(data) : null;
    const exportedAt = new Date().toLocaleString("ar-EG");

    const head = (title: string, extra?: string) => (
        <div className="mb-3 text-center">
            <p className="font-black text-sm">مدرسة / {school}</p>
            <p className="font-black text-lg" style={{ color: "#5C1523" }}>{title}</p>
            <p className="text-xs font-bold text-slate-600">
                الصف {grade} · الشعبة {data.className} ({data.track}){extra ? ` · ${extra}` : ""}
            </p>
            <p className="text-[10px] font-bold text-slate-400">تاريخ الإصدار: {exportedAt}</p>
        </div>
    );

    const signatures = (
        <div className="sig">
            {SIGNATURE_LINES.map(label => (
                <div key={label}>{label}<br/><br/>................................</div>
            ))}
        </div>
    );

    return (
        <div dir="rtl" className="gsp bg-white text-slate-900">
            <style>{`
                @page { size: A4 ${multi ? "landscape" : "portrait"}; margin: 10mm; }
                @media print {
                    .no-print { display: none !important; }
                    .page { break-after: page; }
                    .page:last-child { break-after: auto; }
                }
                .gsp { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                .gsp table.grid { border-collapse: collapse; width: 100%; font-size: 11px; }
                .gsp table.grid th { background: #5C1523; color: #fff; font-weight: 700; padding: 5px 4px; border: 1px solid #7a1e30; }
                .gsp table.grid td { border: 1px solid #cbd5e1; padding: 4px; }
                .gsp table.grid tbody tr:nth-child(even) td { background: #f8fafc; }
                .gsp .c { text-align: center; }
                .gsp .sig { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-top: 28px; text-align: center; font-weight: 700; font-size: 12px; }
            `}</style>

            <div className="no-print p-4 flex items-center gap-3 bg-slate-100 border-b border-slate-200 flex-wrap">
                <button onClick={() => window.print()}
                    className="px-5 py-2 rounded-xl bg-qatar-maroon text-white font-black text-sm">
                    طباعة / حفظ PDF
                </button>
                <span className="text-xs font-bold text-slate-500">
                    الشعبة {data.className} · {multi ? `${data.sheets.length} مواد` : subjectName}
                </span>
            </div>

            {summary && (
                <section className="page p-5">
                    {head("ملخص التقييمات القصيرة", `الدرجة النهائية من ${settings.finalScoreOutOf}`)}
                    <table className="grid">
                        <thead>
                            <tr>
                                <th style={{ width: "26px" }}>م</th>
                                <th style={{ minWidth: "170px" }}>اسم الطالب</th>
                                {summary.subjects.map(s => <th key={s}>{s}</th>)}
                                <th>المتوسط</th>
                                <th>مواد دون الحد</th>
                            </tr>
                        </thead>
                        <tbody>
                            {summary.rows.map((row, i) => (
                                <tr key={row.studentName + i}>
                                    <td className="c">{i + 1}</td>
                                    <td style={{ fontWeight: 700 }}>{row.studentName}</td>
                                    {row.finals.map((f, fi) => (
                                        <td key={fi} className="c" style={
                                            f === null ? undefined
                                                : f < settings.passThreshold ? TONE_STYLE.bad
                                                : f >= settings.excellenceThreshold ? TONE_STYLE.good
                                                : undefined}>
                                            {f === null ? "" : f.toFixed(2)}
                                        </td>
                                    ))}
                                    <td className="c" style={{ fontWeight: 700 }}>{row.average === null ? "" : row.average.toFixed(2)}</td>
                                    <td className="c" style={row.belowPass ? TONE_STYLE.bad : undefined}>{row.belowPass || ""}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <p className="text-[10px] font-bold text-slate-500 mt-2">
                        حد النجاح {settings.passThreshold} · حد التميز {settings.excellenceThreshold} · الخانة الفارغة = لم تُرصد درجات في المادة
                    </p>
                    {signatures}
                </section>
            )}

            {data.sheets.map((sheet: any) => (
                <section key={sheet.subjectName} className="page p-5">
                    {head(`كشف التقييمات القصيرة — ${sheet.subjectName}`)}
                    <table className="grid">
                        <thead>
                            <tr>
                                <th style={{ width: "26px" }}>م</th>
                                <th style={{ width: "86px" }}>الرقم</th>
                                <th style={{ minWidth: "160px" }}>اسم الطالب</th>
                                {labels.map(l => (
                                    <th key={l}>{l}<div style={{ fontSize: "9px", fontWeight: 400 }}>(من {settings.maxPerAssessment})</div></th>
                                ))}
                                <th>المجموع</th>
                                <th>النهائية<div style={{ fontSize: "9px", fontWeight: 400 }}>(من {settings.finalScoreOutOf})</div></th>
                                <th>الحالة</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sheet.students.map((st: any, i: number) => {
                                const sm = summaryOf(st, settings);
                                const status = statusOf(sm, settings);
                                return (
                                    <tr key={st.studentName + i}>
                                        <td className="c">{i + 1}</td>
                                        <td className="c" style={{ fontSize: "10px" }}>{st.nationalId}</td>
                                        <td style={{ fontWeight: 700 }}>{st.studentName}</td>
                                        {(["a1", "a2", "a3", "a4", "a5"] as const).map(k => {
                                            const mark = formatMark(st[k]);
                                            return (
                                                <td key={k} className="c" style={
                                                    mark === "غ" ? TONE_STYLE.warn : mark === "م" ? TONE_STYLE.muted : undefined}>
                                                    {mark ?? ""}
                                                </td>
                                            );
                                        })}
                                        <td className="c" style={{ fontWeight: 700 }}>{sm.hasAny ? sm.sum : ""}</td>
                                        <td className="c" style={
                                            !sm.hasAny ? undefined
                                                : sm.finalScore < settings.passThreshold ? TONE_STYLE.bad
                                                : sm.finalScore >= settings.excellenceThreshold ? TONE_STYLE.good
                                                : { fontWeight: 700 }}>
                                            {sm.hasAny ? sm.finalScore.toFixed(2) : ""}
                                        </td>
                                        <td className="c" style={status.tone ? TONE_STYLE[status.tone] : undefined}>{status.label}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                    <p className="text-[10px] font-bold text-slate-500 mt-2">
                        الدرجة النهائية من التقييمات المرصودة · غ = غائب (يُحتسب صفراً) · م = معذور (لا يدخل في الحساب) · الخانة الفارغة = لم يُرصد بعد ·
                        حد النجاح {settings.passThreshold} · حد التميز {settings.excellenceThreshold}
                    </p>
                    {signatures}
                </section>
            ))}
        </div>
    );
}
