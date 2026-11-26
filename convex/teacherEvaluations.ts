import { ConvexError, v } from "convex/values";
import { sessionQuery, sessionMutation, deputyMutation, canAccess, digest } from "./supervisionAccess";
import { settingsOf } from "./visits";
import { nameKey } from "./visitMath";
import { INDICATORS, levelOf, parseScores, scoredCount, totalOf } from "./evaluationForm";

// «استمارة تقييم أداء المعلم», once a year for every teacher.
//
// Who sees what is decided here, never in the page:
//   - a coordinator evaluates the teachers of their own department(s) and sees
//     nobody else's form — not another department's, and not their own;
//   - the academic deputy evaluates the coordinators, reviews and edits every
//     form a coordinator sends, and approves it;
//   - what the coordinator sent is kept beside the form the deputy edits, so
//     the coordinator can always open their own version;
//   - the teacher sees one form, their own, through a private link, once it
//     is approved, and signs it there.

const penaltiesV = v.array(v.object({ type: v.string(), reason: v.string(), date: v.string() }));
const coursesV = v.array(v.object({ name: v.string(), place: v.string(), duration: v.string(), date: v.string() }));
const EMPTY_PROFILE = { employeeNo: "", personalNo: "", hireDate: "", jobTitle: "", nationality: "" };
const manager = (s: any) => s.role === "deputy" || s.role === "admin";

// "2026 - 2027" → "2025 - 2026"
export const yearBefore = (year: string) => year.replace(/\d{4}/g, y => String(+y - 1));

async function context(ctx: any) {
    const session = ctx.supervisionSession;
    const school = await ctx.db.get(session.schoolId);
    const settings = await settingsOf(ctx, school);
    // the coordinators are teachers too: the deputy evaluates them
    const coordinators = new Set((await ctx.db.query("supervisors").withIndex("by_role", (q: any) => q.eq("schoolId", school._id).eq("role", "coordinator")).collect())
        .filter((p: any) => p.isActive !== false).map((p: any) => nameKey(p.fullName)));
    const allowed = (teacher: any) => !!teacher && teacher.schoolId === school._id
        && (manager(session) || (canAccess(session, teacher.schoolId, teacher.department ?? "", teacher._id) && !coordinators.has(nameKey(teacher.fullName))));
    return { session, school, settings, year: settings.academicYear as string, allowed, coordinators };
}

const evaluationOf = async (ctx: any, teacherId: any, year: string) =>
    (await ctx.db.query("teacherEvaluations").withIndex("by_teacher", (q: any) => q.eq("teacherId", teacherId)).collect())
        .find((e: any) => e.academicYear === year) ?? null;

async function profileOf(ctx: any, teacherId: any) {
    const p = await ctx.db.query("teacherProfiles").withIndex("by_teacher", (q: any) => q.eq("teacherId", teacherId)).first();
    return { ...EMPTY_PROFILE, ...(p ? { employeeNo: p.employeeNo ?? "", personalNo: p.personalNo ?? "", hireDate: p.hireDate ?? "", jobTitle: p.jobTitle ?? "", nationality: p.nationality ?? "" } : {}) };
}

// Until the deputy approves, a coordinator sees the form as they wrote it —
// never the deputy's work in progress
function contentFor(session: any, e: any) {
    const src = manager(session) || e.status === "approved" || (e.status === "draft" && e.evaluatorRole === "coordinator") ? e : e.coordinatorVersion;
    return src ? { scores: parseScores(src.scores), total: src.total as number, penalties: src.penalties, courses: src.courses }
        : { scores: {}, total: 0, penalties: [], courses: [] };
}

// Everything the printed form shows
export async function formOf(ctx: any, e: any, content: ReturnType<typeof contentFor>, settings: any) {
    return {
        _id: e._id, teacherName: e.teacherName, department: e.department, academicYear: e.academicYear,
        profile: e.profile, ...content, level: scoredCount(content.scores) === INDICATORS.length ? levelOf(content.total) : "",
        status: e.status, schoolName: settings.schoolNameOnForm, principalName: settings.principalName,
        signedAt: e.teacherSign?.at ?? null, signatureUrl: e.teacherSign ? await ctx.storage.getUrl(e.teacherSign.signatureId) : null,
    };
}

