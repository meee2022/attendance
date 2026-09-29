import { useState, useEffect } from "react";
import { getFunctionName } from "convex/server";
const role = new URLSearchParams(location.search).get("as") === "teacher" ? "teacher" : "admin";
let tasks = [
    { _id: "t1", title: "المصادر لكل المستويات", url: "https://example.com/resources", description: "أضف المصادر التعليمية المطلوبة لقسمك.", audience: ["teacher","coordinator"], audienceLabel: "المعلمون والمنسقون", category: "المصادر التعليمية", academicYear: "2026-2027", order: 1, isActive: true },
    { _id: "t2", title: "رصد الاختبارات القصيرة", url: "/grades", description: "", audience: ["coordinator"], audienceLabel: "المنسقون", category: "التقييم والمتابعة", academicYear: "2026-2027", order: 2, isActive: true },
];
export const usePlatformSession = () => ({ role, name: "مستخدم تجريبي" });
export function useQuery(ref: any) {
    const [, refresh] = useState(0);
    useEffect(() => { const fn = () => refresh(n => n+1); window.addEventListener("tasks-preview",fn); return () => window.removeEventListener("tasks-preview",fn); },[]);
    return getFunctionName(ref).endsWith(":manage") ? tasks : tasks.filter(t => t.isActive && (role === "admin" || t.audience.includes(role)));
}
export function useMutation(ref: any) { return async (args: any) => {
    if (getFunctionName(ref).endsWith(":save")) { const {id,...fields}=args; tasks = [...tasks.filter(t=>t._id!==id),{...fields,_id:id??"new-task"}]; }
    else tasks = tasks.map(t => t._id === args.id ? {...t,isActive:args.isActive} : t);
    window.dispatchEvent(new Event("tasks-preview"));
}; }
