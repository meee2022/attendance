import { useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import "../visits/visits.css";
import { FormPreview } from "../visits/TeacherAcknowledgement";
import { FORM_PAGE_CSS } from "../visits/VisitFormPrint";
import { SignaturePad, type SignaturePadHandle } from "../visits/SignaturePad";
import EvaluationPages from "./EvaluationFormPrint";

// The teacher's private link: their own approved appraisal form, and nothing
// else. They read it, sign in «توقيع الموظف», and the date becomes «تاريخ الاستلام».

export default function EvaluationSign() {
    const token = window.location.hash.slice(1);
    const form = useQuery((api as any).evaluationLinks.readLink, { token }) as any;
    const signUploadUrl = useMutation((api as any).evaluationLinks.signUploadUrl);
    const sign = useMutation((api as any).evaluationLinks.sign);
    const pad = useRef<SignaturePadHandle>(null);
    const [drawn, setDrawn] = useState(false);
    const [comment, setComment] = useState("");
    const [confirmed, setConfirmed] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");

    if (form === undefined) return <p dir="rtl" className="p-8 text-center">جاري تحميل استمارة التقييم…</p>;
    if (!form) return <p dir="rtl" className="p-8 text-center">الرابط منتهي أو أُلغي أو عُدّلت الاستمارة. اطلب رابطًا جديدًا من منسق القسم.</p>;

    const submit = async () => {
        if (busy || !confirmed || !drawn) return;
        setBusy(true); setError("");
        try {
            const blob = await pad.current?.toBlob();
            if (!blob) throw new Error("empty");
            const res = await fetch(await signUploadUrl({ token }), { method: "POST", headers: { "Content-Type": blob.type || "image/png" }, body: blob });
            if (!res.ok) throw new Error("upload failed");
            await sign({ token, storageId: (await res.json()).storageId, comment });
        } catch (e: any) { setError(typeof e?.data === "string" ? e.data : "تعذّر تسجيل التوقيع؛ حاول مرة أخرى"); }
        finally { setBusy(false); }
    };

    return <main dir="rtl" className="supervision-followup max-w-3xl mx-auto my-6 p-4 sm:p-8 bg-white rounded-2xl border border-slate-200 space-y-5">
        <h1 className="text-xl text-qatar-maroon font-bold">استمارة تقييم أداء المعلم · {form.academicYear}</h1>
        <p className="text-slate-700">{form.teacherName} · الدرجة {form.total} من 100 · {form.level}</p>
        <FormPreview><div dir="rtl" className="vfp"><style>{FORM_PAGE_CSS}</style><EvaluationPages form={form}/></div></FormPreview>
        <p className="text-sm text-slate-600 leading-7">
            توقيعك يفيد استلامك نسخة من تقرير تقييم الأداء، ويُسجَّل تاريخ اليوم تاريخًا للاستلام.
            يجوز لك التظلم خلال خمسة عشر يوماً، ولا يعتبر التقرير نهائياً إلا بعد انقضاء ميعاد التظلم منه أو البت فيه.
        </p>
        {form.signedAt ? <p role="status" className="bg-emerald-50 text-emerald-900 p-4 rounded-xl font-bold">تم توقيع الاستمارة، شكرًا لك</p> : (
            <form className="space-y-4" onSubmit={e => { e.preventDefault(); void submit(); }}>
                <div className="space-y-2"><p className="font-bold text-slate-800">توقيعك</p><SignaturePad ref={pad} onChange={setDrawn}/></div>
                <label>ملاحظتك (اختياري)<textarea rows={3} maxLength={2000} value={comment} onChange={e => setComment(e.target.value)}/></label>
                <label className="flex! gap-3 items-center"><input className="w-5! min-h-5! m-0!" type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)}/>أنا المعلم المذكور، وقد استلمت نسخة من الاستمارة.</label>
                {error && <p role="alert" className="text-red-700">{error}</p>}
                <button disabled={busy || !confirmed || !drawn} className="bg-qatar-maroon text-white rounded-xl px-5 py-3 font-bold disabled:opacity-50">{busy ? "جاري التسجيل…" : "توقيع الاستمارة"}</button>
            </form>
        )}
    </main>;
}
