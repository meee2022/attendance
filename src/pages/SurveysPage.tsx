import { useState, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
// @ts-ignore
import { api } from "../../convex/_generated/api";
import {
    ClipboardList, Users, BarChart3, Plus, Trash2, ChevronDown, ChevronUp,
    CheckCircle2, Clock, Shield, Eye, EyeOff, Send, RotateCcw, BookOpen,
    Pencil, X, Download, Check, UserCheck, UserX,
} from "lucide-react";

export type { Survey };
type ManageSubTab = "teachers" | "survey";

type Survey = NonNullable<ReturnType<typeof useQuery<typeof api.surveys.getActiveSurvey>>>;
type Respondent = NonNullable<ReturnType<typeof useQuery<typeof api.surveys.getRespondents>>>[number];

const RATING_OPTS = [
    { val: 1, label: "لا أحتاج",     color: "#6b7280" },
    { val: 2, label: "منخفض",        color: "#10b981" },
    { val: 3, label: "متوسط",         color: "#f59e0b" },
    { val: 4, label: "مرتفع",         color: "#ef4444" },
    { val: 5, label: "مرتفع جداً",   color: "#7c3aed" },
] as const;

const MCOL_COLORS = ["#9B1239", "#1e40af", "#065f46"] as const;

// ── Survey Form ────────────────────────────────────────────────────────────
function SurveyForm({ survey, respondent, existingResponse, onSubmitted }: {
    survey: Survey;
    respondent: Respondent;
    existingResponse: { answers: string; subject?: string; yearsExperience?: string; qualification?: string; responseDate?: string } | null | undefined;
    onSubmitted: () => void;
}) {
    const submitResponse = useMutation(api.surveys.submitResponse);
    const [answers, setAnswers] = useState<Record<string, number | string[] | string>>(() => {
        if (existingResponse?.answers) { try { return JSON.parse(existingResponse.answers); } catch { return {}; } }
        return {};
    });
    const [basicInfo, setBasicInfo] = useState({
        subject: existingResponse?.subject ?? "",
        yearsExperience: existingResponse?.yearsExperience ?? "",
        qualification: existingResponse?.qualification ?? "",
        responseDate: existingResponse?.responseDate ?? new Date().toISOString().slice(0, 10),
    });
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    const axisSections = survey.sections.filter(s => s.questions.some(q => q.type === "rating"));
    const questionSections = survey.sections.filter(s => !s.questions.some(q => q.type === "rating"));

    const allRatingQs = axisSections.flatMap(s => s.questions.filter(q => q.type === "rating"));
    const answeredCount = allRatingQs.filter(q => typeof answers[q.id] === "number").length;

    const setRate = (qId: string, val: number) => setAnswers(p => ({ ...p, [qId]: val }));
    const setCheck = (qId: string, opt: string, checked: boolean) =>
        setAnswers(p => { const cur = (p[qId] as string[]) ?? []; return { ...p, [qId]: checked ? [...cur, opt] : cur.filter(o => o !== opt) }; });

    const handleSubmit = async () => {
        setSaving(true);
        try {
            await submitResponse({ respondentId: respondent._id as any, ...basicInfo, answers: JSON.stringify(answers) });
            setSaved(true);
            setTimeout(onSubmitted, 1200);
        } finally { setSaving(false); }
    };

    return (
        <div className="space-y-4 animate-in fade-in duration-300">

            {/* ── Teacher card ── */}
            <div className="rounded-2xl qatar-card-shadow overflow-hidden"
                style={{ background: "linear-gradient(135deg,#9B1239,#C0184C)" }}>
                <div className="px-5 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-full bg-white/20 border-2 border-white/40 flex items-center justify-center font-black text-white text-base flex-shrink-0">
                            {respondent.name[0]}
                        </div>
                        <div>
                            <p className="font-black text-white text-sm leading-tight">{respondent.name}</p>
                            {respondent.department && <p className="text-white/70 text-xs font-bold mt-0.5">{respondent.department}</p>}
                        </div>
                    </div>
                    {existingResponse
                        ? <span className="flex items-center gap-1.5 text-xs font-black bg-white/20 text-white px-3 py-1.5 rounded-full border border-white/30"><CheckCircle2 className="w-3.5 h-3.5"/>تم الإرسال</span>
                        : <span className="text-xs font-bold text-white/60">{answeredCount}/{allRatingQs.length} سؤال</span>
                    }
                </div>
                {/* Progress bar */}
                <div className="px-5 pb-3">
                    <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
                        <div className="h-full bg-white/80 rounded-full transition-all duration-500"
                            style={{ width: `${allRatingQs.length > 0 ? (answeredCount / allRatingQs.length) * 100 : 0}%` }} />
                    </div>
                </div>
            </div>

            {/* ── Scale legend ── */}
            <div className="rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="px-4 py-2 bg-slate-50 border-b border-slate-100 flex items-center justify-end gap-1.5">
                    <span className="text-[11px] font-black text-slate-400">مقياس التقييم</span>
                </div>
                <div className="grid grid-cols-5 text-center">
                    {RATING_OPTS.map((o, i) => (
                        <div key={o.val} className={`py-3 px-1 ${i < RATING_OPTS.length - 1 ? "border-l border-slate-100" : ""}`}
                            style={{ background: o.color + "10" }}>
                            <p className="text-lg font-black" style={{ color: o.color }}>{o.val}</p>
                            <p className="text-[9px] font-bold leading-tight mt-0.5" style={{ color: o.color }}>{o.label}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* ── Basic info ── */}
            <div className="rounded-2xl overflow-hidden shadow-sm border border-slate-100">
                <div className="px-5 py-3.5 flex items-center justify-between"
                    style={{ background: "linear-gradient(135deg,#9B123922 0%,#9B12390a 100%)", borderRight: "4px solid #9B1239" }}>
                    <span className="font-black text-slate-800 text-sm">بيانات المعلم</span>
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-slate-400">المعلومات الأساسية</span>
                        <BookOpen className="w-4 h-4 text-qatar-maroon" />
                    </div>
                </div>
                <div className="p-4 grid grid-cols-2 gap-3">
                    {([
                        { key: "subject", label: "المادة / المسار", placeholder: "اكتب هنا..." },
                        { key: "yearsExperience", label: "سنوات الخبرة", placeholder: "مثال: 5" },
                        { key: "qualification", label: "المؤهل العلمي", placeholder: "مثال: بكالوريوس تربية خاصة" },
                    ] as const).map(f => (
                        <div key={f.key} className="col-span-2 sm:col-span-1">
                            <label className="block text-xs font-black text-slate-500 mb-1.5 text-right">{f.label}</label>
                            <input value={basicInfo[f.key]} onChange={e => setBasicInfo(p => ({ ...p, [f.key]: e.target.value }))}
                                placeholder={f.placeholder}
                                className="w-full border-2 border-slate-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-qatar-maroon bg-slate-50 text-right transition-colors font-bold text-slate-700" />
                        </div>
                    ))}
                    <div className="col-span-2 sm:col-span-1">
                        <label className="block text-xs font-black text-slate-500 mb-1.5 text-right">التاريخ</label>
                        <input type="date" value={basicInfo.responseDate} onChange={e => setBasicInfo(p => ({ ...p, responseDate: e.target.value }))}
                            dir="ltr"
                            className="w-full border-2 border-slate-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-qatar-maroon bg-slate-50 transition-colors" />
                    </div>
                </div>
            </div>

            {/* ── Rating sections ── */}
            {axisSections.map((section, sIdx) => {
                const ratingQs = section.questions.filter(q => q.type === "rating");
                const sectionAnswered = ratingQs.filter(q => typeof answers[q.id] === "number").length;
                const pct = ratingQs.length > 0 ? sectionAnswered / ratingQs.length : 0;
                return (
                    <div key={section.id} className="rounded-2xl overflow-hidden shadow-sm border border-slate-100">
                        {/* Header */}
                        <div className="px-5 py-3.5 flex items-center justify-between"
                            style={{ background: `linear-gradient(135deg, ${section.color}22 0%, ${section.color}0a 100%)`, borderRight: `4px solid ${section.color}` }}>
                            <span className="font-black text-slate-800 text-sm">{section.title}</span>
                            <div className="flex items-center gap-2">
                                <div className="w-16 h-1.5 rounded-full bg-white/60 overflow-hidden">
                                    <div className="h-full rounded-full transition-all duration-500"
                                        style={{ width: `${pct * 100}%`, background: section.color }} />
                                </div>
                                <span className="text-[11px] font-black px-2.5 py-1 rounded-full text-white shadow-sm"
                                    style={{ background: section.color }}>{sectionAnswered}/{ratingQs.length}</span>
                            </div>
                        </div>
                        {/* Questions */}
                        <div className="bg-white p-3 space-y-2">
                            {ratingQs.map((q, qi) => {
                                const cur = answers[q.id] as number | undefined;
                                return (
                                    <div key={q.id} className="rounded-xl p-3 border transition-all"
                                        style={{ background: cur ? `${section.color}08` : "#f8fafc", borderColor: cur ? `${section.color}30` : "#f1f5f9" }}>
                                        <div className="flex items-start gap-2 mb-2.5">
                                            <span className="w-6 h-6 rounded-lg flex items-center justify-center text-white text-[11px] font-black flex-shrink-0"
                                                style={{ background: section.color }}>{qi + 1}</span>
                                            <p className="text-[13px] font-bold text-slate-700 leading-relaxed flex-1">{q.text}</p>
                                        </div>
                                        <div className="grid grid-cols-5 gap-1.5">
                                            {RATING_OPTS.map(o => {
                                                const sel = cur === o.val;
                                                return (
                                                    <button key={o.val} onClick={() => setRate(q.id, o.val)}
                                                        className={`py-2 rounded-xl text-[10px] font-black text-center transition-all border leading-tight ${
                                                            sel ? "text-white border-transparent shadow-md scale-105" : "bg-white border-slate-100 text-slate-400 hover:border-slate-200 hover:bg-slate-50"
                                                        }`}
                                                        style={sel ? { background: o.color, boxShadow: `0 4px 12px ${o.color}40` } : {}}>
                                                        {o.label}
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

            {/* ── Multicheck / Textarea sections ── */}
            {questionSections.map(section => {
                const multichecks = section.questions.filter(q => q.type === "multicheck");
                const textareas = section.questions.filter(q => q.type === "textarea");
                const sectionColor = section.color || "#9B1239";
                return (
                    <div key={section.id} className="rounded-2xl overflow-hidden shadow-sm border border-slate-100">
                        {/* Header */}
                        <div className="px-5 py-3.5"
                            style={{ background: `linear-gradient(135deg, ${sectionColor}22 0%, ${sectionColor}0a 100%)`, borderRight: `4px solid ${sectionColor}` }}>
                            <span className="font-black text-slate-800 text-sm block">{section.title}</span>
                        </div>
                        <div className="bg-white p-4 space-y-4">
                            {multichecks.length > 0 && (
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    {multichecks.map((q, qi) => {
                                        const colColor = MCOL_COLORS[qi % MCOL_COLORS.length];
                                        return (
                                            <div key={q.id} className="rounded-xl border border-slate-100 overflow-hidden">
                                                {/* Column header */}
                                                {q.text && (
                                                    <div dir="rtl" className="px-3 py-2.5 flex items-center justify-start gap-2"
                                                        style={{ background: `${colColor}15`, borderBottom: `2px solid ${colColor}30` }}>
                                                        <span className="w-2 h-2 rounded-full flex-shrink-0"
                                                            style={{ background: colColor }} />
                                                        <span className="text-xs font-black"
                                                            style={{ color: colColor }}>{q.text}</span>
                                                    </div>
                                                )}
                                                <div className="p-2 space-y-1.5">
                                                    {q.options?.map(opt => {
                                                        const checked = ((answers[q.id] as string[]) ?? []).includes(opt);
                                                        return (
                                                            <label key={opt}
                                                                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl cursor-pointer transition-all text-sm font-bold border ${
                                                                    checked ? "text-white border-transparent shadow-sm" : "bg-slate-50 border-slate-100 text-slate-600 hover:border-slate-200 hover:bg-white"
                                                                }`}
                                                                style={checked ? { background: colColor, boxShadow: `0 2px 8px ${colColor}40` } : {}}>
                                                                <input type="checkbox" checked={checked} onChange={e => setCheck(q.id, opt, e.target.checked)} className="hidden" />
                                                                <span className="flex-1">{opt}</span>
                                                                <span className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border-2 transition-all ${checked ? "bg-white/30 border-white/60" : "border-slate-300"}`}>
                                                                    {checked && <Check className="w-2.5 h-2.5 text-white" />}
                                                                </span>
                                                            </label>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                            {textareas.map(q => (
                                <div key={q.id}>
                                    {q.text && (
                                        <div className="flex items-center gap-2 mb-2.5">
                                            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: sectionColor }} />
                                            <p className="text-sm font-black" style={{ color: sectionColor }}>{q.text}</p>
                                        </div>
                                    )}
                                    <textarea value={(answers[q.id] as string) ?? ""} onChange={e => setAnswers(p => ({ ...p, [q.id]: e.target.value }))}
                                        rows={5} placeholder="اكتب هنا..."
                                        className="w-full border-2 border-slate-100 rounded-xl px-4 py-3 text-sm focus:outline-none resize-none bg-slate-50 transition-colors font-bold text-slate-700 leading-relaxed"
                                        style={{ outlineColor: sectionColor }}
                                        onFocus={e => e.target.style.borderColor = sectionColor}
                                        onBlur={e => e.target.style.borderColor = ""} />
                                </div>
                            ))}
                        </div>
                    </div>
                );
            })}

            {/* Submit */}
            <button onClick={handleSubmit} disabled={saving || saved}
                className={`w-full py-4 rounded-2xl font-black text-base flex items-center justify-center gap-2 transition-all qatar-card-shadow ${saved ? "bg-emerald-500 text-white" : "text-white hover:opacity-90 active:scale-[0.99]"}`}
                style={saved ? {} : { background: "linear-gradient(135deg,#9B1239 0%,#C0184C 100%)" }}>
                {saved ? <><CheckCircle2 className="w-5 h-5" />تم الحفظ بنجاح!</>
                    : saving ? "جارٍ الحفظ..."
                    : <><Send className="w-4 h-4" />حفظ الإجابات</>}
            </button>
        </div>
    );
}

// ── Answer Tab ─────────────────────────────────────────────────────────────
function AnswerTab({ survey }: { survey: Survey }) {
    const allRespondents = useQuery(api.surveys.getRespondents, { surveyId: survey._id }) ?? [];
    // Only participating teachers see the survey
    const respondents = useMemo(() => allRespondents.filter(r => r.isParticipating !== false), [allRespondents]);
    const [selectedDept, setSelectedDept] = useState<string | null>(null);
    const [selectedId, setSelectedId] = useState<string | null>(null);

    // Group by department
    const deptMap = useMemo(() => {
        const map: Record<string, typeof respondents> = {};
        for (const r of respondents) {
            const k = r.department || "بدون قسم";
            if (!map[k]) map[k] = [];
            map[k].push(r);
        }
        return map;
    }, [respondents]);

    const departments = Object.keys(deptMap);
    const totalDone = respondents.filter(r => r.hasResponded).length;
    const totalPending = respondents.length - totalDone;

    // ── Level 3: Survey form ──
    if (selectedId) {
        return <RespondentForm survey={survey} respondentId={selectedId} onBack={() => setSelectedId(null)} />;
    }

    // ── Level 2: Teachers in selected dept ──
    if (selectedDept) {
        const members = deptMap[selectedDept] ?? [];
        const pending = members.filter(r => !r.hasResponded);
        const done = members.filter(r => r.hasResponded);
        return (
            <div className="space-y-4 animate-in fade-in duration-200">
                {/* Back + dept header */}
                <div className="bg-white rounded-2xl border border-qatar-gray-border qatar-card-shadow overflow-hidden">
                    <div className="bg-qatar-maroon px-5 py-3.5 flex items-center justify-between">
                        <div>
                            <p className="font-black text-white text-sm">{selectedDept}</p>
                            <p className="text-white/60 text-xs font-bold">{members.length} معلم · {done.length} أجابوا</p>
                        </div>
                        <button onClick={() => setSelectedDept(null)}
                            className="flex items-center gap-1.5 text-white/80 hover:text-white text-sm font-black transition-colors">
                            الأقسام <span className="text-base">←</span>
                        </button>
                    </div>
                </div>

                {/* Pending */}
                {pending.length > 0 && (
                    <div className="bg-white rounded-2xl border border-qatar-gray-border qatar-card-shadow overflow-hidden">
                        <div className="px-5 py-2.5 bg-slate-50 border-b border-qatar-gray-border flex items-center justify-between">
                            <span className="text-xs font-black text-slate-500">لم يجيبوا بعد</span>
                            <span className="bg-amber-100 text-amber-700 text-xs font-black px-2 py-0.5 rounded-full">{pending.length}</span>
                        </div>
                        <div className="divide-y divide-qatar-gray-border">
                            {pending.map(r => (
                                <button key={r._id} onClick={() => setSelectedId(r._id)}
                                    className="w-full flex items-center justify-between px-5 py-4 hover:bg-rose-50 transition-colors group">
                                    <p className="font-black text-slate-700 group-hover:text-qatar-maroon text-sm text-right">{r.name}</p>
                                    <div className="w-9 h-9 rounded-full bg-qatar-maroon/10 border border-qatar-maroon/20 group-hover:bg-qatar-maroon group-hover:border-qatar-maroon flex items-center justify-center flex-shrink-0 transition-all">
                                        <span className="text-sm font-black text-qatar-maroon group-hover:text-white">{r.name[0]}</span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Done */}
                {done.length > 0 && (
                    <div className="bg-white rounded-2xl border border-qatar-gray-border qatar-card-shadow overflow-hidden">
                        <div className="px-5 py-2.5 bg-emerald-50 border-b border-emerald-100 flex items-center justify-between">
                            <span className="text-xs font-black text-emerald-600 flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5"/>أجابوا — يمكن التعديل</span>
                            <span className="bg-emerald-100 text-emerald-700 text-xs font-black px-2 py-0.5 rounded-full">{done.length}</span>
                        </div>
                        <div className="divide-y divide-qatar-gray-border">
                            {done.map(r => (
                                <button key={r._id} onClick={() => setSelectedId(r._id)}
                                    className="w-full flex items-center justify-between px-5 py-4 hover:bg-emerald-50 transition-colors group">
                                    <p className="font-black text-emerald-700 text-sm text-right">{r.name}</p>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-bold text-slate-400 group-hover:text-emerald-600">تعديل</span>
                                        <CheckCircle2 className="w-4 h-4 text-emerald-400 group-hover:text-emerald-600 flex-shrink-0" />
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // ── Level 1: Department selection ──
    return (
        <div className="space-y-4 animate-in fade-in duration-300">
            {/* Stats banner */}
            <div className="bg-white rounded-2xl border border-qatar-gray-border qatar-card-shadow p-4">
                <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-black text-slate-400">اختر قسمك أولاً</span>
                    <div className="flex gap-3 text-xs font-bold">
                        <span className="flex items-center gap-1 text-emerald-600"><CheckCircle2 className="w-3.5 h-3.5"/>{totalDone} أجابوا</span>
                        <span className="flex items-center gap-1 text-amber-600"><Clock className="w-3.5 h-3.5"/>{totalPending} لم يجيبوا</span>
                    </div>
                </div>
                {/* Overall progress */}
                <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${respondents.length > 0 ? Math.round((totalDone / respondents.length) * 100) : 0}%`, background: "linear-gradient(90deg,#9B1239,#C0184C)" }} />
                </div>
                <p className="text-[10px] text-slate-400 font-bold mt-1 text-right">
                    {respondents.length > 0 ? Math.round((totalDone / respondents.length) * 100) : 0}% نسبة الاستجابة الكلية
                </p>
            </div>

            {/* Department cards */}
            {departments.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {departments.map(dept => {
                        const members = deptMap[dept];
                        const deptDone = members.filter(r => r.hasResponded).length;
                        const deptPct = Math.round((deptDone / members.length) * 100);
                        const allDone = deptDone === members.length;
                        return (
                            <button key={dept} onClick={() => setSelectedDept(dept)}
                                className="bg-white rounded-2xl border border-qatar-gray-border qatar-card-shadow p-4 text-right hover:border-qatar-maroon/30 hover:shadow-md transition-all group">
                                <div className="flex items-start justify-between mb-3">
                                    <div>
                                        <p className="font-black text-slate-800 text-sm group-hover:text-qatar-maroon transition-colors">{dept}</p>
                                        <p className="text-xs text-slate-400 font-bold mt-0.5">{members.length} معلم</p>
                                    </div>
                                    <div className={`flex items-center gap-1 text-xs font-black px-2 py-1 rounded-lg ${allDone ? "bg-emerald-100 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                                        {allDone ? <CheckCircle2 className="w-3 h-3"/> : <Clock className="w-3 h-3"/>}
                                        {deptDone}/{members.length}
                                    </div>
                                </div>
                                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                    <div className="h-full rounded-full transition-all"
                                        style={{ width: `${deptPct}%`, background: allDone ? "#10b981" : "linear-gradient(90deg,#9B1239,#C0184C)" }} />
                                </div>
                            </button>
                        );
                    })}
                </div>
            ) : (
                <div className="bg-white rounded-2xl border border-qatar-gray-border qatar-card-shadow flex flex-col items-center py-16 gap-3">
                    <Users className="w-10 h-10 text-slate-200"/>
                    <p className="font-black text-slate-400">لم يتم إضافة معلمين بعد</p>
                    <p className="text-xs text-slate-300 font-bold">يرجى مراجعة المسؤول</p>
                </div>
            )}
        </div>
    );
}

function RespondentForm({ survey, respondentId, onBack }: { survey: Survey; respondentId: string; onBack: () => void }) {
    const respondents = useQuery(api.surveys.getRespondents, { surveyId: survey._id }) ?? [];
    const respondent = respondents.find(r => r._id === respondentId);
    const existingResponse = useQuery(api.surveys.getRespondentResponse, { respondentId: respondentId as any });

    if (!respondent) return null;
    if (existingResponse === undefined) return (
        <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-qatar-maroon"/>
        </div>
    );

    return (
        <div>
            <button onClick={onBack} className="flex items-center gap-1.5 text-sm font-black text-slate-400 hover:text-qatar-maroon mb-5 transition-colors">
                <span className="text-base">→</span> العودة لقائمة المعلمين
            </button>
            <SurveyForm survey={survey} respondent={respondent} existingResponse={existingResponse} onSubmitted={onBack} />
        </div>
    );
}

// ── Manage Tab ─────────────────────────────────────────────────────────────
export function ManageTab({ survey }: { survey: Survey }) {
    const [authed, setAuthed] = useState(sessionStorage.getItem("qatar_admin_auth") === "true");
    const [pin, setPin] = useState("");
    const [showPin, setShowPin] = useState(false);
    const [pinError, setPinError] = useState("");
    const [subTab, setSubTab] = useState<ManageSubTab>("teachers");

    if (!authed) {
        return (
            <div className="max-w-sm mx-auto pt-8 space-y-4 animate-in fade-in duration-300">
                <div className="bg-white rounded-2xl border border-qatar-gray-border qatar-card-shadow overflow-hidden">
                    <div className="bg-slate-700 px-5 py-4 flex items-center gap-3">
                        <Shield className="w-5 h-5 text-white/70"/>
                        <span className="font-black text-white">صفحة المسؤول</span>
                    </div>
                    <div className="p-5 space-y-4">
                        <p className="text-sm text-slate-400 font-bold text-center">أدخل رمز PIN للمتابعة</p>
                        <div className="relative">
                            <input type={showPin ? "text" : "password"} value={pin}
                                onChange={e => { setPin(e.target.value); setPinError(""); }}
                                onKeyDown={e => { if (e.key === "Enter") { if (pin === "1234") setAuthed(true); else setPinError("رمز PIN غير صحيح"); } }}
                                placeholder="• • • •"
                                className={`w-full border-2 rounded-xl px-4 py-3 text-center text-2xl tracking-widest font-black focus:outline-none ${pinError ? "border-red-400" : "border-qatar-gray-border focus:border-qatar-maroon"}`} />
                            <button type="button" onClick={() => setShowPin(v=>!v)}
                                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                {showPin ? <EyeOff className="w-4 h-4"/> : <Eye className="w-4 h-4"/>}
                            </button>
                        </div>
                        {pinError && <p className="text-red-500 text-sm text-center font-bold">{pinError}</p>}
                        <button onClick={() => { if (pin === "1234") setAuthed(true); else setPinError("رمز PIN غير صحيح"); }}
                            className="w-full py-3 rounded-xl font-black text-white text-sm transition-all hover:opacity-90"
                            style={{ background: "linear-gradient(135deg, #9B1239, #C0184C)" }}>
                            دخول
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-5 animate-in fade-in duration-300">
            {/* Sub-tab bar */}
            <div className="bg-white rounded-2xl border border-qatar-gray-border qatar-card-shadow overflow-hidden">
                <div className="bg-slate-700 px-5 py-3 flex items-center gap-3">
                    <Shield className="w-4 h-4 text-white/60"/>
                    <span className="font-black text-white text-sm">لوحة الإدارة</span>
                    <div className="mr-auto flex gap-2">
                        {([["teachers", "المعلمون", <Users className="w-3.5 h-3.5"/>], ["survey", "الاستبانة", <ClipboardList className="w-3.5 h-3.5"/>]] as const).map(([k, label, icon]) => (
                            <button key={k} onClick={() => setSubTab(k as ManageSubTab)}
                                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-black transition-all ${subTab === k ? "bg-white text-slate-700 shadow" : "bg-white/10 text-white hover:bg-white/20"}`}>
                                {icon}{label}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="p-5">
                    {subTab === "teachers" ? <TeachersManager survey={survey}/> : <SurveyEditor survey={survey}/>}
                </div>
            </div>
        </div>
    );
}

function TeachersManager({ survey }: { survey: Survey }) {
    const respondents = useQuery(api.surveys.getRespondents, { surveyId: survey._id }) ?? [];
    const addRespondent = useMutation(api.surveys.addRespondent);
    const removeRespondent = useMutation(api.surveys.removeRespondent);
    const updateRespondent = useMutation(api.surveys.updateRespondent);
    const importSchoolTeachers = useMutation(api.surveys.importSchoolTeachers);
    const toggleParticipation = useMutation(api.surveys.toggleRespondentParticipation);
    const setBulkParticipation = useMutation(api.surveys.setBulkParticipation);
    const [name, setName] = useState("");
    const [dept, setDept] = useState("");
    const [adding, setAdding] = useState(false);
    const [importing, setImporting] = useState(false);
    const [importMsg, setImportMsg] = useState("");
    const [error, setError] = useState("");
    const [editId, setEditId] = useState<string | null>(null);
    const [editName, setEditName] = useState("");
    const [editDept, setEditDept] = useState("");
    const [saving, setSaving] = useState(false);

    const departments = useMemo(() => Array.from(new Set(respondents.map(r => r.department).filter(Boolean) as string[])), [respondents]);

    const handleAdd = async () => {
        if (!name.trim()) { setError("يرجى إدخال اسم المعلم"); return; }
        setAdding(true); setError("");
        try {
            await addRespondent({ surveyId: survey._id, name: name.trim(), department: dept.trim() || undefined });
            setName(""); setDept("");
        } catch (e: unknown) { setError(e instanceof Error ? e.message : "حدث خطأ"); }
        finally { setAdding(false); }
    };

    const saveEdit = async () => {
        if (!editName.trim() || !editId) return;
        setSaving(true);
        try { await updateRespondent({ respondentId: editId as any, name: editName.trim(), department: editDept.trim() || undefined }); setEditId(null); }
        finally { setSaving(false); }
    };

    const handleImport = async () => {
        if (!confirm("استيراد 96 معلم من قائمة المدرسة؟ سيتم تخطي من هو مضاف مسبقاً.")) return;
        setImporting(true); setImportMsg("");
        try {
            const result = await importSchoolTeachers({ surveyId: survey._id });
            setImportMsg(`تم إضافة ${(result as any).added} معلم — تم تخطي ${(result as any).skipped} مضافين مسبقاً`);
        } finally { setImporting(false); }
    };

    const byDept = useMemo(() => {
        const map: Record<string, typeof respondents> = {};
        for (const r of respondents) { const k = r.department || "بدون قسم"; if (!map[k]) map[k]=[]; map[k].push(r); }
        return map;
    }, [respondents]);

    return (
        <div className="space-y-4">
            {/* Bulk import */}
            <div className="rounded-xl border border-qatar-maroon/20 bg-rose-50 p-4 flex items-center justify-between gap-3 flex-wrap">
                <div>
                    <p className="font-black text-slate-700 text-sm">استيراد معلمي المدرسة دفعة واحدة</p>
                    <p className="text-xs text-slate-400 mt-0.5">96 معلم موزعون على 16 قسم</p>
                    {importMsg && <p className="text-xs text-emerald-600 font-bold mt-1">{importMsg}</p>}
                </div>
                <button onClick={handleImport} disabled={importing}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-sm font-black hover:opacity-90 disabled:opacity-50 flex-shrink-0"
                    style={{ background: "linear-gradient(135deg, #9B1239, #C0184C)" }}>
                    {importing ? <RotateCcw className="w-4 h-4 animate-spin"/> : <Download className="w-4 h-4"/>}
                    {importing ? "جارٍ الاستيراد..." : "استيراد الكل"}
                </button>
            </div>

            {/* Add single */}
            <div className="space-y-2">
                <p className="text-xs font-black text-slate-500">إضافة معلم منفرد</p>
                <div className="flex gap-2 flex-wrap">
                    <input value={name} onChange={e => { setName(e.target.value); setError(""); }} placeholder="اسم المعلم *"
                        onKeyDown={e => e.key==="Enter" && handleAdd()}
                        className="flex-1 min-w-44 border border-qatar-gray-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-qatar-maroon bg-slate-50"/>
                    <input value={dept} onChange={e => setDept(e.target.value)} placeholder="القسم (اختياري)" list="dl-depts"
                        onKeyDown={e => e.key==="Enter" && handleAdd()}
                        className="flex-1 min-w-36 border border-qatar-gray-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-qatar-maroon bg-slate-50"/>
                    <datalist id="dl-depts">{departments.map(d => <option key={d} value={d}/>)}</datalist>
                    <button onClick={handleAdd} disabled={adding}
                        className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-white text-sm font-black hover:opacity-90 disabled:opacity-50"
                        style={{ background: "linear-gradient(135deg, #9B1239, #C0184C)" }}>
                        <Plus className="w-4 h-4"/>إضافة
                    </button>
                </div>
                {error && <p className="text-red-500 text-xs font-black">{error}</p>}
            </div>

            {/* Stats */}
            <div className="grid grid-cols-4 gap-2">
                {[
                    { label: "إجمالي", val: respondents.length, color: "text-slate-700", bg: "bg-slate-50" },
                    { label: "مشاركون", val: respondents.filter(r=>r.isParticipating !== false).length, color: "text-blue-600", bg: "bg-blue-50" },
                    { label: "أجابوا", val: respondents.filter(r=>r.hasResponded).length, color: "text-emerald-600", bg: "bg-emerald-50" },
                    { label: "لم يجيبوا", val: respondents.filter(r=>!r.hasResponded && r.isParticipating !== false).length, color: "text-amber-600", bg: "bg-amber-50" },
                ].map(s => (
                    <div key={s.label} className={`${s.bg} rounded-xl border border-qatar-gray-border p-3 text-center`}>
                        <p className={`text-2xl font-black ${s.color}`}>{s.val}</p>
                        <p className="text-xs text-slate-400 font-bold mt-0.5">{s.label}</p>
                    </div>
                ))}
            </div>

            {/* List by dept */}
            {Object.entries(byDept).map(([deptKey, members]) => (
                <div key={deptKey} className="rounded-xl border border-qatar-gray-border overflow-hidden">
                    <div dir="rtl" className="bg-slate-100 px-4 py-2 flex items-center justify-between border-b border-qatar-gray-border gap-2">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                            <span className="font-black text-slate-600 text-sm truncate">{deptKey}</span>
                            <span className="text-[10px] text-slate-400 font-black bg-white px-1.5 py-0.5 rounded">{members.filter(m => m.isParticipating !== false).length}/{members.length}</span>
                        </div>
                        <div className="flex gap-1 flex-shrink-0">
                            <button onClick={() => setBulkParticipation({ surveyId: survey._id, department: deptKey === "بدون قسم" ? undefined : deptKey, isParticipating: true })}
                                className="text-[10px] font-black text-emerald-600 hover:bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                تشارك الكل
                            </button>
                            <button onClick={() => setBulkParticipation({ surveyId: survey._id, department: deptKey === "بدون قسم" ? undefined : deptKey, isParticipating: false })}
                                className="text-[10px] font-black text-slate-500 hover:bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                                استبعاد الكل
                            </button>
                        </div>
                    </div>
                    <div className="divide-y divide-qatar-gray-border bg-white">
                        {members.map(r => (
                            <div key={r._id}>
                                {editId === r._id ? (
                                    <div className="flex items-center gap-2 px-3 py-2 bg-blue-50">
                                        <button onClick={() => setEditId(null)} className="p-1 rounded-lg hover:bg-slate-200 text-slate-400 flex-shrink-0">
                                            <X className="w-3.5 h-3.5"/>
                                        </button>
                                        <button onClick={saveEdit} disabled={saving}
                                            className="p-1 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-emerald-600 flex-shrink-0 disabled:opacity-50">
                                            <Check className="w-3.5 h-3.5"/>
                                        </button>
                                        <input value={editDept} onChange={e=>setEditDept(e.target.value)} list="dl-depts"
                                            className="w-32 border border-slate-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-qatar-maroon text-right bg-white" placeholder="القسم"/>
                                        <input value={editName} onChange={e=>setEditName(e.target.value)}
                                            onKeyDown={e=>e.key==="Enter"&&saveEdit()}
                                            className="flex-1 border border-slate-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-qatar-maroon text-right bg-white" placeholder="الاسم"/>
                                    </div>
                                ) : (
                                    <div dir="rtl" className={`flex items-center justify-between px-4 py-3 transition-colors ${r.isParticipating === false ? "bg-slate-50/60 opacity-60" : ""}`}>
                                        <div className="flex items-center gap-2 flex-1 min-w-0">
                                            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${r.hasResponded ? "bg-emerald-500" : "bg-amber-400"}`}/>
                                            <p className={`text-sm font-bold truncate ${r.isParticipating === false ? "text-slate-400 line-through" : "text-slate-700"}`}>{r.name}</p>
                                        </div>
                                        <div className="flex items-center gap-1 flex-shrink-0">
                                            <button onClick={() => toggleParticipation({ respondentId: r._id as any, isParticipating: r.isParticipating === false })}
                                                title={r.isParticipating === false ? "تفعيل المشاركة" : "استبعاد من الاستبانة"}
                                                className={`p-1.5 rounded-lg transition-colors ${r.isParticipating === false ? "text-slate-300 hover:bg-emerald-50 hover:text-emerald-600" : "text-emerald-500 hover:bg-slate-50 hover:text-slate-400"}`}>
                                                {r.isParticipating === false ? <UserX className="w-3.5 h-3.5"/> : <UserCheck className="w-3.5 h-3.5"/>}
                                            </button>
                                            <button onClick={async () => { if (confirm(`حذف ${r.name}؟`)) await removeRespondent({ respondentId: r._id as any }); }}
                                                className="p-1.5 rounded-lg hover:bg-red-50 text-slate-300 hover:text-red-500 transition-colors">
                                                <Trash2 className="w-3.5 h-3.5"/>
                                            </button>
                                            <button onClick={() => { setEditId(r._id); setEditName(r.name); setEditDept(r.department ?? ""); }}
                                                className="p-1.5 rounded-lg hover:bg-blue-50 text-slate-300 hover:text-blue-500 transition-colors">
                                                <Pencil className="w-3.5 h-3.5"/>
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            ))}

            {respondents.length === 0 && (
                <div className="flex flex-col items-center py-10 gap-2 text-slate-400">
                    <Users className="w-8 h-8 opacity-30"/>
                    <p className="font-black text-sm">لا يوجد معلمون مضافون</p>
                    <p className="text-xs">اضغط "استيراد الكل" لإضافة جميع معلمي المدرسة</p>
                </div>
            )}
        </div>
    );
}

function SurveyEditor({ survey }: { survey: Survey }) {
    const updateAxes = useMutation(api.surveys.updateSurveyAxes);
    const resetSurvey = useMutation(api.surveys.resetSurvey);

    const [title, setTitle] = useState(survey.title);
    const [axes, setAxes] = useState<string[]>(() =>
        survey.sections.filter(s => s.questions.some(q => q.type === "rating")).map(s => s.title)
    );
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [resetting, setResetting] = useState(false);

    const addAxis = () => setAxes(p => [...p, ""]);
    const removeAxis = (i: number) => setAxes(p => p.filter((_, idx) => idx !== i));
    const updateAxis = (i: number, val: string) => setAxes(p => p.map((v, idx) => idx === i ? val : v));

    const handleSave = async () => {
        setSaving(true);
        try {
            await updateAxes({ surveyId: survey._id as any, title, axes });
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
        } finally { setSaving(false); }
    };

    const handleReset = async () => {
        if (!confirm("سيُحذف كل شيء ويُعاد ضبط الاستبانة الافتراضية. هل أنت متأكد؟")) return;
        setResetting(true);
        try { await resetSurvey(); } finally { setResetting(false); }
    };

    return (
        <div className="space-y-4">
            {/* Survey title */}
            <div>
                <label className="block text-xs font-black text-slate-500 mb-1.5">عنوان الاستبانة</label>
                <input value={title} onChange={e => setTitle(e.target.value)}
                    className="w-full border border-qatar-gray-border rounded-xl px-4 py-2.5 text-sm font-bold focus:outline-none focus:border-qatar-maroon text-right bg-slate-50" />
            </div>

            {/* Axes list */}
            <div>
                <div className="flex items-center justify-between mb-2">
                    <button onClick={addAxis}
                        className="flex items-center gap-1.5 text-xs font-black text-qatar-maroon hover:opacity-80 transition-opacity">
                        <Plus className="w-3.5 h-3.5"/> إضافة محور
                    </button>
                    <label className="text-xs font-black text-slate-500">المحاور ({axes.length})</label>
                </div>
                <div className="space-y-2">
                    {axes.map((axis, i) => (
                        <div key={i} className="flex items-center gap-2">
                            <button onClick={() => removeAxis(i)}
                                className="p-1.5 rounded-lg hover:bg-red-50 text-slate-300 hover:text-red-500 transition-colors flex-shrink-0">
                                <Trash2 className="w-3.5 h-3.5"/>
                            </button>
                            <input value={axis} onChange={e => updateAxis(i, e.target.value)}
                                placeholder={`المحور ${i + 1}`}
                                className="flex-1 border border-qatar-gray-border rounded-xl px-3 py-2.5 text-sm font-bold focus:outline-none focus:border-qatar-maroon text-right bg-white" />
                            <span className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-black text-slate-400 bg-slate-100 flex-shrink-0">{i + 1}</span>
                        </div>
                    ))}
                    {axes.length === 0 && (
                        <div className="text-center py-6 text-slate-400 text-sm font-bold">
                            لا توجد محاور — اضغط "إضافة محور"
                        </div>
                    )}
                </div>
            </div>

            {/* Save */}
            <button onClick={handleSave} disabled={saving || saved}
                className={`w-full py-3 rounded-xl font-black text-sm flex items-center justify-center gap-2 transition-all ${saved ? "bg-emerald-500 text-white" : "text-white hover:opacity-90"}`}
                style={saved ? {} : { background: "linear-gradient(135deg,#9B1239,#C0184C)" }}>
                {saved ? <><CheckCircle2 className="w-4 h-4"/>تم الحفظ!</> : saving ? "جارٍ الحفظ..." : <><Check className="w-4 h-4"/>حفظ المحاور</>}
            </button>

            {/* Reset */}
            <button onClick={handleReset} disabled={resetting}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-red-200 text-red-500 font-black text-xs hover:bg-red-50 transition-colors disabled:opacity-50">
                <RotateCcw className="w-3.5 h-3.5"/>
                {resetting ? "جارٍ الإعادة..." : "إعادة ضبط للافتراضي"}
            </button>
        </div>
    );
}

// ── Analytics Tab ──────────────────────────────────────────────────────────
const MCOL_COLORS_A = ["#9B1239", "#1e40af", "#065f46"];
const RATING_COLORS_A = ["#6b7280", "#10b981", "#f59e0b", "#ef4444", "#7c3aed"];
const RATING_LABELS_A = ["لا أحتاج", "منخفض", "متوسط", "مرتفع", "مرتفع جداً"];

// ── SVG Chart components ───────────────────────────────────────────────────
function RadarChart({ data, size = 280 }: { data: { label: string; value: number; color: string }[]; size?: number }) {
    if (data.length < 3) return null;
    const cx = size / 2, cy = size / 2;
    const r = size * 0.35;
    const angleFor = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / data.length;
    const point = (i: number, val: number) => {
        const a = angleFor(i);
        const dist = (val / 5) * r;
        return [cx + Math.cos(a) * dist, cy + Math.sin(a) * dist];
    };
    const polygon = data.map((d, i) => point(i, d.value).join(",")).join(" ");
    return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            {[1, 2, 3, 4, 5].map(level => {
                const pts = data.map((_, i) => {
                    const a = angleFor(i);
                    const dist = (level / 5) * r;
                    return [cx + Math.cos(a) * dist, cy + Math.sin(a) * dist].join(",");
                }).join(" ");
                return <polygon key={level} points={pts} fill="none" stroke="#e2e8f0" strokeWidth="1" />;
            })}
            {data.map((_, i) => {
                const [x, y] = point(i, 5);
                return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="#e2e8f0" strokeWidth="1" />;
            })}
            <polygon points={polygon} fill="#9B123933" stroke="#9B1239" strokeWidth="2" />
            {data.map((d, i) => {
                const [px, py] = point(i, d.value);
                return <circle key={i} cx={px} cy={py} r="4" fill={d.color} stroke="#fff" strokeWidth="2" />;
            })}
            {data.map((d, i) => {
                const a = angleFor(i);
                const lx = cx + Math.cos(a) * (r + 22);
                const ly = cy + Math.sin(a) * (r + 22);
                const short = d.label.length > 14 ? d.label.slice(0, 14) + "…" : d.label;
                return (
                    <text key={i} x={lx} y={ly} textAnchor="middle" dominantBaseline="middle"
                        fontSize="9" fontWeight="900" fill="#475569" direction="rtl">
                        {short}
                    </text>
                );
            })}
        </svg>
    );
}

function DistributionBars({ counts, total }: { counts: number[]; total: number }) {
    const maxC = Math.max(...counts, 1);
    return (
        <div dir="rtl" className="flex items-end gap-1 h-16">
            {counts.map((c, i) => {
                const h = total > 0 ? (c / maxC) * 100 : 0;
                const pct = total > 0 ? Math.round((c / total) * 100) : 0;
                return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-0.5" title={`${RATING_LABELS_A[i]}: ${c} (${pct}%)`}>
                        <span className="text-[9px] font-black" style={{ color: RATING_COLORS_A[i] }}>{c}</span>
                        <div className="w-full rounded-t transition-all" style={{ height: `${h}%`, minHeight: c > 0 ? "3px" : "0", background: RATING_COLORS_A[i] }} />
                        <span className="text-[8px] font-bold text-slate-400">{i + 1}</span>
                    </div>
                );
            })}
        </div>
    );
}

function HBarChart({ items }: { items: { label: string; value: number; color: string; max: number; sub?: string }[] }) {
    return (
        <div dir="rtl" className="space-y-2.5">
            {items.map((item, i) => {
                const pct = item.max > 0 ? (item.value / item.max) * 100 : 0;
                return (
                    <div key={i}>
                        <div className="flex items-center justify-between mb-1 gap-2">
                            <span className="text-[11px] font-bold text-slate-700 truncate flex-1">{item.label}</span>
                            <span className="text-[11px] font-black flex-shrink-0" style={{ color: item.color }}>
                                {item.value.toFixed(2)}{item.sub && <span className="text-slate-400 mr-1 font-bold">{item.sub}</span>}
                            </span>
                        </div>
                        <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all duration-700"
                                style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${item.color}, ${item.color}dd)` }} />
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

function Donut({ value, max, color, label, size = 80 }: { value: number; max: number; color: string; label: string; size?: number }) {
    const r = size / 2 - 6;
    const cx = size / 2, cy = size / 2;
    const circ = 2 * Math.PI * r;
    const pct = max > 0 ? value / max : 0;
    const dash = pct * circ;
    return (
        <div className="flex flex-col items-center">
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
                <circle cx={cx} cy={cy} r={r} fill="none" stroke="#e2e8f0" strokeWidth="6" />
                <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth="6" strokeLinecap="round"
                    strokeDasharray={`${dash} ${circ}`} />
            </svg>
            <p className="text-base font-black mt-[-50px]" style={{ color }}>{value.toFixed(1)}</p>
            <p className="text-[9px] font-bold text-slate-400 mt-9">{label}</p>
        </div>
    );
}

export function AnalyticsTab({ survey }: { survey: Survey }) {
    const allResponsesRaw = useQuery(api.surveys.getAllResponses, { surveyId: survey._id }) ?? [];
    const allRespondents = useQuery(api.surveys.getRespondents, { surveyId: survey._id }) ?? [];
    const [selectedDept, setSelectedDept] = useState<string>("all");

    // Only consider participating teachers (isParticipating !== false)
    const respondents = useMemo(() => allRespondents.filter(r => r.isParticipating !== false), [allRespondents]);
    const participatingIds = useMemo(() => new Set(respondents.map(r => r._id)), [respondents]);
    // Only count responses from teachers who are still participating
    const responses = useMemo(() => allResponsesRaw.filter(r => participatingIds.has(r.respondentId)), [allResponsesRaw, participatingIds]);

    const departments = useMemo(() =>
        Array.from(new Set(respondents.map(r => r.department || "بدون قسم"))),
        [respondents]);

    const filteredResponses = useMemo(() =>
        selectedDept === "all" ? responses : responses.filter(r => (r.department || "بدون قسم") === selectedDept),
        [responses, selectedDept]);

    const axisSectionsA = survey.sections.filter(s => s.questions.some(q => q.type === "rating"));
    const multicheckSections = survey.sections.filter(s => s.questions.some(q => q.type === "multicheck"));
    const textareaSections = survey.sections.filter(s => s.questions.some(q => q.type === "textarea"));

    const sectionStats = useMemo(() =>
        axisSectionsA.map(section => {
            const ratingQs = section.questions.filter(q => q.type === "rating");
            let totalSum = 0, totalCount = 0;
            const dist = [0, 0, 0, 0, 0]; // count of 1, 2, 3, 4, 5 ratings
            const qStats = ratingQs.map(q => {
                let sum = 0, cnt = 0;
                for (const resp of filteredResponses) {
                    try {
                        const ans = JSON.parse(resp.answers);
                        const v = ans[q.id];
                        if (typeof v === "number" && v >= 1 && v <= 5) {
                            sum += v; cnt++; totalSum += v; totalCount++;
                            dist[v - 1]++;
                        }
                    } catch {}
                }
                return { q, avg: cnt > 0 ? sum / cnt : 0, cnt };
            });
            return { section, qStats, overallAvg: totalCount > 0 ? totalSum / totalCount : 0, dist, totalCount };
        }).sort((a, b) => b.overallAvg - a.overallAvg),
        [axisSectionsA, filteredResponses]);

    // Department comparison: avg rating per dept
    const deptComparison = useMemo(() => {
        const byDept: Record<string, { sum: number; cnt: number }> = {};
        for (const resp of responses) {
            const dept = resp.department || "بدون قسم";
            try {
                const ans = JSON.parse(resp.answers);
                for (const s of axisSectionsA) {
                    for (const q of s.questions.filter(q => q.type === "rating")) {
                        const v = ans[q.id];
                        if (typeof v === "number" && v >= 1 && v <= 5) {
                            if (!byDept[dept]) byDept[dept] = { sum: 0, cnt: 0 };
                            byDept[dept].sum += v;
                            byDept[dept].cnt++;
                        }
                    }
                }
            } catch {}
        }
        return Object.entries(byDept)
            .map(([dept, { sum, cnt }]) => ({ dept, avg: cnt > 0 ? sum / cnt : 0, cnt }))
            .sort((a, b) => b.avg - a.avg);
    }, [responses, axisSectionsA]);

    // Top priority questions (highest avg = most needed)
    const topQuestions = useMemo(() => {
        const all: { sectionTitle: string; sectionColor: string; q: any; avg: number; cnt: number }[] = [];
        for (const { section, qStats } of sectionStats) {
            for (const qs of qStats) {
                if (qs.avg > 0) all.push({ sectionTitle: section.title, sectionColor: section.color ?? "#9B1239", q: qs.q, avg: qs.avg, cnt: qs.cnt });
            }
        }
        return all.sort((a, b) => b.avg - a.avg).slice(0, 10);
    }, [sectionStats]);

    const overallAverage = useMemo(() => {
        let sum = 0, cnt = 0;
        for (const s of sectionStats) {
            if (s.totalCount > 0) { sum += s.overallAvg * s.totalCount; cnt += s.totalCount; }
        }
        return cnt > 0 ? sum / cnt : 0;
    }, [sectionStats]);

    const multicheckStats = useMemo(() =>
        multicheckSections.map(section => ({
            section,
            questions: section.questions.filter(q => q.type === "multicheck").map((q, qi) => {
                const counts: Record<string, number> = {};
                for (const opt of q.options ?? []) counts[opt] = 0;
                for (const resp of filteredResponses) {
                    try {
                        const ans = JSON.parse(resp.answers);
                        for (const opt of (ans[q.id] as string[]) ?? [])
                            if (opt in counts) counts[opt]++;
                    } catch {}
                }
                const maxCount = Math.max(...Object.values(counts), 1);
                const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
                const total = Object.values(counts).reduce((a, b) => a + b, 0);
                return { q, qi, sorted, maxCount, total };
            }),
        })),
        [multicheckSections, filteredResponses]);

    const textareaStats = useMemo(() =>
        textareaSections.map(section => ({
            section,
            questions: section.questions.filter(q => q.type === "textarea").map(q => {
                const items: { name: string; dept?: string; text: string }[] = [];
                for (const resp of filteredResponses) {
                    try {
                        const ans = JSON.parse(resp.answers);
                        const text = (ans[q.id] as string) ?? "";
                        if (text.trim()) items.push({ name: resp.teacherName, dept: resp.department, text });
                    } catch {}
                }
                return { q, items };
            }),
        })),
        [textareaSections, filteredResponses]);

    if (responses.length === 0) {
        return (
            <div className="bg-white rounded-2xl border border-qatar-gray-border qatar-card-shadow flex flex-col items-center py-20 gap-3">
                <BarChart3 className="w-12 h-12 text-slate-200"/>
                <p className="font-black text-slate-400">لا توجد إجابات بعد</p>
                <p className="text-xs text-slate-300 font-bold">سيظهر التحليل بعد تقديم الإجابات</p>
            </div>
        );
    }

    const responseRate = respondents.length > 0 ? Math.round((responses.length / respondents.length) * 100) : 0;

    const overallCi = Math.min(4, Math.max(0, Math.ceil(overallAverage) - 1));
    const overallColor = overallAverage > 0 ? RATING_COLORS_A[overallCi] : "#94a3b8";

    return (
        <div dir="rtl" className="space-y-5 animate-in fade-in duration-300">

            {/* ── KPI Stats ── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
                    <div className="flex items-center justify-between mb-1">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500"/>
                        <span className="text-[10px] font-black text-slate-400">نسبة الاستجابة</span>
                    </div>
                    <p className="text-2xl font-black text-emerald-600">{responseRate}%</p>
                    <p className="text-[10px] text-slate-400 font-bold">{responses.length} من {respondents.length}</p>
                </div>
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
                    <div className="flex items-center justify-between mb-1">
                        <BarChart3 className="w-4 h-4" style={{ color: overallColor }}/>
                        <span className="text-[10px] font-black text-slate-400">المتوسط العام</span>
                    </div>
                    <p className="text-2xl font-black" style={{ color: overallColor }}>{overallAverage.toFixed(2)}</p>
                    <p className="text-[10px] font-bold" style={{ color: overallColor }}>{overallAverage > 0 ? RATING_LABELS_A[overallCi] : "—"}</p>
                </div>
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
                    <div className="flex items-center justify-between mb-1">
                        <Users className="w-4 h-4 text-blue-500"/>
                        <span className="text-[10px] font-black text-slate-400">عدد الأقسام</span>
                    </div>
                    <p className="text-2xl font-black text-blue-600">{departments.length}</p>
                    <p className="text-[10px] text-slate-400 font-bold">قسم</p>
                </div>
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
                    <div className="flex items-center justify-between mb-1">
                        <ClipboardList className="w-4 h-4 text-qatar-maroon"/>
                        <span className="text-[10px] font-black text-slate-400">المحاور المُقيَّمة</span>
                    </div>
                    <p className="text-2xl font-black text-qatar-maroon">{sectionStats.filter(s => s.overallAvg > 0).length}</p>
                    <p className="text-[10px] text-slate-400 font-bold">من {axisSectionsA.length}</p>
                </div>
            </div>

            {/* ── Dept filter ── */}
            {departments.length > 1 && (
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
                    <div className="flex items-center justify-between mb-2.5">
                        <span className="text-[10px] font-black text-slate-400">{filteredResponses.length} إجابة</span>
                        <p className="text-xs font-black text-slate-600">تصفية حسب القسم</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <button onClick={() => setSelectedDept("all")}
                            className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all border ${selectedDept === "all" ? "text-white border-transparent shadow-sm" : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"}`}
                            style={selectedDept === "all" ? { background: "linear-gradient(135deg,#9B1239,#C0184C)" } : {}}>
                            الكل
                        </button>
                        {departments.map(d => (
                            <button key={d} onClick={() => setSelectedDept(d)}
                                className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all border ${selectedDept === d ? "text-white border-transparent shadow-sm" : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"}`}
                                style={selectedDept === d ? { background: "linear-gradient(135deg,#9B1239,#C0184C)" } : {}}>
                                {d}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* ── Radar chart: axes overview ── */}
            {sectionStats.length >= 3 && sectionStats.some(s => s.overallAvg > 0) && (
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                    <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between"
                        style={{ background: "linear-gradient(135deg,#0f172a,#1e293b)" }}>
                        <span className="bg-white/15 text-white text-[10px] font-black px-2 py-0.5 rounded-full">{filteredResponses.length} مشارك</span>
                        <div className="flex items-center gap-2">
                            <span className="font-black text-white text-sm">رادار المحاور</span>
                            <BarChart3 className="w-4 h-4 text-white/60"/>
                        </div>
                    </div>
                    <div className="p-4 flex flex-col sm:flex-row items-center gap-4">
                        <div className="flex-shrink-0">
                            <RadarChart data={sectionStats.map(s => {
                                const ci = Math.min(4, Math.max(0, Math.ceil(s.overallAvg) - 1));
                                return { label: s.section.title.replace(/^المحور [^:]+:\s*/, ""), value: s.overallAvg, color: RATING_COLORS_A[ci] };
                            })} />
                        </div>
                        <div className="flex-1 grid grid-cols-5 gap-1 w-full">
                            {RATING_OPTS.map(o => (
                                <div key={o.val} className="rounded-lg py-1.5 px-1 text-center" style={{ background: o.color + "15" }}>
                                    <p className="text-sm font-black" style={{ color: o.color }}>{o.val}</p>
                                    <p className="text-[8px] font-bold leading-tight" style={{ color: o.color }}>{o.label}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* ── Axes Ranking — sorted by priority ── */}
            {sectionStats.some(s => s.overallAvg > 0) && (
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                    <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between"
                        style={{ background: "linear-gradient(135deg,#0f172a,#1e293b)" }}>
                        <span className="bg-white/15 text-white text-[10px] font-black px-2 py-0.5 rounded-full">مرتبة تنازلياً</span>
                        <div className="flex items-center gap-2">
                            <span className="font-black text-white text-sm">ترتيب المحاور حسب الأولوية</span>
                            <BarChart3 className="w-4 h-4 text-white/60"/>
                        </div>
                    </div>
                    <div className="p-4">
                        <HBarChart items={sectionStats.filter(s => s.overallAvg > 0).map(s => {
                            const ci = Math.min(4, Math.max(0, Math.ceil(s.overallAvg) - 1));
                            return {
                                label: s.section.title,
                                value: s.overallAvg,
                                max: 5,
                                color: RATING_COLORS_A[ci],
                                sub: ` · ${RATING_LABELS_A[ci]}`,
                            };
                        })} />
                    </div>
                </div>
            )}

            {/* ── Top 10 priority questions ── */}
            {topQuestions.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                    <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between"
                        style={{ background: "linear-gradient(135deg,#7c2d12,#9B1239)" }}>
                        <span className="bg-white/15 text-white text-[10px] font-black px-2 py-0.5 rounded-full">{topQuestions.length}</span>
                        <div className="flex items-center gap-2">
                            <span className="font-black text-white text-sm">أعلى الاحتياجات أولوية</span>
                            <ClipboardList className="w-4 h-4 text-white/60"/>
                        </div>
                    </div>
                    <div className="divide-y divide-slate-100">
                        {topQuestions.map((tq, idx) => {
                            const ci = Math.min(4, Math.max(0, Math.ceil(tq.avg) - 1));
                            const color = RATING_COLORS_A[ci];
                            return (
                                <div key={idx} className="px-4 py-3 flex items-start gap-3">
                                    <div className="flex flex-col items-center flex-shrink-0">
                                        <span className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black text-white"
                                            style={{ background: color }}>{idx + 1}</span>
                                        <span className="text-[10px] font-black mt-1" style={{ color }}>{tq.avg.toFixed(2)}</span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <span className="text-[9px] font-black px-2 py-0.5 rounded inline-block mb-1"
                                            style={{ background: tq.sectionColor + "20", color: tq.sectionColor }}>
                                            {tq.sectionTitle}
                                        </span>
                                        <p className="text-xs font-bold text-slate-700 leading-snug">{tq.q.text}</p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* ── Department comparison ── */}
            {selectedDept === "all" && deptComparison.length > 1 && (
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                    <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between"
                        style={{ background: "linear-gradient(135deg,#0f172a,#1e293b)" }}>
                        <span className="bg-white/15 text-white text-[10px] font-black px-2 py-0.5 rounded-full">{deptComparison.length} قسم</span>
                        <div className="flex items-center gap-2">
                            <span className="font-black text-white text-sm">مقارنة الأقسام</span>
                            <Users className="w-4 h-4 text-white/60"/>
                        </div>
                    </div>
                    <div className="p-4">
                        <HBarChart items={deptComparison.map(d => {
                            const ci = Math.min(4, Math.max(0, Math.ceil(d.avg) - 1));
                            return {
                                label: d.dept,
                                value: d.avg,
                                max: 5,
                                color: RATING_COLORS_A[ci],
                                sub: ` · ${RATING_LABELS_A[ci]}`,
                            };
                        })} />
                    </div>
                </div>
            )}

            {/* ── Per-axis distribution + details ── */}
            {sectionStats.some(s => s.overallAvg > 0) && (
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                    <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between"
                        style={{ background: "linear-gradient(135deg,#0f172a,#1e293b)" }}>
                        <span className="bg-white/15 text-white text-[10px] font-black px-2 py-0.5 rounded-full">تفصيل</span>
                        <div className="flex items-center gap-2">
                            <span className="font-black text-white text-sm">توزيع التقييمات لكل محور</span>
                            <BarChart3 className="w-4 h-4 text-white/60"/>
                        </div>
                    </div>
                    <div className="divide-y divide-slate-100">
                        {sectionStats.filter(s => s.overallAvg > 0).map(({ section, qStats, overallAvg, dist, totalCount }) => {
                            const ci = Math.min(4, Math.max(0, Math.ceil(overallAvg) - 1));
                            const color = RATING_COLORS_A[ci];
                            const topQs = [...qStats].filter(q => q.avg > 0).sort((a, b) => b.avg - a.avg).slice(0, 3);
                            return (
                                <div key={section.id} className="p-4">
                                    <div className="flex items-start justify-between gap-3 mb-3">
                                        <div className="flex flex-col items-center flex-shrink-0">
                                            <Donut value={overallAvg} max={5} color={color} label={RATING_LABELS_A[ci]} size={70}/>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-black text-slate-800 text-sm mb-2">{section.title}</p>
                                            <DistributionBars counts={dist} total={totalCount} />
                                        </div>
                                    </div>
                                    {topQs.length > 0 && (
                                        <div className="space-y-1.5 mt-3 pt-3 border-t border-dashed border-slate-100">
                                            <p className="text-[10px] font-black text-slate-400">أعلى ٣ احتياجات في هذا المحور:</p>
                                            {topQs.map(({ q, avg, cnt }) => {
                                                const qci = Math.min(4, Math.max(0, Math.ceil(avg) - 1));
                                                return (
                                                    <div key={q.id} className="flex items-start gap-2">
                                                        <div className="flex flex-col items-center flex-shrink-0 pt-0.5">
                                                            <span className="text-[10px] font-black" style={{ color: RATING_COLORS_A[qci] }}>{avg.toFixed(1)}</span>
                                                            <span className="text-[8px] text-slate-400">{cnt}</span>
                                                        </div>
                                                        <p className="text-[11px] text-slate-600 font-bold leading-snug flex-1">{q.text}</p>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* ── Multicheck analytics ── */}
            {multicheckStats.map(({ section, questions }) => (
                <div key={section.id} className="bg-white rounded-2xl border border-qatar-gray-border qatar-card-shadow overflow-hidden">
                    <div className="px-5 py-3 flex items-center gap-3 border-b border-qatar-gray-border"
                        style={{ background: "linear-gradient(135deg,#1e293b,#334155)" }}>
                        <BarChart3 className="w-4 h-4 text-white/60 flex-shrink-0" />
                        <span className="font-black text-white text-sm">{section.title}</span>
                        <span className="mr-auto bg-white/20 text-white text-xs font-black px-2 py-0.5 rounded-full">
                            {filteredResponses.length} مشارك
                        </span>
                    </div>
                    <div className={`p-4 ${questions.length > 1 ? "grid grid-cols-1 sm:grid-cols-3 gap-4" : ""}`}>
                        {questions.map(({ q, qi, sorted, maxCount, total }) => (
                            <div key={q.id} className="space-y-3">
                                {q.text && (
                                    <div className="flex items-center justify-end gap-2 pb-2 border-b-2 border-slate-100">
                                        <span className="text-xs font-black text-white px-2.5 py-1 rounded-lg"
                                            style={{ background: MCOL_COLORS_A[qi % MCOL_COLORS_A.length] }}>
                                            {q.text}
                                        </span>
                                    </div>
                                )}
                                <p className="text-[10px] font-black text-slate-400 text-right">{total} اختيار إجمالاً</p>
                                <div className="space-y-2.5">
                                    {sorted.map(([opt, count]) => {
                                        const pct = maxCount > 0 ? Math.round((count / maxCount) * 100) : 0;
                                        const color = MCOL_COLORS_A[qi % MCOL_COLORS_A.length];
                                        return (
                                            <div key={opt}>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="text-xs font-bold text-slate-700 text-right flex-1">{opt}</span>
                                                    <span className="text-xs font-black flex-shrink-0 w-6 text-center"
                                                        style={{ color }}>{count}</span>
                                                </div>
                                                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                                    <div className="h-full rounded-full transition-all duration-500"
                                                        style={{ width: `${pct}%`, background: color }} />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ))}

            {/* ── Textarea responses ── */}
            {textareaStats.map(({ section, questions }) =>
                questions.map(({ q, items }) => items.length > 0 && (
                    <div key={q.id} className="bg-white rounded-2xl border border-qatar-gray-border qatar-card-shadow overflow-hidden">
                        <div className="px-5 py-3 flex items-center gap-3 border-b border-qatar-gray-border"
                            style={{ background: "linear-gradient(135deg,#1e293b,#334155)" }}>
                            <ClipboardList className="w-4 h-4 text-white/60 flex-shrink-0" />
                            <span className="font-black text-white text-sm">{section.title}</span>
                            <span className="mr-auto bg-white/20 text-white text-xs font-black px-2 py-0.5 rounded-full">
                                {items.length} إجابة
                            </span>
                        </div>
                        <div className="divide-y divide-slate-100">
                            {items.map((item, i) => (
                                <div key={i} className="px-5 py-4">
                                    {/* teacher info: avatar RIGHT, name, dept LEFT — RTL DOM order */}
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className="w-7 h-7 rounded-full bg-qatar-maroon/10 border border-qatar-maroon/20 flex items-center justify-center flex-shrink-0">
                                            <span className="text-[10px] font-black text-qatar-maroon">{item.name[0]}</span>
                                        </div>
                                        <span className="text-sm font-black text-slate-700">{item.name}</span>
                                        {item.dept && (
                                            <span className="text-xs text-slate-400 font-bold border border-slate-200 px-2 py-0.5 rounded-lg">{item.dept}</span>
                                        )}
                                    </div>
                                    <p className="text-sm text-slate-600 leading-relaxed text-right bg-slate-50 rounded-xl px-4 py-3 font-medium">{item.text}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                ))
            )}
        </div>
    );
}

// ── Main Page (Teacher View) ───────────────────────────────────────────────
export default function SurveysPage() {
    const survey = useQuery(api.surveys.getActiveSurvey);

    if (survey === undefined) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-qatar-maroon"/>
            </div>
        );
    }

    if (!survey) {
        return (
            <div className="max-w-3xl mx-auto space-y-8 animate-in fade-in duration-500">
                <div className="rounded-2xl overflow-hidden qatar-card-shadow"
                    style={{ background: "linear-gradient(135deg, #9B1239 0%, #C0184C 50%, #9B1239 100%)" }}>
                    <div className="p-5 sm:p-8">
                        <h1 className="text-2xl font-black text-white flex items-center gap-3">
                            <ClipboardList className="w-7 h-7 text-white/80"/>الاستبانات
                        </h1>
                        <p className="text-white/70 font-medium text-sm mt-1">حصر الاحتياجات التدريبية والمهنية للمعلمين</p>
                    </div>
                </div>
                <div className="bg-white rounded-2xl border border-qatar-gray-border qatar-card-shadow flex flex-col items-center py-16 gap-5">
                    <div className="w-14 h-14 rounded-2xl bg-rose-50 border border-qatar-maroon/20 flex items-center justify-center">
                        <ClipboardList className="w-7 h-7 text-qatar-maroon"/>
                    </div>
                    <div className="text-center">
                        <p className="font-black text-slate-700 text-lg">لا توجد استبانة نشطة حالياً</p>
                        <p className="text-sm text-slate-400 mt-1">يرجى التواصل مع المسؤول لتفعيل الاستبانة</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in duration-500 pb-20">
            {/* Header */}
            <div className="rounded-2xl overflow-hidden qatar-card-shadow"
                style={{ background: "linear-gradient(135deg, #9B1239 0%, #C0184C 50%, #9B1239 100%)" }}>
                <div className="p-5 sm:p-7">
                    <h1 className="text-2xl font-black text-white flex items-center gap-3">
                        <ClipboardList className="w-7 h-7 text-white/80"/>الاستبانات
                    </h1>
                    <p className="text-white/80 font-bold text-sm mt-1">{survey.title}</p>
                    <div className="flex gap-3 mt-2 text-white/50 text-xs font-bold flex-wrap">
                        <span>{survey.academicYear}</span>
                        <span>·</span>
                        <span>{survey.sections.reduce((a,s)=>a+s.questions.length,0)} سؤال</span>
                    </div>
                </div>
            </div>

            {/* Direct survey answer flow */}
            <AnswerTab survey={survey}/>
        </div>
    );
}
