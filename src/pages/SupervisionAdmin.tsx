import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
// @ts-ignore
import { api } from "../../convex/_generated/api";
import { Plus, Trash2, Pencil, Check, X, RotateCcw, ClipboardCheck, BarChart3, KeyRound, Save, Users, Activity, History, BookOpen } from "lucide-react";
import SupervisionAnalytics from "./SupervisionAnalytics";
import SupervisionAdvancedAnalytics from "./SupervisionAdvancedAnalytics";
import SupervisionTeachers from "./SupervisionTeachers";
import SupervisionAuditLog from "./SupervisionAuditLog";

type Domain = "planning" | "execution" | "evaluation" | "management";
type Role = "coordinator" | "supervisor" | "deputy";

const DOMAIN_LABELS: Record<Domain, string> = { planning: "التخطيط", execution: "تنفيذ الدرس", evaluation: "التقويم", management: "الإدارة الصفية" };
const DOMAIN_COLORS: Record<Domain, string> = { planning: "#3b82f6", execution: "#10b981", evaluation: "#f59e0b", management: "#8b5cf6" };
const DOMAIN_ORDER: Domain[] = ["planning", "execution", "evaluation", "management"];

const ROLE_LABELS: Record<Role, string> = { coordinator: "المنسق", supervisor: "الموجه", deputy: "النائب الأكاديمي" };
const ROLE_COLORS: Record<Role, string> = { coordinator: "#5C1523", supervisor: "#1e40af", deputy: "#065f46" };

type AdminTab = "analytics" | "advanced" | "teachers" | "criteria" | "recs" | "pins" | "audit";

