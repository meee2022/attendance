import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
// @ts-ignore
import { api } from "../../convex/_generated/api";
import { Save, FlaskConical, MessageSquare, CheckCircle2, Info, Plus, Trash2, Mic, Headphones, Activity, Sparkles, BookOpen } from "lucide-react";

const DEFAULT_CATEGORIES = ["عملي", "شفوي", "مهارات حياتية", "تربية بدنية", "استماع"];

function categoryStyle(cat: string) {
    const c = cat.trim();
    if (c.includes("عمل")) return { icon: FlaskConical, color: "#5C1523" };
    if (c.includes("شفو")) return { icon: Mic, color: "#1e40af" };
    if (c.includes("بدني")) return { icon: Activity, color: "#ea580c" };
    if (c.includes("استماع")) return { icon: Headphones, color: "#065f46" };
    if (c.includes("مهارات")) return { icon: Sparkles, color: "#7c3aed" };
    return { icon: BookOpen, color: "#64748b" };
}

type SubjectMeta = { subject: string; category: string };

export default function PracticalExamsAdmin() {
    const [tab, setTab] = useState<"subjects" | "template">("subjects");

    return (
        <div dir="rtl" className="space-y-4">
            <div className="bg-white rounded-2xl border border-qatar-gray-border qatar-card-shadow overflow-hidden">
                <div className="px-5 py-3 flex items-center justify-between gap-3 flex-wrap" style={{background:"linear-gradient(135deg,#5C1523,#7A1E30)"}}>
                    <div className="flex gap-2">
                        <button onClick={() => setTab("subjects")}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black ${tab === "subjects" ? "bg-white text-slate-700 shadow" : "bg-white/10 text-white hover:bg-white/20"}`}>
                            <FlaskConical className="w-3.5 h-3.5"/>المواد والفئات
                        </button>
                        <button onClick={() => setTab("template")}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black ${tab === "template" ? "bg-white text-slate-700 shadow" : "bg-white/10 text-white hover:bg-white/20"}`}>
                            <MessageSquare className="w-3.5 h-3.5"/>قالب الرسالة
                        </button>
                    </div>
                    <span className="font-black text-white text-sm">إعدادات الاختبارات العملية</span>
                </div>
                <div className="p-5">
                    {tab === "subjects" && <SubjectsEditor/>}
                    {tab === "template" && <TemplateEditor/>}
                </div>
            </div>
        </div>
    );
}

