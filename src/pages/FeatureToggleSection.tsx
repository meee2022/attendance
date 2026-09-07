import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Check, Info, LoaderCircle, AlertCircle } from "lucide-react";
import { FEATURES } from "../lib/featureFlags";

const GROUPS = [
    { title: "الحضور والتواصل", keys: ["/", "/upload", "/reports", "/messages"] },
    { title: "تقييم الطلاب", keys: ["/grades", "/assessments", "/practical-exams"] },
    { title: "الإشراف والتطوير", keys: ["/supervision", "/surveys"] },
];
type Filter = "all" | "enabled" | "disabled";

export default function FeatureToggleSection() {
    const hidden = useQuery(api.settings.getHiddenFeatures);
    const toggle = useMutation(api.settings.toggleFeature);
    const [filter, setFilter] = useState<Filter>("all");
    const [saving, setSaving] = useState<string | null>(null);
    const [feedback, setFeedback] = useState<{ text: string; error: boolean } | null>(null);

    if (hidden === undefined) return <div role="status" className="feature-loading">
        <LoaderCircle className="w-5 h-5 animate-spin"/>جاري تحميل حالة الأقسام…
    </div>;
    const enabledCount = FEATURES.filter(f => !hidden.includes(f.key)).length;
    const matches = (key: string) => filter === "all" || (filter === "disabled" ? hidden.includes(key) : !hidden.includes(key));
    const handleToggle = async (key: string, label: string) => {
        if (saving) return;
        const willDisable = !hidden.includes(key);
        setSaving(key);
        setFeedback(null);
        try {
            await toggle({ featureKey: key, hidden: willDisable });
            setFeedback({ text: `تم ${willDisable ? "تعطيل" : "تفعيل"} ${label}.`, error: false });
        } catch {
            setFeedback({ text: `تعذّر حفظ تغيير «${label}». حاول مرة أخرى.`, error: true });
        } finally { setSaving(null); }
    };
    return <div className="feature-manager" dir="rtl">
        <div className="feature-explanation">
            <Info className="w-4 h-4 shrink-0" aria-hidden="true"/>
            <p>القسم المفعّل يظهر في القائمة ويمكن فتحه. تعطيله يخفيه من القائمة ويعرض رسالة التعطيل عند فتح صفحته. <strong>تبقى بياناته محفوظة.</strong></p>
        </div>
        <div className="feature-toolbar">
            <div className="feature-filters" role="group" aria-label="تصفية الأقسام حسب الحالة">
                {([
                    { id: "all", label: "الكل", count: FEATURES.length },
                    { id: "enabled", label: "مفعّلة", count: enabledCount },
                    { id: "disabled", label: "معطّلة", count: FEATURES.length - enabledCount },
                ] as const).map(item => <button key={item.id} type="button" aria-pressed={filter === item.id}
                    onClick={() => setFilter(item.id)} className={filter === item.id ? "is-active" : ""}>
                    {item.label}<span>{item.count}</span>
                </button>)}
            </div>
            <span className="feature-save-note">يُحفظ كل تغيير تلقائيًا</span>
        </div>
        {feedback && <p className={`feature-feedback ${feedback.error ? "is-error" : ""}`} role={feedback.error ? "alert" : "status"}>
            {feedback.error ? <AlertCircle className="w-4 h-4"/> : <Check className="w-4 h-4"/>}{feedback.text}
        </p>}
        {GROUPS.map(group => {
            const items = group.keys.map(key => FEATURES.find(f => f.key === key)!).filter(f => matches(f.key));
            if (!items.length) return null;
            return <section key={group.title} className="feature-group" aria-label={group.title}>
                <h3>{group.title}<span>{items.length}</span></h3>
                <div className="feature-list">
                    {items.map(feature => {
                        const enabled = !hidden.includes(feature.key);
                        const busy = saving === feature.key;
                        return <div key={feature.key} className="feature-row">
                            <div className="feature-row-copy"><h4>{feature.label}</h4><p>{feature.description}</p></div>
                            <div className="feature-row-action">
                                <span className={enabled ? "feature-state is-enabled" : "feature-state"}>{busy ? "جارٍ الحفظ…" : enabled ? "مفعّل" : "معطّل"}</span>
                                <button type="button" role="switch" aria-checked={enabled} aria-label={`إتاحة ${feature.label}`}
                                    aria-busy={busy} disabled={saving !== null} className={`feature-switch ${enabled ? "is-enabled" : ""}`}
                                    onClick={() => handleToggle(feature.key, feature.label)}>
                                    <span>{busy ? <LoaderCircle className="w-3 h-3 animate-spin"/> : enabled ? <Check className="w-3 h-3"/> : null}</span>
                                </button>
                            </div>
                        </div>;
                    })}
                </div>
            </section>;
        })}
        {!FEATURES.some(f => matches(f.key)) && <p className="feature-empty">
            {filter === "disabled" ? "كل الأقسام مفعّلة. لا توجد أقسام معطّلة." : "لا توجد أقسام مفعّلة حاليًا. اختر «الكل» لتفعيل قسم."}
        </p>}
        <p className="feature-save-note">الإعدادات متاحة للمسؤول من قائمة الإدارة، وتشمل إدارة الطلاب.</p>
    </div>;
}
