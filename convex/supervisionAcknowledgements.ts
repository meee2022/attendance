import { query, mutation } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { sessionQuery, sessionMutation, requireVisit, digest } from "./supervisionAccess";

export const status = sessionQuery({ args: { visitId: v.id("supervisionVisits") }, handler: async (ctx, args) => {
    await requireVisit(ctx, (ctx as any).supervisionSession, args.visitId);
    const records = await ctx.db.query("supervisionAcknowledgements").withIndex("by_visit", q => q.eq("visitId", args.visitId)).collect();
    return records.map(({ tokenHash, ...row }) => row).sort((a,b) => b._creationTime - a._creationTime);
} });

export const create = sessionMutation({ args: { visitId: v.id("supervisionVisits"), token: v.string() }, handler: async (ctx, args) => {
    const access = (ctx as any).supervisionSession;
    const visit = await requireVisit(ctx, access, args.visitId, true);
    if (visit.status !== "submitted" || visit.deletedAt) throw new ConvexError("يلزم اختيار زيارة معتمدة");
    if (!/^[a-f0-9]{64}$/.test(args.token)) throw new ConvexError("أعد إنشاء الرابط");
    const tokenHash = await digest(args.token);
    if (await ctx.db.query("supervisionAcknowledgements").withIndex("by_token", q => q.eq("tokenHash", tokenHash)).first()) throw new ConvexError("أعد إنشاء الرابط");
    const previous = await ctx.db.query("supervisionAcknowledgements").withIndex("by_visit", q => q.eq("visitId", args.visitId)).collect();
    for (const r of previous) if (!r.revoked && !r.acknowledgedAt) await ctx.db.patch(r._id, { revoked: true });
    await ctx.db.insert("supervisionAcknowledgements", { schoolId: visit.schoolId, visitId: visit._id, tokenHash,
        visitUpdatedAt: visit.updatedAt ?? visit.createdAt, expiresAt: Date.now() + 7 * 86400000, createdBy: access.name, revoked: false });
} });
export const revoke = sessionMutation({ args: { id: v.id("supervisionAcknowledgements") }, handler: async (ctx, args) => {
    const row = await ctx.db.get(args.id);
    if (!row) throw new ConvexError("الرابط غير موجود");
    await requireVisit(ctx, (ctx as any).supervisionSession, row.visitId, true);
    await ctx.db.patch(row._id, { revoked: true });
} });

async function resolve(ctx: any, token: string) {
    if (!/^[a-f0-9]{64}$/.test(token)) return null;
    const hash = await digest(token);
    const row = await ctx.db.query("supervisionAcknowledgements").withIndex("by_token", (q: any) => q.eq("tokenHash", hash)).first();
    if (!row || row.revoked || row.expiresAt < Date.now()) return null;
    const visit = await ctx.db.get(row.visitId);
    if (!visit || visit.deletedAt || visit.status !== "submitted" || (visit.updatedAt ?? visit.createdAt) !== row.visitUpdatedAt) return null;
    return { row, visit };
}
export const read = query({ args: { token: v.string() }, handler: async (ctx, args) => {
    const data = await resolve(ctx, args.token); if (!data) return null;
    const { visit, row } = data;
    return { teacherName: visit.teacherName, visitDate: visit.visitDate, lessonTopic: visit.lessonTopic,
        recommendations: [visit.planningRec, visit.executionRec, visit.evalMgmtRec, visit.managementRec, visit.notes].filter(Boolean),
        acknowledgedAt: row.acknowledgedAt ?? null, comment: row.comment ?? "" };
} });
export const acknowledge = mutation({ args: { token: v.string(), comment: v.string() }, handler: async (ctx, args) => {
    const data = await resolve(ctx, args.token);
    if (!data) throw new ConvexError("الرابط منتهي أو أُلغي أو تم تحديث الزيارة؛ اطلب رابطاً جديداً");
    if (data.row.acknowledgedAt) throw new ConvexError("تم تسجيل الاطلاع بالفعل");
    if (args.comment.length > 5000) throw new ConvexError("التعليق أطول من المسموح");
    await ctx.db.patch(data.row._id, { acknowledgedAt: Date.now(), comment: args.comment.trim() });
    await ctx.db.insert("supervisionAuditLog", { schoolId: data.visit.schoolId, visitId: data.visit._id, action: "acknowledged_via_link",
        details: "تم تسجيل الاطلاع عبر رابط المعلم؛ لا يمثل توقيعاً أو موافقة على التقييم", timestamp: Date.now() });
} });