export default function SupervisionAdmin() {
    const [tab, setTab] = useState<AdminTab>("analytics");

    const TABS: { key: AdminTab; label: string; icon: any }[] = [
        { key: "analytics", label: "التحليل", icon: BarChart3 },
        { key: "advanced",  label: "تحليل متقدم", icon: Activity },
        { key: "teachers",  label: "المعلمون والزائرون", icon: Users },
        { key: "criteria",  label: "المعايير", icon: ClipboardCheck },
        { key: "recs",      label: "بنك التوصيات", icon: BookOpen },
        { key: "pins",      label: "كلمات المرور", icon: KeyRound },
        { key: "audit",     label: "سجل المراجعات", icon: History },
    ];

    return (
        <div dir="rtl" className="space-y-5">
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="px-5 py-3 flex items-center justify-between gap-3 flex-wrap"
                    style={{ background: "linear-gradient(135deg,#5C1523,#7A1E30)" }}>
                    <div className="flex gap-1.5 flex-wrap">
                        {TABS.map(({ key, label, icon: Icon }) => (
                            <button key={key} onClick={() => setTab(key)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black transition-all ${tab === key ? "bg-white text-qatar-maroon shadow" : "bg-white/10 text-white hover:bg-white/20"}`}>
                                <Icon className="w-3.5 h-3.5"/>{label}
                            </button>
                        ))}
                    </div>
                    <span className="font-black text-white text-sm flex items-center gap-2">
                        <ClipboardCheck className="w-4 h-4 text-white/60"/>إدارة الإشراف الصفي
                    </span>
                </div>
                <div className="p-5">
                    {tab === "analytics" && <SupervisionAnalytics/>}
                    {tab === "advanced"  && <SupervisionAdvancedAnalytics/>}
                    {tab === "teachers"  && <SupervisionTeachers/>}
                    {tab === "criteria"  && <CriteriaManager/>}
                    {tab === "recs"      && <RecommendationBankManager/>}
                    {tab === "pins"      && <PinsManager/>}
                    {tab === "audit"     && <SupervisionAuditLog/>}
                </div>
            </div>
        </div>
    );
}

function PinsManager() {
    const updatePin = useMutation(api.supervision.updateRolePin);
    const [pins, setPins] = useState<Record<Role, string>>({ coordinator: "", supervisor: "", deputy: "" });
    const [savedRole, setSavedRole] = useState<Role | null>(null);

    const handleSave = async (role: Role) => {
        if (!pins[role].trim() || pins[role].length < 4) {
            alert("PIN يجب أن يكون 4 أرقام على الأقل");
            return;
        }
        await updatePin({ role, newPin: pins[role] });
        setSavedRole(role);
        setPins(p => ({ ...p, [role]: "" }));
        setTimeout(() => setSavedRole(null), 2000);
    };

    return (
        <div className="space-y-3">
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700 font-bold">
                ⚠️ الافتراضي: المنسق <span className="bg-white px-2 py-0.5 rounded">1111</span>· الموجه <span className="bg-white px-2 py-0.5 rounded">2222</span>· النائب <span className="bg-white px-2 py-0.5 rounded">3333</span>. غيّرها لرفع الأمان.
            </div>
            {(Object.keys(ROLE_LABELS) as Role[]).map(role => (
                <div key={role} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                    <div className="px-5 py-3 flex items-center justify-between" style={{ background: `${ROLE_COLORS[role]}15`, borderRight: `4px solid ${ROLE_COLORS[role]}` }}>
                        <KeyRound className="w-4 h-4" style={{ color: ROLE_COLORS[role] }}/>
                        <span className="font-black text-sm" style={{ color: ROLE_COLORS[role] }}>{ROLE_LABELS[role]}</span>
                    </div>
                    <div className="p-4 flex items-center gap-2">
                        <input type="password" value={pins[role]} onChange={e => setPins(p => ({ ...p, [role]: e.target.value }))}
                            placeholder="PIN جديد (4 أرقام أو أكثر)" maxLength={10}
                            className="flex-1 border-2 border-slate-100 rounded-xl px-3 py-2.5 text-sm font-bold text-center tracking-widest bg-slate-50 focus:outline-none focus:border-qatar-maroon"/>
                        <button onClick={() => handleSave(role)} disabled={!pins[role].trim()}
                            className="flex items-center gap-1 px-4 py-2.5 rounded-xl text-white font-black text-sm hover:opacity-90 disabled:opacity-40"
                            style={{ background: ROLE_COLORS[role] }}>
                            {savedRole === role ? <><Check className="w-4 h-4"/>محفوظ</> : <><Save className="w-4 h-4"/>حفظ</>}
                        </button>
                    </div>
                </div>
            ))}
        </div>
    );
}

function CriteriaManager() {
    const criteria = useQuery(api.supervision.getCriteria) as any[] | undefined;
    const addCriterion = useMutation(api.supervision.addCriterion);
    const updateCriterion = useMutation(api.supervision.updateCriterion);
    const deleteCriterion = useMutation(api.supervision.deleteCriterion);
    const reset = useMutation(api.supervision.resetCriteria);
    const seed = useMutation(api.supervision.seedDefaultCriteria);

    const [editId, setEditId] = useState<string | null>(null);
    const [editText, setEditText] = useState("");
    const [newDomain, setNewDomain] = useState<Domain>("planning");
    const [newText, setNewText] = useState("");
    const [resetting, setResetting] = useState(false);

    if (!criteria) return <div className="flex justify-center py-10"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-qatar-maroon"/></div>;

    const byDomain: Record<Domain, any[]> = { planning: [], execution: [], evaluation: [], management: [] };
    for (const c of criteria) byDomain[c.domain as Domain]?.push(c);
    for (const k of DOMAIN_ORDER) byDomain[k].sort((a, b) => a.order - b.order);

    const handleAdd = async () => {
        if (!newText.trim()) return;
        await addCriterion({ domain: newDomain, text: newText.trim() });
        setNewText("");
    };

    const handleReset = async () => {
        if (!confirm("سيتم حذف كل المعايير الحالية واستعادة الافتراضية. هل أنت متأكد؟")) return;
        setResetting(true);
        try { await reset({}); } finally { setResetting(false); }
    };

    return (
        <div className="space-y-4">
            {criteria.length === 0 && (
                <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-4 flex items-center justify-between">
                    <div>
                        <p className="font-black text-amber-800 text-sm">لم يتم تهيئة المعايير</p>
                        <p className="text-xs text-amber-600 mt-0.5">اضغط لتحميل المعايير الـ 24 الافتراضية</p>
                    </div>
                    <button onClick={() => seed({})}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 text-white text-sm font-black hover:bg-amber-600">
                        <Plus className="w-4 h-4"/>تهيئة
                    </button>
                </div>
            )}

            {/* Add new */}
            <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-2">
                <p className="text-xs font-black text-slate-500">إضافة معيار جديد</p>
                <div className="flex gap-2 flex-wrap">
                    <select value={newDomain} onChange={e => setNewDomain(e.target.value as Domain)}
                        className="border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold bg-white focus:outline-none focus:border-qatar-maroon">
                        {DOMAIN_ORDER.map(d => <option key={d} value={d}>{DOMAIN_LABELS[d]}</option>)}
                    </select>
                    <input value={newText} onChange={e => setNewText(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && handleAdd()}
                        placeholder="نص المعيار..."
                        className="flex-1 min-w-44 border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold bg-white focus:outline-none focus:border-qatar-maroon"/>
                    <button onClick={handleAdd}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-qatar-maroon text-white text-sm font-black hover:opacity-90">
                        <Plus className="w-4 h-4"/>إضافة
                    </button>
                </div>
            </div>

            {/* Domain groups */}
            {DOMAIN_ORDER.map(domain => (
                <div key={domain} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                    <div className="px-5 py-3" style={{ background: `linear-gradient(135deg,${DOMAIN_COLORS[domain]}22,${DOMAIN_COLORS[domain]}0a)`, borderRight: `4px solid ${DOMAIN_COLORS[domain]}` }}>
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black text-white px-2 py-0.5 rounded" style={{ background: DOMAIN_COLORS[domain] }}>
                                {byDomain[domain].length}
                            </span>
                            <span className="font-black text-slate-800 text-sm">{DOMAIN_LABELS[domain]}</span>
                        </div>
                    </div>
                    <div className="divide-y divide-slate-100">
                        {byDomain[domain].map((c, i) => (
                            <div key={c._id} className="p-3 flex items-start gap-2">
                                <span className="w-6 h-6 rounded-lg flex items-center justify-center text-white text-[11px] font-black flex-shrink-0 mt-0.5"
                                    style={{ background: DOMAIN_COLORS[domain] }}>{i + 1}</span>
                                {editId === c._id ? (
                                    <>
                                        <input value={editText} onChange={e => setEditText(e.target.value)}
                                            onKeyDown={async e => { if (e.key === "Enter") { await updateCriterion({ id: c._id as any, text: editText }); setEditId(null); } }}
                                            className="flex-1 border border-slate-300 rounded-lg px-2 py-1 text-xs font-bold bg-white focus:outline-none focus:border-qatar-maroon"/>
                                        <button onClick={async () => { await updateCriterion({ id: c._id as any, text: editText }); setEditId(null); }}
                                            className="p-1 rounded-lg bg-emerald-100 text-emerald-600 hover:bg-emerald-200">
                                            <Check className="w-3.5 h-3.5"/>
                                        </button>
                                        <button onClick={() => setEditId(null)}
                                            className="p-1 rounded-lg text-slate-400 hover:bg-slate-100">
                                            <X className="w-3.5 h-3.5"/>
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <p className="flex-1 text-xs font-bold text-slate-700 leading-relaxed">{c.text}</p>
                                        <button onClick={() => { setEditId(c._id); setEditText(c.text); }}
                                            className="p-1.5 rounded-lg text-slate-300 hover:bg-blue-50 hover:text-blue-500">
                                            <Pencil className="w-3.5 h-3.5"/>
                                        </button>
                                        <button onClick={async () => { if (confirm("حذف هذا المعيار؟")) await deleteCriterion({ id: c._id as any }); }}
                                            className="p-1.5 rounded-lg text-slate-300 hover:bg-red-50 hover:text-red-500">
                                            <Trash2 className="w-3.5 h-3.5"/>
                                        </button>
                                    </>
                                )}
                            </div>
                        ))}
                        {byDomain[domain].length === 0 && (
                            <p className="text-center py-4 text-xs text-slate-400 font-bold">لا توجد معايير في هذا المجال</p>
                        )}
                    </div>
                </div>
            ))}

            {/* Reset */}
            {criteria.length > 0 && (
                <button onClick={handleReset} disabled={resetting}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-red-200 text-red-500 text-xs font-black hover:bg-red-50 disabled:opacity-50">
                    <RotateCcw className="w-3.5 h-3.5"/>
                    {resetting ? "جارٍ الإعادة..." : "إعادة ضبط للمعايير الافتراضية (24 معيار)"}
                </button>
            )}
        </div>
    );
}

// ── Recommendation Bank Manager ───────────────────────────────────────────
type RecDomain = "planning" | "execution" | "evaluation" | "management" | "general";

const REC_DOMAIN_LABELS: Record<RecDomain, string> = {
    planning: "التخطيط", execution: "تنفيذ الدرس",
    evaluation: "التقويم", management: "الإدارة الصفية", general: "عامة",
};
const REC_DOMAIN_COLORS: Record<RecDomain, string> = {
    planning: "#3b82f6", execution: "#10b981", evaluation: "#f59e0b", management: "#8b5cf6", general: "#64748b",
};
const REC_DOMAIN_ORDER: RecDomain[] = ["planning", "execution", "evaluation", "management", "general"];

function RecommendationBankManager() {
    const bank = useQuery(api.supervision.getRecommendationBank) as any[] | undefined;
    const seedRecs = useMutation(api.supervision.seedDefaultRecommendations);
    const addRec = useMutation(api.supervision.addRecommendation);
    const updateRec = useMutation(api.supervision.updateRecommendation);
    const deleteRec = useMutation(api.supervision.deleteRecommendation);

    const [newDomain, setNewDomain] = useState<RecDomain>("general");
    const [newText, setNewText] = useState("");
    const [editId, setEditId] = useState<string | null>(null);
    const [editText, setEditText] = useState("");
    const [seeding, setSeeding] = useState(false);

    if (!bank) return <div className="flex justify-center py-10"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-qatar-maroon"/></div>;

    const byDomain: Record<RecDomain, any[]> = { planning: [], execution: [], evaluation: [], management: [], general: [] };
    for (const r of bank) {
        if (byDomain[r.domain as RecDomain]) byDomain[r.domain as RecDomain].push(r);
    }

    const handleAdd = async () => {
        if (!newText.trim()) return;
        await addRec({ domain: newDomain, text: newText.trim() });
        setNewText("");
    };

    return (
        <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-xs font-bold text-blue-800">
                <p className="font-black mb-1">بنك التوصيات</p>
                <p>هذه التوصيات تظهر في استمارة الزيارة — يمكن للزائر اختيار توصية جاهزة بدل الكتابة من الصفر.</p>
            </div>

            {bank.length === 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between gap-2">
                    <p className="text-xs font-bold text-amber-800">البنك فارغ — تحميل التوصيات الافتراضية (19 توصية)؟</p>
                    <button onClick={async () => { setSeeding(true); try { await seedRecs({}); } finally { setSeeding(false); } }}
                        disabled={seeding}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 text-white text-xs font-black hover:bg-amber-600 disabled:opacity-50">
                        <BookOpen className="w-3.5 h-3.5"/>{seeding ? "جارٍ التحميل..." : "تحميل الافتراضية"}
                    </button>
                </div>
            )}

            {/* Add new */}
            <div className="bg-slate-50 rounded-xl border border-slate-200 p-3 space-y-2">
                <p className="text-xs font-black text-slate-500">إضافة توصية جديدة</p>
                <div className="flex gap-2 flex-wrap">
                    {REC_DOMAIN_ORDER.map(d => (
                        <button key={d} onClick={() => setNewDomain(d)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-black border transition-all ${newDomain === d ? "text-white border-transparent" : "bg-white border-slate-200 text-slate-600"}`}
                            style={newDomain === d ? { background: REC_DOMAIN_COLORS[d] } : {}}>
                            {REC_DOMAIN_LABELS[d]}
                        </button>
                    ))}
                </div>
                <textarea value={newText} onChange={e => setNewText(e.target.value)} rows={2}
                    placeholder="اكتب نص التوصية..."
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold bg-white resize-none focus:outline-none focus:border-qatar-maroon"/>
                <button onClick={handleAdd} disabled={!newText.trim()}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-qatar-maroon text-white text-xs font-black hover:opacity-90 disabled:opacity-40">
                    <Plus className="w-3.5 h-3.5"/>إضافة
                </button>
            </div>

            {/* List by domain */}
            {REC_DOMAIN_ORDER.map(domain => {
                const items = byDomain[domain];
                if (items.length === 0) return null;
                const color = REC_DOMAIN_COLORS[domain];
                return (
                    <div key={domain} className="bg-white rounded-xl border-2 overflow-hidden" style={{ borderColor: color + "30" }}>
                        <div className="px-4 py-2 flex items-center justify-between" style={{ background: color + "10" }}>
                            <span className="text-[10px] font-black px-2 py-0.5 rounded text-white" style={{ background: color }}>{items.length}</span>
                            <span className="font-black text-sm" style={{ color }}>{REC_DOMAIN_LABELS[domain]}</span>
                        </div>
                        <div className="divide-y divide-slate-100">
                            {items.map((r: any) => (
                                <div key={r._id} className={`flex items-start gap-2 p-3 ${!r.isActive ? "opacity-50" : ""}`}>
                                    <div className="flex gap-1 mt-0.5">
                                        <button onClick={() => updateRec({ id: r._id, isActive: !r.isActive })}
                                            className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-black ${r.isActive ? "bg-emerald-100 text-emerald-600" : "bg-slate-100 text-slate-400"}`}>
                                            {r.isActive ? <Check className="w-3 h-3"/> : <X className="w-3 h-3"/>}
                                        </button>
                                        <button onClick={() => deleteRec({ id: r._id })}
                                            className="w-5 h-5 rounded bg-red-50 text-red-400 hover:bg-red-100 flex items-center justify-center">
                                            <Trash2 className="w-3 h-3"/>
                                        </button>
                                    </div>
                                    {editId === r._id ? (
                                        <div className="flex-1 flex gap-2">
                                            <textarea value={editText} onChange={e => setEditText(e.target.value)} rows={2}
                                                className="flex-1 border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold resize-none focus:outline-none focus:border-qatar-maroon"/>
                                            <div className="flex flex-col gap-1">
                                                <button onClick={async () => { await updateRec({ id: r._id, text: editText }); setEditId(null); }}
                                                    className="px-2 py-1 rounded bg-emerald-500 text-white text-[10px] font-black">
                                                    <Check className="w-3 h-3"/>
                                                </button>
                                                <button onClick={() => setEditId(null)}
                                                    className="px-2 py-1 rounded bg-slate-100 text-slate-500 text-[10px] font-black">
                                                    <X className="w-3 h-3"/>
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex-1 flex items-start gap-2">
                                            <button onClick={() => { setEditId(r._id); setEditText(r.text); }}
                                                className="mt-0.5 text-slate-300 hover:text-slate-600"><Pencil className="w-3 h-3"/></button>
                                            <p className="flex-1 text-sm font-bold text-slate-700 leading-relaxed">{r.text}</p>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
