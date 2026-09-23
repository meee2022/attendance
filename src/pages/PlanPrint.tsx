import { useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "convex/react";
// @ts-ignore
import { api } from "../../convex/_generated/api";
import { printableSchoolName } from "../lib/brand";
import { SIGNATURE_LINES } from "../lib/excelExport";
import { weeksFor } from "../lib/planMath";

// Printable copy of the week grid — the same sheet the school publishes, so a
// signed paper copy can sit in the subject file.

const GRADE_LABELS: Record<number, string> = { 10: "العاشر", 11: "الحادي عشر", 12: "الثاني عشر" };

export default function PlanPrint() {
    const [params] = useSearchParams();
    const gradeParam = params.get("grade");
    const grade = gradeParam ? Number(gradeParam) : undefined;

    // @ts-ignore
    const plan = useQuery(api.assessmentPlan.getPlan) as any;

    const printed = useRef(false);
    useEffect(() => {
        if (!plan) return;
        document.title = ["جدول التقييمات القصيرة", grade ? `الصف ${GRADE_LABELS[grade] ?? grade}` : "كل الصفوف"].join(" - ");
        if (params.get("autoprint") === "1" && !printed.current) {
            printed.current = true;
            setTimeout(() => window.print(), 600);
        }
    }, [plan]);

    if (!plan) return <div dir="rtl" className="p-10 text-center font-bold text-slate-500">جاري تجهيز الجدول…</div>;
    if (!plan.weeks.length) return <div dir="rtl" className="p-10 text-center font-bold text-slate-500">لا يوجد جدول أسابيع.</div>;

    return (
        <div dir="rtl" className="pp bg-white text-slate-900">
            <style>{`
                @page { size: A4 landscape; margin: 8mm; }
                @media print { .no-print { display: none !important; } }
                .pp { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                .pp table { border-collapse: collapse; width: 100%; font-size: 10px; }
                .pp th { background: #5C1523; color: #fff; padding: 4px 2px; border: 1px solid #7a1e30; }
                .pp td { border: 1px solid #cbd5e1; padding: 4px 2px; }
                .pp .mark { background: #d1fae5; color: #047857; font-weight: 800; text-align: center; }
                .pp .sig { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-top: 26px; text-align: center; font-weight: 700; font-size: 12px; }
            `}</style>

            <div className="no-print p-4 bg-slate-100 border-b border-slate-200">
                <button onClick={() => window.print()} className="px-5 py-2 rounded-xl bg-qatar-maroon text-white font-black text-sm">
                    طباعة / حفظ PDF
                </button>
            </div>

            <section className="p-4">
                <div className="mb-3 text-center">
                    <p className="font-black text-sm">مدرسة / {printableSchoolName(plan.schoolName)}</p>
                    <p className="font-black text-lg" style={{ color: "#5C1523" }}>جدول التقييمات القصيرة حسب الأسابيع</p>
                    <p className="text-xs font-bold text-slate-600">
                        {grade ? `الصف ${GRADE_LABELS[grade] ?? grade}` : "كل الصفوف"} · تاريخ الإصدار: {new Date().toLocaleDateString("ar-EG")}
                    </p>
                </div>

                <table>
                    <thead>
                        <tr>
                            <th style={{ minWidth: "130px" }}>المادة</th>
                            {plan.weeks.map((w: any) => (
                                <th key={w.week}>
                                    أ{w.week}
                                    <div style={{ fontSize: "8px", fontWeight: 400 }}>{w.label}</div>
                                </th>
                            ))}
                            <th>العدد</th>
                        </tr>
                    </thead>
                    <tbody>
                        {plan.subjects.map((s: any) => {
                            const mine = weeksFor(plan.entries, s.name, grade);
                            return (
                                <tr key={s.name}>
                                    <td style={{ fontWeight: 700 }}>{s.name}</td>
                                    {plan.weeks.map((w: any) => (
                                        <td key={w.week} className={mine.includes(w.week) ? "mark" : ""}>
                                            {mine.includes(w.week) ? mine.indexOf(w.week) + 1 : ""}
                                        </td>
                                    ))}
                                    <td style={{ textAlign: "center", fontWeight: 700 }}>{mine.length}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>

                <p className="text-[10px] font-bold text-slate-500 mt-2">
                    الرقم في الخانة = ترتيب التقييم للمادة ·{" "}
                    {plan.weeks.filter((w: any) => w.note).map((w: any) => `أ${w.week}: ${w.note}`).join(" · ")}
                </p>

                <div className="sig">
                    {SIGNATURE_LINES.map(label => (
                        <div key={label}>{label}<br/><br/>................................</div>
                    ))}
                </div>
            </section>
        </div>
    );
}
