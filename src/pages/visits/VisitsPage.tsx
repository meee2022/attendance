import { VisitArchiveSettings } from "./VisitArchive";
import VisitFollowUp from "./VisitFollowUp";
import "./visits.css";
import { useMemo, useState } from "react";
import { useSupervisionQuery as useQuery, SupervisionBoundary, useSupervisionSession } from "../../lib/supervisionSession";
// @ts-ignore
import { api } from "../../../convex/_generated/api";
import {
    ClipboardCheck, LayoutDashboard, Plus, Layers, User, BarChart3, Users, LogOut,
} from "lucide-react";
import { PageHeader, LoadingSpinner } from "../../components/ui";
import { clearStoredRole } from "../../components/SupervisionPinGate";
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

type Tab = "dashboard" | "new" | "registry" | "teacher" | "analysis" | "people" | "followup";

export type Session = { role: VisitorRole; name: string; visitorId?: string };

export default function VisitsPage() {
    return <SupervisionBoundary><AuthenticatedVisits/></SupervisionBoundary>;
}
function AuthenticatedVisits() {
    const session = useSupervisionSession()!;
    const setup = useQuery(api.visits.getSetup) as any;
    const visits = useQuery(api.visits.listVisits, {}) as VisitRow[] | undefined;
    if (!setup || !visits) return <LoadingSpinner label="جاري تحميل الإشراف الصفي…"/>;
    return <VisitsWorkspace setup={setup} visits={visits} session={session}
        onSignOut={() => { clearStoredRole(); }}/ >;
}

// The departments a visitor works in: a coordinator or a supervisor sees the
// teachers and visits of their own department(s); the academic deputy sees all.
export function scopeOf(setup: any, session: Session): string[] | null {
    if (session.role === "deputy") return null;
    const me = setup.visitors.find((v: any) => v._id === session.visitorId);
    const mine = (me?.subjects ?? []).map((s: string) => s.trim()).filter((s: string) => setup.departments.includes(s));
    return mine;
}

