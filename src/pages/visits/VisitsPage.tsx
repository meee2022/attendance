import { useState } from "react";
import { useQuery } from "convex/react";
// @ts-ignore
import { api } from "../../../convex/_generated/api";
import {
    ClipboardCheck, LayoutDashboard, Plus, Layers, User, BarChart3, Users, LogOut,
} from "lucide-react";
import { PageHeader, PageTabs, LoadingSpinner } from "../../components/ui";
import SupervisionPinGate, { getStoredRole, clearStoredRole } from "../../components/SupervisionPinGate";
import SupervisionTeachers from "../SupervisionTeachers";
import { ROLE_LABELS, type VisitorRole } from "../../../convex/visitMath";
import type { VisitRow } from "../../lib/visitStats";
import VisitsDashboard from "./VisitsDashboard";
import VisitForm from "./VisitForm";
import VisitsRegistry from "./VisitsRegistry";
import TeacherFile from "./TeacherFile";
import VisitsAnalysis from "./VisitsAnalysis";

// One place for the whole supervision cycle. It opens on the overview — who
// has been visited, who has not, where each department stands — because that
// is the question the academic deputy comes with; recording a visit is one
// tab away.

type Tab = "dashboard" | "new" | "registry" | "teacher" | "analysis" | "people";

export type Session = { role: VisitorRole; name: string; visitorId?: string };

export default function VisitsPage() {
    const [session, setSession] = useState<Session | null>(() => {
        const s = getStoredRole();
        return s ? { role: s.role, name: s.name, visitorId: s.visitorId } : null;
    });
    const [tab, setTab] = useState<Tab>("dashboard");
    const [editingId, setEditingId] = useState<string | null>(null);
    const [teacherFocus, setTeacherFocus] = useState<string>("");

    // @ts-ignore
    const setup = useQuery(api.visits.getSetup) as any;
    // @ts-ignore
    const visits = useQuery(api.visits.listVisits, {}) as VisitRow[] | undefined;

    if (!session) {
        return <SupervisionPinGate onAuthed={() => {
            const s = getStoredRole();
            if (s) setSession({ role: s.role, name: s.name, visitorId: s.visitorId });
        }}/>;
    }

    if (!setup || !visits) return <LoadingSpinner label="جاري تحميل الإشراف الصفي…"/>;

    const openTeacher = (teacherId: string) => { setTeacherFocus(teacherId); setTab("teacher"); };
    const editVisit = (id: string) => { setEditingId(id); setTab("new"); };
    const printVisit = (id: string) => window.open(`/supervision/print/${id}`, "_blank");

    const drafts = visits.filter(v => v.status === "draft").length;

    return (
        <div dir="rtl" className="max-w-7xl mx-auto space-y-5 pb-20">
            <PageHeader icon={<ClipboardCheck className="w-5 h-5"/>} title="الإشراف الصفي"
                subtitle={`استمارة الإشراف على أداء المعلم · العام الأكاديمي ${setup.settings.academicYear}`}
                badges={<>
                    <span className="px-2 py-0.5 rounded-full bg-qatar-maroon/10 text-qatar-maroon">
                        {ROLE_LABELS[session.role]} · {session.name}
                    </span>
                    {drafts > 0 && (
                        <button onClick={() => setTab("registry")}
                            className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 hover:bg-amber-200">
                            {drafts} مسودة غير معتمدة
                        </button>
                    )}
                </>}>
                <button onClick={() => { clearStoredRole(); setSession(null); }}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border border-slate-200 text-slate-500 hover:border-qatar-maroon hover:text-qatar-maroon">
                    <LogOut className="w-4 h-4"/>تبديل المستخدم
                </button>
            </PageHeader>

            <PageTabs<Tab> label="أقسام الإشراف الصفي" active={tab}
                onChange={t => { if (t !== "new") setEditingId(null); setTab(t); }}
                items={[
                    { id: "dashboard", label: "لوحة المتابعة", icon: <LayoutDashboard className="w-4 h-4"/> },
                    { id: "new", label: editingId ? "تعديل زيارة" : "زيارة جديدة", icon: <Plus className="w-4 h-4"/> },
                    { id: "registry", label: "سجل الزيارات", icon: <Layers className="w-4 h-4"/> },
                    { id: "teacher", label: "ملف المعلم", icon: <User className="w-4 h-4"/> },
                    { id: "analysis", label: "التحليل", icon: <BarChart3 className="w-4 h-4"/> },
                    { id: "people", label: "المعلمون والزائرون", icon: <Users className="w-4 h-4"/> },
                ]}/>

            {tab === "dashboard" && (
                <VisitsDashboard setup={setup} visits={visits} onOpenTeacher={openTeacher}
                    onNewVisit={() => { setEditingId(null); setTab("new"); }}/>
            )}
            {tab === "new" && (
                <VisitForm key={editingId ?? "new"} setup={setup} session={session} editingId={editingId}
                    visits={visits}
                    onDone={() => { setEditingId(null); setTab("registry"); }}/>
            )}
            {tab === "registry" && (
                <VisitsRegistry setup={setup} visits={visits} session={session}
                    onEdit={editVisit} onPrint={printVisit} onOpenTeacher={openTeacher}/>
            )}
            {tab === "teacher" && (
                <TeacherFile setup={setup} visits={visits} teacherId={teacherFocus}
                    onChangeTeacher={setTeacherFocus} onPrint={printVisit}/>
            )}
            {tab === "analysis" && <VisitsAnalysis setup={setup} visits={visits}/>}
            {tab === "people" && <SupervisionTeachers/>}
        </div>
    );
}
