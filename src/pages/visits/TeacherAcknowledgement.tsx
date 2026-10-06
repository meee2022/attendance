import { useLayoutEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useSupervisionMutation, useSupervisionQuery } from "../../lib/supervisionSession";
import { formatDate } from "../../../convex/visitMath";
import type { VisitRow } from "../../lib/visitStats";
import "./visits.css";
import { SendToTeacher } from "./VisitWorkflow";
import { TeacherSignControl } from "./VisitSigning";
import { OfficialVisitForm } from "./VisitFormPrint";
import { SignaturePad, type SignaturePadHandle } from "./SignaturePad";

// The teacher and the form: in the teacher file, the visitor takes the
// teacher's signature or sends a private link; at the link, the teacher reads
// the form and signs it.

export function AcknowledgementControl({ visit, canManage }: { visit: VisitRow; canManage: boolean }) {
    const [open, setOpen] = useState(false);
    const records = useSupervisionQuery((api as any).supervisionAcknowledgements.status, open ? { visitId: visit._id } : "skip") as any[] | undefined;
    const revoke = useSupervisionMutation((api as any).supervisionAcknowledgements.revoke);
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);
    return <div className="text-sm space-y-2">
        <button className="text-qatar-maroon underline underline-offset-4 py-2" onClick={() => setOpen(!open)}>توقيع المعلم واطلاعه</button>
        {open && <div className="rounded-xl bg-slate-50 p-3 space-y-3">
            <TeacherSignControl visit={visit} canManage={canManage}/>
            {records?.map(r => <div key={r._id} className="border-t border-slate-200 pt-2 text-xs text-slate-600">
                <p>{r.sign ? "رابط توقيع" : "رابط اطلاع"} · {r.acknowledgedAt ? `${r.sign ? "تم التوقيع" : "تم الاطلاع"} · ${new Date(r.acknowledgedAt).toLocaleDateString("ar-QA")}` : r.revoked ? "ملغى" : r.expiresAt < Date.now() ? "منتهٍ" : "بانتظار المعلم"}{r.visitUpdatedAt !== visit.updatedAt ? " · يخص نسخة سابقة من الزيارة" : ""}</p>
                {r.comment && <p className="whitespace-pre-wrap break-words leading-7">تعليق المعلم: {r.comment}</p>}
                {canManage && !r.revoked && !r.acknowledgedAt && r.expiresAt > Date.now() && <button className="text-red-700 underline py-1" disabled={busy} onClick={async () => { setBusy(true); try { await revoke({ id: r._id }); } catch { setError("تعذّر إلغاء الرابط؛ حاول مرة أخرى"); } finally { setBusy(false); } }}>إلغاء الرابط</button>}
            </div>)}
            {canManage && <SendToTeacher visitId={visit._id}/>}
            {error && <p role="alert" className="text-red-700">{error}</p>}
        </div>}
    </div>;
}

// The A4 form scaled to the width of the teacher's screen
export function FormPreview({ data }: { data: any }) {
    const outer = useRef<HTMLDivElement>(null);
    const inner = useRef<HTMLDivElement>(null);
    const [size, setSize] = useState({ k: 1, height: 1160 });
    useLayoutEffect(() => {
        const fit = () => {
            if (!outer.current || !inner.current) return;
            const k = Math.min(1, outer.current.clientWidth / 794);
            setSize({ k, height: inner.current.offsetHeight * k });
        };
        fit();
        const observer = new ResizeObserver(fit);
        observer.observe(outer.current!); observer.observe(inner.current!);
        return () => observer.disconnect();
    }, []);
    return <div ref={outer} className="sign-preview rounded-xl border border-slate-200 overflow-hidden" style={{ height: size.height }}>
        <style>{`.sign-preview .vfp { min-height: 0; padding-bottom: 0; } .sign-preview .form-page { margin: 0 auto; box-shadow: none; }`}</style>
        <div ref={inner} style={{ width: 794, transform: `scale(${size.k})`, transformOrigin: "top right" }}>
            <OfficialVisitForm data={data} toolbar={false}/>
        </div>
    </div>;
}

