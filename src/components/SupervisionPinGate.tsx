import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
// @ts-ignore
import { api } from "../../convex/_generated/api";
import { Lock, Eye, EyeOff, ArrowLeft, ArrowRight } from "lucide-react";
import "./SupervisionPinGate.css";

type VisitorRole = "coordinator" | "supervisor" | "deputy";

const ROLE_LABELS: Record<VisitorRole, string> = {
    coordinator: "المنسق",
    supervisor: "الموجه",
    deputy: "النائب الأكاديمي",
};
const ROLE_DESCRIPTIONS: Record<VisitorRole, string> = {
    coordinator: "زيارات القسم ومتابعة المعلمين",
    supervisor: "الزيارات الإشرافية والتوصيات",
    deputy: "متابعة الإشراف وإدارة إعداداته",
};

const STORAGE_KEY = "supervision_role_session";

export function getStoredRole(): { role: VisitorRole; name: string; visitorId?: string; expiresAt: number; token: string } | null {
    try {
        const raw = sessionStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        const obj = JSON.parse(raw);
        if (obj.token && obj.expiresAt && obj.expiresAt > Date.now()) return obj;
        sessionStorage.removeItem(STORAGE_KEY);
        return null;
    } catch { return null; }
}

export function clearStoredRole() {
    sessionStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new Event("supervision-session"));
}

