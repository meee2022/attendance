import { useState, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
// @ts-ignore
import { api } from "../../convex/_generated/api";
import { Settings, BookOpen, Layers, Plus, Trash2, Pencil, Check, X, Hash, CalendarDays, Lock, KeyRound, Eye, EyeOff, ShieldAlert, Users, Database, MessagesSquare, ClipboardList, BarChart3, ClipboardCheck, GraduationCap } from "lucide-react";
import ImportStudents from "./ImportStudents";
import MessageTemplatesPage from "./MessageTemplatesPage";
import SeedPage from "./SeedPage";
import { ManageTab, AnalyticsTab } from "./SurveysPage";
import type { Survey } from "./SurveysPage";
import SupervisionAdmin from "./SupervisionAdmin";
import GradesAdmin from "./GradesAdmin";

const TRACKS = ["عام", "علمي", "أدبي", "تكنولوجي"];
const GRADE_LABELS: Record<number, string> = { 10: "عاشر", 11: "حادي عشر", 12: "ثاني عشر" };
const TRACK_COLORS: Record<string, string> = {
    "علمي": "bg-blue-100 text-blue-800 border-blue-200",
    "أدبي": "bg-amber-100 text-amber-800 border-amber-200",
    "تكنولوجي": "bg-purple-100 text-purple-800 border-purple-200",
    "عام": "bg-slate-100 text-slate-700 border-slate-200",
};

type MainTab = "settings" | "students" | "messages" | "seed" | "surveys" | "supervision" | "grades";

export default function SettingsPage() {
    const [mainTab, setMainTab] = useState<MainTab>("settings");
    const [activeTab, setActiveTab] = useState<"classes" | "subjects">("classes");

    const MAIN_TABS: { id: MainTab; label: string; icon: React.ReactNode }[] = [
        { id: "settings",  label: "الإعدادات العامة",  icon: <Settings className="w-4 h-4" /> },
        { id: "students",  label: "بيانات الطلاب",     icon: <Users className="w-4 h-4" /> },
        { id: "messages",  label: "إعدادات الرسائل",   icon: <MessagesSquare className="w-4 h-4" /> },
        { id: "surveys",   label: "الاستبانات",         icon: <ClipboardList className="w-4 h-4" /> },
        { id: "supervision", label: "الإشراف الصفي",   icon: <ClipboardCheck className="w-4 h-4" /> },
        { id: "grades",    label: "إدارة الدرجات",     icon: <GraduationCap className="w-4 h-4" /> },
        { id: "seed",      label: "تهيئة البيانات",    icon: <Database className="w-4 h-4" /> },
    ];

    return (
        <div className="max-w-5xl mx-auto space-y-6 font-sans animate-in fade-in duration-500 pb-20">
            {/* Page Header */}
            <div className="rounded-2xl overflow-hidden qatar-card-shadow"
                 style={{ background: "linear-gradient(135deg, #5C1A1B 0%, #7A2425 50%, #5C1A1B 100%)" }}>
                <div className="flex items-center gap-4 p-6 sm:p-8">
                    <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center text-white border border-white/20">
                        <Settings className="w-6 h-6" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-white">إعدادات النظام</h1>
                        <p className="text-white/70 font-medium text-sm">إدارة الإعدادات وبيانات الطلاب والرسائل وتهيئة النظام</p>
                    </div>
                </div>
                {/* Main Tab Bar inside header */}
                <div className="flex gap-1 px-4 pb-3 overflow-x-auto">
                    {MAIN_TABS.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setMainTab(tab.id)}
                            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-black whitespace-nowrap transition-all ${
                                mainTab === tab.id
                                    ? "bg-white text-qatar-maroon shadow-sm"
                                    : "text-white/80 hover:bg-white/15 hover:text-white"
                            }`}
                        >
                            {tab.icon}
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Tab Content */}
            {mainTab === "settings" && (
                <div className="space-y-8">
                    <GeneralSettings />
                    <PinSettings />
                    <div className="flex gap-2">
                        <TabButton active={activeTab === "classes"} onClick={() => setActiveTab("classes")} icon={<Layers className="w-4 h-4" />} label="الصفوف الدراسية" />
                        <TabButton active={activeTab === "subjects"} onClick={() => setActiveTab("subjects")} icon={<BookOpen className="w-4 h-4" />} label="المواد الدراسية" />
                    </div>
                    {activeTab === "classes" ? <ClassesSection /> : <SubjectsSection />}
                </div>
            )}

            {mainTab === "students" && <ImportStudents />}
            {mainTab === "messages" && <MessageTemplatesPage />}
            {mainTab === "surveys"  && <SurveysAdminSection />}
            {mainTab === "supervision" && <SupervisionAdmin />}
            {mainTab === "grades"   && <GradesAdmin />}
            {mainTab === "seed"     && <SeedPage />}
        </div>
    );
}

function SurveysAdminSection() {
    const survey = useQuery(api.surveys.getActiveSurvey) as Survey | null | undefined;
    const [adminTab, setAdminTab] = useState<"manage" | "analytics">("manage");

    if (survey === undefined) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-qatar-maroon"/>
            </div>
        );
    }

    if (!survey) {
        return (
            <div className="bg-white rounded-2xl border border-qatar-gray-border qatar-card-shadow flex flex-col items-center py-16 gap-4">
                <ClipboardList className="w-10 h-10 text-slate-300"/>
                <p className="font-black text-slate-500">لا توجد استبانة نشطة</p>
                <p className="text-xs text-slate-400 font-bold">يمكن إنشاؤها من صفحة الاستبانات</p>
            </div>
        );
    }

    return (
        <div className="space-y-5">
            <div className="bg-white rounded-2xl border border-qatar-gray-border qatar-card-shadow overflow-hidden">
                <div className="bg-slate-700 px-5 py-3 flex items-center justify-between">
                    <div className="flex gap-2">
                        <button onClick={() => setAdminTab("manage")}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black transition-all ${adminTab === "manage" ? "bg-white text-slate-700 shadow" : "bg-white/10 text-white hover:bg-white/20"}`}>
                            <Users className="w-3.5 h-3.5"/>المعلمون
                        </button>
                        <button onClick={() => setAdminTab("analytics")}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black transition-all ${adminTab === "analytics" ? "bg-white text-slate-700 shadow" : "bg-white/10 text-white hover:bg-white/20"}`}>
                            <BarChart3 className="w-3.5 h-3.5"/>التحليل
                        </button>
                    </div>
                    <span className="font-black text-white text-sm flex items-center gap-2">
                        <ClipboardList className="w-4 h-4 text-white/60"/>إدارة الاستبانات
                    </span>
                </div>
                <div className="p-5">
                    {adminTab === "manage"    && <ManageTab survey={survey}/>}
                    {adminTab === "analytics" && <AnalyticsTab survey={survey}/>}
                </div>
            </div>
        </div>
    );
}

function GeneralSettings() {
    const data = useQuery(api.setup.getInitialData);
    const updatePeriodsPerDay          = useMutation(api.settings.updatePeriodsPerDay);
    const updateCurrentDate            = useMutation(api.settings.updateCurrentDate);
    const updateDailyAbsenceThreshold  = useMutation(api.settings.updateDailyAbsenceThreshold);

    const school = data?.schools?.[0];

    // Periods state
    const currentPeriods = school?.periodsPerDay ?? 5;
    const [periodsVal, setPeriodsVal] = useState<number | null>(null);
    const [periodsSaved, setPeriodsSaved] = useState(false);

    // Date state
    const todayISO = new Date().toISOString().split("T")[0];
    const currentDate = school?.currentDate ?? todayISO;
    const [dateVal, setDateVal] = useState<string | null>(null);
    const [dateSaved, setDateSaved] = useState(false);

    // Absence threshold state
    const currentThreshold = school?.dailyAbsenceThreshold ?? 0;
    const [thresholdVal, setThresholdVal] = useState<number | null>(null);
    const [thresholdSaved, setThresholdSaved] = useState(false);

    const displayPeriods   = periodsVal   !== null ? periodsVal   : currentPeriods;
    const displayDate      = dateVal      !== null ? dateVal      : currentDate;
    const displayThreshold = thresholdVal !== null ? thresholdVal : currentThreshold;

    const handleSavePeriods = async () => {
        await updatePeriodsPerDay({ periodsPerDay: displayPeriods });
        setPeriodsVal(null);
        setPeriodsSaved(true);
        setTimeout(() => setPeriodsSaved(false), 2500);
    };

    const handleSaveDate = async () => {
        await updateCurrentDate({ date: displayDate });
        setDateVal(null);
        setDateSaved(true);
        setTimeout(() => setDateSaved(false), 2500);
    };

    const handleSaveThreshold = async () => {
        await updateDailyAbsenceThreshold({ threshold: displayThreshold });
        setThresholdVal(null);
        setThresholdSaved(true);
        setTimeout(() => setThresholdSaved(false), 2500);
    };

    return (
        <div className="bg-white rounded-2xl qatar-card-shadow border border-qatar-gray-border p-6">
            <h3 className="font-black text-slate-700 mb-6 flex items-center gap-2 border-b border-qatar-gray-border pb-4">
                <Settings className="w-4 h-4 text-qatar-maroon" />
                الإعدادات العامة
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">

                {/* ── Locked Date ── */}
                <div className="rounded-2xl border-2 border-qatar-maroon/30 bg-rose-50/40 p-5 space-y-4">
                    <div className="flex items-center gap-2">
                        <div className="w-9 h-9 rounded-xl bg-qatar-maroon text-white flex items-center justify-center flex-shrink-0">
                            <CalendarDays className="w-4 h-4" />
                        </div>
                        <div>
                            <p className="font-black text-qatar-maroon text-sm">تاريخ اليوم الدراسي</p>
                            <p className="text-[11px] text-slate-400 font-medium">يُطبَّق على جميع صفحات الرفع ولا يمكن تعديله من قِبَل المعلمين</p>
                        </div>
                        <div className="mr-auto flex items-center gap-1 bg-qatar-maroon/10 text-qatar-maroon text-[10px] font-black px-2 py-1 rounded-full border border-qatar-maroon/20">
                            <Lock className="w-3 h-3" />
                            مقفول
                        </div>
                    </div>

                    <input
                        type="date"
                        value={displayDate}
                        onChange={e => setDateVal(e.target.value)}
                        className="w-full border-2 border-qatar-maroon/20 rounded-xl px-4 py-3 font-black text-slate-700 bg-white outline-none focus:border-qatar-maroon text-center text-lg tracking-wider"
                    />

                    <div className="flex items-center gap-3">
                        <button
                            onClick={handleSaveDate}
                            disabled={dateVal === null}
                            className="flex items-center gap-2 bg-qatar-maroon text-white px-5 py-2.5 rounded-xl font-black hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed text-sm"
                        >
                            <Check className="w-4 h-4" />
                            حفظ التاريخ وتثبيته
                        </button>
                        {dateSaved && (
                            <span className="flex items-center gap-1 text-emerald-600 font-black text-sm animate-in fade-in">
                                <Check className="w-4 h-4" /> تم التثبيت
                            </span>
                        )}
                    </div>
                </div>

                {/* ── Periods Per Day ── */}
                <div className="rounded-2xl border-2 border-amber-300 bg-amber-50/40 p-5 space-y-4">
                    <div className="flex items-center gap-2">
                        <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center flex-shrink-0">
                            <Hash className="w-4 h-4" />
                        </div>
                        <div>
                            <p className="font-black text-amber-700 text-sm">عدد حصص اليوم الدراسي</p>
                            <p className="text-[11px] text-slate-400 font-medium">يُحدِّد عدد أعمدة الحصص في جدول الرصد وقائمة الاختيار</p>
                        </div>
                    </div>

                    <input
                        type="number"
                        min={1}
                        max={10}
                        value={displayPeriods}
                        onChange={e => setPeriodsVal(Math.max(1, Math.min(10, Number(e.target.value))))}
                        className="w-full border-2 border-amber-300 rounded-xl px-4 py-3 font-black text-slate-700 bg-white outline-none focus:border-amber-500 text-center text-3xl tracking-wider"
                    />

                    <div className="flex items-center gap-3">
                        <button
                            onClick={handleSavePeriods}
                            disabled={periodsVal === null}
                            className="flex items-center gap-2 bg-amber-500 text-white px-5 py-2.5 rounded-xl font-black hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed text-sm"
                        >
                            <Check className="w-4 h-4" />
                            حفظ العدد
                        </button>
                        {periodsSaved && (
                            <span className="flex items-center gap-1 text-emerald-600 font-black text-sm animate-in fade-in">
                                <Check className="w-4 h-4" /> تم الحفظ
                            </span>
                        )}
                    </div>
                </div>

                {/* ── Daily Absence Threshold ── */}
                <div className="rounded-2xl border-2 border-blue-300 bg-blue-50/40 p-5 space-y-4">
                    <div className="flex items-center gap-2">
                        <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center flex-shrink-0">
                            <ShieldAlert className="w-4 h-4" />
                        </div>
                        <div>
                            <p className="font-black text-blue-700 text-sm">عتبة الغياب اليومي</p>
                            <p className="text-[11px] text-slate-400 font-medium">أقصى عدد حصص يغيبها الطالب ويظل يُعتبر حاضرًا في اليوم</p>
                        </div>
                    </div>

                    <input
                        type="number"
                        min={0}
                        max={currentPeriods}
                        value={displayThreshold}
                        onChange={e => setThresholdVal(Math.max(0, Math.min(currentPeriods, Number(e.target.value))))}
                        className="w-full border-2 border-blue-300 rounded-xl px-4 py-3 font-black text-slate-700 bg-white outline-none focus:border-blue-500 text-center text-3xl tracking-wider"
                    />

                    {/* Contextual explanation */}
                    <p className="text-[11px] text-slate-500 font-bold bg-white rounded-lg px-3 py-2 border border-blue-100">
                        {displayThreshold === 0
                            ? "أي غياب في أي حصة = غائب لليوم"
                            : `الغياب في ${displayThreshold} حصة أو أقل = حاضر — الغياب في ${displayThreshold + 1} حصة أو أكثر = غائب`
                        }
                    </p>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={handleSaveThreshold}
                            disabled={thresholdVal === null}
                            className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-xl font-black hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed text-sm"
                        >
                            <Check className="w-4 h-4" />
                            حفظ العتبة
                        </button>
                        {thresholdSaved && (
                            <span className="flex items-center gap-1 text-emerald-600 font-black text-sm animate-in fade-in">
                                <Check className="w-4 h-4" /> تم الحفظ
                            </span>
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
}

function PinSettings() {
    const updateAdminPin = useMutation(api.settings.updateAdminPin);
    const [current, setCurrent] = useState("");
    const [next, setNext]       = useState("");
    const [confirm, setConfirm] = useState("");
    const [showCurrent, setShowCurrent] = useState(false);
    const [showNext, setShowNext]       = useState(false);
    const [msg, setMsg]   = useState<{ text: string; ok: boolean } | null>(null);
    const [loading, setLoading] = useState(false);

    const digits = (v: string) => v.replace(/\D/g, "").slice(0, 8);

    const handleSave = async () => {
        if (next.length < 4) { setMsg({ text: "الرمز الجديد يجب أن يكون 4 أرقام على الأقل.", ok: false }); return; }
        if (next !== confirm) { setMsg({ text: "الرمز الجديد وتأكيده غير متطابقين.", ok: false }); return; }
        setLoading(true);
        setMsg(null);
        try {
            await updateAdminPin({ currentPin: current, newPin: next });
            setMsg({ text: "تم تغيير رمز الدخول بنجاح.", ok: true });
            setCurrent(""); setNext(""); setConfirm("");
        } catch (e: any) {
            setMsg({ text: e.message, ok: false });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-white rounded-2xl qatar-card-shadow border border-qatar-gray-border p-6">
            <h3 className="font-black text-slate-700 mb-6 flex items-center gap-2 border-b border-qatar-gray-border pb-4">
                <KeyRound className="w-4 h-4 text-qatar-maroon" />
                تغيير رمز دخول المسؤول
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl">
                {/* Current PIN */}
                <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-black text-slate-500">الرمز الحالي</label>
                    <div className="relative">
                        <input
                            type={showCurrent ? "text" : "password"}
                            value={current}
                            onChange={e => setCurrent(digits(e.target.value))}
                            placeholder="••••"
                            className="w-full border-2 border-slate-200 rounded-xl px-4 py-2.5 font-black text-center tracking-widest outline-none focus:border-qatar-maroon text-slate-700 bg-slate-50"
                            dir="ltr"
                        />
                        <button type="button" onClick={() => setShowCurrent(v => !v)} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                            {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                    </div>
                </div>
                {/* New PIN */}
                <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-black text-slate-500">الرمز الجديد</label>
                    <div className="relative">
                        <input
                            type={showNext ? "text" : "password"}
                            value={next}
                            onChange={e => setNext(digits(e.target.value))}
                            placeholder="••••"
                            className="w-full border-2 border-slate-200 rounded-xl px-4 py-2.5 font-black text-center tracking-widest outline-none focus:border-qatar-maroon text-slate-700 bg-slate-50"
                            dir="ltr"
                        />
                        <button type="button" onClick={() => setShowNext(v => !v)} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                            {showNext ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                    </div>
                </div>
                {/* Confirm PIN */}
                <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-black text-slate-500">تأكيد الرمز الجديد</label>
                    <input
                        type="password"
                        value={confirm}
                        onChange={e => setConfirm(digits(e.target.value))}
                        placeholder="••••"
                        className={`w-full border-2 rounded-xl px-4 py-2.5 font-black text-center tracking-widest outline-none text-slate-700 bg-slate-50 ${
                            confirm && next && confirm !== next ? "border-red-400" : "border-slate-200 focus:border-qatar-maroon"
                        }`}
                        dir="ltr"
                    />
                </div>
            </div>

            <div className="flex items-center gap-4 mt-5">
                <button
                    onClick={handleSave}
                    disabled={loading || !current || !next || !confirm}
                    className="flex items-center gap-2 bg-qatar-maroon text-white px-6 py-2.5 rounded-xl font-black hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity text-sm"
                >
                    {loading ? <div className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" /> : <Lock className="w-4 h-4" />}
                    حفظ الرمز الجديد
                </button>
                {msg && (
                    <span className={`text-sm font-black ${msg.ok ? "text-emerald-600" : "text-red-600"} animate-in fade-in`}>
                        {msg.ok ? "✓ " : "✗ "}{msg.text}
                    </span>
                )}
            </div>
            <p className="mt-2 text-[11px] text-slate-400 font-bold">الرمز الافتراضي هو: 1234 — يُنصح بتغييره فور تفعيل النظام</p>
        </div>
    );
}

function TabButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
    return (
        <button
            onClick={onClick}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-black text-sm transition-colors border ${active ? "bg-qatar-maroon text-white border-qatar-maroon" : "bg-white text-slate-600 border-qatar-gray-border hover:bg-rose-50 hover:text-qatar-maroon"}`}
        >
            {icon}
            {label}
        </button>
    );
}

