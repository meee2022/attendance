import { deputyNameOf } from "./supervisionDefaults";
import { ConvexError, v } from "convex/values";
import { query, mutation } from "./_generated/server";

export async function digest(value: string) {
    const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
    return Array.from(new Uint8Array(bytes), x => x.toString(16).padStart(2, "0")).join("");
}

export function rolePin(school: any, role: string, visitor?: any) {
    return visitor?.pin || (role === "deputy" ? school.deputyPin ?? "3333"
        : role === "supervisor" ? school.supervisorPin ?? "2222" : school.coordinatorPin ?? "1111");
}

export async function requireSession(ctx: any, token?: string, deputy = false) {
    if (!token) throw new ConvexError("سجّل الدخول للإشراف أولاً");
    const hash = await digest(token);
    const session = await ctx.db.query("supervisionSessions")
        .withIndex("by_token", (q: any) => q.eq("tokenHash", hash)).first();
    if (!session || session.expiresAt <= Date.now()) throw new ConvexError("انتهت الجلسة؛ سجّل الدخول مرة أخرى");
    const school = await ctx.db.get(session.schoolId);
    const visitor = session.visitorId ? await ctx.db.get(session.visitorId) : null;
    if (session.role === "supervisor" || !school || (session.visitorId && (!visitor || visitor.isActive === false || visitor.role !== session.role))
        || session.credentialHash !== await digest(rolePin(school, session.role, visitor))) {
        throw new ConvexError("تغيّرت صلاحيات الدخول؛ سجّل الدخول مرة أخرى");
    }
    if (deputy && session.role !== "deputy") throw new ConvexError("هذه العملية متاحة للنائب الأكاديمي فقط");
    const settings = session.role === "deputy" ? await ctx.db.query("supervisionSettings").withIndex("by_school", (q: any) => q.eq("schoolId", school._id)).first() : null;
    return { ...session, name: session.role === "deputy" ? deputyNameOf(settings) : session.name, departments: session.role === "deputy" ? null : (visitor?.subjects ?? []).map((s: string) => s.trim()) };
}

export function canAccess(session: any, schoolId: any, department: string) {
    return session.schoolId === schoolId && (session.departments === null || session.departments.includes(department.trim()));
}

export async function requireVisit(ctx: any, session: any, id: any, write = false) {
    const visit = await ctx.db.get(id);
    if (!visit || !canAccess(session, visit.schoolId, visit.teacherDepartment ?? "")) throw new ConvexError("الزيارة غير متاحة ضمن صلاحياتك");
    if (write && session.role !== "deputy" && visit.visitorId !== session.visitorId && visit.recordedByVisitorId !== session.visitorId) throw new ConvexError("يمكنك تعديل زياراتك فقط");
    return visit;
}

// Keep the original typed handler arguments. Tokens are consumed here, never
// forwarded to a database patch or trusted as an actor name supplied by the UI.
function secured(builder: any, deputy: boolean) {
    return (config: any) => builder({
        ...config, args: { ...config.args, sessionToken: v.string() },
        handler: async (ctx: any, raw: any) => {
            const { sessionToken, ...args } = raw;
            const session = await requireSession(ctx, sessionToken, deputy);
            return config.handler({ ...ctx, supervisionSession: session }, args);
        },
    });
}
export const sessionQuery: typeof query = secured(query, false);
export const sessionMutation: typeof mutation = secured(mutation, false);
export const deputyQuery: typeof query = secured(query, true);
export const deputyMutation: typeof mutation = secured(mutation, true);

export function publicSchool(school: any) {
    const { adminPin, coordinatorPin, supervisorPin, deputyPin, ...safe } = school;
    return safe;
}
