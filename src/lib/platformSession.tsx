import { Component, createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useQuery as rawQuery, useMutation as rawMutation, useConvex as rawConvex } from "convex/react";
import { api } from "../../convex/_generated/api";
import SupervisionPinGate, { getStoredRole, clearStoredRole } from "../components/SupervisionPinGate";

const Context = createContext<ReturnType<typeof getStoredRole>>(null);
export const usePlatformSession = () => useContext(Context);
export const useQuery: typeof rawQuery = ((ref: any, args: any = {}) => {
    const session = usePlatformSession();
    return rawQuery(ref, !session || args === "skip" ? "skip" : { ...args, sessionToken: session.token });
}) as typeof rawQuery;
export const useMutation: typeof rawMutation = ((ref: any) => {
    const session = usePlatformSession(), mutate = rawMutation(ref);
    return (args: any = {}) => mutate({ ...args, sessionToken: session?.token ?? "" });
}) as typeof rawMutation;
export const useConvex: typeof rawConvex = (() => {
    const session = usePlatformSession(), client = rawConvex();
    return new Proxy(client, { get(target, key) {
        if (key === "query" || key === "mutation") return (ref: any, args: any = {}) => (target[key] as any)(ref, { ...args, sessionToken: session?.token ?? "" });
        const value = Reflect.get(target, key); return typeof value === "function" ? value.bind(target) : value;
    } });
}) as typeof rawConvex;

class SessionError extends Component<{ children: ReactNode }, { error: boolean }> {
    state = { error: false };
    static getDerivedStateFromError() { return { error: true }; }
    render() { return this.state.error ? <div dir="rtl" className="p-8 text-center space-y-4"><p>تعذّر عرض الصفحة. قد تكون الجلسة انتهت أو العملية غير متاحة لصفتك.</p><button className="text-qatar-maroon underline" onClick={() => { clearStoredRole(); this.setState({ error: false }); }}>العودة لتسجيل الدخول</button></div> : this.props.children; }
}

export default function PlatformBoundary({ children }: { children: ReactNode }) {
    const [session, setSession] = useState(getStoredRole);
    const current = rawQuery((api as any).supervisionSessions.current, session ? { token: session.token } : "skip");
    const logout = rawMutation((api as any).supervisionSessions.logout);
    useEffect(() => {
        const changed = () => {
            const next = getStoredRole();
            if (session && next?.token !== session.token) void logout({ token: session.token }).catch(() => {});
            if (!next) sessionStorage.removeItem("qatar_admin_auth");
            setSession(next);
        };
        window.addEventListener("supervision-session", changed);
        const timer = session ? setTimeout(() => clearStoredRole(), Math.max(0, session.expiresAt - Date.now())) : undefined;
        return () => { window.removeEventListener("supervision-session", changed); clearTimeout(timer); };
    }, [session, logout]);
    useEffect(() => { if (session && current === null) clearStoredRole(); }, [session, current]);
    if (!session) return <SupervisionPinGate platform onAuthed={() => setSession(getStoredRole())}/>;
    if (!current) return <p className="p-10 text-center">جاري التحقق من تسجيل الدخول…</p>;
    return <Context.Provider value={{ ...session, ...current }}><SessionError key={session.token}>{children}</SessionError></Context.Provider>;
}
