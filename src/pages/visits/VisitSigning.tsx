import { useRef, useState } from "react";
import { Check, Copy, FileSignature, ImageUp, Link2, Loader2, PenLine, Printer, Send, Share2, UserX } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { useSupervisionMutation } from "../../lib/supervisionSession";
import { dayOfStamp as dayOf, stageOf, teacherSignText, type VisitRow } from "../../lib/visitStats";
import { formatDate } from "../../../convex/visitMath";
import type { Session } from "./VisitsPage";
import { Dialog, SendToTeacher, errorText, uploadFile } from "./VisitWorkflow";
import { SignaturePad, type SignaturePadHandle } from "./SignaturePad";

// A coordinator's visit on its way to being approved: the coordinator signs,
// the teacher signs — on the coordinator's device, through a private link, or
// on the printed form — and only then does it go to the academic deputy.

const btn = "inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border-2 border-slate-200 text-xs font-black text-slate-700 hover:border-qatar-maroon hover:text-qatar-maroon disabled:opacity-50";

// ── توقيع المعلم ──────────────────────────────────────────────────────────
export function TeacherSignControl({ visit, canManage }: { visit: VisitRow; canManage: boolean }) {
    const record = useSupervisionMutation((api as any).visitWorkflow.recordTeacherSign);
    const clear = useSupervisionMutation((api as any).visitWorkflow.clearTeacherSign);
    const getUploadUrl = useSupervisionMutation((api as any).visitWorkflow.uploadUrl);
    const createLink = useSupervisionMutation((api as any).supervisionAcknowledgements.create);
    const pad = useRef<SignaturePadHandle>(null);
    const [mode, setMode] = useState<null | "device" | "link" | "none">(null);
    const [drawn, setDrawn] = useState(false);
    const [reason, setReason] = useState("");
    const [link, setLink] = useState("");
    const [copied, setCopied] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const sign = visit.teacherSign;

    const run = async (work: () => Promise<void>, fallback: string) => {
        setBusy(true); setError("");
        try { await work(); } catch (e) { setError(errorText(e, fallback)); } finally { setBusy(false); }
    };
    const close = () => { setMode(null); setError(""); setDrawn(false); setReason(""); };
    const openLink = () => run(async () => {
        const token = Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, "0")).join("");
        await createLink({ visitId: visit._id, token, sign: true });
        setLink(`${window.location.origin}/supervision/acknowledge#${token}`); setCopied(false); setMode("link");
    }, "تعذّر إنشاء رابط التوقيع");
    const message = `السلام عليكم أ. ${visit.teacherName}\nاستمارة زيارة ${formatDate(visit.visitDate)} جاهزة لاطلاعكم وتوقيعكم عبر الرابط:\n${link}\nولكم جزيل الشكر`;

    return (
        <div className="space-y-2">
            {sign ? (
                <p className={`text-xs font-bold ${sign.method === "none" ? "text-amber-800" : "text-emerald-700"}`}>
                    {teacherSignText(sign)}
                    {canManage && <button disabled={busy} onClick={() => { if (window.confirm("إزالة ما سُجّل عن توقيع المعلم؟")) void run(() => clear({ visitId: visit._id }), "تعذّرت الإزالة"); }}
                        className="mr-2 underline text-slate-400 hover:text-rose-700">إزالة</button>}
                </p>
            ) : <p className="text-xs font-bold text-slate-500">لم يوقّع المعلم بعد.</p>}
            {sign?.comment && <p className="text-xs font-semibold text-slate-600 whitespace-pre-line">تعليق المعلم: {sign.comment}</p>}

            {canManage && (!sign || sign.method === "none") && (
                <div className="flex gap-2 flex-wrap">
                    <button className={btn} disabled={busy} onClick={() => setMode("device")}><PenLine className="w-4 h-4"/>توقيع المعلم على هذا الجهاز (رسم أو صورة)</button>
                    <button className={btn} disabled={busy} onClick={() => void openLink()}><Link2 className="w-4 h-4"/>رابط توقيع للمعلم</button>
                    <button className={btn} disabled={busy} onClick={() => { if (window.confirm(`تسجيل أن ${visit.teacherName} وقّع على النسخة المطبوعة؟`)) void run(() => record({ visitId: visit._id, method: "paper" }), "تعذّر التسجيل"); }}>
                        <FileSignature className="w-4 h-4"/>وقّع على الورق
                    </button>
                    {!sign && <button className={btn} disabled={busy} onClick={() => setMode("none")}><UserX className="w-4 h-4"/>تعذّر توقيع المعلم</button>}
                </div>
            )}
            {error && !mode && <p role="alert" className="text-xs font-bold text-rose-700">{error}</p>}

            {mode === "device" && (
                <Dialog title="توقيع المعلم" onClose={close}>
                    <p className="text-xs font-bold text-slate-500 leading-relaxed">
                        يوقّع أ. {visit.teacherName} هنا بعد اطلاعه على الاستمارة وتوصياتها — أو تُرفع صورة توقيعه — فيظهر في خانة «توقيع المعلم».
                    </p>
                    <SignaturePad ref={pad} onChange={setDrawn}/>
                    <label className={`${btn} cursor-pointer w-full justify-center`}>
                        <ImageUp className="w-4 h-4"/>أو رفع صورة توقيع المعلم
                        <input type="file" accept="image/png,image/jpeg" className="hidden" disabled={busy} onChange={e => {
                            const file = e.target.files?.[0]; e.target.value = "";
                            if (!file) return;
                            if (!/^image\/(png|jpeg)$/.test(file.type)) { setError("اختر صورة PNG أو JPG"); return; }
                            if (file.size > 2 * 1024 * 1024) { setError("الصورة أكبر من 2 ميجا"); return; }
                            void run(async () => {
                                await record({ visitId: visit._id, method: "device", storageId: await uploadFile(() => getUploadUrl({}), file) });
                                close();
                            }, "تعذّر رفع صورة التوقيع — حاول مرة أخرى");
                        }}/>
                    </label>
                    {error && <p role="alert" className="text-xs font-bold text-rose-700">{error}</p>}
                    <button disabled={!drawn || busy} onClick={() => void run(async () => {
                        const blob = await pad.current?.toBlob();
                        if (!blob) throw new Error("empty");
                        await record({ visitId: visit._id, method: "device", storageId: await uploadFile(() => getUploadUrl({}), blob) });
                        close();
                    }, "تعذّر حفظ التوقيع — حاول مرة أخرى")}
                        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-qatar-maroon text-white text-sm font-black disabled:opacity-50">
                        {busy ? <Loader2 className="w-4 h-4 animate-spin"/> : <Check className="w-4 h-4"/>}حفظ توقيع المعلم
                    </button>
                </Dialog>
            )}

            {mode === "link" && (
                <Dialog title="رابط توقيع المعلم" onClose={close}>
                    <p className="text-xs font-bold text-slate-500 leading-relaxed">
                        رابط خاص بـ أ. {visit.teacherName} صالح 7 أيام: يفتحه من جواله فيرى الاستمارة كاملة ويوقّعها، ويظهر توقيعه عندك مباشرة. أي تعديل على الزيارة يلغي الرابط.
                    </p>
                    <input readOnly dir="ltr" value={link} aria-label="رابط توقيع المعلم" onFocus={e => e.target.select()}
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs bg-slate-50"/>
                    <div className="flex gap-2 flex-wrap justify-center">
                        <button className={btn} onClick={async () => { try { await navigator.clipboard.writeText(link); setCopied(true); } catch { setError("حدّد الرابط وانسخه يدويًا"); } }}>
                            <Copy className="w-4 h-4"/>{copied ? "تم النسخ" : "نسخ الرابط"}
                        </button>
                        {typeof navigator.share === "function" && (
                            <button className={btn} onClick={() => { void navigator.share({ text: message }).catch(() => {}); }}><Share2 className="w-4 h-4"/>مشاركة</button>
                        )}
                        <a className={btn} target="_blank" rel="noreferrer" href={`https://wa.me/?text=${encodeURIComponent(message)}`}><Send className="w-4 h-4"/>واتساب</a>
                    </div>
                    {error && <p role="alert" className="text-xs font-bold text-rose-700">{error}</p>}
                </Dialog>
            )}

            {mode === "none" && (
                <Dialog title="تعذّر توقيع المعلم" onClose={close}>
                    <p className="text-xs font-bold text-slate-500 leading-relaxed">
                        يُكتب السبب ويظهر للنائب الأكاديمي مع الزيارة، وتبقى خانة توقيع المعلم فارغة.
                    </p>
                    <input autoFocus value={reason} onChange={e => setReason(e.target.value)} maxLength={300} placeholder="مثال: المعلم في إجازة مرضية"
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-qatar-maroon"/>
                    {error && <p role="alert" className="text-xs font-bold text-rose-700">{error}</p>}
                    <button disabled={!reason.trim() || busy} onClick={() => void run(async () => { await record({ visitId: visit._id, method: "none", reason }); close(); }, "تعذّر التسجيل")}
                        className="w-full py-3 rounded-xl bg-qatar-maroon text-white text-sm font-black disabled:opacity-50">تسجيل السبب</button>
                </Dialog>
            )}
        </div>
    );
}

