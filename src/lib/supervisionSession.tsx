import { Component, createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import SupervisionPinGate, { getStoredRole, clearStoredRole } from "../components/SupervisionPinGate";

const SessionContext = createContext<ReturnType<typeof getStoredRole>>(null);
class SupervisionErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
    state = { failed: false };
    static getDerivedStateFromError() { return { failed: true }; }
    render() {
        if (!this.state.failed) return this.props.children;
        return <div dir="rtl" role="alert" className="p-6 space-y-3 bg-white rounded-xl border border-slate-200">
            <p>تعذّر تحميل بيانات الإشراف. تحقق من الاتصال أو سجّل الدخول مجددًا إذا انتهت جلستك.</p>
            <button className="text-qatar-maroon underline p-2" onClick={() => this.setState({ failed: false })}>إعادة المحاولة</button>
            <button className="text-qatar-maroon underline p-2" onClick={() => { clearStoredRole(); this.setState({ failed: false }); }}>تسجيل الدخول مجددًا</button>
        </div>;
    }
}
export const useSupervisionSession = () => useContext(SessionContext);
export function useSupervisionQuery(apiRef: any, args: any = {}) {
    const session = useSupervisionSession();
    return useQuery(apiRef, !session || args === "skip" ? "skip" : { ...args, sessionToken: session.token });
}
export function useSupervisionMutation(apiRef: any) {
    const session = useSupervisionSession();
    const mutate = useMutation(apiRef);
    return (args: any = {}) => mutate({ ...args, sessionToken: session?.token ?? "" });
}

export function SupervisionBoundary({ children, deputy = false }: { children: ReactNode; deputy?: boolean }) {
    return <SupervisionErrorBoundary><SupervisionSessionContent deputy={deputy}>{children}</SupervisionSessionContent></SupervisionErrorBoundary>;
}

function SupervisionSessionContent({ children, deputy = false }: { children: ReactNode; deputy?: boolean }) {
    const [session, setSession] = useState(getStoredRole);
    const logout = useMutation((api as any).supervisionSessions.logout);
    const current = useQuery((api as any).supervisionSessions.current, session ? { token: session.token } : "skip");
    useEffect(() => {
        if (session && current === null) { clearStoredRole(); setSession(null); }
    }, [session, current]);
    useEffect(() => {
        if (!session) return;
        const timer = setTimeout(() => { clearStoredRole(); setSession(null); }, Math.max(0, session.expiresAt - Date.now()));
        const changed = () => {
            const next = getStoredRole();
            if (!next) void logout({ token: session.token }).catch(() => {});
            setSession(next);
        };
        window.addEventListener("supervision-session", changed);
        return () => { clearTimeout(timer); window.removeEventListener("supervision-session", changed); };
    }, [session, logout]);
    if (!session) return <SupervisionPinGate onAuthed={() => setSession(getStoredRole())}/>;
    if (!current) return <p className="p-8 text-center text-slate-600">جاري التحقق من جلسة الإشراف…</p>;
    if (deputy && current.role !== "deputy") return <div dir="rtl" className="p-6 space-y-3"><p>إدارة الإشراف متاحة للنائب الأكاديمي.</p><button className="text-qatar-maroon underline" onClick={() => { clearStoredRole(); setSession(null); }}>تغيير المستخدم</button></div>;
    return <SessionContext.Provider value={{ ...session, ...current }}><SupervisionErrorBoundary key={session.token}>{children}</SupervisionErrorBoundary></SessionContext.Provider>;
}