// One row per teacher the visitor may evaluate — the list, and the deputy's summary
export const list = sessionQuery({ args: {}, handler: async (ctx) => {
    const { session, school, year, allowed, coordinators } = await context(ctx);
    const teachers = (await ctx.db.query("schoolTeachers").withIndex("by_school", (q: any) => q.eq("schoolId", school._id)).collect())
        .filter((t: any) => t.isActive !== false && allowed(t));
    const byYear = async (y: string) => new Map((await ctx.db.query("teacherEvaluations").withIndex("by_school_year", (q: any) => q.eq("schoolId", school._id).eq("academicYear", y)).collect())
        .filter((e: any) => e.teacherId).map((e: any) => [e.teacherId, e]));
    const current = await byYear(year), previous = await byYear(yearBefore(year));
    return { academicYear: year, manager: manager(session), rows: teachers.map((t: any) => {
        const e: any = current.get(t._id), c = e ? contentFor(session, e) : null;
        return {
            teacherId: t._id, teacherName: t.fullName.replace(/\s+/g, " ").trim(), department: (t.department ?? "").trim(),
            isCoordinator: coordinators.has(nameKey(t.fullName)),
            evaluationId: e?._id ?? null, status: e?.status ?? "none", scored: c ? scoredCount(c.scores) : 0,
            total: c ? c.total : null, level: c && scoredCount(c.scores) === INDICATORS.length ? levelOf(c.total) : "",
            // the mark the coordinator sent, beside the deputy's final one
            sentTotal: e?.coordinatorVersion?.total ?? null, signed: !!e?.teacherSign,
            noteOpen: !!e?.coordinatorNote && !e.coordinatorNote.handledAt,
            previousTotal: (previous.get(t._id) as any)?.total ?? null,
        };
    }).sort((a: any, b: any) => a.department.localeCompare(b.department, "ar") || a.teacherName.localeCompare(b.teacherName, "ar")) };
} });

export const get = sessionQuery({ args: { teacherId: v.id("schoolTeachers") }, handler: async (ctx, args) => {
    const { session, year, allowed } = await context(ctx);
    const teacher = await ctx.db.get(args.teacherId);
    if (!allowed(teacher)) throw new ConvexError("تقييم هذا المعلم غير متاح ضمن صلاحياتك");
    const e = await evaluationOf(ctx, args.teacherId, year), previous = await evaluationOf(ctx, args.teacherId, yearBefore(year));
    const mine = !!e && e.evaluatorRole === "coordinator" && !manager(session);
    return {
        academicYear: year, manager: manager(session), teacherName: teacher!.fullName.replace(/\s+/g, " ").trim(), department: (teacher!.department ?? "").trim(),
        profile: e?.status === "approved" ? e.profile : await profileOf(ctx, args.teacherId),
        evaluation: e ? { _id: e._id, status: e.status, updatedAt: e.updatedAt, evaluatorName: e.evaluatorName, evaluatorRole: e.evaluatorRole,
            approval: e.approval ?? null, signedAt: e.teacherSign?.at ?? null, signComment: e.teacherSign?.comment ?? "", ...contentFor(session, e),
            // what the coordinator sent, for both of them to compare with the final form
            sent: e.coordinatorVersion ? { scores: parseScores(e.coordinatorVersion.scores), total: e.coordinatorVersion.total, at: e.coordinatorVersion.at, name: e.coordinatorVersion.name,
                penalties: e.coordinatorVersion.penalties, courses: e.coordinatorVersion.courses } : null,
            // the deputy's notes reach the coordinator with the approved form, as the marks do
            review: e.review && (manager(session) || e.status === "approved") ? { note: e.review.note, items: notesOf(e.review.items) } : null,
            coordinatorNote: e.coordinatorNote ?? null,
        } : null,
        // may this visitor change the form now?
        editable: !e ? true : e.status === "approved" ? false : manager(session) ? true : mine && e.status === "draft",
        previous: previous ? { academicYear: previous.academicYear, total: previous.total, scores: parseScores(previous.scores) } : null,
    };
} });

const clean = (s: string, max = 200) => s.replace(/\s+/g, " ").trim().slice(0, max);

