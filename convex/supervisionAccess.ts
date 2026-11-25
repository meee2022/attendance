import { deputyNameOf } from "./supervisionDefaults";
import { ConvexError, v } from "convex/values";
import { query, mutation } from "./_generated/server";

export async function digest(value: string) {
    const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
    return Array.from(new Uint8Array(bytes), x => x.toString(16).padStart(2, "0")).join("");
}

export function rolePin(school: any, role: string, visitor?: any) {
    if (role === "teacher") return school.teacherPin || "";
    if (role === "admin") return school.adminPin || "";
    return visitor?.pin || (role === "deputy" ? school.deputyPin || ""
        : role === "supervisor" ? school.supervisorPin || "" : school.coordinatorPin || "");
}

// PBKDF2-SHA256, 100,000 rounds: a stolen table gives no passwords back
export async function hashPassword(password: string, salt: string) {
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
    const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: new TextEncoder().encode(salt), iterations: 100_000 }, key, 256);
    return Array.from(new Uint8Array(bits), x => x.toString(16).padStart(2, "0")).join("");
}
export const passwordProblem = (password: string) =>
    password.length < 8 || password.length > 72 ? "اختر كلمة سر من 8 أحرف على الأقل"
    : !/\p{L}/u.test(password) || !/\d/.test(password) ? "اجعل كلمة السر تجمع حروفًا وأرقامًا" : "";

// `ownerId`: the coordinator's row in «supervisors», or the teacher's in «schoolTeachers»
export const accountOf = (ctx: any, schoolId: any, role: string, ownerId?: any) =>
    role === "supervisor" || (role === "teacher" && !ownerId) ? null
    : role === "teacher" ? ctx.db.query("supervisionAccounts").withIndex("by_teacher", (q: any) => q.eq("teacherId", ownerId)).first()
    : ctx.db.query("supervisionAccounts")
        .withIndex("by_owner", (q: any) => q.eq("schoolId", schoolId).eq("role", role).eq("visitorId", role === "coordinator" ? ownerId : undefined)).first();

// A fresh salt and hash for this owner, replacing any earlier password
export async function setPassword(ctx: any, schoolId: any, role: string, ownerId: any, password: string) {
    const salt = Array.from(crypto.getRandomValues(new Uint8Array(16)), x => x.toString(16).padStart(2, "0")).join("");
    const value = { salt, passwordHash: await hashPassword(password, salt), updatedAt: Date.now() };
    const account = await accountOf(ctx, schoolId, role, ownerId);
    if (account) await ctx.db.patch(account._id, value);
    else await ctx.db.insert("supervisionAccounts", { schoolId, role, ...value,
        ...(role === "coordinator" ? { visitorId: ownerId } : role === "teacher" ? { teacherId: ownerId } : {}) });
    return value.passwordHash;
}

// What a session was opened with: the person's own password once they have
// one, otherwise the role's code. A session dies when that changes. `person`
// is the coordinator or the teacher signed in as themselves; a teacher's own
// session never falls back to the shared teacher code.
export async function credentialOf(ctx: any, school: any, role: string, person: any) {
    const account = await accountOf(ctx, school._id, role, person?._id);
    const pin = role === "teacher" ? (person ? "" : rolePin(school, role)) : rolePin(school, role, person);
    return { account, credential: account ? account.passwordHash as string : pin ? await digest(pin) : "" };
}

export async function requireSession(ctx: any, token?: string, deputy = false) {
    if (!token) throw new ConvexError("سجّل الدخول للمنصة أولاً");
    const hash = await digest(token);
    const session = await ctx.db.query("supervisionSessions")
        .withIndex("by_token", (q: any) => q.eq("tokenHash", hash)).first();
    if (!session || session.expiresAt <= Date.now()) throw new ConvexError("انتهت الجلسة؛ سجّل الدخول مرة أخرى");
    const school = await ctx.db.get(session.schoolId);
    const visitor = session.visitorId ? await ctx.db.get(session.visitorId) : null;
    const teacher = session.teacherId ? await ctx.db.get(session.teacherId) : null;
    const { account, credential } = school ? await credentialOf(ctx, school, session.role, visitor ?? teacher) : { account: null, credential: "" };
    if (session.role === "supervisor" || !school || (session.visitorId && (!visitor || visitor.isActive === false || visitor.role !== session.role))
        || (session.teacherId && (!teacher || teacher.isActive === false || teacher.schoolId !== school._id))
        || !credential || session.credentialHash !== credential) {
        throw new ConvexError("تغيّرت صلاحيات الدخول؛ سجّل الدخول مرة أخرى");
    }
    if (deputy && session.role !== "deputy" && session.role !== "admin") throw new ConvexError("هذه العملية متاحة للنائب الأكاديمي أو مسؤول المنصة");
    const settings = session.role === "deputy" ? await ctx.db.query("supervisionSettings").withIndex("by_school", (q: any) => q.eq("schoolId", school._id)).first() : null;
    // the deputy and the admin still on their old code are asked for a password of their own
    return { ...session, needsPassword: !account && (session.role === "deputy" || session.role === "admin"),
        name: session.role === "deputy" ? deputyNameOf(settings) : session.name, departments: (session.role === "deputy" || session.role === "admin") ? null : (visitor?.subjects ?? []).map((s: string) => s.trim()) };
}

export function canAccess(session: any, schoolId: any, department: string) {
    return session.schoolId === schoolId && (session.departments === null || session.departments.includes(department.trim()));
}

export async function requireVisit(ctx: any, session: any, id: any, write = false) {
    const visit = await ctx.db.get(id);
    if (!visit || !canAccess(session, visit.schoolId, visit.teacherDepartment ?? "")) throw new ConvexError("الزيارة غير متاحة ضمن صلاحياتك");
    // A colleague the visit was sent to for review may edit it until it is submitted or returned
    const reviewer = visit.status === "draft" && visit.reviewRequest?.toVisitorId && visit.reviewRequest.toVisitorId === session.visitorId;
    if (write && session.role !== "deputy" && session.role !== "admin" && !reviewer && visit.visitorId !== session.visitorId && visit.recordedByVisitorId !== session.visitorId) throw new ConvexError("يمكنك تعديل زياراتك فقط");
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
            if (session.role === "teacher") throw new ConvexError("الإشراف متاح للمنسق والنائب ومسؤول المنصة");
            return config.handler({ ...ctx, supervisionSession: session }, args);
        },
    });
}
export const sessionQuery: typeof query = secured(query, false);
export const sessionMutation: typeof mutation = secured(mutation, false);
export const deputyQuery: typeof query = secured(query, true);
export const deputyMutation: typeof mutation = secured(mutation, true);

export function publicSchool(school: any) {
    const { teacherPin, adminPin, coordinatorPin, supervisorPin, deputyPin, ...safe } = school;
    return safe;
}