export default function SupervisionPinGate({ onAuthed }: { onAuthed: (role: VisitorRole) => void }) {
    const [selectedRole, setSelectedRole] = useState<VisitorRole | null>(null);
    const [pin, setPin] = useState("");
    const [visitorName, setVisitorName] = useState("");
    const [showPin, setShowPin] = useState(false);
    const [error, setError] = useState("");
    const [visitorId, setVisitorId] = useState("");
    const login = useMutation((api as any).supervisionSessions.login);
    const [busy, setBusy] = useState(false);
    const setup = useQuery((api as any).supervisionSessions.directory) as any;
    const people: { _id: string; fullName: string }[] = selectedRole
        ? (setup?.visitors ?? []).filter((p: any) => p.role === selectedRole)
        : [];
    const deputyName: string = setup?.deputyName ?? "";

    const handleSubmit = async () => {
        if (busy || !selectedRole) return;
        const name = visitorName.trim() || (selectedRole === "deputy" ? deputyName : "");
        if (!name || (selectedRole !== "deputy" && !visitorId)) { setError("اختر اسمك؛ إن لم تجده راجع النائب الأكاديمي"); return; }
        setBusy(true); setError("");
        try {
            const token = Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, "0")).join("");
            const result = await login({ role: selectedRole, visitorId: visitorId || undefined, name, pin, token });
            if (result.error) { setError(result.error); return; }
            sessionStorage.setItem(STORAGE_KEY, JSON.stringify(result.session));
            onAuthed(selectedRole);
        } catch { setError("تعذّر الاتصال؛ حاول مرة أخرى"); }
        finally { setBusy(false); }
    };

    const resetRole = () => {
        setSelectedRole(null); setVisitorId(""); setVisitorName(""); setPin(""); setError(""); setShowPin(false);
    };

    return (
        <section dir="rtl" className="supervision-entry" aria-labelledby="supervision-entry-title">
            <header className="supervision-entry-heading">
                <h1 id="supervision-entry-title">الإشراف الصفي</h1>
                <p>الزيارات الصفية ومتابعة تطوير أداء المعلمين</p>
            </header>
            <div className="supervision-entry-panel">
                {!selectedRole ? <>
                    <div className="supervision-entry-intro">
                        <h2>تسجيل الدخول</h2>
                        <p>اختر صفتك، ثم أدخل بيانات الدخول.</p>
                    </div>
                    <div className="supervision-role-list">
                        {(["coordinator", "deputy"] as VisitorRole[]).map(role => (
                            <button key={role} type="button" className="supervision-role-option"
                                onClick={() => { setSelectedRole(role); setError(""); }}>
                                <span><strong>{ROLE_LABELS[role]}</strong><small>{ROLE_DESCRIPTIONS[role]}</small></span>
                                <ArrowLeft size={18} aria-hidden="true"/>
                            </button>
                        ))}
                    </div>
                </> : <>
                    <div className="supervision-entry-selected">
                        <div><h2>دخول {ROLE_LABELS[selectedRole]}</h2><p>{ROLE_DESCRIPTIONS[selectedRole]}</p></div>
                        <button type="button" onClick={resetRole} disabled={busy} className="supervision-entry-back"><ArrowRight size={15} aria-hidden="true"/>تغيير الصفة</button>
                    </div>
                    <form className="supervision-entry-form" onSubmit={e => { e.preventDefault(); void handleSubmit(); }}>
                        <div className="supervision-entry-field">
                            <label htmlFor="supervision-visitor">الاسم</label>
                            {selectedRole !== "deputy" ? (
                                <select id="supervision-visitor" value={visitorId} disabled={busy || !setup || !people.length} autoFocus
                                    onChange={e => {
                                        const person = people.find(x => x._id === e.target.value);
                                        setVisitorId(e.target.value); setVisitorName(person?.fullName ?? ""); setError("");
                                    }} required>
                                    <option value="">{!setup ? "جاري تحميل الأسماء…" : !people.length ? "لا توجد أسماء مسجلة لهذه الصفة" : "اختر اسمك من القائمة"}</option>
                                    {people.map(person => <option key={person._id} value={person._id}>{person.fullName}</option>)}
                                </select>
                            ) : (
                                <input id="supervision-visitor" type="text" value={deputyName} readOnly
                                    onChange={e => { setVisitorName(e.target.value); setError(""); }}
                                    placeholder="اسم النائب لم يُسجّل بعد" autoComplete="name" disabled={busy} autoFocus required/>
                            )}
                            {setup && selectedRole !== "deputy" && !people.length && <p className="supervision-entry-help">راجع النائب الأكاديمي لإضافة اسمك قبل تسجيل الدخول.</p>}
                        </div>
                        {selectedRole === "deputy" && setup && !deputyName && <p role="status" className="supervision-entry-help">يجب ضبط اسم النائب في إعدادات الإشراف أولًا.</p>}
                        <div className="supervision-entry-field">
                            <label htmlFor="supervision-pin">رمز الدخول <span>(PIN)</span></label>
                            <div className="supervision-pin-input">
                                <input id="supervision-pin" type={showPin ? "text" : "password"} value={pin} dir="ltr"
                                    onChange={e => { setPin(e.target.value); setError(""); }}
                                    placeholder="••••" autoComplete="current-password" disabled={busy} required
                                    aria-invalid={!!error} aria-describedby={error ? "supervision-entry-error" : undefined}/>
                                <button type="button" onClick={() => setShowPin(value => !value)}
                                    aria-label={showPin ? "إخفاء رمز الدخول" : "إظهار رمز الدخول"} aria-pressed={showPin}>
                                    {showPin ? <EyeOff size={18}/> : <Eye size={18}/>}
                                </button>
                            </div>
                        </div>
                        {error && <p id="supervision-entry-error" role="alert" className="supervision-entry-error">{error}</p>}
                        <button type="submit" className="supervision-entry-submit" disabled={busy || !setup || (selectedRole === "deputy" && !deputyName) || (selectedRole !== "deputy" && !people.length)}>
                            {busy ? "جاري تسجيل الدخول…" : "دخول الإشراف"}<ArrowLeft size={17} aria-hidden="true"/>
                        </button>
                    </form>
                </>}
                <footer className="supervision-entry-footer"><Lock size={14} aria-hidden="true"/><span>الدخول مخصص لفريق الإشراف بالمدرسة</span></footer>
            </div>
        </section>
    );
}
