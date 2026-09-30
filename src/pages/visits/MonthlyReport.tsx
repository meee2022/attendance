import { useMemo, useState } from "react";
import { Download, FileText, Printer } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { useSupervisionMutation, useSupervisionQuery } from "../../lib/supervisionSession";
import { ROLE_LABELS, formatDate, type VisitorRole } from "../../../convex/visitMath";
import { criterionAverages, pct, type VisitRow } from "../../lib/visitStats";
import { downloadWorkbook } from "../../lib/excelExport";

// «ملخّص زيارات الإشراف على المعلمين: التوصيات وآلية التحسين» — the monthly
// summary the deputy used to write by hand, built from the submitted visits:
// for each visit the teacher, subject, date, its main recommendations and the
// improvement actions recorded for it in «المتابعة والخطة». Around the tables,
// what a hand-written summary cannot show: the month in figures and the
// criteria most in need of work.

const MONTHS = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
const ROLE_ORDER: VisitorRole[] = ["deputy", "coordinator", "supervisor"];
const SECTION_TITLE: Record<VisitorRole, string> = {
    deputy: "زيارات النائب الأكاديمي",
    coordinator: "زيارات المنسقين",
    supervisor: "زيارات الموجهين",
};
const ORDINALS = ["أولًا", "ثانيًا", "ثالثًا", "رابعًا", "خامسًا"];

// The recommendations of a visit, reduced to what is to be done: thanks,
// general closings and «أوصي بـ» lead-ins are dropped, the rest joined with «؛».
export function mainRecommendations(v: Pick<VisitRow, "planningRec" | "executionRec" | "evalMgmtRec" | "notes"> & { managementRec?: string }) {
    const parts = [v.planningRec, v.executionRec, v.evalMgmtRec, v.managementRec ?? ""]
        .join("\n")
        .split(/\n|(?<=[.!؟])\s+/)
        .map(s => s.replace(/^[\s\-–•*·]+/, "").replace(/^(وأوصي|أوصي|نوصي|وأوصى|أوصى)\s*(بـ|ب)?\s*:?\s*/, "").trim())
        .filter(s => s.length > 3 && !/^(أشكر|يشكر|شكرًا|شكرا|نشكر)/.test(s) && !/^يرجى العمل/.test(s))
        .map(s => s.replace(/[.،؛:]+$/, ""));
    return [...new Set(parts)].join("؛ ");
}

type Row = { visit: VisitRow; recs: string; actions: string };

// «آلية التحسين» written straight into the report is kept as an improvement
// action of the visit, so it shows in «المتابعة والخطة» and in later reports.
function MechanismEditor({ visit, today }: { visit: VisitRow; today: string }) {
    const save = useSupervisionMutation((api as any).supervisionActions.save);
    const [text, setText] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const due = new Date(Date.parse(`${today}T00:00:00Z`) + 14 * 86400000).toISOString().slice(0, 10);
    if (!visit.teacherId) return <span className="text-slate-400">—</span>;
    return (
        <div className="space-y-1">
            <span className="text-slate-400 print-only-empty">لم تُحدّد بعد</span>
            <div className="no-print no-word space-y-1">
                <textarea rows={2} value={text} onChange={e => setText(e.target.value)} placeholder="اكتب آلية التحسين…"
                    className="w-full border border-slate-200 rounded-lg px-2 py-1 text-sm bg-white"/>
                {text.trim() && <button disabled={busy} onClick={async () => {
                    setBusy(true); setError("");
                    try {
                        await save({ teacherId: visit.teacherId, visitId: visit._id, kind: "improvement", title: text.trim(),
                            owner: "المعلم", dueDate: due, evidence: "", status: "open" });
                        setText("");
                    } catch (e: any) { setError(typeof e?.data === "string" ? e.data : "تعذّر الحفظ"); }
                    finally { setBusy(false); }
                }} className="px-3 py-1 rounded-lg bg-qatar-maroon text-white text-xs font-bold disabled:opacity-50">حفظ كخطة تحسين (موعد {formatDate(due)})</button>}
                {error && <p className="text-xs text-rose-700">{error}</p>}
            </div>
        </div>
    );
}

