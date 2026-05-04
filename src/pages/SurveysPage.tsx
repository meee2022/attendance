import { useState, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
// @ts-ignore
import { api } from "../../convex/_generated/api";
import {
    ClipboardList, Users, BarChart3, Plus, Trash2, ChevronDown, ChevronUp,
    CheckCircle2, Clock, Shield, Eye, EyeOff, Send, RotateCcw, BookOpen,
    Pencil, X, Download, Check,
} from "lucide-react";

type Tab = "answer" | "manage" | "analytics";
type ManageSubTab = "teachers" | "survey";

type Survey = NonNullable<ReturnType<typeof useQuery<typeof api.surveys.getActiveSurvey>>>;
type Respondent = Awaited<ReturnType<typeof useQuery<typeof api.surveys.getRespondents>>>[number];

const RATING_COLORS = ["#10b981","#3b82f6","#f59e0b","#f97316","#ef4444"];

// ── Survey Form ────────────────────────────────────────────────────────────
function SurveyForm({ survey, respondent, existingResponse, onSubmitted }: {
    survey: Survey;
    respondent: Respondent;
    existingResponse: { answers: string; subject?: string; yearsExperience?: string; qualification?: string; responseDate?: string } | null | undefined;
    onSubmitted: () => void;
}) {
    const submitResponse = useMutation(api.surveys.submitResponse);
    const [answers, setAnswers] = useState<Record<string, string[] | string>>(() => {
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

    const MCOL_COLORS = ["#9B1239","#1e40af","#065f46"];

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
                        : <span className="text-xs font-bold text-white/60">يرجى ملء الاستبانة</span>
                    }
                </div>
            </div>

            {/* ── Basic info ── */}
            <div className="bg-white rounded-2xl border border-qatar-gray-border qatar-card-shadow overflow-hidden">
                <div className="px-5 py-3 border-b border-qatar-gray-border flex items-center justify-between"
                    style={{ borderRight: "4px solid #9B1239" }}>
                    <span className="text-xs font-black text-slate-400">① المعلومات الأساسية</span>
                    <div className="flex items-center gap-2">
                        <BookOpen className="w-4 h-4 text-qatar-maroon" />
                        <span className="font-black text-slate-700 text-sm">بيانات المعلم</span>
                    </div>
                </div>
                <div className="p-4 grid grid-cols-2 gap-3">
                    {([
                        { key: "subject", label: "المادة / المسار", placeholder: "اكتب هنا..." },
                        { key: "yearsExperience", label: "سنوات الخبرة", placeholder: "مثال: 5" },
                        { key: "qualification", label: "المؤهل العلمي", placeholder: "مثال: بكالوريوس تربية خاصة" },
                    ] as const).map(f => (
                        <div key={f.key} className={f.key === "qualification" ? "col-span-2 sm:col-span-1" : "col-span-2 sm:col-span-1"}>
                            <label className="block text-xs font-black text-slate-500 mb-1.5">{f.label}</label>
                            <input value={basicInfo[f.key]} onChange={e => setBasicInfo(p => ({ ...p, [f.key]: e.target.value }))}
                                placeholder={f.placeholder}
                                className="w-full border-2 border-slate-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-qatar-maroon bg-slate-50 text-right transition-colors font-bold text-slate-700" />
                        </div>
                    ))}
                    <div className="col-span-2 sm:col-span-1">
                        <label className="block text-xs font-black text-slate-500 mb-1.5">التاريخ</label>
                        <input type="date" value={basicInfo.responseDate} onChange={e => setBasicInfo(p => ({ ...p, responseDate: e.target.value }))}
                            className="w-full border-2 border-slate-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-qatar-maroon bg-slate-50 transition-colors" />
                    </div>
                </div>
            </div>

            {/* ── Axes — read only ── */}
            {axisSections.length > 0 && (
                <div className="bg-white rounded-2xl border border-qatar-gray-border qatar-card-shadow overflow-hidden">
                    <div className="px-5 py-3 border-b border-qatar-gray-border flex items-center justify-between"
                        style={{ background: "linear-gradient(135deg,#1e293b,#334155)" }}>
                        <span className="text-xs font-black text-white/50">② محاور الاستبانة</span>
                        <span className="font-black text-white text-sm">محاور الاستبانة</span>
                    </div>
                    <div className="divide-y divide-slate-100">
                        {axisSections.map((section, idx) => (
                            <div key={section.id}
                                className={`flex items-center gap-3 px-5 py-3.5 ${idx % 2 === 0 ? "bg-white" : "bg-slate-50/60"}`}>
                                <span className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-black flex-shrink-0"
                                    style={{ background: section.color || "#9B1239" }}>{idx + 1}</span>
                                <span className="text-sm font-bold text-slate-700 text-right flex-1">{section.title}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ── Questions (multicheck / textarea) ── */}
            {questionSections.map((section, secIdx) => {
                const multichecks = section.questions.filter(q => q.type === "multicheck");
                const textareas = section.questions.filter(q => q.type === "textarea");
                const multiCol = multichecks.length > 1;
                return (
                    <div key={section.id} className="bg-white rounded-2xl border border-qatar-gray-border qatar-card-shadow overflow-hidden">
                        <div className="px-5 py-3 border-b border-qatar-gray-border flex items-center justify-between bg-slate-50"
                            style={{ borderRight: `4px solid ${section.color || "#9B1239"}` }}>
                            <span className="text-xs font-black text-slate-400">③</span>
                            <span className="font-black text-slate-800 text-sm">{section.title}</span>
                        </div>
                        <div className="p-4 space-y-4">
                            {multichecks.length > 0 && (
                                <div className={multiCol ? "grid grid-cols-1 sm:grid-cols-3 gap-3" : ""}>
                                    {multichecks.map((q, qi) => (
                                        <div key={q.id} className="space-y-2">
                                            {q.text && (
                                                <div className="flex items-center justify-end gap-2 pb-2 border-b-2 border-slate-100">
                                                    <span className="text-xs font-black text-white px-2 py-1 rounded-lg"
                                                        style={{ background: MCOL_COLORS[qi % MCOL_COLORS.length] }}>
                                                        {q.text}
                                                    </span>
                                                </div>
                                            )}
                                            <div className="space-y-1.5">
                                                {q.options?.map(opt => {
                                                    const checked = ((answers[q.id] as string[]) ?? []).includes(opt);
                                                    return (
                                                        <label key={opt}
                                                            className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl cursor-pointer transition-all text-sm font-bold border-2 ${
                                                                checked
                                                                    ? "text-white border-transparent"
                                                                    : "bg-white border-slate-100 text-slate-600 hover:border-slate-200 hover:bg-slate-50"
                                                            }`}
                                                            style={checked ? { background: MCOL_COLORS[qi % MCOL_COLORS.length] } : {}}>
                                                            <span className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border-2 transition-all ${checked ? "bg-white/30 border-white/60" : "border-slate-300"}`}>
                                                                {checked && <Check className="w-3 h-3 text-white" />}
                                                            </span>
                                                            <input type="checkbox" checked={checked} onChange={e => setCheck(q.id, opt, e.target.checked)} className="hidden" />
                                                            <span className="text-right flex-1">{opt}</span>
                                                        </label>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                            {textareas.map(q => (
                                <div key={q.id}>
                                    {q.text && <p className="text-sm font-black text-slate-600 mb-2 text-right">{q.text}</p>}
                                    <textarea value={(answers[q.id] as string) ?? ""} onChange={e => setAnswers(p => ({ ...p, [q.id]: e.target.value }))}
                                        rows={5} placeholder="اكتب هنا..."
                                        className="w-full border-2 border-slate-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-qatar-maroon resize-none text-right bg-slate-50 transition-colors font-bold text-slate-700 leading-relaxed" />
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
    const respondents = useQuery(api.surveys.getRespondents, { surveyId: survey._id }) ?? [];
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
                        <button onClick={() => setSelectedDept(null)}
                            className="flex items-center gap-1.5 text-white/80 hover:text-white text-sm font-black transition-colors">
                            <span className="text-base">→</span> الأقسام
                        </button>
                        <div className="text-right">
                            <p className="font-black text-white text-sm">{selectedDept}</p>
                            <p className="text-white/60 text-xs font-bold">{members.length} معلم · {done.length} أجابوا</p>
                        </div>
                    </div>
                </div>

                {/* Pending */}
                {pending.length > 0 && (
                    <div className="bg-white rounded-2xl border border-qatar-gray-border qatar-card-shadow overflow-hidden">
                        <div className="px-5 py-2.5 bg-slate-50 border-b border-qatar-gray-border flex items-center justify-between">
                            <span className="bg-amber-100 text-amber-700 text-xs font-black px-2 py-0.5 rounded-full">{pending.length}</span>
                            <span className="text-xs font-black text-slate-500">لم يجيبوا بعد</span>
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
                            <span className="bg-emerald-100 text-emerald-700 text-xs font-black px-2 py-0.5 rounded-full">{done.length}</span>
                            <span className="text-xs font-black text-emerald-600 flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5"/>أجابوا — يمكن التعديل</span>
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
                    <div className="flex gap-3 text-xs font-bold">
                        <span className="flex items-center gap-1 text-emerald-600"><CheckCircle2 className="w-3.5 h-3.5"/>{totalDone} أجابوا</span>
                        <span className="flex items-center gap-1 text-amber-600"><Clock className="w-3.5 h-3.5"/>{totalPending} لم يجيبوا</span>
                    </div>
                    <span className="text-xs font-black text-slate-400">اختر قسمك أولاً</span>
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
                                    <div className={`flex items-center gap-1 text-xs font-black px-2 py-1 rounded-lg ${allDone ? "bg-emerald-100 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                                        {allDone ? <CheckCircle2 className="w-3 h-3"/> : <Clock className="w-3 h-3"/>}
                                        {deptDone}/{members.length}
                                    </div>
                                    <div>
                                        <p className="font-black text-slate-800 text-sm group-hover:text-qatar-maroon transition-colors">{dept}</p>
                                        <p className="text-xs text-slate-400 font-bold mt-0.5">{members.length} معلم</p>
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
function ManageTab({ survey }: { survey: Survey }) {
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
            <div className="grid grid-cols-3 gap-3">
                {[
                    { label: "إجمالي", val: respondents.length, color: "text-slate-700", bg: "bg-slate-50" },
                    { label: "أجابوا", val: respondents.filter(r=>r.hasResponded).length, color: "text-emerald-600", bg: "bg-emerald-50" },
                    { label: "لم يجيبوا", val: respondents.filter(r=>!r.hasResponded).length, color: "text-amber-600", bg: "bg-amber-50" },
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
                    <div className="bg-slate-100 px-4 py-2 flex items-center justify-between border-b border-qatar-gray-border">
                        <span className="text-xs text-slate-400 font-black">{members.length} معلم</span>
                        <span className="font-black text-slate-600 text-sm">{deptKey}</span>
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
                                    <div className="flex items-center justify-between px-4 py-3">
                                        <div className="flex items-center gap-1">
                                            <button onClick={() => { setEditId(r._id); setEditName(r.name); setEditDept(r.department ?? ""); }}
                                                className="p-1.5 rounded-lg hover:bg-blue-50 text-slate-300 hover:text-blue-500 transition-colors">
                                                <Pencil className="w-3.5 h-3.5"/>
                                            </button>
                                            <button onClick={async () => { if (confirm(`حذف ${r.name}؟`)) await removeRespondent({ respondentId: r._id as any }); }}
                                                className="p-1.5 rounded-lg hover:bg-red-50 text-slate-300 hover:text-red-500 transition-colors">
                                                <Trash2 className="w-3.5 h-3.5"/>
                                            </button>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <p className="text-sm font-bold text-slate-700">{r.name}</p>
                                            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${r.hasResponded ? "bg-emerald-500" : "bg-amber-400"}`}/>
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
function AnalyticsTab({ survey }: { survey: Survey }) {
    const responses = useQuery(api.surveys.getAllResponses, { surveyId: survey._id }) ?? [];
    const respondents = useQuery(api.surveys.getRespondents, { surveyId: survey._id }) ?? [];
    const [selectedDept, setSelectedDept] = useState<string>("all");

    const departments = useMemo(() => Array.from(new Set(respondents.map(r => r.department||"بدون قسم"))), [respondents]);

    const filteredResponses = useMemo(() =>
        selectedDept === "all" ? responses : responses.filter(r => (r.department||"بدون قسم") === selectedDept),
        [responses, selectedDept]);

    const ratingSections = survey.sections.filter(s => s.questions.some(q=>q.type==="rating"));

    const sectionAverages = useMemo(() => ratingSections.map(section => {
        const qIds = section.questions.filter(q=>q.type==="rating").map(q=>q.id);
        const deptData: Record<string, {sum:number;count:number}> = {};
        for (const resp of filteredResponses) {
            let ans: Record<string,any> = {}; try { ans = JSON.parse(resp.answers); } catch { continue; }
            const d = resp.department||"بدون قسم";
            if (!deptData[d]) deptData[d]={sum:0,count:0};
            for (const qId of qIds) { const v=ans[qId]; if(typeof v==="number"&&v>=1&&v<=5){deptData[d].sum+=v;deptData[d].count++;} }
        }
        let ts=0,tc=0; for(const {sum,count} of Object.values(deptData)){ts+=sum;tc+=count;}
        return { section, deptData, overallAvg: tc>0?ts/tc:0 };
    }), [ratingSections, filteredResponses]);

    const sectionDists = useMemo(() => ratingSections.map(section => {
        const qIds = section.questions.filter(q=>q.type==="rating").map(q=>q.id);
        const dist=[0,0,0,0,0];
        for(const resp of filteredResponses){let ans:Record<string,any>={};try{ans=JSON.parse(resp.answers);}catch{continue;}for(const qId of qIds){const v=ans[qId];if(typeof v==="number"&&v>=1&&v<=5)dist[v-1]++;}}
        return { section, dist, total: dist.reduce((a,b)=>a+b,0) };
    }), [ratingSections, filteredResponses]);

    if (responses.length === 0) {
        return (
            <div className="bg-white rounded-2xl border border-qatar-gray-border qatar-card-shadow flex flex-col items-center py-20 gap-3">
                <BarChart3 className="w-12 h-12 text-slate-200"/>
                <p className="font-black text-slate-400">لا توجد إجابات بعد</p>
                <p className="text-xs text-slate-300 font-bold">سيظهر التحليل بعد تقديم الإجابات</p>
            </div>
        );
    }

    const responseRate = respondents.length > 0 ? Math.round((responses.length/respondents.length)*100) : 0;

    return (
        <div className="space-y-5 animate-in fade-in duration-300">
            {/* Stats */}
            <div className="grid grid-cols-3 gap-3">
                {[
                    { label: "نسبة الاستجابة", val: `${responseRate}%`, color: "text-qatar-maroon", bg: "bg-rose-50" },
                    { label: "أجابوا", val: responses.length, color: "text-emerald-600", bg: "bg-emerald-50" },
                    { label: "الإجمالي", val: respondents.length, color: "text-slate-700", bg: "bg-slate-50" },
                ].map(s => (
                    <div key={s.label} className={`${s.bg} rounded-2xl border border-qatar-gray-border qatar-card-shadow p-4 text-center`}>
                        <p className={`text-2xl font-black ${s.color}`}>{s.val}</p>
                        <p className="text-xs text-slate-400 font-bold mt-0.5">{s.label}</p>
                    </div>
                ))}
            </div>

            {/* Dept filter */}
            {departments.length > 1 && (
                <div className="bg-white rounded-2xl border border-qatar-gray-border qatar-card-shadow p-4">
                    <p className="text-xs font-black text-slate-500 mb-2">تصفية حسب القسم</p>
                    <div className="flex flex-wrap gap-2">
                        <button onClick={() => setSelectedDept("all")}
                            className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all border ${selectedDept==="all"?"text-white border-transparent":"bg-white border-qatar-gray-border text-slate-600 hover:border-slate-300"}`}
                            style={selectedDept==="all"?{background:"linear-gradient(135deg,#9B1239,#C0184C)"}:{}}>
                            الكل
                        </button>
                        {departments.map(d => (
                            <button key={d} onClick={() => setSelectedDept(d)}
                                className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all border ${selectedDept===d?"text-white border-transparent":"bg-white border-qatar-gray-border text-slate-600 hover:border-slate-300"}`}
                                style={selectedDept===d?{background:"linear-gradient(135deg,#9B1239,#C0184C)"}:{}}>
                                {d}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Section averages */}
            <div className="bg-white rounded-2xl border border-qatar-gray-border qatar-card-shadow overflow-hidden">
                <div className="bg-slate-700 px-5 py-3 flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-white/60"/>
                    <span className="font-black text-white text-sm">متوسط الاحتياج لكل محور (1-5)</span>
                </div>
                <div className="p-5 space-y-4">
                    {[...sectionAverages].sort((a,b)=>b.overallAvg-a.overallAvg).map(({section, overallAvg}) => {
                        const ci = overallAvg<=0?0:overallAvg<=1?0:overallAvg<=2?1:overallAvg<=3?2:overallAvg<=4?3:4;
                        return (
                            <div key={section.id}>
                                <div className="flex items-center justify-between mb-1.5">
                                    <span className="text-xs font-black" style={{color:RATING_COLORS[ci]}}>
                                        {overallAvg.toFixed(2)} — {survey.ratingLabels[ci]}
                                    </span>
                                    <span className="text-xs font-black text-slate-600 text-right">{section.title}</span>
                                </div>
                                <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                                    <div className="h-full rounded-full transition-all duration-700"
                                        style={{ width:`${(overallAvg/5)*100}%`, background: RATING_COLORS[ci] }}/>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Distributions */}
            <div className="bg-white rounded-2xl border border-qatar-gray-border qatar-card-shadow overflow-hidden">
                <div className="bg-slate-700 px-5 py-3 flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-white/60"/>
                    <span className="font-black text-white text-sm">توزيع التقييمات لكل محور</span>
                </div>
                <div className="p-5 space-y-5">
                    {sectionDists.map(({section, dist, total}) => (
                        <div key={section.id}>
                            <p className="text-xs font-black text-slate-600 mb-2 text-right">{section.title}</p>
                            <div className="flex h-7 rounded-xl overflow-hidden gap-px">
                                {dist.map((count,i) => {
                                    const pct = total>0?(count/total)*100:0;
                                    return pct>0 ? (
                                        <div key={i} title={`${survey.ratingLabels[i]}: ${count}`}
                                            className="flex items-center justify-center text-white text-[9px] font-black"
                                            style={{width:`${pct}%`,background:RATING_COLORS[i]}}>
                                            {pct>8?count:""}
                                        </div>
                                    ) : null;
                                })}
                                {total===0 && <div className="flex-1 bg-slate-100"/>}
                            </div>
                            <p className="text-[10px] text-slate-400 font-bold mt-1 text-right">{total} إجابة</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Dept comparison table */}
            {departments.length > 1 && (
                <div className="bg-white rounded-2xl border border-qatar-gray-border qatar-card-shadow overflow-hidden">
                    <div className="bg-slate-700 px-5 py-3 flex items-center gap-2">
                        <Users className="w-4 h-4 text-white/60"/>
                        <span className="font-black text-white text-sm">مقارنة الأقسام</span>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs" dir="rtl">
                            <thead>
                                <tr className="border-b border-qatar-gray-border bg-slate-50">
                                    <th className="text-right px-4 py-2.5 font-black text-slate-500 whitespace-nowrap">المحور</th>
                                    {departments.map(d => <th key={d} className="px-3 py-2.5 font-black text-slate-500 text-center whitespace-nowrap">{d}</th>)}
                                </tr>
                            </thead>
                            <tbody>
                                {sectionAverages.map(({section, deptData}) => (
                                    <tr key={section.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                                        <td className="px-4 py-3 font-bold text-slate-600 text-right text-xs">{section.title.replace(/المحور [^:]+: /,"")}</td>
                                        {departments.map(d => {
                                            const {sum,count} = deptData[d]??{sum:0,count:0};
                                            const avg = count>0?sum/count:0;
                                            const ci = avg<=0?-1:avg<=1?0:avg<=2?1:avg<=3?2:avg<=4?3:4;
                                            return (
                                                <td key={d} className="px-3 py-3 text-center font-black" style={{color:ci>=0?RATING_COLORS[ci]:"#cbd5e1"}}>
                                                    {avg>0?avg.toFixed(1):"—"}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}

// ── Main Page ──────────────────────────────────────────────────────────────
export default function SurveysPage() {
    const survey = useQuery(api.surveys.getActiveSurvey);
    const seedDefaultSurvey = useMutation(api.surveys.seedDefaultSurvey);
    const [tab, setTab] = useState<Tab>("answer");
    const [seeding, setSeeding] = useState(false);

    if (survey === undefined) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-qatar-maroon"/>
            </div>
        );
    }

    if (!survey) {
        return (
            <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
                <div className="rounded-2xl overflow-hidden qatar-card-shadow"
                    style={{ background: "linear-gradient(135deg, #9B1239 0%, #C0184C 50%, #9B1239 100%)" }}>
                    <div className="p-5 sm:p-8">
                        <h1 className="text-3xl font-black text-white flex items-center gap-3">
                            <ClipboardList className="w-8 h-8 text-white/80"/>الاستبانات
                        </h1>
                        <p className="text-white/70 font-medium mr-11">حصر الاحتياجات التدريبية والمهنية للمعلمين</p>
                    </div>
                </div>
                <div className="bg-white rounded-2xl border border-qatar-gray-border qatar-card-shadow flex flex-col items-center py-16 gap-5">
                    <div className="w-16 h-16 rounded-2xl bg-rose-50 border border-qatar-maroon/20 flex items-center justify-center">
                        <ClipboardList className="w-8 h-8 text-qatar-maroon"/>
                    </div>
                    <div className="text-center">
                        <p className="font-black text-slate-700 text-lg">لا توجد استبانة نشطة</p>
                        <p className="text-sm text-slate-400 mt-1 max-w-sm">أنشئ استبانة حصر الاحتياجات التدريبية للمعلمين بنقرة واحدة</p>
                    </div>
                    <button onClick={async () => { setSeeding(true); try { await seedDefaultSurvey({}); } finally { setSeeding(false); } }}
                        disabled={seeding}
                        className="flex items-center gap-2 px-6 py-3 rounded-2xl text-white font-black text-sm hover:opacity-90 disabled:opacity-50 qatar-card-shadow"
                        style={{ background: "linear-gradient(135deg, #9B1239, #C0184C)" }}>
                        {seeding ? <><RotateCcw className="w-4 h-4 animate-spin"/>جارٍ الإنشاء...</> : <><Plus className="w-4 h-4"/>إنشاء الاستبانة</>}
                    </button>
                </div>
            </div>
        );
    }

    const TABS: { key: Tab; label: string; icon: JSX.Element }[] = [
        { key: "answer", label: "الإجابة", icon: <ClipboardList className="w-4 h-4"/> },
        { key: "manage", label: "الإدارة", icon: <Users className="w-4 h-4"/> },
        { key: "analytics", label: "التحليل", icon: <BarChart3 className="w-4 h-4"/> },
    ];

    return (
        <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500 pb-20">
            {/* Gradient Header */}
            <div className="rounded-2xl overflow-hidden qatar-card-shadow"
                style={{ background: "linear-gradient(135deg, #9B1239 0%, #C0184C 50%, #9B1239 100%)" }}>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-5 sm:p-8">
                    <div>
                        <h1 className="text-2xl font-black text-white flex items-center gap-3">
                            <ClipboardList className="w-7 h-7 text-white/80"/>الاستبانات
                        </h1>
                        <p className="text-white/70 font-medium text-sm mt-0.5 mr-10">{survey.title}</p>
                        <div className="flex gap-3 mt-2 mr-10 text-white/60 text-xs font-bold flex-wrap">
                            <span>{survey.academicYear}</span>
                            <span>·</span>
                            <span>{survey.sections.length} محاور</span>
                            <span>·</span>
                            <span>{survey.sections.reduce((a,s)=>a+s.questions.length,0)} سؤال</span>
                        </div>
                    </div>
                    {/* Tab buttons inside header */}
                    <div className="flex gap-2 mr-10 sm:mr-0">
                        {TABS.map(({ key, label, icon }) => (
                            <button key={key} onClick={() => setTab(key)}
                                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl font-black text-sm transition-all border ${
                                    tab === key
                                        ? "bg-white text-qatar-maroon border-white shadow"
                                        : "bg-white/10 text-white border-white/20 hover:bg-white/20"
                                }`}>
                                {icon}{label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Tab Content */}
            <div className="max-w-3xl mx-auto">
                {tab === "answer" && <AnswerTab survey={survey}/>}
                {tab === "manage" && <ManageTab survey={survey}/>}
                {tab === "analytics" && <AnalyticsTab survey={survey}/>}
            </div>
        </div>
    );
}
