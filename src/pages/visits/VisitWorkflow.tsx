import { useState } from "react";
import { useConvex } from "convex/react";
import { FileDown, ImageUp, Loader2, Mail, MessageCircle, PenLine, Send, Trash2, Undo2, X } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { useSupervisionMutation, useSupervisionQuery, useSupervisionSession } from "../../lib/supervisionSession";
import type { VisitRow } from "../../lib/visitStats";
import type { Session } from "./VisitsPage";

// The steps around a visit that are not the form itself: the visitor's
// signature (uploaded once), sending a draft for review, and e-mailing the
// submitted form to the teacher.

const errorText = (e: any, fallback: string) => typeof e?.data === "string" ? e.data : fallback;

async function uploadFile(getUrl: () => Promise<string>, file: Blob) {
    const url = await getUrl();
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": file.type || "application/octet-stream" }, body: file });
    if (!res.ok) throw new Error("upload failed");
    return (await res.json()).storageId as string;
}

// ── توقيعي ────────────────────────────────────────────────────────────────
export function MySignatureButton({ session }: { session: Session }) {
    const [open, setOpen] = useState(false);
    if (session.role === "supervisor") return null;
    return <>
        <button onClick={() => setOpen(true)} title="توقيعي" aria-label="توقيعي"
            className="p-1 rounded-md text-slate-400 hover:text-qatar-maroon hover:bg-qatar-cream-dark">
            <PenLine className="w-4 h-4"/>
        </button>
        {open && <MySignatureDialog onClose={() => setOpen(false)}/>}
    </>;
}

function MySignatureDialog({ onClose }: { onClose: () => void }) {
    const url = useSupervisionQuery((api as any).visitWorkflow.mySignature) as string | null | undefined;
    const getUploadUrl = useSupervisionMutation((api as any).visitWorkflow.uploadUrl);
    const setSignature = useSupervisionMutation((api as any).visitWorkflow.setMySignature);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const upload = async (file: File) => {
        if (!/^image\/(png|jpeg)$/.test(file.type)) { setError("اختر صورة PNG أو JPG"); return; }
        if (file.size > 2 * 1024 * 1024) { setError("الصورة أكبر من 2 ميجا"); return; }
        setBusy(true); setError("");
        try { await setSignature({ storageId: await uploadFile(() => getUploadUrl({}), file) }); }
        catch (e) { setError(errorText(e, "تعذّر رفع التوقيع")); }
        finally { setBusy(false); }
    };
    return (
        <Dialog title="توقيعي" onClose={onClose}>
            <p className="text-xs font-bold text-slate-500 leading-relaxed">
                يُرفع مرة واحدة ويُطبع تلقائيًا في خانة توقيعك على زياراتك المعتمدة. يُفضَّل PNG بخلفية شفافة.
            </p>
            {url === undefined ? <div className="h-24 rounded-xl bg-slate-50 animate-pulse"/>
                : url ? <img src={url} alt="توقيعي" className="h-24 max-w-full object-contain rounded-xl border border-slate-100 bg-white p-2 mx-auto"/>
                : <p className="text-xs font-bold text-slate-400 text-center py-4">لم تُرفع توقيعًا بعد — تبقى الخانة فارغة للتوقيع باليد.</p>}
            <div className="flex gap-2 justify-center">
                <label className="flex items-center gap-2 px-4 py-2 rounded-xl bg-qatar-maroon text-white text-xs font-black cursor-pointer">
                    {busy ? <Loader2 className="w-4 h-4 animate-spin"/> : <ImageUp className="w-4 h-4"/>}
                    {url ? "تغيير التوقيع" : "رفع التوقيع"}
                    <input type="file" accept="image/png,image/jpeg" className="hidden" disabled={busy}
                        onChange={e => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = ""; }}/>
                </label>
                {url && <button disabled={busy} onClick={async () => {
                    if (!window.confirm("إزالة توقيعك؟ لن يُطبع على الزيارات التي تُعتمد بعد ذلك.")) return;
                    setBusy(true); try { await setSignature({ storageId: null }); } catch (e) { setError(errorText(e, "تعذّرت الإزالة")); } finally { setBusy(false); }
                }} className="flex items-center gap-1 px-3 py-2 rounded-xl border-2 border-rose-100 text-xs font-black text-rose-600">
                    <Trash2 className="w-4 h-4"/>إزالة
                </button>}
            </div>
            {error && <p role="alert" className="text-xs font-bold text-rose-700 text-center">{error}</p>}
        </Dialog>
    );
}

