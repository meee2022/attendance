import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
// @ts-ignore
import { api } from "../../convex/_generated/api";
import { Plus, Trash2, Save, CheckCircle2, GripVertical, RotateCcw } from "lucide-react";
import { LoadingSpinner } from "../components/ui";

const DEFAULTS = [
    { id: "tools", label: "الأدوات والكتب" },
    { id: "participation", label: "مشاركة صفية" },
    { id: "homework", label: "واجبات" },
    { id: "elearning", label: "مهام التعليم الإلكتروني" },
    { id: "behaviour", label: "مواظبة وسلوك" },
];

// Ids are stable keys inside every saved record, so renaming a criterion keeps
// its history while adding one creates a fresh id.
function slugify(label: string, taken: string[]): string {
    const base = label.trim().replace(/\s+/g, "-").slice(0, 24) || "criterion";
    let id = base;
    let n = 2;
    while (taken.includes(id)) id = `${base}-${n++}`;
    return id;
}

export default function FollowUpAdmin() {
    const stored = useQuery(api.followUp.getCriteria) as any[] | undefined;
    const updateCriteria = useMutation(api.followUp.updateCriteria);

    const [items, setItems] = useState<{ id: string; label: string }[]>([]);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => { if (stored) setItems(stored.map(c => ({ ...c }))); }, [stored]);

    if (!stored) return <LoadingSpinner label="جاري تحميل المعايير"/>;

    const move = (i: number, dir: -1 | 1) => {
        const j = i + dir;
        if (j < 0 || j >= items.length) return;
        const next = [...items];
        [next[i], next[j]] = [next[j], next[i]];
        setItems(next);
    };

    const handleSave = async () => {
        setError("");
        try {
            await updateCriteria({ criteria: items.map(c => ({ id: c.id, label: c.label.trim() })) });
            setSaved(true);
            setTimeout(() => setSaved(false), 2500);
        } catch (e: any) {
            setError(e.message ?? "تعذّر الحفظ");
        }
    };

    return (
        <div className="space-y-5">
            <div className="bg-white rounded-2xl border border-qatar-gray-border qatar-card-shadow overflow-hidden">
                <div className="bg-qatar-maroon px-6 py-4">
                    <h2 className="text-white font-black text-lg">معايير كشف المتابعة اليومية</h2>
                    <p className="text-white/70 text-xs font-bold mt-0.5">
                        هذه هي أعمدة الكشف. تغيير الاسم يحافظ على السجل السابق، وحذف معيار يخفيه من الكشوف الجديدة.
                    </p>
                </div>

                <div className="p-5 space-y-3">
                    {items.map((c, i) => (
                        <div key={c.id} className="flex items-center gap-2">
                            <div className="flex flex-col">
                                <button type="button" onClick={() => move(i, -1)} disabled={i === 0}
                                    aria-label="تحريك لأعلى"
                                    className="px-1 text-slate-300 hover:text-qatar-maroon disabled:opacity-30 text-xs">▲</button>
                                <button type="button" onClick={() => move(i, 1)} disabled={i === items.length - 1}
                                    aria-label="تحريك لأسفل"
                                    className="px-1 text-slate-300 hover:text-qatar-maroon disabled:opacity-30 text-xs">▼</button>
                            </div>
                            <GripVertical className="w-4 h-4 text-slate-200 flex-shrink-0"/>
                            <span className="w-7 h-7 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center font-black text-xs flex-shrink-0">
                                {i + 1}
                            </span>
                            <input value={c.label}
                                onChange={e => setItems(p => p.map((x, idx) => idx === i ? { ...x, label: e.target.value } : x))}
                                className="flex-1 border-2 border-slate-100 rounded-xl px-3 py-2 text-sm font-bold bg-slate-50 focus:outline-none focus:border-qatar-maroon"/>
                            <button type="button" onClick={() => setItems(p => p.filter((_, idx) => idx !== i))}
                                disabled={items.length <= 1}
                                aria-label={`حذف ${c.label}`}
                                className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg disabled:opacity-30 disabled:pointer-events-none">
                                <Trash2 className="w-4 h-4"/>
                            </button>
                        </div>
                    ))}

                    <div className="flex flex-wrap gap-2 pt-2">
                        <button type="button"
                            onClick={() => setItems(p => [...p, { id: slugify("معيار", p.map(x => x.id)), label: "" }])}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black text-qatar-maroon bg-rose-50 border border-rose-200 hover:bg-rose-100">
                            <Plus className="w-4 h-4"/>إضافة معيار
                        </button>
                        <button type="button" onClick={() => setItems(DEFAULTS.map(c => ({ ...c })))}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black text-slate-600 bg-white border border-slate-200 hover:border-slate-400">
                            <RotateCcw className="w-4 h-4"/>استعادة المعايير الخمسة الأصلية
                        </button>
                    </div>

                    {error && (
                        <p className="text-xs font-black text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
                    )}

                    <button onClick={handleSave}
                        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-qatar-maroon text-white font-black text-sm hover:opacity-90 mt-2">
                        {saved ? <><CheckCircle2 className="w-4 h-4"/>تم الحفظ</> : <><Save className="w-4 h-4"/>حفظ المعايير</>}
                    </button>
                </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 text-xs font-bold text-slate-600 leading-relaxed space-y-1.5">
                <p className="font-black text-slate-700 mb-2">كيف يعمل الكشف</p>
                <p>· كل طالب <span className="text-emerald-700">ملتزم افتراضياً</span> — المعلم يعلّم المخالفات فقط، فلا يلمس معظم الخانات.</p>
                <p>· الضغط على الخانة يبدّل بين حالتين فقط: ✓ ملتزم و ✗ غير ملتزم.</p>
                <p>· زر «اعتماد الكشف» يسجّل أن الحصة رُصدت حتى لو لم تكن هناك أي مخالفة.</p>
                <p>· الطالب الغائب تُلغى معاييره تلقائياً حتى لا يُحتسب عليه غياب ومخالفات معاً.</p>
            </div>
        </div>
    );
}
