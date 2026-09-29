import { usePlatformSession } from "../lib/platformSession";
import { clearStoredRole } from "./SupervisionPinGate";
export default function AdminGuard({ children }: { children: React.ReactNode }) {
    const session = usePlatformSession();
    return (session?.role === "admin" || session?.role === "deputy") ? <>{children}</> : <div dir="rtl" className="p-8 text-center space-y-3"><p>هذه الصفحة متاحة للنائب الأكاديمي ومسؤول المنصة.</p><button className="text-qatar-maroon underline" onClick={clearStoredRole}>الدخول بصفة أخرى</button></div>;
}
export function clearAdminSession() { sessionStorage.removeItem("qatar_admin_auth"); clearStoredRole(); }
