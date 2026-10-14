import { ConvexError, v } from "convex/values";
import { memberQuery, memberMutation, staffQuery, staffMutation } from "./platformAccess";

// «استطلاع رأي المدرسين في الطلاب»: each teacher rates every student they
// teach — academic level, behaviour, distraction in class — and writes a word
// of advice to the guardian. The deputy follows who has finished, then
// publishes, and every guardian reads one report gathering all subjects
// through a private link sent from an Excel list.

const DAY = 86_400_000;
const distractionV = v.union(v.literal("no"), v.literal("sometimes"), v.literal("yes"));
const session = (ctx: any) => ctx.platformSession;

async function roundOf(ctx: any, id: any) {
    const round = await ctx.db.get(id);
    if (!round || round.schoolId !== session(ctx).schoolId) throw new ConvexError("الاستطلاع غير متاح");
    return round;
}
async function gradeStudents(ctx: any, schoolId: any, grade: number) {
    const classes = (await ctx.db.query("classes").withIndex("by_school", (q: any) => q.eq("schoolId", schoolId)).collect())
        .filter((c: any) => c.isActive !== false && c.grade === grade)
        .sort((a: any, b: any) => a.name.localeCompare(b.name, "ar", { numeric: true }));
    const students = [];
    for (const c of classes) {
        const rows = await ctx.db.query("students").withIndex("by_class", (q: any) => q.eq("classId", c._id)).collect();
        students.push(...rows.filter((s: any) => s.isActive !== false)
            .sort((a: any, b: any) => a.fullName.localeCompare(b.fullName, "ar"))
            .map((s: any) => ({ ...s, className: c.name })));
    }
    return { classes, students };
}

// ── Rounds ───────────────────────────────────────────────────────────────
export const rounds = memberQuery({ args: {}, handler: async (ctx) => {
    const rows = await ctx.db.query("opinionRounds").withIndex("by_school", q => q.eq("schoolId", session(ctx).schoolId)).collect();
    const staff = ["admin", "deputy"].includes(session(ctx).role);
    return rows.filter(r => staff || r.open).sort((a, b) => b.createdAt - a.createdAt);
} });

export const createRound = staffMutation({ args: { title: v.string(), grade: v.number() }, handler: async (ctx, args) => {
    const title = args.title.trim().slice(0, 160);
    if (!title) throw new ConvexError("اكتب عنوان الاستطلاع");
    if (!Number.isInteger(args.grade) || args.grade < 1 || args.grade > 12) throw new ConvexError("اختر الصف");
    return ctx.db.insert("opinionRounds", { schoolId: session(ctx).schoolId, title, grade: args.grade, open: true, published: false, createdAt: Date.now(), createdBy: session(ctx).name });
} });

export const setRound = staffMutation({ args: { id: v.id("opinionRounds"), open: v.optional(v.boolean()), published: v.optional(v.boolean()) }, handler: async (ctx, args) => {
    await roundOf(ctx, args.id);
    const patch: any = {};
    if (args.open !== undefined) patch.open = args.open;
    if (args.published !== undefined) patch.published = args.published;
    await ctx.db.patch(args.id, patch);
} });

// ── The teacher's sheet ──────────────────────────────────────────────────
export const setup = memberQuery({ args: { roundId: v.id("opinionRounds") }, handler: async (ctx, args) => {
    const round = await roundOf(ctx, args.roundId);
    const teachers = (await ctx.db.query("schoolTeachers").withIndex("by_school", q => q.eq("schoolId", round.schoolId)).collect())
        .filter(t => t.isActive !== false)
        .map(t => ({ _id: t._id, fullName: t.fullName.replace(/\s+/g, " ").trim(), department: (t.department ?? "").trim() }))
        .sort((a, b) => a.fullName.localeCompare(b.fullName, "ar"));
    const classes = (await ctx.db.query("classes").withIndex("by_school", q => q.eq("schoolId", round.schoolId)).collect())
        .filter(c => c.isActive !== false && c.grade === round.grade)
        .map(c => ({ _id: c._id, name: c.name }))
        .sort((a, b) => a.name.localeCompare(b.name, "ar", { numeric: true }));
    return { round, teachers, classes };
} });

// The students of one section with what this teacher wrote about each, for this subject
export const sheet = memberQuery({ args: { roundId: v.id("opinionRounds"), classId: v.id("classes"), teacherId: v.id("schoolTeachers"), subjectName: v.string() }, handler: async (ctx, args) => {
    const round = await roundOf(ctx, args.roundId);
    const cls = await ctx.db.get(args.classId);
    if (!cls || cls.schoolId !== round.schoolId || cls.grade !== round.grade) throw new ConvexError("الشعبة ليست من صف الاستطلاع");
    const students = (await ctx.db.query("students").withIndex("by_class", q => q.eq("classId", args.classId)).collect())
        .filter(s => s.isActive !== false)
        .sort((a, b) => a.fullName.localeCompare(b.fullName, "ar"))
        .map(s => ({ _id: s._id, fullName: s.fullName }));
    const mine = await ctx.db.query("studentOpinions")
        .withIndex("by_round_teacher", q => q.eq("roundId", args.roundId).eq("teacherId", args.teacherId).eq("subjectName", args.subjectName.trim()))
        .collect();
    return { students, opinions: mine.filter(o => o.classId === args.classId) };
} });

