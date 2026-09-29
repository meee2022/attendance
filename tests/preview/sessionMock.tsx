import { useEffect, useState } from "react";
import { getFunctionName } from "convex/server";
const asCoordinator = new URLSearchParams(location.search).get("as") === "coordinator";
export const session: any = asCoordinator
    ? { role: "coordinator", name: "منسق تجريبي", token: "preview", visitorId: "vc1" }
    : { role: "deputy" as const, name: "مستخدم تجريبي", token: "preview" };
export const setup = { today: "2026-09-25", departments: ["العلوم", "الرياضيات"],
    settings: { academicYear: "2026 - 2027", yearStart: "2026-08-30", yearEnd: "2027-06-30", requiredCoordinator: 2, requiredSupervisor: 1, requiredDeputy: 1 },
    visitors: [{ _id: "vs1", fullName: "موجه تجريبي", role: "supervisor", subjects: ["العلوم"] }, { _id: "vc1", fullName: "منسق تجريبي", role: "coordinator", subjects: ["العلوم"] }], teachers: [{ _id: "t1", fullName: "معلم تجريبي — العلوم", department: "العلوم" }, { _id: "t2", fullName: "معلم تجريبي — الرياضيات", department: "الرياضيات" }],
    classes: [{ _id: "class1", name: "العاشر 1", grade: 10 }], criteria: [{ _id: "c1", domain: "planning", text: "معيار تجريبي للمعاينة فقط", order: 1 }] };
export const visits: any[] = [{ _id: "v1", teacherId: "t1", teacherName: setup.teachers[0].fullName, department: "العلوم", visitorRole: "coordinator", visitorName: "زائر تجريبي", className: "العاشر 1", subjectName: "العلوم", lessonTopic: "درس تجريبي", visitDate: "2026-09-10", followUpType: "full", status: "submitted", averageScore: .67, ratings: '{"c1":2}', domainAverages: '{}', planningRec: "ملاحظة تجريبية لعرض متابعة التوصيات.", executionRec: "", evalMgmtRec: "", notes: "", createdAt: 1, updatedAt: 1 }];
visits.push({ ...visits[0], _id: "v2", status: "draft", averageScore: null, visitorId: "vc1", reviewRequest: { toRole: "deputy", toName: "نائب تجريبي", byName: "منسق تجريبي", note: "راجع توصيات التنفيذ من فضلك", at: 1 } });
let actions: any[] = [{ _id: "a1", teacherId: "t1", visitId: "v1", kind: "improvement", title: "إجراء تجريبي: إعداد نشاط للتحقق من تحقق أهداف الدرس ومراجعة أثره في الزيارة التالية", owner: "المعلم والمنسق", dueDate: "2026-09-20", evidence: "", status: "open", updatedAt: 1 },
    { _id: "a2", teacherId: "t2", kind: "visit", title: "موعد زيارة صفية تجريبي", owner: "النائب الأكاديمي", dueDate: "2026-10-05", evidence: "", status: "open", updatedAt: 1 }];
export const useSupervisionSession = () => session;
export const SupervisionBoundary = ({ children }: any) => children;
export function useSupervisionQuery(ref: any, args: any = {}) {
    const [, update] = useState(0);
    useEffect(() => { const changed = () => update(n => n + 1); window.addEventListener("preview-data", changed); return () => window.removeEventListener("preview-data", changed); }, []);
    if (args === "skip") return undefined;
    const name = getFunctionName(ref);
    if (name === "supervisionActions:list") return actions;
    if (name === "visits:getSetup") return setup;
    if (name === "visits:listVisits") return visits;
    if (name === "visitWorkflow:reviewers") return [{ key: "deputy", toRole: "deputy", name: "نائب تجريبي", label: "النائب الأكاديمي" }, { key: "vc2", toRole: "coordinator", toVisitorId: "vc2", name: "منسق زميل تجريبي", label: "منسق" }];
    if (name === "visitWorkflow:emailStatus") return { teacherName: "معلم تجريبي", teacherEmail: "teacher@example.com", teacherPhone: null, sends: [] };
    if (name === "visitImports:original") return null;
    if (name === "visitWorkflow:mySignature") return null;
    return [];
}
export function useSupervisionMutation(ref: any) { return async (args: any) => {
    if (getFunctionName(ref) === "supervisionActions:save") {
        const record = { ...args, _id: args.id || String(Date.now()), updatedAt: Date.now() };
        actions = [...actions.filter(a => a._id !== record._id), record]; window.dispatchEvent(new Event("preview-data"));
    }
    return { ok: true, id: "preview-visit", recordNo: 1 };
}; }

export const useSupervisionAction = () => async () => "preview-import";