function SubjectsEditor() {
    const settings = useQuery(api.practicalExams.getSettings) as any;
    const update = useMutation(api.practicalExams.updateSubjects);

    const [list, setList] = useState<SubjectMeta[]>([]);
    const [newSubject, setNewSubject] = useState("");
    const [newCategory, setNewCategory] = useState("عملي");
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        if (settings) setList(settings.subjects ?? []);
    }, [settings]);

    if (!settings) return <div className="flex justify-center py-10"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-qatar-maroon"/></div>;

    // Used categories + defaults
    const usedCategories = Array.from(new Set([...list.map(l => l.category), ...DEFAULT_CATEGORIES]));

    const add = () => {
        if (!newSubject.trim() || !newCategory.trim()) return;
        if (list.some(l => l.subject === newSubject.trim())) {
            alert("المادة موجودة بالفعل");
            return;
        }
        setList(p => [...p, { subject: newSubject.trim(), category: newCategory.trim() }]);
        setNewSubject("");
    };

    const remove = (subject: string) => setList(p => p.filter(l => l.subject !== subject));

    const move = (i: number, dir: -1 | 1) => {
        const arr = [...list];
        const j = i + dir;
        if (j < 0 || j >= arr.length) return;
        [arr[i], arr[j]] = [arr[j], arr[i]];
        setList(arr);
    };

    const changeCategory = (subject: string, cat: string) => {
        setList(p => p.map(l => l.subject === subject ? { ...l, category: cat } : l));
    };

    const handleSave = async () => {
        await update({ subjects: list });
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    };

    // Group by category for preview
    const byCategory: Record<string, SubjectMeta[]> = {};
    for (const s of list) {
        if (!byCategory[s.category]) byCategory[s.category] = [];
        byCategory[s.category].push(s);
    }

    return (
        <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-xs font-bold text-blue-800">
                <p className="flex items-center gap-1.5 mb-1.5"><Info className="w-4 h-4"/>إعداد المواد:</p>
                <ul className="list-disc pr-5 space-y-0.5 font-medium text-blue-700">
                    <li>كل مادة لها فئة (عملي/شفوي/مهارات/بدنية/...)</li>
                    <li>الفئة تحدد اللون والأيقونة في الواجهة</li>
                    <li>المعلم يختار الفصل ثم المادة ثم يعلّم الغائبين</li>
                </ul>
            </div>

            {/* Add new subject */}
            <div className="bg-slate-50 rounded-xl border border-slate-200 p-3 space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input value={newSubject} onChange={e => setNewSubject(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && add()}
                        placeholder="اسم المادة (مثال: الفيزياء)"
                        className="border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold bg-white focus:outline-none focus:border-qatar-maroon"/>
                    <input value={newCategory} onChange={e => setNewCategory(e.target.value)} list="cats-list"
                        placeholder="الفئة (مثال: عملي)"
                        className="border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold bg-white focus:outline-none focus:border-qatar-maroon"/>
                    <datalist id="cats-list">
                        {usedCategories.map(c => <option key={c} value={c}/>)}
                    </datalist>
                </div>
                <button onClick={add} disabled={!newSubject.trim() || !newCategory.trim()}
                    className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-qatar-maroon text-white text-sm font-black hover:opacity-90 disabled:opacity-40">
                    <Plus className="w-4 h-4"/>إضافة مادة
                </button>
            </div>

            {/* Quick presets */}
            {list.length === 0 && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center justify-between gap-2 flex-wrap">
                    <p className="text-xs font-black text-emerald-800">قائمة جاهزة بناءً على وصفك:</p>
                    <button onClick={() => setList([
                        { subject: "الفيزياء", category: "عملي" },
                        { subject: "الكيمياء", category: "عملي" },
                        { subject: "الأحياء", category: "عملي" },
                        { subject: "الحاسوب", category: "عملي" },
                        { subject: "اللغة العربية", category: "شفوي" },
                        { subject: "اللغة الإنجليزية", category: "شفوي" },
                        { subject: "المهارات الحياتية", category: "مهارات حياتية" },
                        { subject: "التربية البدنية", category: "تربية بدنية" },
                    ])}
                        className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-emerald-500 text-white text-xs font-black hover:bg-emerald-600">
                        <Plus className="w-3.5 h-3.5"/>تحميل 8 مواد افتراضية
                    </button>
                </div>
            )}

            {/* List grouped by category */}
            {Object.keys(byCategory).length > 0 && (
                <div className="space-y-3">
                    {Object.entries(byCategory).map(([cat, items]) => {
                        const st = categoryStyle(cat);
                        const Icon = st.icon;
                        return (
                            <div key={cat} className="bg-white rounded-xl border-2 overflow-hidden" style={{ borderColor: st.color + "30" }}>
                                <div className="px-4 py-2 flex items-center justify-between" style={{ background: st.color + "10" }}>
                                    <span className="text-[10px] font-black px-2 py-0.5 rounded text-white" style={{ background: st.color }}>
                                        {items.length} مادة
                                    </span>
                                    <span className="font-black text-sm flex items-center gap-1.5" style={{ color: st.color }}>
                                        <Icon className="w-3.5 h-3.5"/>{cat}
                                    </span>
                                </div>
                                <div className="divide-y divide-slate-100">
                                    {items.map((s) => {
                                        const idx = list.findIndex(l => l.subject === s.subject);
                                        return (
                                            <div key={s.subject} className="flex items-center gap-2 p-3">
                                                <div className="flex flex-col gap-0.5">
                                                    <button onClick={() => move(idx, -1)} disabled={idx === 0}
                                                        className="text-[10px] text-slate-400 hover:text-slate-700 disabled:opacity-20">▲</button>
                                                    <button onClick={() => move(idx, 1)} disabled={idx === list.length - 1}
                                                        className="text-[10px] text-slate-400 hover:text-slate-700 disabled:opacity-20">▼</button>
                                                </div>
                                                <input value={s.category} onChange={e => changeCategory(s.subject, e.target.value)} list="cats-list"
                                                    className="w-28 border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold bg-white text-center"/>
                                                <span className="flex-1 text-sm font-black text-slate-700">{s.subject}</span>
                                                <button onClick={() => remove(s.subject)}
                                                    className="p-1.5 rounded-lg text-slate-300 hover:bg-rose-50 hover:text-rose-500">
                                                    <Trash2 className="w-3.5 h-3.5"/>
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            <button onClick={handleSave}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-qatar-maroon text-white font-black text-sm hover:opacity-90">
                {saved ? <><CheckCircle2 className="w-4 h-4"/>تم الحفظ</> : <><Save className="w-4 h-4"/>حفظ المواد ({list.length})</>}
            </button>
        </div>
    );
}

function TemplateEditor() {
    const settings = useQuery(api.practicalExams.getSettings) as any;
    const updateTemplate = useMutation(api.practicalExams.updateTemplate);

    const [template, setTemplate] = useState("");
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        if (settings) setTemplate(settings.template ?? "");
    }, [settings]);

    if (!settings) return <div className="flex justify-center py-10"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-qatar-maroon"/></div>;

    const handleSave = async () => {
        await updateTemplate({ template });
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    };

    const preview = template
        .replace(/{studentName}/g, "أحمد محمد")
        .replace(/{subject}/g, "الفيزياء")
        .replace(/{category}/g, "عملي")
        .replace(/{className}/g, "11-1")
        .replace(/{date}/g, "2026-05-10");

    return (
        <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-xs font-bold text-blue-800">
                <p className="flex items-center gap-1.5 mb-1.5"><Info className="w-4 h-4"/>المتغيرات المتاحة:</p>
                <div className="flex flex-wrap gap-1.5 mt-2">
                    {["{studentName}", "{subject}", "{category}", "{className}", "{date}"].map(v => (
                        <code key={v} onClick={() => setTemplate(t => t + " " + v)}
                            className="bg-white px-2 py-0.5 rounded border border-blue-300 text-blue-700 cursor-pointer hover:bg-blue-100">
                            {v}
                        </code>
                    ))}
                </div>
            </div>

            <div>
                <label className="block text-xs font-black text-slate-500 mb-1.5">قالب الرسالة</label>
                <textarea value={template} onChange={e => setTemplate(e.target.value)} rows={10}
                    className="w-full border-2 border-slate-100 rounded-xl px-4 py-3 text-sm font-bold bg-slate-50 focus:outline-none focus:border-qatar-maroon resize-none leading-relaxed"/>
            </div>

            <div>
                <label className="block text-xs font-black text-slate-500 mb-1.5">معاينة</label>
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-sm font-bold text-emerald-900 whitespace-pre-wrap leading-relaxed">
                    {preview}
                </div>
            </div>

            <button onClick={handleSave}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-qatar-maroon text-white font-black text-sm hover:opacity-90">
                {saved ? <><CheckCircle2 className="w-4 h-4"/>تم الحفظ</> : <><Save className="w-4 h-4"/>حفظ القالب</>}
            </button>
        </div>
    );
}
