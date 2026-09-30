import ImportPdfPreview from "./ImportPdfPreview";
import { useEffect, useState } from "react";
import { FileUp, Loader2 } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { useSupervisionMutation, useSupervisionAction, useSupervisionQuery, useSupervisionSession } from "../../lib/supervisionSession";
import { readVisitPdfDocument } from "../../lib/visitImport";
import { proposeLayoutVisit } from "../../lib/visitPdfLayout";
import { useUnsavedChanges } from "../../lib/useUnsavedChanges";

export function OriginalVisitPdf({ visitId }: { visitId: string }) {
    const source = useSupervisionQuery((api as any).visitImports.original, { visitId });
    return source?.url ? <a className="text-qatar-maroon underline text-sm" href={source.url} target="_blank" rel="noreferrer">فتح ملف الزيارة الأصلي · {source.filename}</a> : null;
}

export default function VisitImport({ setup, onOpen, onDirtyChange }: { setup: any; onOpen: (id: string) => void; onDirtyChange: (dirty: boolean) => void }) {
    const session=useSupervisionSession();
    const upload = useSupervisionAction((api as any).visitImports.upload);
    const save = useSupervisionMutation(api.visits.saveVisit);
    const [file, setFile] = useState<File | null>(null), [url, setUrl] = useState("");
    const [text, setText] = useState(""), [form, setForm] = useState<ReturnType<typeof proposeLayoutVisit>["form"] | null>(null);
    const [review, setReview] = useState<ReturnType<typeof proposeLayoutVisit>["review"] | null>(null);
    const [reviewed, setReviewed] = useState(false);
    const update = (next: NonNullable<typeof form>) => { setForm(next); setReviewed(false); };
    const [sourceId, setSourceId] = useState<string | null>(null);
    const [busy, setBusy] = useState(""), [error, setError] = useState("");
    useUnsavedChanges(!!file, onDirtyChange);
    useEffect(() => { if (!file) return; const next = URL.createObjectURL(file); setUrl(next); return () => URL.revokeObjectURL(next); }, [file]);
    const choose = async (selected?: File) => {
        if (!selected) return;
        setError(""); setBusy("جاري قراءة ملف الزيارة…"); setFile(null); setForm(null); setSourceId(null); setText(""); setReview(null); setReviewed(false);
        try { const content = await readVisitPdfDocument(selected); const result=proposeLayoutVisit(content,setup); setText(content.text); setForm(result.form); setReview(result.review); setFile(selected); }
        catch (e) { setError(e instanceof Error ? e.message : "تعذرت قراءة PDF. تأكد أنه غير محمي بكلمة مرور وأعد تصديره من Word."); }
        finally { setBusy(""); }
    };
    const create = async () => {
        if (!file || !form || !form.teacherId || (form.visitorRole!=="deputy" && !form.supervisorId) || !form.visitDate || !reviewed || unresolved) return;
        setError(""); setBusy("جاري حفظ الأصل ومسودة الزيارة…");
        try {
            const id = sourceId ?? await upload({ filename: file.name, bytes: await file.arrayBuffer() });
            setSourceId(id);
            const { supervisorId, classId, visitorRole, ...data } = form;
            const result = await save({ ...data, classId: classId || undefined, sourceImportId: id, visitorRole, visitorId: visitorRole === "deputy" ? undefined : supervisorId, visitorName: "", ratings: JSON.stringify(form.ratings), status: "draft" });
            if (result.ok) { setFile(null); onDirtyChange(false); onOpen(result.id); }
            else if(result.duplicate) setError("توجد زيارة لنفس المعلم والزائر والتاريخ بالفعل؛ راجع سجل الزيارات لتجنب التكرار.");
        } catch (e: any) { setError(typeof e?.data === "string" ? e.data : "لم يكتمل الحفظ. أعد المحاولة؛ الملف المختار والبيانات ما زالا هنا."); }
        finally { setBusy(""); }
    };
    const fieldClass = "w-full border border-slate-300 rounded-lg bg-white px-3 py-2 text-sm focus:outline-qatar-maroon";
    const teacher = setup.teachers.find((t: any) => t._id === form?.teacherId);
    const unresolved = review?.rows.filter(r=>r.state==="conflict" && r.criterionId && form?.ratings[r.criterionId]===undefined).length ?? 0;
    return <section className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 space-y-5" aria-busy={!!busy}>
        <div><h2 className="text-lg font-bold text-qatar-maroon">استيراد زيارة سابقة</h2><p className="text-sm text-slate-600 mt-2 leading-7">اختر PDF لزيارة النائب أو المنسق أو الموجّه. راجع البيانات المقترحة، ثم استكمل البنود والتوصيات في مسودة الزيارة. يدخل التقييم في التحليل بعد الاعتماد فقط.</p></div>
        <label className="block text-sm font-bold text-slate-700">ملف زيارة واحدة · PDF حتى 6 ميجابايت
            <input type="file" accept="application/pdf,.pdf" disabled={!!busy} onChange={e => { void choose(e.target.files?.[0]); e.target.value = ""; }} className="block mt-2 w-full text-sm file:rounded-lg file:border-0 file:bg-rose-50 file:px-4 file:py-3 file:text-qatar-maroon file:ml-3"/>
        </label>
        {busy && <p role="status" className="flex gap-2 text-sm"><Loader2 className="w-4 h-4 animate-spin"/>{busy}</p>}
        {error && <p role="alert" className="text-sm text-red-800 bg-red-50 p-3 rounded-lg">{error}</p>}
        {file && form && <>
            <div className="bg-amber-50 text-amber-950 text-sm rounded-lg p-3 leading-7">{review?.recognized ? `تم التعرف على استمارة الزيارة واستخراج ${review.rows.filter(r=>r.state==="read").length} تقدير واضح من ${review.rows.length} بندًا. راجع النتائج بجوار الأصل.` : "لم يُتعرف على قالب الجدول؛ البيانات الظاهرة مقترحات أولية فقط، وتُستكمل التقييمات يدويًا."} لا تُحسب الخانات الفارغة كصفر.
                {review?.warnings.map(w=><p key={w}>{w}</p>)}
                {!!unresolved && <p className="font-bold">يوجد {unresolved} بند عليه علامات متعارضة؛ يلزم حسمه في التقييمات أدناه.</p>}
                <a href={url} target="_blank" rel="noreferrer" className="inline-block underline text-qatar-maroon mt-1">فتح الاستمارة الأصلية للمقارنة</a>
            </div>
            <div className="grid lg:grid-cols-2 gap-6 items-start">
                <div className="space-y-4">
                    <h3 className="font-bold text-slate-800">تأكيد صاحب الزيارة وتاريخها</h3>
                    {review?.teacherName && <p className="text-sm text-slate-600">اسم المعلم في الملف: <strong>{review.teacherName}</strong></p>}
                    {!form.teacherId && !!review?.teacherSuggestions.length && <div className="text-sm space-y-2"><p>هل المقصود أحد هؤلاء؟ تأكيد الاسم مطلوب.</p>{setup.teachers.filter((t:any)=>review.teacherSuggestions.includes(t._id)).map((t:any)=><button key={t._id} className="border border-qatar-maroon rounded-lg px-3 py-2 text-qatar-maroon" onClick={()=>update({...form,teacherId:t._id,supervisorId:""})}>تأكيد: {t.fullName}</button>)}</div>}
                    <label className="block text-sm space-y-2"><span>المعلم</span><select className={fieldClass} value={form.teacherId} onChange={e => update({ ...form, teacherId: e.target.value, supervisorId: "" })}><option value="">اختر المعلم</option>{setup.teachers.map((t: any) => <option value={t._id} key={t._id}>{t.fullName} · {t.department}</option>)}</select></label>
                    <label className="block text-sm space-y-2"><span>صفة الزائر في الملف</span><select className={fieldClass} value={form.visitorRole} onChange={e=>update({...form,visitorRole:e.target.value as typeof form.visitorRole,supervisorId:''})}><option value="supervisor">الموجّه</option><option value="coordinator">المنسق</option>{session?.role!=="coordinator"&&<option value="deputy">النائب الأكاديمي</option>}</select></label>
                    {form.visitorRole==='deputy'?<p className="text-sm rounded-lg bg-slate-50 p-3">النائب الأكاديمي: {setup.settings?.deputyName || 'الاسم المحدد في الإعدادات'}</p>:<label className="block text-sm space-y-2"><span>الزائر الذي نفّذ الزيارة</span><select className={fieldClass} value={form.supervisorId} onChange={e => update({ ...form, supervisorId: e.target.value })}><option value="">اختر الزائر المسجّل للقسم</option>{setup.visitors.filter((v: any) => v.role === form.visitorRole && (!teacher || v.subjects.includes(teacher.department)) && (session?.role!=="coordinator"||v.role!=="coordinator"||v._id===session.visitorId)).map((v: any) => <option key={v._id} value={v._id}>{v.fullName}</option>)}</select></label>}
                    <label className="block text-sm space-y-2"><span>تاريخ الزيارة الوارد في الملف</span><input type="date" className={fieldClass} value={form.visitDate} onChange={e => update({ ...form, visitDate: e.target.value })}/></label>
                    <label className="block text-sm space-y-2"><span>رقم الزيارة في الأصل (اختياري)</span><input type="number" min="1" max="999" className={fieldClass} value={form.originalVisitNumber??''} onChange={e=>update({...form,originalVisitNumber:e.target.value?Number(e.target.value):undefined})}/></label>
                    <p className="text-xs text-slate-600 leading-6">إذا لم تجد اسم الزائر، يضيفه النائب من «المعلمون والزائرون» مع تحديد القسم. سيُسجّل اسمك بصفتك مُدخل الزيارة.</p>
                    {review?.supervisorName && <p className="text-xs text-slate-600">الزائر في الملف: {review.supervisorName}</p>}
                    <label className="block text-sm space-y-2"><span>الصف في الملف: {review?.className || "غير مستخرج"}</span><select className={fieldClass} value={form.classId} onChange={e=>update({...form,classId:e.target.value})}><option value="">اختر الصف المطابق</option>{(setup.classes ?? []).map((c:any)=><option key={c._id} value={c._id}>{c.name}</option>)}</select></label>
                    <div className="grid grid-cols-2 gap-3"><label className="text-sm space-y-2"><span>نوع المتابعة</span><select className={fieldClass} value={form.followUpType} onChange={e=>update({...form,followUpType:e.target.value as "full"|"partial"})}><option value="full">كلية</option><option value="partial">جزئية</option></select></label><label className="text-sm space-y-2"><span>طريقة الزيارة</span><select className={fieldClass} value={form.deliveryMode} onChange={e=>update({...form,deliveryMode:e.target.value as "field"|"remote"})}><option value="field">ميدانية</option><option value="remote">عن بُعد</option></select></label></div>
                    {([['subjectName','المادة'],['lessonTopic','موضوع الدرس'],['planningRec','توصيات التخطيط'],['executionRec','توصيات تنفيذ الدرس'],['evalMgmtRec','توصيات التقويم'],['managementRec','توصيات الإدارة الصفية'],['notes','الملاحظات العامة']] as const).map(([key,label])=><label key={key} className="block text-sm space-y-2"><span>{label}</span><textarea rows={key==='subjectName'||key==='lessonTopic'?2:4} className={fieldClass} value={form[key]} onChange={e=>update({...form,[key]:e.target.value})}/></label>)}
                    {!!review?.rows.length && <details open className="border border-slate-200 rounded-lg p-3"><summary className="font-bold text-sm cursor-pointer">التقييمات · {unresolved ? `${unresolved} تعارض يحتاج مراجعة` : "راجع التقديرات"}</summary><div className="divide-y divide-slate-100 mt-3">{review.rows.map((r,i)=><label key={i} className="block py-3 space-y-2 text-sm"><span className="block">{i+1}. {r.text}</span><span className={`block text-xs ${r.state==='read'?'text-slate-500':'text-red-700'}`}>صفحة {r.page} · {r.state==='conflict'?'يوجد أكثر من علامة في الأصل؛ اختر التقدير بعد المراجعة':r.state==='empty'?'لا توجد علامة واضحة':r.state==='unmapped'?'البند لا يطابق معايير المنصة؛ يُراجع في المسودة':'تمت قراءة علامة واحدة'}</span><select aria-label={`تقدير البند ${i+1}`} disabled={!r.criterionId} className={fieldClass} value={form.ratings[r.criterionId] ?? ''} onChange={e=>{const ratings={...form.ratings};if(e.target.value==='')delete ratings[r.criterionId];else ratings[r.criterionId]=e.target.value==='not_measured'?'not_measured':Number(e.target.value) as 0|1|2|3;update({...form,ratings});}}><option value="">لم يُحدّد — يحتاج مراجعة</option><option value="3">3 · الأدلة مستكملة وفاعلة</option><option value="2">2 · تتوفر معظم الأدلة</option><option value="1">1 · تتوفر بعض الأدلة</option><option value="0">0 · الأدلة غير متوفرة أو محدودة</option><option value="not_measured">لم يتم قياسه</option></select></label>)}</div></details>}
                    <label className="flex gap-2 items-start text-sm leading-6"><input type="checkbox" className="mt-1 accent-qatar-maroon" checked={reviewed} onChange={e=>setReviewed(e.target.checked)}/><span>راجعت الأسماء والبيانات والتوصيات والتقديرات مع الملف الأصلي. سيتم الحفظ كمسودة للمراجعة والاعتماد.</span></label>
                    {!!unresolved && <p role="status" className="text-sm text-red-700">احسم التقديرات المتعارضة قبل حفظ المسودة.</p>}
                    <button disabled={!!busy || !form.teacherId || (form.visitorRole!=="deputy" && !form.supervisorId) || !form.visitDate || !reviewed || !!unresolved} onClick={() => void create()} className="bg-qatar-maroon text-white rounded-lg px-4 py-3 text-sm font-bold disabled:opacity-40 flex gap-2 items-center"><FileUp className="w-4 h-4"/>حفظ مسودة واستكمال المراجعة</button>
                </div>
                <div className="space-y-3 lg:sticky lg:top-4"><a href={url} target="_blank" rel="noreferrer" className="text-qatar-maroon underline text-sm">فتح الأصل في نافذة مستقلة · {file.name}</a><ImportPdfPreview key={file.name + file.lastModified} file={file}/><details><summary className="cursor-pointer text-sm text-slate-700">النص المستخرج للمراجعة والنسخ</summary><pre className="text-sm whitespace-pre-wrap font-sans leading-7 max-h-80 overflow-auto mt-3 p-3 bg-slate-50">{text || "لا يوجد نص قابل للاستخراج."}</pre></details></div>
            </div>
        </>}
    </section>;
}
