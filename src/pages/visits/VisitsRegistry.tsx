import { useMemo, useState } from "react";
import { useSupervisionQuery as useQuery, useSupervisionMutation as useMutation } from "../../lib/supervisionSession";
// @ts-ignore
import { api } from "../../../convex/_generated/api";
import { Download, Pencil, Printer, RotateCcw, Search, Trash2, X } from "lucide-react";
import { DOMAINS, DOMAIN_LABELS, ROLE_LABELS, dayName, formatDate } from "../../../convex/visitMath";
import { applyFilters, pct, scoreTone, type Filters, type VisitRow } from "../../lib/visitStats";
import { downloadWorkbook } from "../../lib/excelExport";
import FiltersBar, { periodPresets } from "./FiltersBar";
import type { Session } from "./VisitsPage";

// Every visit, filterable, with the drafts and the bin kept apart so the list
// of record stays clean. Deleting asks for a reason and only moves the visit to
// the bin, from where it can be brought back.

type View = "submitted" | "draft" | "deleted";

export default function VisitsRegistry({ setup, visits, session, onEdit, onPrint, onOpenTeacher, initialView = "submitted" }: {
    setup: any;
    initialView?: "submitted" | "draft";
    visits: VisitRow[];
    session: Session;
    onEdit: (id: string) => void;
    onPrint: (id: string) => void;
    onOpenTeacher: (teacherId: string) => void;
}) {
    const year = periodPresets(setup)[0];
    const [filters, setFilters] = useState<Filters>({ department: "", teacherId: "", role: "", from: initialView === "draft" ? "" : year.from, to: initialView === "draft" ? "" : year.to });
    const [view, setView] = useState<View>(initialView);
    const [search, setSearch] = useState("");
    const [deleting, setDeleting] = useState<VisitRow | null>(null);
    const [reason, setReason] = useState("");
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);

    // @ts-ignore
    const deleted = useQuery(api.visits.listVisits, view === "deleted" ? { deleted: true } : "skip") as VisitRow[] | undefined;
    // @ts-ignore
    const deleteVisit = useMutation(api.visits.deleteVisit);
    // @ts-ignore
    const restoreVisit = useMutation(api.visits.restoreVisit);

    const source = view === "deleted" ? (deleted ?? []) : visits.filter(v => v.status === view);
    const rows = useMemo(() => {
        const q = search.trim();
        return applyFilters(source, filters).filter(v => !q
            || v.teacherName.includes(q) || v.visitorName.includes(q)
            || v.lessonTopic.includes(q) || v.className.includes(q) || String(v.recordNo ?? "") === q);
    }, [source, filters, search]);

    const counts = {
        submitted: applyFilters(visits, filters).filter(v => v.status === "submitted").length,
        draft: applyFilters(visits, filters).filter(v => v.status === "draft").length,
    };

    const confirmDelete = async () => {
        if (!deleting || !reason.trim()) return;
        setBusy(true); setError("");
        try {
            await deleteVisit({ id: deleting._id as any, reason, actorName: session.name });
            setDeleting(null); setReason("");
        } catch (e: any) { setError(typeof e?.data === "string" ? e.data : "تعذّر تنفيذ العملية؛ حاول مرة أخرى"); } finally { setBusy(false); }
    };

    const exportExcel = () => downloadWorkbook(`سجل الزيارات الصفية - ${setup.settings.academicYear}`, [{
        name: "سجل الزيارات",
        title: "سجل الزيارات الصفية",
        meta: [setup.settings.schoolNameOnForm, `الفترة: ${filters.from ? formatDate(filters.from) : "البداية"} — ${filters.to ? formatDate(filters.to) : "كل التواريخ"} · ${rows.length} زيارة`],
        columns: [
            { header: "رقم السجل", width: 9, align: "center" },
            { header: "التاريخ", width: 12, align: "center" },
            { header: "المعلم", width: 30, bold: true },
            { header: "القسم", width: 22 },
            { header: "الصف", width: 9, align: "center" },
            { header: "الدرس", width: 24 },
            { header: "الزائر", width: 12, align: "center" },
            { header: "اسم الزائر", width: 26 },
            { header: "رقم الزيارة", width: 9, align: "center" },
            { header: "المتابعة", width: 9, align: "center" },
            ...DOMAINS.map(d => ({ header: DOMAIN_LABELS[d], width: 11, align: "center" as const, numFmt: "0.0%" })),
            { header: "المعدل", width: 10, align: "center" as const, bold: true, numFmt: "0.0%" },
        ],
        rows: rows.map(v => {
            let dom: Record<string, number | null> = {};
            try { dom = JSON.parse(v.domainAverages || "{}"); } catch { /* ignore */ }
            return [
                v.recordNo, formatDate(v.visitDate), v.teacherName, v.department, v.className, v.lessonTopic,
                ROLE_LABELS[v.visitorRole], v.visitorName, v.visitNumber || null,
                v.followUpType === "partial" ? "جزئية" : "كلية",
                ...DOMAINS.map(d => dom[d] ?? null), v.averageScore,
            ];
        }),
        freezeColumns: 3,
        orientation: "landscape",
    }]);

    return (
        <div className="space-y-4">
            {error && <p role="alert" className="text-red-700 text-sm">{error}</p>}
            <FiltersBar setup={setup} value={filters} onChange={setFilters} showTeacher/>

            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2 flex-wrap">
                    {([
                        ["submitted", `المعتمدة (${counts.submitted})`],
                        ["draft", `المسودات (${counts.draft})`],
                        ...(session.role === "deputy" ? [["deleted", "سلة المحذوفات"]] : []),
                    ] as [View, string][]).map(([k, label]) => (
                        <button key={k} onClick={() => setView(k)} aria-pressed={view === k}
                            className={`px-3 py-1.5 rounded-lg text-xs font-black border ${
                                view === k ? "bg-qatar-maroon text-white border-transparent" : "bg-white text-slate-500 border-slate-200"}`}>
                            {label}
                        </button>
                    ))}
                    <div className="relative mr-auto">
                        <Search className="w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2"/>
                        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث بالاسم أو الدرس أو رقم السجل"
                            className="border border-slate-200 rounded-lg pr-8 pl-3 py-2 text-xs bg-white focus:outline-none focus:border-qatar-maroon w-56"/>
                    </div>
                    {view === "submitted" && (
                        <button onClick={exportExcel}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 text-xs font-bold hover:border-qatar-maroon hover:text-qatar-maroon">
                            <Download className="w-3.5 h-3.5"/>Excel
                        </button>
                    )}
                </div>

                {rows.length === 0 ? (
                    <p className="p-8 text-center text-sm font-bold text-slate-400">
                        {view === "deleted" ? "السلة فارغة." : view === "draft" ? "لا توجد مسودات." : "لا توجد زيارات تطابق المرشحات."}
                    </p>
                ) : (
                    <div className="overflow-auto">
                        <table className="w-full text-xs">
                            <thead className="bg-slate-50 text-slate-600">
                                <tr>
                                    {["السجل", "التاريخ", "المعلم", "القسم", "الصف", "الدرس", "الزائر", "المعدل",
                                      view === "deleted" ? "سبب الحذف" : "", ""].map((h, i) => (
                                        <th key={i} className="px-2 py-2 font-semibold text-right whitespace-nowrap">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map(v => (
                                    <tr key={v._id} className="border-t border-slate-100 hover:bg-slate-50 align-top">
                                        <td className="px-2 py-2 font-black text-slate-400">{v.recordNo ?? "—"}</td>
                                        <td className="px-2 py-2 whitespace-nowrap">
                                            <span className="font-bold text-slate-700">{formatDate(v.visitDate)}</span>
                                            <span className="block text-[10px] text-slate-400">{dayName(v.visitDate)}</span>
                                        </td>
                                        <td className="px-2 py-2">
                                            <button onClick={() => v.teacherId && onOpenTeacher(v.teacherId)}
                                                className="font-black text-slate-800 hover:text-qatar-maroon text-right">
                                                {v.teacherName}
                                            </button>
                                            {v.visitNumber ? <span className="block text-[10px] text-slate-400">زيارة رقم {v.visitNumber}</span> : null}
                                        </td>
                                        <td className="px-2 py-2 text-slate-600">{v.department}</td>
                                        <td className="px-2 py-2 text-slate-600">{v.className}</td>
                                        <td className="px-2 py-2 text-slate-600 max-w-[180px]">{v.lessonTopic}</td>
                                        <td className="px-2 py-2 whitespace-nowrap">
                                            <span className="font-bold text-slate-700">{ROLE_LABELS[v.visitorRole]}</span>
                                            <span className="block text-[10px] text-slate-400">{v.visitorName}</span>
                                        </td>
                                        <td className="px-2 py-2 font-black" style={{ color: scoreTone(v.averageScore) }}>
                                            {v.status === "submitted" ? pct(v.averageScore, 1) : "—"}
                                        </td>
                                        <td className="px-2 py-2 text-slate-500 max-w-[160px]">
                                            {view === "deleted" ? v.deleteReason : ""}
                                        </td>
                                        <td className="px-2 py-2">
                                            <div className="flex gap-1 justify-end">
                                                {view === "deleted" ? (
                                                    <IconBtn title="استرجاع" onClick={() => { void restoreVisit({ id: v._id as any, actorName: session.name }).catch((e: any) => setError(typeof e?.data === "string" ? e.data : "تعذّر الاسترجاع")); }}>
                                                        <RotateCcw className="w-4 h-4"/>
                                                    </IconBtn>
                                                ) : (
                                                    <>
                                                        {v.status === "submitted" && (
                                                            <IconBtn title="الاستمارة (PDF)" onClick={() => onPrint(v._id)}>
                                                                <Printer className="w-4 h-4"/>
                                                            </IconBtn>
                                                        )}
                                                        {(session.role === "deputy" || v.visitorId === session.visitorId || v.recordedByVisitorId === session.visitorId) && <IconBtn title={v.status === "draft" ? "إكمال المسودة" : "تعديل"} onClick={() => onEdit(v._id)}>
                                                            <Pencil className="w-4 h-4"/>
                                                        </IconBtn>}
                                                        {session.role === "deputy" && <IconBtn title="حذف" danger onClick={() => { setDeleting(v); setReason(""); }}>
                                                            <Trash2 className="w-4 h-4"/>
                                                        </IconBtn>}
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {deleting && (
                <div className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center p-3" role="dialog" aria-modal="true">
                    <div className="bg-white rounded-2xl w-full max-w-md shadow-xl p-5 space-y-3">
                        <div className="flex items-center justify-between">
                            <p className="font-black text-slate-800">نقل الزيارة إلى سلة المحذوفات</p>
                            <button onClick={() => setDeleting(null)} aria-label="إغلاق"><X className="w-5 h-5 text-slate-400"/></button>
                        </div>
                        <p className="text-sm font-bold text-slate-600">
                            {deleting.teacherName} · {formatDate(deleting.visitDate)} · {ROLE_LABELS[deleting.visitorRole]}
                        </p>
                        <label className="block">
                            <span className="block text-xs font-black text-slate-500 mb-1.5">سبب الحذف (إلزامي)</span>
                            <input value={reason} onChange={e => setReason(e.target.value)} autoFocus
                                className="w-full border-2 border-slate-100 rounded-xl px-3 py-2.5 text-sm font-bold bg-slate-50 focus:outline-none focus:border-qatar-maroon"/>
                        </label>
                        <p className="text-[11px] font-bold text-slate-400">يمكن استرجاع الزيارة لاحقاً من سلة المحذوفات.</p>
                        <button onClick={confirmDelete} disabled={!reason.trim() || busy}
                            className="w-full py-2.5 rounded-xl bg-rose-700 text-white font-black text-sm disabled:opacity-40">
                            نقل إلى السلة
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

function IconBtn({ title, onClick, danger, children }: { title: string; onClick: () => void; danger?: boolean; children: React.ReactNode }) {
    return (
        <button onClick={onClick} title={title} aria-label={title}
            className={`p-1.5 rounded-lg border ${danger ? "border-rose-100 text-rose-600 hover:bg-rose-50" : "border-slate-200 text-slate-500 hover:border-qatar-maroon hover:text-qatar-maroon"}`}>
            {children}
        </button>
    );
}