// The page once the visitor is known — kept apart from the sign-in so it can be
// rendered on its own.
export function VisitsWorkspace({ setup: fullSetup, visits: allVisits, session, onSignOut }: {
    setup: any; visits: VisitRow[]; session: Session; onSignOut: () => void;
}) {
    const [tab, setTab] = useState<Tab>("dashboard");
    const [editingId, setEditingId] = useState<string | null>(null);
    const [dirty, setDirty] = useState(false);
    const [registryView, setRegistryView] = useState<"submitted" | "draft">("submitted");
    const [followupTeacher, setFollowupTeacher] = useState("");
    const [teacherFocus, setTeacherFocus] = useState<string>("");

    // Everything below is narrowed to the visitor's departments once, here, so
    // no view can show a coordinator another department's teachers
    const scope = scopeOf(fullSetup, session);
    const scopeKey = scope?.join("|") ?? "";
    const { setup, visits } = useMemo(() => {
        if (!scope) return { setup: fullSetup, visits: allVisits };
        return {
            setup: {
                ...fullSetup,
                departments: scope,
                teachers: fullSetup.teachers.filter((t: any) => scope.includes(t.department)),
            },
            visits: allVisits.filter(v => scope.includes(v.department)),
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fullSetup, allVisits, scopeKey]);

    const openFollowUp = (id = "") => { setFollowupTeacher(id); setTab("followup"); };
    const openTeacher = (teacherId: string) => { if (dirty && !window.confirm("يوجد تعديل لم يُحفظ. هل تريد فتح ملف المعلم؟")) return; setTeacherFocus(teacherId); setTab("teacher"); };
    const editVisit = (id: string) => { setEditingId(id); setTab("new"); };
    const printVisit = (id: string) => window.open(`/supervision/print/${id}`, "_blank");

    const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
        { key: "dashboard", label: "لوحة المتابعة", icon: <LayoutDashboard className="w-4 h-4"/> },
        { key: "new", label: editingId ? "تعديل زيارة" : "زيارة جديدة", icon: <Plus className="w-4 h-4"/> },
        { key: "registry", label: "سجل الزيارات", icon: <Layers className="w-4 h-4"/> },
        { key: "teacher", label: "ملف المعلم", icon: <User className="w-4 h-4"/> },
        { key: "analysis", label: "التحليل", icon: <BarChart3 className="w-4 h-4"/> },
        { key: "followup", label: "المتابعة والخطة", icon: <ClipboardCheck className="w-4 h-4"/> },
        // Managing the staff list is the deputy's job, not each department's
        ...(session.role === "deputy"
            ? [{ key: "people" as Tab, label: "المعلمون والزائرون", icon: <Users className="w-4 h-4"/> }]
            : []),
    ];

    return (
        <div dir="rtl" className="grades-page max-w-7xl mx-auto space-y-5 pb-20">
            <PageHeader icon={<ClipboardCheck className="w-5 h-5"/>} title="الإشراف الصفي"
                subtitle={`استمارة الإشراف على أداء المعلم · العام الأكاديمي ${setup.settings.academicYear}`}>
                <span className="grades-header-note flex items-center gap-2">
                    {ROLE_LABELS[session.role]} · {session.name}{scope ? ` · ${scope.join("، ")}` : ""}
                    <button onClick={() => { if (!dirty || window.confirm("يوجد تعديل لم يُحفظ في السجل. هل تريد تغيير المستخدم؟")) onSignOut(); }} title="تبديل المستخدم" aria-label="تبديل المستخدم"
                        className="p-1 rounded-md text-slate-400 hover:text-qatar-maroon hover:bg-qatar-cream-dark">
                        <LogOut className="w-4 h-4"/>
                    </button>
                </span>
            </PageHeader>

            <VisitArchiveSettings/>
            <div className="grades-tabs" role="group" aria-label="أقسام الإشراف الصفي">
                {tabs.map(({ key, label, icon }) => (
                    <button key={key} aria-pressed={tab === key}
                        onClick={() => { if (key !== tab && dirty && !window.confirm("يوجد تعديل لم يُحفظ في السجل. هل تريد مغادرة النموذج؟")) return; if (key !== "new") setEditingId(null); setTab(key); }}
                        className={`grades-tab ${tab === key ? "is-active" : ""}`}>
                        {icon}{label}
                    </button>
                ))}
            </div>

            {tab === "dashboard" && (
                <VisitsDashboard setup={setup} visits={visits} onOpenTeacher={openTeacher}
                    onNewVisit={() => { setEditingId(null); setTab("new"); }}
                    onOpenFollowUp={() => openFollowUp()}
                    onOpenDrafts={() => { setRegistryView("draft"); setTab("registry"); }}/>
            )}
            {tab === "new" && (
                <VisitForm key={editingId ?? "new"} setup={setup} session={session} editingId={editingId}
                    onNewVisit={() => { setDirty(false); setEditingId(null); }}
                    visits={visits} onDirtyChange={setDirty}
                    onDone={() => { setDirty(false); setEditingId(null); setRegistryView("submitted"); setTab("registry"); }}/>
            )}
            {tab === "registry" && (
                <VisitsRegistry initialView={registryView} setup={setup} visits={visits} session={session}
                    onEdit={editVisit} onPrint={printVisit} onOpenTeacher={openTeacher}/>
            )}
            {tab === "teacher" && (
                <TeacherFile setup={setup} visits={visits} teacherId={teacherFocus}
                    onChangeTeacher={setTeacherFocus} onPrint={printVisit} onFollowUp={openFollowUp}/>
            )}
            {tab === "followup" && <VisitFollowUp onDirtyChange={setDirty} setup={setup} visits={visits} teacherId={followupTeacher} onOpenTeacher={openTeacher}/>}
            {tab === "analysis" && <VisitsAnalysis setup={setup} visits={visits}/>}
            {tab === "people" && session.role === "deputy" && <SupervisionTeachers/>}
        </div>
    );
}
