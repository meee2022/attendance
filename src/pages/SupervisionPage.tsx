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
    coordinator: "#9B1239",
    supervisor: "#1e40af",
    deputy: "#065f46",
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

type Criterion = { _id: string; domain: Domain; text: string; order: number; isActive: boolean };
type Visit = any;

// ── Main Page ──────────────────────────────────────────────────────────────
type Tab = "new" | "visits" | "teacher";

export default function SupervisionPage() {
    const criteria = useQuery(api.supervision.getCriteria) as Criterion[] | undefined;
    const seedDefault = useMutation(api.supervision.seedDefaultCriteria);
    const [tab, setTab] = useState<Tab>("new");
    const [editingVisitId, setEditingVisitId] = useState<string | null>(null);
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
                <div className="rounded-2xl overflow-hidden qatar-card-shadow"
                    style={{ background: "linear-gradient(135deg,#9B1239 0%,#C0184C 50%,#9B1239 100%)" }}>
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
                        style={{ background: "linear-gradient(135deg,#9B1239,#C0184C)" }}>
                        {seeding ? <><RotateCcw className="w-4 h-4 animate-spin"/>جارٍ التهيئة...</> : <><Plus className="w-4 h-4"/>تهيئة المعايير الافتراضية</>}
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div dir="rtl" className="max-w-5xl mx-auto space-y-5 animate-in fade-in duration-500 pb-20">
            {/* Header */}
            <div className="rounded-2xl overflow-hidden qatar-card-shadow"
                style={{ background: `linear-gradient(135deg,${ROLE_COLORS[authedRole]},${ROLE_COLORS[authedRole]}dd)` }}>
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

            {tab === "new" && <VisitForm criteria={criteria} editingId={editingVisitId} authedRole={authedRole} isOnline={isOnline} onSaved={() => { setTab("visits"); setEditingVisitId(null); setOfflineDrafts(getOfflineDrafts()); }}/>}
            {tab === "visits" && <VisitsList criteria={criteria} authedRole={authedRole} offlineDrafts={offlineDrafts} onEdit={(id) => { setEditingVisitId(id); setTab("new"); }} onView={(id) => { setEditingVisitId(id); setTab("new"); }} onDraftsChanged={() => setOfflineDrafts(getOfflineDrafts())}/>}
            {tab === "teacher" && <TeacherFile criteria={criteria}/>}
        </div>
    );
}