// { [indicatorId]: note }, keeping only real indicators and non-empty notes
function notesOf(json: string): Record<string, string> {
    let raw: any = {};
    try { raw = JSON.parse(json); } catch { /* nothing kept */ }
    const out: Record<string, string> = {};
    for (const i of INDICATORS) if (typeof raw?.[i.id] === "string" && clean(raw[i.id], 300)) out[i.id] = clean(raw[i.id], 300);
    return out;
}

export const save = sessionMutation({
    args: { teacherId: v.id("schoolTeachers"), scores: v.string(), penalties: penaltiesV, courses: coursesV,
        send: v.boolean(), expectedUpdatedAt: v.optional(v.number()),
        // the deputy's notes; a coordinator's are ignored
        review: v.optional(v.object({ note: v.string(), items: v.string() })) },
    handler: async (ctx, args) => {
        const { session, school, year, allowed } = await context(ctx);
        const teacher = await ctx.db.get(args.teacherId);
        if (!allowed(teacher) || teacher!.isActive === false) throw new ConvexError("تقييم هذا المعلم غير متاح ضمن صلاحياتك");
        const e = await evaluationOf(ctx, args.teacherId, year);
        if (e && args.expectedUpdatedAt !== e.updatedAt) throw new ConvexError("تم تعديل الاستمارة في جلسة أخرى؛ أعد فتحها قبل الحفظ");
        if (e?.status === "approved") throw new ConvexError("الاستمارة معتمدة؛ يعيد النائب الأكاديمي فتحها للتعديل");
        if (e && !manager(session) && (e.status !== "draft" || e.evaluatorRole !== "coordinator")) throw new ConvexError("الاستمارة عند النائب الأكاديمي للمراجعة");
        if (args.penalties.length > 3 || args.courses.length > 3) throw new ConvexError("الاستمارة تتسع لثلاثة صفوف");

        const scores = parseScores(args.scores);
        if (args.send && scoredCount(scores) !== INDICATORS.length) throw new ConvexError(`بقي ${INDICATORS.length - scoredCount(scores)} مؤشر بلا درجة`);
        const now = Date.now();
        const content = {
            scores: JSON.stringify(scores), total: totalOf(scores),
            penalties: args.penalties.map(p => ({ type: clean(p.type), reason: clean(p.reason), date: clean(p.date, 20) })),
            courses: args.courses.map(c => ({ name: clean(c.name), place: clean(c.place), duration: clean(c.duration, 40), date: clean(c.date, 40) })),
        };
        // A coordinator sending the form leaves their version behind; the deputy saving keeps it as it is
        const sending = args.send && !manager(session);
        const fields = {
            ...content, updatedAt: now,
            teacherName: teacher!.fullName.replace(/\s+/g, " ").trim(), department: (teacher!.department ?? "").trim(),
            profile: await profileOf(ctx, args.teacherId),
            ...(sending ? { status: "sent" as const, coordinatorVersion: { ...content, at: now, name: session.name } } : {}),
            ...(manager(session) && args.review ? { review: { note: clean(args.review.note, 1000), items: JSON.stringify(notesOf(args.review.items)) } } : {}),
        };
        const id = e ? (await ctx.db.patch(e._id, fields), e._id) : await ctx.db.insert("teacherEvaluations", {
            schoolId: school._id, academicYear: year, teacherId: args.teacherId, status: "draft", createdAt: now,
            evaluatorId: session.visitorId, evaluatorName: session.name, evaluatorRole: manager(session) ? "deputy" : "coordinator", ...fields,
        });
        if (sending) await ctx.db.insert("supervisionAuditLog", { schoolId: school._id, action: "evaluation_sent", actorName: session.name,
            details: `أرسل تقييم ${fields.teacherName} للنائب الأكاديمي`, timestamp: now });
        return { id, status: sending ? "sent" : e?.status ?? "draft" };
    },
});

// Approving ends the editing: the form is then the teacher's to read and sign
export const approve = deputyMutation({ args: { id: v.id("teacherEvaluations") }, handler: async (ctx, args) => {
    const session = (ctx as any).supervisionSession;
    const e = await ctx.db.get(args.id);
    if (!e || e.schoolId !== session.schoolId || e.archived) throw new ConvexError("الاستمارة غير موجودة");
    if (e.status === "approved") return;
    if (scoredCount(parseScores(e.scores)) !== INDICATORS.length) throw new ConvexError("أكمل درجات كل المؤشرات قبل الاعتماد");
    const now = Date.now();
    await ctx.db.patch(e._id, { status: "approved", approval: { name: session.name, at: now }, updatedAt: now,
        ...(e.coordinatorNote && !e.coordinatorNote.handledAt ? { coordinatorNote: { ...e.coordinatorNote, handledAt: now, handledBy: session.name } } : {}) });
    await ctx.db.insert("supervisionAuditLog", { schoolId: e.schoolId, action: "evaluation_approved", actorName: session.name,
        details: `اعتماد تقييم ${e.teacherName}`, timestamp: now });
} });

