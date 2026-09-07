import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
// @ts-ignore
import { api } from "../../convex/_generated/api";
import {
    ClipboardCheck, ChevronRight, ChevronLeft, Save, Send, FileText, Trash2,
    Pencil, Plus, X, Check, Search, Calendar, BookOpen, User, GraduationCap,
    Filter, Eye, Printer, FileSignature, AlertCircle, RotateCcw, CheckCircle2,
    BarChart3, Clock, Layers, LogOut, Wifi, WifiOff, Download, CloudUpload,
} from "lucide-react";
import SupervisionPinGate, { getStoredRole, clearStoredRole } from "../components/SupervisionPinGate";
import { getOfflineDrafts, saveOfflineDraft, deleteOfflineDraft, newDraftId, exportVisitsToExcel, type OfflineDraft } from "../lib/supervisionHelpers";

// ── Types & constants ─────────────────────────────────────────────────────
type VisitorRole = "coordinator" | "supervisor" | "deputy";
type Domain = "planning" | "execution" | "evaluation" | "management";

const ROLE_LABELS: Record<VisitorRole, string> = {
    coordinator: "المنسق",
    supervisor: "الموجه",
    deputy: "النائب الأكاديمي",
};
const ROLE_COLORS: Record<VisitorRole, string> = {
    coordinator: "#5C1523",
    supervisor: "#1e40af",
    deputy: "#5C1523",
};
const DOMAIN_LABELS: Record<Domain, string> = {
    planning: "التخطيط",
    execution: "تنفيذ الدرس",
    evaluation: "التقويم",
    management: "الإدارة الصفية",
};
const DOMAIN_COLORS: Record<Domain, string> = {
    planning: "#3b82f6",
    execution: "#10b981",
    evaluation: "#f59e0b",
    management: "#8b5cf6",
};
const DOMAIN_ORDER: Domain[] = ["planning", "execution", "evaluation", "management"];

// 5 rating options matching the Excel form (3..0 + not measured)
const RATING_OPTS = [
    { val: 3, label: "الأدلة مستكملة وفاعلة", short: "مستكملة", color: "#10b981" },
    { val: 2, label: "تتوفر معظم الأدلة",      short: "معظم",     color: "#3b82f6" },
    { val: 1, label: "تتوفر بعض الأدلة",       short: "بعض",      color: "#f59e0b" },
    { val: 0, label: "الأدلة غير متوفرة",       short: "محدودة",   color: "#ef4444" },
    { val: "not_measured" as const, label: "لم يتم قياسه", short: "لم يُقَس", color: "#94a3b8" },
] as const;

const SUBJECTS = [
    "الرياضيات", "التربية الإسلامية", "اللغة الإنجليزية", "اللغة العربية",
    "الكيمياء", "الفيزياء", "الأحياء", "العلوم الاجتماعية",
    "الحوسبة وتكنولوجيا المعلومات", "العلوم", "التربية الرياضية", "المهارات الحياتية",
];

const FOLLOW_UP = { full: "كليّة", partial: "جزئيّة" };

// Map teacher department → subject name (fuzzy match)
function departmentToSubject(dept: string): string {
    if (!dept) return "";
    const d = dept.trim();
    // exact match first
    if (SUBJECTS.includes(d)) return d;
    // partial / keyword match
    const map: [string, string][] = [
        ["رياضيات",   "الرياضيات"],
        ["إسلامية",   "التربية الإسلامية"],
        ["اسلامية",   "التربية الإسلامية"],
        ["دين",       "التربية الإسلامية"],
        ["إنجليز",    "اللغة الإنجليزية"],
        ["انجليز",    "اللغة الإنجليزية"],
        ["عربي",      "اللغة العربية"],
        ["كيمياء",    "الكيمياء"],
        ["فيزياء",    "الفيزياء"],
        ["أحياء",     "الأحياء"],
        ["احياء",     "الأحياء"],
        ["اجتماعي",   "العلوم الاجتماعية"],
        ["اجتماعية",  "العلوم الاجتماعية"],
        ["حوسبة",     "الحوسبة وتكنولوجيا المعلومات"],
        ["تقنية",     "الحوسبة وتكنولوجيا المعلومات"],
        ["علوم",      "العلوم"],
        ["رياضة",     "التربية الرياضية"],
        ["بدنية",     "التربية الرياضية"],
        ["مهارات",    "المهارات الحياتية"],
    ];
    for (const [key, val] of map) {
        if (d.includes(key)) return val;
    }
    return "";
}

type Criterion = { _id: string; domain: Domain; text: string; order: number; isActive: boolean };
type Visit = any;

// ── Main Page ──────────────────────────────────────────────────────────────
type Tab = "new" | "visits" | "teacher";

