import { AutoArchiveVisit } from "./VisitArchive";
import { useUnsavedChanges } from "../../lib/useUnsavedChanges";
import { useEffect, useMemo, useState } from "react";
import { useSupervisionQuery as useQuery, useSupervisionMutation as useMutation } from "../../lib/supervisionSession";
// @ts-ignore
import { api } from "../../../convex/_generated/api";
import {
    AlertTriangle, CheckCircle2, FileText, Loader2, Printer, RotateCcw, Save, Send, X,
} from "lucide-react";
import {
    DOMAINS, DOMAIN_LABELS, RATING_SCALE, ROLE_LABELS,
    computeScores, dayName, formatDate, parseRatings, validateVisit,
    type Domain, type Rating, type ValidationIssue,
} from "../../../convex/visitMath";
import { pct, scoreTone, type VisitRow } from "../../lib/visitStats";
import type { Session } from "./VisitsPage";

// The ministry form, laid out for a tablet held in the back of a classroom:
// pick the teacher (the department follows), tap one rating per criterion,
// write the recommendations, then review. The average moves as you tap, and
// the review screen lists anything the server would refuse before it is sent.

const DRAFT_PREFIX = "supervision-draft-v2";

const RATING_COLORS: Record<string, string> = {
    "3": "#059669", "2": "#2563eb", "1": "#d97706", "0": "#dc2626", not_measured: "#64748b",
};

type FormState = {
    recordedRole?: "coordinator" | "supervisor";
    supervisorId?: string;
    department: string;
    teacherId: string;
    classId: string;
    subjectName: string;
    lessonTopic: string;
    visitDate: string;
    followUpType: "full" | "partial" | null;
    deliveryMode: "field" | "remote";
    streamMode: "merged" | "unmerged" | "";
    ratings: Record<string, Rating>;
    planningRec: string;
    executionRec: string;
    evalMgmtRec: string;
    managementRec: string;
    notes: string;
};

function emptyForm(today: string, department = ""): FormState {
    return {
        department, teacherId: "", classId: "", subjectName: "", lessonTopic: "",
        visitDate: today, followUpType: "full", deliveryMode: "field", streamMode: "", ratings: {},
        planningRec: "", executionRec: "", evalMgmtRec: "", managementRec: "", notes: "",
    };
}

// Anything the visitor actually entered — an untouched form is not a draft
function hasContent(f: FormState): boolean {
    return Boolean(f.teacherId || f.classId || f.lessonTopic.trim()
        || Object.keys(f.ratings).length
        || f.planningRec.trim() || f.executionRec.trim() || f.evalMgmtRec.trim() || f.managementRec.trim() || f.notes.trim());
}

function fromVisit(v: VisitRow & { classId?: string | null }): FormState {
    return {
        recordedRole: v.visitorRole === "supervisor" ? "supervisor" : "coordinator",
        supervisorId: v.visitorRole === "supervisor" ? v.visitorId ?? "" : "",
        department: v.department,
        teacherId: v.teacherId ?? "",
        classId: (v as any).classId ?? "",
        subjectName: v.subjectName,
        lessonTopic: v.lessonTopic,
        visitDate: v.visitDate,
        followUpType: v.followUpType,
        deliveryMode: v.deliveryMode ?? "field",
        streamMode: v.streamMode ?? "",
        ratings: parseRatings(v.ratings),
        planningRec: v.planningRec, executionRec: v.executionRec,
        evalMgmtRec: v.evalMgmtRec, managementRec: v.managementRec ?? "", notes: v.notes,
    };
}

