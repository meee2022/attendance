import { v, ConvexError } from "convex/values";
import { memberQuery, staffQuery, staffMutation } from "./platformAccess";

const fields = { title: v.string(), url: v.string(), description: v.string(), audience: v.array(v.string()),
    audienceLabel: v.string(), category: v.string(), academicYear: v.string(), order: v.number(), isActive: v.boolean() };
const internalPaths = new Set(["/grades", "/diagnostics", "/supervision", "/follow-up", "/upload", "/reports", "/assessments", "/practical-exams"]);
export function validateTask(args: any) {
    if (!args.title.trim() || args.title.length > 160) throw new ConvexError("أدخل عنوانًا لا يتجاوز 160 حرفًا");
    const url = args.url.trim();
    if (!internalPaths.has(url)) {
        try {
            const parsed = new URL(url);
            if (parsed.protocol !== "https:" || parsed.username || parsed.password) throw new Error();
        } catch { throw new ConvexError("أدخل رابط HTTPS صحيحًا أو مسار قسم من المنصة"); }
    }
    if (url.length > 4000 || args.description.length > 1000 || args.category.length > 80 || args.audienceLabel.length > 100 || args.academicYear.length > 40) throw new ConvexError("النص أو الرابط أطول من الحد المسموح");
    if (!args.audience.length || args.audience.some((r: string) => !["teacher", "coordinator", "deputy"].includes(r))) throw new ConvexError("حدد الفئة المستهدفة");
    if (!Number.isInteger(args.order) || args.order < 0 || args.order > 9999) throw new ConvexError("الترتيب يجب أن يكون عددًا من 0 إلى 9999");
    return { ...args, title: args.title.trim(), url, audience: [...new Set(args.audience)] };
}
async function rows(ctx: any) {
    return (await ctx.db.query("teacherTasks").withIndex("by_school", (q: any) => q.eq("schoolId", ctx.platformSession.schoolId)).collect())
        .sort((a: any,b: any) => a.order - b.order || a.title.localeCompare(b.title, "ar"));
}
export const list = memberQuery({ args: {}, handler: async ctx => {
    const role = (ctx as any).platformSession.role;
    return (await rows(ctx)).filter((t: any) => t.isActive && (["admin", "deputy"].includes(role) || t.audience.includes(role)));
} });
export const manage = staffQuery({ args: {}, handler: rows });
export const save = staffMutation({ args: { id: v.optional(v.id("teacherTasks")), ...fields }, handler: async (ctx, args) => {
    const { id, ...input } = args;
    const schoolId = (ctx as any).platformSession.schoolId;
    const value = { ...validateTask(input), updatedAt: Date.now() };
    if (id) {
        const previous = await ctx.db.get(id);
        if (!previous || previous.schoolId !== schoolId) throw new ConvexError("المهمة غير متاحة");
        await ctx.db.patch(id, value);
        return id;
    }
    return ctx.db.insert("teacherTasks", { ...value, schoolId });
} });
export const setVisible = staffMutation({ args: { id: v.id("teacherTasks"), isActive: v.boolean() }, handler: async (ctx,args) => {
    const task = await ctx.db.get(args.id);
    if (!task || task.schoolId !== (ctx as any).platformSession.schoolId) throw new ConvexError("المهمة غير متاحة");
    await ctx.db.patch(args.id, { isActive: args.isActive, updatedAt: Date.now() });
} });
