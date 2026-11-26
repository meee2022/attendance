import { useEffect, useState } from "react";
import { levelOf, totalOf } from "../../convex/evaluationForm";
import { getFunctionName } from "convex/server";
const asCoordinator = new URLSearchParams(location.search).get("as") === "coordinator";
export const session: any = asCoordinator
    ? { role: "coordinator", name: "منسق تجريبي", token: "preview", visitorId: "vc1" }
    : { role: "deputy" as const, name: "مستخدم تجريبي", token: "preview" };
export const setup = { today: "2026-09-25", departments: ["العلوم", "الرياضيات", "الدعم الإضافي"],
    settings: { academicYear: "2026 - 2027", yearStart: "2026-08-30", yearEnd: "2027-06-30", requiredCoordinator: 2, requiredSupervisor: 1, requiredDeputy: 1 },
    visitors: [{ _id: "vs1", fullName: "موجه تجريبي", role: "supervisor", subjects: ["العلوم"] }, { _id: "vc1", fullName: "منسق تجريبي", role: "coordinator", subjects: ["العلوم"] }], teachers: [{ _id: "t1", fullName: "معلم تجريبي — العلوم", department: "العلوم" }, { _id: "t2", fullName: "معلم تجريبي — الرياضيات", department: "الرياضيات" }, { _id: "t3", fullName: "معلم تجريبي — الدعم الإضافي", department: "الدعم الإضافي" }],
    classes: [{ _id: "class1", name: "العاشر 1", grade: 10 }], criteria: [{ _id: "c1", domain: "planning", text: "خطة الدرس متوفرة وبنودها مستكملة ومناسبة ومعلنة على نظام قطر للتعليم.", order: 1 }] };
export const visits: any[] = [{ _id: "v1", teacherId: "t1", teacherName: setup.teachers[0].fullName, department: "العلوم", visitorRole: "coordinator", visitorName: "زائر تجريبي", className: "العاشر 1", subjectName: "العلوم", lessonTopic: "درس تجريبي", visitDate: "2026-09-10", followUpType: "full", status: "submitted", averageScore: .67, ratings: '{"c1":2}', domainAverages: '{}', planningRec: "ملاحظة تجريبية لعرض متابعة التوصيات.", executionRec: "", evalMgmtRec: "", notes: "", createdAt: 1, updatedAt: 1 }];
visits.push({ ...visits[0], _id: "v2", status: "draft", averageScore: null, visitorId: "vc1", reviewRequest: { toRole: "deputy", toName: "نائب تجريبي", byName: "منسق تجريبي", note: "راجع توصيات التنفيذ من فضلك", at: 1 } });
// ?pending: the coordinator has signed it and sent it on to the deputy
if (new URLSearchParams(location.search).has("pending")) Object.assign(visits[visits.length - 1], { note: undefined, coordinatorApproval: { name: "منسق تجريبي", at: 1 }, teacherSign: { method: "paper", at: 1 } });
let actions: any[] = [{ _id: "a1", teacherId: "t1", visitId: "v1", kind: "improvement", title: "إجراء تجريبي: إعداد نشاط للتحقق من تحقق أهداف الدرس ومراجعة أثره في الزيارة التالية", owner: "المعلم والمنسق", dueDate: "2026-09-20", evidence: "", status: "open", updatedAt: 1 },
    { _id: "a2", teacherId: "t2", kind: "visit", title: "موعد زيارة صفية تجريبي", owner: "النائب الأكاديمي", dueDate: "2026-10-05", evidence: "", status: "open", updatedAt: 1 }];