// ── Visit Form (Multi-step Wizard) ────────────────────────────────────────
function VisitForm({ criteria, editingId, authedRole, isOnline, onSaved }: { criteria: Criterion[]; editingId: string | null; authedRole: VisitorRole; isOnline: boolean; onSaved: () => void }) {
    const existing = useQuery(api.supervision.getVisit, editingId ? { id: editingId as any } : "skip" as any) as Visit | null | undefined;
    const activeSurvey = useQuery(api.surveys.getActiveSurvey) as any;
    const respondents = useQuery(api.surveys.getRespondents, activeSurvey ? { surveyId: activeSurvey._id } : "skip" as any) as any[] | undefined;
    const saveVisit = useMutation(api.supervision.saveVisit);

    const [step, setStep] = useState(1);
    const [visitorRole, setVisitorRole] = useState<VisitorRole>(authedRole);
    const [visitorName, setVisitorName] = useState("");
    const [teacherName, setTeacherName] = useState("");
    const [teacherDepartment, setTeacherDepartment] = useState("");
    const [subjectName, setSubjectName] = useState("");
    const [className, setClassName] = useState("");
    const [lessonTopic, setLessonTopic] = useState("");
    const [visitDate, setVisitDate] = useState(new Date().toISOString().slice(0, 10));
    const [followUpType, setFollowUpType] = useState<"full" | "partial">("full");
    const [ratings, setRatings] = useState<Record<string, number | "not_measured">>({});
    const [planningRec, setPlanningRec] = useState("");
    const [executionRec, setExecutionRec] = useState("");
    const [evalMgmtRec, setEvalMgmtRec] = useState("");
    const [notes, setNotes] = useState("");
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
            setPlanningRec(existing.planningRec ?? "");
            setExecutionRec(existing.executionRec ?? "");
            setEvalMgmtRec(existing.evalMgmtRec ?? "");
            setNotes(existing.notes ?? "");
        }
    }, [existing]);

    const teachers = useMemo(() => {
        const set = new Map<string, string>();
        for (const t of respondents ?? []) {
            if (t?.name) set.set(t.name, t.department ?? "");
        }
        return Array.from(set.entries()).map(([name, department]) => ({ name, department }));
    }, [respondents]);

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
                onSaved();
                return;
            }
            await saveVisit({
                id: editingId ? editingId as any : undefined,
                visitorRole, visitorName, teacherName, teacherDepartment,
                subjectName, className, lessonTopic, visitDate, followUpType,
                ratings: JSON.stringify(ratings),
                planningRec, executionRec, evalMgmtRec, notes,
                status,
            });
            onSaved();
        } catch (e) {
            // Network error fallback
            saveOfflineDraft({
                localId: newDraftId(),
                visitorRole, visitorName, teacherName, teacherDepartment,
                subjectName, className, lessonTopic, visitDate, followUpType,
                ratings: ratings as any, planningRec, executionRec, evalMgmtRec, notes,
                savedAt: Date.now(),
            });
            onSaved();
        } finally { setSaving(false); }
    };

    return (
        <div className="space-y-4">
            {/* Step indicator */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-3">
                <div className="flex items-center justify-between gap-2">
                    {[
                        { n: 1, label: "الزائر والمعلم", icon: <User className="w-3.5 h-3.5"/> },
                        { n: 2, label: "تفاصيل الحصة", icon: <BookOpen className="w-3.5 h-3.5"/> },
                        { n: 3, label: "التقييم", icon: <ClipboardCheck className="w-3.5 h-3.5"/> },
                        { n: 4, label: "التوصيات", icon: <FileText className="w-3.5 h-3.5"/> },
                    ].map((s, i) => (
                        <div key={s.n} className="flex items-center gap-1.5 flex-1">
                            <button onClick={() => setStep(s.n)}
                                className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-black transition-all flex-1 justify-center ${
                                    step === s.n ? "text-white shadow" : step > s.n ? "bg-emerald-50 text-emerald-700" : "bg-slate-50 text-slate-400"
                                }`}
                                style={step === s.n ? { background: "linear-gradient(135deg,#9B1239,#C0184C)" } : {}}>
                                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                                    step === s.n ? "bg-white/30" : step > s.n ? "bg-emerald-200" : "bg-slate-200"
                                }`}>{step > s.n ? <Check className="w-3 h-3"/> : s.n}</span>
                                <span className="hidden sm:inline">{s.label}</span>
                            </button>
                            {i < 3 && <div className={`h-0.5 w-2 ${step > s.n ? "bg-emerald-300" : "bg-slate-200"}`}/>}
                        </div>
                    ))}
                </div>
            </div>

            {/* Step 1: Visitor + Teacher */}
            {step === 1 && (
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                    <div className="px-5 py-3.5 border-b border-slate-100" style={{ background: "linear-gradient(135deg,#9B123922,#9B12390a)", borderRight: "4px solid #9B1239" }}>
                        <span className="font-black text-slate-800 text-sm">بيانات الزائر والمعلم</span>
                    </div>
                    <div className="p-5 space-y-5">
                        {/* Role selection */}
                        <div>
                            <label className="block text-xs font-black text-slate-500 mb-2">صفة الزائر</label>
                            <div className="grid grid-cols-3 gap-2">
                                {(Object.keys(ROLE_LABELS) as VisitorRole[]).map(r => {
                                    const sel = visitorRole === r;
                                    return (
                                        <button key={r} onClick={() => setVisitorRole(r)}
                                            className={`py-3 rounded-xl text-sm font-black transition-all border-2 ${sel ? "text-white border-transparent shadow-md" : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"}`}
                                            style={sel ? { background: ROLE_COLORS[r], boxShadow: `0 4px 12px ${ROLE_COLORS[r]}40` } : {}}>
                                            {ROLE_LABELS[r]}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                        {/* Visitor name */}
                        <div>
                            <label className="block text-xs font-black text-slate-500 mb-1.5">اسم الزائر</label>
                            <input value={visitorName} onChange={e => setVisitorName(e.target.value)}
                                placeholder="اكتب اسم الزائر..."
                                className="w-full border-2 border-slate-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-qatar-maroon bg-slate-50 font-bold text-slate-700"/>
                            <p className="text-[10px] text-slate-400 font-bold mt-1">تم تسجيل دخولك كـ <span className="font-black" style={{ color: ROLE_COLORS[authedRole] }}>{ROLE_LABELS[authedRole]}</span></p>
                        </div>
                        {/* Teacher selection */}
                        <div>
                            <label className="block text-xs font-black text-slate-500 mb-1.5">المعلم المُقَيَّم</label>
                            <div className="relative mb-2">
                                <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"/>
                                <input value={searchTeacher} onChange={e => setSearchTeacher(e.target.value)}
                                    placeholder="بحث بالاسم أو القسم..."
                                    className="w-full border-2 border-slate-100 rounded-xl pr-9 pl-3 py-2.5 text-sm focus:outline-none focus:border-qatar-maroon bg-slate-50"/>
                            </div>
                            {teacherName ? (
                                <div className="flex items-center justify-between bg-emerald-50 border-2 border-emerald-200 rounded-xl px-4 py-3">
                                    <div>
                                        <p className="font-black text-emerald-800 text-sm">{teacherName}</p>
                                        {teacherDepartment && <p className="text-xs text-emerald-600 font-bold mt-0.5">{teacherDepartment}</p>}
                                    </div>
                                    <button onClick={() => { setTeacherName(""); setTeacherDepartment(""); }}
                                        className="text-emerald-600 hover:bg-emerald-100 p-1.5 rounded-lg">
                                        <X className="w-4 h-4"/>
                                    </button>
                                </div>
                            ) : (
                                <div className="border-2 border-slate-100 rounded-xl max-h-64 overflow-y-auto bg-slate-50">
                                    {filteredTeachers.length === 0 ? (
                                        <p className="text-xs text-slate-400 font-bold text-center py-6">لا يوجد معلمون — أضفهم أولاً من قسم الاستبانات أو استورد قائمة المدرسة</p>
                                    ) : filteredTeachers.slice(0, 60).map(t => (
                                        <button key={t.name} onClick={() => { setTeacherName(t.name); setTeacherDepartment(t.department ?? ""); }}
                                            className="w-full text-right px-4 py-2.5 hover:bg-white border-b border-slate-100 last:border-b-0 transition-colors">
                                            <p className="font-bold text-slate-700 text-sm">{t.name}</p>
                                            {t.department && <p className="text-[10px] text-slate-400 font-bold">{t.department}</p>}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="flex justify-end pt-2">
                            <button onClick={() => setStep(2)} disabled={!canStep2}
                                className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-qatar-maroon text-white text-sm font-black hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed">
                                التالي <ChevronLeft className="w-4 h-4"/>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Step 2: Lesson details */}
            {step === 2 && (
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                    <div className="px-5 py-3.5 border-b border-slate-100" style={{ background: "linear-gradient(135deg,#3b82f622,#3b82f60a)", borderRight: "4px solid #3b82f6" }}>
                        <span className="font-black text-slate-800 text-sm">تفاصيل الحصة</span>
                    </div>
                    <div className="p-5 space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-black text-slate-500 mb-1.5">المادة</label>
                                <select value={subjectName} onChange={e => setSubjectName(e.target.value)}
                                    className="w-full border-2 border-slate-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-qatar-maroon bg-slate-50 font-bold text-slate-700">
                                    <option value="">— اختر المادة —</option>
                                    {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-black text-slate-500 mb-1.5">الصف</label>
                                <input value={className} onChange={e => setClassName(e.target.value)}
                                    placeholder="مثال: حادي عشر 3"
                                    className="w-full border-2 border-slate-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-qatar-maroon bg-slate-50 font-bold text-slate-700"/>
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-black text-slate-500 mb-1.5">عنوان الدرس / الموضوع</label>
                            <input value={lessonTopic} onChange={e => setLessonTopic(e.target.value)}
                                placeholder="مثال: الحركة التوافقية البسيطة"
                                className="w-full border-2 border-slate-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-qatar-maroon bg-slate-50 font-bold text-slate-700"/>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-black text-slate-500 mb-1.5">تاريخ الزيارة</label>
                                <input type="date" value={visitDate} onChange={e => setVisitDate(e.target.value)} dir="ltr"
                                    className="w-full border-2 border-slate-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-qatar-maroon bg-slate-50"/>
                            </div>
                            <div>
                                <label className="block text-xs font-black text-slate-500 mb-1.5">نوع المتابعة</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {(["full", "partial"] as const).map(t => {
                                        const sel = followUpType === t;
                                        return (
                                            <button key={t} onClick={() => setFollowUpType(t)}
                                                className={`py-2.5 rounded-xl text-sm font-black transition-all border-2 ${sel ? "text-white border-transparent" : "bg-white border-slate-200 text-slate-600"}`}
                                                style={sel ? { background: "linear-gradient(135deg,#9B1239,#C0184C)" } : {}}>
                                                {FOLLOW_UP[t]}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                        <div className="flex justify-between pt-2">
                            <button onClick={() => setStep(1)}
                                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-100 text-slate-600 text-sm font-black hover:bg-slate-200">
                                <ChevronRight className="w-4 h-4"/> السابق
                            </button>
                            <button onClick={() => setStep(3)} disabled={!canStep3}
                                className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-qatar-maroon text-white text-sm font-black hover:opacity-90 disabled:opacity-40">
                                التالي <ChevronLeft className="w-4 h-4"/>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Step 3: Ratings */}
            {step === 3 && (
                <div className="space-y-4">
                    {/* Scale legend */}
                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                        <div className="px-5 py-2.5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                            <span className="text-[11px] font-black text-slate-400">{previewAvgs.ratedCount}/{previewAvgs.totalCount}</span>
                            <span className="text-[11px] font-black text-slate-500">مقياس التقييم</span>
                        </div>
                        <div className="grid grid-cols-5">
                            {RATING_OPTS.map((o, i) => (
                                <div key={o.val} className={`py-2.5 px-1 text-center ${i < 4 ? "border-l border-slate-100" : ""}`}
                                    style={{ background: o.color + "10" }}>
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
                        return (
                            <div key={domain} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                                <div className="px-5 py-3.5 flex items-center justify-between" style={{ background: `linear-gradient(135deg,${dColor}22,${dColor}0a)`, borderRight: `4px solid ${dColor}` }}>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[11px] font-black px-2.5 py-1 rounded-full text-white shadow-sm" style={{ background: dColor }}>
                                            {dRated}/{dCriteria.length}
                                        </span>
                                        <div className="w-16 h-1.5 rounded-full bg-white/60 overflow-hidden">
                                            <div className="h-full rounded-full transition-all duration-500"
                                                style={{ width: `${(dRated / dCriteria.length) * 100}%`, background: dColor }}/>
                                        </div>
                                    </div>
                                    <span className="font-black text-slate-800 text-sm">{DOMAIN_LABELS[domain]}</span>
                                </div>
                                <div className="bg-white p-3 space-y-2">
                                    {dCriteria.map((c, i) => {
                                        const cur = ratings[c._id];
                                        const hasAns = cur !== undefined;
                                        return (
                                            <div key={c._id} className="rounded-xl p-3 border transition-all"
                                                style={{ background: hasAns ? `${dColor}08` : "#f8fafc", borderColor: hasAns ? `${dColor}30` : "#f1f5f9" }}>
                                                <div className="flex items-start gap-2 mb-2.5">
                                                    <span className="w-6 h-6 rounded-lg flex items-center justify-center text-white text-[11px] font-black flex-shrink-0"
                                                        style={{ background: dColor }}>{i + 1}</span>
                                                    <p className="text-[13px] font-bold text-slate-700 leading-relaxed flex-1">{c.text}</p>
                                                </div>
                                                <div className="grid grid-cols-5 gap-1.5">
                                                    {RATING_OPTS.map(o => {
                                                        const sel = cur === o.val;
                                                        return (
                                                            <button key={o.val} onClick={() => setRate(c._id, o.val as any)}
                                                                className={`py-2 rounded-xl text-[10px] font-black text-center transition-all border leading-tight ${
                                                                    sel ? "text-white border-transparent shadow-md scale-105" : "bg-white border-slate-100 text-slate-400 hover:border-slate-200 hover:bg-slate-50"
                                                                }`}
                                                                style={sel ? { background: o.color, boxShadow: `0 4px 12px ${o.color}40` } : {}}>
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

                    <div className="flex justify-between pt-2">
                        <button onClick={() => setStep(2)}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-100 text-slate-600 text-sm font-black hover:bg-slate-200">
                            <ChevronRight className="w-4 h-4"/> السابق
                        </button>
                        <button onClick={() => setStep(4)}
                            className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-qatar-maroon text-white text-sm font-black hover:opacity-90">
                            التالي <ChevronLeft className="w-4 h-4"/>
                        </button>
                    </div>
                </div>
            )}

            {/* Step 4: Recommendations + Submit */}
            {step === 4 && (
                <div className="space-y-4">
                    {/* Preview averages */}
                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
                        <p className="text-xs font-black text-slate-500 mb-3">المعدلات المحسوبة</p>
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                            {DOMAIN_ORDER.map(d => (
                                <div key={d} className="rounded-xl p-3 text-center" style={{ background: DOMAIN_COLORS[d] + "15" }}>
                                    <p className="text-[10px] font-black mb-0.5" style={{ color: DOMAIN_COLORS[d] }}>{DOMAIN_LABELS[d]}</p>
                                    <p className="text-xl font-black" style={{ color: DOMAIN_COLORS[d] }}>{(previewAvgs.domain[d] * 100).toFixed(0)}%</p>
                                </div>
                            ))}
                            <div className="rounded-xl p-3 text-center bg-qatar-maroon/10">
                                <p className="text-[10px] font-black mb-0.5 text-qatar-maroon">المعدل العام</p>
                                <p className="text-xl font-black text-qatar-maroon">{(previewAvgs.overall * 100).toFixed(0)}%</p>
                            </div>
                        </div>
                    </div>

                    {/* Recommendations */}
                    {[
                        { label: "توصيات التخطيط", val: planningRec, set: setPlanningRec, color: "#3b82f6" },
                        { label: "توصيات تنفيذ الدرس", val: executionRec, set: setExecutionRec, color: "#10b981" },
                        { label: "توصيات التقويم والإدارة الصفية", val: evalMgmtRec, set: setEvalMgmtRec, color: "#f59e0b" },
                        { label: "ملاحظات وتوصيات عامة", val: notes, set: setNotes, color: "#64748b" },
                    ].map(({ label, val, set, color }) => (
                        <div key={label} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                            <div className="px-5 py-3.5 border-b border-slate-100" style={{ background: `linear-gradient(135deg,${color}22,${color}0a)`, borderRight: `4px solid ${color}` }}>
                                <span className="font-black text-slate-800 text-sm">{label}</span>
                            </div>
                            <div className="p-4">
                                <textarea value={val} onChange={e => set(e.target.value)} rows={4}
                                    placeholder="اكتب التوصيات هنا..."
                                    className="w-full border-2 border-slate-100 rounded-xl px-4 py-3 text-sm focus:outline-none resize-none bg-slate-50 font-bold text-slate-700 leading-relaxed"
                                    style={{ borderColor: undefined }}/>
                            </div>
                        </div>
                    ))}

                    <div className="flex justify-between pt-2 gap-2 flex-wrap">
                        <button onClick={() => setStep(3)}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-100 text-slate-600 text-sm font-black hover:bg-slate-200">
                            <ChevronRight className="w-4 h-4"/> السابق
                        </button>
                        <div className="flex gap-2 flex-wrap">
                            <button onClick={() => handleSave("draft")} disabled={saving}
                                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-100 text-slate-700 text-sm font-black hover:bg-slate-200 disabled:opacity-50">
                                <Save className="w-4 h-4"/>حفظ كمسودة
                            </button>
                            <button onClick={() => handleSave("submitted")} disabled={saving || !canStep2 || !canStep3}
                                className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-white text-sm font-black hover:opacity-90 disabled:opacity-40 qatar-card-shadow"
                                style={{ background: "linear-gradient(135deg,#9B1239,#C0184C)" }}>
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
                <div className="space-y-2">
                    {filtered.map(v => {
                        const isDraft = v.status === "draft";
                        const score = (v.averageScore * 100).toFixed(0);
                        return (
                            <div key={v._id} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                                <div className="p-4">
                                    <div className="flex items-start justify-between gap-3 mb-2">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-[10px] font-black px-2 py-0.5 rounded text-white" style={{ background: ROLE_COLORS[v.visitorRole as VisitorRole] }}>
                                                    {ROLE_LABELS[v.visitorRole as VisitorRole]}
                                                </span>
                                                {isDraft && (
                                                    <span className="text-[10px] font-black px-2 py-0.5 rounded bg-amber-100 text-amber-700">مسودة</span>
                                                )}
                                                {v.teacherSignedAt && (
                                                    <span className="text-[10px] font-black px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 flex items-center gap-1">
                                                        <FileSignature className="w-2.5 h-2.5"/>موقَّعة
                                                    </span>
                                                )}
                                            </div>
                                            <p className="font-black text-slate-800 text-sm">{v.teacherName}</p>
                                            <p className="text-xs text-slate-500 font-bold mt-0.5">
                                                {v.subjectName} · {v.className} · {v.lessonTopic}
                                            </p>
                                            <p className="text-[10px] text-slate-400 font-bold mt-0.5">
                                                {v.visitDate} · زيارة #{v.visitNumber} · {v.visitorName}
                                            </p>
                                        </div>
                                        <div className="text-center flex-shrink-0">
                                            <p className="text-2xl font-black" style={{ color: v.averageScore >= 0.8 ? "#10b981" : v.averageScore >= 0.6 ? "#f59e0b" : "#ef4444" }}>{score}%</p>
                                            <p className="text-[9px] font-bold text-slate-400">معدل عام</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-1.5 pt-2 border-t border-slate-100">
                                        <button onClick={() => onView(v._id)}
                                            className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-slate-50 text-slate-600 hover:bg-slate-100 text-[11px] font-black">
                                            <Eye className="w-3 h-3"/>عرض/تعديل
                                        </button>
                                        <button onClick={() => window.open(`/supervision/print/${v._id}`, "_blank")}
                                            className="flex items-center justify-center gap-1 py-1.5 px-3 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 text-[11px] font-black">
                                            <Printer className="w-3 h-3"/>طباعة
                                        </button>
                                        <button onClick={async () => { if (confirm("حذف هذه الزيارة؟")) await deleteVisit({ id: v._id as any }); }}
                                            className="flex items-center justify-center py-1.5 px-3 rounded-lg bg-red-50 text-red-500 hover:bg-red-100">
                                            <Trash2 className="w-3.5 h-3.5"/>
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
function TeacherFile({ criteria }: { criteria: Criterion[] }) {
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
                                className="w-full text-right px-4 py-3 hover:bg-slate-50 flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                    <span className="text-base font-black" style={{ color: avg >= 0.8 ? "#10b981" : avg >= 0.6 ? "#f59e0b" : "#ef4444" }}>{(avg * 100).toFixed(0)}%</span>
                                    <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded">{tVisits.length} زيارة</span>
                                </div>
                                <p className="font-black text-slate-700 text-sm">{t}</p>
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
                        {(v.planningRec || v.executionRec || v.evalMgmtRec || v.notes) && (
                            <div className="space-y-2 pt-2 border-t border-slate-100">
                                {v.planningRec && <RecBlock label="توصيات التخطيط" text={v.planningRec} color="#3b82f6"/>}
                                {v.executionRec && <RecBlock label="توصيات تنفيذ الدرس" text={v.executionRec} color="#10b981"/>}
                                {v.evalMgmtRec && <RecBlock label="توصيات التقويم والإدارة" text={v.evalMgmtRec} color="#f59e0b"/>}
                                {v.notes && <RecBlock label="ملاحظات" text={v.notes} color="#64748b"/>}
                            </div>
                        )}
                        <div className="flex gap-2 pt-2 mt-2 border-t border-slate-100">
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
                                    <FileSignature className="w-3 h-3"/>توقيع المعلم
                                </button>
                            ) : (
                                <span className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-100 text-emerald-700 text-[11px] font-black">
                                    <CheckCircle2 className="w-3 h-3"/>موقَّع · {new Date(v.teacherSignedAt).toLocaleDateString("ar-EG")}
                                </span>
                            )}
                        </div>
                    </div>
                ))}
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