function ClassesSection() {
    const data = useQuery(api.setup.getInitialData);
    const createClass = useMutation(api.settings.createClass);
    const updateClass = useMutation(api.settings.updateClass);
    const deleteClass = useMutation(api.settings.deleteClass);

    const [newName, setNewName] = useState("");
    const [newGrade, setNewGrade] = useState<number>(10);
    const [newTrack, setNewTrack] = useState("عام");
    const [addError, setAddError] = useState("");
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editTrack, setEditTrack] = useState("");

    const schoolId = data?.schools?.[0]?._id;

    const grouped = useMemo(() => {
        if (!data?.classes) return {};
        const g: Record<number, any[]> = { 10: [], 11: [], 12: [] };
        for (const cls of data.classes) {
            if (g[cls.grade]) g[cls.grade].push(cls);
        }
        for (const grade of [10, 11, 12]) {
            g[grade].sort((a: any, b: any) => {
                const na = parseInt(a.name.split("-")[1] || "0", 10);
                const nb = parseInt(b.name.split("-")[1] || "0", 10);
                return na - nb;
            });
        }
        return g;
    }, [data]);

    const handleAdd = async () => {
        if (!newName.trim() || !schoolId) return;
        setAddError("");
        try {
            await createClass({ schoolId, name: newName.trim(), grade: newGrade, track: newTrack });
            setNewName("");
        } catch (e: any) {
            setAddError(e.message);
        }
    };

    const handleUpdateTrack = async (id: string) => {
        await updateClass({ id: id as any, track: editTrack });
        setEditingId(null);
    };

    return (
        <div className="space-y-6">
            {[10, 11, 12].map((grade) => (
                <div key={grade} className="bg-white rounded-2xl qatar-card-shadow border border-qatar-gray-border overflow-hidden">
                    <div className="bg-qatar-maroon px-6 py-4">
                        <h2 className="text-white font-black text-lg">الصف ال{GRADE_LABELS[grade]}</h2>
                    </div>
                    <div className="p-4">
                        {(grouped[grade] || []).length === 0 ? (
                            <p className="text-slate-400 text-sm font-bold text-center py-6">لا توجد صفوف مضافة</p>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                {(grouped[grade] || []).map((cls: any) => (
                                    <div key={cls._id} className="flex items-center justify-between gap-2 p-3 rounded-xl border border-qatar-gray-border bg-slate-50">
                                        <span className="font-black text-slate-800 text-sm w-14 flex-shrink-0">{cls.name}</span>

                                        {editingId === cls._id ? (
                                            <div className="flex items-center gap-1 flex-1">
                                                <select
                                                    value={editTrack}
                                                    onChange={e => setEditTrack(e.target.value)}
                                                    className="flex-1 text-sm border border-slate-300 rounded-lg px-2 py-1 bg-white outline-none font-bold"
                                                >
                                                    {TRACKS.map(t => <option key={t} value={t}>{t}</option>)}
                                                </select>
                                                <button onClick={() => handleUpdateTrack(cls._id)} className="p-1.5 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600">
                                                    <Check className="w-3.5 h-3.5" />
                                                </button>
                                                <button onClick={() => setEditingId(null)} className="p-1.5 bg-slate-200 text-slate-600 rounded-lg hover:bg-slate-300">
                                                    <X className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2 flex-1">
                                                <span className={`text-xs font-black px-2 py-0.5 rounded-full border ${TRACK_COLORS[cls.track || "عام"] || TRACK_COLORS["عام"]}`}>
                                                    {cls.track || "—"}
                                                </span>
                                                <button
                                                    onClick={() => { setEditingId(cls._id); setEditTrack(cls.track || "عام"); }}
                                                    className="mr-auto p-1.5 text-slate-400 hover:text-qatar-maroon hover:bg-rose-50 rounded-lg transition-colors"
                                                >
                                                    <Pencil className="w-3.5 h-3.5" />
                                                </button>
                                                <button
                                                    onClick={() => deleteClass({ id: cls._id })}
                                                    className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            ))}

            {/* Add New Class */}
            <div className="bg-white rounded-2xl qatar-card-shadow border border-qatar-gray-border p-6">
                <h3 className="font-black text-slate-700 mb-4 flex items-center gap-2">
                    <Plus className="w-4 h-4 text-qatar-maroon" />
                    إضافة صف جديد
                </h3>
                <div className="flex flex-wrap gap-3 items-end">
                    <div className="flex flex-col gap-1">
                        <label className="text-xs font-black text-slate-500">اسم الصف (مثال: 11-4)</label>
                        <input
                            value={newName}
                            onChange={e => setNewName(e.target.value)}
                            placeholder="11-4"
                            className="border border-slate-300 rounded-xl px-4 py-2.5 font-bold text-slate-700 outline-none w-32 focus:border-qatar-maroon"
                        />
                    </div>
                    <div className="flex flex-col gap-1">
                        <label className="text-xs font-black text-slate-500">الصف</label>
                        <select value={newGrade} onChange={e => setNewGrade(Number(e.target.value))} className="border border-slate-300 rounded-xl px-4 py-2.5 font-bold text-slate-700 outline-none bg-white focus:border-qatar-maroon">
                            {[10, 11, 12].map(g => <option key={g} value={g}>الصف ال{GRADE_LABELS[g]}</option>)}
                        </select>
                    </div>
                    <div className="flex flex-col gap-1">
                        <label className="text-xs font-black text-slate-500">المسار</label>
                        <select value={newTrack} onChange={e => setNewTrack(e.target.value)} className="border border-slate-300 rounded-xl px-4 py-2.5 font-bold text-slate-700 outline-none bg-white focus:border-qatar-maroon">
                            {TRACKS.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                    </div>
                    <button onClick={handleAdd} className="bg-qatar-maroon text-white px-6 py-2.5 rounded-xl font-black hover:opacity-90 transition-opacity flex items-center gap-2">
                        <Plus className="w-4 h-4" />
                        إضافة
                    </button>
                </div>
                {addError && <p className="mt-3 text-rose-600 text-sm font-bold">{addError}</p>}
            </div>
        </div>
    );
}

function SubjectsSection() {
    const data = useQuery(api.setup.getInitialData);
    const createSubject = useMutation(api.settings.createSubject);
    const updateSubject = useMutation(api.settings.updateSubject);
    const deleteSubject = useMutation(api.settings.deleteSubject);

    const [newName, setNewName] = useState("");
    const [newCode, setNewCode] = useState("");
    const [addError, setAddError] = useState("");
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState("");
    const [editCode, setEditCode] = useState("");

    const schoolId = data?.schools?.[0]?._id;

    const handleAdd = async () => {
        if (!newName.trim() || !newCode.trim() || !schoolId) return;
        setAddError("");
        try {
            await createSubject({ schoolId, name: newName.trim(), code: newCode.trim() });
            setNewName("");
            setNewCode("");
        } catch (e: any) {
            setAddError(e.message);
        }
    };

    const handleUpdate = async (id: string) => {
        await updateSubject({ id: id as any, name: editName, code: editCode });
        setEditingId(null);
    };

    return (
        <div className="space-y-6">
            <CurriculumMapping data={data} />
            
            <div className="bg-white rounded-2xl qatar-card-shadow border border-qatar-gray-border overflow-hidden">
                <div className="bg-qatar-maroon px-6 py-4">
                    <h2 className="text-white font-black text-lg">قائمة المواد الدراسية</h2>
                </div>
                <div className="p-4">
                    {(!data?.subjects || data.subjects.length === 0) ? (
                        <p className="text-slate-400 text-sm font-bold text-center py-6">لا توجد مواد مضافة</p>
                    ) : (
                        <div className="divide-y divide-qatar-gray-border">
                            {data.subjects.map((sub: any) => (
                                <div key={sub._id} className="flex items-center gap-4 py-3 px-2">
                                    {editingId === sub._id ? (
                                        <div className="flex items-center gap-2 flex-1 flex-wrap">
                                            <input
                                                value={editName}
                                                onChange={e => setEditName(e.target.value)}
                                                className="border border-slate-300 rounded-lg px-3 py-1.5 font-bold text-slate-700 outline-none text-sm focus:border-qatar-maroon w-40"
                                                placeholder="اسم المادة"
                                            />
                                            <input
                                                value={editCode}
                                                onChange={e => setEditCode(e.target.value)}
                                                className="border border-slate-300 rounded-lg px-3 py-1.5 font-bold text-slate-700 outline-none text-sm focus:border-qatar-maroon w-24 uppercase"
                                                placeholder="الكود"
                                            />
                                            <button onClick={() => handleUpdate(sub._id)} className="p-1.5 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600">
                                                <Check className="w-4 h-4" />
                                            </button>
                                            <button onClick={() => setEditingId(null)} className="p-1.5 bg-slate-200 text-slate-600 rounded-lg hover:bg-slate-300">
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ) : (
                                        <>
                                            <span className="font-black text-slate-800 flex-1">{sub.name}</span>
                                            <span className="text-xs font-black text-slate-400 bg-slate-100 px-2 py-1 rounded-lg border border-slate-200 w-16 text-center">{sub.code}</span>
                                            <button
                                                onClick={() => { setEditingId(sub._id); setEditName(sub.name); setEditCode(sub.code); }}
                                                className="p-1.5 text-slate-400 hover:text-qatar-maroon hover:bg-rose-50 rounded-lg transition-colors"
                                            >
                                                <Pencil className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => deleteSubject({ id: sub._id })}
                                                className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Add New Subject */}
            <div className="bg-white rounded-2xl qatar-card-shadow border border-qatar-gray-border p-6">
                <h3 className="font-black text-slate-700 mb-4 flex items-center gap-2">
                    <Plus className="w-4 h-4 text-qatar-maroon" />
                    إضافة مادة جديدة
                </h3>
                <div className="flex flex-wrap gap-3 items-end">
                    <div className="flex flex-col gap-1">
                        <label className="text-xs font-black text-slate-500">اسم المادة</label>
                        <input
                            value={newName}
                            onChange={e => setNewName(e.target.value)}
                            placeholder="مثال: رياضيات"
                            className="border border-slate-300 rounded-xl px-4 py-2.5 font-bold text-slate-700 outline-none w-44 focus:border-qatar-maroon"
                        />
                    </div>
                    <div className="flex flex-col gap-1">
                        <label className="text-xs font-black text-slate-500">الكود</label>
                        <input
                            value={newCode}
                            onChange={e => setNewCode(e.target.value.toUpperCase())}
                            placeholder="MAT"
                            className="border border-slate-300 rounded-xl px-4 py-2.5 font-bold text-slate-700 outline-none w-28 uppercase focus:border-qatar-maroon"
                        />
                    </div>
                    <button onClick={handleAdd} className="bg-qatar-maroon text-white px-6 py-2.5 rounded-xl font-black hover:opacity-90 transition-opacity flex items-center gap-2">
                        <Plus className="w-4 h-4" />
                        إضافة
                    </button>
                </div>
                {addError && <p className="mt-3 text-rose-600 text-sm font-bold">{addError}</p>}
            </div>
        </div>
    );
}

function CurriculumMapping({ data }: { data: any }) {
    const toggleTarget = useMutation(api.settings.toggleSubjectTarget);
    
    // UI state for assigning subjects
    const [mapGrade, setMapGrade] = useState<number>(10);
    const [mapTrack, setMapTrack] = useState<string>("عام");
    
    const currentTargetString = `${mapGrade}-${mapTrack}`;
    
    const handleToggle = async (subjectId: string) => {
        await toggleTarget({ subjectId: subjectId as any, targetString: currentTargetString });
    };
    
    if (!data?.subjects || data.subjects.length === 0) return null;

    return (
        <div className="bg-slate-50 rounded-2xl qatar-card-shadow border border-slate-200 overflow-hidden mt-8 mb-8">
            <div className="bg-slate-800 px-6 py-4 flex flex-wrap items-center justify-between gap-4">
                <h2 className="text-white font-black text-lg flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-slate-400" />
                    تخصيص المواد للمسارات
                </h2>
                <div className="flex items-center gap-2">
                    <select 
                        value={mapGrade} 
                        onChange={e => setMapGrade(Number(e.target.value))}
                        className="bg-slate-700 border-none text-white text-sm font-bold rounded-lg px-3 py-1.5 outline-none"
                    >
                        {[10, 11, 12].map(g => <option key={g} value={g}>الصف {g}</option>)}
                    </select>
                    <select 
                        value={mapTrack} 
                        onChange={e => setMapTrack(e.target.value)}
                        className="bg-slate-700 border-none text-white text-sm font-bold rounded-lg px-3 py-1.5 outline-none"
                    >
                        {TRACKS.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                </div>
            </div>
            
            <div className="p-6">
                <p className="text-xs text-slate-500 font-bold mb-4 bg-white p-3 rounded-lg border border-slate-200">
                    اختر المواد التي تُدرّس في مسار <strong className="text-qatar-maroon">{mapGrade}-{mapTrack}</strong> لكي تظهر تلقائياً في صفحة رصد التطبيقات لهذا المسار.<br/>
                    <span className="text-[10px] text-slate-400 font-medium">ملاحظة: إذا لم تقم بتحديد أي مسار للمادة، فستظهر لجميع الصفوف بشكل افتراضي.</span>
                </p>
                
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                    {data.subjects.map((sub: any) => {
                        const targets = sub.targetClasses || [];
                        const isChecked = targets.includes(currentTargetString);
                        
                        return (
                            <button
                                key={sub._id}
                                onClick={() => handleToggle(sub._id)}
                                className={`flex items-center gap-3 p-3 rounded-xl border text-sm font-black transition-all text-right ${
                                    isChecked 
                                    ? "bg-qatar-maroon text-white border-qatar-maroon shadow-md scale-[1.02]" 
                                    : "bg-white text-slate-600 border-slate-200 hover:border-qatar-maroon/50"
                                }`}
                            >
                                <div className={`w-5 h-5 rounded-md flex items-center justify-center border transition-colors ${
                                    isChecked ? "bg-white border-white" : "bg-slate-100 border-slate-300"
                                }`}>
                                    {isChecked && <Check className="w-3.5 h-3.5 text-qatar-maroon" />}
                                </div>
                                <span className="flex-1 truncate leading-tight">{sub.name}</span>
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