export default function SupervisionPage() {
    const criteria = useQuery(api.supervision.getCriteria) as Criterion[] | undefined;
    const seedDefault = useMutation(api.supervision.seedDefaultCriteria);
    const [tab, setTab] = useState<Tab>("new");
    const [editingVisitId, setEditingVisitId] = useState<string | null>(null);
    const [completedVisitId, setCompletedVisitId] = useState<string | null>(null);
    const [seeding, setSeeding] = useState(false);
    const [authedRole, setAuthedRole] = useState<VisitorRole | null>(getStoredRole()?.role ?? null);
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [offlineDrafts, setOfflineDrafts] = useState<OfflineDraft[]>(getOfflineDrafts());
    const saveVisitMutation = useMutation(api.supervision.saveVisit);

    useEffect(() => {
        const onOnline = () => setIsOnline(true);
        const onOffline = () => setIsOnline(false);
        window.addEventListener("online", onOnline);
        window.addEventListener("offline", onOffline);
        return () => {
            window.removeEventListener("online", onOnline);
            window.removeEventListener("offline", onOffline);
        };
    }, []);

    // Auto-sync offline drafts when online
    useEffect(() => {
        if (!isOnline || !authedRole) return;
        const drafts = getOfflineDrafts();
        if (drafts.length === 0) return;
        (async () => {
            for (const d of drafts) {
                try {
                    await saveVisitMutation({
                        visitorRole: d.visitorRole,
                        visitorName: d.visitorName,
                        teacherName: d.teacherName,
                        teacherDepartment: d.teacherDepartment,
                        subjectName: d.subjectName,
                        className: d.className,
                        lessonTopic: d.lessonTopic,
                        visitDate: d.visitDate,
                        followUpType: d.followUpType,
                        ratings: JSON.stringify(d.ratings),
                        planningRec: d.planningRec,
                        executionRec: d.executionRec,
                        evalMgmtRec: d.evalMgmtRec,
                        notes: d.notes,
                        status: "submitted",
                    });
                    deleteOfflineDraft(d.localId);
                } catch {}
            }
            setOfflineDrafts(getOfflineDrafts());
        })();
    }, [isOnline, authedRole, saveVisitMutation]);

    if (!authedRole) {
        return <SupervisionPinGate onAuthed={(r) => setAuthedRole(r)}/>;
    }

    if (criteria === undefined) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-qatar-maroon"/>
            </div>
        );
    }

    if (criteria.length === 0) {
        return (
            <div dir="rtl" className="max-w-3xl mx-auto space-y-6 animate-in fade-in duration-500 pb-20">
                <div className="workspace-page-header rounded-2xl overflow-hidden qatar-card-shadow"
                    >
                    <div className="p-5 sm:p-7">
                        <h1 className="text-2xl font-black text-white flex items-center gap-3">
                            <ClipboardCheck className="w-7 h-7 text-white/80"/>الإشراف الصفي
                        </h1>
                        <p className="text-white/80 font-bold text-sm mt-1">استمارة الإشراف على أداء المعلم</p>
                    </div>
                </div>
                <div className="bg-white rounded-2xl border border-qatar-gray-border qatar-card-shadow flex flex-col items-center py-16 gap-5">
                    <ClipboardCheck className="w-12 h-12 text-slate-200"/>
                    <p className="font-black text-slate-700 text-lg">لم يتم تهيئة معايير الإشراف بعد</p>
                    <p className="text-sm text-slate-400 mt-[-12px] max-w-sm text-center">سيتم تحميل المعايير الـ 24 المعتمدة (التخطيط، تنفيذ الدرس، التقويم، الإدارة الصفية) بنقرة واحدة</p>
                    <button onClick={async () => { setSeeding(true); try { await seedDefault({}); } finally { setSeeding(false); } }}
                        disabled={seeding}
                        className="flex items-center gap-2 px-6 py-3 rounded-2xl text-white font-black text-sm hover:opacity-90 disabled:opacity-50 qatar-card-shadow"
                        style={{ background: "linear-gradient(135deg,#5C1523,#7A1E30)" }}>
                        {seeding ? <><RotateCcw className="w-4 h-4 animate-spin"/>جارٍ التهيئة...</> : <><Plus className="w-4 h-4"/>تهيئة المعايير الافتراضية</>}
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div dir="rtl" className="max-w-5xl mx-auto space-y-5 animate-in fade-in duration-500 pb-20">
            {/* Header */}
            <div className="workspace-page-header rounded-2xl overflow-hidden qatar-card-shadow"
                >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-5 sm:p-7">
                    <div>
                        <h1 className="text-2xl font-black text-white flex items-center gap-3">
                            <ClipboardCheck className="w-7 h-7 text-white/80"/>الإشراف الصفي
                        </h1>
                        <p className="text-white/80 font-bold text-sm mt-1">استمارة الإشراف على أداء المعلم</p>
                        <div className="flex gap-2 mt-2 text-white/70 text-xs font-bold flex-wrap items-center">
                            <span className="bg-white/20 px-2 py-0.5 rounded-full">{ROLE_LABELS[authedRole]}</span>
                            {isOnline ? (
                                <span className="flex items-center gap-1 bg-emerald-500/30 px-2 py-0.5 rounded-full">
                                    <Wifi className="w-3 h-3"/>متصل
                                </span>
                            ) : (
                                <span className="flex items-center gap-1 bg-amber-500/30 px-2 py-0.5 rounded-full">
                                    <WifiOff className="w-3 h-3"/>غير متصل
                                </span>
                            )}
                            {offlineDrafts.length > 0 && (
                                <span className="flex items-center gap-1 bg-amber-400/40 px-2 py-0.5 rounded-full">
                                    <CloudUpload className="w-3 h-3"/>{offlineDrafts.length} في الانتظار
                                </span>
                            )}
                        </div>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                        {([
                            { key: "new" as Tab, label: "زيارة جديدة", icon: <Plus className="w-4 h-4"/> },
                            { key: "visits" as Tab, label: "الزيارات", icon: <Layers className="w-4 h-4"/> },
                            { key: "teacher" as Tab, label: "ملف المعلم", icon: <User className="w-4 h-4"/> },
                        ]).map(({ key, label, icon }) => (
                            <button key={key} onClick={() => { setTab(key); setEditingVisitId(null); }}
                                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl font-black text-sm transition-all border ${
                                    tab === key
                                        ? "bg-white border-white shadow"
                                        : "bg-white/10 text-white border-white/20 hover:bg-white/20"
                                }`}
                                style={tab === key ? { color: ROLE_COLORS[authedRole] } : {}}>
                                {icon}{label}
                            </button>
                        ))}
                        <button onClick={() => { clearStoredRole(); setAuthedRole(null); }}
                            title="تسجيل خروج"
                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl font-black text-sm bg-white/10 text-white border border-white/20 hover:bg-white/20">
                            <LogOut className="w-4 h-4"/>
                        </button>
                    </div>
                </div>
            </div>

            {completedVisitId ? (
                <VisitComplete
                    visitId={completedVisitId}
                    criteria={criteria}
                    onNewVisit={() => { setCompletedVisitId(null); setEditingVisitId(null); setTab("new"); }}
                    onGoList={() => { setCompletedVisitId(null); setEditingVisitId(null); setTab("visits"); }}
                />
            ) : (
                <>
                    {tab === "new" && <VisitForm criteria={criteria} editingId={editingVisitId} authedRole={authedRole} isOnline={isOnline} onSaved={(id) => { setEditingVisitId(null); setOfflineDrafts(getOfflineDrafts()); if (id) setCompletedVisitId(id); else setTab("visits"); }}/>}
                    {tab === "visits" && <VisitsList criteria={criteria} authedRole={authedRole} offlineDrafts={offlineDrafts} onEdit={(id) => { setEditingVisitId(id); setTab("new"); }} onView={(id) => { setCompletedVisitId(id); }} onDraftsChanged={() => setOfflineDrafts(getOfflineDrafts())}/>}
                    {tab === "teacher" && <TeacherFile criteria={criteria} onView={(id) => setCompletedVisitId(id)}/>}
                </>
            )}
        </div>
    );
}

// ── Visit Form (Multi-step Wizard) ────────────────────────────────────────
function VisitForm({ criteria, editingId, authedRole, isOnline, onSaved }: { criteria: Criterion[]; editingId: string | null; authedRole: VisitorRole; isOnline: boolean; onSaved: (id: string | null) => void }) {
    const existing = useQuery(api.supervision.getVisit, editingId ? { id: editingId as any } : "skip" as any) as Visit | null | undefined;
    const schoolTeachers = useQuery(api.supervision.getSchoolTeachers) as any[] | undefined;
    const supervisorsAll = useQuery(api.supervision.getSupervisors) as any[] | undefined;
    const saveVisit = useMutation(api.supervision.saveVisit);
    const recommendationBank = useQuery(api.supervision.getRecommendationBank) as any[] | undefined;
    const seedRecs = useMutation(api.supervision.seedDefaultRecommendations);

    const [step, setStep] = useState(1);
    const [visitorRole, setVisitorRole] = useState<VisitorRole>(authedRole);
    const [visitorName, setVisitorName] = useState(getStoredRole()?.name ?? "");
    const [teacherName, setTeacherName] = useState("");
    const [teacherDepartment, setTeacherDepartment] = useState("");
    const [subjectName, setSubjectName] = useState("");
    const [className, setClassName] = useState("");
    const [lessonTopic, setLessonTopic] = useState("");
    const [visitDate, setVisitDate] = useState(new Date().toISOString().slice(0, 10));
    const [followUpType, setFollowUpType] = useState<"full" | "partial">("full");
    const [ratings, setRatings] = useState<Record<string, number | "not_measured">>({});
    const [praiseText, setPraiseText] = useState("");
    const [planningRec, setPlanningRec] = useState("");
    const [executionRec, setExecutionRec] = useState("");
    const [evalMgmtRec, setEvalMgmtRec] = useState("");
    const [notes, setNotes] = useState("");
    const [recBankOpen, setRecBankOpen] = useState<string | null>(null); // which textarea has bank open
    const [saving, setSaving] = useState(false);
    const [searchTeacher, setSearchTeacher] = useState("");

    // Load existing for edit
    useEffect(() => {
        if (existing && typeof existing === "object") {
            setVisitorRole(existing.visitorRole);
            setVisitorName(existing.visitorName);
            setTeacherName(existing.teacherName);
            setTeacherDepartment(existing.teacherDepartment);
            setSubjectName(existing.subjectName);
            setClassName(existing.className);
            setLessonTopic(existing.lessonTopic);
            setVisitDate(existing.visitDate);
            setFollowUpType(existing.followUpType);
            try { setRatings(JSON.parse(existing.ratings)); } catch {}
            setPraiseText(existing.praiseText ?? "");
            setPlanningRec(existing.planningRec ?? "");
            setExecutionRec(existing.executionRec ?? "");
            setEvalMgmtRec(existing.evalMgmtRec ?? "");
            setNotes(existing.notes ?? "");
        }
    }, [existing]);

    const teachers = useMemo(() => {
        const set = new Map<string, string>();
        for (const t of schoolTeachers ?? []) {
            if (t?.fullName) set.set(t.fullName, t.department ?? "");
        }
        return Array.from(set.entries()).map(([name, department]) => ({ name, department }));
    }, [schoolTeachers]);

    // Auto-suggest visitor names based on selected role and teacher's department
    const visitorSuggestions = useMemo(() => {
        if (!supervisorsAll) return [];
        return supervisorsAll
            .filter(s => s.role === visitorRole && (!teacherDepartment || s.subjects.includes(teacherDepartment)))
            .map(s => s.fullName);
    }, [supervisorsAll, visitorRole, teacherDepartment]);

    const filteredTeachers = useMemo(() => {
        const q = searchTeacher.trim();
        if (!q) return teachers;
        return teachers.filter(t => t.name.includes(q) || (t.department ?? "").includes(q));
    }, [teachers, searchTeacher]);

    const activeCriteria = useMemo(() => criteria.filter(c => c.isActive).sort((a, b) => a.order - b.order), [criteria]);
    const byDomain = useMemo(() => {
        const m: Record<Domain, Criterion[]> = { planning: [], execution: [], evaluation: [], management: [] };
        for (const c of activeCriteria) m[c.domain].push(c);
        return m;
    }, [activeCriteria]);

    // Computed averages preview
    const previewAvgs = useMemo(() => {
        const dom: Record<Domain, { sum: number; cnt: number }> = {
            planning: { sum: 0, cnt: 0 }, execution: { sum: 0, cnt: 0 },
            evaluation: { sum: 0, cnt: 0 }, management: { sum: 0, cnt: 0 },
        };
        let total = 0, cnt = 0;
        for (const c of activeCriteria) {
            const v = ratings[c._id];
            if (typeof v === "number" && v >= 0 && v <= 3) {
                dom[c.domain].sum += v; dom[c.domain].cnt++; total += v; cnt++;
            }
        }
        const result: Record<Domain, number> = { planning: 0, execution: 0, evaluation: 0, management: 0 };
        for (const k of Object.keys(dom) as Domain[]) {
            result[k] = dom[k].cnt > 0 ? dom[k].sum / dom[k].cnt / 3 : 0;
        }
        return { domain: result, overall: cnt > 0 ? total / cnt / 3 : 0, ratedCount: cnt, totalCount: activeCriteria.length };
    }, [ratings, activeCriteria]);

    const setRate = (cId: string, val: number | "not_measured") => setRatings(p => ({ ...p, [cId]: val }));

    const canStep2 = visitorName.trim() && teacherName.trim();
    const canStep3 = subjectName && className.trim() && lessonTopic.trim() && visitDate;
    const allRated = activeCriteria.every(c => ratings[c._id] !== undefined);

    const handleSave = async (status: "draft" | "submitted") => {
        if (status === "submitted" && !canStep2) return;
        setSaving(true);
        try {
            // Offline → save locally
            if (!isOnline && status === "submitted") {
                saveOfflineDraft({
                    localId: newDraftId(),
                    visitorRole, visitorName, teacherName, teacherDepartment,
                    subjectName, className, lessonTopic, visitDate, followUpType,
                    ratings: ratings as any, planningRec, executionRec, evalMgmtRec, notes,
                    savedAt: Date.now(),
                });
                onSaved(null);
                return;
            }
            const savedId = await saveVisit({
                id: editingId ? editingId as any : undefined,
                visitorRole, visitorName, teacherName, teacherDepartment,
                subjectName, className, lessonTopic, visitDate, followUpType,
                ratings: JSON.stringify(ratings),
                praiseText, planningRec, executionRec, evalMgmtRec, notes,
                status,
            });
            onSaved(status === "submitted" ? (savedId as string) : null);
        } catch (e) {
            // Network error fallback
            saveOfflineDraft({
                localId: newDraftId(),
                visitorRole, visitorName, teacherName, teacherDepartment,
                subjectName, className, lessonTopic, visitDate, followUpType,
                ratings: ratings as any, planningRec, executionRec, evalMgmtRec, notes,
                savedAt: Date.now(),
            });
            onSaved(null);
        } finally { setSaving(false); }
    };

    // shared input / label class helpers
    const inputCls = "w-full border-2 border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-qatar-maroon bg-white font-bold text-slate-800 transition-colors placeholder:text-slate-300 placeholder:font-normal";
    const labelCls = "block text-xs font-black text-slate-500 mb-2 tracking-wide uppercase";
    const fieldCard = "bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden";
    const sectionHeader = (color: string, title: string, subtitle?: string) => (
        <div className="px-6 py-4 flex items-center gap-3" style={{ background: `linear-gradient(135deg,${color}18,${color}06)`, borderBottom: `1px solid ${color}22`, borderRight: `4px solid ${color}` }}>
            <div>
                <p className="font-black text-slate-800">{title}</p>
                {subtitle && <p className="text-[11px] text-slate-400 font-bold mt-0.5">{subtitle}</p>}
            </div>
        </div>
    );
    const navBtn = (onClick: () => void, label: string, icon: React.ReactNode, disabled?: boolean, primary?: boolean) => (
        <button onClick={onClick} disabled={disabled}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-black transition-all ${
                primary
                    ? "text-white shadow-md hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
            style={primary ? { background: "linear-gradient(135deg,#5C1523,#7A1E30)" } : {}}>
            {icon}{label}
        </button>
    );

    return (
        <div className="space-y-4">
            {/* ── Step indicator ── */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
                <div className="flex items-center gap-0">
                    {[
                        { n: 1, label: "الزائر والمعلم",  icon: <User className="w-4 h-4"/> },
                        { n: 2, label: "تفاصيل الحصة",   icon: <BookOpen className="w-4 h-4"/> },
                        { n: 3, label: "التقييم",          icon: <ClipboardCheck className="w-4 h-4"/> },
                        { n: 4, label: "التوصيات",         icon: <FileText className="w-4 h-4"/> },
                    ].map((s, i) => {
                        const done = step > s.n;
                        const active = step === s.n;
                        return (
                            <div key={s.n} className="flex items-center flex-1 min-w-0">
                                <button onClick={() => setStep(s.n)} className="flex flex-col items-center flex-1 gap-1.5 py-2 px-1 rounded-xl transition-all group">
                                    <span className={`w-9 h-9 rounded-full flex items-center justify-center font-black text-sm transition-all
                                        ${active ? "text-white shadow-lg scale-110" : done ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-400 group-hover:bg-slate-200"}`}
                                        style={active ? { background: "linear-gradient(135deg,#5C1523,#7A1E30)", boxShadow: "0 4px 14px #5C152350" } : {}}>
                                        {done ? <Check className="w-4 h-4"/> : s.icon}
                                    </span>
                                    <span className={`text-[10px] font-black hidden sm:block whitespace-nowrap ${active ? "text-qatar-maroon" : done ? "text-emerald-600" : "text-slate-400"}`}>{s.label}</span>
                                </button>
                                {i < 3 && (
                                    <div className={`h-0.5 w-6 sm:w-10 flex-shrink-0 rounded-full transition-all ${done ? "bg-emerald-300" : "bg-slate-200"}`}/>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* ── Step 1: Visitor + Teacher ── */}
            {step === 1 && (
                <div className={fieldCard}>
                    {sectionHeader("#5C1523", "بيانات الزائر والمعلم", "اختر صفتك وحدد المعلم المُزار")}
                    <div className="p-6 space-y-6">

                        {/* Role */}
                        <div>
                            <p className={labelCls}>صفة الزائر</p>
                            <div className="grid grid-cols-3 gap-3">
                                {(Object.keys(ROLE_LABELS) as VisitorRole[]).map(r => {
                                    const sel = visitorRole === r;
                                    return (
                                        <button key={r} onClick={() => setVisitorRole(r)}
                                            className={`py-3.5 rounded-xl text-sm font-black transition-all border-2 ${sel ? "text-white border-transparent" : "bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50"}`}
                                            style={sel ? { background: `linear-gradient(135deg,${ROLE_COLORS[r]},${ROLE_COLORS[r]}cc)`, boxShadow: `0 4px 16px ${ROLE_COLORS[r]}45` } : {}}>
                                            {ROLE_LABELS[r]}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Visitor name */}
                        <div>
                            <p className={labelCls}>اسم الزائر</p>
                            <div className="relative">
                                <User className="w-4 h-4 absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"/>
                                <input value={visitorName} onChange={e => setVisitorName(e.target.value)} list="visitor-suggestions"
                                    placeholder="اكتب الاسم الكامل..."
                                    className={inputCls + " pr-11"}/>
                            </div>
                            <datalist id="visitor-suggestions">
                                {visitorSuggestions.map(n => <option key={n} value={n}/>)}
                            </datalist>
                            <p className="text-[10px] text-slate-400 font-bold mt-1.5">
                                مسجَّل دخولك كـ <span className="font-black" style={{ color: ROLE_COLORS[authedRole] }}>{ROLE_LABELS[authedRole]}</span>
                            </p>
                        </div>

                        {/* Teacher */}
                        <div>
                            <p className={labelCls}>المعلم المُقَيَّم</p>
                            <div className="relative mb-3">
                                <Search className="w-4 h-4 absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"/>
                                <input value={searchTeacher} onChange={e => setSearchTeacher(e.target.value)}
                                    placeholder="بحث بالاسم أو القسم..."
                                    className={inputCls + " pr-11"}/>
                            </div>
                            {teacherName ? (
                                <div className="flex items-center justify-between bg-emerald-50 border-2 border-emerald-200 rounded-xl px-4 py-3.5">
                                    <div className="flex items-center gap-3">
                                        <span className="w-9 h-9 rounded-full bg-emerald-200 flex items-center justify-center text-emerald-800 font-black text-sm">
                                            {teacherName.charAt(0)}
                                        </span>
                                        <div>
                                            <p className="font-black text-emerald-800 text-sm">{teacherName}</p>
                                            {teacherDepartment && <p className="text-xs text-emerald-600 font-bold mt-0.5">{teacherDepartment}</p>}
                                        </div>
                                    </div>
                                    <button onClick={() => { setTeacherName(""); setTeacherDepartment(""); setSubjectName(""); }}
                                        className="p-2 rounded-xl text-emerald-600 hover:bg-emerald-100 transition-colors">
                                        <X className="w-4 h-4"/>
                                    </button>
                                </div>
                            ) : (
                                <div className="border-2 border-slate-200 rounded-xl overflow-hidden max-h-60 overflow-y-auto">
                                    {filteredTeachers.length === 0 ? (
                                        <div className="py-8 text-center">
                                            <User className="w-8 h-8 mx-auto text-slate-300 mb-2"/>
                                            <p className="text-xs text-slate-400 font-bold">لا يوجد معلمون — أضفهم من قسم الاستبانات</p>
                                        </div>
                                    ) : filteredTeachers.slice(0, 60).map((t, idx) => (
                                        <button key={t.name} onClick={() => { setTeacherName(t.name); setTeacherDepartment(t.department ?? ""); const mapped = departmentToSubject(t.department ?? ""); if (mapped) setSubjectName(mapped); }}
                                            className={`w-full text-right px-4 py-3 flex items-center gap-3 hover:bg-slate-50 transition-colors ${idx < filteredTeachers.length - 1 ? "border-b border-slate-100" : ""}`}>
                                            <span className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-black text-xs flex-shrink-0">
                                                {t.name.charAt(0)}
                                            </span>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-bold text-slate-700 text-sm truncate">{t.name}</p>
                                                {t.department && <p className="text-[11px] text-slate-400 font-bold">{t.department}</p>}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="flex justify-end pt-1">
                            {navBtn(() => setStep(2), "التالي", <ChevronLeft className="w-4 h-4"/>, !canStep2, true)}
                        </div>
                    </div>
                </div>
            )}

            {/* ── Step 2: Lesson details ── */}
            {step === 2 && (
                <div className={fieldCard}>
                    {sectionHeader("#3b82f6", "تفاصيل الحصة", "معلومات المادة والدرس والتاريخ")}
                    <div className="p-6 space-y-5">

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <p className={labelCls + " mb-0"}>المادة الدراسية</p>
                                    {subjectName && departmentToSubject(teacherDepartment) === subjectName && (
                                        <span className="text-[10px] font-black text-emerald-600 flex items-center gap-1">
                                            <Check className="w-3 h-3"/>تم التعبئة تلقائياً
                                        </span>
                                    )}
                                </div>
                                <div className="relative">
                                    <select value={subjectName} onChange={e => setSubjectName(e.target.value)}
                                        className={inputCls + " appearance-none cursor-pointer"}>
                                        <option value="">اختر المادة...</option>
                                        {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                    <ChevronLeft className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none rotate-[-90deg]"/>
                                </div>
                            </div>
                            <div>
                                <p className={labelCls}>الصف الدراسي</p>
                                <div className="relative">
                                    <GraduationCap className="w-4 h-4 absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"/>
                                    <input value={className} onChange={e => setClassName(e.target.value)}
                                        placeholder="مثال: حادي عشر 3"
                                        className={inputCls + " pr-11"}/>
                                </div>
                            </div>
                        </div>

                        <div>
                            <p className={labelCls}>عنوان الدرس / الموضوع</p>
                            <div className="relative">
                                <BookOpen className="w-4 h-4 absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"/>
                                <input value={lessonTopic} onChange={e => setLessonTopic(e.target.value)}
                                    placeholder="مثال: الحركة التوافقية البسيطة"
                                    className={inputCls + " pr-11"}/>
                            </div>
                        </div>

                        {/* Praise */}
                        <div className="rounded-xl border-2 border-amber-200 overflow-hidden" style={{ background: "linear-gradient(135deg,#fef9ee,#fffbf0)" }}>
                            <div className="px-4 py-2.5 flex items-center gap-2 border-b border-amber-100">
                                <span className="text-amber-500 text-base">★</span>
                                <p className="text-xs font-black text-amber-700 tracking-wide uppercase">إطراء وشكر للمعلم (اختياري)</p>
                            </div>
                            <div className="p-4">
                                <textarea value={praiseText} onChange={e => setPraiseText(e.target.value)} rows={2}
                                    placeholder="اكتب ما يُثنى عليه المعلم في هذه الزيارة..."
                                    className="w-full bg-transparent border-none outline-none text-sm font-bold text-slate-700 resize-none leading-relaxed placeholder:text-amber-300 placeholder:font-normal"/>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                            <div>
                                <p className={labelCls}>تاريخ الزيارة</p>
                                <div className="relative">
                                    <Calendar className="w-4 h-4 absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"/>
                                    <input type="date" value={visitDate} onChange={e => setVisitDate(e.target.value)} dir="ltr"
                                        className={inputCls + " pr-11 text-right"}/>
                                </div>
                            </div>
                            <div>
                                <p className={labelCls}>نوع المتابعة</p>
                                <div className="grid grid-cols-2 gap-2">
                                    {(["full", "partial"] as const).map(t => {
                                        const sel = followUpType === t;
                                        return (
                                            <button key={t} onClick={() => setFollowUpType(t)}
                                                className={`py-3 rounded-xl text-sm font-black transition-all border-2 ${sel ? "text-white border-transparent shadow-md" : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"}`}
                                                style={sel ? { background: "linear-gradient(135deg,#5C1523,#7A1E30)", boxShadow: "0 4px 14px #5C152345" } : {}}>
                                                {FOLLOW_UP[t]}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-between pt-1">
                            {navBtn(() => setStep(1), "السابق", <ChevronRight className="w-4 h-4"/>)}
                            {navBtn(() => setStep(3), "التالي", <ChevronLeft className="w-4 h-4"/>, !canStep3, true)}
                        </div>
                    </div>
                </div>
            )}

            {/* ── Step 3: Ratings ── */}
            {step === 3 && (
                <div className="space-y-4">
                    {/* Scale legend */}
                    <div className={fieldCard}>
                        <div className="px-5 py-3 flex items-center justify-between border-b border-slate-100 bg-slate-50">
                            <span className="text-xs font-black text-slate-500">
                                تم تقييم <span className="text-slate-800">{previewAvgs.ratedCount}</span> من <span className="text-slate-800">{previewAvgs.totalCount}</span> معيار
                            </span>
                            <span className="text-xs font-black text-slate-500">مقياس التقييم</span>
                        </div>
                        <div className="grid grid-cols-5">
                            {RATING_OPTS.map((o, i) => (
                                <div key={o.val} className={`py-3 px-2 text-center ${i < 4 ? "border-l border-slate-100" : ""}`}
                                    style={{ background: o.color + "12" }}>
                                    <div className="w-2.5 h-2.5 rounded-full mx-auto mb-1.5" style={{ background: o.color }}/>
                                    <p className="text-[10px] font-black leading-tight" style={{ color: o.color }}>{o.short}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {DOMAIN_ORDER.map(domain => {
                        const dCriteria = byDomain[domain];
                        if (dCriteria.length === 0) return null;
                        const dRated = dCriteria.filter(c => ratings[c._id] !== undefined).length;
                        const dColor = DOMAIN_COLORS[domain];
                        const pct = dRated / dCriteria.length;
                        return (
                            <div key={domain} className={fieldCard}>
                                <div className="px-5 py-4 flex items-center justify-between" style={{ background: `linear-gradient(135deg,${dColor}18,${dColor}06)`, borderBottom: `1px solid ${dColor}20`, borderRight: `4px solid ${dColor}` }}>
                                    <div className="flex items-center gap-3">
                                        <div className="text-right">
                                            <span className="text-xs font-black" style={{ color: dColor }}>{dRated}/{dCriteria.length} معيار</span>
                                            <div className="w-20 h-1.5 rounded-full mt-1 overflow-hidden" style={{ background: dColor + "25" }}>
                                                <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct * 100}%`, background: dColor }}/>
                                            </div>
                                        </div>
                                    </div>
                                    <span className="font-black text-slate-800">{DOMAIN_LABELS[domain]}</span>
                                </div>
                                <div className="p-4 space-y-3">
                                    {dCriteria.map((c, i) => {
                                        const cur = ratings[c._id];
                                        const hasAns = cur !== undefined;
                                        const selOpt = RATING_OPTS.find(o => o.val === cur);
                                        return (
                                            <div key={c._id} className="rounded-xl border-2 transition-all overflow-hidden"
                                                style={{ borderColor: hasAns ? `${selOpt?.color ?? dColor}40` : "#e2e8f0", background: hasAns ? `${selOpt?.color ?? dColor}08` : "white" }}>
                                                <div className="flex items-start gap-3 p-3 pb-2.5">
                                                    <span className="w-6 h-6 rounded-lg flex items-center justify-center text-white text-[11px] font-black flex-shrink-0 mt-0.5"
                                                        style={{ background: dColor }}>{i + 1}</span>
                                                    <p className="text-[13px] font-bold text-slate-700 leading-relaxed flex-1">{c.text}</p>
                                                </div>
                                                <div className="grid grid-cols-5 gap-0 px-3 pb-3">
                                                    {RATING_OPTS.map(o => {
                                                        const sel = cur === o.val;
                                                        return (
                                                            <button key={o.val} onClick={() => setRate(c._id, o.val as any)}
                                                                className={`py-2 mx-0.5 rounded-lg text-[10px] font-black text-center transition-all leading-tight border ${
                                                                    sel ? "text-white border-transparent shadow-sm scale-105" : "bg-white border-slate-200 text-slate-400 hover:border-slate-300 hover:bg-slate-50"
                                                                }`}
                                                                style={sel ? { background: o.color, boxShadow: `0 2px 8px ${o.color}50` } : {}}>
                                                                {o.short}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}

                    <div className="flex justify-between pt-1">
                        {navBtn(() => setStep(2), "السابق", <ChevronRight className="w-4 h-4"/>)}
                        {navBtn(() => setStep(4), "التالي", <ChevronLeft className="w-4 h-4"/>, false, true)}
                    </div>
                </div>
            )}

            {/* ── Step 4: Recommendations + Submit ── */}
            {step === 4 && (
                <div className="space-y-4">
                    {/* Averages preview */}
                    <div className={fieldCard}>
                        <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50">
                            <p className="text-xs font-black text-slate-500">ملخص نتائج التقييم</p>
                        </div>
                        <div className="p-4 grid grid-cols-2 sm:grid-cols-5 gap-3">
                            {DOMAIN_ORDER.map(d => (
                                <div key={d} className="rounded-xl p-3 text-center border border-slate-100" style={{ background: DOMAIN_COLORS[d] + "0d" }}>
                                    <p className="text-[10px] font-black mb-1" style={{ color: DOMAIN_COLORS[d] }}>{DOMAIN_LABELS[d]}</p>
                                    <p className="text-2xl font-black leading-none" style={{ color: DOMAIN_COLORS[d] }}>{(previewAvgs.domain[d] * 100).toFixed(0)}<span className="text-xs">%</span></p>
                                </div>
                            ))}
                            <div className="rounded-xl p-3 text-center border-2 border-qatar-maroon/20" style={{ background: "#5C15230d" }}>
                                <p className="text-[10px] font-black mb-1 text-qatar-maroon">المعدل العام</p>
                                <p className="text-2xl font-black leading-none text-qatar-maroon">{(previewAvgs.overall * 100).toFixed(0)}<span className="text-xs">%</span></p>
                            </div>
                        </div>
                    </div>

                    {/* Recommendation fields */}
                    {([
                        { label: "توصيات التخطيط", val: planningRec, set: setPlanningRec, color: "#3b82f6", bankKey: "planning-rec", domains: ["planning","general"] },
                        { label: "توصيات تنفيذ الدرس", val: executionRec, set: setExecutionRec, color: "#10b981", bankKey: "execution-rec", domains: ["execution","general"] },
                        { label: "توصيات التقويم والإدارة الصفية", val: evalMgmtRec, set: setEvalMgmtRec, color: "#f59e0b", bankKey: "eval-rec", domains: ["evaluation","management","general"] },
                        { label: "ملاحظات وتوصيات عامة", val: notes, set: setNotes, color: "#64748b", bankKey: "notes-rec", domains: ["general","planning","execution","evaluation","management"] },
                    ] as const).map(({ label, val, set, color, bankKey, domains }) => {
                        const bankItems = (recommendationBank ?? []).filter(r => r.isActive && (domains as readonly string[]).includes(r.domain));
                        const isOpen = recBankOpen === bankKey;
                        return (
                        <div key={bankKey} className={fieldCard}>
                            <div className="px-5 py-3.5 flex items-center justify-between" style={{ background: `linear-gradient(135deg,${color}18,${color}06)`, borderBottom: `1px solid ${color}20`, borderRight: `4px solid ${color}` }}>
                                <button onClick={() => setRecBankOpen(isOpen ? null : bankKey)}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-black transition-all border ${isOpen ? "text-white border-transparent" : "border-current bg-white/60 hover:bg-white"}`}
                                    style={isOpen ? { background: color } : { color }}>
                                    <BookOpen className="w-3.5 h-3.5"/>
                                    بنك التوصيات {bankItems.length > 0 && `(${bankItems.length})`}
                                </button>
                                <span className="font-black text-slate-800 text-sm">{label}</span>
                            </div>
                            {isOpen && (
                                <div className="border-b border-slate-100 p-4" style={{ background: color + "08" }}>
                                    {bankItems.length > 0 ? (
                                        <>
                                            <p className="text-[10px] font-black text-slate-400 mb-2.5">اضغط لإضافة التوصية للنص</p>
                                            <div className="flex flex-wrap gap-2">
                                                {bankItems.map((r: any) => (
                                                    <button key={r._id}
                                                        onClick={() => { set((v: string) => v ? v + "\n" + r.text : r.text); }}
                                                        className="text-right px-3 py-2 rounded-xl border-2 text-xs font-bold text-slate-700 bg-white hover:shadow-md transition-all text-start leading-snug"
                                                        style={{ borderColor: color + "40" }}>
                                                        {r.text}
                                                    </button>
                                                ))}
                                            </div>
                                        </>
                                    ) : (
                                        <div className="text-center py-2">
                                            <p className="text-xs font-bold text-slate-400 mb-2">لا توجد توصيات بعد</p>
                                            <button onClick={async () => { await seedRecs({}); }}
                                                className="text-xs font-black text-qatar-maroon underline">تحميل التوصيات الافتراضية</button>
                                        </div>
                                    )}
                                </div>
                            )}
                            <div className="p-4">
                                <textarea value={val} onChange={e => set(e.target.value)} rows={4}
                                    placeholder="اكتب التوصيات هنا أو اختر من البنك أعلاه..."
                                    className="w-full border-2 border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-qatar-maroon resize-none bg-white font-bold text-slate-800 leading-relaxed placeholder:text-slate-300 placeholder:font-normal transition-colors"/>
                            </div>
                        </div>
                        );
                    })}

                    <div className="flex justify-between pt-1 gap-2 flex-wrap">
                        {navBtn(() => setStep(3), "السابق", <ChevronRight className="w-4 h-4"/>)}
                        <div className="flex gap-2 flex-wrap">
                            <button onClick={() => handleSave("draft")} disabled={saving}
                                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 text-slate-700 text-sm font-black hover:bg-slate-200 disabled:opacity-50 transition-colors">
                                <Save className="w-4 h-4"/>حفظ مسودة
                            </button>
                            <button onClick={() => handleSave("submitted")} disabled={saving || !canStep2 || !canStep3}
                                className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-white text-sm font-black hover:opacity-90 disabled:opacity-40 shadow-md transition-all"
                                style={{ background: "linear-gradient(135deg,#5C1523,#7A1E30)", boxShadow: "0 4px 16px #5C152345" }}>
                                <Send className="w-4 h-4"/>{saving ? "جارٍ الحفظ..." : editingId ? "حفظ التعديلات" : "تأكيد وإرسال"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ── Visits List ───────────────────────────────────────────────────────────
function VisitsList({ criteria, authedRole, offlineDrafts, onEdit, onView, onDraftsChanged }: { criteria: Criterion[]; authedRole: VisitorRole; offlineDrafts: OfflineDraft[]; onEdit: (id: string) => void; onView: (id: string) => void; onDraftsChanged: () => void }) {
    const visits = useQuery(api.supervision.getVisits, {}) as Visit[] | undefined;
    const deleteVisit = useMutation(api.supervision.deleteVisit);
    const [filterRole, setFilterRole] = useState<VisitorRole | "all">("all");
    const [filterSubject, setFilterSubject] = useState<string>("all");
    const [search, setSearch] = useState("");

    const filtered = useMemo(() => {
        if (!visits) return [];
        return visits.filter(v => {
            if (filterRole !== "all" && v.visitorRole !== filterRole) return false;
            if (filterSubject !== "all" && v.subjectName !== filterSubject) return false;
            if (search.trim() && !v.teacherName.includes(search.trim()) && !v.lessonTopic.includes(search.trim())) return false;
            return true;
        });
    }, [visits, filterRole, filterSubject, search]);

    if (visits === undefined) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-qatar-maroon"/></div>;

    return (
        <div className="space-y-4">
            {/* Offline drafts banner */}
            {offlineDrafts.length > 0 && (
                <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-4 space-y-2">
                    <div className="flex items-center gap-2">
                        <CloudUpload className="w-4 h-4 text-amber-600"/>
                        <p className="font-black text-amber-800 text-sm">{offlineDrafts.length} زيارة في انتظار المزامنة</p>
                    </div>
                    <p className="text-xs text-amber-600 font-bold">سيتم رفعها تلقائياً عند الاتصال بالإنترنت.</p>
                    <div className="space-y-1">
                        {offlineDrafts.slice(0, 5).map(d => (
                            <div key={d.localId} className="flex items-center justify-between bg-white rounded-lg px-3 py-2">
                                <button onClick={() => { deleteOfflineDraft(d.localId); onDraftsChanged(); }}
                                    className="p-1 rounded hover:bg-red-50 text-red-500">
                                    <Trash2 className="w-3.5 h-3.5"/>
                                </button>
                                <div className="text-right">
                                    <p className="text-xs font-bold text-slate-700">{d.teacherName}</p>
                                    <p className="text-[10px] text-slate-400 font-bold">{d.subjectName} · {d.visitDate}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Filters */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 space-y-3">
                <div className="relative">
                    <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"/>
                    <input value={search} onChange={e => setSearch(e.target.value)}
                        placeholder="بحث عن معلم أو موضوع..."
                        className="w-full border-2 border-slate-100 rounded-xl pr-9 pl-3 py-2.5 text-sm focus:outline-none focus:border-qatar-maroon bg-slate-50"/>
                </div>
                <div className="flex gap-2 flex-wrap">
                    <button onClick={() => setFilterRole("all")}
                        className={`px-3 py-1.5 rounded-lg text-xs font-black border ${filterRole === "all" ? "bg-qatar-maroon text-white border-transparent" : "bg-white border-slate-200 text-slate-600"}`}>
                        كل الزوار
                    </button>
                    {(Object.keys(ROLE_LABELS) as VisitorRole[]).map(r => (
                        <button key={r} onClick={() => setFilterRole(r)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-black border ${filterRole === r ? "text-white border-transparent" : "bg-white border-slate-200 text-slate-600"}`}
                            style={filterRole === r ? { background: ROLE_COLORS[r] } : {}}>
                            {ROLE_LABELS[r]}
                        </button>
                    ))}
                </div>
                <select value={filterSubject} onChange={e => setFilterSubject(e.target.value)}
                    className="w-full border-2 border-slate-100 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-qatar-maroon bg-slate-50 font-bold text-slate-700">
                    <option value="all">كل المواد</option>
                    {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <button onClick={() => exportVisitsToExcel(filtered, criteria)}
                    disabled={filtered.length === 0}
                    className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 text-sm font-black hover:bg-emerald-100 disabled:opacity-50">
                    <Download className="w-4 h-4"/>تصدير Excel ({filtered.length})
                </button>
            </div>

            {/* Visits */}
            {filtered.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm py-16 flex flex-col items-center gap-3">
                    <ClipboardCheck className="w-10 h-10 text-slate-200"/>
                    <p className="font-black text-slate-400">لا توجد زيارات</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {filtered.map(v => {
                        const isDraft = v.status === "draft";
                        const pct = v.averageScore;
                        const scoreColor = pct >= 0.8 ? "#10b981" : pct >= 0.6 ? "#f59e0b" : "#ef4444";
                        let domAvgs: Record<string, number> = {};
                        try { domAvgs = JSON.parse(v.domainAverages || "{}"); } catch {}
                        return (
                            <div key={v._id} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow"
                                style={{ borderRight: `4px solid ${scoreColor}` }}>
                                <div className="p-4">
                                    {/* Top row */}
                                    <div className="flex items-start justify-between gap-3 mb-3">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                                                <span className="text-[10px] font-black px-2 py-0.5 rounded-full text-white" style={{ background: ROLE_COLORS[v.visitorRole as VisitorRole] }}>
                                                    {ROLE_LABELS[v.visitorRole as VisitorRole]}
                                                </span>
                                                {isDraft && <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">مسودة</span>}
                                                {v.teacherSignedAt && <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 flex items-center gap-0.5"><FileSignature className="w-2.5 h-2.5"/>موقَّع</span>}
                                                <span className="text-[10px] font-bold text-slate-400">زيارة #{v.visitNumber}</span>
                                            </div>
                                            <p className="font-black text-slate-800 text-base">{v.teacherName}</p>
                                            <p className="text-xs text-slate-500 font-bold mt-0.5">{v.subjectName} · {v.className}</p>
                                            <p className="text-[11px] text-slate-400 font-bold mt-0.5 truncate">{v.lessonTopic}</p>
                                            <p className="text-[10px] text-slate-300 font-bold mt-0.5">{v.visitDate} · {v.visitorName}</p>
                                        </div>
                                        {/* Score circle */}
                                        <div className="flex-shrink-0">
                                            <ScoreGauge pct={pct} size={72}/>
                                        </div>
                                    </div>
                                    {/* Domain mini-bars */}
                                    {!isDraft && (
                                        <div className="grid grid-cols-4 gap-1.5 mb-3">
                                            {DOMAIN_ORDER.map(d => {
                                                const val = domAvgs[d] ?? 0;
                                                const c = DOMAIN_COLORS[d];
                                                return (
                                                    <div key={d}>
                                                        <div className="flex justify-between mb-0.5">
                                                            <span className="text-[9px] font-black" style={{ color: c }}>{(val * 100).toFixed(0)}%</span>
                                                        </div>
                                                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                            <div className="h-full rounded-full" style={{ width: `${val * 100}%`, background: c }}/>
                                                        </div>
                                                        <p className="text-[8px] font-black text-slate-400 mt-0.5 truncate">{DOMAIN_LABELS[d]}</p>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                    {/* Action buttons */}
                                    <div className="flex gap-1.5 pt-2 border-t border-slate-50">
                                        <button onClick={() => onView(v._id)}
                                            className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-white text-[11px] font-black hover:opacity-90"
                                            style={{ background: scoreColor }}>
                                            <Eye className="w-3 h-3"/>التقرير الكامل
                                        </button>
                                        <button onClick={() => onEdit(v._id)}
                                            className="flex items-center justify-center gap-1 py-1.5 px-3 rounded-lg bg-slate-50 text-slate-600 hover:bg-slate-100 text-[11px] font-black">
                                            <Pencil className="w-3 h-3"/>تعديل
                                        </button>
                                        <button onClick={() => window.open(`/supervision/print/${v._id}`, "_blank")}
                                            className="flex items-center justify-center gap-1 py-1.5 px-3 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 text-[11px] font-black">
                                            <Printer className="w-3 h-3"/>
                                        </button>
                                        <button onClick={async () => {
                                            if (v.teacherSignedAt) { alert("لا يمكن حذف زيارة موقَّعة من المعلم"); return; }
                                            if (confirm("حذف هذه الزيارة؟")) {
                                                try { await deleteVisit({ id: v._id as any, actorRole: authedRole }); }
                                                catch (e: any) { alert(e.message ?? "تعذر الحذف"); }
                                            }
                                        }}
                                            className="flex items-center justify-center py-1.5 px-2.5 rounded-lg bg-red-50 text-red-400 hover:bg-red-100">
                                            <Trash2 className="w-3 h-3"/>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

// ── Teacher File (View teacher's visits + sign) ───────────────────────────
function TeacherFile({ criteria, onView }: { criteria: Criterion[]; onView?: (id: string) => void }) {
    const visits = useQuery(api.supervision.getVisits, {}) as Visit[] | undefined;
    const signVisit = useMutation(api.supervision.signVisitAsTeacher);
    const [selectedTeacher, setSelectedTeacher] = useState<string>("");
    const [search, setSearch] = useState("");

    const teachers = useMemo(() => {
        if (!visits) return [];
        return Array.from(new Set(visits.map(v => v.teacherName))).sort();
    }, [visits]);

    const filteredTeachers = useMemo(() =>
        teachers.filter(t => !search.trim() || t.includes(search.trim())),
        [teachers, search]);

    const teacherVisits = useMemo(() =>
        (visits ?? []).filter(v => v.teacherName === selectedTeacher),
        [visits, selectedTeacher]);

    if (visits === undefined) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-qatar-maroon"/></div>;

    if (!selectedTeacher) {
        return (
            <div className="space-y-4">
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
                    <p className="text-xs font-black text-slate-500 mb-2">اختر معلماً لعرض ملفه</p>
                    <div className="relative">
                        <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"/>
                        <input value={search} onChange={e => setSearch(e.target.value)}
                            placeholder="بحث..."
                            className="w-full border-2 border-slate-100 rounded-xl pr-9 pl-3 py-2.5 text-sm focus:outline-none focus:border-qatar-maroon bg-slate-50"/>
                    </div>
                </div>
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm divide-y divide-slate-100 max-h-[60vh] overflow-y-auto">
                    {filteredTeachers.length === 0 ? (
                        <p className="text-center py-10 text-slate-400 font-bold text-sm">لا يوجد معلمون لهم زيارات</p>
                    ) : filteredTeachers.map(t => {
                        const tVisits = visits.filter(v => v.teacherName === t);
                        const avg = tVisits.length > 0 ? tVisits.reduce((a, v) => a + v.averageScore, 0) / tVisits.length : 0;
                        return (
                            <button key={t} onClick={() => setSelectedTeacher(t)}
                                className="w-full text-right px-4 py-3.5 hover:bg-slate-50 flex items-center gap-3 transition-colors">
                                <span className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-black flex-shrink-0"
                                    style={{ background: avg >= 0.8 ? "#10b981" : avg >= 0.6 ? "#f59e0b" : "#ef4444" }}>
                                    {t.charAt(0)}
                                </span>
                                <div className="flex-1 min-w-0 text-right">
                                    <p className="font-black text-slate-800 text-sm truncate">{t}</p>
                                    <p className="text-[11px] text-slate-400 font-bold mt-0.5">{tVisits.length} زيارة</p>
                                </div>
                                <div className="flex-shrink-0 text-left">
                                    <span className="text-lg font-black" style={{ color: avg >= 0.8 ? "#10b981" : avg >= 0.6 ? "#f59e0b" : "#ef4444" }}>
                                        {(avg * 100).toFixed(0)}%
                                    </span>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="bg-qatar-maroon rounded-2xl px-5 py-3.5 flex items-center justify-between">
                <button onClick={() => setSelectedTeacher("")}
                    className="text-white/80 hover:text-white text-sm font-black flex items-center gap-1">
                    قائمة المعلمين <ChevronRight className="w-4 h-4"/>
                </button>
                <div>
                    <p className="font-black text-white text-base">{selectedTeacher}</p>
                    <p className="text-white/60 text-xs font-bold">{teacherVisits.length} زيارة</p>
                </div>
            </div>
            <div className="space-y-2">
                {teacherVisits.map(v => (
                    <div key={v._id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
                        <div className="flex items-start justify-between gap-3 mb-2">
                            <div className="flex-1">
                                <span className="text-[10px] font-black px-2 py-0.5 rounded text-white" style={{ background: ROLE_COLORS[v.visitorRole as VisitorRole] }}>
                                    {ROLE_LABELS[v.visitorRole as VisitorRole]}
                                </span>
                                <p className="font-bold text-slate-700 text-sm mt-1">{v.subjectName} · {v.className}</p>
                                <p className="text-xs text-slate-500 mt-0.5">{v.lessonTopic}</p>
                                <p className="text-[10px] text-slate-400 mt-0.5">{v.visitDate} · {v.visitorName}</p>
                            </div>
                            <p className="text-2xl font-black" style={{ color: v.averageScore >= 0.8 ? "#10b981" : v.averageScore >= 0.6 ? "#f59e0b" : "#ef4444" }}>
                                {(v.averageScore * 100).toFixed(0)}%
                            </p>
                        </div>
                        {(v.praiseText || v.planningRec || v.executionRec || v.evalMgmtRec || v.notes) && (
                            <div className="space-y-2 pt-2 border-t border-slate-100">
                                {v.praiseText && <RecBlock label="★ إطراء" text={v.praiseText} color="#d97706"/>}
                                {v.planningRec && <RecBlock label="توصيات التخطيط" text={v.planningRec} color="#3b82f6"/>}
                                {v.executionRec && <RecBlock label="توصيات تنفيذ الدرس" text={v.executionRec} color="#10b981"/>}
                                {v.evalMgmtRec && <RecBlock label="توصيات التقويم والإدارة" text={v.evalMgmtRec} color="#f59e0b"/>}
                                {v.notes && <RecBlock label="ملاحظات" text={v.notes} color="#64748b"/>}
                            </div>
                        )}
                        <div className="flex gap-2 pt-2 mt-2 border-t border-slate-100">
                            {onView && <button onClick={() => onView(v._id)}
                                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-50 text-slate-600 text-[11px] font-black hover:bg-slate-100">
                                <Eye className="w-3 h-3"/>التقرير الكامل
                            </button>}
                            <button onClick={() => window.open(`/supervision/print/${v._id}`, "_blank")}
                                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-600 text-[11px] font-black hover:bg-blue-100">
                                <Printer className="w-3 h-3"/>طباعة
                            </button>
                            {!v.teacherSignedAt ? (
                                <button onClick={async () => {
                                    if (!confirm("هل تؤكد اطلاعك على هذه الاستمارة وتوقيعك عليها؟")) return;
                                    await signVisit({ id: v._id as any });
                                }}
                                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-600 text-[11px] font-black hover:bg-emerald-100">
                                    <FileSignature className="w-3 h-3"/>توقيع
                                </button>
                            ) : (
                                <span className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-100 text-emerald-700 text-[11px] font-black">
                                    <CheckCircle2 className="w-3 h-3"/>موقَّع
                                </span>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ── Visit Complete (Post-submission Premium Report) ───────────────────────
function ScoreGauge({ pct, size = 120 }: { pct: number; size?: number }) {
    const r = size * 0.38;
    const circ = 2 * Math.PI * r;
    const dash = circ * pct;
    const color = pct >= 0.8 ? "#10b981" : pct >= 0.6 ? "#f59e0b" : "#ef4444";
    const label = pct >= 0.8 ? "ممتاز" : pct >= 0.6 ? "جيد" : "يحتاج تطوير";
    const cx = size / 2, cy = size / 2;
    return (
        <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
            <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
                <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f1f5f9" strokeWidth={size * 0.09}/>
                <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={size * 0.09}
                    strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
                    style={{ transition: "stroke-dasharray 1s ease" }}/>
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="font-black leading-none" style={{ fontSize: size * 0.22, color }}>{(pct * 100).toFixed(0)}%</span>
                <span className="font-black leading-none mt-0.5" style={{ fontSize: size * 0.1, color: color + "cc" }}>{label}</span>
            </div>
        </div>
    );
}

function VisitComplete({ visitId, criteria, onNewVisit, onGoList }: {
    visitId: string; criteria: Criterion[];
    onNewVisit: () => void; onGoList: () => void;
}) {
    const visit = useQuery(api.supervision.getVisit, { id: visitId as any }) as Visit | null | undefined;
    const signVisit = useMutation(api.supervision.signVisitAsTeacher);

    if (visit === undefined) return (
        <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-qatar-maroon"/></div>
    );
    if (!visit) return (
        <div className="text-center py-20 text-slate-400 font-bold">تعذر تحميل الزيارة</div>
    );

    let domAvgs: Record<string, number> = {};
    try { domAvgs = JSON.parse(visit.domainAverages || "{}"); } catch {}
    const score = visit.averageScore;
    const scoreColor = score >= 0.8 ? "#10b981" : score >= 0.6 ? "#f59e0b" : "#ef4444";
    const roleColor = ROLE_COLORS[visit.visitorRole as VisitorRole] ?? "#5C1523";

    return (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Success header */}
            <div className="workspace-page-header rounded-2xl overflow-hidden qatar-card-shadow"
                >
                <div className="p-5 sm:p-7">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                            <CheckCircle2 className="w-6 h-6 text-white"/>
                        </div>
                        <div>
                            <p className="text-white/70 text-xs font-bold">تم حفظ الزيارة بنجاح</p>
                            <p className="text-white font-black text-lg">زيارة #{visit.visitNumber}</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-white">
                        {[
                            { label: "المعلم", val: visit.teacherName },
                            { label: "المادة", val: visit.subjectName },
                            { label: "الفصل", val: visit.className },
                            { label: "التاريخ", val: visit.visitDate },
                        ].map(({ label, val }) => (
                            <div key={label} className="bg-white/15 rounded-xl px-3 py-2">
                                <p className="text-white/60 text-[10px] font-bold">{label}</p>
                                <p className="text-white font-black text-sm truncate">{val}</p>
                            </div>
                        ))}
                    </div>
                    <div className="mt-3">
                        <p className="text-white/70 text-[10px] font-bold">موضوع الدرس</p>
                        <p className="text-white font-bold text-sm">{visit.lessonTopic}</p>
                    </div>
                </div>
            </div>

            {/* Score + Domain breakdown */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                    <span className="text-[11px] font-black text-slate-400">التقييم الإجمالي</span>
                    <span className="text-xs font-black text-slate-600">نتائج الزيارة</span>
                </div>
                <div className="p-5">
                    <div className="flex flex-col sm:flex-row items-center gap-6">
                        {/* Gauge */}
                        <div className="flex-shrink-0">
                            <ScoreGauge pct={score} size={140}/>
                        </div>
                        {/* Domain bars */}
                        <div className="flex-1 w-full space-y-3">
                            {DOMAIN_ORDER.map(d => {
                                const val = domAvgs[d] ?? 0;
                                const c = DOMAIN_COLORS[d];
                                return (
                                    <div key={d}>
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-xs font-black" style={{ color: c }}>{(val * 100).toFixed(0)}%</span>
                                            <span className="text-xs font-black text-slate-600">{DOMAIN_LABELS[d]}</span>
                                        </div>
                                        <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                                            <div className="h-full rounded-full transition-all duration-700"
                                                style={{ width: `${val * 100}%`, background: `linear-gradient(90deg,${c},${c}cc)` }}/>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>

            {/* Rating scale legend */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
                <p className="text-[10px] font-black text-slate-400 mb-3 text-center tracking-widest uppercase">مقياس التقييم</p>
                <div className="grid grid-cols-5 gap-2">
                    {RATING_OPTS.map(o => (
                        <div key={o.val} className="rounded-xl py-2.5 px-1 text-center border" style={{ background: o.color + "12", borderColor: o.color + "30" }}>
                            <div className="w-3 h-3 rounded-full mx-auto mb-1.5" style={{ background: o.color }}/>
                            <p className="text-[10px] font-black leading-tight" style={{ color: o.color }}>{o.short}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Detailed criteria breakdown */}
            {DOMAIN_ORDER.map(domain => {
                const domCriteria = criteria.filter(c => c.isActive && c.domain === domain).sort((a, b) => a.order - b.order);
                if (!domCriteria.length) return null;
                let parsedRatings: Record<string, any> = {};
                try { parsedRatings = JSON.parse(visit.ratings || "{}"); } catch {}
                const dColor = DOMAIN_COLORS[domain];
                const dPct = ((domAvgs[domain] ?? 0) * 100).toFixed(0);
                const ratedCount = domCriteria.filter(c => parsedRatings[c._id] !== undefined).length;
                return (
                    <div key={domain} className="rounded-2xl overflow-hidden shadow-sm border" style={{ borderColor: dColor + "30" }}>
                        {/* Domain header */}
                        <div className="px-5 py-4 flex items-center justify-between gap-3"
                            style={{ background: `linear-gradient(135deg,${dColor},${dColor}dd)` }}>
                            <div className="flex items-center gap-2">
                                <div className="bg-white/20 rounded-xl px-3 py-1.5 text-center min-w-[60px]">
                                    <p className="text-white font-black text-xl leading-none">{dPct}<span className="text-sm">%</span></p>
                                </div>
                                <div className="h-8 w-px bg-white/20"/>
                                <div>
                                    <p className="text-white/70 text-[10px] font-bold">{ratedCount} من {domCriteria.length} معيار</p>
                                    <div className="w-20 h-1 rounded-full bg-white/20 mt-1 overflow-hidden">
                                        <div className="h-full rounded-full bg-white/70" style={{ width: `${(ratedCount/domCriteria.length)*100}%` }}/>
                                    </div>
                                </div>
                            </div>
                            <p className="text-white font-black text-base">{DOMAIN_LABELS[domain]}</p>
                        </div>

                        {/* Criteria rows */}
                        <div className="bg-white">
                            {domCriteria.map((c, i) => {
                                const val = parsedRatings[c._id];
                                const opt = RATING_OPTS.find(o => o.val === val);
                                const isEven = i % 2 === 0;
                                return (
                                    <div key={c._id}
                                        className="flex items-center gap-3 px-4 py-3 transition-colors"
                                        style={{
                                            background: opt ? `${opt.color}08` : isEven ? "#f8fafc" : "white",
                                            borderBottom: i < domCriteria.length - 1 ? "1px solid #f1f5f9" : "none",
                                            borderRight: opt ? `3px solid ${opt.color}50` : `3px solid transparent`,
                                        }}>
                                        {/* Number badge — RIGHT in RTL */}
                                        <span className="w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-black flex-shrink-0 text-white"
                                            style={{ background: opt ? opt.color : dColor + "60" }}>{i + 1}</span>
                                        {/* Text */}
                                        <p className="text-sm font-bold text-slate-700 flex-1 leading-relaxed">{c.text}</p>
                                        {/* Rating badge — LEFT in RTL */}
                                        {opt ? (
                                            <span className="flex-shrink-0 px-3 py-1.5 rounded-xl text-[11px] font-black text-white shadow-sm"
                                                style={{ background: opt.color, boxShadow: `0 2px 8px ${opt.color}40` }}>
                                                {opt.short}
                                            </span>
                                        ) : (
                                            <span className="flex-shrink-0 px-3 py-1.5 rounded-xl text-[11px] font-black bg-slate-100 text-slate-400">
                                                —
                                            </span>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                );
            })}

            {/* Praise + Recommendations */}
            {(visit.praiseText || visit.planningRec || visit.executionRec || visit.evalMgmtRec || visit.notes) && (
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                    <div className="px-5 py-3 border-b border-slate-100 bg-slate-50">
                        <span className="font-black text-slate-700 text-sm">الإطراء والتوصيات</span>
                    </div>
                    <div className="p-4 space-y-3">
                        {visit.praiseText && (
                            <div className="rounded-xl p-4" style={{ background: "#fef3c7", borderRight: "4px solid #d97706" }}>
                                <p className="text-[11px] font-black text-amber-700 mb-1.5">★ أشكر المعلم على</p>
                                <p className="text-sm font-bold text-amber-900 leading-relaxed">{visit.praiseText}</p>
                            </div>
                        )}
                        {visit.planningRec && <RecBlock label="توصيات التخطيط" text={visit.planningRec} color="#3b82f6"/>}
                        {visit.executionRec && <RecBlock label="توصيات تنفيذ الدرس" text={visit.executionRec} color="#10b981"/>}
                        {visit.evalMgmtRec && <RecBlock label="توصيات التقويم والإدارة الصفية" text={visit.evalMgmtRec} color="#f59e0b"/>}
                        {visit.notes && <RecBlock label="ملاحظات وتوصيات عامة" text={visit.notes} color="#64748b"/>}
                    </div>
                </div>
            )}

            {/* Teacher signature */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
                {visit.teacherSignedAt ? (
                    <div className="flex items-center gap-3 text-emerald-700">
                        <CheckCircle2 className="w-5 h-5"/>
                        <div>
                            <p className="font-black text-sm">تم توقيع المعلم</p>
                            <p className="text-xs font-bold text-emerald-600">{new Date(visit.teacherSignedAt).toLocaleDateString("ar-QA")}</p>
                        </div>
                    </div>
                ) : (
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                        <p className="text-xs font-bold text-slate-500">هل اطلع المعلم على الاستمارة ووافق عليها؟</p>
                        <button onClick={async () => {
                            if (!confirm("هل تؤكد اطلاعك على هذه الاستمارة وتوقيعك عليها؟")) return;
                            await signVisit({ id: visitId as any });
                        }}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 text-sm font-black hover:bg-emerald-100">
                            <FileSignature className="w-4 h-4"/>توقيع المعلم
                        </button>
                    </div>
                )}
            </div>

            {/* Action buttons */}
            <div className="flex gap-2 flex-wrap">
                <button onClick={() => window.open(`/supervision/print/${visitId}`, "_blank")}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-blue-50 text-blue-700 border border-blue-200 text-sm font-black hover:bg-blue-100">
                    <Printer className="w-4 h-4"/>طباعة الاستمارة
                </button>
                <button onClick={onNewVisit}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-white text-sm font-black hover:opacity-90 qatar-card-shadow"
                    style={{ background: "linear-gradient(135deg,#5C1523,#7A1E30)" }}>
                    <Plus className="w-4 h-4"/>زيارة جديدة
                </button>
                <button onClick={onGoList}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-100 text-slate-700 text-sm font-black hover:bg-slate-200">
                    <Layers className="w-4 h-4"/>قائمة الزيارات
                </button>
            </div>
        </div>
    );
}

function RecBlock({ label, text, color }: { label: string; text: string; color: string }) {
    return (
        <div className="rounded-lg p-2.5" style={{ background: color + "0a", borderRight: `3px solid ${color}` }}>
            <p className="text-[10px] font-black mb-1" style={{ color }}>{label}</p>
            <p className="text-xs text-slate-700 leading-relaxed font-medium whitespace-pre-wrap">{text}</p>
        </div>
    );
}
