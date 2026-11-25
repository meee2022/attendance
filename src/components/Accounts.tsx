import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { CheckCircle2, Copy, FileSpreadsheet, KeyRound, Link2, Loader2, ShieldCheck, X } from "lucide-react";
import { api } from "../../convex/_generated/api";
import { useSupervisionQuery, useSupervisionMutation } from "../lib/supervisionSession";
import { StatusChip } from "./ui";
import { getStoredRole } from "./SupervisionPinGate";

// Personal accounts. Each coordinator, the deputy and the platform admin
// signs in with a password of their own. Nobody registers: the deputy makes a
// one-time link for a person already on the list, and that person chooses
// the password.

const S = (api as any).supervisionSessions, ACC = (api as any).accounts;
const errorText = (e: any, fallback: string) => (typeof e?.data === "string" ? e.data : fallback);
const field = "w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-qatar-maroon";
const primary = "inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-qatar-maroon text-white text-sm font-black transition-all hover:-translate-y-px hover:shadow-md active:translate-y-0 disabled:opacity-50 disabled:hover:translate-y-0";
const ghost = "inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl border-2 border-slate-200 text-slate-700 text-xs font-black transition-colors hover:border-qatar-maroon disabled:opacity-50";
const RULE = "8 أحرف على الأقل، تجمع حروفًا وأرقامًا.";
const newToken = () => Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, "0")).join("");
// «/a» is the short form of the activation page, for a text message
const linkOf = (token: string) => `${window.location.origin}/a#${token}`;
const messageOf = (name: string, url: string) => `أ. ${name}\nفعّل حسابك في منصة مدرسة ابن تيمية واختر كلمة سرك (الرابط صالح 48 ساعة ولمرة واحدة):\n${url}`;

function NewPassword({ value, confirm, onChange, onConfirm }: { value: string; confirm: string; onChange: (v: string) => void; onConfirm: (v: string) => void }) {
    return <>
        <label className="block text-xs font-bold text-slate-600">كلمة السر الجديدة
            <input type="password" dir="ltr" autoComplete="new-password" required minLength={8} maxLength={72} value={value} onChange={e => onChange(e.target.value)} className={`${field} mt-1`}/>
        </label>
        <label className="block text-xs font-bold text-slate-600">أعد كتابتها
            <input type="password" dir="ltr" autoComplete="new-password" required value={confirm} onChange={e => onConfirm(e.target.value)} className={`${field} mt-1`}/>
        </label>
        <p className="text-[11px] text-slate-500">{RULE}</p>
        {confirm && value !== confirm && <p className="text-xs font-bold text-rose-700">الكلمتان غير متطابقتين.</p>}
    </>;
}

// Changing one's own password. `forced`: the deputy or the admin, still on the
// old code, chooses a password before going any further.
export function OwnPassword({ forced = false, onClose }: { forced?: boolean; onClose?: () => void }) {
    const change = useMutation(S.changePassword);
    const [current, setCurrent] = useState("");
    const [next, setNext] = useState("");
    const [confirm, setConfirm] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [done, setDone] = useState(false);
    const submit = async () => {
        const token = getStoredRole()?.token;
        if (busy || !token || next !== confirm) return;
        setBusy(true); setError("");
        try {
            const r: any = await change({ token, current, next });
            if (r.error) setError(r.error); else if (forced) onClose?.(); else setDone(true);
        } catch (e) { setError(errorText(e, "تعذّر تغيير كلمة السر؛ حاول مرة أخرى")); }
        finally { setBusy(false); }
    };
    return (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-3" role="dialog" aria-modal="true" aria-labelledby="own-password-title" dir="rtl">
            <form onSubmit={e => { e.preventDefault(); void submit(); }} className="bg-white rounded-2xl w-full max-w-md shadow-xl p-5 space-y-3">
                <div className="flex items-center justify-between gap-3">
                    <h2 id="own-password-title" className="font-black text-slate-800 flex items-center gap-2"><KeyRound className="w-5 h-5 text-qatar-maroon"/>{forced ? "اختر كلمة سرك" : "تغيير كلمة السر"}</h2>
                    {!forced && <button type="button" onClick={onClose} aria-label="إغلاق" className="p-1 rounded-lg text-slate-400 hover:bg-slate-100"><X className="w-5 h-5"/></button>}
                </div>
                {done ? <>
                    <p role="status" className="rounded-xl bg-emerald-50 text-emerald-800 p-3 text-sm font-bold flex items-center gap-2"><CheckCircle2 className="w-4 h-4"/>تم تغيير كلمة السر.</p>
                    <button type="button" className={`${primary} w-full`} onClick={onClose}>تم</button>
                </> : <>
                    {forced && <p className="text-xs text-slate-600 leading-6">الرمز القديم كان مشتركًا. من الآن لكل شخص كلمة سر يختارها بنفسه ولا يعرفها غيره؛ بعد حفظها يتوقف الرمز القديم عن العمل لحسابك.</p>}
                    <label className="block text-xs font-bold text-slate-600">{forced ? "الرمز الذي دخلت به الآن" : "كلمة السر الحالية"}
                        <input type="password" dir="ltr" autoComplete="current-password" required value={current} onChange={e => setCurrent(e.target.value)} className={`${field} mt-1`}/>
                    </label>
                    <NewPassword value={next} confirm={confirm} onChange={setNext} onConfirm={setConfirm}/>
                    {error && <p role="alert" className="text-xs font-bold text-rose-700">{error}</p>}
                    <button className={`${primary} w-full`} disabled={busy || !current || next.length < 8 || next !== confirm}>
                        {busy && <Loader2 className="w-4 h-4 animate-spin"/>}حفظ كلمة السر
                    </button>
                </>}
            </form>
        </div>
    );
}

