import { useQuery } from "convex/react";
// @ts-ignore
import { api } from "../../convex/_generated/api";

// Feature keys — must match nav `to` paths
export const FEATURES: { key: string; label: string; description: string }[] = [
    { key: "/",            label: "الرئيسية",          description: "لوحة المتابعة اليومية للحضور والغياب" },
    { key: "/upload",      label: "رصد الغياب",         description: "رفع ملفات Teams/Excel للحضور" },
    { key: "/grades",      label: "رصد الدرجات",        description: "إدخال درجات التقييمات" },
    { key: "/reports",     label: "التقارير",          description: "التقارير الإحصائية" },
    { key: "/assessments", label: "التطبيقات",         description: "متابعة التطبيقات/التقييمات" },
    { key: "/supervision", label: "الإشراف الصفي",      description: "استمارات الإشراف على المعلمين" },
    { key: "/surveys",     label: "الاستبانات",         description: "استبانات حصر الاحتياجات" },
    { key: "/messages",    label: "الرسائل",            description: "رسائل أولياء الأمور" },
];

export function useHiddenFeatures(): string[] {
    const list = useQuery(api.settings.getHiddenFeatures) as string[] | undefined;
    return list ?? [];
}

export function isFeatureHidden(key: string, hidden: string[]): boolean {
    return hidden.includes(key);
}