export const useSupervisionSession = () => session;
export const SupervisionBoundary = ({ children }: any) => children;
export function useSupervisionQuery(ref: any, args: any = {}) {
    const [, update] = useState(0);
    useEffect(() => { const changed = () => update(n => n + 1); window.addEventListener("preview-data", changed); return () => window.removeEventListener("preview-data", changed); }, []);
    if (args === "skip") return undefined;
    const name = getFunctionName(ref);
    if (name === "supervision:getSchoolTeachers") return setup.teachers;
    if (name === "supervision:getSupervisors") return [{ _id: "vc1", fullName: "منسق تجريبي", role: "coordinator", subjects: ["العلوم"], isActive: true, hasPrivatePin: false }];
    if (name === "supervisionActions:list") return actions;
    if (name === "visits:getSetup") return setup;
    if (name === "visits:listVisits") return visits;
    if (name === "visitWorkflow:reviewers") return [{ key: "deputy", toRole: "deputy", name: "نائب تجريبي", label: "النائب الأكاديمي" }, { key: "vc2", toRole: "coordinator", toVisitorId: "vc2", name: "منسق زميل تجريبي", label: "منسق" }];
    if (name === "visitWorkflow:emailStatus") return { teacherName: "معلم تجريبي", teacherEmail: "teacher@example.com", teacherPhone: null, sends: [] };
    if (name === "visitImports:original") return null;
    if (name === "visitWorkflow:mySignature") return mySignature;
    if (name === "accounts:status") return { sharedCode, teacherSharedCode: true, isAdmin: false, rows: accountRows };
    if (name === "teacherEvaluations:list") return { academicYear: "2026 - 2027", manager, rows: setup.teachers.map((t: any) => { const e = evaluations[t._id]; return {
        teacherId: t._id, teacherName: t.fullName, department: t.department, isCoordinator: false, evaluationId: e?._id ?? null, status: e?.status ?? "none",
        scored: e ? Object.keys(e.scores).length : 0, total: e ? totalOf(e.scores) : null, level: e && Object.keys(e.scores).length === 34 ? levelOf(totalOf(e.scores)) : "",
        sentTotal: e?.sent?.total ?? null, signed: false, previousTotal: t._id === "t1" ? 88 : null }; }) };
    if (name === "teacherEvaluations:get") { const t: any = setup.teachers.find((x: any) => x._id === args.teacherId), e = evaluations[args.teacherId]; return {
        academicYear: "2026 - 2027", manager, teacherName: t.fullName, department: t.department,
        profile: { employeeNo: "10001", personalNo: "29900000000", hireDate: args.teacherId === "t1" ? "01/09/2015" : "", jobTitle: `مدرس ${t.department}`, nationality: "تجريبي" },
        evaluation: e ? { ...e, total: totalOf(e.scores), approval: null, signedAt: null, signComment: "" } : null,
        editable: !e || (e.status !== "approved" && (manager || e.status === "draft")),
        previous: args.teacherId === "t1" ? { academicYear: "2025 - 2026", total: 88, scores: { "1.1": 2, "1.2": 3 } } : null, principalName: "مدير تجريبي", schoolName: "مدرسة تجريبية" }; }
    return [];
}
// personal accounts, kept in the page's memory
let sharedCode = true;
const accountRows: any[] = [
    { role: "deputy", ownerId: null, name: "نائب تجريبي", group: "الإدارة والمنسقون", detail: "النائب الأكاديمي", activatedAt: Date.UTC(2026, 10, 20), linkExpiresAt: null, phone: "", email: "" },
    { role: "admin", ownerId: null, name: "مسؤول المنصة", group: "الإدارة والمنسقون", detail: "مسؤول المنصة", activatedAt: null, linkExpiresAt: null, phone: "", email: "" },
    { role: "coordinator", ownerId: "vc1", name: "منسق تجريبي", group: "الإدارة والمنسقون", detail: "منسق العلوم", activatedAt: null, linkExpiresAt: null, phone: "55500001", email: "c1@example.com" },
    { role: "coordinator", ownerId: "vc2", name: "منسق زميل تجريبي", group: "الإدارة والمنسقون", detail: "منسق الرياضيات", activatedAt: null, linkExpiresAt: null, phone: "55500002", email: "c2@example.com" },
    ...["العلوم", "العلوم", "الرياضيات"].map((d, i) => ({ role: "teacher", ownerId: `tt${i}`, name: `معلم تجريبي ${i + 1}`, group: d, detail: `معلم ${d}`, activatedAt: i === 2 ? Date.UTC(2026, 10, 21) : null, linkExpiresAt: null, phone: `5550010${i}`, email: `t${i}@example.com` })),
];
// the yearly appraisal, kept in the page's memory
const manager = !new URLSearchParams(location.search).get("as")?.startsWith("coord");
const evaluations: Record<string, any> = {};
let mySignature: string | null = new URLSearchParams(location.search).has("signed") ? "/forms/moe-logo.png" : null;
const changed = () => window.dispatchEvent(new Event("preview-data"));
const patchVisit = (id: string, patch: any) => { const i = visits.findIndex(v => v._id === id); if (i >= 0) visits[i] = { ...visits[i], ...patch }; changed(); };
export function useSupervisionMutation(ref: any) { return async (args: any) => {
    const name = getFunctionName(ref);
    if (name === "supervisionActions:save") {
        const record = { ...args, _id: args.id || String(Date.now()), updatedAt: Date.now() };
        actions = [...actions.filter(a => a._id !== record._id), record]; changed();
    }
    // the signing steps of a coordinator's visit, kept in the page's memory
    if (name === "visitWorkflow:uploadUrl") return "/__test-upload";
    if (name === "visitWorkflow:setMySignature") { mySignature = args.storageId ? "/forms/moe-logo.png" : null; changed(); return null; }
    if (name === "visitWorkflow:recordTeacherSign") { patchVisit(args.visitId, { teacherSign: { method: args.method, at: Date.now(), reason: args.reason ?? null } }); return null; }
    if (name === "visitWorkflow:clearTeacherSign") { patchVisit(args.visitId, { teacherSign: null }); return null; }
    if (name === "visitWorkflow:sendToDeputy") { patchVisit(args.visitId, { reviewRequest: { toRole: "deputy", toName: "نائب تجريبي", byName: session.name, at: Date.now() } }); return null; }
    if (name === "supervisionAcknowledgements:create") return null;
    if (name === "accounts:createActivations") { for (const item of args.items) accountRows.find(r => r.role === item.role && (r.ownerId ?? undefined) === item.ownerId).linkExpiresAt = Date.now() + 48 * 3600000; changed(); return null; }
    if (name === "accounts:setFor") { accountRows.find(r => r.role === args.role && (r.ownerId ?? undefined) === args.ownerId).activatedAt = Date.now(); changed(); return null; }
    if (name === "accounts:retireSharedCode") { sharedCode = false; changed(); return null; }
    if (name === "teacherEvaluations:save") { const scores = JSON.parse(args.scores), old = evaluations[args.teacherId];
        evaluations[args.teacherId] = { _id: `e-${args.teacherId}`, evaluatorName: session.name, evaluatorRole: manager ? "deputy" : "coordinator", ...old, scores, penalties: args.penalties, courses: args.courses, updatedAt: Date.now(),
            status: args.send && !manager ? "sent" : old?.status ?? "draft", sent: args.send && !manager ? { scores, total: totalOf(scores), at: Date.now(), name: session.name } : old?.sent ?? null };
        changed(); return { id: `e-${args.teacherId}`, status: evaluations[args.teacherId].status }; }
    if (name === "teacherEvaluations:approve" || name === "teacherEvaluations:reopen") { const e: any = Object.values(evaluations).find((x: any) => x._id === args.id);
        e.status = name.endsWith("approve") ? "approved" : "draft"; e.updatedAt = Date.now(); changed(); return null; }
    if (name === "teacherEvaluations:remove") { for (const k of Object.keys(evaluations)) if (evaluations[k]._id === args.id) delete evaluations[k]; changed(); return null; }
    if (name === "teacherEvaluations:createLink" || name === "teacherEvaluations:saveProfile") return null;
    if (name === "visits:saveVisit") {
        const id = args.id || `v${Date.now()}`, teacher = setup.teachers.find(t => t._id === args.teacherId);
        const signing = asCoordinator && args.status === "submitted";
        const row = { ...visits[0], ...args, _id: id, teacherName: teacher?.fullName ?? "", department: teacher?.department ?? "", visitorName: session.name, visitorId: session.visitorId,
            visitorRole: session.role, status: signing ? "draft" : args.status, averageScore: null, updatedAt: Date.now(), reviewRequest: null, teacherSign: null,
            coordinatorApproval: signing ? { name: session.name, at: Date.now() } : null };
        const i = visits.findIndex(v => v._id === id);
        if (i >= 0) visits[i] = row; else visits.push(row);
        changed();
        return { ok: true, id, recordNo: null, status: row.status, awaitingTeacher: signing, awaitingDeputy: false };
    }
    return { ok: true, id: "preview-visit", recordNo: 1 };
}; }

export const useSupervisionAction = () => async () => "preview-import";
