import { useState, useEffect } from "react";
import { getFunctionName } from "convex/server";
const role = new URLSearchParams(location.search).get("as") === "teacher" ? "teacher" : "admin";
let tasks = [
    { _id: "t1", title: "المصادر لكل المستويات", url: "https://example.com/resources", description: "أضف المصادر التعليمية المطلوبة لقسمك.", audience: ["teacher","coordinator"], audienceLabel: "المعلمون والمنسقون", category: "المصادر التعليمية", academicYear: "2026-2027", order: 1, isActive: true },
    { _id: "t2", title: "رصد الاختبارات القصيرة", url: "/grades", description: "", audience: ["coordinator"], audienceLabel: "المنسقون", category: "التقييم والمتابعة", academicYear: "2026-2027", order: 2, isActive: true },
];
if (new URLSearchParams(location.search).has("long")) {
    tasks = Array.from({ length: 12 }, (_, i) => ({ ...tasks[0], _id: `task-${i+1}`, title: `مهمة تجريبية ${i+1}`, order: i+1 }));
}
export const usePlatformSession = () => ({ role, name: "مستخدم تجريبي" });
// «رأي المعلمين في الطلاب» in memory: one round, two sections, a few students
const op = {
    round: { _id: "r1", title: "استطلاع رأي المدرسين في طلاب الصف الثاني عشر", grade: 12, open: true, published: false, createdAt: 1 },
    teachers: [{ _id: "tm", fullName: "معلم رياضيات تجريبي", department: "الرياضيات" }, { _id: "tp", fullName: "معلم فيزياء تجريبي", department: "الفيزياء" }],
    classes: [{ _id: "c1", name: "12-1" }, { _id: "c2", name: "12-2" }],
    students: [["s1", "طالب تجريبي أول", "c1"], ["s2", "طالب تجريبي ثان", "c1"], ["s3", "طالب تجريبي ثالث", "c2"]].map(([_id, fullName, classId]) => ({ _id, fullName, classId, className: classId === "c1" ? "12-1" : "12-2", nationalId: "00000000000", guardianPhone: "00000000" })),
    opinions: [] as any[],
    links: [] as any[],
};
function opinionQuery(name: string, args: any) {
    if (name.endsWith(":rounds")) return [op.round];
    if (name.endsWith(":setup")) return { round: op.round, teachers: op.teachers, classes: op.classes };
    if (name.endsWith(":sheet")) return { students: op.students.filter(s => s.classId === args.classId), opinions: op.opinions.filter(o => o.classId === args.classId && o.teacherId === args.teacherId && o.subjectName === args.subjectName) };
    if (name.endsWith(":overview")) return { round: op.round, classes: op.classes, students: op.students, opinions: op.opinions, links: op.links };
    return null;
}
function opinionMutation(name: string, args: any) {
    if (name.endsWith(":save")) {
        const st = op.students.find(s => s._id === args.studentId)!;
        let o = op.opinions.find(x => x.studentId === args.studentId && x.teacherId === args.teacherId && x.subjectName === args.subjectName);
        if (!o) op.opinions.push(o = { studentId: st._id, classId: st.classId, teacherId: args.teacherId, teacherName: op.teachers.find(t => t._id === args.teacherId)!.fullName, subjectName: args.subjectName });
        for (const k of ["academic", "behavior", "distraction", "advice"]) if (k in args) o[k] = args[k];
    }
    if (name.endsWith(":setRound")) Object.assign(op.round, args.open !== undefined ? { open: args.open } : {}, args.published !== undefined ? { published: args.published } : {});
    if (name.endsWith(":issueLinks")) { const n = op.students.filter(s => !op.links.some(l => l.studentId === s._id)); n.forEach((s, i) => op.links.push({ studentId: s._id, token: String(i).padStart(48, "a"), expiresAt: Date.now() + 30 * 86400000, openCount: 0 })); return n.length; }
    return null;
}
export function useQuery(ref: any, args: any = {}) {
    const [, refresh] = useState(0);
    useEffect(() => { const fn = () => refresh(n => n+1); window.addEventListener("tasks-preview",fn); return () => window.removeEventListener("tasks-preview",fn); },[]);
    if (getFunctionName(ref).startsWith("studentOpinions:")) return opinionQuery(getFunctionName(ref), args);
    return getFunctionName(ref).endsWith(":manage") ? tasks : tasks.filter(t => t.isActive && (role === "admin" || t.audience.includes(role)));
}
export function useMutation(ref: any) { return async (args: any) => {
    if (getFunctionName(ref).startsWith("studentOpinions:")) { const r = opinionMutation(getFunctionName(ref), args); window.dispatchEvent(new Event("tasks-preview")); return r; }
    if (getFunctionName(ref).endsWith(":save")) { const {id,...fields}=args; tasks = [...tasks.filter(t=>t._id!==id),{...fields,_id:id??"new-task"}]; }
    else tasks = tasks.map(t => t._id === args.id ? {...t,isActive:args.isActive} : t);
    window.dispatchEvent(new Event("tasks-preview"));
}; }

// Read-only stand-in: exports ask the server for data the preview does not have
export const useConvex = () => ({ query: async () => [] as any, mutation: async () => null as any });
