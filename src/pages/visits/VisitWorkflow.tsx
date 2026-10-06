import { useRef, useState } from "react";
import { useConvex } from "convex/react";
import { Check, FileDown, ImageUp, Loader2, Mail, MessageCircle, PenLine, Send, Trash2, Undo2, X } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { useSupervisionMutation, useSupervisionQuery, useSupervisionSession } from "../../lib/supervisionSession";
import { STAGE_LABELS, stageOf, teacherSignText, type VisitRow } from "../../lib/visitStats";
import { SignaturePad, type SignaturePadHandle } from "./SignaturePad";
import { formatDate } from "../../../convex/visitMath";
import type { Session } from "./VisitsPage";

// The steps around a visit that are not the form itself: the visitor's
// signature (uploaded or drawn once), a visit waiting for its next step, and
// sending the form to the teacher.

export const errorText = (e: any, fallback: string) => typeof e?.data === "string" ? e.data : fallback;

export async function uploadFile(getUrl: () => Promise<string>, file: Blob) {
    const url = await getUrl();
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": file.type || "application/octet-stream" }, body: file });
    if (!res.ok) throw new Error("upload failed");
    return (await res.json()).storageId as string;
}

// ── توقيعي ────────────────────────────────────────────────────────────────
export function MySignatureButton({ session }: { session: Session }) {
    const [open, setOpen] = useState(false);
    if (session.role === "supervisor" || session.role === "admin") return null;
    return <>
        <button onClick={() => setOpen(true)} title="توقيعي" aria-label="توقيعي"
            className="p-1 rounded-md text-slate-400 hover:text-qatar-maroon hover:bg-qatar-cream-dark">
            <PenLine className="w-4 h-4"/>
        </button>
        {open && <MySignatureDialog onClose={() => setOpen(false)}/>}
    </>;
}