// Back to the deputy's desk; a signature given on the earlier form no longer stands
export const reopen = deputyMutation({ args: { id: v.id("teacherEvaluations"), reason: v.string() }, handler: async (ctx, args) => {
    const session = (ctx as any).supervisionSession;
    const e = await ctx.db.get(args.id);
    if (!e || e.schoolId !== session.schoolId || e.archived || e.status !== "approved") throw new ConvexError("الاستمارة غير معتمدة");
    if (!args.reason.trim()) throw new ConvexError("اكتب سبب إعادة الفتح");
    const now = Date.now();
    await ctx.db.patch(e._id, { status: e.coordinatorVersion ? "sent" : "draft", approval: undefined, teacherSign: undefined, updatedAt: now });
    await ctx.db.insert("supervisionAuditLog", { schoolId: e.schoolId, action: "evaluation_reopened", actorName: session.name,
        details: `إعادة فتح تقييم ${e.teacherName}: ${clean(args.reason)}`, timestamp: now });
} });

// After approval the coordinator may answer the deputy's changes with a remark;
// the deputy then reopens the form to change it, or replies. The form itself,
// and the teacher's link to it, stay as they are.
export const noteFromCoordinator = sessionMutation({ args: { id: v.id("teacherEvaluations"), text: v.string() }, handler: async (ctx, args) => {
    const { session, allowed } = await context(ctx);
    const e = await ctx.db.get(args.id);
    if (!e || !e.teacherId || e.archived || manager(session) || !allowed(await ctx.db.get(e.teacherId))) throw new ConvexError("الاستمارة غير متاحة ضمن صلاحياتك");
    if (e.status !== "approved" || !e.coordinatorVersion) throw new ConvexError("تُرسل الملاحظة بعد اعتماد النائب الأكاديمي");
    const text = args.text.trim().slice(0, 1000);
    if (!text) throw new ConvexError("اكتب الملاحظة");
    const now = Date.now();
    await ctx.db.patch(e._id, { coordinatorNote: { text, at: now, name: session.name } });
    await ctx.db.insert("supervisionAuditLog", { schoolId: e.schoolId, action: "evaluation_coordinator_note", actorName: session.name,
        details: `ملاحظة على تقييم ${e.teacherName}`, timestamp: now });
} });

// The deputy has read the remark, with an optional reply to the coordinator
export const answerNote = deputyMutation({ args: { id: v.id("teacherEvaluations"), reply: v.string() }, handler: async (ctx, args) => {
    const session = (ctx as any).supervisionSession;
    const e = await ctx.db.get(args.id);
    if (!e || e.schoolId !== session.schoolId || !e.coordinatorNote) throw new ConvexError("لا توجد ملاحظة");
    const reply = args.reply.trim().slice(0, 1000);
    await ctx.db.patch(e._id, { coordinatorNote: { ...e.coordinatorNote, handledAt: Date.now(), handledBy: session.name, ...(reply ? { reply } : { reply: undefined }) } });
} });

// Removing this year's form altogether: a trial entry, or one made for the
// wrong teacher. The teacher goes back to «لم يبدأ»; past years' archive stays.
export const remove = deputyMutation({ args: { id: v.id("teacherEvaluations") }, handler: async (ctx, args) => {
    const session = (ctx as any).supervisionSession;
    const e = await ctx.db.get(args.id);
    if (!e || e.schoolId !== session.schoolId) throw new ConvexError("الاستمارة غير موجودة");
    if (e.archived) throw new ConvexError("أرشيف الأعوام السابقة لا يُحذف من هنا");
    for (const link of await ctx.db.query("evaluationLinks").withIndex("by_evaluation", q => q.eq("evaluationId", e._id)).collect()) await ctx.db.delete(link._id);
    await ctx.db.delete(e._id);
    await ctx.db.insert("supervisionAuditLog", { schoolId: e.schoolId, action: "evaluation_deleted", actorName: session.name,
        details: `حذف تقييم ${e.teacherName} (${e.academicYear}) وكان ${e.status === "approved" ? "معتمدًا" : e.status === "sent" ? "عند النائب" : "مسودة"}`, timestamp: Date.now() });
} });

