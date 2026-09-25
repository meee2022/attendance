import { deputyNameOf } from "./supervisionDefaults";
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { digest, requireSession, rolePin } from "./supervisionAccess";

export const directory = query({
    args: {}, handler: async ctx => {
        const school = await ctx.db.query("schools").first();
        if (!school) return { visitors: [], deputyName: "" };
        const people = await ctx.db.query("supervisors").withIndex("by_school", q => q.eq("schoolId", school._id)).collect();
        const settings = await ctx.db.query("supervisionSettings").withIndex("by_school", q => q.eq("schoolId", school._id)).first();
        return { visitors: people.filter(p => p.isActive && p.role === "coordinator").map(p => ({ _id: p._id, fullName: p.fullName, role: p.role })), deputyName: deputyNameOf(settings) };
    },
});

export const login = mutation({
    args: { role: v.union(v.literal("coordinator"), v.literal("supervisor"), v.literal("deputy")),
        visitorId: v.optional(v.id("supervisors")), name: v.string(), pin: v.string(), token: v.string() },
    handler: async (ctx, args) => {
        if (args.role === "supervisor") return { error: "يسجل المنسق زيارات الموجه من حسابه." };
        const school = await ctx.db.query("schools").first();
        if (!school || !/^[a-f0-9]{64}$/.test(args.token)) return { error: "تعذّر تسجيل الدخول" };
        const key = `${school._id}:${args.role}:${args.visitorId ?? "deputy"}`;
        const attempt = await ctx.db.query("supervisionLoginAttempts").withIndex("by_key", q => q.eq("key", key)).first();
        if (attempt && attempt.resetAt > Date.now() && attempt.failures >= 8) return { error: "محاولات كثيرة؛ أعد المحاولة بعد عشر دقائق" };
        const person = args.visitorId ? await ctx.db.get(args.visitorId) : null;
        const validPerson = person ? person.schoolId === school._id && person.role === args.role && person.isActive
            : args.role === "deputy" && !args.visitorId;
        if (!validPerson || args.pin !== rolePin(school, args.role, person)) {
            const fresh = !attempt || attempt.resetAt <= Date.now();
            const data = { key, failures: fresh ? 1 : attempt.failures + 1, resetAt: fresh ? Date.now() + 600000 : attempt.resetAt };
            if (attempt) await ctx.db.patch(attempt._id, data); else await ctx.db.insert("supervisionLoginAttempts", data);
            return { error: "الاسم أو رمز الدخول غير صحيح" };
        }
        if (args.role !== "deputy" && !person?.subjects.some(s => s.trim())) return { error: "لم تُحدد أقسامك بعد؛ راجع النائب الأكاديمي" };
        if (attempt) await ctx.db.delete(attempt._id);
        const tokenHash = await digest(args.token);
        const used = await ctx.db.query("supervisionSessions").withIndex("by_token", q => q.eq("tokenHash", tokenHash)).first();
        if (used) return { error: "أعد محاولة تسجيل الدخول" };
        const settings = await ctx.db.query("supervisionSettings").withIndex("by_school", q => q.eq("schoolId", school._id)).first();
        const name = person?.fullName ?? deputyNameOf(settings);
        if (!name) return { error: "لم يُضبط اسم النائب الأكاديمي في إعدادات الإشراف بعد." };
        const expiresAt = Date.now() + 8 * 3600000;
        await ctx.db.insert("supervisionSessions", { schoolId: school._id, tokenHash,
            credentialHash: await digest(rolePin(school, args.role, person)), role: args.role, visitorId: args.visitorId, name, expiresAt });
        return { session: { role: args.role, visitorId: args.visitorId, name, expiresAt, token: args.token } };
    },
});

export const current = query({ args: { token: v.string() }, handler: async (ctx, args) => {
    try { const s = await requireSession(ctx, args.token); return { role: s.role, name: s.name, visitorId: s.visitorId, expiresAt: s.expiresAt }; }
    catch { return null; }
} });
export const logout = mutation({ args: { token: v.string() }, handler: async (ctx, args) => {
    const hash = await digest(args.token);
    const s = await ctx.db.query("supervisionSessions").withIndex("by_token", q => q.eq("tokenHash", hash)).first();
    if (s) await ctx.db.delete(s._id);
} });
