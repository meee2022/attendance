import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useSupervisionMutation, useSupervisionQuery } from "../../lib/supervisionSession";
import { formatDate } from "../../../convex/visitMath";
import "./visits.css";

export function AcknowledgementControl({ visitId, updatedAt, canManage }: { visitId: string; updatedAt: number; canManage: boolean }) {
    const [open, setOpen] = useState(false);
    const records = useSupervisionQuery((api as any).supervisionAcknowledgements.status, open ? { visitId } : "skip") as any[] | undefined;
    const create = useSupervisionMutation((api as any).supervisionAcknowledgements.create);
    const revoke = useSupervisionMutation((api as any).supervisionAcknowledgements.revoke);
    const [link, setLink] = useState("");
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);
    const [copied, setCopied] = useState(false);
    const generate = async () => {
        setBusy(true); setError("");
        try {
            const token = Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2,"0")).join("");
            await create({ visitId, token });
            setLink(`${window.location.origin}/supervision/acknowledge#${token}`); setCopied(false);
        } catch (e: any) { setError(typeof e?.data === "string" ? e.data : "تعذّر إنشاء الرابط"); }
        finally { setBusy(false); }
    };
    return <div className="text-sm space-y-2">
        <button className="text-qatar-maroon underline underline-offset-4 py-2" onClick={() => setOpen(!open)}>اطلاع المعلم وتعليقه</button>
        {open && <div className="rounded-xl bg-slate-50 p-3 space-y-3">
            <p className="text-slate-600">رابط خاص بالمعلم صالح لمدة 7 أيام. يسجل الاطلاع والتعليق، ولا يمثل توقيعًا أو موافقة على التقييم. لا يُرسل تلقائيًا.</p>
            {!records ? <p>جاري التحميل…</p> : records.length === 0 ? <p className="text-slate-600">لم يُنشأ رابط اطلاع لهذه الزيارة.</p> : records.map(r => <div key={r._id} className="border-b border-slate-200 pb-2">
                <p>{r.acknowledgedAt ? `تم الاطلاع عبر الرابط · ${new Date(r.acknowledgedAt).toLocaleDateString("ar-QA")}` : r.revoked ? "رابط ملغى" : r.expiresAt < Date.now() ? "رابط منتهٍ" : "بانتظار الاطلاع"}{r.visitUpdatedAt !== updatedAt ? " · يخص نسخة سابقة من الزيارة" : ""}</p>
                {r.comment && <p className="whitespace-pre-wrap break-words leading-7">تعليق المعلم: {r.comment}</p>}
                {canManage && !r.revoked && !r.acknowledgedAt && <button className="text-red-700 underline py-2" disabled={busy} onClick={async () => { setBusy(true); try { await revoke({ id: r._id }); setLink(""); } catch { setError("تعذّر إلغاء الرابط؛ حاول مرة أخرى"); } finally { setBusy(false); } }}>إلغاء الرابط</button>}
            </div>)}
            {canManage && <button disabled={busy} onClick={generate} className="bg-qatar-maroon text-white px-4 py-2 rounded-lg min-h-11">{busy ? "جاري التنفيذ…" : "إنشاء رابط اطلاع جديد"}</button>}
            {link && <div className="space-y-2"><label className="block">الرابط الخاص<input aria-label="رابط اطلاع المعلم" className="block w-full rounded-lg border border-slate-300 p-2 text-sm" dir="ltr" readOnly value={link} onFocus={e => e.target.select()}/></label><button className="underline text-qatar-maroon py-2" onClick={async () => { try { await navigator.clipboard.writeText(link); setCopied(true); } catch { setError("يمكنك تحديد الرابط ونسخه يدويًا"); } }}>{copied ? "تم نسخ الرابط" : "نسخ الرابط"}</button></div>}
            {error && <p role="alert" className="text-red-700">{error}</p>}
        </div>}
    </div>;
}

export default function TeacherAcknowledgement() {
    const token = window.location.hash.slice(1);
    const data = useQuery((api as any).supervisionAcknowledgements.read, { token }) as any;
    const acknowledge = useMutation((api as any).supervisionAcknowledgements.acknowledge);
    const [comment, setComment] = useState("");
    const [confirmed, setConfirmed] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    if (data === undefined) return <p dir="rtl" className="p-8 text-center">جاري تحميل ملاحظات الزيارة…</p>;
    if (!data) return <p dir="rtl" className="p-8 text-center">الرابط منتهي أو أُلغي أو تم تحديث الزيارة. اطلب رابطًا جديدًا من الزائر.</p>;
    return <main dir="rtl" className="supervision-followup max-w-2xl mx-auto my-6 p-5 sm:p-8 bg-white rounded-2xl border border-slate-200 space-y-5">
        <h1 className="text-xl text-qatar-maroon font-bold">اطلاع المعلم على ملاحظات الزيارة</h1>
        <p className="text-slate-700">{data.teacherName} · {formatDate(data.visitDate)} · {data.lessonTopic}</p>
        <div className="space-y-3 leading-8">{data.recommendations.map((r: string, i: number) => <p key={i} className="whitespace-pre-wrap break-words">{r}</p>)}</div>
        <p className="text-sm text-slate-600">تسجيل الاطلاع لا يعني الموافقة على التقييم، ولا يغيّر الاستمارة الرسمية أو يحل محل توقيعها.</p>
        {data.acknowledgedAt ? <div role="status" className="bg-emerald-50 text-emerald-900 p-4 rounded-xl"><p className="font-bold">تم تسجيل الاطلاع</p>{data.comment && <p className="whitespace-pre-wrap mt-2">تعليقك: {data.comment}</p>}</div> : <form className="space-y-4" onSubmit={async e => {
            e.preventDefault(); if (busy || !confirmed) return; setBusy(true); setError("");
            try { await acknowledge({ token, comment }); } catch (e: any) { setError(typeof e?.data === "string" ? e.data : "تعذّر التسجيل؛ حاول مرة أخرى"); } finally { setBusy(false); }
        }}>
            <label>تعليقك (اختياري)<textarea rows={4} maxLength={5000} value={comment} onChange={e => setComment(e.target.value)}/></label>
            <label className="flex! gap-3 items-center"><input className="w-5! min-h-5! m-0!" type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)}/>أنا المعلم المذكور، وقد اطلعت على الملاحظات.</label>
            {error && <p role="alert" className="text-red-700">{error}</p>}
            <button disabled={busy || !confirmed} className="bg-qatar-maroon text-white rounded-xl px-5 py-3 font-bold">{busy ? "جاري التسجيل…" : "تسجيل الاطلاع وإرسال التعليق"}</button>
        </form>}
    </main>;
}
