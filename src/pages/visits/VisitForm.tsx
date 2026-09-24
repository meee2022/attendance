import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
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

const DRAFT_KEY = "visit-form-autosave";

const RATING_COLORS: Record<string, string> = {
    "3": "#059669", "2": "#2563eb", "1": "#d97706", "0": "#dc2626", not_measured: "#64748b",
};

type FormState = {
    department: string;
    teacherId: string;
    classId: string;
    subjectName: string;
    lessonTopic: string;
    visitDate: string;
    followUpType: "full" | "partial" | null;
    ratings: Record<string, Rating>;
    planningRec: string;
    executionRec: string;
    evalMgmtRec: string;
    notes: string;
};

function emptyForm(today: string): FormState {
    return {
        department: "", teacherId: "", classId: "", subjectName: "", lessonTopic: "",
        visitDate: today, followUpType: "full", ratings: {},
        planningRec: "", executionRec: "", evalMgmtRec: "", notes: "",
    };
}

function fromVisit(v: VisitRow & { classId?: string | null }): FormState {
    return {
        department: v.department,
        teacherId: v.teacherId ?? "",
        classId: (v as any).classId ?? "",
        subjectName: v.subjectName,
        lessonTopic: v.lessonTopic,
        visitDate: v.visitDate,
        followUpType: v.followUpType,
        ratings: parseRatings(v.ratings),
        planningRec: v.planningRec, executionRec: v.executionRec,
        evalMgmtRec: v.evalMgmtRec, notes: v.notes,
    };
}

