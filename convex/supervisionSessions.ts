import { deputyNameOf } from "./supervisionDefaults";
import { query, mutation } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import { accountOf, credentialOf, digest, hashPassword, passwordProblem, requireSession, rolePin, setPassword } from "./supervisionAccess";

// Signing in. A coordinator, the deputy and the platform admin each have a
// password of their own, set through a one-time link (or, for the deputy and
// the admin, on first signing in with their old code). Until a person has
// one, the role's code still opens the door; after it, only their password does.

export const directory = query({
    args: {}, handler: async ctx => {
        const school = await ctx.db.query("schools").first();
        if (!school) return { visitors: [], deputyName: "", teacherSharedCode: false };
        const people = await ctx.db.query("supervisors").withIndex("by_school", q => q.eq("schoolId", school._id)).collect();
        const settings = await ctx.db.query("supervisionSettings").withIndex("by_school", q => q.eq("schoolId", school._id)).first();
        return { visitors: people.filter(p => p.isActive && p.role === "coordinator").map(p => ({ _id: p._id, fullName: p.fullName, role: p.role })), deputyName: deputyNameOf(settings),
            teacherSharedCode: !!school.teacherPin };
    },
});

export const login = mutation({
    args: { role: v.union(v.literal("coordinator"), v.literal("supervisor"), v.literal("deputy"), v.literal("admin"), v.literal("teacher")),
        visitorId: v.optional(v.id("supervisors")), name: v.string(), pin: v.string(), token: v.string(),
        // a teacher's own account: their official e-mail or their mobile number
        identifier: v.optional(v.string()) },
    handler: async (ctx, args) => {
        if (args.role === "supervisor") return { error: "يسجل المنسق زيارات الموجه من حسابه." };
        const school = await ctx.db.query("schools").first();
        if (!school || !/^[a-f0-9]{64}$/.test(args.token)) return { error: "تعذّر تسجيل الدخول" };
        const own = args.role === "teacher" && args.identifier !== undefined;
        const identifier = (args.identifier ?? "").trim().toLowerCase().slice(0, 120), digits = identifier.replace(/\D/g, "");
        if (args.role === "teacher" && !own && !school.teacherPin) return { error: "رمز المعلمين المشترك غير مفعّل؛ ادخل ببريدك الرسمي أو رقم جوالك وكلمة سرك" };
        const key = `${school._id}:${args.role}:${own ? await digest(identifier) : args.visitorId ?? args.role}`;
        const attempt = await ctx.db.query("supervisionLoginAttempts").withIndex("by_key", q => q.eq("key", key)).first();
        if (attempt && attempt.resetAt > Date.now() && attempt.failures >= 8) return { error: "محاولات كثيرة؛ أعد المحاولة بعد عشر دقائق" };
        const teacher = !own || !identifier ? null : (await ctx.db.query("schoolTeachers").withIndex("by_school", q => q.eq("schoolId", school._id)).collect())
            .find(t => t.isActive !== false && (identifier.includes("@") ? (t.email ?? "").trim().toLowerCase() === identifier
                : digits.length >= 8 && (t.phone ?? "").replace(/\D/g, "").slice(-8) === digits.slice(-8))) ?? null;
        const person = args.visitorId ? await ctx.db.get(args.visitorId) : null;
        const validPerson = own ? !!teacher && !args.visitorId : person ? person.schoolId === school._id && person.role === args.role && person.isActive
            : (args.role === "deputy" || args.role === "admin" || args.role === "teacher") && !args.visitorId;
        const { account, credential } = await credentialOf(ctx, school, args.role, own ? teacher : person);
        const matches = account ? await hashPassword(args.pin, account.salt) === account.passwordHash
            : !own && !!rolePin(school, args.role, person) && args.pin === rolePin(school, args.role, person);
        if (!validPerson || !matches) {
            const fresh = !attempt || attempt.resetAt <= Date.now();
            const data = { key, failures: fresh ? 1 : attempt.failures + 1, resetAt: fresh ? Date.now() + 600000 : attempt.resetAt };
            if (attempt) await ctx.db.patch(attempt._id, data); else await ctx.db.insert("supervisionLoginAttempts", data);
            return { error: own ? "البريد أو رقم الجوال أو كلمة السر غير صحيحة؛ إن لم تفعّل حسابك بعد فافتح رابط التفعيل" : "الاسم أو كلمة السر غير صحيحة" };
        }
        if (args.role !== "deputy" && args.role !== "admin" && args.role !== "teacher" && !person?.subjects.some(s => s.trim())) return { error: "لم تُحدد أقسامك بعد؛ راجع النائب الأكاديمي" };
        if (attempt) await ctx.db.delete(attempt._id);
        const tokenHash = await digest(args.token);
        const used = await ctx.db.query("supervisionSessions").withIndex("by_token", q => q.eq("tokenHash", tokenHash)).first();
        if (used) return { error: "أعد محاولة تسجيل الدخول" };
        const settings = await ctx.db.query("supervisionSettings").withIndex("by_school", q => q.eq("schoolId", school._id)).first();
        const name = teacher ? teacher.fullName.replace(/\s+/g, " ").trim() : args.role === "teacher" ? "المعلمون (رمز مشترك)" : args.role === "admin" ? "مسؤول المنصة" : person?.fullName ?? deputyNameOf(settings);
        if (!name) return { error: "لم يُضبط اسم النائب الأكاديمي في إعدادات الإشراف بعد." };
        const expiresAt = Date.now() + 8 * 3600000;
        await ctx.db.insert("supervisionSessions", { schoolId: school._id, tokenHash,
            credentialHash: credential, role: args.role, visitorId: args.visitorId, teacherId: teacher?._id, name, expiresAt });
        return { session: { role: args.role, visitorId: args.visitorId, name, expiresAt, token: args.token } };
    },
});

