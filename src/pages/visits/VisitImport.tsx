import ImportPdfPreview from "./ImportPdfPreview";
import { useEffect, useState } from "react";
import { FileUp, Loader2 } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { useSupervisionMutation, useSupervisionAction, useSupervisionQuery } from "../../lib/supervisionSession";
import { proposeVisit, readVisitPdf } from "../../lib/visitImport";
import { useUnsavedChanges } from "../../lib/useUnsavedChanges";

export function OriginalVisitPdf({ visitId }: { visitId: string }) {
    const source = useSupervisionQuery((api as any).visitImports.original, { visitId });
    return source?.url ? <a className="text-qatar-maroon underline text-sm" href={source.url} target="_blank" rel="noreferrer">فتح ملف الموجّه الأصلي · {source.filename}</a> : null;
}

export default function VisitImport({ setup, onOpen, onDirtyChange }: { setup: any; onOpen: (id: string) => void; onDirtyChange: (dirty: boolean) => void }) {
    const upload = useSupervisionAction((api as any).visitImports.upload);
    const save = useSupervisionMutation(api.visits.saveVisit);
    const [file, setFile] = useState<File | null>(null), [url, setUrl] = useState("");
    const [text, setText] = useState(""), [form, setForm] = useState<ReturnType<typeof proposeVisit> | null>(null);
    const [sourceId, setSourceId] = useState<string | null>(null);
    const [busy, setBusy] = useState(""), [error, setError] = useState("");
    useUnsavedChanges(!!file, onDirtyChange);
    useEffect(() => { if (!file) return; const next = URL.createObjectURL(file); setUrl(next); return () => URL.revokeObjectURL(next); }, [file]);
    const choose = async (selected?: File) => {
        if (!selected) return;
        setError(""); setBusy("جاري قراءة ملف الزيارة…"); setFile(null); setForm(null); setSourceId(null); setText("");
        try { const content = await readVisitPdf(selected); setText(content); setForm(proposeVisit(content, setup)); setFile(selected); }
        catch (e) { setError(e instanceof Error ? e.message : "تعذرت قراءة PDF. تأكد أنه غير محمي بكلمة مرور وأعد تصديره من Word."); }
        finally { setBusy(""); }
    };
    const create = async () => {
        if (!file || !form || !form.teacherId || !form.supervisorId || !form.visitDate) return;
        setError(""); setBusy("جاري حفظ الأصل ومسودة الزيارة…");
        try {
            const id = sourceId ?? await upload({ filename: file.name, bytes: await file.arrayBuffer() });
            setSourceId(id);
            const { supervisorId, ...data } = form;
            const result = await save({ ...data, sourceImportId: id, visitorRole: "supervisor", visitorId: supervisorId, visitorName: "", ratings: JSON.stringify(form.ratings), status: "draft" });
            if (result.ok) { setFile(null); onDirtyChange(false); onOpen(result.id); }
        } catch (e: any) { setError(typeof e?.data === "string" ? e.data : "لم يكتمل الحفظ. أعد المحاولة؛ الملف المختار والبيانات ما زالا هنا."); }
        finally { setBusy(""); }
    };
    const fieldClass = "w-full border border-slate-300 rounded-lg bg-white px-3 py-2 text-sm focus:outline-qatar-maroon";
    const teacher = setup.teachers.find((t: any) => t._id === form?.teacherId);
    return <section className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 space-y-5" aria-busy={!!busy}>
        <div><h2 className="text-lg font-bold text-qatar-maroon">استيراد زيارة الموجّه</h2><p className="text-sm text-slate-600 mt-2 leading-7">اختر PDF المرسل من الموجّه. راجع البيانات المقترحة، ثم استكمل البنود والتوصيات في مسودة الزيارة. يدخل التقييم في التحليل بعد الاعتماد فقط.</p></div>
        <label className="block text-sm font-bold text-slate-700">ملف زيارة واحدة · PDF حتى 6 ميجابايت
            <input type="file" accept="application/pdf,.pdf" disabled={!!busy} onChange={e => { void choose(e.target.files?.[0]); e.target.value = ""; }} className="block mt-2 w-full text-sm file:rounded-lg file:border-0 file:bg-rose-50 file:px-4 file:py-3 file:text-qatar-maroon file:ml-3"/>
        </label>
        {busy && <p role="status" className="flex gap-2 text-sm"><Loader2 className="w-4 h-4 animate-spin"/>{busy}</p>}
        {error && <p role="alert" className="text-sm text-red-800 bg-red-50 p-3 rounded-lg">{error}</p>}
        {file && form && <>
            <div className="bg-amber-50 text-amber-950 text-sm rounded-lg p-3 leading-7">{text.trim() ? `استُخرج النص، واقتُرح ${Object.keys(form.ratings).length} تقدير صريح. علامات الاختيار داخل الجداول والبنود غير الواضحة تحتاج مراجعة يدوية.` : "لم يظهر نص قابل للاستخراج. يمكنك مراجعة الأصل وإدخال البيانات والبنود يدويًا."} لا تُحسب الخانات الفارغة كصفر.</div>
            <div className="grid lg:grid-cols-2 gap-6 items-start">
                <div className="space-y-4">
                    <h3 className="font-bold text-slate-800">تأكيد صاحب الزيارة وتاريخها</h3>
                    <label className="block text-sm space-y-2"><span>المعلم</span><select className={fieldClass} value={form.teacherId} onChange={e => setForm({ ...form, teacherId: e.target.value, supervisorId: "" })}><option value="">اختر المعلم</option>{setup.teachers.map((t: any) => <option value={t._id} key={t._id}>{t.fullName} · {t.department}</option>)}</select></label>
                    <label className="block text-sm space-y-2"><span>الموجّه الذي نفّذ الزيارة</span><select className={fieldClass} value={form.supervisorId} onChange={e => setForm({ ...form, supervisorId: e.target.value })}><option value="">اختر الموجّه المسجّل للقسم</option>{setup.visitors.filter((v: any) => v.role === "supervisor" && (!teacher || v.subjects.includes(teacher.department))).map((v: any) => <option key={v._id} value={v._id}>{v.fullName}</option>)}</select></label>
                    <label className="block text-sm space-y-2"><span>تاريخ الزيارة الوارد في الملف</span><input type="date" className={fieldClass} value={form.visitDate} onChange={e => setForm({ ...form, visitDate: e.target.value })}/></label>
                    <p className="text-xs text-slate-600 leading-6">إذا لم تجد اسم الموجّه، يضيفه النائب من «المعلمون والزائرون» مع تحديد القسم. سيُسجّل اسمك بصفتك مُدخل الزيارة.</p>
                    <button disabled={!!busy || !form.teacherId || !form.supervisorId || !form.visitDate} onClick={() => void create()} className="bg-qatar-maroon text-white rounded-lg px-4 py-3 text-sm font-bold disabled:opacity-40 flex gap-2 items-center"><FileUp className="w-4 h-4"/>حفظ مسودة واستكمال المراجعة</button>
                </div>
                <div className="space-y-3"><a href={url} target="_blank" rel="noreferrer" className="text-qatar-maroon underline text-sm">فتح الأصل في نافذة مستقلة · {file.name}</a><ImportPdfPreview key={file.name + file.lastModified} file={file}/><details><summary className="cursor-pointer text-sm text-slate-700">النص المستخرج للمراجعة والنسخ</summary><pre className="text-sm whitespace-pre-wrap font-sans leading-7 max-h-80 overflow-auto mt-3 p-3 bg-slate-50">{text || "لا يوجد نص قابل للاستخراج."}</pre></details></div>
            </div>
        </>}
    </section>;
}
