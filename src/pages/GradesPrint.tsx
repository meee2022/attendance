import { useEffect } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "convex/react";
// @ts-ignore
import { api } from "../../convex/_generated/api";

function formatGrade(v: any): string {
    if (v === undefined || v === null) return "—";
    if (v === "absent") return "غ";
    if (v === "excused") return "م";
    return String(v);
}

function calcSummary(g: any, max = 20, finalOutOf = 5) {
    let sum = 0, cnt = 0;
    for (const k of ["a1", "a2", "a3", "a4", "a5"] as const) {
        const v = g[k];
        if (typeof v === "number") { sum += v; cnt++; }
    }
    const totalMax = 5 * max;
    return { sum, cnt, total: sum, finalScore: totalMax > 0 ? (sum / totalMax) * finalOutOf : 0 };
}

export default function GradesPrint() {
    const { studentName } = useParams<{ studentName: string }>();
    const decoded = studentName ? decodeURIComponent(studentName) : "";
    const grades = useQuery(api.grades.getStudentGrades, decoded ? { studentName: decoded } : "skip" as any) as any[] | undefined;
    const settings = useQuery(api.grades.getSettings) as any;

    useEffect(() => {
        if (grades && settings) {
            const t = setTimeout(() => window.print(), 500);
            return () => clearTimeout(t);
        }
    }, [grades, settings]);

    if (!grades || !settings) return <div className="p-10 text-center">جارٍ التحميل...</div>;

    const cls = grades[0]?.className ?? "—";
    const totalAvg = grades.length > 0
        ? grades.reduce((a, g) => a + calcSummary(g, settings.maxPerAssessment, settings.finalScoreOutOf).finalScore, 0) / grades.length
        : 0;

    return (
        <>
            <style>{`
                @page { size: A4; margin: 12mm; }
                @media print { body { background: white !important; } .no-print { display: none !important; } }
                .pr { direction: rtl; font-family: 'Cairo', sans-serif; background: white; color: #1e293b; max-width: 210mm; margin: 0 auto; padding: 8mm; font-size: 11px; }
                .pr h1 { font-size: 20px; margin: 0; font-weight: 900; color: #5C1A1B; }
                .pr h2 { font-size: 13px; margin: 12px 0 6px; font-weight: 900; padding: 6px 10px; border-radius: 6px; background: #5C1A1B; color: white; }
                .pr table { width: 100%; border-collapse: collapse; }
                .pr th, .pr td { border: 1px solid #cbd5e1; padding: 6px; text-align: center; }
                .pr th { background: #f1f5f9; font-weight: 900; font-size: 10px; }
                .pr .info { display: grid; grid-template-columns: 1fr 1fr; gap: 0; border: 1px solid #cbd5e1; margin-bottom: 8px; }
                .pr .info > div { padding: 6px 10px; border-bottom: 1px solid #e2e8f0; border-left: 1px solid #e2e8f0; }
                .pr .info > div:nth-child(2n) { border-left: none; }
                .pr .info b { color: #475569; font-weight: 900; margin-left: 8px; }
                .pr .summary { background: linear-gradient(135deg,#5C1A1B,#7A2425); color: white; padding: 14px; border-radius: 8px; text-align: center; margin-top: 10px; }
                .pr .summary .num { font-size: 40px; font-weight: 900; line-height: 1; }
            `}</style>
            <div className="pr">
                <div style={{ textAlign: "center", marginBottom: 10, borderBottom: "2px solid #5C1A1B", paddingBottom: 6 }}>
                    <h1>كشف درجات الطالب</h1>
                    <p style={{ margin: "2px 0 0", fontSize: 10, color: "#64748b", fontWeight: 700 }}>
                        مدرسة ابن تيمية الثانوية للبنين · العام الأكاديمي 2025–2026
                    </p>
                </div>

                <div className="info">
                    <div><b>اسم الطالب:</b>{decoded}</div>
                    <div><b>الفصل:</b>{cls}</div>
                    <div><b>عدد المواد:</b>{grades.length}</div>
                    <div><b>تاريخ الإصدار:</b>{new Date().toLocaleDateString("ar-EG")}</div>
                </div>

                <h2>الدرجات حسب المواد</h2>
                <table>
                    <thead>
                        <tr>
                            <th style={{ width: "25%" }}>المادة</th>
                            {settings.assessmentLabels.map((l: string, i: number) => <th key={i}>{l}</th>)}
                            <th>المجموع<br/>من {5 * settings.maxPerAssessment}</th>
                            <th>الدرجة<br/>من {settings.finalScoreOutOf}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {grades.sort((a, b) => a.subjectName.localeCompare(b.subjectName, "ar")).map(g => {
                            const s = calcSummary(g, settings.maxPerAssessment, settings.finalScoreOutOf);
                            const isPass = s.finalScore >= settings.passThreshold;
                            const isExcellent = s.finalScore >= settings.excellenceThreshold;
                            return (
                                <tr key={g._id}>
                                    <td style={{ textAlign: "right", fontWeight: 900 }}>{g.subjectName}</td>
                                    {(["a1", "a2", "a3", "a4", "a5"] as const).map(k => (
                                        <td key={k}>{formatGrade(g[k])}</td>
                                    ))}
                                    <td style={{ fontWeight: 900 }}>{s.cnt > 0 ? s.total : "—"}</td>
                                    <td style={{ fontWeight: 900, color: s.cnt === 0 ? "#94a3b8" : isExcellent ? "#10b981" : isPass ? "#3b82f6" : "#ef4444" }}>
                                        {s.cnt > 0 ? s.finalScore.toFixed(2) : "—"}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>

                <div className="summary">
                    <p style={{ margin: 0, fontSize: 11, fontWeight: 700, opacity: 0.9 }}>المعدل العام</p>
                    <p className="num">{totalAvg.toFixed(2)} <span style={{ fontSize: 18, opacity: 0.7 }}>/ {settings.finalScoreOutOf}</span></p>
                </div>

                <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div style={{ border: "1px solid #cbd5e1", borderRadius: 6, padding: 12, textAlign: "center" }}>
                        <p style={{ margin: 0, fontWeight: 900, fontSize: 11 }}>توقيع المعلم/المنسق</p>
                        <div style={{ height: 30 }}/>
                    </div>
                    <div style={{ border: "1px solid #cbd5e1", borderRadius: 6, padding: 12, textAlign: "center" }}>
                        <p style={{ margin: 0, fontWeight: 900, fontSize: 11 }}>توقيع ولي الأمر</p>
                        <div style={{ height: 30 }}/>
                    </div>
                </div>

                <div className="no-print" style={{ marginTop: 20, textAlign: "center" }}>
                    <button onClick={() => window.print()} style={{ padding: "8px 24px", background: "#5C1A1B", color: "white", border: "none", borderRadius: 8, fontWeight: 900, cursor: "pointer" }}>طباعة</button>
                </div>
            </div>
        </>
    );
}
