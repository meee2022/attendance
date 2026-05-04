import { useEffect } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "convex/react";
// @ts-ignore
import { api } from "../../convex/_generated/api";

const ROLE_LABELS: Record<string, string> = { coordinator: "المنسق", supervisor: "الموجه", deputy: "النائب الأكاديمي" };
const DOMAIN_LABELS: Record<string, string> = { planning: "التخطيط", execution: "تنفيذ الدرس", evaluation: "التقويم", management: "الإدارة الصفية" };
const RATING_TEXT: Record<string, string> = { "3": "الأدلة مستكملة وفاعلة", "2": "تتوفر معظم الأدلة", "1": "تتوفر بعض الأدلة", "0": "الأدلة غير متوفرة", "not_measured": "لم يتم قياسه" };
const FOLLOW_UP: Record<string, string> = { full: "كليّة", partial: "جزئيّة" };

export default function SupervisionPrint() {
    const { id } = useParams<{ id: string }>();
    const visit = useQuery(api.supervision.getVisit, id ? { id: id as any } : "skip" as any) as any;
    const criteria = useQuery(api.supervision.getCriteria) as any[] | undefined;

    useEffect(() => {
        if (visit && criteria) {
            const t = setTimeout(() => window.print(), 500);
            return () => clearTimeout(t);
        }
    }, [visit, criteria]);

    if (!visit || !criteria) return <div className="p-10 text-center">جارٍ التحميل...</div>;

    const ratings: Record<string, number | string> = JSON.parse(visit.ratings || "{}");
    const domAvgs = JSON.parse(visit.domainAverages || "{}");
    const byDomain: Record<string, any[]> = { planning: [], execution: [], evaluation: [], management: [] };
    for (const c of criteria) byDomain[c.domain]?.push(c);
    for (const k in byDomain) byDomain[k].sort((a, b) => a.order - b.order);

    return (
        <>
            <style>{`
                @page { size: A4; margin: 12mm; }
                @media print {
                    body { background: white !important; }
                    .no-print { display: none !important; }
                }
                .print-root {
                    direction: rtl;
                    font-family: 'Cairo', sans-serif;
                    background: white;
                    color: #1e293b;
                    max-width: 210mm;
                    margin: 0 auto;
                    padding: 8mm;
                    font-size: 11px;
                }
                .print-root h1 { font-size: 18px; margin: 0; font-weight: 900; color: #9B1239; }
                .print-root h2 { font-size: 13px; margin: 12px 0 6px; font-weight: 900; padding: 6px 10px; border-radius: 6px; }
                .print-root table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
                .print-root th, .print-root td { border: 1px solid #cbd5e1; padding: 4px 6px; text-align: right; }
                .print-root th { background: #f1f5f9; font-weight: 900; font-size: 10px; }
                .print-root .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 0; border: 1px solid #cbd5e1; }
                .print-root .info-cell { padding: 5px 8px; border-bottom: 1px solid #e2e8f0; border-left: 1px solid #e2e8f0; }
                .print-root .info-cell:nth-child(2n) { border-left: none; }
                .print-root .info-cell:nth-last-child(-n+2) { border-bottom: none; }
                .print-root .info-cell b { color: #475569; font-weight: 900; margin-left: 8px; }
                .print-root .scale-row { display: grid; grid-template-columns: repeat(5, 1fr); gap: 0; border: 1px solid #cbd5e1; }
                .print-root .scale-cell { padding: 4px; text-align: center; font-size: 9px; font-weight: 900; border-left: 1px solid #cbd5e1; }
                .print-root .scale-cell:last-child { border-left: none; }
                .print-root .rec-block { border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px 10px; margin-bottom: 6px; }
                .print-root .rec-block h3 { font-size: 11px; margin: 0 0 4px; font-weight: 900; }
                .print-root .rec-block p { margin: 0; font-size: 10px; line-height: 1.6; white-space: pre-wrap; }
                .print-root .signature-block { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 16px; }
                .print-root .sig-card { border: 1px solid #cbd5e1; border-radius: 6px; padding: 10px; text-align: center; min-height: 50px; }
                .print-root .summary-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 4px; margin-bottom: 8px; }
                .print-root .summary-card { border: 1px solid #cbd5e1; border-radius: 6px; padding: 6px; text-align: center; }
                .print-root .summary-card b { display: block; font-size: 16px; font-weight: 900; }
                .print-root .summary-card span { font-size: 9px; }
                .print-root .check-mark { color: #9B1239; font-weight: 900; font-size: 14px; }
                .print-root .domain-header { color: white; }
            `}</style>
            <div className="print-root">
                {/* Title */}
                <div style={{ textAlign: "center", marginBottom: 10, borderBottom: "2px solid #9B1239", paddingBottom: 6 }}>
                    <h1>استمارة الإشراف على أداء المعلّم</h1>
                    <p style={{ margin: "2px 0 0", fontSize: 10, color: "#64748b", fontWeight: 700 }}>مدرسة ابن تيمية الثانوية للبنين · العام الأكاديمي 2025–2026</p>
                </div>

                {/* Basic Info */}
                <h2 style={{ background: "#9B1239", color: "white" }}>المعلومات الأساسية</h2>
                <div className="info-grid">
                    <div className="info-cell"><b>المعلم:</b>{visit.teacherName}</div>
                    <div className="info-cell"><b>القسم:</b>{visit.teacherDepartment || "—"}</div>
                    <div className="info-cell"><b>المادة:</b>{visit.subjectName}</div>
                    <div className="info-cell"><b>الصف:</b>{visit.className}</div>
                    <div className="info-cell"><b>عنوان الدرس:</b>{visit.lessonTopic}</div>
                    <div className="info-cell"><b>التاريخ:</b>{visit.visitDate}</div>
                    <div className="info-cell"><b>الزائر:</b>{visit.visitorName} ({ROLE_LABELS[visit.visitorRole]})</div>
                    <div className="info-cell"><b>نوع المتابعة:</b>{FOLLOW_UP[visit.followUpType]} · زيارة #{visit.visitNumber}</div>
                </div>

                {/* Rating Scale */}
                <h2 style={{ background: "#1e293b", color: "white" }}>مقياس التقييم</h2>
                <div className="scale-row">
                    <div className="scale-cell" style={{ background: "#10b98115", color: "#10b981" }}>الأدلة مستكملة وفاعلة</div>
                    <div className="scale-cell" style={{ background: "#3b82f615", color: "#3b82f6" }}>تتوفر معظم الأدلة</div>
                    <div className="scale-cell" style={{ background: "#f59e0b15", color: "#f59e0b" }}>تتوفر بعض الأدلة</div>
                    <div className="scale-cell" style={{ background: "#ef444415", color: "#ef4444" }}>الأدلة غير متوفرة</div>
                    <div className="scale-cell" style={{ background: "#94a3b815", color: "#94a3b8" }}>لم يتم قياسه</div>
                </div>

                {/* Criteria tables per domain */}
                {(["planning", "execution", "evaluation", "management"] as const).map(domain => {
                    const dCrit = byDomain[domain] ?? [];
                    if (dCrit.length === 0) return null;
                    const colors: Record<string, string> = { planning: "#3b82f6", execution: "#10b981", evaluation: "#f59e0b", management: "#8b5cf6" };
                    return (
                        <div key={domain}>
                            <h2 style={{ background: colors[domain], color: "white" }}>{DOMAIN_LABELS[domain]}</h2>
                            <table>
                                <thead>
                                    <tr>
                                        <th style={{ width: "5%" }}>#</th>
                                        <th style={{ width: "55%" }}>معيار الأداء</th>
                                        <th style={{ textAlign: "center" }}>مستكملة</th>
                                        <th style={{ textAlign: "center" }}>معظم</th>
                                        <th style={{ textAlign: "center" }}>بعض</th>
                                        <th style={{ textAlign: "center" }}>محدودة</th>
                                        <th style={{ textAlign: "center" }}>لم يُقَس</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {dCrit.map((c, i) => {
                                        const v = ratings[c._id];
                                        const sel = (n: number | string) => v === n;
                                        return (
                                            <tr key={c._id}>
                                                <td style={{ textAlign: "center", fontWeight: 900 }}>{i + 1}</td>
                                                <td>{c.text}</td>
                                                <td style={{ textAlign: "center" }}>{sel(3) && <span className="check-mark">✓</span>}</td>
                                                <td style={{ textAlign: "center" }}>{sel(2) && <span className="check-mark">✓</span>}</td>
                                                <td style={{ textAlign: "center" }}>{sel(1) && <span className="check-mark">✓</span>}</td>
                                                <td style={{ textAlign: "center" }}>{sel(0) && <span className="check-mark">✓</span>}</td>
                                                <td style={{ textAlign: "center" }}>{sel("not_measured") && <span className="check-mark">✓</span>}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    );
                })}

                {/* Recommendations */}
                <h2 style={{ background: "#0f172a", color: "white" }}>التوصيات والملاحظات</h2>
                {visit.planningRec && <div className="rec-block"><h3 style={{ color: "#3b82f6" }}>توصيات التخطيط</h3><p>{visit.planningRec}</p></div>}
                {visit.executionRec && <div className="rec-block"><h3 style={{ color: "#10b981" }}>توصيات تنفيذ الدرس</h3><p>{visit.executionRec}</p></div>}
                {visit.evalMgmtRec && <div className="rec-block"><h3 style={{ color: "#f59e0b" }}>توصيات التقويم والإدارة الصفية</h3><p>{visit.evalMgmtRec}</p></div>}
                {visit.notes && <div className="rec-block"><h3 style={{ color: "#64748b" }}>ملاحظات وتوصيات عامة</h3><p>{visit.notes}</p></div>}

                {/* Summary */}
                <h2 style={{ background: "#0f172a", color: "white" }}>ملخص التقييم</h2>
                <div className="summary-grid">
                    <div className="summary-card" style={{ background: "#3b82f60a" }}>
                        <span style={{ color: "#3b82f6" }}>التخطيط</span>
                        <b style={{ color: "#3b82f6" }}>{((domAvgs.planning ?? 0) * 100).toFixed(0)}%</b>
                    </div>
                    <div className="summary-card" style={{ background: "#10b9810a" }}>
                        <span style={{ color: "#10b981" }}>تنفيذ الدرس</span>
                        <b style={{ color: "#10b981" }}>{((domAvgs.execution ?? 0) * 100).toFixed(0)}%</b>
                    </div>
                    <div className="summary-card" style={{ background: "#f59e0b0a" }}>
                        <span style={{ color: "#f59e0b" }}>التقويم</span>
                        <b style={{ color: "#f59e0b" }}>{((domAvgs.evaluation ?? 0) * 100).toFixed(0)}%</b>
                    </div>
                    <div className="summary-card" style={{ background: "#8b5cf60a" }}>
                        <span style={{ color: "#8b5cf6" }}>الإدارة الصفية</span>
                        <b style={{ color: "#8b5cf6" }}>{((domAvgs.management ?? 0) * 100).toFixed(0)}%</b>
                    </div>
                    <div className="summary-card" style={{ background: "#9B12390a" }}>
                        <span style={{ color: "#9B1239" }}>المعدل العام</span>
                        <b style={{ color: "#9B1239" }}>{((visit.averageScore ?? 0) * 100).toFixed(0)}%</b>
                    </div>
                </div>

                {/* Signatures */}
                <div className="signature-block">
                    <div className="sig-card">
                        <p style={{ margin: 0, fontWeight: 900, fontSize: 11 }}>المعلم</p>
                        <p style={{ margin: "4px 0 0", fontSize: 10, color: "#475569" }}>{visit.teacherName}</p>
                        {visit.teacherSignedAt && (
                            <p style={{ margin: "4px 0 0", fontSize: 9, color: "#10b981", fontWeight: 900 }}>
                                ✓ موقَّع · {new Date(visit.teacherSignedAt).toLocaleDateString("ar-EG")}
                            </p>
                        )}
                    </div>
                    <div className="sig-card">
                        <p style={{ margin: 0, fontWeight: 900, fontSize: 11 }}>{ROLE_LABELS[visit.visitorRole]}</p>
                        <p style={{ margin: "4px 0 0", fontSize: 10, color: "#475569" }}>{visit.visitorName}</p>
                        <p style={{ margin: "4px 0 0", fontSize: 9, color: "#10b981", fontWeight: 900 }}>
                            ✓ مُرسلة · {visit.submittedAt ? new Date(visit.submittedAt).toLocaleDateString("ar-EG") : "—"}
                        </p>
                    </div>
                </div>

                <div className="no-print" style={{ marginTop: 20, textAlign: "center" }}>
                    <button onClick={() => window.print()} style={{ padding: "8px 24px", background: "#9B1239", color: "white", border: "none", borderRadius: 8, fontWeight: 900, cursor: "pointer" }}>
                        طباعة
                    </button>
                </div>
            </div>
        </>
    );
}