export const current = query({ args: { token: v.string() }, handler: async (ctx, args) => {
    try { const s = await requireSession(ctx, args.token); return { role: s.role, name: s.name, visitorId: s.visitorId, expiresAt: s.expiresAt, needsPassword: s.needsPassword,
        // signed in as themselves, with a password they can change
        personal: s.role !== "teacher" || !!s.teacherId }; }
    catch { return null; }
} });
export const logout = mutation({ args: { token: v.string() }, handler: async (ctx, args) => {
    const hash = await digest(args.token);
    const s = await ctx.db.query("supervisionSessions").withIndex("by_token", q => q.eq("tokenHash", hash)).first();
    if (s) await ctx.db.delete(s._id);
} });

// ── A person's own password ──────────────────────────────────────────────

// Changing it takes the current one. The deputy and the admin without a
// password yet confirm with the code they signed in with.
export const changePassword = mutation({ args: { token: v.string(), current: v.string(), next: v.string() }, handler: async (ctx, args) => {
    const session = await requireSession(ctx, args.token);
    const ownerId = session.visitorId ?? session.teacherId;
    if (session.role === "teacher" && !ownerId) throw new ConvexError("لا يوجد حساب شخصي للدخول بالرمز المشترك");
    const school: any = await ctx.db.get(session.schoolId);
    const visitor: any = session.visitorId ? await ctx.db.get(session.visitorId) : null;
    const account = await accountOf(ctx, school._id, session.role, ownerId);
    if (!account && session.role === "coordinator") throw new ConvexError("يُفعَّل حسابك برابط من النائب الأكاديمي");
    const key = `${school._id}:password:${session.role}:${ownerId ?? ""}`;
    const attempt = await ctx.db.query("supervisionLoginAttempts").withIndex("by_key", q => q.eq("key", key)).first();
    if (attempt && attempt.resetAt > Date.now() && attempt.failures >= 8) return { error: "محاولات كثيرة؛ أعد المحاولة بعد عشر دقائق" };
    const known = account ? await hashPassword(args.current, account.salt) === account.passwordHash : args.current === rolePin(school, session.role, visitor);
    if (!known) {
        const fresh = !attempt || attempt.resetAt <= Date.now();
        const data = { key, failures: fresh ? 1 : attempt.failures + 1, resetAt: fresh ? Date.now() + 600000 : attempt.resetAt };
        if (attempt) await ctx.db.patch(attempt._id, data); else await ctx.db.insert("supervisionLoginAttempts", data);
        return { error: "كلمة السر الحالية غير صحيحة" };
    }
    const problem = passwordProblem(args.next) || (args.next === args.current ? "اختر كلمة سر مختلفة عن الحالية" : "");
    if (problem) return { error: problem };
    if (attempt) await ctx.db.delete(attempt._id);
    // this session carries on; any other one opened with the old password ends
    await ctx.db.patch(session._id, { credentialHash: await setPassword(ctx, school._id, session.role, ownerId, args.next) });
    await ctx.db.insert("supervisionAuditLog", { schoolId: school._id, action: "password_changed", actorName: session.name, details: "غيّر كلمة سره", timestamp: Date.now() });
    return { ok: true };
} });

// The one-time link: whose account it is, and setting its password
async function activation(ctx: any, token: string) {
    if (!/^[a-f0-9]{64}$/.test(token)) return null;
    const tokenHash = await digest(token);
    const row = await ctx.db.query("accountActivations").withIndex("by_token", (q: any) => q.eq("tokenHash", tokenHash)).first();
    if (!row || row.expiresAt < Date.now()) return null;
    const person = row.visitorId ? await ctx.db.get(row.visitorId) : row.teacherId ? await ctx.db.get(row.teacherId) : null;
    if (row.role === "coordinator" && (!person || person.isActive === false || person.role !== "coordinator")) return null;
    if (row.role === "teacher" && (!person || person.isActive === false)) return null;
    const settings = await ctx.db.query("supervisionSettings").withIndex("by_school", (q: any) => q.eq("schoolId", row.schoolId)).first();
    return { row, person, name: person ? person.fullName.replace(/\s+/g, " ").trim() as string : row.role === "deputy" ? deputyNameOf(settings) : "مسؤول المنصة" };
}
export const activationInfo = query({ args: { token: v.string() }, handler: async (ctx, args) => {
    const found = await activation(ctx, args.token);
    if (!found) return null;
    // a teacher signs in with these afterwards: shown to the one holding their link
    const teacher = found.row.role === "teacher" ? found.person : null;
    return { name: found.name, role: found.row.role, ...(teacher ? { email: teacher.email ?? "", phone: teacher.phone ?? "" } : {}) };
} });
export const activate = mutation({ args: { token: v.string(), password: v.string() }, handler: async (ctx, args) => {
    const found = await activation(ctx, args.token);
    if (!found) return { error: "الرابط منتهي أو استُخدم من قبل؛ اطلب رابطًا جديدًا" };
    const problem = passwordProblem(args.password);
    if (problem) return { error: problem };
    const { row, name } = found;
    await setPassword(ctx, row.schoolId, row.role, row.visitorId ?? row.teacherId, args.password);
    await ctx.db.delete(row._id);                                               // one use
    if (row.visitorId) await ctx.db.patch(row.visitorId, { pin: undefined });   // the old private code retires
    await ctx.db.insert("supervisionAuditLog", { schoolId: row.schoolId, action: "account_activated", actorName: name, details: `فعّل حسابه برابط أنشأه ${row.createdBy}`, timestamp: Date.now() });
    return { ok: true };
} });