// The one-time link's page: the person chooses their password, once
export function AccountActivate() {
    const token = window.location.hash.slice(1);
    const info = useQuery(S.activationInfo, { token }) as any;
    const activate = useMutation(S.activate);
    const [next, setNext] = useState("");
    const [confirm, setConfirm] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [done, setDone] = useState(false);
    const submit = async () => {
        if (busy || next !== confirm) return;
        setBusy(true); setError("");
        try { const r: any = await activate({ token, password: next }); if (r.error) setError(r.error); else setDone(true); }
        catch { setError("تعذّر الاتصال؛ حاول مرة أخرى"); }
        finally { setBusy(false); }
    };
    const role = ({ coordinator: "منسق", deputy: "النائب الأكاديمي", admin: "مسؤول المنصة" } as Record<string, string>)[info?.role] ?? "";
    return (
        <main dir="rtl" className="min-h-screen bg-qatar-gray-bg flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4 shadow-[0_1px_2px_rgba(0,0,0,.04),0_12px_32px_rgba(92,21,35,.10)]">
                <h1 className="text-xl font-black text-qatar-maroon flex items-center gap-2"><ShieldCheck className="w-6 h-6"/>تفعيل حسابك</h1>
                {done ? <>
                    <p role="status" className="rounded-xl bg-emerald-50 text-emerald-800 p-4 text-sm font-bold leading-7">تم تفعيل حسابك. ادخل المنصة باسمك وكلمة السر التي اخترتها.</p>
                    <a href="/" className={`${primary} w-full`}>الدخول إلى المنصة</a>
                </> : info === undefined ? <p className="text-sm text-slate-500">جاري التحقق من الرابط…</p>
                : !info ? <p className="text-sm font-bold text-slate-700 leading-7">الرابط منتهي أو استُخدم من قبل. اطلب رابطًا جديدًا من النائب الأكاديمي.</p>
                : <form className="space-y-3" onSubmit={e => { e.preventDefault(); void submit(); }}>
                    <p className="text-sm text-slate-700 leading-7">الحساب: <strong>{info.name}</strong> ({role}). اختر كلمة سر لا يعرفها غيرك؛ هذا الرابط يعمل مرة واحدة.</p>
                    <NewPassword value={next} confirm={confirm} onChange={setNext} onConfirm={setConfirm}/>
                    {error && <p role="alert" className="text-xs font-bold text-rose-700">{error}</p>}
                    <button className={`${primary} w-full`} disabled={busy || next.length < 8 || next !== confirm}>{busy && <Loader2 className="w-4 h-4 animate-spin"/>}تفعيل الحساب</button>
                </form>}
            </div>
        </main>
    );
}

type Row = { role: string; visitorId: string | null; name: string; detail: string; activatedAt: number | null; linkExpiresAt: number | null; phone: string; email: string };
const keyOf = (r: Row) => `${r.role}:${r.visitorId ?? ""}`;
const day = (at: number) => new Date(at).toLocaleDateString("ar-QA", { timeZone: "Asia/Qatar" });