export default function VisitForm({ setup, session, editingId, visits, onDone, onDirtyChange, onNewVisit }: {
    setup: any;
    session: Session;
    editingId: string | null;
    visits: VisitRow[];
    onDone: () => void;
    onDirtyChange?: (dirty: boolean) => void;
    onNewVisit?: () => void;
}) {
    const criteria: { _id: string; domain: Domain; text: string }[] = setup.criteria;
    const soleDepartment: string = setup.departments.length === 1 ? setup.departments[0] : "";
    const editing = editingId ? visits.find(v => v._id === editingId) ?? null : null;
    const editingSubmitted = editing?.status === "submitted";

    const draftKey = `${DRAFT_PREFIX}:${session.role}:${session.visitorId ?? session.name}:${editingId ?? "new"}`;
    const [storageError, setStorageError] = useState(false);
    const [baseUpdatedAt, setBaseUpdatedAt] = useState(() => {
        try {
            const stored = JSON.parse(localStorage.getItem(draftKey) || "null");
            if (editing && typeof stored?.baseUpdatedAt === "number") return stored.baseUpdatedAt;
        } catch { /* use the server version */ }
        return editing?.updatedAt;
    });
    const [initial] = useState<{ form: FormState; restored: boolean }>(() => {
        try {
            const saved = localStorage.getItem(draftKey);
            if (saved) {
                const restoredForm = { ...emptyForm(setup.today, soleDepartment), ...JSON.parse(saved).form };
                // a draft left by someone from another department is not shown,
                // and a form nobody started is not worth announcing
                if (hasContent(restoredForm)
                    && (!restoredForm.department || setup.departments.includes(restoredForm.department))) {
                    return { form: restoredForm, restored: true };
                }
            }
        } catch { /* storage unavailable */ }
        return { form: editing ? fromVisit(editing) : emptyForm(setup.today, soleDepartment), restored: false };
    });
    const [form, setForm] = useState<FormState>(initial.form);
    const [restored, setRestored] = useState(initial.restored);
    const [baseline, setBaseline] = useState(() => editing ? fromVisit(editing) : emptyForm(setup.today, soleDepartment));

    const [reviewOpen, setReviewOpen] = useState(false);
    const [saving, setSaving] = useState<"draft" | "submitted" | null>(null);
    const [serverError, setServerError] = useState("");
    const [duplicate, setDuplicate] = useState<any>(null);
    const [oldDateReason, setOldDateReason] = useState("");
    const [editReason, setEditReason] = useState("");
    const [saved, setSaved] = useState<{ id: string; status: "draft" | "submitted"; recordNo: number | null } | null>(null);

    // @ts-ignore
    const saveVisit = useMutation(api.visits.saveVisit);
    // @ts-ignore
    const bank = useQuery(api.supervision.getRecommendationBank) as any[] | undefined;

    const dirty = !saved && JSON.stringify(form) !== JSON.stringify(baseline);
    useUnsavedChanges(dirty, onDirtyChange);
    useEffect(() => {
        if (saved || !dirty) return;
        try {
            localStorage.setItem(draftKey, JSON.stringify({ form, baseUpdatedAt: baseUpdatedAt ?? null }));
            setStorageError(false);
        } catch { setStorageError(true); }
    }, [form, dirty, saved, draftKey, baseUpdatedAt]);

    const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm(f => ({ ...f, [k]: v }));

    const teachers: any[] = setup.teachers;
    const teachersInDept = form.department ? teachers.filter(t => t.department === form.department) : teachers;
    const teacher = teachers.find(t => t._id === form.teacherId);

    const recordedRole = editing?.visitorRole ?? (session.role === "coordinator" ? form.recordedRole ?? "coordinator" : session.role);
    const availableSupervisors = setup.visitors.filter((v: any) => v.role === "supervisor" && (!form.department || v.subjects.includes(form.department)));
    const selectedSupervisor = availableSupervisors.find((v: any) => v._id === form.supervisorId);
    const recordedName = editing?.visitorName ?? (recordedRole === "supervisor" ? selectedSupervisor?.fullName ?? "اختر الموجه" : session.name);

    const scores = useMemo(() => computeScores(form.ratings, criteria), [form.ratings, criteria]);
    const issues: ValidationIssue[] = useMemo(() => validateVisit({
        teacherId: form.teacherId, classId: form.classId, lessonTopic: form.lessonTopic,
        visitDate: form.visitDate, followUpType: form.followUpType, ratings: form.ratings,
        planningRec: form.planningRec, executionRec: form.executionRec,
        evalMgmtRec: form.evalMgmtRec, managementRec: form.managementRec, notes: form.notes,
    }, criteria, { today: setup.today, allowOldDate: Boolean(oldDateReason.trim()) }), [form, criteria, setup.today, oldDateReason]);
    const dateTooOld = issues.some(i => i.message.includes("أقدم من سنة"));

    const classesByGrade = useMemo(() => {
        const groups = new Map<number, any[]>();
        for (const c of setup.classes) groups.set(c.grade, [...(groups.get(c.grade) ?? []), c]);
        return [...groups.entries()].sort((a, b) => a[0] - b[0]);
    }, [setup.classes]);

    const pickTeacher = (id: string) => {
        const t = teachers.find(x => x._id === id);
        setForm(f => ({
            ...f, teacherId: id,
            department: t?.department ?? f.department,
            subjectName: f.subjectName && f.teacherId === id ? f.subjectName : (t?.department ?? ""),
        }));
    };

    const rate = (criterionId: string, value: Rating) =>
        setForm(f => ({ ...f, ratings: { ...f.ratings, [criterionId]: value } }));

    const rateDomain = (domain: Domain, value: Rating) =>
        setForm(f => {
            const next = { ...f.ratings };
            for (const c of criteria) if (c.domain === domain && next[c._id] === undefined) next[c._id] = value;
            return { ...f, ratings: next };
        });

    const submit = async (status: "draft" | "submitted", confirmDuplicate = false) => {
        setServerError("");
        if (!editing && recordedRole === "supervisor" && !selectedSupervisor) { setServerError("اختر الموجه المسجل للقسم قبل الحفظ"); return; }
        setSaving(status);
        try {
            const res = await saveVisit({
                id: (editingId ?? undefined) as any,
                expectedUpdatedAt: baseUpdatedAt,
                visitorRole: recordedRole,
                visitorId: (recordedRole === "supervisor" ? form.supervisorId : session.visitorId) as any || undefined,
                visitorName: recordedName,
                teacherId: (form.teacherId || undefined) as any,
                classId: (form.classId || undefined) as any,
                subjectName: form.subjectName || form.department,
                lessonTopic: form.lessonTopic,
                visitDate: form.visitDate,
                followUpType: form.followUpType ?? undefined,
                deliveryMode: form.deliveryMode,
                streamMode: form.deliveryMode === "remote" && form.streamMode ? form.streamMode : undefined,
                ratings: JSON.stringify(form.ratings),
                planningRec: form.planningRec, executionRec: form.executionRec,
                evalMgmtRec: form.evalMgmtRec, managementRec: form.managementRec, notes: form.notes,
                status,
                confirmDuplicate,
                oldDateReason: oldDateReason || undefined,
                editReason: editReason || undefined,
                actorName: session.name,
            }) as any;

            if (!res.ok && res.duplicate) { setDuplicate(res.duplicate); return; }
            try { localStorage.removeItem(draftKey); } catch { /* ignore */ }
            setDuplicate(null);
            setReviewOpen(false);
            setSaved({ id: res.id, status, recordNo: res.recordNo });
        } catch (e: any) {
            // ConvexError carries the reason in .data; anything else is unexpected
            setServerError(typeof e?.data === "string" ? e.data : "تعذّر الحفظ — تحقّق من الاتصال وأعد المحاولة");
        } finally {
            setSaving(null);
        }
    };

    const resetForm = () => {
        setRestored(false);
        setBaseUpdatedAt(editing?.updatedAt);
        setBaseline(editing ? fromVisit(editing) : emptyForm(setup.today, soleDepartment));
        try { localStorage.removeItem(draftKey); } catch { /* ignore */ }
        setForm(editing ? fromVisit(editing) : emptyForm(setup.today, soleDepartment));
        setSaved(null);
        setOldDateReason("");
    };

    if (saved) {
        return (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8 text-center space-y-4">
                <CheckCircle2 className="w-14 h-14 mx-auto text-emerald-600"/>
                <div>
                    <p className="text-xl font-black text-slate-800">
                        {saved.status === "submitted" ? "اعتُمدت الزيارة" : "حُفظت المسودة"}
                    </p>
                    <p className="text-sm font-bold text-slate-500 mt-1">
                        {teacher?.fullName} · {formatDate(form.visitDate)}
                        {saved.recordNo ? ` · رقم السجل ${saved.recordNo}` : ""}
                        {scores.average !== null ? ` · المعدل ${pct(scores.average)}` : ""}
                    </p>
                </div>
                {saved.status === "submitted" && <AutoArchiveVisit visitId={saved.id}/>}
                <div className="flex gap-2 justify-center flex-wrap">
                    {saved.status === "submitted" && (
                        <button onClick={() => window.open(`/supervision/print/${saved.id}?autoprint=1`, "_blank")}
                            className="flex items-center gap-2 px-5 py-3 rounded-xl bg-qatar-maroon text-white font-black text-sm">
                            <Printer className="w-4 h-4"/>الاستمارة (PDF)
                        </button>
                    )}
                    <button onClick={() => editingId ? onNewVisit?.() : resetForm()}
                        className="flex items-center gap-2 px-5 py-3 rounded-xl border-2 border-slate-200 font-black text-sm text-slate-700 hover:border-qatar-maroon">
                        زيارة جديدة
                    </button>
                    <button onClick={onDone}
                        className="flex items-center gap-2 px-5 py-3 rounded-xl border-2 border-slate-200 font-black text-sm text-slate-700 hover:border-qatar-maroon">
                        سجل الزيارات
                    </button>
                </div>
            </div>
        );
    }

    const doneCount = Object.keys(form.ratings).filter(id => criteria.some(c => c._id === id)).length;

    return (
        <div className="space-y-4 pb-56 lg:pb-28">
            {editing && baseUpdatedAt !== editing.updatedAt && <p role="alert" className="rounded-xl p-3 bg-amber-50 text-amber-900 text-sm">توجد نسخة أحدث من الزيارة في السجل. احتفظ بملاحظاتك قبل البدء من جديد؛ لن تُستبدل النسخة الأحدث بتعديلك القديم.</p>}
            {storageError && <p role="alert" className="p-3 bg-amber-50 text-amber-900 rounded-xl">الحفظ على الجهاز غير متاح؛ احفظ المسودة قبل المغادرة.</p>}
            {restored && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 flex items-center justify-between gap-3 flex-wrap text-xs font-bold text-amber-900">
                    <span>استُرجعت زيارة لم تُحفظ من آخر مرة على هذا الجهاز.</span>
                    <button onClick={() => { if (window.confirm("تجاهل النسخة المحلية والبدء من السجل المحفوظ؟")) resetForm(); }} className="flex items-center gap-1 text-amber-800 hover:underline">
                        <RotateCcw className="w-3.5 h-3.5"/>ابدأ من جديد
                    </button>
                </div>
            )}
            {editing && (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs font-bold text-slate-600">
                    تعديل زيارة {editing.teacherName}
                    {editing.recordNo ? ` · رقم السجل ${editing.recordNo}` : ""}
                    {editingSubmitted ? " — الزيارة معتمدة: لا يتغير المعلم ولا التاريخ ولا المادة، وتُحفظ النسخة السابقة." : " — مسودة"}
                </div>
            )}

            {/* ١. المعلم والحصة */}
            <Section n={1} title="المعلم والحصة">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    <Field label="القسم">
                        <select value={form.department} disabled={editingSubmitted || Boolean(soleDepartment)}
                            onChange={e => setForm(f => ({ ...f, department: e.target.value, teacherId: "" }))}
                            className={inputCls}>
                            {!soleDepartment && <option value="">كل الأقسام</option>}
                            {setup.departments.map((d: string) => <option key={d} value={d}>{d}</option>)}
                        </select>
                    </Field>
                    <Field label="المعلم" error={!form.teacherId}>
                        <select value={form.teacherId} disabled={editingSubmitted}
                            onChange={e => pickTeacher(e.target.value)} className={inputCls}>
                            <option value="">— اختر المعلم —</option>
                            {teachersInDept.map((t: any) => (
                                <option key={t._id} value={t._id}>
                                    {t.fullName}{form.department ? "" : ` — ${t.department}`}
                                </option>
                            ))}
                        </select>
                    </Field>
                    <Field label="المادة">
                        <input value={form.subjectName} disabled={editingSubmitted}
                            onChange={e => set("subjectName", e.target.value)}
                            list="visit-subjects" className={inputCls} placeholder="تُعبأ من قسم المعلم"/>
                        <datalist id="visit-subjects">
                            {setup.departments.map((d: string) => <option key={d} value={d}/>)}
                        </datalist>
                    </Field>
                    <Field label="الصف / الشعبة" error={!form.classId}>
                        <select value={form.classId} onChange={e => set("classId", e.target.value)} className={inputCls}>
                            <option value="">— اختر الشعبة —</option>
                            {classesByGrade.map(([grade, list]) => (
                                <optgroup key={grade} label={`الصف ${grade}`}>
                                    {list.map((c: any) => (
                                        <option key={c._id} value={c._id}>{c.name}{c.track ? ` (${c.track})` : ""}</option>
                                    ))}
                                </optgroup>
                            ))}
                        </select>
                    </Field>
                    <Field label="عنوان الدرس" error={!form.lessonTopic.trim()}>
                        <input value={form.lessonTopic} onChange={e => set("lessonTopic", e.target.value)}
                            className={inputCls} placeholder="مثال: التوافيق"/>
                    </Field>
                    <Field label={`التاريخ${form.visitDate ? ` · ${dayName(form.visitDate)}` : ""}`}>
                        <input type="date" value={form.visitDate} max={setup.today} disabled={editingSubmitted}
                            onChange={e => set("visitDate", e.target.value)} className={inputCls}/>
                    </Field>
                </div>

                {session.role === "coordinator" && !editing && <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                    <Field label="الزيارة باسم">
                        <select className={inputCls} value={form.recordedRole ?? "coordinator"} onChange={e => setForm(f => ({ ...f, recordedRole: e.target.value as "coordinator" | "supervisor", supervisorId: "" }))}>
                            <option value="coordinator">المنسق — {session.name}</option><option value="supervisor">الموجه — يسجلها المنسق</option>
                        </select>
                    </Field>
                    {recordedRole === "supervisor" && <Field label="اسم الموجه">
                        <select className={inputCls} value={form.supervisorId ?? ""} onChange={e => set("supervisorId", e.target.value)}>
                            <option value="">اختر الموجه المسجل للقسم</option>
                            {availableSupervisors.map((v: any) => <option key={v._id} value={v._id}>{v.fullName}</option>)}
                        </select>
                        {!availableSupervisors.length && <p className="text-sm text-qatar-maroon mt-2">يضيف النائب اسم الموجه وأقسامه من إدارة المعلمين والزائرين.</p>}
                    </Field>}
                </div>}
                <div className="flex items-center gap-2 flex-wrap mt-3">
                    <span className="text-xs font-black text-slate-500">نوع المتابعة:</span>
                    {(["full", "partial"] as const).map(t => (
                        <button key={t} type="button" onClick={() => set("followUpType", t)}
                            aria-pressed={form.followUpType === t}
                            className={`px-5 py-2 rounded-xl text-sm font-black border-2 transition-colors ${
                                form.followUpType === t ? "bg-qatar-maroon text-white border-qatar-maroon"
                                                        : "bg-white text-slate-600 border-slate-200"}`}>
                            {t === "full" ? "كليّة" : "جزئيّة"}
                        </button>
                    ))}
                    <span className="w-px h-6 bg-slate-200 mx-1" aria-hidden/>
                    {(["field", "remote"] as const).map(t => (
                        <button key={t} type="button" onClick={() => setForm(f => ({ ...f, deliveryMode: t, streamMode: t === "field" ? "" : f.streamMode }))}
                            aria-pressed={form.deliveryMode === t}
                            className={`px-5 py-2 rounded-xl text-sm font-black border-2 transition-colors ${
                                form.deliveryMode === t ? "bg-qatar-maroon text-white border-qatar-maroon"
                                                        : "bg-white text-slate-600 border-slate-200"}`}>
                            {t === "field" ? "ميدانيّة" : "عن بُعد"}
                        </button>
                    ))}
                    {form.deliveryMode === "remote" && (["merged", "unmerged"] as const).map(t => (
                        <button key={t} type="button" onClick={() => set("streamMode", form.streamMode === t ? "" : t)}
                            aria-pressed={form.streamMode === t}
                            className={`px-4 py-2 rounded-xl text-xs font-black border-2 transition-colors ${
                                form.streamMode === t ? "bg-qatar-maroon/10 text-qatar-maroon border-qatar-maroon"
                                                      : "bg-white text-slate-600 border-slate-200"}`}>
                            {t === "merged" ? "بث مباشر مدمج" : "بث مباشر غير مدمج"}
                        </button>
                    ))}
                    <span className="text-xs font-bold text-slate-400 mr-auto">
                        الزائر: {ROLE_LABELS[recordedRole]} · {recordedName}
                    </span>
                </div>
                {dateTooOld && (
                    <Field label="الزيارة أقدم من سنة — اكتب سبب إدخالها الآن">
                        <input value={oldDateReason} onChange={e => setOldDateReason(e.target.value)}
                            className={inputCls} placeholder="مثال: زيارة موجه وصلت ورقياً"/>
                    </Field>
                )}
            </Section>

            {/* ٢. التقييم */}
            <Section n={2} title="تقدير المعايير"
                right={<span className="text-xs font-black text-slate-500">أُنجز {doneCount} من {criteria.length}</span>}>
                <div className="space-y-5">
                    {DOMAINS.map(domain => {
                        const list = criteria.filter(c => c.domain === domain);
                        if (!list.length) return null;
                        return (
                            <div key={domain} className="space-y-2">
                                <div className="flex items-center justify-between gap-2 flex-wrap">
                                    <h4 className="font-bold text-slate-700 text-sm">
                                        {DOMAIN_LABELS[domain]}
                                        <span className="mr-2 text-xs font-black" style={{ color: scoreTone(scores.domains[domain]) }}>
                                            {pct(scores.domains[domain])}
                                        </span>
                                    </h4>
                                    <div className="flex gap-1 items-center">
                                        <span className="text-[10px] font-bold text-slate-400">تعبئة الباقي بـ</span>
                                        {RATING_SCALE.map(r => (
                                            <button key={String(r.value)} type="button" onClick={() => rateDomain(domain, r.value)}
                                                title={`تعبئة معايير «${DOMAIN_LABELS[domain]}» غير المقدَّرة بـ: ${r.label}`}
                                                className="px-2 py-0.5 rounded-md text-[10px] font-bold text-slate-500 hover:bg-slate-100">
                                                {r.value === "not_measured" ? "لم يُقَس" : r.value}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div className="rounded-xl border border-slate-100 overflow-hidden">
                                    {list.map((c, idx) => {
                                        const n = criteria.indexOf(c) + 1;
                                        const current = form.ratings[c._id];
                                        return (
                                            <div key={c._id}
                                                className={`grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-2 items-center px-3 py-2 ${idx ? "border-t border-slate-100" : ""} ${current === undefined ? "bg-white" : "bg-slate-50"}`}>
                                                <p className="text-sm text-slate-800 leading-relaxed">
                                                    <span className="text-slate-400 font-bold ml-1">{n}.</span>{c.text}
                                                </p>
                                                <div className="grid grid-cols-5 gap-1 lg:w-[380px]" role="radiogroup" aria-label={`تقدير المعيار ${n}`}>
                                                    {RATING_SCALE.map(r => {
                                                        const active = current === r.value;
                                                        const color = RATING_COLORS[String(r.value)];
                                                        return (
                                                            <button key={String(r.value)} type="button" onClick={() => rate(c._id, r.value)}
                                                                role="radio" aria-checked={active} title={r.label}
                                                                className="min-h-[40px] rounded-lg border text-xs font-bold transition-colors px-1 leading-tight"
                                                                style={active
                                                                    ? { background: color, borderColor: color, color: "#fff" }
                                                                    : { borderColor: "#e2e8f0", color: "#475569", background: "#fff" }}>
                                                                <span className="block text-[13px] font-black">{r.value === "not_measured" ? "—" : r.value}</span>
                                                                <span className="block text-[10px] opacity-80">{r.short}</span>
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
                </div>
            </Section>

            {/* ٣. التوصيات */}
            <Section n={3} title="التوصيات والملاحظات">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    <RecField label="توصيات التخطيط" value={form.planningRec} onChange={v => set("planningRec", v)}
                        suggestions={(bank ?? []).filter(b => b.domain === "planning")}/>
                    <RecField label="توصيات تنفيذ الدرس" value={form.executionRec} onChange={v => set("executionRec", v)}
                        suggestions={(bank ?? []).filter(b => b.domain === "execution")}/>
                    <RecField label="توصيات التقويم" value={form.evalMgmtRec} onChange={v => set("evalMgmtRec", v)}
                        suggestions={(bank ?? []).filter(b => b.domain === "evaluation")}/>
                    <RecField label="توصيات الإدارة الصفية وبيئة التعلم" value={form.managementRec} onChange={v => set("managementRec", v)}
                        suggestions={(bank ?? []).filter(b => b.domain === "management")}/>
                    <RecField label="ملاحظات وتوصيات عامة" value={form.notes} onChange={v => set("notes", v)} wide
                        suggestions={(bank ?? []).filter(b => b.domain === "general")}/>
                </div>
            </Section>

            {/* Sticky bar: progress, live average, save */}
            <div className="fixed bottom-[104px] lg:bottom-0 inset-x-3 lg:inset-x-0 z-30 bg-white/95 backdrop-blur border border-slate-200 lg:border-x-0 lg:border-b-0 rounded-2xl lg:rounded-none shadow-lg lg:shadow-none">
                <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-3 text-xs font-black text-slate-600">
                        <span>{doneCount}/{criteria.length} معيار</span>
                        <span className="text-lg" style={{ color: scoreTone(scores.average) }}>{pct(scores.average)}</span>
                        {issues.length > 0 && (
                            <span className="text-amber-700">{issues.length} {issues.length === 1 ? "ملاحظة" : "ملاحظات"} قبل الاعتماد</span>
                        )}
                    </div>
                    <div className="flex gap-2 mr-auto">
                        {!editingSubmitted && (
                            <button onClick={() => submit("draft")} disabled={!form.teacherId || saving !== null}
                                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-slate-200 text-sm font-black text-slate-700 disabled:opacity-50">
                                {saving === "draft" ? <Loader2 className="w-4 h-4 animate-spin"/> : <Save className="w-4 h-4"/>}
                                حفظ مسودة
                            </button>
                        )}
                        <button onClick={() => { setServerError(""); setDuplicate(null); setReviewOpen(true); }}
                            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-qatar-maroon text-white text-sm font-black">
                            <Send className="w-4 h-4"/>{editingSubmitted ? "مراجعة التعديل" : "مراجعة واعتماد"}
                        </button>
                    </div>
                </div>
                {serverError && !reviewOpen && (
                    <p className="max-w-7xl mx-auto px-4 pb-2 text-xs font-bold text-rose-700">{serverError}</p>
                )}
            </div>

            {reviewOpen && (
                <div className="fixed inset-0 z-40 bg-black/40 flex items-end sm:items-center justify-center p-3" role="dialog" aria-modal="true">
                    <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-auto shadow-xl">
                        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
                            <p className="font-black text-slate-800 flex items-center gap-2"><FileText className="w-4 h-4"/>مراجعة الزيارة</p>
                            <button onClick={() => setReviewOpen(false)} aria-label="إغلاق"><X className="w-5 h-5 text-slate-400"/></button>
                        </div>
                        <div className="p-5 space-y-4">
                            <dl className="grid grid-cols-3 gap-y-2 text-sm">
                                {[
                                    ["المعلم", teacher?.fullName ?? "—"],
                                    ["القسم", teacher?.department ?? "—"],
                                    ["الصف", setup.classes.find((c: any) => c._id === form.classId)?.name ?? "—"],
                                    ["التاريخ", form.visitDate ? `${dayName(form.visitDate)} ${formatDate(form.visitDate)}` : "—"],
                                    ["الزائر", `${ROLE_LABELS[recordedRole]} — ${recordedName}`],
                                    ["الدرس", form.lessonTopic || "—"],
                                    ["المتابعة", `${form.followUpType === "partial" ? "جزئيّة" : "كليّة"} · ${form.deliveryMode === "remote"
                                        ? `عن بُعد${form.streamMode ? ` (${form.streamMode === "merged" ? "بث مباشر مدمج" : "بث مباشر غير مدمج"})` : ""}` : "ميدانيّة"}`],
                                    ["المعدل", pct(scores.average, 1)],
                                    ["بريد المعلم", teacher?.email || "—"],
                                ].map(([k, v]) => (
                                    <div key={k} className="contents">
                                        <dt className="font-bold text-slate-500">{k}</dt>
                                        <dd className="col-span-2 font-black text-slate-800">{v}</dd>
                                    </div>
                                ))}
                            </dl>

                            {issues.length > 0 && (
                                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-bold text-amber-900 space-y-1">
                                    <p className="flex items-center gap-1 font-black"><AlertTriangle className="w-4 h-4"/>قبل الاعتماد:</p>
                                    {issues.map(i => <p key={i.field + i.message}>• {i.message}</p>)}
                                </div>
                            )}

                            {editingSubmitted && (
                                <Field label="سبب التعديل (يُحفظ مع النسخة السابقة)">
                                    <input value={editReason} onChange={e => setEditReason(e.target.value)} className={inputCls}/>
                                </Field>
                            )}

                            {duplicate && (
                                <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-900 space-y-2">
                                    <p>توجد زيارة معتمدة لنفس المعلم من نفس نوع الزائر بنفس التاريخ
                                        ({duplicate.visitorName}{duplicate.recordNo ? ` · سجل ${duplicate.recordNo}` : ""}).</p>
                                    <button onClick={() => submit("submitted", true)} disabled={saving !== null}
                                        className="px-3 py-1.5 rounded-lg bg-rose-700 text-white font-black">
                                        أعتمدها رغم ذلك
                                    </button>
                                </div>
                            )}

                            {serverError && <p className="text-xs font-bold text-rose-700">{serverError}</p>}

                            <button onClick={() => submit("submitted")} disabled={issues.length > 0 || saving !== null}
                                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-qatar-maroon text-white font-black disabled:opacity-40">
                                {saving === "submitted" ? <Loader2 className="w-4 h-4 animate-spin"/> : <CheckCircle2 className="w-4 h-4"/>}
                                {editingSubmitted ? "حفظ التعديل" : "اعتماد الزيارة"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

const inputCls = "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-qatar-maroon disabled:opacity-60 disabled:bg-slate-50";

function Section({ n, title, right, children }: { n: number; title: string; right?: React.ReactNode; children: React.ReactNode }) {
    return (
        <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between gap-3">
                <h3 className="font-bold text-slate-700 text-sm flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-qatar-maroon/10 text-qatar-maroon text-xs font-black flex items-center justify-center">{n}</span>
                    {title}
                </h3>
                {right}
            </div>
            {children}
        </section>
    );
}

function Field({ label, error, children }: { label: string; error?: boolean; children: React.ReactNode }) {
    return (
        <label className="block">
            <span className={`block text-xs font-semibold mb-1.5 ${error ? "text-slate-700" : "text-slate-600"}`}>
                {label}{error ? <span className="text-rose-500"> *</span> : null}
            </span>
            {children}
        </label>
    );
}

function RecField({ label, value, onChange, suggestions, wide = false }: {
    label: string; value: string; onChange: (v: string) => void; suggestions: { _id: string; text: string }[]; wide?: boolean;
}) {
    const [open, setOpen] = useState(false);
    const add = (text: string) => onChange(value.trim() ? `${value.trim()}\n${text}` : text);
    return (
        <div className={wide ? "lg:col-span-2" : undefined}>
            <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold text-slate-600">{label}</span>
                {suggestions.length > 0 && (
                    <button type="button" onClick={() => setOpen(o => !o)}
                        className="text-[11px] font-black text-qatar-maroon hover:underline">
                        {open ? "إخفاء العبارات" : `عبارات جاهزة (${suggestions.length})`}
                    </button>
                )}
            </div>
            <textarea value={value} onChange={e => onChange(e.target.value)} rows={4}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-qatar-maroon leading-relaxed"/>
            {open && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                    {suggestions.map(s => (
                        <button key={s._id} type="button" onClick={() => add(s.text)}
                            className="text-right px-2 py-1 rounded-lg bg-slate-100 text-slate-700 text-[11px] font-bold hover:bg-qatar-maroon/10">
                            + {s.text}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
