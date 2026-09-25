import { useUnsavedChanges } from "../../lib/useUnsavedChanges";
import { useEffect, useRef, useState } from "react";
import { FolderOpen } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { useSupervisionQuery, useSupervisionSession } from "../../lib/supervisionSession";
import { archiveConfig, chooseArchiveDirectory, supportsVisitArchive, writeVisitPdf, type ArchiveConfig } from "../../lib/visitArchive";

function useArchiveKey() {
    const session = useSupervisionSession();
    return `${import.meta.env.VITE_CONVEX_URL}:${session?.role}:${session?.role === "deputy" ? "school-deputy" : session?.visitorId ?? session?.name}`;
}
const changed = () => window.dispatchEvent(new Event("visit-archive-settings"));

export function VisitArchiveSettings() {
    const key = useArchiveKey();
    const [config, setConfig] = useState<ArchiveConfig>();
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);
    useEffect(() => { let active = true; archiveConfig(key).then(c => { if (active) setConfig(c); }).catch(() => { if (active) setError("تعذّر قراءة إعداد المجلد في هذا المتصفح."); }); return () => { active = false; }; }, [key]);
    const choose = async () => {
        setError(""); setBusy(true);
        try {
            const directory = await chooseArchiveDirectory();
            const next = { directory, enabled: true };
            await archiveConfig(key, next); setConfig(next); changed();
        } catch (e) { if ((e as DOMException).name !== "AbortError") setError("تعذّر اختيار المجلد. اسمح بالكتابة واختر مجلدًا يمكنك الوصول إليه."); }
        finally { setBusy(false); }
    };
    const toggle = async () => {
        if (!config) return;
        setBusy(true); setError("");
        try {
            if (!config.enabled && await config.directory.requestPermission({ mode: "readwrite" }) !== "granted") throw new Error();
            const next = { ...config, enabled: !config.enabled };
            await archiveConfig(key, next); setConfig(next); changed();
        } catch { setError("تعذّر تغيير الإعداد. تحقق من إذن المجلد."); }
        finally { setBusy(false); }
    };
    return <details className="visit-archive-settings">
        <summary><FolderOpen size={17} aria-hidden="true"/><span>أرشفة الزيارات PDF</span><small>{config?.enabled ? `مفعّلة · ${config.directory.name}` : "غير مفعّلة"}</small></summary>
        <div className="visit-archive-content">
            <p>احفظ نسخة PDF تلقائيًا عند اعتماد الزيارة على هذا الجهاز. الترتيب: السنة الدراسية ← القسم ← المعلم. كل تعديل معتمد يُحفظ كنسخة مستقلة.</p>
            {supportsVisitArchive() ? <div className="flex flex-wrap gap-3">
                <button className="visit-results-export" disabled={busy} onClick={choose}>{config ? "تغيير المجلد" : "اختيار مجلد وتفعيل الأرشفة"}</button>
                {config && <button className="visit-results-export" disabled={busy} onClick={toggle}>{config.enabled ? "إيقاف الأرشفة التلقائية" : "تفعيل الأرشفة التلقائية"}</button>}
            </div> : <p>اختيار مجلد غير متاح في هذا المتصفح. افتح التطبيق في Chrome أو Edge على الكمبيوتر، أو استخدم «طباعة / حفظ PDF» لكل زيارة.</p>}
            <p className="visit-archive-hint">يشمل الزيارات التي تعتمدها بعد التفعيل. الملفات السابقة تبقى في المجلد عند إيقاف الأرشفة، وقد يطلب المتصفح إذن الوصول مجددًا.</p>
            {error && <p role="alert" className="text-red-700">{error}</p>}
        </div>
    </details>;
}

const pending = new Map<string, Promise<string>>();
export function AutoArchiveVisit({ visitId }: { visitId: string }) {
    const key = useArchiveKey();
    const data = useSupervisionQuery(api.visits.getVisitForm, { id: visitId }) as any;
    const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
    const [message, setMessage] = useState("");
    const [config, setConfig] = useState<ArchiveConfig>();
    const [loaded, setLoaded] = useState(false);
    const attempted = useRef("");
    useUnsavedChanges(state === "saving");
    useEffect(() => {
        let active = true;
        const read = () => archiveConfig(key).then(c => { if (active) { setConfig(c); setLoaded(true); } }).catch(() => {
            if (active) { setState("error"); setMessage("الزيارة محفوظة؛ تعذّر قراءة إعداد الأرشيف. راجع إعداد مجلد الأرشفة."); }
        });
        void read(); window.addEventListener("visit-archive-settings", read);
        return () => { active = false; window.removeEventListener("visit-archive-settings", read); };
    }, [key]);
    const save = async (manual = false) => {
        if (!data || !config?.enabled || data.visit.status !== "submitted") return;
        setState("saving");
        try {
            if (manual && await config.directory.requestPermission({ mode: "readwrite" }) !== "granted") throw new Error("لم يُمنح إذن الكتابة في المجلد.");
            const jobKey = `${key}:${visitId}:${data.visit.updatedAt}`;
            let job = pending.get(jobKey);
            if (!job) {
                job = writeVisitPdf(config.directory, data, async () => {
                    const { createVisitPdf } = await import("../../lib/visitPdf");
                    return createVisitPdf(data);
                });
                pending.set(jobKey, job);
            }
            try { const path = await job; setMessage(`حُفظ PDF في ${config.directory.name} / ${path}`); setState("saved"); }
            finally { pending.delete(jobKey); }
        } catch (e) {
            setState("error"); setMessage(`الزيارة محفوظة في التطبيق، لكن لم تُؤرشف على الجهاز. ${e instanceof Error && /إذن|الأرشيف/.test(e.message) ? e.message : "تحقق من اتصالك وإذن المجلد والمساحة المتاحة، ثم أعد المحاولة."}`);
        }
    };
    useEffect(() => {
        if (!loaded || !config?.enabled || !data?.visit) return;
        const revision = `${key}:${visitId}:${data.visit.updatedAt}`;
        if (attempted.current === revision) return;
        attempted.current = revision; void save();
    }, [loaded, config, data, key, visitId]);
    if (state === "idle") return null;
    return <div className="visit-archive-status" role="status" aria-live="polite">
        <p>{state === "saving" ? "جاري حفظ نسخة PDF في مجلد الأرشيف… انتظر اكتمال الحفظ قبل إغلاق الصفحة." : message}</p>
        {state === "error" && config?.enabled && <button className="visit-results-export" onClick={() => void save(true)}>إعادة محاولة الحفظ</button>}
    </div>;
}
