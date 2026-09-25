import { v, ConvexError } from "convex/values";
import { sessionQuery, sessionMutation, canAccess, requireVisit } from "./supervisionAccess";

// Operational records live outside the approved ministry form and its snapshot.
export const list = sessionQuery({ args: {}, handler: async ctx => {
    const access = (ctx as any).supervisionSession;
    const rows = await ctx.db.query("supervisionActions").withIndex("by_school", q => q.eq("schoolId", access.schoolId)).collect();
    return rows.filter(r => canAccess(access, r.schoolId, r.department)).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
} });

export const save = sessionMutation({
    args: { id: v.optional(v.id("supervisionActions")), teacherId: v.id("schoolTeachers"),
        visitId: v.optional(v.id("supervisionVisits")), completionVisitId: v.optional(v.id("supervisionVisits")),
        kind: v.union(v.literal("improvement"), v.literal("training"), v.literal("visit")),
        title: v.string(), owner: v.string(), dueDate: v.string(), evidence: v.string(),
        status: v.union(v.literal("open"), v.literal("done"), v.literal("cancelled")),
        expectedUpdatedAt: v.optional(v.number()) },
    handler: async (ctx, args) => {
        const access = (ctx as any).supervisionSession;
        const teacher = await ctx.db.get(args.teacherId);
        if (!teacher || !canAccess(access, teacher.schoolId, teacher.department ?? "")) throw new ConvexError("المعلم خارج نطاق صلاحياتك");
        const old = args.id ? await ctx.db.get(args.id) : null;
        if (args.id && (!old || !canAccess(access, old.schoolId, old.department))) throw new ConvexError("سجل المتابعة غير متاح");
        if (old && old.updatedAt !== args.expectedUpdatedAt) throw new ConvexError("تم تعديل السجل بواسطة مستخدم آخر؛ أعد فتحه قبل الحفظ");
        if (old && old.teacherId !== args.teacherId) throw new ConvexError("لا يمكن تغيير المعلم بعد إنشاء السجل");
        if (!args.title.trim() || !args.owner.trim()) throw new ConvexError("أدخل الإجراء والمسؤول عن تنفيذه");
        if (args.title.length > 2000 || args.evidence.length > 10000 || args.owner.length > 200) throw new ConvexError("النص أطول من المسموح");
        if (!/^\d{4}-\d{2}-\d{2}$/.test(args.dueDate) || !Number.isFinite(Date.parse(args.dueDate)) || new Date(args.dueDate).toISOString().slice(0,10) !== args.dueDate) throw new ConvexError("أدخل موعداً صحيحاً");
        if (args.status === "done" && !args.evidence.trim()) throw new ConvexError("دوّن دليل الإنجاز أو نتيجة المتابعة قبل الإكمال");
        for (const id of [args.visitId, args.completionVisitId]) {
            if (!id) continue;
            const visit = await requireVisit(ctx, access, id);
            if (visit.teacherId !== args.teacherId || visit.deletedAt || visit.status !== "submitted") throw new ConvexError("اختر زيارة معتمدة لنفس المعلم");
        }
        if (args.kind === "visit" && args.status === "done" && !args.completionVisitId) throw new ConvexError("اربط الموعد بالزيارة المنفذة لإكماله");
        if (args.visitId && args.visitId === args.completionVisitId) throw new ConvexError("زيارة المتابعة يجب أن تختلف عن الزيارة الأصلية");
        const { id, expectedUpdatedAt, ...fields } = args;
        const now = Date.now();
        const data = { ...fields, title: args.title.trim(), owner: args.owner.trim(), evidence: args.evidence.trim(),
            schoolId: teacher.schoolId, department: teacher.department ?? "", updatedAt: now, updatedBy: access.name };
        const result = old ? (await ctx.db.patch(old._id, data), old._id)
            : await ctx.db.insert("supervisionActions", { ...data, createdAt: now, createdBy: access.name });
        await ctx.db.insert("supervisionAuditLog", { schoolId: teacher.schoolId, visitId: args.visitId, action: "follow_up",
            actorName: access.name, actorRole: access.role, details: `${teacher.fullName}: ${data.title} (${args.status})`, timestamp: now });
        return result;
    },
});