// ── خطوات اعتماد زيارة المنسق ────────────────────────────────────────────
export function VisitSteps({ visit, session }: { visit: VisitRow; session: Session }) {
    const send = useSupervisionMutation((api as any).visitWorkflow.sendToDeputy);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const stage = stageOf(visit);
    if (visit.visitorRole !== "coordinator" || stage === "draft") return null;
    const owner = session.role === "coordinator" && visit.visitorId === session.visitorId;
    const canManage = owner || session.role === "deputy" || session.role === "admin";
    const sent = stage === "deputy" || stage === "approved";

    const steps: { title: string; done: boolean; current: boolean; body: React.ReactNode }[] = [
        {
            title: "توقيع المنسق", done: true, current: false,
            body: <p className="text-xs font-bold text-emerald-700">{visit.coordinatorApproval ? `وقّعها ${visit.coordinatorApproval.name} · ${dayOf(visit.coordinatorApproval.at)}` : "موقّعة"}</p>,
        },
        {
            title: "توقيع المعلم", done: !!visit.teacherSign, current: stage === "teacher",
            body: <div className="space-y-2">
                <TeacherSignControl visit={visit} canManage={canManage}/>
                {!sent && canManage && (
                    <div className="flex gap-2 flex-wrap items-start">
                        <button className={btn} onClick={() => window.open(`/supervision/print/${visit._id}`, "_blank")}><Printer className="w-4 h-4"/>طباعة الاستمارة</button>
                        <SendToTeacher visitId={visit._id}/>
                    </div>
                )}
            </div>,
        },
        {
            title: "إرسال للنائب الأكاديمي", done: sent, current: stage === "ready",
            body: sent ? <p className="text-xs font-bold text-emerald-700">{visit.reviewRequest ? `أُرسلت · ${dayOf(visit.reviewRequest.at)}` : "أُرسلت"}</p>
                : !owner ? <p className="text-xs font-bold text-slate-500">يرسلها المنسق بعد توقيع المعلم.</p>
                : <div className="space-y-1.5">
                    <button disabled={stage !== "ready" || busy} onClick={async () => {
                        setBusy(true); setError("");
                        try { await send({ visitId: visit._id }); } catch (e) { setError(errorText(e, "تعذّر الإرسال")); } finally { setBusy(false); }
                    }} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-qatar-maroon text-white text-sm font-black disabled:opacity-40">
                        {busy ? <Loader2 className="w-4 h-4 animate-spin"/> : <Send className="w-4 h-4"/>}إرسال للنائب للاعتماد
                    </button>
                    {stage !== "ready" && <p className="text-[11px] font-bold text-slate-400">يُفتح بعد توقيع المعلم، أو تسجيل سبب تعذّره.</p>}
                    {error && <p role="alert" className="text-xs font-bold text-rose-700">{error}</p>}
                </div>,
        },
        {
            title: "اعتماد النائب الأكاديمي", done: stage === "approved", current: stage === "deputy",
            body: <p className={`text-xs font-bold ${stage === "approved" ? "text-emerald-700" : "text-slate-500"}`}>
                {stage === "approved" ? (visit.deputyApproval ? `اعتمدها ${visit.deputyApproval.name} · ${dayOf(visit.deputyApproval.at)}` : "معتمدة")
                    : stage === "deputy" ? "بانتظار اعتماد النائب وتوقيعه." : "بعد الإرسال."}
            </p>,
        },
    ];

    return (
        <section aria-label="خطوات اعتماد الزيارة" className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 text-right">
            <h3 className="font-bold text-slate-700 text-sm mb-3">خطوات اعتماد الزيارة</h3>
            <ol className="space-y-3">
                {steps.map((s, i) => (
                    <li key={s.title} className="flex gap-3">
                        <span className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-black ${
                            s.done ? "bg-emerald-600 text-white" : s.current ? "bg-qatar-maroon text-white" : "bg-slate-100 text-slate-400"}`}>
                            {s.done ? <Check className="w-4 h-4"/> : i + 1}
                        </span>
                        <div className="min-w-0 flex-1 space-y-1">
                            <p className={`text-sm font-black ${s.done || s.current ? "text-slate-800" : "text-slate-400"}`}>{s.title}</p>
                            {s.body}
                        </div>
                    </li>
                ))}
            </ol>
        </section>
    );
}