// The signature is added once — a picture of it, or drawn here — and then goes
// into the visitor's cell on every visit they sign
export function MySignatureDialog({ onClose, notice }: { onClose: () => void; notice?: string }) {
    const url = useSupervisionQuery((api as any).visitWorkflow.mySignature) as string | null | undefined;
    const getUploadUrl = useSupervisionMutation((api as any).visitWorkflow.uploadUrl);
    const setSignature = useSupervisionMutation((api as any).visitWorkflow.setMySignature);
    const pad = useRef<SignaturePadHandle>(null);
    const [drawing, setDrawing] = useState(false);
    const [drawn, setDrawn] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const save = async (file: Blob) => {
        setBusy(true); setError("");
        try { await setSignature({ storageId: await uploadFile(() => getUploadUrl({}), file) }); setDrawing(false); setDrawn(false); }
        catch (e) { setError(errorText(e, "تعذّر حفظ التوقيع")); }
        finally { setBusy(false); }
    };
    const upload = async (file: File) => {
        if (!/^image\/(png|jpeg)$/.test(file.type)) { setError("اختر صورة PNG أو JPG"); return; }
        if (file.size > 2 * 1024 * 1024) { setError("الصورة أكبر من 2 ميجا"); return; }
        await save(file);
    };
    return (
        <Dialog title="توقيعي" onClose={onClose}>
            {notice && <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-bold text-amber-900">{notice}</p>}
            <p className="text-xs font-bold text-slate-500 leading-relaxed">
                يُضاف مرة واحدة — صورة توقيعك أو رسمه هنا — ثم ينزل تلقائيًا في خانة توقيعك على كل زيارة توقّعها. للصورة يُفضَّل PNG بخلفية شفافة.
            </p>
            {url === undefined ? <div className="h-24 rounded-xl bg-slate-50 animate-pulse"/>
                : url ? <img src={url} alt="توقيعي" className="h-24 max-w-full object-contain rounded-xl border border-slate-100 bg-white p-2 mx-auto"/>
                : <p className="text-xs font-bold text-slate-400 text-center py-4">لم تُضف توقيعك بعد.</p>}
            {drawing && <div className="space-y-2">
                <SignaturePad ref={pad} onChange={setDrawn}/>
                <button disabled={!drawn || busy} onClick={async () => { const blob = await pad.current?.toBlob(); if (blob) await save(blob); }}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-qatar-maroon text-white text-sm font-black disabled:opacity-50">
                    {busy ? <Loader2 className="w-4 h-4 animate-spin"/> : <Check className="w-4 h-4"/>}حفظ التوقيع المرسوم
                </button>
            </div>}
            <div className="flex gap-2 justify-center flex-wrap">
                <label className="flex items-center gap-2 px-4 py-2 rounded-xl bg-qatar-maroon text-white text-xs font-black cursor-pointer">
                    {busy && !drawing ? <Loader2 className="w-4 h-4 animate-spin"/> : <ImageUp className="w-4 h-4"/>}
                    {url ? "تغيير الصورة" : "رفع صورة التوقيع"}
                    <input type="file" accept="image/png,image/jpeg" className="hidden" disabled={busy}
                        onChange={e => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = ""; }}/>
                </label>
                {!drawing && <button disabled={busy} onClick={() => { setError(""); setDrawing(true); }}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl border-2 border-qatar-maroon text-qatar-maroon text-xs font-black">
                    <PenLine className="w-4 h-4"/>رسم التوقيع
                </button>}
                {url && <button disabled={busy} onClick={async () => {
                    if (!window.confirm("إزالة توقيعك؟ لن يظهر على الزيارات التي توقّعها بعد ذلك.")) return;
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

// Shown on the form when the visit is under review, or came back from it
export function ReviewBanner({ visit, session, onReturned }: { visit: VisitRow; session: Session; onReturned: () => void }) {
    const returnVisit = useSupervisionMutation((api as any).visitWorkflow.returnVisit);
    const [open, setOpen] = useState(false);
    const [note, setNote] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const r = visit.reviewRequest;
    if (visit.visitorRole === "coordinator" && visit.status === "submitted" && !visit.deputyApproval && session.role === "deputy") {
        return <div className="rounded-2xl border border-sky-200 bg-sky-50 p-3 text-xs font-bold text-sky-900">زيارة سابقة معتمدة من المنسق ولم يسجل اعتماد النائب بعد. راجع الاستمارة ثم اضغط «اعتماد النائب وإضافة التوقيع».</div>;
    }
    if (r && isReviewer(visit, session)) {
        return (
            <div className="rounded-2xl border border-sky-200 bg-sky-50 p-3 space-y-2 text-xs font-bold text-sky-900">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                    <span>{visit.coordinatorApproval ? `وقّعها ${r.byName} وأرسلها لاعتمادك. راجعها ثم «مراجعة واعتماد»، أو أعِدها بملاحظة.` : `أرسلها ${r.byName} لمراجعتك. عدّل ما تراه ثم «مراجعة واعتماد»، أو أعِدها بملاحظة.`}</span>
                    <button onClick={() => setOpen(o => !o)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-sky-300 bg-white text-sky-800">
                        <Undo2 className="w-3.5 h-3.5"/>إعادة للزائر
                    </button>
                </div>
                {r.note && <p className="font-semibold whitespace-pre-line">ملاحظته: {r.note}</p>}
                {visit.coordinatorApproval && <p className={visit.teacherSign && visit.teacherSign.method !== "none" ? "text-emerald-800" : "text-amber-800"}>
                    {visit.teacherSign ? teacherSignText(visit.teacherSign) : "لم يُسجَّل توقيع المعلم."}
                </p>}
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
    if (r) return <div className="rounded-2xl border border-sky-200 bg-sky-50 p-3 text-xs font-bold text-sky-900">{visit.coordinatorApproval ? "وقّعها المنسق وهي بانتظار اعتماد النائب النهائي. حفظها كمسودة يلغي الإرسال ويستلزم توقيع المنسق مرة أخرى." : `مرسلة إلى ${r.toName} للمراجعة — يمكنك متابعة التعديل؛ آخر حفظ هو ما يراه المراجِع.`}</div>;
    if (visit.reviewReturn) return (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs font-bold text-amber-900 space-y-1">
            <p>أعادها {visit.reviewReturn.byName} بملاحظة:</p>
            <p className="font-semibold whitespace-pre-line">{visit.reviewReturn.note}</p>
        </div>
    );
    return null;
}

// What waits for the signed-in visitor: visits sent to them, and — for a
// coordinator — their own signed visits not yet with the deputy
export function ReviewInbox({ visits, onOpen }: { visits: VisitRow[]; onOpen: (id: string) => void }) {
    const session = useSupervisionSession() as Session | null;
    if (!session) return null;
    const mine = visits.filter(v => isReviewer(v, session) || (session.role === "deputy" && v.visitorRole === "coordinator" && v.status === "submitted" && !v.deputyApproval));
    const unfinished = visits.filter(v => session.role === "coordinator" && v.visitorId === session.visitorId && ["teacher", "ready"].includes(stageOf(v)));
    if (!mine.length && !unfinished.length) return null;
    return (
        <div className="bg-white rounded-2xl border border-sky-200 shadow-sm p-4 space-y-2">
            {mine.length > 0 && <h3 className="font-bold text-slate-700 text-sm">بانتظار مراجعتك ({mine.length})</h3>}
            {mine.map(v => (
                <button key={v._id} onClick={() => onOpen(v._id)}
                    className="w-full flex items-center gap-3 p-3 rounded-xl bg-sky-50 hover:bg-sky-100 text-right text-sm flex-wrap">
                    <span className="font-black text-slate-800">{v.teacherName}</span>
                    <span className="text-xs font-bold text-slate-500">{v.visitorName} · {v.visitDate}</span>
                    {v.coordinatorApproval && v.teacherSign?.method === "none" && <span className="text-[11px] font-bold text-amber-700">{teacherSignText(v.teacherSign)}</span>}
                    <span className="text-xs font-black text-sky-800 mr-auto">{v.coordinatorApproval ? "اعتماد النائب" : "مراجعة"}</span>
                </button>
            ))}
            {unfinished.length > 0 && <h3 className="font-bold text-slate-700 text-sm">زياراتك التي لم تُرسل للنائب بعد ({unfinished.length})</h3>}
            {unfinished.map(v => (
                <button key={v._id} onClick={() => onOpen(v._id)}
                    className="w-full flex items-center gap-3 p-3 rounded-xl bg-amber-50 hover:bg-amber-100 text-right text-sm">
                    <span className="font-black text-slate-800">{v.teacherName}</span>
                    <span className="text-xs font-bold text-slate-500">{v.visitDate}</span>
                    <span className="text-xs font-black text-amber-800 mr-auto">{STAGE_LABELS[stageOf(v)]}</span>
                </button>
            ))}
        </div>
    );
}

// ── Send to the teacher ──────────────────────────────────────────────────
// From the visitor's own device: the form is made into a PDF, then handed to
// the share sheet (WhatsApp, Mail…), Outlook, or downloaded; the teacher signs
// it and sends it back. Preparing and sending are two taps, because a
// browser only opens the share sheet straight after a tap.
type Prepared = { file: File; url: string; text: string; subject: string };

export function SendToTeacher({ visitId }: { visitId: string }) {
    const convex = useConvex();
    const session = useSupervisionSession();
    const status = useSupervisionQuery((api as any).visitWorkflow.emailStatus, { visitId }) as any;
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
            const shown = formatDate(date);                     // 28/09/2026, as on the form
            const file = new File([await createVisitPdf(data)], `استمارة زيارة ${v.teacherName} ${date}.pdf`, { type: "application/pdf" });
            const subject = `استمارة الإشراف على أداء المعلّم — ${shown}`;
            const text = [
                `السلام عليكم أ. ${v.teacherName}`,
                `مرفق استمارة زيارة ${shown} (${v.lessonTopic}).`,
                "يرجى الاطلاع على التوصيات وتوقيع الاستمارة وإعادة إرسالها.",
                "ولكم جزيل الشكر",
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
                        <MessageCircle className="w-4 h-4"/>واتساب (الرسالة فقط)
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

export function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
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
