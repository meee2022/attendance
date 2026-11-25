import { query, mutation } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import { digest } from "./supervisionAccess";
import { settingsOf } from "./visits";
import { requireSignatureImage } from "./visitWorkflow";
import { parseScores } from "./evaluationForm";
import { formOf } from "./teacherEvaluations";

// What a teacher's private appraisal link opens, without signing in: one
// approved form — their own — to read and to sign. The token is 256 random
// bits, kept only as a hash; a link dies when it expires, is replaced, or the
// form is reopened.

// A link opens one approved form, unchanged since the link was made
async function resolve(ctx: any, token: string) {
    if (!/^[a-f0-9]{64}$/.test(token)) return null;
    const tokenHash = await digest(token);
    const row = await ctx.db.query("evaluationLinks").withIndex("by_token", (q: any) => q.eq("tokenHash", tokenHash)).first();
    if (!row || row.revoked || row.expiresAt < Date.now()) return null;
    const e = await ctx.db.get(row.evaluationId);
    if (!e || e.status !== "approved" || e.updatedAt !== row.evaluationUpdatedAt) return null;
    return e;
}
export const readLink = query({ args: { token: v.string() }, handler: async (ctx, args) => {
    const e = await resolve(ctx, args.token);
    if (!e) return null;
    const school = await ctx.db.get(e.schoolId);
    return formOf(ctx, e, { scores: parseScores(e.scores), total: e.total, penalties: e.penalties, courses: e.courses }, await settingsOf(ctx, school));
} });
export const signUploadUrl = mutation({ args: { token: v.string() }, handler: async (ctx, args) => {
    const e = await resolve(ctx, args.token);
    if (!e || e.teacherSign) throw new ConvexError("الرابط منتهي أو أُلغي أو سبق التوقيع؛ اطلب رابطاً جديداً");
    return ctx.storage.generateUploadUrl();
} });
export const sign = mutation({ args: { token: v.string(), storageId: v.id("_storage"), comment: v.string() }, handler: async (ctx, args) => {
    const e = await resolve(ctx, args.token);
    if (!e) throw new ConvexError("الرابط منتهي أو أُلغي أو عُدّلت الاستمارة؛ اطلب رابطاً جديداً");
    if (e.teacherSign) throw new ConvexError("تم التوقيع على الاستمارة بالفعل");
    if (args.comment.length > 2000) throw new ConvexError("التعليق أطول من المسموح");
    await requireSignatureImage(ctx, args.storageId);
    const now = Date.now();
    await ctx.db.patch(e._id, { teacherSign: { at: now, signatureId: args.storageId, comment: args.comment.trim() || undefined } });
    await ctx.db.insert("supervisionAuditLog", { schoolId: e.schoolId, action: "evaluation_signed", details: `وقّع ${e.teacherName} على استمارة تقييم الأداء`, timestamp: now });
} });