export const save = memberMutation({
    args: {
        roundId: v.id("opinionRounds"), studentId: v.id("students"),
        teacherId: v.id("schoolTeachers"), subjectName: v.string(),
        academic: v.optional(v.union(v.number(), v.null())),
        behavior: v.optional(v.union(v.number(), v.null())),
        distraction: v.optional(v.union(distractionV, v.null())),
        advice: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const round = await roundOf(ctx, args.roundId);
        if (!round.open) throw new ConvexError("أُغلق الاستطلاع؛ لا يمكن التعديل");
        const subjectName = args.subjectName.trim().slice(0, 80);
        if (!subjectName) throw new ConvexError("اكتب المادة");
        const teacher = await ctx.db.get(args.teacherId);
        if (!teacher || teacher.schoolId !== round.schoolId || teacher.isActive === false) throw new ConvexError("اختر اسمك من القائمة");
        const student = await ctx.db.get(args.studentId);
        const cls = student ? await ctx.db.get(student.classId) : null;
        if (!student || !cls || student.schoolId !== round.schoolId || cls.grade !== round.grade) throw new ConvexError("الطالب ليس من صف الاستطلاع");
        for (const x of [args.academic, args.behavior]) if (x != null && !(Number.isInteger(x) && x >= 1 && x <= 5)) throw new ConvexError("اختر التقدير من القائمة");
        const existing = (await ctx.db.query("studentOpinions")
            .withIndex("by_round_teacher", q => q.eq("roundId", args.roundId).eq("teacherId", args.teacherId).eq("subjectName", subjectName))
            .collect()).find(o => o.studentId === args.studentId);
        // null clears a field; a field left out keeps its value
        const patch: any = { updatedAt: Date.now() };
        if (args.academic !== undefined) patch.academic = args.academic ?? undefined;
        if (args.behavior !== undefined) patch.behavior = args.behavior ?? undefined;
        if (args.distraction !== undefined) patch.distraction = args.distraction ?? undefined;
        if (args.advice !== undefined) patch.advice = args.advice.trim().slice(0, 600) || undefined;
        if (existing) { await ctx.db.patch(existing._id, patch); return; }
        await ctx.db.insert("studentOpinions", {
            schoolId: round.schoolId, roundId: round._id, studentId: student._id, classId: cls._id,
            teacherId: teacher._id, teacherName: teacher.fullName.replace(/\s+/g, " ").trim(), subjectName, ...patch,
        });
    },
});

// ── The deputy's view ────────────────────────────────────────────────────
export const overview = staffQuery({ args: { roundId: v.id("opinionRounds") }, handler: async (ctx, args) => {
    const round = await roundOf(ctx, args.roundId);
    const { classes, students } = await gradeStudents(ctx, round.schoolId, round.grade);
    const opinions = await ctx.db.query("studentOpinions").withIndex("by_round", q => q.eq("roundId", round._id)).collect();
    const links = await ctx.db.query("guardianLinks").withIndex("by_round", q => q.eq("roundId", round._id)).collect();
    return {
        round,
        classes: classes.map((c: any) => ({ _id: c._id, name: c.name })),
        students: students.map((s: any) => ({ _id: s._id, fullName: s.fullName, classId: s.classId, className: s.className, nationalId: s.nationalId ?? "", guardianPhone: s.guardianPhone ?? "" })),
        opinions: opinions.map(o => ({ studentId: o.studentId, classId: o.classId, teacherId: o.teacherId, teacherName: o.teacherName, subjectName: o.subjectName,
            academic: o.academic ?? null, behavior: o.behavior ?? null, distraction: o.distraction ?? null, advice: o.advice ?? "", updatedAt: o.updatedAt })),
        links: links.map(l => ({ studentId: l.studentId, token: l.token, expiresAt: l.expiresAt, openCount: l.openCount, firstOpenedAt: l.firstOpenedAt ?? null })),
    };
} });

// A private link for every student who has none still valid
export const issueLinks = staffMutation({ args: { roundId: v.id("opinionRounds"), days: v.number() }, handler: async (ctx, args) => {
    const round = await roundOf(ctx, args.roundId);
    const days = Math.min(120, Math.max(1, Math.round(args.days)));
    const { students } = await gradeStudents(ctx, round.schoolId, round.grade);
    const now = Date.now();
    const valid = new Set((await ctx.db.query("guardianLinks").withIndex("by_round", q => q.eq("roundId", round._id)).collect())
        .filter(l => l.expiresAt > now).map(l => l.studentId));
    let made = 0;
    for (const s of students) {
        if (valid.has(s._id)) continue;
        const token = Array.from(crypto.getRandomValues(new Uint8Array(24)), b => b.toString(16).padStart(2, "0")).join("");
        await ctx.db.insert("guardianLinks", { schoolId: round.schoolId, roundId: round._id, studentId: s._id, token, expiresAt: now + days * DAY, createdAt: now, openCount: 0 });
        made++;
    }
    return made;
} });