// ── Review ───────────────────────────────────────────────────────────────
export function isReviewer(v: Pick<VisitRow, "status" | "reviewRequest">, session: Session) {
    const r = v.reviewRequest;
    return v.status === "draft" && !!r && (r.toRole === "deputy" ? session.role === "deputy" : r.toVisitorId === session.visitorId);
}

// Choose who reviews the draft; the draft is saved first by the caller
export function SendForReviewDialog({ department, onSend, onClose }: {
    department: string;
    onSend: (target: { toRole: "deputy" | "coordinator"; toVisitorId?: string; name: string }, note: string) => Promise<void>;
    onClose: () => void;
}) {
    const options = useSupervisionQuery((api as any).visitWorkflow.reviewers, { department }) as any[] | undefined;
    const [choice, setChoice] = useState("");
    const [note, setNote] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const picked = options?.find(o => o.key === choice);
    return (
        <Dialog title="إرسال الزيارة للمراجعة" onClose={onClose}>
            <p className="text-xs font-bold text-slate-500 leading-relaxed">
                تُحفظ الزيارة مسودة وتظهر عند المراجِع ليعدّلها ويعتمدها أو يعيدها إليك بملاحظة. تبقى الزيارة باسمك.
            </p>
            {!options ? <div className="h-20 rounded-xl bg-slate-50 animate-pulse"/> : (
                <div className="space-y-2" role="radiogroup" aria-label="المراجِع">
                    {options.map(o => (
                        <label key={o.key} className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer text-sm font-bold ${choice === o.key ? "border-qatar-maroon bg-qatar-maroon/5" : "border-slate-100"}`}>
                            <input type="radio" name="reviewer" checked={choice === o.key} onChange={() => setChoice(o.key)} className="accent-qatar-maroon"/>
                            <span className="text-slate-800">{o.name}</span>
                            <span className="text-xs text-slate-400 mr-auto">{o.label}</span>
                        </label>
                    ))}
                    {options.length === 0 && <p className="text-xs font-bold text-slate-400">لا يوجد من يمكن الإرسال إليه.</p>}
                </div>
            )}
            <label className="block">
                <span className="block text-xs font-semibold text-slate-600 mb-1.5">ملاحظة للمراجِع (اختياري)</span>
                <textarea rows={2} value={note} onChange={e => setNote(e.target.value)} maxLength={1000}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-qatar-maroon"/>
            </label>
            {error && <p role="alert" className="text-xs font-bold text-rose-700">{error}</p>}
            <button disabled={!picked || busy} onClick={async () => {
                setBusy(true); setError("");
                try { await onSend({ toRole: picked.toRole, toVisitorId: picked.toVisitorId, name: picked.name }, note); }
                catch (e) { setError(errorText(e, "تعذّر الإرسال")); setBusy(false); }
            }} className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-qatar-maroon text-white text-sm font-black disabled:opacity-50">
                {busy ? <Loader2 className="w-4 h-4 animate-spin"/> : <Send className="w-4 h-4"/>}إرسال للمراجعة
            </button>
        </Dialog>
    );
}

// Shown on the form when the visit is under review, or came back from it
export function ReviewBanner({ visit, session, onReturned }: { visit: VisitRow; session: Session; onReturned: () => void }) {
    const returnVisit = useSupervisionMutation((api as any).visitWorkflow.returnVisit);
    const [open, setOpen] = useState(false);
    const [note, setNote] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const r = visit.reviewRequest;
    if (r && isReviewer(visit, session)) {
        return (
            <div className="rounded-2xl border border-sky-200 bg-sky-50 p-3 space-y-2 text-xs font-bold text-sky-900">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                    <span>أرسلها {r.byName} لمراجعتك. عدّل ما تراه ثم «مراجعة واعتماد»، أو أعِدها بملاحظة.</span>
                    <button onClick={() => setOpen(o => !o)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-sky-300 bg-white text-sky-800">
                        <Undo2 className="w-3.5 h-3.5"/>إعادة للزائر
                    </button>
                </div>
                {r.note && <p className="font-semibold whitespace-pre-line">ملاحظته: {r.note}</p>}
                {open && <div className="space-y-2">
                    <textarea rows={2} value={note} onChange={e => setNote(e.target.value)} placeholder="ما الذي يحتاج تعديلًا؟"
                        className="w-full border border-sky-200 rounded-lg px-3 py-2 text-sm bg-white text-slate-800 focus:outline-none"/>
                    <button disabled={!note.trim() || busy} onClick={async () => {
                        setBusy(true); setError("");
                        try { await returnVisit({ visitId: visit._id, note }); onReturned(); }
                        catch (e) { setError(errorText(e, "تعذّرت الإعادة")); } finally { setBusy(false); }
                    }} className="px-4 py-2 rounded-lg bg-sky-700 text-white disabled:opacity-50">إعادة مع الملاحظة</button>
                    {error && <p role="alert" className="text-rose-700">{error}</p>}
                </div>}
            </div>
        );
    }
    if (r) return <div className="rounded-2xl border border-sky-200 bg-sky-50 p-3 text-xs font-bold text-sky-900">مرسلة إلى {r.toName} للمراجعة — يمكنك متابعة التعديل؛ آخر حفظ هو ما يراه المراجِع.</div>;
    if (visit.reviewReturn) return (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs font-bold text-amber-900 space-y-1">
            <p>أعادها {visit.reviewReturn.byName} بملاحظة:</p>
            <p className="font-semibold whitespace-pre-line">{visit.reviewReturn.note}</p>
        </div>
    );
    return null;
}

// Drafts sent to the signed-in visitor for review
export function ReviewInbox({ visits, onOpen }: { visits: VisitRow[]; onOpen: (id: string) => void }) {
    const session = useSupervisionSession() as Session | null;
    if (!session) return null;
    const mine = visits.filter(v => isReviewer(v, session));
    if (!mine.length) return null;
    return (
        <div className="bg-white rounded-2xl border border-sky-200 shadow-sm p-4 space-y-2">
            <h3 className="font-bold text-slate-700 text-sm">بانتظار مراجعتك ({mine.length})</h3>
            {mine.map(v => (
                <button key={v._id} onClick={() => onOpen(v._id)}
                    className="w-full flex items-center gap-3 p-3 rounded-xl bg-sky-50 hover:bg-sky-100 text-right text-sm">
                    <span className="font-black text-slate-800">{v.teacherName}</span>
                    <span className="text-xs font-bold text-slate-500">{v.visitorName} · {v.visitDate}</span>
                    <span className="text-xs font-black text-sky-800 mr-auto">مراجعة</span>
                </button>
            ))}
        </div>
    );
}

// ── Send to the teacher ──────────────────────────────────────────────────
// From the visitor's own device: the form is made into a PDF with a private
// acknowledgement link, then handed to the share sheet (WhatsApp, Mail…), the
// mail program, or downloaded. Preparing and sending are two taps, because a
// browser only opens the share sheet straight after a tap.
type Prepared = { file: File; url: string; text: string; subject: string };

export function SendToTeacher({ visitId }: { visitId: string }) {
    const convex = useConvex();
    const session = useSupervisionSession();
    const status = useSupervisionQuery((api as any).visitWorkflow.emailStatus, { visitId }) as any;
    const createLink = useSupervisionMutation((api as any).supervisionAcknowledgements.create);
    const logSend = useSupervisionMutation((api as any).visitWorkflow.logSend);
    const [prepared, setPrepared] = useState<Prepared | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [done, setDone] = useState("");
    if (!status) return null;
    const last = status.sends[0];

    const prepare = async () => {
        setBusy(true); setError(""); setDone("");
        try {
            const data = await convex.query((api as any).visits.getVisitForm, { id: visitId, sessionToken: session?.token ?? "" });
            const { createVisitPdf } = await import("../../lib/visitPdf");
            const v = data.visit;
            const date = String(v.visitDate ?? "");
            const file = new File([await createVisitPdf(data)], `استمارة زيارة ${v.teacherName} ${date}.pdf`, { type: "application/pdf" });
            const token = Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, "0")).join("");
            await createLink({ visitId, token });
            const link = `${window.location.origin}/supervision/acknowledge#${token}`;
            const subject = `استمارة الإشراف على أداء المعلّم — ${date}`;
            const text = [
                `السلام عليكم أ. ${v.teacherName}`,
                `مرفق استمارة زيارة ${date} (${v.lessonTopic}).`,
                "للاطلاع على الملاحظات وكتابة تعليقك (صالح 7 أيام):",
                link,
            ].join("\n");
            setPrepared({ file, url: URL.createObjectURL(file), text, subject });
        } catch (e) { setError(errorText(e, "تعذّر تجهيز الاستمارة — حاول مرة أخرى")); }
        finally { setBusy(false); }
    };
    const sent = async (via: string) => {
        setDone(via);
        try { await logSend({ visitId, via }); } catch { /* the send itself already happened */ }
    };
    const canShareFile = !!prepared && typeof navigator.canShare === "function" && navigator.canShare({ files: [prepared.file] });
    const phone = String(status.teacherPhone ?? "").replace(/\D/g, "");

    return (
        <div className="space-y-2 text-center">
            {!prepared ? (
                <button onClick={prepare} disabled={busy}
                    className="inline-flex items-center gap-2 px-5 py-3 rounded-xl border-2 border-qatar-maroon text-qatar-maroon font-black text-sm disabled:opacity-50">
                    {busy ? <Loader2 className="w-4 h-4 animate-spin"/> : <Send className="w-4 h-4"/>}
                    {busy ? "جاري تجهيز الاستمارة…" : last ? "إرسال للمعلم مرة أخرى" : "إرسال الاستمارة للمعلم"}
                </button>
            ) : (
                <div className="flex gap-2 justify-center flex-wrap">
                    {canShareFile && (
                        <button onClick={async () => {
                            try { await navigator.share({ files: [prepared.file], title: prepared.subject, text: prepared.text }); await sent("مشاركة من الجهاز"); }
                            catch (e: any) { if (e?.name !== "AbortError") setError("تعذّرت المشاركة — استخدم التنزيل أو البريد"); }
                        }} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-qatar-maroon text-white font-black text-sm">
                            <Send className="w-4 h-4"/>مشاركة (واتساب / بريد…)
                        </button>
                    )}
                    <a href={prepared.url} download={prepared.file.name}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-slate-200 text-slate-700 font-black text-sm">
                        <FileDown className="w-4 h-4"/>تنزيل PDF
                    </a>
                    {status.teacherEmail && (
                        <button onClick={async () => {
                            try {
                                const { outlookDraft, downloadBlob } = await import("../../lib/outlookDraft");
                                const eml = await outlookDraft({ to: status.teacherEmail, subject: prepared.subject, text: prepared.text, file: prepared.file });
                                downloadBlob(eml, `رسالة إلى ${status.teacherName}.eml`);
                                await sent(`Outlook · ${status.teacherEmail}`);
                            } catch { setError("تعذّر تجهيز رسالة Outlook"); }
                        }} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0F6CBD] text-white font-black text-sm">
                            <Mail className="w-4 h-4"/>فتح في Outlook
                        </button>
                    )}
                    <a href={`https://wa.me/${phone}?text=${encodeURIComponent(prepared.text)}`} target="_blank" rel="noreferrer"
                        onClick={() => void sent("واتساب")}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-slate-200 text-slate-700 font-black text-sm">
                        <MessageCircle className="w-4 h-4"/>واتساب (الرابط)
                    </a>
                </div>
            )}
            {prepared && status.teacherEmail && <p className="text-[11px] font-bold text-slate-500">
                «فتح في Outlook» ينزّل رسالة جاهزة — افتحها من شريط التنزيلات فتظهر في Outlook ببريد المعلم والاستمارة مرفقة، ثم اضغط «إرسال».
            </p>}
            {done && <p className="text-xs font-bold text-emerald-700">سُجّل الإرسال ({done})</p>}
            {!done && last && <p className="text-[11px] font-bold text-slate-400">
                آخر إرسال: {last.to} · {new Date(last.createdAt).toLocaleString("ar-QA", { dateStyle: "short", timeStyle: "short" })}
            </p>}
            {error && <p role="alert" className="text-xs font-bold text-rose-700">{error}</p>}
        </div>
    );
}

function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
    return (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-3" role="dialog" aria-modal="true" aria-label={title}>
            <div dir="rtl" className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-auto shadow-xl">
                <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
                    <p className="font-black text-slate-800">{title}</p>
                    <button onClick={onClose} aria-label="إغلاق"><X className="w-5 h-5 text-slate-400"/></button>
                </div>
                <div className="p-5 space-y-4">{children}</div>
            </div>
        </div>
    );
}
