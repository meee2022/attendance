import { ConvexError, v } from "convex/values";
import { deputyMutation, deputyQuery, accountOf, digest, passwordProblem, setPassword } from "./supervisionAccess";
import { deputyNameOf } from "./supervisionDefaults";
import { nameKey } from "./visitMath";

// The deputy's side of personal accounts: who has one, a one-time link for
// each person to set their own password, and retiring the shared coordinator
// code. Nobody registers themselves: an account exists only for a person the
// deputy has listed, in the role and departments the deputy gave them.

const roleV = v.union(v.literal("coordinator"), v.literal("deputy"), v.literal("admin"));

// May this manager act on that account? The admin's is the admin's own.
async function owner(ctx: any, role: string, visitorId: any) {
    const session = ctx.supervisionSession;
    if (role === "admin" && session.role !== "admin") throw new ConvexError("حساب مسؤول المنصة يديره مسؤول المنصة");
    const person = visitorId ? await ctx.db.get(visitorId) : null;
    if (role === "coordinator" ? !person || person.schoolId !== session.schoolId || person.role !== "coordinator" || !person.isActive : !!visitorId) throw new ConvexError("الحساب غير موجود");
    return { session, person };
}

export const status = deputyQuery({ args: {}, handler: async (ctx) => {
    const session = (ctx as any).supervisionSession;
    const school: any = await ctx.db.get(session.schoolId);
    const settings = await ctx.db.query("supervisionSettings").withIndex("by_school", q => q.eq("schoolId", school._id)).first();
    const coordinators = (await ctx.db.query("supervisors").withIndex("by_role", q => q.eq("schoolId", school._id).eq("role", "coordinator")).collect()).filter(p => p.isActive);
    // a coordinator is on the staff list too: that is where their phone is
    const staff = await ctx.db.query("schoolTeachers").withIndex("by_school", q => q.eq("schoolId", school._id)).collect();
    const row = async (role: string, visitorId: any, name: string, detail: string) => {
        const account = await accountOf(ctx, school._id, role, visitorId);
        const contact = role === "coordinator" ? staff.find(t => nameKey(t.fullName) === nameKey(name)) : null;
        const link = (await ctx.db.query("accountActivations").withIndex("by_owner", q => q.eq("schoolId", school._id).eq("role", role as any).eq("visitorId", visitorId)).collect()).find(l => l.expiresAt > Date.now());
        return { role, visitorId: visitorId ?? null, name, detail, activatedAt: account?.updatedAt ?? null, linkExpiresAt: link?.expiresAt ?? null,
            phone: contact?.phone ?? "", email: contact?.email ?? "" };
    };
    const rows = [await row("deputy", undefined, deputyNameOf(settings), "النائب الأكاديمي"), await row("admin", undefined, "مسؤول المنصة", "مسؤول المنصة"),
        ...await Promise.all(coordinators.map(p => row("coordinator", p._id, p.fullName, `منسق ${p.subjects.join("، ")}`)))];
    // the shared coordinator code still opens the accounts not yet activated
    return { rows, sharedCode: !!school.coordinatorPin, isAdmin: session.role === "admin" };
} });

export const createActivation = deputyMutation({ args: { role: roleV, visitorId: v.optional(v.id("supervisors")), token: v.string() }, handler: async (ctx, args) => {
    const { session } = await owner(ctx, args.role, args.visitorId);
    if (!/^[a-f0-9]{64}$/.test(args.token)) throw new ConvexError("أعد إنشاء الرابط");
    for (const old of await ctx.db.query("accountActivations").withIndex("by_owner", q => q.eq("schoolId", session.schoolId).eq("role", args.role).eq("visitorId", args.visitorId)).collect()) await ctx.db.delete(old._id);
    await ctx.db.insert("accountActivations", { schoolId: session.schoolId, role: args.role, visitorId: args.visitorId, tokenHash: await digest(args.token),
        expiresAt: Date.now() + 48 * 3600000, createdBy: session.name });
} });

// Setting someone's password for them: they can sign in at once and change
// it afterwards. Recorded, because the manager then knows it too.
export const setFor = deputyMutation({ args: { role: roleV, visitorId: v.optional(v.id("supervisors")), password: v.string() }, handler: async (ctx, args) => {
    const { session, person } = await owner(ctx, args.role, args.visitorId);
    const problem = passwordProblem(args.password);
    if (problem) throw new ConvexError(problem);
    await setPassword(ctx, session.schoolId, args.role, args.visitorId, args.password);
    if (person) await ctx.db.patch(person._id, { pin: undefined });
    await ctx.db.insert("supervisionAuditLog", { schoolId: session.schoolId, action: "password_set_by_manager", actorName: session.name,
        details: `عيّن كلمة سر لحساب ${person?.fullName ?? (args.role === "deputy" ? "النائب الأكاديمي" : "مسؤول المنصة")}`, timestamp: Date.now() });
} });

// After this, a coordinator signs in only with a password of their own
export const retireSharedCode = deputyMutation({ args: {}, handler: async (ctx) => {
    const session = (ctx as any).supervisionSession;
    await ctx.db.patch(session.schoolId, { coordinatorPin: undefined });
    await ctx.db.insert("supervisionAuditLog", { schoolId: session.schoolId, action: "shared_code_retired", actorName: session.name, details: "أُلغي رمز المنسقين المشترك", timestamp: Date.now() });
} });
