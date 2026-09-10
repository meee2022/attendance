import { useQuery } from "convex/react";
// @ts-ignore
import { api } from "../../convex/_generated/api";

// Feature keys — must match nav `to` paths
export const FEATURES: { key: string; label: string; description: string }[] = [
    { key: "/",            label: "الرئيسية",          description: "لوحة المتابعة اليومية للحضور والغياب" },
    { key: "/upload",      label: "رصد الغياب",         description: "رفع ملفات Teams/Excel للحضور" },
    { key: "/grades",      label: "التقييمات القصيرة",        description: "إدخال درجات التقييمات" },
    { key: "/follow-up",   label: "المتابعة اليومية",   description: "كشف تقييم يومي للطلاب حسب معايير الحصة" },
    { key: "/reports",     label: "التقارير",          description: "التقارير الإحصائية" },
    { key: "/assessments", label: "التطبيقات",         description: "متابعة التطبيقات/التقييمات" },
    { key: "/supervision", label: "الإشراف الصفي",      description: "استمارات الإشراف على المعلمين" },
    { key: "/surveys",     label: "الاستبانات",         description: "استبانات حصر الاحتياجات" },
    { key: "/messages",    label: "الرسائل",            description: "رسائل أولياء الأمور" },
    { key: "/practical-exams", label: "الاختبارات العملية", description: "رصد غياب اختبارات العملي/الشفوي/الاستماع" },
];

export function useHiddenFeatures(): string[] {
    return useHiddenFeaturesState().hidden;
}

// Same data, but tells you whether the answer has actually arrived — routing
// decisions must not act on an empty list that only means "still loading".
export function useHiddenFeaturesState(): { hidden: string[]; isLoading: boolean } {
    const list = useQuery(api.settings.getHiddenFeatures) as string[] | undefined;
    return { hidden: list ?? [], isLoading: list === undefined };
}

// First page the user can actually open, in navbar order.
export function firstVisibleFeature(navOrder: string[], hidden: string[]): string | undefined {
    return navOrder.find(key => !hidden.includes(key));
}

export function isFeatureHidden(key: string, hidden: string[]): boolean {
    return hidden.includes(key);
}