export default function TeacherAcknowledgement() {
    const token = window.location.hash.slice(1);
    const data = useQuery((api as any).supervisionAcknowledgements.read, { token }) as any;
    const acknowledge = useMutation((api as any).supervisionAcknowledgements.acknowledge);
    const signUploadUrl = useMutation((api as any).supervisionAcknowledgements.signUploadUrl);
    const sign = useMutation((api as any).supervisionAcknowledgements.sign);
    const pad = useRef<SignaturePadHandle>(null);
    const [drawn, setDrawn] = useState(false);
    // a picture of the signature instead of drawing it
    const [picture, setPicture] = useState<{ file: File; url: string } | null>(null);
    const [comment, setComment] = useState("");
    const [confirmed, setConfirmed] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    if (data === undefined) return <p dir="rtl" className="p-8 text-center">جاري تحميل استمارة الزيارة…</p>;
    if (!data) return <p dir="rtl" className="p-8 text-center">الرابط منتهي أو أُلغي أو تم تحديث الزيارة. اطلب رابطًا جديدًا من الزائر.</p>;
    const signing = Boolean(data.sign);
    const submit = async () => {
        if (busy || !confirmed || (signing && !drawn && !picture)) return;
        setBusy(true); setError("");
        try {
            if (!signing) { await acknowledge({ token, comment }); return; }
            const blob = picture?.file ?? await pad.current?.toBlob();
            if (!blob) throw new Error("empty");
            const res = await fetch(await signUploadUrl({ token }), { method: "POST", headers: { "Content-Type": blob.type || "image/png" }, body: blob });
            if (!res.ok) throw new Error("upload failed");
            await sign({ token, storageId: (await res.json()).storageId, comment });
        } catch (e: any) { setError(typeof e?.data === "string" ? e.data : "تعذّر التسجيل؛ حاول مرة أخرى"); }
        finally { setBusy(false); }
    };
    return <main dir="rtl" className="supervision-followup max-w-3xl mx-auto my-6 p-4 sm:p-8 bg-white rounded-2xl border border-slate-200 space-y-5">
        <h1 className="text-xl text-qatar-maroon font-bold">{signing ? "توقيع استمارة الزيارة الصفية" : "اطلاع المعلم على ملاحظات الزيارة"}</h1>
        <p className="text-slate-700">{data.teacherName} · {formatDate(data.visitDate)} · {data.lessonTopic}</p>
        {signing && data.form && <FormPreview data={data.form}/>}
        <div className="space-y-3 leading-8">
            {signing && data.recommendations.length > 0 && <h2 className="font-bold text-slate-800">التوصيات</h2>}
            {data.recommendations.map((r: string, i: number) => <p key={i} className="whitespace-pre-wrap break-words">{r}</p>)}
        </div>
        <p className="text-sm text-slate-600">{signing
            ? "توقيعك يفيد اطلاعك على الاستمارة وتوصياتها، ويظهر في خانة «توقيع المعلم». يمكنك كتابة تعليقك أسفله."
            : "تسجيل الاطلاع لا يعني الموافقة على التقييم، ولا يغيّر الاستمارة الرسمية أو يحل محل توقيعها."}</p>
        {data.acknowledgedAt ? <div role="status" className="bg-emerald-50 text-emerald-900 p-4 rounded-xl"><p className="font-bold">{signing ? "تم توقيع الاستمارة — شكرًا لك" : "تم تسجيل الاطلاع"}</p>{data.comment && <p className="whitespace-pre-wrap mt-2">تعليقك: {data.comment}</p>}</div> : <form className="space-y-4" onSubmit={e => { e.preventDefault(); void submit(); }}>
            {signing && <div className="space-y-2">
                <p className="font-bold text-slate-800">توقيعك</p>
                {picture ? <div className="rounded-xl border border-slate-200 p-3 text-center space-y-2">
                    <img src={picture.url} alt="صورة توقيعك" className="h-24 max-w-full object-contain mx-auto"/>
                    <button type="button" className="text-sm underline text-slate-600" onClick={() => { URL.revokeObjectURL(picture.url); setPicture(null); }}>إزالة الصورة والتوقيع بالرسم</button>
                </div> : <SignaturePad ref={pad} onChange={setDrawn}/>}
                {!picture && <label className="inline-block! text-sm underline text-qatar-maroon cursor-pointer">أو ارفع صورة توقيعك
                    <input type="file" accept="image/png,image/jpeg" className="hidden!" onChange={e => {
                        const file = e.target.files?.[0]; e.target.value = "";
                        if (!file) return;
                        if (!/^image\/(png|jpeg)$/.test(file.type)) { setError("اختر صورة PNG أو JPG"); return; }
                        if (file.size > 2 * 1024 * 1024) { setError("الصورة أكبر من 2 ميجا"); return; }
                        setError(""); setPicture({ file, url: URL.createObjectURL(file) });
                    }}/>
                </label>}
            </div>}
            <label>تعليقك (اختياري)<textarea rows={4} maxLength={5000} value={comment} onChange={e => setComment(e.target.value)}/></label>
            <label className="flex! gap-3 items-center"><input className="w-5! min-h-5! m-0!" type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)}/>{signing ? "أنا المعلم المذكور، وقد اطلعت على الاستمارة." : "أنا المعلم المذكور، وقد اطلعت على الملاحظات."}</label>
            {error && <p role="alert" className="text-red-700">{error}</p>}
            <button disabled={busy || !confirmed || (signing && !drawn && !picture)} className="bg-qatar-maroon text-white rounded-xl px-5 py-3 font-bold disabled:opacity-50">{busy ? "جاري التسجيل…" : signing ? "توقيع الاستمارة" : "تسجيل الاطلاع وإرسال التعليق"}</button>
        </form>}
    </main>;
}
