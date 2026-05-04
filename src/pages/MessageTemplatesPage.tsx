import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { MessageSquare, Save, RotateCcw, CheckCircle2, AlertCircle, Info } from "lucide-react";
// @ts-ignore
import { api } from "../../convex/_generated/api";

const PLACEHOLDERS = [
    { key: "{{studentName}}", desc: "اسم الطالب" },
    { key: "{{date}}",        desc: 'التاريخ (مثال: 2/03/2026)' },
    { key: "{{dayName}}",     desc: 'اسم اليوم (مثال: الاثنين)' },
    { key: "{{subjects}}",    desc: "المواد الغائب عنها" },
    { key: "{{schoolName}}", desc: "اسم المدرسة" },
    { key: "{{guardianName}}", desc: "اسم ولي الأمر (اختياري)" },
];

export default function MessageTemplatesPage() {
    return (
        <div className="max-w-4xl mx-auto space-y-8 font-sans animate-in fade-in duration-500 pb-20">
            <div className="rounded-2xl overflow-hidden qatar-card-shadow"
                 style={{ background: "linear-gradient(135deg, #5C1A1B 0%, #7A2425 50%, #5C1A1B 100%)" }}>
                <div className="flex items-center gap-4 p-6 sm:p-8">
                    <div className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center text-white flex-shrink-0 border border-white/20">
                        <MessageSquare className="w-5 h-5" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-white">إعدادات الرسائل</h1>
                        <p className="text-white/70 font-medium text-sm">تخصيص قوالب رسائل الحضور والغياب المرسلة لأولياء الأمور</p>
                    </div>
                </div>
            </div>

            {/* Placeholder reference */}
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-3">
                    <Info className="w-4 h-4 text-blue-600" />
                    <span className="font-black text-blue-700 text-sm">المتغيرات المتاحة للاستخدام في القوالب</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {PLACEHOLDERS.map(p => (
                        <div key={p.key} className="flex items-center gap-2 bg-white border border-blue-100 rounded-xl px-3 py-2">
                            <code className="text-[11px] font-black text-qatar-maroon bg-rose-50 px-1.5 py-0.5 rounded-lg dir-ltr">{p.key}</code>
                            <span className="text-[11px] text-slate-500 font-bold truncate">{p.desc}</span>
                        </div>
                    ))}
                </div>
            </div>

            <TemplateCard type="absent"  title="قالب رسالة الغياب"  color="rose" />
            <TemplateCard type="present" title="قالب رسالة الحضور" color="emerald" />
        </div>
    );
}

function TemplateCard({ type, title, color }: {
    type: "absent" | "present";
    title: string;
    color: "rose" | "emerald";
}) {
    const data      = useQuery(api.messages.getTemplates);
    const upsert    = useMutation(api.messages.upsertTemplate);

    const saved     = type === "absent" ? data?.absent : data?.present;
    const defBody   = type === "absent" ? data?.defaultAbsent : data?.defaultPresent;

    const [body, setBody]       = useState<string | null>(null);
    const [status, setStatus]   = useState<"idle" | "saving" | "saved" | "error">("idle");

    const currentBody = body !== null ? body : (saved?.body ?? defBody ?? "");

    const handleSave = async () => {
        setStatus("saving");
        try {
            await upsert({ type, body: currentBody });
            setBody(null);
            setStatus("saved");
            setTimeout(() => setStatus("idle"), 2500);
        } catch {
            setStatus("error");
            setTimeout(() => setStatus("idle"), 3000);
        }
    };

    const handleReset = () => {
        setBody(defBody ?? "");
    };

    const isDirty = body !== null && body !== (saved?.body ?? defBody);

    const headerColors = {
        rose:    "bg-gradient-to-l from-rose-700 to-qatar-maroon",
        emerald: "bg-gradient-to-l from-emerald-700 to-emerald-600",
    };

    return (
        <div className="bg-white rounded-2xl qatar-card-shadow border border-qatar-gray-border overflow-hidden">
            <div className={`${headerColors[color]} px-6 py-4 flex items-center justify-between`}>
                <h2 className="text-white font-black flex items-center gap-2">
                    <MessageSquare className="w-5 h-5 text-white/70" />
                    {title}
                </h2>
                {saved && (
                    <span className="bg-white/10 text-white/80 text-xs font-bold px-3 py-1 rounded-full border border-white/20">
                        محفوظ
                    </span>
                )}
            </div>

            <div className="p-5 sm:p-6 space-y-4">
                <textarea
                    value={currentBody}
                    onChange={e => setBody(e.target.value)}
                    rows={6}
                    dir="rtl"
                    placeholder="اكتب نص الرسالة هنا..."
                    className="w-full border-2 border-slate-200 rounded-xl px-4 py-3 font-bold text-slate-700 text-sm leading-relaxed outline-none resize-y focus:border-qatar-maroon transition-colors bg-slate-50 focus:bg-white"
                />

                {/* Live preview */}
                {currentBody && (
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">معاينة الرسالة</p>
                        <p className="text-sm text-slate-700 font-medium leading-relaxed whitespace-pre-wrap">
                            {currentBody
                                .replace(/\{\{studentName\}\}/g,  "محمد أحمد العمري")
                                .replace(/\{\{date\}\}/g,          "2/03/2026")
                                .replace(/\{\{dayName\}\}/g,        "الاثنين")
                                .replace(/\{\{subjects\}\}/g,       "رياضيات، فيزياء")
                                .replace(/\{\{schoolName\}\}/g,     "مدرسة ابن تيمية الثانوية للبنين")
                                .replace(/\{\{guardianName\}\}/g,   "")
                            }
                        </p>
                    </div>
                )}

                <div className="flex items-center gap-3 flex-wrap">
                    <button
                        onClick={handleSave}
                        disabled={status === "saving"}
                        className="flex items-center gap-2 bg-qatar-maroon text-white px-6 py-2.5 rounded-xl font-black text-sm hover:opacity-90 disabled:opacity-50 transition-all shadow-sm active:scale-95"
                    >
                        {status === "saving"
                            ? <div className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />
                            : <Save className="w-4 h-4" />
                        }
                        حفظ القالب
                    </button>

                    <button
                        onClick={handleReset}
                        className="flex items-center gap-2 bg-slate-100 text-slate-600 px-5 py-2.5 rounded-xl font-black text-sm hover:bg-slate-200 transition-all"
                    >
                        <RotateCcw className="w-4 h-4" />
                        استرجاع الافتراضي
                    </button>

                    {isDirty && (
                        <span className="text-xs font-black text-amber-600 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-full">
                            يوجد تغييرات غير محفوظة
                        </span>
                    )}

                    {status === "saved" && (
                        <span className="flex items-center gap-1.5 text-xs font-black text-emerald-700 animate-in fade-in">
                            <CheckCircle2 className="w-4 h-4" /> تم الحفظ بنجاح
                        </span>
                    )}
                    {status === "error" && (
                        <span className="flex items-center gap-1.5 text-xs font-black text-red-600 animate-in fade-in">
                            <AlertCircle className="w-4 h-4" /> حدث خطأ أثناء الحفظ
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
}
