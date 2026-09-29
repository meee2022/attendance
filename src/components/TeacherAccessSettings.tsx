import { useState } from "react";
import { useQuery, useMutation } from "../lib/platformSession";
import { api } from "../../convex/_generated/api";

export default function TeacherAccessSettings() {
    const status = useQuery((api as any).settings.teacherAccessStatus) as { enabled: boolean } | undefined;
    const save = useMutation((api as any).settings.setTeacherAccess);
    const [pin, setPin] = useState(""), [confirmation, setConfirmation] = useState("");
    const [busy, setBusy] = useState(false), [message, setMessage] = useState("");
    async function update(enabled: boolean) {
        setBusy(true); setMessage("");
        try { await save({ enabled, newPin: enabled ? pin : undefined }); setPin(""); setConfirmation(""); setMessage(enabled ? "تم حفظ الرمز. شاركه مع المعلمين فقط؛ يلزم تسجيل الدخول مجددًا." : "تم إيقاف دخول المعلمين وإنهاء جلساتهم."); }
        catch (e: any) { setMessage(typeof e?.data === "string" ? e.data : "تعذّر الحفظ. تحقق من الرمز والاتصال ثم حاول مرة أخرى."); }
        finally { setBusy(false); }
    }
    return <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 mb-5">
        <div><h3 className="font-bold text-qatar-maroon">دخول المعلمين · رمز مشترك</h3><p className="text-sm text-slate-600 mt-2">الحالة: {status ? status.enabled ? "مفعّل" : "غير مفعّل" : "جاري التحميل…"}. أدوات الرصد والتقييم متاحة للمعلمين، وإدارة المدرسة متاحة للنائب والمسؤول، وإدارة رموز دخول المنصة للمسؤول فقط. بيانات الهوية والتواصل محجوبة عن المعلمين.</p></div>
        <div className="grid sm:grid-cols-2 gap-3"><label className="text-sm space-y-2"><span>الرمز الجديد (6–12 رقمًا)</span><input className="block w-full border border-slate-300 rounded-lg p-2" type="password" inputMode="numeric" autoComplete="new-password" value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, "").slice(0,12))}/></label><label className="text-sm space-y-2"><span>تأكيد الرمز</span><input className="block w-full border border-slate-300 rounded-lg p-2" type="password" inputMode="numeric" autoComplete="new-password" value={confirmation} onChange={e => setConfirmation(e.target.value.replace(/\D/g, "").slice(0,12))}/></label></div>
        <div className="flex flex-wrap gap-3"><button disabled={busy || pin.length < 6 || pin !== confirmation} onClick={() => void update(true)} className="bg-qatar-maroon text-white rounded-lg px-4 py-2 disabled:opacity-40">حفظ رمز المعلمين</button>{status?.enabled && <button disabled={busy} onClick={() => { if (window.confirm("إيقاف دخول المعلمين وإنهاء جلساتهم الحالية؟")) void update(false); }} className="border border-slate-300 rounded-lg px-4 py-2">إيقاف دخول المعلمين</button>}</div>
        {message && <p role="status" className="text-sm">{message}</p>}
        <p className="text-xs text-slate-600">الرمز المشترك لا يحدد هوية المعلم ولا يخصص فصولًا مختلفة لكل شخص. تغيير الرمز ينهي جميع جلسات المعلمين السابقة.</p>
    </section>;
}
