import { useState } from "react";
import { Link } from "react-router-dom";
import { ExternalLink, ClipboardList, Plus, Search, Settings } from "lucide-react";
import { useQuery, useMutation, usePlatformSession } from "../lib/platformSession";
import { api } from "../../convex/_generated/api";
import { PageHeader } from "../components/ui";

const roles = [{ key: "teacher", label: "المعلمون" }, { key: "coordinator", label: "المنسقون" }, { key: "deputy", label: "النائب الأكاديمي" }];
const inputClass = "mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-qatar-maroon";
const empty = () => ({ title: "", url: "", description: "", audience: ["teacher", "coordinator", "deputy"], audienceLabel: "", category: "عام", academicYear: "2026-2027", order: 10, isActive: true });
const messageOf = (e: any) => typeof e?.data === "string" ? e.data : "تعذّر الحفظ. تحقق من الاتصال وحاول مجددًا.";

export default function TeacherTasks() {
    const tasks = useQuery((api as any).teacherTasks.list) as any[] | undefined;
    const user = usePlatformSession();
    const [search, setSearch] = useState("");
    const [category, setCategory] = useState("");
    const [year, setYear] = useState("");
    const categories = [...new Set((tasks ?? []).map(t => t.category))];
    const years = [...new Set((tasks ?? []).map(t => t.academicYear))].sort().reverse();
    const shown = (tasks ?? []).filter(t => (!category || t.category === category) && (!year || t.academicYear === year) && `${t.title} ${t.description} ${t.audienceLabel}`.includes(search.trim()));
    return <div className="max-w-6xl mx-auto space-y-5" dir="rtl">
        <PageHeader title="مهام المعلمين" subtitle="روابط المهام والنماذج المدرسية في مكان واحد" icon={<ClipboardList className="w-5 h-5"/>}>
            {(user?.role === "admin" || user?.role === "deputy") && <Link to="/settings?section=tasks" className="grades-header-note inline-flex items-center gap-2"><Settings className="w-4 h-4"/>إدارة المهام</Link>}
        </PageHeader>
        <div className="flex flex-wrap gap-3 items-end">
            <label className="flex-1 min-w-48 text-sm text-slate-700"><span className="inline-flex gap-1 items-center"><Search className="w-4 h-4"/>البحث عن مهمة</span><input className={inputClass} value={search} onChange={e => setSearch(e.target.value)} placeholder="اسم المهمة أو المطلوب"/></label>
            <label className="text-sm text-slate-700">التصنيف<select className={inputClass} value={category} onChange={e => setCategory(e.target.value)}><option value="">كل التصنيفات</option>{categories.map(c => <option key={c}>{c}</option>)}</select></label>
            <label className="text-sm text-slate-700">العام الدراسي<select className={inputClass} value={year} onChange={e => setYear(e.target.value)}><option value="">كل الأعوام</option>{years.map(y => <option key={y}>{y}</option>)}</select></label>
        </div>
        {!tasks ? <p role="status">جاري تحميل المهام…</p> : <>
            <p className="text-sm text-slate-600">{shown.length} مهمة متاحة · الروابط الخارجية تفتح في تبويب جديد، وقد تتطلب حساب الوزارة.</p>
            <div className="divide-y divide-slate-200 border border-slate-200 rounded-xl bg-white overflow-hidden">
                {shown.map(t => <article key={t._id} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="flex-1 min-w-0"><h2 className="font-bold text-slate-900">{t.title}</h2>
                        <p className="text-xs text-slate-600 mt-2">{t.category} · {t.academicYear} · {t.audienceLabel || roles.filter(r => t.audience.includes(r.key)).map(r => r.label).join("، ")}</p>
                        {t.description && <p className="text-sm text-slate-700 mt-2 whitespace-pre-wrap break-words">{t.description}</p>}
                    </div>
                    {t.url.startsWith("/") ? <Link className="px-4 py-2 text-sm rounded-lg bg-qatar-maroon text-white text-center shrink-0" to={t.url}>فتح القسم</Link>
                        : <a className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm rounded-lg bg-qatar-maroon text-white shrink-0" href={t.url} target="_blank" rel="noopener noreferrer" aria-label={`فتح ${t.title} في تبويب جديد`}>فتح المهمة<ExternalLink className="w-4 h-4"/></a>}
                </article>)}
                {shown.length === 0 && <p className="p-8 text-center text-slate-600">{search || category || year ? "لا توجد مهام تطابق البحث. جرّب تغيير الفلاتر." : "لا توجد مهام منشورة لصفتك حاليًا."}</p>}
            </div>
        </>}
    </div>;
}

export function TeacherTasksAdmin() {
    const tasks = useQuery((api as any).teacherTasks.manage) as any[] | undefined;
    const save = useMutation((api as any).teacherTasks.save);
    const setVisible = useMutation((api as any).teacherTasks.setVisible);
    const [editing, setEditing] = useState<any>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");
    const change = (key: string, value: any) => setEditing((old: any) => ({ ...old, [key]: value }));
    async function submit(e: React.FormEvent) {
        e.preventDefault(); if (busy) return;
        setBusy(true); setError(""); setNotice("");
        try { await save(editing); setEditing(null); setNotice("تم حفظ المهمة؛ التعديل يظهر للمستخدمين مباشرة."); }
        catch (e) { setError(messageOf(e)); } finally { setBusy(false); }
    }
    async function toggle(t: any) {
        setBusy(true); setError(""); setNotice("");
        try { await setVisible({ id: t._id, isActive: !t.isActive }); setNotice(t.isActive ? "تم إخفاء المهمة." : "تم إظهار المهمة."); }
        catch (e) { setError(messageOf(e)); } finally { setBusy(false); }
    }
    return <div className="space-y-4">
        <div className="flex flex-wrap justify-between items-center gap-3"><p className="text-sm text-slate-600">حدّد الرابط والفئة المستهدفة. المسؤول والنائب يستطيعان رؤية جميع المهام المنشورة.</p><button disabled={busy} className="inline-flex items-center gap-2 rounded-lg bg-qatar-maroon text-white px-4 py-2 text-sm" onClick={() => { setEditing(empty()); setError(""); setNotice(""); }}><Plus className="w-4 h-4"/>إضافة مهمة</button></div>
        {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
        {notice && <p role="status" className="text-sm text-emerald-800">{notice}</p>}
        {editing && <form onSubmit={submit} className="border border-slate-200 rounded-xl p-4 space-y-4 bg-white">
            <h3 className="font-bold text-qatar-maroon">{editing.id ? "تعديل المهمة" : "مهمة جديدة"}</h3>
            <fieldset disabled={busy} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="text-sm">اسم المهمة<input required maxLength={160} className={inputClass} value={editing.title} onChange={e => change("title", e.target.value)}/></label>
                <label className="text-sm">الرابط<input required maxLength={4000} dir="ltr" className={inputClass} value={editing.url} onChange={e => change("url", e.target.value)} placeholder="https://… أو /grades"/></label>
                <label className="text-sm sm:col-span-2">توضيح المطلوب (اختياري)<textarea maxLength={1000} className={inputClass} value={editing.description} onChange={e => change("description", e.target.value)}/></label>
                <label className="text-sm">التصنيف<input required maxLength={80} className={inputClass} value={editing.category} onChange={e => change("category", e.target.value)}/></label>
                <label className="text-sm">العام الدراسي<input required maxLength={40} className={inputClass} value={editing.academicYear} onChange={e => change("academicYear", e.target.value)}/></label>
                <div className="text-sm sm:col-span-2"><p className="mb-2">يظهر لمن؟</p><div className="flex flex-wrap gap-4">{roles.map(r => <label key={r.key} className="inline-flex gap-2 items-center"><input type="checkbox" checked={editing.audience.includes(r.key)} onChange={e => change("audience", e.target.checked ? [...editing.audience, r.key] : editing.audience.filter((x: string) => x !== r.key))}/>{r.label}</label>)}</div></div>
                <label className="text-sm">وصف المكلّفين (اختياري)<input maxLength={100} className={inputClass} value={editing.audienceLabel} onChange={e => change("audienceLabel", e.target.value)} placeholder="مثل: أعضاء اللجنة"/><span className="text-xs text-slate-600">وصف توضيحي؛ صلاحية العرض تتحدد بالاختيارات أعلاه.</span></label>
                <label className="text-sm">ترتيب العرض<input type="number" required min={0} max={9999} step={1} className={inputClass} value={editing.order} onChange={e => change("order", Number(e.target.value))}/></label>
                <label className="text-sm inline-flex gap-2 items-center"><input type="checkbox" checked={editing.isActive} onChange={e => change("isActive", e.target.checked)}/>إظهار المهمة للمستخدمين</label>
            </fieldset>
            <div className="flex gap-3"><button disabled={busy || !editing.audience.length} className="rounded-lg bg-qatar-maroon text-white px-4 py-2 text-sm disabled:opacity-50">{busy ? "جاري الحفظ…" : "حفظ المهمة"}</button><button type="button" disabled={busy} className="rounded-lg border border-slate-300 px-4 py-2 text-sm" onClick={() => { setEditing(null); setError(""); }}>إلغاء</button></div>
        </form>}
        {!tasks ? <p role="status">جاري التحميل…</p> : <div className="divide-y divide-slate-200 border border-slate-200 rounded-xl overflow-hidden bg-white">{tasks.map(t => <div key={t._id} className="p-4 flex flex-wrap items-center gap-3"><div className="flex-1 min-w-48"><p className="font-semibold">{t.title}</p><p className="text-xs text-slate-600 mt-1">{t.category} · {t.academicYear} · الترتيب {t.order} · {t.isActive ? "ظاهرة" : "مخفية"}</p></div><button disabled={busy} className="text-sm text-qatar-maroon border border-slate-300 rounded-lg px-3 py-2" onClick={() => { const { _id, _creationTime, schoolId, updatedAt, ...fields } = t; setEditing({ id: _id, ...fields }); setError(""); setNotice(""); }}>تعديل</button><button disabled={busy} className="text-sm text-slate-700 border border-slate-300 rounded-lg px-3 py-2" onClick={() => void toggle(t)}>{t.isActive ? "إخفاء" : "إظهار"}</button></div>)}{!tasks.length && <p className="p-6 text-center text-slate-600">أضف أول مهمة ليظهر رابطها في قسم مهام المعلمين.</p>}</div>}
    </div>;
}
