import { useUnsavedChanges } from "../../lib/useUnsavedChanges";
import { downloadWorkbook } from "../../lib/excelExport";
import { useState } from "react";
import { CalendarDays, Plus, X, Pencil, CheckCircle2 } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { useSupervisionMutation, useSupervisionQuery, useSupervisionSession } from "../../lib/supervisionSession";
import { formatDate } from "../../../convex/visitMath";
import type { VisitRow } from "../../lib/visitStats";

const kinds = { improvement: "خطة تحسين", training: "إجراء تدريبي", visit: "موعد زيارة" };
const states = { open: "قيد المتابعة", done: "مكتمل", cancelled: "ملغى" };
type Kind = keyof typeof kinds;
type Status = keyof typeof states;
type Entry = { _id?: string; updatedAt?: number; teacherId: string; visitId: string; completionVisitId: string;
    kind: Kind; title: string; owner: string; dueDate: string; evidence: string; status: Status };

export default function VisitFollowUp({ setup, visits, teacherId = "", onOpenTeacher, onDirtyChange }: {
    setup: any; visits: VisitRow[]; teacherId?: string; onOpenTeacher: (id: string) => void; onDirtyChange?: (dirty: boolean) => void;
}) {
    const session = useSupervisionSession()!;
    const rows = useSupervisionQuery((api as any).supervisionActions.list) as Entry[] | undefined;
    const save = useSupervisionMutation((api as any).supervisionActions.save);
    const [kind, setKind] = useState<Kind | "">("");
    const [status, setStatus] = useState<Status | "overdue" | "">("open");
    const [month, setMonth] = useState("");
    const [teacher, setTeacher] = useState(teacherId);
    const [form, setForm] = useState<Entry | null>(null);
    useUnsavedChanges(form !== null, onDirtyChange);
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState("");
    const teacherName = (id: string) => setup.teachers.find((t: any) => t._id === id)?.fullName ?? "معلم مؤرشف";
    const filtered = (rows ?? []).filter(r => (!kind || r.kind === kind) && (!teacher || r.teacherId === teacher)
        && (!month || r.dueDate.startsWith(month)) && (!status || (status === "overdue"
            ? r.status === "open" && r.dueDate < setup.today : r.status === status)));
    const overdue = (rows ?? []).filter(r => r.status === "open" && r.dueDate < setup.today).length;
    const patch = (data: Partial<Entry>) => { setForm(f => f ? { ...f, ...data } : null); setError(""); };
    const relatedVisits = visits.filter(v => v.teacherId === form?.teacherId && v.status === "submitted");
    const origin = visits.find(v => v._id === form?.visitId);
    const submit = async (e: React.FormEvent) => {
        e.preventDefault(); if (!form || busy) return;
        setBusy(true); setError("");
        try {
            await save({ id: form._id, expectedUpdatedAt: form.updatedAt, teacherId: form.teacherId,
                visitId: form.visitId || undefined, completionVisitId: form.completionVisitId || undefined,
                kind: form.kind, title: form.title, owner: form.owner, dueDate: form.dueDate,
                evidence: form.evidence, status: form.status });
            setForm(null); setMessage("تم حفظ سجل المتابعة");
        } catch (e: any) { setError(typeof e?.data === "string" ? e.data : "تعذّر الحفظ؛ تحقق من الاتصال وحاول مرة أخرى"); }
        finally { setBusy(false); }
    };
    const close = () => { if (window.confirm("إغلاق التعديل دون حفظ؟")) { setForm(null); setError(""); } };
    return <section className="supervision-followup space-y-4">
        <div className="rounded-2xl bg-qatar-maroon text-white p-5 flex flex-wrap items-center justify-between gap-4">
            <div><h2 className="text-lg font-bold">المتابعة وخطة الزيارات</h2>
                <p className="text-sm text-white/85 mt-1">الإجراءات والتدريب والمواعيد، في سجل مستقل عن الاستمارة المعتمدة.</p></div>
            <button className="bg-white text-qatar-maroon rounded-xl px-4 py-3 text-sm font-bold inline-flex items-center gap-2"
                onClick={() => { if (form && !window.confirm("تجاهل التعديل الحالي؟")) return; setError(""); setMessage(""); setForm({ teacherId: teacher, visitId: "", completionVisitId: "", kind: kind || "improvement", title: "", owner: session.name, dueDate: setup.today, evidence: "", status: "open" }); }}>
                <Plus size={18}/>إضافة متابعة</button>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-700">
            <button className="underline underline-offset-4 text-qatar-maroon min-h-11" onClick={() => { setStatus("overdue"); setMonth(""); setTeacher(""); setKind(""); }}>{overdue} إجراء متأخر</button>
            <span className="inline-flex items-center gap-2"><CalendarDays size={17}/>{(rows ?? []).filter(r => r.kind === "visit" && r.status === "open").length} موعد زيارة مفتوح</span>
            <button className="underline text-qatar-maroon min-h-11" onClick={() => downloadWorkbook("سجل متابعة الإشراف", [{ name: "المتابعة", title: "متابعة التوصيات وخطة الزيارات", columns: [{ header: "المعلم", width: 30 }, { header: "النوع", width: 20 }, { header: "الإجراء", width: 60 }, { header: "المسؤول", width: 25 }, { header: "الموعد", width: 15 }, { header: "الحالة", width: 18 }, { header: "دليل الإنجاز", width: 60 }], rows: filtered.map(r => [teacherName(r.teacherId), kinds[r.kind], r.title, r.owner, r.dueDate, states[r.status], r.evidence]), orientation: "landscape" }])}>تصدير النتائج إلى Excel</button>
            <span className="inline-flex items-center gap-2"><CheckCircle2 size={17}/>{(rows ?? []).filter(r => r.status === "done").length} إجراء مكتمل</span>
        </div>
        {message && <p role="status" className="text-sm text-emerald-800">{message}</p>}
        {form && <form onSubmit={submit} className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 space-y-4">
            <div className="flex justify-between gap-3"><h3 className="font-bold">{form._id ? "تعديل سجل المتابعة" : "متابعة جديدة"}</h3><button type="button" onClick={close} aria-label="إغلاق التعديل" className="p-2"><X size={20}/></button></div>
            <div className="grid gap-4 sm:grid-cols-2">
                <label>المعلم<select required disabled={!!form._id} value={form.teacherId} onChange={e => patch({ teacherId: e.target.value, visitId: "", completionVisitId: "" })}><option value="">اختر المعلم</option>{setup.teachers.map((t: any) => <option key={t._id} value={t._id}>{t.fullName} — {t.department}</option>)}</select></label>
                <label>نوع المتابعة<select value={form.kind} onChange={e => patch({ kind: e.target.value as Kind })}>{Object.entries(kinds).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
                <label>الزيارة الأصلية (اختياري)<select value={form.visitId} onChange={e => patch({ visitId: e.target.value })}><option value="">متابعة مستقلة</option>{relatedVisits.map(v => <option key={v._id} value={v._id}>{formatDate(v.visitDate)} — {v.lessonTopic}</option>)}</select></label>
                <label>المسؤول عن التنفيذ<input required maxLength={200} value={form.owner} onChange={e => patch({ owner: e.target.value })}/></label>
            </div>
            {origin && <div className="bg-slate-50 rounded-xl p-3 text-sm leading-7"><p className="font-bold">توصيات الزيارة الأصلية</p>{[origin.planningRec, origin.executionRec, origin.evalMgmtRec, origin.notes].filter(Boolean).map((t,i) => <p className="whitespace-pre-wrap" key={i}>{t}</p>)}</div>}
            <label className="block">الإجراء المطلوب ونتيجته المتوقعة<textarea required maxLength={2000} rows={3} value={form.title} onChange={e => patch({ title: e.target.value })} placeholder="إجراء محدد يمكن متابعة إنجازه"/></label>
            <div className="grid gap-4 sm:grid-cols-2">
                <label>الموعد المستهدف<input required type="date" value={form.dueDate} onChange={e => patch({ dueDate: e.target.value })}/></label>
                <label>الحالة<select value={form.status} onChange={e => patch({ status: e.target.value as Status })}>{Object.entries(states).map(([k,v]) => <option key={k} value={k}>{v}</option>)}</select></label>
            </div>
            <label className="block">دليل الإنجاز ونتيجة المتابعة{form.status === "done" ? " (مطلوب)" : " (اختياري)"}<textarea rows={3} required={form.status === "done"} maxLength={10000} value={form.evidence} onChange={e => patch({ evidence: e.target.value })} placeholder="ما الذي نُفّذ؟ وما أثره؟ يمكنك تدوين مرجع الشاهد أو رابطه."/></label>
            <label className="block">زيارة التحقق من الأثر / الزيارة المنفذة<select required={form.kind === "visit" && form.status === "done"} value={form.completionVisitId} onChange={e => patch({ completionVisitId: e.target.value })}><option value="">لم تُربط زيارة بعد</option>{relatedVisits.filter(v => v._id !== form.visitId).map(v => <option key={v._id} value={v._id}>{formatDate(v.visitDate)} — {v.lessonTopic}</option>)}</select></label>
            {error && <p role="alert" className="text-red-700 text-sm">{error}</p>}
            <div className="flex gap-3"><button disabled={busy} className="bg-qatar-maroon text-white rounded-xl px-5 py-3 font-bold disabled:opacity-50">{busy ? "جاري الحفظ…" : "حفظ المتابعة"}</button><button type="button" onClick={close} className="px-4 py-3 text-slate-600">إلغاء</button></div>
        </form>}
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 p-4 border-b border-slate-200">
                <label>المعلم<select value={teacher} onChange={e => setTeacher(e.target.value)}><option value="">كل المعلمين</option>{setup.teachers.map((t: any) => <option key={t._id} value={t._id}>{t.fullName}</option>)}</select></label>
                <label>النوع<select value={kind} onChange={e => setKind(e.target.value as Kind | "")}><option value="">كل الأنواع</option>{Object.entries(kinds).map(([k,v]) => <option key={k} value={k}>{v}</option>)}</select></label>
                <label>الحالة<select value={status} onChange={e => setStatus(e.target.value as Status | "overdue" | "")}><option value="">كل الحالات</option><option value="overdue">متأخر</option>{Object.entries(states).map(([k,v]) => <option key={k} value={k}>{v}</option>)}</select></label>
                <label>الشهر (فارغ لكل المواعيد)<input type="month" value={month} onChange={e => setMonth(e.target.value)}/></label>
            </div>
            {!rows ? <p className="p-6 text-slate-600">جاري تحميل المتابعة…</p> : filtered.length === 0 ? <p className="p-6 text-slate-600 text-sm">لا توجد إجراءات بهذه المرشحات. أضف متابعة أو غيّر المرشحات لعرض سجلات أخرى.</p> :
                <ul className="divide-y divide-slate-200">{filtered.map(r => <li key={r._id} className="p-4 sm:p-5 flex gap-4 justify-between items-start">
                    <div className="min-w-0 space-y-2"><div className="flex flex-wrap gap-2 items-center"><button className="font-bold text-qatar-maroon underline underline-offset-4" onClick={() => onOpenTeacher(r.teacherId)}>{teacherName(r.teacherId)}</button><span className="text-xs bg-slate-100 text-slate-700 px-2 py-1 rounded">{kinds[r.kind]}</span><span className={`text-xs font-bold ${r.status === "open" && r.dueDate < setup.today ? "text-red-700" : "text-slate-600"}`}>{r.status === "open" && r.dueDate < setup.today ? "متأخر" : states[r.status]}</span></div>
                        <p className="text-sm leading-7 whitespace-pre-wrap break-words">{r.title}</p><p className="text-sm text-slate-600">{r.owner} · الموعد {formatDate(r.dueDate)}</p>
                        {r.evidence && <details className="text-sm text-slate-600"><summary className="cursor-pointer py-1">دليل الإنجاز ونتيجة المتابعة</summary><p className="whitespace-pre-wrap break-words leading-7">{r.evidence}</p></details>}
                    </div><button className="p-3 rounded-lg hover:bg-slate-100 shrink-0 text-slate-600" aria-label={`تعديل متابعة ${teacherName(r.teacherId)}`} onClick={() => { if (form && !window.confirm("تجاهل التعديل الحالي؟")) return; setForm({ ...r, visitId: r.visitId ?? "", completionVisitId: r.completionVisitId ?? "" }); setError(""); }}><Pencil size={18}/></button>
                </li>)}</ul>}
        </div>
    </section>;
}