export default function MonthlyReport({ setup, visits }: { setup: any; visits: VisitRow[] }) {
    const actions = useSupervisionQuery((api as any).supervisionActions.list) as any[] | undefined;
    const months = useMemo(() => [...new Set(visits.filter(v => v.status === "submitted").map(v => v.visitDate.slice(0, 7)))].sort().reverse(), [visits]);
    const [month, setMonth] = useState(() => months[0] ?? setup.today.slice(0, 7));
    const [department, setDepartment] = useState("");
    const [role, setRole] = useState<VisitorRole | "">("");

    const monthVisits = useMemo(() => visits
        .filter(v => v.status === "submitted" && v.visitDate.startsWith(month))
        .filter(v => !department || v.department === department)
        .filter(v => !role || v.visitorRole === role)
        .sort((a, b) => a.visitDate.localeCompare(b.visitDate) || a.teacherName.localeCompare(b.teacherName, "ar")), [visits, month, department, role]);

    const rows: Row[] = monthVisits.map(visit => ({
        visit,
        recs: mainRecommendations(visit),
        actions: (actions ?? []).filter(a => a.visitId === visit._id && a.kind !== "visit" && a.status !== "cancelled")
            .map(a => a.title.trim() + (a.dueDate ? ` (حتى ${formatDate(a.dueDate)})` : "")).join("؛ "),
    }));
    const sections = ROLE_ORDER.map(r => ({ role: r, rows: rows.filter(x => x.visit.visitorRole === r) })).filter(s => s.rows.length);

    const stats = useMemo(() => {
        const teachers = new Set(monthVisits.map(v => v.teacherId ?? v.teacherName)).size;
        const scored = monthVisits.filter(v => v.averageScore !== null);
        const average = scored.length ? scored.reduce((s, v) => s + (v.averageScore ?? 0), 0) / scored.length : null;
        const byCriterion = criterionAverages(monthVisits, setup.criteria).criteria.filter(c => c.n > 0 && c.average !== null);
        const weakest = [...byCriterion].sort((a, b) => (a.average! - b.average!)).slice(0, 5).filter(c => c.average! < 1);
        const strongest = [...byCriterion].sort((a, b) => (b.average! - a.average!)).slice(0, 3);
        const withPlan = rows.filter(r => r.actions).length;
        return { teachers, average, weakest, strongest, withPlan };
    }, [monthVisits, rows, setup.criteria]);

    const [y, m] = month.split("-").map(Number);
    const monthName = `${MONTHS[(m || 1) - 1]} ${y}`;
    const title = "ملخّص زيارات الإشراف على المعلمين: التوصيات وآلية التحسين";
    const scopeLine = [department || "جميع الأقسام", role ? SECTION_TITLE[role] : "جميع الزائرين"].join(" · ");

    const exportExcel = () => downloadWorkbook(`ملخص توصيات الزيارات - ${monthName}`, [{
        name: monthName, title, orientation: "landscape",
        meta: [`${setup.settings.schoolNameOnForm} · العام الأكاديمي ${setup.settings.academicYear}`, `الشهر: ${monthName} · ${scopeLine}`],
        columns: [
            { header: "م", width: 5, align: "center" }, { header: "اسم المعلم", width: 24, bold: true }, { header: "المادة", width: 14 },
            { header: "الصف", width: 8, align: "center" }, { header: "تاريخ الزيارة", width: 12, align: "center" }, { header: "الزائر", width: 20 },
            { header: "المعدل", width: 9, align: "center", numFmt: "0%" }, { header: "أهم التوصيات", width: 60 }, { header: "آلية التحسين", width: 45 },
        ],
        rows: rows.map((r, i) => [i + 1, r.visit.teacherName, r.visit.subjectName, r.visit.className, formatDate(r.visit.visitDate),
            `${ROLE_LABELS[r.visit.visitorRole]} — ${r.visit.visitorName}`, r.visit.averageScore, r.recs, r.actions || "لم تُحدّد بعد"]),
    }]);

    // Word opens an HTML file saved as .doc, keeping the tables editable
    const exportWord = () => {
        const html = document.getElementById("monthly-report-sheet")?.outerHTML ?? "";
        const doc = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><title>${title}</title>
<style>@page{size:A4;margin:1.5cm} body{direction:rtl;font-family:'Sakkal Majalla','Traditional Arabic',Arial;font-size:13pt}
table{border-collapse:collapse;width:100%} th{background:#1F3864;color:#fff;border:1px solid #8a93a5;padding:4pt} td{border:1px solid #8a93a5;padding:4pt;vertical-align:top}
h1,h2{color:#8A1538} .no-word{display:none}</style></head><body dir="rtl">${html}</body></html>`;
        const url = URL.createObjectURL(new Blob(["﻿", doc], { type: "application/msword" }));
        const a = document.createElement("a");
        a.href = url; a.download = `ملخص توصيات الزيارات - ${monthName}.doc`; a.click();
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
    };

    const select = "border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white";
    return (
        <div className="space-y-4">
            <style>{`
                @media print {
                    body * { visibility: hidden !important; }
                    #monthly-report-sheet, #monthly-report-sheet * { visibility: visible !important; }
                    #monthly-report-sheet { position: absolute; left: 0; right: 0; top: 0; width: auto; margin: 0 !important; box-shadow: none !important; border: 0 !important; padding: 0 2px !important; }
                    @page { size: A4 portrait; margin: 12mm; }
                    .mr-table tr { break-inside: avoid; }
                    .no-print { display: none !important; }
                }
                #monthly-report-sheet { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                .mr-title { color: #8A1538; }
                .mr-table { width: 100%; border-collapse: collapse; font-size: 13px; }
                .mr-table th { background: #1F3864; color: #fff; font-weight: 700; padding: 8px 6px; border: 1px solid #8a93a5; }
                .mr-table td { border: 1px solid #cbd2dc; padding: 8px 6px; vertical-align: top; line-height: 1.7; }
                .mr-table tr:nth-child(even) td { background: #f4f6f9; }
                .mr-rule { border-bottom: 2px solid #8A1538; }
                .print-only-empty { display: none; }
                @media print { .print-only-empty { display: inline; } }
            `}</style>

            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-3 flex flex-wrap gap-2 items-center">
                <select aria-label="الشهر" value={month} onChange={e => setMonth(e.target.value)} className={select}>
                    {(months.length ? months : [month]).map(mo => { const [yy, mm] = mo.split("-").map(Number); return <option key={mo} value={mo}>{MONTHS[mm - 1]} {yy}</option>; })}
                </select>
                {setup.departments.length > 1 && (
                    <select aria-label="القسم" value={department} onChange={e => setDepartment(e.target.value)} className={select}>
                        <option value="">كل الأقسام</option>
                        {setup.departments.map((d: string) => <option key={d} value={d}>{d}</option>)}
                    </select>
                )}
                <select aria-label="الزائر" value={role} onChange={e => setRole(e.target.value as VisitorRole | "")} className={select}>
                    <option value="">كل الزائرين</option>
                    {ROLE_ORDER.map(r => <option key={r} value={r}>{SECTION_TITLE[r]}</option>)}
                </select>
                <div className="flex gap-2 mr-auto">
                    <button onClick={() => window.print()} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-qatar-maroon text-white text-sm font-black"><Printer className="w-4 h-4"/>طباعة / PDF</button>
                    <button onClick={exportWord} disabled={!rows.length} className="flex items-center gap-2 px-4 py-2 rounded-xl border-2 border-slate-200 text-sm font-black text-slate-700 disabled:opacity-40"><FileText className="w-4 h-4"/>Word</button>
                    <button onClick={() => void exportExcel()} disabled={!rows.length} className="flex items-center gap-2 px-4 py-2 rounded-xl border-2 border-slate-200 text-sm font-black text-slate-700 disabled:opacity-40"><Download className="w-4 h-4"/>Excel</button>
                </div>
            </div>

            <div id="monthly-report-sheet" dir="rtl" className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-6" style={{ fontFamily: `"Sakkal Majalla", "Traditional Arabic", Arial, sans-serif`, fontSize: 15 }}>
                <header className="text-center space-y-1">
                    <h1 className="mr-title text-xl font-black">{title}</h1>
                    <p className="mr-title font-bold">{setup.settings.schoolNameOnForm} · العام الأكاديمي {setup.settings.academicYear}</p>
                </header>
                <div className="flex justify-between items-end mr-rule pb-1">
                    <h2 className="text-lg font-black">الشهر: {monthName}</h2>
                    <span className="text-sm text-slate-600">{scopeLine}</span>
                </div>

                {!rows.length ? <p className="text-center text-slate-500 py-10">لا توجد زيارات معتمدة في هذا الشهر.</p> : <>
                    {/* the month in figures */}
                    <table className="mr-table">
                        <thead><tr><th>عدد الزيارات</th><th>المعلمون المُزارون</th>{ROLE_ORDER.map(r => <th key={r}>{SECTION_TITLE[r].replace("زيارات ", "")}</th>)}<th>متوسط الأداء</th><th>زيارات لها خطة تحسين</th></tr></thead>
                        <tbody><tr className="text-center font-bold">
                            <td>{rows.length}</td><td>{stats.teachers}</td>
                            {ROLE_ORDER.map(r => <td key={r}>{rows.filter(x => x.visit.visitorRole === r).length}</td>)}
                            <td>{pct(stats.average)}</td><td>{stats.withPlan} من {rows.length}</td>
                        </tr></tbody>
                    </table>

                    {sections.map((s, n) => (
                        <section key={s.role} className="space-y-2">
                            <h2 className="mr-title text-lg font-black mr-rule pb-1">{ORDINALS[n]}: {SECTION_TITLE[s.role]}</h2>
                            <table className="mr-table">
                                <thead><tr>
                                    <th style={{ width: "4%" }}>م</th><th style={{ width: "15%" }}>اسم المعلم</th><th style={{ width: "10%" }}>المادة</th>
                                    <th style={{ width: "9%" }}>تاريخ الزيارة</th>{s.role !== "deputy" && <th style={{ width: "12%" }}>الزائر</th>}
                                    <th style={{ width: "6%" }}>المعدل</th><th>أهم التوصيات</th><th style={{ width: "25%" }}>آلية التحسين</th>
                                </tr></thead>
                                <tbody>
                                    {s.rows.map((r, i) => (
                                        <tr key={r.visit._id}>
                                            <td className="text-center">{i + 1}</td>
                                            <td className="font-bold">{r.visit.teacherName}<div className="text-xs font-normal text-slate-500">{r.visit.className}</div></td>
                                            <td className="text-center">{r.visit.subjectName}</td>
                                            <td className="text-center whitespace-nowrap">{formatDate(r.visit.visitDate)}</td>
                                            {s.role !== "deputy" && <td>{r.visit.visitorName}</td>}
                                            <td className="text-center font-bold">{pct(r.visit.averageScore)}</td>
                                            <td>{r.recs || "—"}</td>
                                            <td>{r.actions || <MechanismEditor visit={r.visit} today={setup.today}/>}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </section>
                    ))}

                    {/* what the month says about the criteria */}
                    <section className="space-y-2">
                        <h2 className="mr-title text-lg font-black mr-rule pb-1">{ORDINALS[sections.length]}: أولويات التطوير المهني لهذا الشهر</h2>
                        {stats.weakest.length ? (
                            <table className="mr-table">
                                <thead><tr><th style={{ width: "4%" }}>م</th><th>المعيار الأكثر احتياجًا</th><th style={{ width: "12%" }}>متوسط المعيار</th><th style={{ width: "14%" }}>عدد الزيارات المقيسة</th></tr></thead>
                                <tbody>{stats.weakest.map((c, i) => (
                                    <tr key={c._id}><td className="text-center">{i + 1}</td><td>{c.text}</td><td className="text-center font-bold">{pct(c.average)}</td><td className="text-center">{c.n}</td></tr>
                                ))}</tbody>
                            </table>
                        ) : <p className="text-slate-600">كل المعايير المقيسة هذا الشهر حققت الدرجة الكاملة.</p>}
                        {!!stats.strongest.length && <p className="text-sm text-slate-700 leading-7"><strong>أبرز نقاط القوة:</strong> {stats.strongest.map(c => `${c.text.replace(/\.$/, "")} (${pct(c.average)})`).join("؛ ")}.</p>}
                    </section>
                </>}

                <p className="text-xs text-slate-500 border-t border-slate-200 pt-2">
                    أُعدّ من الزيارات المعتمدة في نظام الإشراف الصفي. «آلية التحسين» من خطط التحسين والتدريب المسجّلة لكل زيارة في «المتابعة والخطة».
                </p>
            </div>
        </div>
    );
}
