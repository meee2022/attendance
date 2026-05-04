import { useState, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
// @ts-ignore
import { api } from "../../convex/_generated/api";
import { Plus, Trash2, Pencil, Check, X, Download, Search, Users, Mail, AlertCircle, RotateCcw } from "lucide-react";

const SUBJECTS = [
    "الرياضيات", "التربية الإسلامية", "اللغة الإنجليزية", "اللغة العربية",
    "الكيمياء", "الفيزياء", "الأحياء", "العلوم الاجتماعية",
    "الحوسبة وتكنولوجيا المعلومات", "العلوم", "التربية الرياضية", "المهارات الحياتية",
];

export default function SupervisionTeachers() {
    const teachers = useQuery(api.supervision.getSchoolTeachers) as any[] | undefined;
    const supervisors = useQuery(api.supervision.getSupervisors) as any[] | undefined;
    const seedDefault = useMutation(api.supervision.seedSchoolTeachersDefault);
    const addTeacher = useMutation(api.supervision.addSchoolTeacher);
    const updateTeacher = useMutation(api.supervision.updateSchoolTeacher);
    const deleteTeacher = useMutation(api.supervision.deleteSchoolTeacher);
    const addSupervisor = useMutation(api.supervision.addSupervisor);
    const deleteSupervisor = useMutation(api.supervision.deleteSupervisor);

    const [tab, setTab] = useState<"teachers" | "supervisors">("teachers");
    const [search, setSearch] = useState("");
    const [filterDept, setFilterDept] = useState<string>("all");
    const [editId, setEditId] = useState<string | null>(null);
    const [editName, setEditName] = useState("");
    const [editEmail, setEditEmail] = useState("");
    const [newName, setNewName] = useState("");
    const [newDept, setNewDept] = useState("");
    const [newEmail, setNewEmail] = useState("");
    const [seeding, setSeeding] = useState(false);

    if (!teachers || !supervisors) return <div className="flex justify-center py-10"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-qatar-maroon"/></div>;

    const departments = Array.from(new Set(teachers.map(t => t.department))).sort();

    const filteredTeachers = teachers.filter(t => {
        if (filterDept !== "all" && t.department !== filterDept) return false;
        if (search.trim() && !t.fullName.includes(search.trim()) && !(t.email ?? "").includes(search.trim())) return false;
        return true;
    });

    const byDept: Record<string, any[]> = {};
    for (const t of filteredTeachers) {
        if (!byDept[t.department]) byDept[t.department] = [];
        byDept[t.department].push(t);
    }

    const handleSeed = async () => {
        if (!confirm("سيتم استيراد 82 معلم و 10 منسقين من بيانات المدرسة. هل تريد المتابعة؟")) return;
        setSeeding(true);
        try {
            const result = await seedDefault({}) as any;
            alert(`تم: ${result.added} معلم مضاف · ${result.skipped} موجود مسبقاً`);
        } finally {
            setSeeding(false);
        }
    };

    const handleAdd = async () => {
        if (!newName.trim() || !newDept) return;
        await addTeacher({ fullName: newName, department: newDept, email: newEmail.trim() || undefined });
        setNewName(""); setNewDept(""); setNewEmail("");
    };

    return (
        <div dir="rtl" className="space-y-4">
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="bg-slate-700 px-5 py-3 flex items-center justify-between">
                    <div className="flex gap-2">
                        <button onClick={() => setTab("teachers")}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black ${tab === "teachers" ? "bg-white text-slate-700 shadow" : "bg-white/10 text-white hover:bg-white/20"}`}>
                            <Users className="w-3.5 h-3.5"/>المعلمون ({teachers.length})
                        </button>
                        <button onClick={() => setTab("supervisors")}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black ${tab === "supervisors" ? "bg-white text-slate-700 shadow" : "bg-white/10 text-white hover:bg-white/20"}`}>
                            <Users className="w-3.5 h-3.5"/>الزائرون ({supervisors.length})
                        </button>
                    </div>
                    <span className="font-black text-white text-sm">إدارة الكوادر</span>
                </div>

                <div className="p-5 space-y-4">
                    {tab === "teachers" && (
                        <>
                            {teachers.length === 0 && (
                                <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-4 flex items-center justify-between">
                                    <div>
                                        <p className="font-black text-amber-800 text-sm flex items-center gap-2"><AlertCircle className="w-4 h-4"/>لم يتم استيراد المعلمين بعد</p>
                                        <p className="text-xs text-amber-600 mt-1">استورد قائمة 82 معلم + 10 منسقين من بيانات المدرسة</p>
                                    </div>
                                    <button onClick={handleSeed} disabled={seeding}
                                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 text-white text-sm font-black hover:bg-amber-600 disabled:opacity-50">
                                        {seeding ? <><RotateCcw className="w-4 h-4 animate-spin"/>جارٍ...</> : <><Download className="w-4 h-4"/>استيراد</>}
                                    </button>
                                </div>
                            )}

                            {/* Add new teacher */}
                            <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-2">
                                <p className="text-xs font-black text-slate-500">إضافة معلم منفرد</p>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                    <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="اسم المعلم *"
                                        className="border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold bg-white focus:outline-none focus:border-qatar-maroon"/>
                                    <select value={newDept} onChange={e => setNewDept(e.target.value)}
                                        className="border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold bg-white focus:outline-none focus:border-qatar-maroon">
                                        <option value="">— اختر القسم —</option>
                                        {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                    <input value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="البريد (اختياري)" type="email"
                                        className="border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold bg-white focus:outline-none focus:border-qatar-maroon"/>
                                </div>
                                <button onClick={handleAdd} disabled={!newName.trim() || !newDept}
                                    className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-qatar-maroon text-white text-sm font-black hover:opacity-90 disabled:opacity-40">
                                    <Plus className="w-4 h-4"/>إضافة
                                </button>
                            </div>

                            {/* Search & Filter */}
                            <div className="space-y-2">
                                <div className="relative">
                                    <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"/>
                                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث بالاسم أو البريد..."
                                        className="w-full border-2 border-slate-100 rounded-xl pr-9 pl-3 py-2.5 text-sm focus:outline-none focus:border-qatar-maroon bg-slate-50"/>
                                </div>
                                <div className="flex gap-2 flex-wrap">
                                    <button onClick={() => setFilterDept("all")}
                                        className={`px-3 py-1 rounded-lg text-xs font-black border ${filterDept === "all" ? "bg-qatar-maroon text-white border-transparent" : "bg-white border-slate-200 text-slate-600"}`}>
                                        الكل ({teachers.length})
                                    </button>
                                    {departments.map(d => (
                                        <button key={d} onClick={() => setFilterDept(d)}
                                            className={`px-3 py-1 rounded-lg text-xs font-black border ${filterDept === d ? "bg-qatar-maroon text-white border-transparent" : "bg-white border-slate-200 text-slate-600"}`}>
                                            {d} ({teachers.filter(t => t.department === d).length})
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* List */}
                            {Object.entries(byDept).map(([dept, list]) => (
                                <div key={dept} className="rounded-xl border border-slate-100 overflow-hidden">
                                    <div className="bg-slate-100 px-4 py-2 flex items-center justify-between">
                                        <span className="font-black text-slate-600 text-sm">{dept}</span>
                                        <span className="text-[10px] font-black text-slate-400">{list.length} معلم</span>
                                    </div>
                                    <div className="divide-y divide-slate-100 bg-white">
                                        {list.map(t => editId === t._id ? (
                                            <div key={t._id} className="p-3 flex items-center gap-2 bg-blue-50">
                                                <input value={editName} onChange={e => setEditName(e.target.value)}
                                                    className="flex-1 border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold bg-white focus:outline-none focus:border-qatar-maroon"/>
                                                <input value={editEmail} onChange={e => setEditEmail(e.target.value)} placeholder="البريد"
                                                    className="flex-1 border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold bg-white focus:outline-none focus:border-qatar-maroon"/>
                                                <button onClick={async () => { await updateTeacher({ id: t._id as any, fullName: editName, email: editEmail }); setEditId(null); }}
                                                    className="p-1 rounded-lg bg-emerald-100 text-emerald-600 hover:bg-emerald-200">
                                                    <Check className="w-3.5 h-3.5"/>
                                                </button>
                                                <button onClick={() => setEditId(null)} className="p-1 rounded-lg text-slate-400 hover:bg-slate-100">
                                                    <X className="w-3.5 h-3.5"/>
                                                </button>
                                            </div>
                                        ) : (
                                            <div key={t._id} className="p-3 flex items-center justify-between gap-2">
                                                <div className="flex items-center gap-1 flex-shrink-0">
                                                    <button onClick={() => { setEditId(t._id); setEditName(t.fullName); setEditEmail(t.email ?? ""); }}
                                                        className="p-1.5 rounded-lg text-slate-300 hover:bg-blue-50 hover:text-blue-500">
                                                        <Pencil className="w-3.5 h-3.5"/>
                                                    </button>
                                                    <button onClick={async () => { if (confirm(`حذف ${t.fullName}؟`)) await deleteTeacher({ id: t._id as any }); }}
                                                        className="p-1.5 rounded-lg text-slate-300 hover:bg-red-50 hover:text-red-500">
                                                        <Trash2 className="w-3.5 h-3.5"/>
                                                    </button>
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-bold text-slate-700 truncate">{t.fullName}</p>
                                                    {t.email && (
                                                        <p className="text-[10px] text-slate-400 font-bold flex items-center gap-1 mt-0.5 truncate">
                                                            <Mail className="w-2.5 h-2.5"/>{t.email}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </>
                    )}

                    {tab === "supervisors" && (
                        <SupervisorsManager supervisors={supervisors} onAdd={addSupervisor} onDelete={deleteSupervisor}/>
                    )}
                </div>
            </div>
        </div>
    );
}

function SupervisorsManager({ supervisors, onAdd, onDelete }: { supervisors: any[]; onAdd: any; onDelete: any }) {
    const [name, setName] = useState("");
    const [role, setRole] = useState<"coordinator" | "supervisor" | "deputy">("coordinator");
    const [subjects, setSubjects] = useState<string[]>([]);

    const ROLE_LABELS = { coordinator: "المنسق", supervisor: "الموجه", deputy: "النائب الأكاديمي" };
    const ROLE_COLORS = { coordinator: "#5C1A1B", supervisor: "#1e40af", deputy: "#065f46" };

    const handleAdd = async () => {
        if (!name.trim() || subjects.length === 0) return;
        await onAdd({ fullName: name, role, subjects });
        setName(""); setSubjects([]);
    };

    const byRole: Record<string, any[]> = { coordinator: [], supervisor: [], deputy: [] };
    for (const s of supervisors) byRole[s.role]?.push(s);

    return (
        <div className="space-y-4">
            <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-2">
                <p className="text-xs font-black text-slate-500">إضافة زائر جديد</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input value={name} onChange={e => setName(e.target.value)} placeholder="الاسم *"
                        className="border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold bg-white focus:outline-none focus:border-qatar-maroon"/>
                    <select value={role} onChange={e => setRole(e.target.value as any)}
                        className="border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold bg-white focus:outline-none focus:border-qatar-maroon">
                        <option value="coordinator">المنسق</option>
                        <option value="supervisor">الموجه</option>
                        <option value="deputy">النائب الأكاديمي</option>
                    </select>
                </div>
                <div>
                    <p className="text-[10px] font-black text-slate-500 mb-1.5">المواد *</p>
                    <div className="flex flex-wrap gap-1">
                        {SUBJECTS.map(s => {
                            const sel = subjects.includes(s);
                            return (
                                <button key={s} onClick={() => setSubjects(p => sel ? p.filter(x => x !== s) : [...p, s])}
                                    className={`text-[10px] px-2 py-1 rounded font-black border ${sel ? "text-white border-transparent" : "bg-white border-slate-200 text-slate-600"}`}
                                    style={sel ? { background: ROLE_COLORS[role] } : {}}>
                                    {s}
                                </button>
                            );
                        })}
                    </div>
                </div>
                <button onClick={handleAdd} disabled={!name.trim() || subjects.length === 0}
                    className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-qatar-maroon text-white text-sm font-black hover:opacity-90 disabled:opacity-40">
                    <Plus className="w-4 h-4"/>إضافة
                </button>
            </div>

            {(["coordinator", "supervisor", "deputy"] as const).map(r => byRole[r].length > 0 && (
                <div key={r} className="rounded-xl border border-slate-100 overflow-hidden">
                    <div className="px-4 py-2 flex items-center justify-between" style={{ background: `${ROLE_COLORS[r]}15`, borderRight: `4px solid ${ROLE_COLORS[r]}` }}>
                        <span className="text-[10px] font-black px-2 py-0.5 rounded text-white" style={{ background: ROLE_COLORS[r] }}>{byRole[r].length}</span>
                        <span className="font-black text-sm" style={{ color: ROLE_COLORS[r] }}>{ROLE_LABELS[r]}</span>
                    </div>
                    <div className="divide-y divide-slate-100 bg-white">
                        {byRole[r].map(s => (
                            <div key={s._id} className="p-3 flex items-center justify-between">
                                <button onClick={async () => { if (confirm(`حذف ${s.fullName}؟`)) await onDelete({ id: s._id }); }}
                                    className="p-1.5 rounded-lg text-slate-300 hover:bg-red-50 hover:text-red-500">
                                    <Trash2 className="w-3.5 h-3.5"/>
                                </button>
                                <div className="text-right flex-1 min-w-0">
                                    <p className="text-sm font-bold text-slate-700 truncate">{s.fullName}</p>
                                    <p className="text-[10px] text-slate-400 font-bold mt-0.5 truncate">{s.subjects.join(" · ")}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}
