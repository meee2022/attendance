import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Database, Trash2, AlertCircle, GraduationCap, Layers, BookOpen, Users, CheckCircle2 } from "lucide-react";
// @ts-ignore
import { api } from "../../convex/_generated/api";
import StatCard from "../components/StatCard";

export default function SeedPage() {
    const [msg, setMsg] = useState<string>("");
    const [classMsg, setClassMsg] = useState<string>("");
    const [classLoading, setClassLoading] = useState(false);
    const [loading, setLoading] = useState(false);
    const [deleteAllConfirm, setDeleteAllConfirm] = useState(false);

    // @ts-ignore
    const ensureAllClasses = useMutation(api.setup.ensureAllClasses);
    // @ts-ignore
    const deleteAll = useMutation(api.students.deleteAllStudentsAndAttendance);
    // @ts-ignore
    const data = useQuery(api.setup.getInitialData);
    // @ts-ignore
    const counts = useQuery(api.setup.getStudentCounts);

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

    const handleDeleteAll = async () => {
        if (!data?.schools?.[0]?._id) return;
        setLoading(true);
        try {
            const res = await deleteAll({ schoolId: data.schools[0]._id });
            setMsg(`✅ تم حذف ${res.students} طالب و ${res.periods} حصة و ${res.attendance} سجل حضور بنجاح.`);
            setDeleteAllConfirm(false);
        } catch (e: any) {
            setMsg(`❌ خطأ: ${e.message}`);
        } finally {
            setLoading(false);
        }
    };

    if (!data) return (
        <div className="flex flex-col items-center justify-center min-h-[400px]">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-qatar-maroon"></div>
        </div>
    );

    return (
        <div className="max-w-6xl mx-auto space-y-10 font-sans transition-all animate-in fade-in duration-500 pb-20 mt-6">

            <div className="rounded-2xl overflow-hidden qatar-card-shadow"
                 style={{ background: "linear-gradient(135deg, #9B1239 0%, #C0184C 50%, #9B1239 100%)" }}>
                <div className="flex flex-col gap-1 p-5 sm:p-8">
                    <h1 className="text-3xl font-black text-white flex items-center gap-3">
                        <Database className="w-8 h-8 text-white/80" />
                        صيانة النظام والبيانات
                    </h1>
                    <p className="text-white/70 font-medium mr-11">إدارة البنية التحتية للمدرسة وتنظيف قواعد البيانات</p>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard label="المدارس المسجلة" value={data.schools?.length || 0} icon={<Users className="w-6 h-6" />} color="maroon" />
                <StatCard label="إجمالي الصفوف" value={data.classes?.length || 0} icon={<Layers className="w-6 h-6" />} color="blue" />
                <StatCard label="المواد الدراسية" value={data.subjects?.length || 0} icon={<BookOpen className="w-6 h-6" />} color="teal" />
                <StatCard label="إجمالي الطلاب" value={counts?.total ?? "..."} icon={<GraduationCap className="w-6 h-6" />} color="amber" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                {/* Ensure Classes */}
                <div className="bg-white rounded-2xl qatar-card-shadow border border-qatar-gray-border overflow-hidden flex flex-col">
                    <div className="px-8 py-5 flex items-center justify-between"
                         style={{ background: "linear-gradient(135deg, #9B1239 0%, #C0184C 60%, #9B1239 100%)" }}>
                        <h2 className="text-lg font-black text-white">إعداد هيكل الصفوف</h2>
                        <Layers className="w-5 h-5 text-white/30" />
                    </div>
                    <div className="p-8 flex-grow flex flex-col gap-6">
                        <p className="text-sm text-slate-600 leading-relaxed font-medium">
                            سيقوم النظام بإنشاء جميع الصفوف الدراسية المطلوبة تلقائياً مع الالتزام بالترقيم المعتمد.
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
                                className="w-full disabled:opacity-30 text-white font-black py-4 px-6 rounded-xl shadow-md transition-all active:scale-[0.98] flex items-center justify-center gap-3"
                                style={{ background: "linear-gradient(135deg, #9B1239 0%, #C0184C 60%, #9B1239 100%)" }}
                            >
                                {classLoading ? <div className="animate-spin w-5 h-5 border-2 border-white/20 border-t-white rounded-full"></div> : <Layers className="w-5 h-5" />}
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

                {/* Delete ALL */}
                <div className="bg-white rounded-2xl qatar-card-shadow border-2 border-red-200 overflow-hidden flex flex-col">
                    <div className="bg-red-600 px-8 py-5 flex items-center justify-between">
                        <h2 className="text-lg font-black text-white">حذف جميع بيانات الطلاب</h2>
                        <Trash2 className="w-5 h-5 text-white/50" />
                    </div>
                    <div className="p-8 flex-grow flex flex-col gap-6">
                        <div className="bg-red-50 border border-red-200 p-5 rounded-2xl flex gap-4">
                            <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
                            <div className="space-y-1">
                                <p className="text-sm text-red-900 font-black">تحذير: هذا الإجراء لا يمكن التراجع عنه</p>
                                <p className="text-xs text-red-700 font-medium leading-relaxed">
                                    سيتم حذف جميع الطلاب وجميع سجلات الحضور والحصص المسجلة. استخدم هذا الزر لمسح البيانات التجريبية قبل إدخال بيانات الطلاب الحقيقيين.
                                </p>
                            </div>
                        </div>

                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex justify-between items-center">
                            <span className="text-sm font-black text-slate-600">عدد الطلاب الحالي</span>
                            <span className="text-2xl font-black text-red-700">{counts?.total ?? "..."}</span>
                        </div>

                        <div className="mt-auto pt-2">
                            {!deleteAllConfirm ? (
                                <button
                                    onClick={() => setDeleteAllConfirm(true)}
                                    disabled={loading || !counts?.total}
                                    className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-30 text-white font-black py-4 px-6 rounded-xl shadow-lg transition-all active:scale-[0.98] flex items-center justify-center gap-3"
                                >
                                    <Trash2 className="w-5 h-5" />
                                    حذف جميع الطلاب والسجلات
                                </button>
                            ) : (
                                <div className="space-y-3">
                                    <p className="text-center text-sm font-black text-red-700">هل أنت متأكد تماماً؟ لا يمكن التراجع</p>
                                    <div className="flex gap-3">
                                        <button
                                            onClick={handleDeleteAll}
                                            disabled={loading}
                                            className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-black py-3 rounded-xl transition-all flex items-center justify-center gap-2"
                                        >
                                            {loading ? <div className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full"></div> : <Trash2 className="w-4 h-4" />}
                                            {loading ? "جاري الحذف..." : "نعم، احذف الكل"}
                                        </button>
                                        <button
                                            onClick={() => setDeleteAllConfirm(false)}
                                            className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black py-3 rounded-xl transition-all"
                                        >
                                            إلغاء
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Class breakdown */}
            {data?.classes && data.classes.length > 0 && (
                <div className="bg-white rounded-2xl qatar-card-shadow border border-qatar-gray-border overflow-hidden">
                    <div className="px-8 py-5 border-b border-qatar-gray-border flex items-center justify-between"
                         style={{ background: "linear-gradient(135deg, #9B1239 0%, #C0184C 60%, #9B1239 100%)" }}>
                        <h2 className="text-lg font-black text-white">توزيع الصفوف الحالية</h2>
                        <span className="text-white/70 text-sm font-bold">{data.classes.length} صف</span>
                    </div>
                    <div className="p-6 sm:p-8 space-y-8">
                        {[10, 11, 12].map(grade => {
                            const gradeLabel = grade === 10 ? "العاشر" : grade === 11 ? "الحادي عشر" : "الثاني عشر";
                            const required = grade === 10 ? 8 : 10;
                            const existing = (data.classes || [])
                                .filter((c: any) => c.grade === grade)
                                .sort((a: any, b: any) => parseInt(a.name.split("-")[1]||"0") - parseInt(b.name.split("-")[1]||"0"));
                            const percent = (existing.length / required) * 100;
                            const gradeTotal = existing.reduce((sum: number, c: any) => sum + (counts?.perClass?.[c._id] ?? 0), 0);

                            const GRADE_COLORS: Record<number, { bar: string; badge: string; num: string; bg: string }> = {
                                10: { bar: "bg-qatar-maroon",  badge: "bg-rose-100 text-qatar-maroon border-qatar-maroon/20",  num: "text-qatar-maroon",  bg: "bg-rose-50/40 border-qatar-maroon/20 hover:border-qatar-maroon/50" },
                                11: { bar: "bg-blue-600",      badge: "bg-blue-100 text-blue-700 border-blue-200",             num: "text-blue-700",      bg: "bg-blue-50/40 border-blue-200 hover:border-blue-400" },
                                12: { bar: "bg-amber-500",     badge: "bg-amber-100 text-amber-700 border-amber-200",          num: "text-amber-700",     bg: "bg-amber-50/40 border-amber-200 hover:border-amber-400" },
                            };
                            const gc = GRADE_COLORS[grade];

                            return (
                                <div key={grade} className="space-y-4">
                                    {/* Grade header row */}
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-10 h-10 rounded-xl ${gc.bar} flex items-center justify-center text-white font-black text-sm shadow-sm`}>{grade}</div>
                                            <div>
                                                <span className="font-black text-slate-800 text-base">الصف {gradeLabel}</span>
                                                <span className={`mr-2 text-xs font-black px-2 py-0.5 rounded-full border ${gc.badge}`}>
                                                    {gradeTotal} طالب إجمالاً
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex flex-col items-end gap-1">
                                            <span className={`text-[10px] font-black uppercase tracking-widest ${percent >= 100 ? 'text-emerald-600' : 'text-amber-600'}`}>
                                                {existing.length} / {required} صف
                                            </span>
                                            <div className="w-40 h-2 bg-slate-100 rounded-full overflow-hidden">
                                                <div className={`h-full transition-all duration-1000 ${percent >= 100 ? 'bg-emerald-500' : 'bg-amber-500'}`} style={{ width: `${Math.min(percent, 100)}%` }}></div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Class cards grid */}
                                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                                        {existing.map((c: any) => {
                                            const count = counts?.perClass?.[c._id] ?? 0;
                                            return (
                                                <div key={c._id} className={`relative overflow-hidden rounded-xl border transition-all cursor-default ${gc.bg} flex`}>
                                                    {/* Side bar */}
                                                    <div className={`w-1 flex-shrink-0 ${gc.bar}`} />
                                                    {/* Content */}
                                                    <div className="flex flex-col items-center justify-center gap-0.5 py-3 flex-1">
                                                        <span className={`text-base font-black ${gc.num}`}>{c.name}</span>
                                                        <span className="text-xs font-bold text-slate-500">{count} طالب</span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {msg && (
                <div className="fixed bottom-10 left-10 max-w-md bg-slate-900 text-white p-6 rounded-2xl shadow-2xl border border-white/10 animate-in slide-in-from-left-10 duration-500 flex items-start gap-4 z-50">
                    <CheckCircle2 className="w-6 h-6 text-emerald-400 flex-shrink-0" />
                    <div>
                        <p className="text-sm font-black leading-relaxed">{msg}</p>
                        <button onClick={() => setMsg("")} className="mt-3 text-[10px] uppercase font-black tracking-widest text-slate-400 hover:text-white transition-colors">إغلاق</button>
                    </div>
                </div>
            )}
        </div>
    );
}
