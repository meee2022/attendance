import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import {
    Database,
    Trash2,
    AlertCircle,
    GraduationCap,
    Layers,
    BookOpen,
    Users,
    CheckCircle2
} from "lucide-react";
// @ts-ignore
import { api } from "../../convex/_generated/api";

export default function SeedPage() {
    const [msg, setMsg] = useState<string>("");
    const [classMsg, setClassMsg] = useState<string>("");
    const [loading, setLoading] = useState(false);
    const [classLoading, setClassLoading] = useState(false);

    // @ts-ignore
    const seedDatabase = useMutation(api.setup.seedDatabase);
    // @ts-ignore
    const ensureAllClasses = useMutation(api.setup.ensureAllClasses);
    // @ts-ignore
    const deleteDummy = useMutation(api.students.deleteDummyStudents);
    // @ts-ignore
    const data = useQuery(api.setup.getInitialData);

    const handleSeed = async () => {
        setLoading(true);
        try {
            const res = await seedDatabase();
            setMsg(res);
        } catch (error: any) {
            setMsg(error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleEnsureClasses = async () => {
        setClassLoading(true);
        try {
            const res = await ensureAllClasses();
            if (res.created === 0) {
                setClassMsg("✅ جميع الصفوف موجودة بالفعل - لا يحتاج إلى إضافة.");
            } else {
                setClassMsg(`✅ تم إنشاء ${res.created} صف جديد: ${res.createdNames.join("، ")}`);
            }
        } catch (error: any) {
            setClassMsg("❌ " + error.message);
        } finally {
            setClassLoading(false);
        }
    };

    // Group classes by grade for display
    const classesByGrade: Record<number, any[]> = {};
    data?.classes?.forEach((c: any) => {
        if (!classesByGrade[c.grade]) classesByGrade[c.grade] = [];
        classesByGrade[c.grade].push(c);
    });
    [10, 11, 12].forEach(g => {
        if (classesByGrade[g]) {
            classesByGrade[g].sort((a: any, b: any) => {
                const na = parseInt(a.name.split("-")[1] || "0", 10);
                const nb = parseInt(b.name.split("-")[1] || "0", 10);
                return na - nb;
            });
        }
    });

    if (!data) return (
        <div className="flex flex-col items-center justify-center min-h-[400px]">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-qatar-maroon"></div>
        </div>
    );

    return (
        <div className="max-w-6xl mx-auto space-y-10 font-sans transition-all animate-in fade-in duration-500 pb-20 mt-6">

            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-black text-slate-800 flex items-center gap-3">
                    <Database className="w-8 h-8 text-qatar-maroon" />
                    صيانة النظام والبيانات
                </h1>
                <p className="text-qatar-gray-text font-medium italic">إدارة البنية التحتية للمدرسة وتنظيف قواعد البيانات</p>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                    { label: "المدارس المسجلة", value: data.schools?.length || 0, icon: <Users className="w-5 h-5" />, maroon: true },
                    { label: "إجمالي الصفوف", value: data.classes?.length || 0, icon: <Layers className="w-5 h-5" /> },
                    { label: "المواد الدراسية", value: data.subjects?.length || 0, icon: <BookOpen className="w-5 h-5" /> },
                    { label: "إجمالي الطلاب", value: data.students?.length || 0, icon: <GraduationCap className="w-5 h-5" /> },
                ].map(card => (
                    <div key={card.label} className="bg-white p-6 rounded-2xl border border-qatar-gray-border qatar-card-shadow flex flex-col items-center text-center gap-3 transition-all hover:-translate-y-1 relative overflow-hidden group">
                        {card.maroon && <div className="absolute top-0 right-0 left-0 h-1 bg-qatar-maroon"></div>}
                        <div className={`p-3 rounded-xl ${card.maroon ? 'bg-qatar-maroon text-white' : 'bg-slate-100 text-slate-400 group-hover:bg-qatar-maroon/10 group-hover:text-qatar-maroon'} transition-colors`}>
                            {card.icon}
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{card.label}</p>
                            <p className="text-3xl font-black text-slate-800">{card.value}</p>
                        </div>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                {/* Ensure All Classes */}
                <div className="bg-white rounded-2xl qatar-card-shadow border border-qatar-gray-border overflow-hidden flex flex-col">
                    <div className="bg-slate-800 px-8 py-5 flex items-center justify-between">
                        <h2 className="text-lg font-black text-white">إعداد هيكل الصفوف</h2>
                        <Layers className="w-5 h-5 text-white/30" />
                    </div>
                    <div className="p-8 flex-grow flex flex-col gap-6">
                        <p className="text-sm text-slate-600 leading-relaxed font-medium">
                            سيقوم النظام بإنشاء جميع الصفوف الدراسية المطلوبة بشكل تلقائي (العاشر، الحادي عشر، الثاني عشر) مع الالتزام بالترقيم المعتمد في الدولة.
                        </p>
                        <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 space-y-2">
                            <div className="flex justify-between text-xs font-black">
                                <span className="text-slate-500">العاشر</span>
                                <span className="text-qatar-maroon">10-1 إلى 10-8</span>
                            </div>
                            <div className="flex justify-between text-xs font-black">
                                <span className="text-slate-500">الحادي عشر</span>
                                <span className="text-qatar-maroon">11-1 إلى 11-10</span>
                            </div>
                            <div className="flex justify-between text-xs font-black">
                                <span className="text-slate-500">الثاني عشر</span>
                                <span className="text-qatar-maroon">12-1 إلى 12-10</span>
                            </div>
                        </div>

                        <div className="mt-auto pt-4">
                            <button
                                onClick={handleEnsureClasses}
                                disabled={classLoading}
                                className="w-full bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-white font-black py-4 px-6 rounded-xl shadow-md transition-all active:scale-[0.98] flex items-center justify-center gap-3"
                            >
                                {classLoading ? (
                                    <div className="animate-spin w-5 h-5 border-2 border-white/20 border-t-white rounded-full"></div>
                                ) : <Layers className="w-5 h-5" />}
                                {classLoading ? "جاري الإنشاء..." : "تحديث هيكل الصفوف"}
                            </button>
                            {classMsg && (
                                <div className="mt-4 p-4 bg-emerald-50 text-emerald-800 rounded-xl border border-emerald-100 text-xs font-black animate-in fade-in">
                                    {classMsg}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Cleanup Section */}
                <div className="bg-white rounded-2xl qatar-card-shadow border border-qatar-gray-border overflow-hidden flex flex-col">
                    <div className="bg-qatar-maroon px-8 py-5 flex items-center justify-between">
                        <h2 className="text-lg font-black text-white">تنظيف بيانات التجربة</h2>
                        <Trash2 className="w-5 h-5 text-white/30" />
                    </div>
                    <div className="p-8 flex-grow flex flex-col gap-6">
                        <div className="bg-rose-50 border border-rose-100 p-5 rounded-2xl flex gap-4">
                            <AlertCircle className="w-6 h-6 text-rose-600 flex-shrink-0" />
                            <p className="text-sm text-rose-900 leading-relaxed font-black opacity-80">
                                تنبيه: هذا الإجراء سيقوم بحذف جميع الطلاب الوهميين وسجلاتهم. ابدأ باستيراد الطلاب الحقيقيين بعد هذه الخطوة.
                            </p>
                        </div>

                        <div className="mt-auto pt-4">
                            <button
                                onClick={async () => {
                                    if (!data?.schools?.[0]?._id) return;
                                    if (confirm("هل أنت متأكد من حذف الطلاب الوهميين؟")) {
                                        setLoading(true);
                                        try {
                                            const res = await deleteDummy({ schoolId: data.schools[0]._id });
                                            setMsg(`✅ تم حذف ${res.studentCount} طالب وهمي و ${res.attendanceCount} سجل بنجاح.`);
                                        } catch (e: any) {
                                            setMsg(`❌ خطأ: ${e.message}`);
                                        } finally {
                                            setLoading(false);
                                        }
                                    }
                                }}
                                disabled={loading}
                                className="w-full bg-qatar-maroon hover:bg-qatar-maroon-dark disabled:opacity-30 text-white font-black py-4 px-6 rounded-xl shadow-lg shadow-maroon-300/20 transition-all active:scale-[0.98] flex items-center justify-center gap-3"
                            >
                                {loading ? (
                                    <div className="animate-spin w-5 h-5 border-2 border-white/20 border-t-white rounded-full"></div>
                                ) : <Trash2 className="w-5 h-5" />}
                                {loading ? "جاري الحذف..." : "حذف كافة البيانات الوهمية"}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Class breakdown per grade */}
            {data?.classes && data.classes.length > 0 && (
                <div className="bg-white rounded-2xl qatar-card-shadow border border-qatar-gray-border overflow-hidden animate-in fade-in duration-700">
                    <div className="bg-slate-50 border-b border-qatar-gray-border px-8 py-5">
                        <h2 className="text-lg font-black text-slate-800">توزيع الصفوف والمجموعات الحالية</h2>
                    </div>
                    <div className="p-8 space-y-10">
                        {[10, 11, 12].map(grade => {
                            const gradeLabel = grade === 10 ? "العاشر" : grade === 11 ? "الحادي عشر" : "الثاني عشر";
                            const required = grade === 10 ? 8 : 10;
                            const existing = classesByGrade[grade] || [];
                            const percent = (existing.length / required) * 100;

                            return (
                                <div key={grade} className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-xl bg-qatar-maroon/5 border border-qatar-maroon/10 flex items-center justify-center text-qatar-maroon font-black">
                                                {grade}
                                            </div>
                                            <span className="font-black text-slate-800 text-lg">الصف {gradeLabel}</span>
                                        </div>
                                        <div className="flex flex-col items-end gap-1">
                                            <span className={`text-[10px] font-black uppercase tracking-widest ${percent >= 100 ? 'text-emerald-600' : 'text-amber-600'}`}>
                                                {existing.length} / {required} صف مكتمل
                                            </span>
                                            <div className="w-48 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full transition-all duration-1000 ${percent >= 100 ? 'bg-emerald-500' : 'bg-amber-500'}`}
                                                    style={{ width: `${Math.min(percent, 100)}%` }}
                                                ></div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                                        {existing.map((c: any) => (
                                            <div key={c._id} className="bg-qatar-gray-bg border border-qatar-gray-border px-4 py-3 rounded-xl flex flex-col items-center gap-1 group hover:border-qatar-maroon transition-colors">
                                                <span className="text-sm font-black text-slate-700 group-hover:text-qatar-maroon">{c.name}</span>
                                                <span className="text-[10px] font-bold text-slate-400 italic">
                                                    {data.students?.filter((s: any) => s.classId === c._id).length || 0} طالب
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Seed test data (bottom, less prominent) */}
            <div className="p-8 border-2 border-dashed border-qatar-gray-border rounded-2xl flex flex-col md:flex-row items-center justify-between gap-6 opacity-60 hover:opacity-100 transition-opacity">
                <div className="flex items-center gap-4 text-slate-500">
                    <Database className="w-8 h-8" />
                    <div>
                        <h4 className="font-black">مختبر البيانات (Sandbox)</h4>
                        <p className="text-xs font-medium">هذا الزر مخصص للمطورين فقط لإنشاء بيئة تجريبية متكاملة بضغطة واحدة</p>
                    </div>
                </div>
                <button
                    onClick={handleSeed}
                    disabled={loading}
                    className="bg-white border border-slate-300 text-slate-600 hover:bg-slate-50 font-black py-3 px-8 rounded-xl transition-all active:scale-[0.98] disabled:opacity-30"
                >
                    {loading ? "جاري التحميل..." : "بدء التهيئة التجريبية الكاملة"}
                </button>
            </div>

            {msg && (
                <div className="fixed bottom-10 left-10 max-w-md bg-slate-900 text-white p-6 rounded-2xl shadow-2xl border border-white/10 animate-in slide-in-from-left-10 duration-500 flex items-start gap-4 z-50">
                    <CheckCircle2 className="w-6 h-6 text-emerald-400 flex-shrink-0" />
                    <div>
                        <p className="text-sm font-black leading-relaxed">{msg}</p>
                        <button onClick={() => setMsg("")} className="mt-3 text-[10px] uppercase font-black tracking-widest text-slate-400 hover:text-white transition-colors">إغلاق التنبيه</button>
                    </div>
                </div>
            )}
        </div>
    );
}
