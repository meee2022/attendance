import { useState } from "react";
import { useQuery } from "convex/react";
// @ts-ignore
import { api } from "../../convex/_generated/api";
import { Lock, Eye, EyeOff, Shield } from "lucide-react";

type VisitorRole = "coordinator" | "supervisor" | "deputy";

const ROLE_LABELS: Record<VisitorRole, string> = {
    coordinator: "المنسق",
    supervisor: "الموجه",
    deputy: "النائب الأكاديمي",
};
const ROLE_COLORS: Record<VisitorRole, string> = {
    coordinator: "#9B1239",
    supervisor: "#1e40af",
    deputy: "#065f46",
};

const STORAGE_KEY = "supervision_role_session";

export function getStoredRole(): { role: VisitorRole; expiresAt: number } | null {
    try {
        const raw = sessionStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        const obj = JSON.parse(raw);
        if (obj.expiresAt && obj.expiresAt > Date.now()) return obj;
        sessionStorage.removeItem(STORAGE_KEY);
        return null;
    } catch { return null; }
}

export function clearStoredRole() {
    sessionStorage.removeItem(STORAGE_KEY);
}

export default function SupervisionPinGate({ onAuthed }: { onAuthed: (role: VisitorRole) => void }) {
    const [selectedRole, setSelectedRole] = useState<VisitorRole | null>(null);
    const [pin, setPin] = useState("");
    const [showPin, setShowPin] = useState(false);
    const [error, setError] = useState("");
    const verify = useQuery(
        api.supervision.verifyRolePin,
        selectedRole && pin.length >= 4 ? { role: selectedRole, pin } : "skip" as any
    );

    const handleSubmit = () => {
        if (verify === true && selectedRole) {
            sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
                role: selectedRole,
                expiresAt: Date.now() + 8 * 60 * 60 * 1000, // 8 ساعات
            }));
            onAuthed(selectedRole);
        } else {
            setError("رمز PIN غير صحيح");
        }
    };

    if (!selectedRole) {
        return (
            <div dir="rtl" className="max-w-md mx-auto pt-8 space-y-4 animate-in fade-in duration-300">
                <div className="bg-white rounded-2xl border border-qatar-gray-border qatar-card-shadow overflow-hidden">
                    <div className="bg-slate-700 px-5 py-4 flex items-center gap-3">
                        <Shield className="w-5 h-5 text-white/70"/>
                        <span className="font-black text-white">تسجيل الدخول للإشراف الصفي</span>
                    </div>
                    <div className="p-5 space-y-3">
                        <p className="text-sm text-slate-500 font-bold text-center">اختر صفتك للمتابعة</p>
                        {(Object.keys(ROLE_LABELS) as VisitorRole[]).map(r => (
                            <button key={r} onClick={() => { setSelectedRole(r); setError(""); }}
                                className="w-full py-4 rounded-xl text-white font-black text-base transition-all hover:opacity-90 qatar-card-shadow"
                                style={{ background: ROLE_COLORS[r] }}>
                                {ROLE_LABELS[r]}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div dir="rtl" className="max-w-md mx-auto pt-8 space-y-4 animate-in fade-in duration-300">
            <div className="bg-white rounded-2xl border border-qatar-gray-border qatar-card-shadow overflow-hidden">
                <div className="px-5 py-4 flex items-center gap-3" style={{ background: ROLE_COLORS[selectedRole] }}>
                    <Lock className="w-5 h-5 text-white/80"/>
                    <span className="font-black text-white">دخول {ROLE_LABELS[selectedRole]}</span>
                </div>
                <div className="p-5 space-y-4">
                    <p className="text-sm text-slate-400 font-bold text-center">أدخل رمز PIN</p>
                    <div className="relative">
                        <input type={showPin ? "text" : "password"} value={pin}
                            onChange={e => { setPin(e.target.value); setError(""); }}
                            onKeyDown={e => e.key === "Enter" && handleSubmit()}
                            placeholder="• • • •" autoFocus
                            className={`w-full border-2 rounded-xl px-4 py-3 text-center text-2xl tracking-widest font-black focus:outline-none ${error ? "border-red-400" : "border-qatar-gray-border focus:border-qatar-maroon"}`}/>
                        <button type="button" onClick={() => setShowPin(v => !v)}
                            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                            {showPin ? <EyeOff className="w-4 h-4"/> : <Eye className="w-4 h-4"/>}
                        </button>
                    </div>
                    {error && <p className="text-red-500 text-sm text-center font-bold">{error}</p>}
                    <button onClick={handleSubmit}
                        className="w-full py-3 rounded-xl font-black text-white text-sm transition-all hover:opacity-90"
                        style={{ background: ROLE_COLORS[selectedRole] }}>
                        دخول
                    </button>
                    <button onClick={() => { setSelectedRole(null); setPin(""); setError(""); }}
                        className="w-full text-xs text-slate-400 font-bold hover:text-slate-600">
                        تغيير الصفة
                    </button>
                </div>
                <div className="bg-slate-50 px-5 py-2 text-[10px] text-slate-400 font-bold text-center">
                    الافتراضي: المنسق 1111 · الموجه 2222 · النائب 3333
                </div>
            </div>
        </div>
    );
}