// The deputy's panel: who has activated, links for one person or for everyone
// still without an account, and retiring the shared coordinator code
export function AccountsPanel() {
    const data = useSupervisionQuery(ACC.status) as { rows: Row[]; sharedCode: boolean; isAdmin: boolean } | undefined;
    const createActivation = useSupervisionMutation(ACC.createActivation), setFor = useSupervisionMutation(ACC.setFor), retire = useSupervisionMutation(ACC.retireSharedCode);
    // the links made in this sitting: a link is shown once, only its hash is stored
    const [links, setLinks] = useState<Record<string, string>>({});
    const [busy, setBusy] = useState("");
    const [error, setError] = useState("");
    const [copied, setCopied] = useState("");
    const [setting, setSetting] = useState<Row | null>(null);
    if (!data) return null;

    const manageable = (r: Row) => r.role !== "admin" || data.isAdmin;
    const pending = data.rows.filter(r => r.role === "coordinator" && !r.activatedAt);
    const make = async (rows: Row[], name: string) => {
        setBusy(name); setError("");
        try {
            const made: Record<string, string> = {};
            for (const r of rows) {
                const token = newToken();
                await createActivation({ role: r.role, visitorId: r.visitorId ?? undefined, token });
                made[keyOf(r)] = linkOf(token);
            }
            setLinks(l => ({ ...l, ...made }));
        } catch (e) { setError(errorText(e, "تعذّر إنشاء الرابط؛ حاول مرة أخرى")); }
        finally { setBusy(""); }
    };
    const copy = async (text: string, mark: string) => { try { await navigator.clipboard.writeText(text); setCopied(mark); } catch { setError("تعذّر النسخ؛ حدّد النص وانسخه يدويًا"); } };
    const ready = data.rows.filter(r => links[keyOf(r)]);
    const exportSheet = async () => {
        const { downloadWorkbook } = await import("../lib/excelExport");
        await downloadWorkbook("روابط تفعيل الحسابات", [{ name: "Sheet1", title: "",
            columns: [{ header: "Phone Number", width: 16 }, { header: "Message Body", width: 100 }, { header: "الاسم", width: 34 }, { header: "البريد", width: 30 }],
            rows: ready.map(r => [r.phone.replace(/\D/g, ""), messageOf(r.name, links[keyOf(r)]), r.name, r.email]) }]);
    };

    return (
        <section className="rounded-2xl bg-white shadow-[0_1px_2px_rgba(0,0,0,.04),0_8px_24px_rgba(92,21,35,.07)] overflow-hidden" aria-labelledby="accounts-title">
            <div className="p-4 flex items-center gap-2 flex-wrap border-b border-slate-100">
                <h3 id="accounts-title" className="font-black text-slate-800 flex items-center gap-2 ml-auto"><ShieldCheck className="w-5 h-5 text-qatar-maroon"/>الحسابات الشخصية</h3>
                <button className={primary} disabled={!!busy || !pending.length} onClick={() => make(pending, "all")}>
                    {busy === "all" ? <Loader2 className="w-4 h-4 animate-spin"/> : <Link2 className="w-4 h-4"/>}روابط لكل من لم يفعّل ({pending.length})
                </button>
            </div>
            <p className="px-4 pt-3 text-xs text-slate-600 leading-6">
                لكل شخص كلمة سر يختارها بنفسه من رابط يعمل مرة واحدة خلال 48 ساعة. الرابط يظهر هنا وقت إنشائه فقط؛ إنشاء رابط جديد يلغي السابق، ويُستخدم أيضًا لمن نسي كلمة سره.
            </p>
            {data.sharedCode && (
                <div className="mx-4 mt-3 rounded-xl bg-amber-50 border border-amber-200 p-3 flex items-center gap-3 flex-wrap text-xs font-bold text-amber-900">
                    <span className="flex-1 min-w-56 leading-6">رمز المنسقين المشترك ما زال يعمل لمن لم يفعّل حسابه ({pending.length}). ألغِه بعد أن يفعّل الجميع.</span>
                    <button className={ghost} disabled={!!busy} onClick={async () => {
                        if (!window.confirm(pending.length ? `ما زال ${pending.length} منسق بلا حساب، ولن يستطيعوا الدخول بعد الإلغاء إلا برابط تفعيل. إلغاء الرمز المشترك؟` : "إلغاء رمز المنسقين المشترك نهائيًا؟")) return;
                        setBusy("retire"); setError("");
                        try { await retire({}); } catch (e) { setError(errorText(e, "تعذّر الإلغاء")); } finally { setBusy(""); }
                    }}>إلغاء الرمز المشترك</button>
                </div>
            )}
            {error && <p role="alert" className="px-4 pt-3 text-xs font-bold text-rose-700">{error}</p>}

            {ready.length > 0 && (
                <div className="mx-4 mt-3 rounded-xl border border-slate-200 p-3 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-black text-slate-800 ml-auto">روابط جاهزة للإرسال ({ready.length})</p>
                        <button className={ghost} onClick={() => copy(ready.map(r => messageOf(r.name, links[keyOf(r)])).join("\n\n"), "all")}><Copy className="w-3.5 h-3.5"/>{copied === "all" ? "تم النسخ" : "نسخ كل الرسائل"}</button>
                        <button className={ghost} onClick={exportSheet}><FileSpreadsheet className="w-3.5 h-3.5"/>ملف الرسائل (Excel)</button>
                    </div>
                    <p className="text-[11px] font-bold text-amber-800">انسخها أو نزّل الملف الآن: الروابط لا تظهر مرة أخرى بعد إغلاق الصفحة.</p>
                </div>
            )}

            <div className="overflow-x-auto mt-3">
                <table className="w-full text-sm text-right">
                    <thead className="bg-qatar-maroon/5 text-qatar-maroon text-xs">
                        <tr><th scope="col" className="p-3 font-black">الاسم</th><th scope="col" className="p-3 font-black">الحساب</th><th scope="col" className="p-3 font-black">الرابط</th><th scope="col" className="p-3"><span className="sr-only">إجراءات</span></th></tr>
                    </thead>
                    <tbody>
                        {data.rows.map((r, i) => {
                            const k = keyOf(r), link = links[k];
                            return (
                                <tr key={k} className={`border-t border-slate-100 transition-colors hover:bg-qatar-maroon/5 ${i % 2 ? "bg-slate-50/60" : ""}`}>
                                    <th scope="row" className="p-3 font-bold text-slate-800">{r.name}<span className="block text-[11px] font-bold text-slate-500">{r.detail}</span></th>
                                    <td className="p-3">{r.activatedAt ? <StatusChip status="success" label={`مفعّل · ${day(r.activatedAt)}`}/> : <StatusChip status="neutral" label="لم يُفعّل"/>}</td>
                                    <td className="p-3 text-xs">
                                        {link ? <span className="flex items-center gap-2">
                                            <input readOnly dir="ltr" value={link} onFocus={e => e.target.select()} aria-label={`رابط تفعيل ${r.name}`} className="w-48 border border-slate-200 rounded-lg px-2 py-1.5 text-[11px] bg-white"/>
                                            <button className={ghost} onClick={() => copy(messageOf(r.name, link), k)}>{copied === k ? "تم النسخ" : "نسخ الرسالة"}</button>
                                        </span> : r.linkExpiresAt ? <span className="font-bold text-slate-500">رابط مُرسل، ينتهي {day(r.linkExpiresAt)}</span> : ""}
                                    </td>
                                    <td className="p-3">
                                        {manageable(r) && <span className="flex gap-2 justify-end flex-wrap">
                                            <button className={ghost} disabled={!!busy} onClick={() => make([r], k)}>
                                                {busy === k ? <Loader2 className="w-3.5 h-3.5 animate-spin"/> : <Link2 className="w-3.5 h-3.5"/>}{r.activatedAt ? "رابط إعادة تعيين" : "رابط تفعيل"}
                                            </button>
                                            <button className={ghost} disabled={!!busy} onClick={() => setSetting(r)}><KeyRound className="w-3.5 h-3.5"/>تعيين كلمة سر</button>
                                        </span>}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
            {setting && <SetFor row={setting} onClose={() => setSetting(null)} save={password => setFor({ role: setting.role, visitorId: setting.visitorId ?? undefined, password })}/>}
        </section>
    );
}

// The deputy sets a password for someone. Kept for the person who cannot open
// a link; the link is better, because then only its owner knows the password.
function SetFor({ row, save, onClose }: { row: Row; save: (password: string) => Promise<unknown>; onClose: () => void }) {
    const [next, setNext] = useState("");
    const [confirm, setConfirm] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    return (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-3" role="dialog" aria-modal="true" aria-labelledby="set-for-title" dir="rtl">
            <form className="bg-white rounded-2xl w-full max-w-md shadow-xl p-5 space-y-3" onSubmit={async e => {
                e.preventDefault();
                if (busy || next !== confirm) return;
                setBusy(true); setError("");
                try { await save(next); onClose(); } catch (err) { setError(errorText(err, "تعذّر الحفظ؛ حاول مرة أخرى")); } finally { setBusy(false); }
            }}>
                <div className="flex items-center justify-between gap-3">
                    <h2 id="set-for-title" className="font-black text-slate-800">تعيين كلمة سر: {row.name}</h2>
                    <button type="button" onClick={onClose} aria-label="إغلاق" className="p-1 rounded-lg text-slate-400 hover:bg-slate-100"><X className="w-5 h-5"/></button>
                </div>
                <p className="text-xs text-slate-600 leading-6">تُلغى كلمة سره الحالية وجلساته المفتوحة، ويُسجَّل أنك عيّنتها. بلّغه بها ليغيّرها من «تغيير كلمة السر» بعد دخوله. رابط التفعيل أفضل: لا يعرف الكلمة غير صاحبها.</p>
                <NewPassword value={next} confirm={confirm} onChange={setNext} onConfirm={setConfirm}/>
                {error && <p role="alert" className="text-xs font-bold text-rose-700">{error}</p>}
                <button className={`${primary} w-full`} disabled={busy || next.length < 8 || next !== confirm}>{busy && <Loader2 className="w-4 h-4 animate-spin"/>}حفظ</button>
            </form>
        </div>
    );
}