export default function VisitForm({ setup, session, editingId, visits, onDone }: {
    setup: any;
    session: Session;
    editingId: string | null;
    visits: VisitRow[];
    onDone: () => void;
}) {
    const criteria: { _id: string; domain: Domain; text: string }[] = setup.criteria;
    const editing = editingId ? visits.find(v => v._id === editingId) ?? null : null;
    const editingSubmitted = editing?.status === "submitted";

    const [form, setForm] = useState<FormState>(() => {
        if (editing) return fromVisit(editing);
        try {
            const saved = localStorage.getItem(DRAFT_KEY);
            if (saved) return { ...emptyForm(setup.today), ...JSON.parse(saved) };
        } catch { /* storage unavailable */ }
        return emptyForm(setup.today);
    });
    const [restored] = useState(() => !editing && (() => {
        try { return Boolean(localStorage.getItem(DRAFT_KEY)); } catch { return false; }
    })());

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

    // Keep a copy on the device while writing a new visit — a dropped
    // connection or a closed tab must not cost the visitor the lesson.
    const firstRender = useRef(true);
    useEffect(() => {
        if (editing) return;
        if (firstRender.current) { firstRender.current = false; return; }
        try { localStorage.setItem(DRAFT_KEY, JSON.stringify(form)); } catch { /* ignore */ }
    }, [form, editing]);

    const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm(f => ({ ...f, [k]: v }));

    const teachers: any[] = setup.teachers;
    const teachersInDept = form.department ? teachers.filter(t => t.department === form.department) : teachers;
    const teacher = teachers.find(t => t._id === form.teacherId);

    const scores = useMemo(() => computeScores(form.ratings, criteria), [form.ratings, criteria]);
    const issues: ValidationIssue[] = useMemo(() => validateVisit({
        teacherId: form.teacherId, classId: form.classId, lessonTopic: form.lessonTopic,
        visitDate: form.visitDate, followUpType: form.followUpType, ratings: form.ratings,
        planningRec: form.planningRec, executionRec: form.executionRec,
        evalMgmtRec: form.evalMgmtRec, notes: form.notes,
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
        setSaving(status);
        try {
            const res = await saveVisit({
                id: (editingId ?? undefined) as any,
                visitorRole: editing?.visitorRole ?? session.role,
                visitorId: (session.visitorId as any) || undefined,
                visitorName: editing?.visitorName ?? session.name,
                teacherId: (form.teacherId || undefined) as any,
                classId: (form.classId || undefined) as any,
                subjectName: form.subjectName || form.department,
                lessonTopic: form.lessonTopic,
                visitDate: form.visitDate,
                followUpType: form.followUpType ?? undefined,
                ratings: JSON.stringify(form.ratings),
                planningRec: form.planningRec, executionRec: form.executionRec,
                evalMgmtRec: form.evalMgmtRec, notes: form.notes,
                status,
                confirmDuplicate,
                oldDateReason: oldDateReason || undefined,
                editReason: editReason || undefined,
                actorName: session.name,
            }) as any;

            if (!res.ok && res.duplicate) { setDuplicate(res.duplicate); return; }
            try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
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
        try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
        setForm(emptyForm(setup.today));
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
                <div className="flex gap-2 justify-center flex-wrap">
                    {saved.status === "submitted" && (
                        <a href={`/supervision/print/${saved.id}?autoprint=1`} target="_blank" rel="noreferrer"
                            className="flex items-center gap-2 px-5 py-3 rounded-xl bg-qatar-maroon text-white font-black text-sm">
                            <Printer className="w-4 h-4"/>الاستمارة (PDF)
                        </a>
                    )}
                    <button onClick={resetForm}
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
        <div className="space-y-4 pb-28">
            {restored && !editing && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 flex items-center justify-between gap-3 flex-wrap text-xs font-bold text-amber-900">
                    <span>استُرجعت زيارة لم تُحفظ من آخر مرة على هذا الجهاز.</span>
                    <button onClick={resetForm} className="flex items-center gap-1 text-amber-800 hover:underline">
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
                        <select value={form.department} disabled={editingSubmitted}
                            onChange={e => setForm(f => ({ ...f, department: e.target.value, teacherId: "" }))}
                            className={inputCls}>
                            <option value="">كل الأقسام</option>
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
                    <span className="text-xs font-bold text-slate-400 mr-auto">
                        الزائر: {ROLE_LABELS[editing?.visitorRole ?? session.role]} · {editing?.visitorName ?? session.name}
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
                                    <h4 className="font-black text-slate-800">
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
                                                className="px-2 py-1 rounded-md text-[10px] font-black border border-slate-200 text-slate-500 hover:border-slate-400">
                                                {r.value === "not_measured" ? "لم يُقَس" : r.value}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                {list.map(c => {
                                    const n = criteria.indexOf(c) + 1;
                                    const current = form.ratings[c._id];
                                    return (
                                        <div key={c._id}
                                            className={`rounded-xl border p-3 ${current === undefined ? "border-slate-200 bg-white" : "border-slate-100 bg-slate-50"}`}>
                                            <p className="text-sm font-bold text-slate-800 leading-relaxed">
                                                <span className="text-slate-400 ml-1">{n}.</span>{c.text}
                                            </p>
                                            <div className="grid grid-cols-5 gap-1.5 mt-2">
                                                {RATING_SCALE.map(r => {
                                                    const active = current === r.value;
                                                    const color = RATING_COLORS[String(r.value)];
                                                    return (
                                                        <button key={String(r.value)} type="button" onClick={() => rate(c._id, r.value)}
                                                            aria-pressed={active} title={r.label}
                                                            className="min-h-[44px] rounded-lg border-2 text-xs font-black transition-colors px-1"
                                                            style={active
                                                                ? { background: color, borderColor: color, color: "#fff" }
                                                                : { borderColor: "#e2e8f0", color: "#475569", background: "#fff" }}>
                                                            <span className="block text-sm">{r.value === "not_measured" ? "—" : r.value}</span>
                                                            <span className="block text-[10px] font-bold opacity-80">{r.short}</span>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })}
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
                    <RecField label="توصيات التقويم والإدارة الصفية" value={form.evalMgmtRec} onChange={v => set("evalMgmtRec", v)}
                        suggestions={(bank ?? []).filter(b => b.domain === "evaluation" || b.domain === "management")}/>
                    <RecField label="ملاحظات وتوصيات عامة" value={form.notes} onChange={v => set("notes", v)}
                        suggestions={(bank ?? []).filter(b => b.domain === "general")}/>
                </div>
            </Section>

            {/* Sticky bar: progress, live average, save */}
            <div className="fixed bottom-0 inset-x-0 z-30 bg-white/95 backdrop-blur border-t border-slate-200">
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
                                    ["الزائر", `${ROLE_LABELS[editing?.visitorRole ?? session.role]} — ${editing?.visitorName ?? session.name}`],
                                    ["الدرس", form.lessonTopic || "—"],
                                    ["المتابعة", form.followUpType === "partial" ? "جزئيّة" : "كليّة"],
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

const inputCls = "w-full border-2 border-slate-100 rounded-xl px-3 py-2.5 text-sm font-bold bg-slate-50 focus:outline-none focus:border-qatar-maroon disabled:opacity-60";

function Section({ n, title, right, children }: { n: number; title: string; right?: React.ReactNode; children: React.ReactNode }) {
    return (
        <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between gap-3">
                <h3 className="font-black text-slate-800 flex items-center gap-2">
                    <span className="w-7 h-7 rounded-full bg-qatar-maroon text-white text-xs flex items-center justify-center">{n}</span>
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
            <span className={`block text-xs font-black mb-1.5 ${error ? "text-slate-700" : "text-slate-500"}`}>
                {label}{error ? <span className="text-rose-500"> *</span> : null}
            </span>
            {children}
        </label>
    );
}

function RecField({ label, value, onChange, suggestions }: {
    label: string; value: string; onChange: (v: string) => void; suggestions: { _id: string; text: string }[];
}) {
    const [open, setOpen] = useState(false);
    const add = (text: string) => onChange(value.trim() ? `${value.trim()}\n${text}` : text);
    return (
        <div>
            <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-black text-slate-500">{label}</span>
                {suggestions.length > 0 && (
                    <button type="button" onClick={() => setOpen(o => !o)}
                        className="text-[11px] font-black text-qatar-maroon hover:underline">
                        {open ? "إخفاء العبارات" : `عبارات جاهزة (${suggestions.length})`}
                    </button>
                )}
            </div>
            <textarea value={value} onChange={e => onChange(e.target.value)} rows={4}
                className="w-full border-2 border-slate-100 rounded-xl px-3 py-2 text-sm font-bold bg-slate-50 focus:outline-none focus:border-qatar-maroon leading-relaxed"/>
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
