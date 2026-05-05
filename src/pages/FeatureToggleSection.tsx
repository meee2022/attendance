import { useQuery, useMutation } from "convex/react";
// @ts-ignore
import { api } from "../../convex/_generated/api";
import { Eye, EyeOff, ToggleRight } from "lucide-react";
import { FEATURES } from "../lib/featureFlags";

export default function FeatureToggleSection() {
    const hidden = (useQuery(api.settings.getHiddenFeatures) as string[] | undefined) ?? [];
    const toggle = useMutation(api.settings.toggleFeature);

    const handleToggle = async (key: string, currentlyHidden: boolean) => {
        await toggle({ featureKey: key, hidden: !currentlyHidden });
    };

    const visibleCount = FEATURES.filter(f => !hidden.includes(f.key)).length;

    return (
        <div dir="rtl" className="space-y-4">
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="px-5 py-3.5 flex items-center justify-between"
                    style={{ background: "linear-gradient(135deg,#5C1A1B22,#5C1A1B0a)", borderRight: "4px solid #5C1A1B" }}>
                    <span className="text-[10px] font-black text-qatar-maroon bg-white px-2.5 py-1 rounded-full">
                        {visibleCount} / {FEATURES.length} ظاهرة
                    </span>
                    <span className="font-black text-slate-800 text-sm flex items-center gap-2">
                        <ToggleRight className="w-4 h-4 text-qatar-maroon"/>
                        إظهار / إخفاء الصفحات
                    </span>
                </div>
                <div className="p-3 bg-amber-50/50 border-b border-amber-100">
                    <p className="text-xs font-bold text-amber-800 leading-relaxed">
                        التحكم في الصفحات اللي تظهر للمستخدمين. الصفحة المخفية لن تظهر في القائمة، وأي محاولة لفتحها مباشرة عبر الرابط ستعرض رسالة "معطّلة".
                    </p>
                </div>
                <div className="divide-y divide-slate-100">
                    {FEATURES.map(f => {
                        const isHidden = hidden.includes(f.key);
                        return (
                            <div key={f.key} className="p-4 flex items-center justify-between gap-3">
                                <button onClick={() => handleToggle(f.key, isHidden)}
                                    className={`relative w-12 h-7 rounded-full transition-colors flex-shrink-0 ${isHidden ? "bg-slate-200" : "bg-emerald-500"}`}>
                                    <span className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow-sm transition-all ${isHidden ? "right-0.5" : "right-[22px]"}`}/>
                                </button>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <p className="font-black text-slate-800 text-sm">{f.label}</p>
                                        {isHidden ? (
                                            <span className="flex items-center gap-1 text-[10px] font-black text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                                                <EyeOff className="w-2.5 h-2.5"/>مخفية
                                            </span>
                                        ) : (
                                            <span className="flex items-center gap-1 text-[10px] font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                                                <Eye className="w-2.5 h-2.5"/>ظاهرة
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs text-slate-500 font-medium mt-0.5">{f.description}</p>
                                    <p className="text-[10px] text-slate-400 font-bold mt-0.5 ltr-text" dir="ltr">{f.key}</p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
