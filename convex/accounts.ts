import { ConvexError, v } from "convex/values";
import { deputyMutation, deputyQuery, accountOf, digest, passwordProblem, setPassword } from "./supervisionAccess";
import { deputyNameOf } from "./supervisionDefaults";
import { nameKey } from "./visitMath";

// The deputy's side of personal accounts: who has one, one-time links for
// people to set their own passwords — one person or everyone at once — and
// retiring the shared coordinator code. Nobody registers themselves: an
// account exists only for a person already on the school's lists, in the role
// and departments those lists give them.

const roleV = v.union(v.literal("coordinator"), v.literal("deputy"), v.literal("admin"), v.literal("teacher"));
const DAY = 86400000;

// The person behind an account, checked against this manager's rights.
// `ownerId`: the coordinator's row in «supervisors» or the teacher's in
// «schoolTeachers»; the deputy and the admin have none.
async function owner(ctx: any, role: string, ownerId?: string) {
    const session = ctx.supervisionSession;
    if (role === "admin" && session.role !== "admin") throw new ConvexError("حساب مسؤول المنصة يديره مسؤول المنصة");
    const table = role === "coordinator" ? "supervisors" : role === "teacher" ? "schoolTeachers" : null;
    const id = table && ownerId ? ctx.db.normalizeId(table, ownerId) : null;
    const person = id ? await ctx.db.get(id) : null;
    const valid = !table ? !ownerId : !!person && person.schoolId === session.schoolId && person.isActive !== false && (role !== "coordinator" || person.role === "coordinator");
    if (!valid) throw new ConvexError("الحساب غير موجود");
    return { session, person, id };
}
const linksOf = (ctx: any, schoolId: any, role: string, id: any) => role === "teacher"
    ? ctx.db.query("accountActivations").withIndex("by_teacher", (q: any) => q.eq("teacherId", id)).collect()
    : ctx.db.query("accountActivations").withIndex("by_owner", (q: any) => q.eq("schoolId", schoolId).eq("role", role).eq("visitorId", id ?? undefined)).collect();

export const status = deputyQuery({ args: {}, handler: async (ctx) => {
    const session = (ctx as any).supervisionSession;
    const school: any = await ctx.db.get(session.schoolId);
    const settings = await ctx.db.query("supervisionSettings").withIndex("by_school", q => q.eq("schoolId", school._id)).first();
    const coordinators = (await ctx.db.query("supervisors").withIndex("by_role", q => q.eq("schoolId", school._id).eq("role", "coordinator")).collect()).filter(p => p.isActive);
    const staff = (await ctx.db.query("schoolTeachers").withIndex("by_school", q => q.eq("schoolId", school._id)).collect()).filter(t => t.isActive !== false);
    const accounts = await ctx.db.query("supervisionAccounts").collect(), links = (await ctx.db.query("accountActivations").collect()).filter(l => l.expiresAt > Date.now());
    const row = (role: string, id: any, name: string, group: string, detail: string, contact?: any) => {
        const mine = (x: any) => x.role === role && (role === "teacher" ? x.teacherId === id : (x.visitorId ?? null) === (id ?? null));
        return { role, ownerId: id ?? null, name: name.replace(/\s+/g, " ").trim(), group, detail, activatedAt: accounts.find(mine)?.updatedAt ?? null,
            linkExpiresAt: links.find(mine)?.expiresAt ?? null, phone: contact?.phone ?? "", email: contact?.email ?? "" };
    };
    const rows = [row("deputy", null, deputyNameOf(settings), "الإدارة والمنسقون", "النائب الأكاديمي"), row("admin", null, "مسؤول المنصة", "الإدارة والمنسقون", "مسؤول المنصة"),
        // a coordinator is on the staff list too: that is where their phone is
        ...coordinators.map(p => row("coordinator", p._id, p.fullName, "الإدارة والمنسقون", `منسق ${p.subjects.join("، ")}`, staff.find(t => nameKey(t.fullName) === nameKey(p.fullName)))),
        ...staff.sort((a, b) => (a.department ?? "").localeCompare(b.department ?? "", "ar") || a.fullName.localeCompare(b.fullName, "ar"))
            .map(t => row("teacher", t._id, t.fullName, (t.department ?? "").trim(), `معلم ${(t.department ?? "").trim()}`, t))];
    // the shared codes still open the door for those not yet activated
    return { rows, sharedCode: !!school.coordinatorPin, teacherSharedCode: !!school.teacherPin, isAdmin: session.role === "admin" };
} });

// One-time links, for one person or for a whole list at once. A new link
// replaces the person's earlier one. A teacher has a week, the others two days.
export const createActivations = deputyMutation({
    args: { items: v.array(v.object({ role: roleV, ownerId: v.optional(v.string()), token: v.string() })) },
    handler: async (ctx, args) => {
        if (args.items.length > 200) throw new ConvexError("عدد الروابط أكبر من المسموح في مرة واحدة");
        for (const item of args.items) {
            const { session, id } = await owner(ctx, item.role, item.ownerId);
            if (!/^[a-f0-9]{64}$/.test(item.token)) throw new ConvexError("أعد إنشاء الرابط");
            for (const old of await linksOf(ctx, session.schoolId, item.role, id)) await ctx.db.delete(old._id);
            await ctx.db.insert("accountActivations", { schoolId: session.schoolId, role: item.role, tokenHash: await digest(item.token), createdBy: session.name,
                expiresAt: Date.now() + (item.role === "teacher" ? 7 : 2) * DAY,
                ...(item.role === "coordinator" ? { visitorId: id } : item.role === "teacher" ? { teacherId: id } : {}) });
        }
    },
});

// Setting someone's password for them: they can sign in at once and change
// it afterwards. Recorded, because the manager then knows it too.
export const setFor = deputyMutation({ args: { role: roleV, ownerId: v.optional(v.string()), password: v.string() }, handler: async (ctx, args) => {
    const { session, person, id } = await owner(ctx, args.role, args.ownerId);
    const problem = passwordProblem(args.password);
    if (problem) throw new ConvexError(problem);
    await setPassword(ctx, session.schoolId, args.role, id, args.password);
    if (args.role === "coordinator") await ctx.db.patch(id, { pin: undefined });
    await ctx.db.insert("supervisionAuditLog", { schoolId: session.schoolId, action: "password_set_by_manager", actorName: session.name,
        details: `عيّن كلمة سر لحساب ${person?.fullName ?? (args.role === "deputy" ? "النائب الأكاديمي" : "مسؤول المنصة")}`, timestamp: Date.now() });
} });

// After this, a coordinator signs in only with a password of their own
export const retireSharedCode = deputyMutation({ args: {}, handler: async (ctx) => {
    const session = (ctx as any).supervisionSession;
    await ctx.db.patch(session.schoolId, { coordinatorPin: undefined });
    await ctx.db.insert("supervisionAuditLog", { schoolId: session.schoolId, action: "shared_code_retired", actorName: session.name, details: "أُلغي رمز المنسقين المشترك", timestamp: Date.now() });
} });
