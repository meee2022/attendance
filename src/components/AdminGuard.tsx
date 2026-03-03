import { useState, useEffect } from "react";
import { useMutation } from "convex/react";
import { ShieldCheck, Lock, Eye, EyeOff, AlertCircle, KeyRound } from "lucide-react";
// @ts-ignore
import { api } from "../../convex/_generated/api";

const SESSION_KEY = "qatar_admin_auth";

interface AdminGuardProps {
    children: React.ReactNode;
}

export default function AdminGuard({ children }: AdminGuardProps) {
    const [authed, setAuthed] = useState<boolean>(() =>
        sessionStorage.getItem(SESSION_KEY) === "true"
    );
    const [pin, setPin] = useState("");
    const [showPin, setShowPin] = useState(false);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const verifyPin = useMutation(api.settings.verifyAdminPin);

    // If already authed in session, skip lock screen
    if (authed) return <>{children}</>;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!pin.trim()) return;
        setLoading(true);
        setError("");
        try {
            const ok = await verifyPin({ pin: pin.trim() });
            if (ok) {
                sessionStorage.setItem(SESSION_KEY, "true");
                setAuthed(true);
            } else {
                setError("الرمز غير صحيح. حاول مرة أخرى.");
                setPin("");
            }
        } catch (e: any) {
            setError("حدث خطأ. حاول مرة أخرى.");
        } finally {
            setLoading(false);
        }
    };

    const handlePinInput = (val: string) => {
        // Accept digits only, max 8
        const digits = val.replace(/\D/g, "").slice(0, 8);
        setPin(digits);
        setError("");
    };

    return (
        <div className="min-h-[70vh] flex items-center justify-center px-4">
            <div className="w-full max-w-sm space-y-0 animate-in fade-in slide-in-from-bottom-4 duration-500">

                {/* Lock icon header */}
                <div className="flex flex-col items-center gap-4 mb-8">
                    <div className="relative">
                        <div className="w-24 h-24 rounded-full bg-qatar-maroon/10 border-4 border-qatar-maroon/20 flex items-center justify-center">
                            <Lock className="w-10 h-10 text-qatar-maroon" />
                        </div>
                        <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-qatar-maroon rounded-full flex items-center justify-center shadow-lg">
                            <ShieldCheck className="w-4 h-4 text-white" />
                        </div>
                    </div>
                    <div className="text-center space-y-1">
                        <h2 className="text-2xl font-black text-slate-800">صفحة المسؤول</h2>
                        <p className="text-sm text-slate-400 font-medium">أدخل رمز الدخول للمتابعة</p>
                        <p className="text-[11px] text-slate-300 font-bold">الرمز الافتراضي: 1234</p>
                    </div>
                </div>

                {/* PIN form */}
                <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-qatar-gray-border qatar-card-shadow p-8 space-y-5">

                    <div className="space-y-2">
                        <label className="text-xs font-black text-slate-500 flex items-center gap-1.5">
                            <KeyRound className="w-3.5 h-3.5" />
                            رمز الدخول
                        </label>
                        <div className="relative">
                            <input
                                type={showPin ? "text" : "password"}
                                value={pin}
                                onChange={e => handlePinInput(e.target.value)}
                                placeholder="● ● ● ●"
                                autoFocus
                                className={`w-full text-center text-2xl font-black tracking-[0.5em] px-4 py-4 border-2 rounded-xl outline-none transition-all ${
                                    error
                                        ? "border-red-400 bg-red-50 text-red-800"
                                        : "border-slate-200 bg-slate-50 text-slate-800 focus:border-qatar-maroon focus:bg-white"
                                }`}
                                dir="ltr"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPin(v => !v)}
                                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                            >
                                {showPin ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                            </button>
                        </div>
                        {error && (
                            <div className="flex items-center gap-2 text-red-600 text-sm font-black animate-in fade-in">
                                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                                {error}
                            </div>
                        )}
                    </div>

                    {/* PIN dots visual */}
                    <div className="flex justify-center gap-3">
                        {[0, 1, 2, 3].map(i => (
                            <div
                                key={i}
                                className={`w-3 h-3 rounded-full transition-all duration-200 ${
                                    pin.length > i
                                        ? "bg-qatar-maroon scale-110"
                                        : "bg-slate-200"
                                }`}
                            />
                        ))}
                    </div>

                    <button
                        type="submit"
                        disabled={loading || pin.length < 4}
                        className="w-full flex items-center justify-center gap-2 bg-qatar-maroon text-white font-black py-4 rounded-xl hover:opacity-90 transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed shadow-md"
                    >
                        {loading ? (
                            <div className="animate-spin w-5 h-5 border-2 border-white/30 border-t-white rounded-full" />
                        ) : (
                            <>
                                <ShieldCheck className="w-5 h-5" />
                                دخول
                            </>
                        )}
                    </button>
                </form>

                <p className="text-center text-[11px] text-slate-300 font-bold pt-4">
                    هذه الصفحة مخصصة للمسؤول فقط
                </p>
            </div>
        </div>
    );
}

// Helper to clear admin session (for logout)
export function clearAdminSession() {
    sessionStorage.removeItem(SESSION_KEY);
}