// The deputy keeps the personal details the form prints
export const saveProfile = deputyMutation({
    args: { teacherId: v.id("schoolTeachers"), employeeNo: v.string(), personalNo: v.string(), hireDate: v.string(), jobTitle: v.string(), nationality: v.string() },
    handler: async (ctx, { teacherId, ...raw }) => {
        const session = (ctx as any).supervisionSession;
        const teacher = await ctx.db.get(teacherId);
        if (!teacher || teacher.schoolId !== session.schoolId) throw new ConvexError("المعلم غير موجود");
        const value = Object.fromEntries(Object.entries(raw).map(([k, s]) => [k, clean(s, 60)]));
        const existing = await ctx.db.query("teacherProfiles").withIndex("by_teacher", q => q.eq("teacherId", teacherId)).first();
        if (existing) await ctx.db.patch(existing._id, value); else await ctx.db.insert("teacherProfiles", { schoolId: teacher.schoolId, teacherId, ...value });
    },
});

// The forms to print: one teacher's, or everything the visitor may see in a department
// With version "coordinator": the forms as the coordinator sent them, before the deputy's review.
export const printForms = sessionQuery({ args: { teacherId: v.optional(v.id("schoolTeachers")), department: v.optional(v.string()), version: v.optional(v.literal("coordinator")) }, handler: async (ctx, args) => {
    const { session, school, settings, year, allowed } = await context(ctx);
    const all = (await ctx.db.query("teacherEvaluations").withIndex("by_school_year", (q: any) => q.eq("schoolId", school._id).eq("academicYear", year)).collect())
        .filter((e: any) => e.teacherId && (args.teacherId ? e.teacherId === args.teacherId : e.department === args.department));
    const forms = [];
    for (const e of all.sort((a: any, b: any) => a.teacherName.localeCompare(b.teacherName, "ar"))) {
        if (!allowed(await ctx.db.get(e.teacherId as any))) continue;
        if (!args.version) { forms.push(await formOf(ctx, e, contentFor(session, e), settings)); continue; }
        const c = e.coordinatorVersion;
        if (!c) continue;
        forms.push({ ...(await formOf(ctx, { ...e, teacherSign: undefined }, { scores: parseScores(c.scores), total: c.total, penalties: c.penalties, courses: c.courses }, settings)),
            status: "sent", version: { name: c.name, at: c.at } });
    }
    return forms;
} });

// The teacher's private link; what it opens is in evaluationLinks.ts
export const createLink = sessionMutation({ args: { id: v.id("teacherEvaluations"), token: v.string() }, handler: async (ctx, args) => {
    const { session, allowed } = await context(ctx);
    const e = await ctx.db.get(args.id);
    if (!e || !e.teacherId || !allowed(await ctx.db.get(e.teacherId))) throw new ConvexError("الاستمارة غير متاحة ضمن صلاحياتك");
    if (e.status !== "approved") throw new ConvexError("يوقّع المعلم بعد اعتماد النائب الأكاديمي");
    if (!/^[a-f0-9]{64}$/.test(args.token)) throw new ConvexError("أعد إنشاء الرابط");
    const tokenHash = await digest(args.token);
    if (await ctx.db.query("evaluationLinks").withIndex("by_token", q => q.eq("tokenHash", tokenHash)).first()) throw new ConvexError("أعد إنشاء الرابط");
    for (const old of await ctx.db.query("evaluationLinks").withIndex("by_evaluation", q => q.eq("evaluationId", e._id)).collect()) {
        if (!old.revoked) await ctx.db.patch(old._id, { revoked: true });
    }
    await ctx.db.insert("evaluationLinks", { schoolId: e.schoolId, evaluationId: e._id, tokenHash, evaluationUpdatedAt: e.updatedAt,
        expiresAt: Date.now() + 15 * 86400000, createdBy: session.name, revoked: false });
} });
