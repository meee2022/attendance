import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// ── المتابعة اليومية (كشف تقييم يومي للطلاب) ──────────────────────────────
// The paper sheet is a grid of students × criteria for one lesson. Almost every
// cell reads "met", so the store keeps exceptions only: a session says the sheet
// was taken, and a record exists only for a student who missed something, was
// absent, or has a note.

export const DEFAULT_CRITERIA = [
    { id: "tools", label: "الأدوات والكتب" },
    { id: "participation", label: "مشاركة صفية" },
    { id: "homework", label: "واجبات" },
    { id: "elearning", label: "مهام التعليم الإلكتروني" },
    { id: "behaviour", label: "مواظبة وسلوك" },
];

// A criterion is either met (no entry at all) or not met.
type MarkValue = "no";

async function getSchool(ctx: any) {
    const school = await ctx.db.query("schools").first();
    if (!school) throw new Error("لا توجد مدرسة مُهيَّأة");
    return school;
}

function parseMarks(raw: string | undefined): Record<string, MarkValue> {
    if (!raw) return {};
    try {
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== "object") return {};
        // Sheets recorded before the scale was reduced may hold "partial";
        // read it as not met so nothing silently disappears from the totals.
        const out: Record<string, MarkValue> = {};
        for (const [k, v] of Object.entries(parsed)) {
            if (v === "no" || v === "partial") out[k] = "no";
        }
        return out;
    } catch {
        return {};
    }
}

// A record with nothing to say should not exist.
function isEmptyRecord(marks: Record<string, MarkValue>, isAbsent?: boolean, notes?: string) {
    return Object.keys(marks).length === 0 && !isAbsent && !notes?.trim();
}

// ── Criteria (stored on the school, like the practical-exam settings) ─────
export const getCriteria = query({
    args: {},
    handler: async (ctx) => {
        const school = await ctx.db.query("schools").first();
        return school?.followUpCriteria?.length ? school.followUpCriteria : DEFAULT_CRITERIA;
    },
});

export const updateCriteria = mutation({
    args: {
        criteria: v.array(v.object({ id: v.string(), label: v.string() })),
    },
    handler: async (ctx, args) => {
        const school = await getSchool(ctx);
        const cleaned = args.criteria
            .map(c => ({ id: c.id.trim(), label: c.label.trim() }))
            .filter(c => c.id && c.label);
        if (cleaned.length === 0) throw new Error("يجب إبقاء معيار واحد على الأقل.");
        await ctx.db.patch(school._id, { followUpCriteria: cleaned });
        return "تم حفظ المعايير.";
    },
});

// ── The sheet for one lesson ──────────────────────────────────────────────
export const getSheet = query({
    args: { classId: v.id("classes"), subjectName: v.string(), date: v.string() },
    handler: async (ctx, args) => {
        const school = await ctx.db.query("schools").first();
        if (!school) return null;

        const cls = await ctx.db.get(args.classId);
        if (!cls) return null;

        const session = await ctx.db.query("followUpSessions")
            .withIndex("by_class_subject_date", q =>
                q.eq("classId", args.classId)
                 .eq("subjectName", args.subjectName)
                 .eq("date", args.date))
            .first();

        const records = session
            ? await ctx.db.query("followUpRecords")
                .withIndex("by_session", q => q.eq("sessionId", session._id))
                .collect()
            : [];

        const byStudent = new Map(records.map(r => [r.studentId as string, r]));

        const students = (await ctx.db.query("students")
            .withIndex("by_class", q => q.eq("classId", args.classId))
            .collect())
            .filter(s => s.isActive !== false)
            .sort((a, b) => a.fullName.localeCompare(b.fullName, "ar"))
            .map(s => {
                const rec = byStudent.get(s._id as string);
                return {
                    studentId: s._id,
                    fullName: s.fullName,
                    guardianPhone: s.guardianPhone,
                    isAbsent: rec?.isAbsent ?? false,
                    marks: parseMarks(rec?.marks),
                    notes: rec?.notes ?? "",
                };
            });

        return {
            classId: args.classId,
            className: cls.name,
            grade: cls.grade,
            track: cls.track ?? "عام",
            subjectName: args.subjectName,
            date: args.date,
            isRecorded: session !== null,
            teacherName: session?.teacherName ?? "",
            students,
        };
    },
});

// Ensure the session row exists — recording "everyone met every criterion" is
// exactly this and nothing else.
async function ensureSession(ctx: any, args: {
    classId: any; subjectName: string; date: string; teacherName?: string;
}) {
    const school = await getSchool(ctx);
    const cls = await ctx.db.get(args.classId);
    if (!cls) throw new Error("الصف غير موجود");

    const existing = await ctx.db.query("followUpSessions")
        .withIndex("by_class_subject_date", (q: any) =>
            q.eq("classId", args.classId)
             .eq("subjectName", args.subjectName)
             .eq("date", args.date))
        .first();

    if (existing) {
        if (args.teacherName && args.teacherName !== existing.teacherName) {
            await ctx.db.patch(existing._id, { teacherName: args.teacherName });
        }
        return { session: existing, school, cls };
    }

    const id = await ctx.db.insert("followUpSessions", {
        schoolId: school._id,
        classId: args.classId,
        className: cls.name,
        subjectName: args.subjectName,
        date: args.date,
        teacherName: args.teacherName,
        createdAt: Date.now(),
    });
    return { session: (await ctx.db.get(id))!, school, cls };
}

export const openSheet = mutation({
    args: {
        classId: v.id("classes"),
        subjectName: v.string(),
        date: v.string(),
        teacherName: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const { session } = await ensureSession(ctx, args);
        return session._id;
    },
});

// Write one student's row, dropping it when there is nothing left to record.
async function writeRecord(ctx: any, params: {
    classId: any; subjectName: string; date: string; studentId: any;
    teacherName?: string; updatedBy?: string;
    mutate: (current: { marks: Record<string, MarkValue>; isAbsent: boolean; notes: string })
        => { marks: Record<string, MarkValue>; isAbsent: boolean; notes: string };
}) {
    const { session, school, cls } = await ensureSession(ctx, params);

    const student = await ctx.db.get(params.studentId);
    if (!student) throw new Error("الطالب غير موجود");

    const existing = (await ctx.db.query("followUpRecords")
        .withIndex("by_session", (q: any) => q.eq("sessionId", session._id))
        .collect())
        .find((r: any) => r.studentId === params.studentId);

    const current = {
        marks: parseMarks(existing?.marks),
        isAbsent: existing?.isAbsent ?? false,
        notes: existing?.notes ?? "",
    };
    const next = params.mutate(current);

    if (isEmptyRecord(next.marks, next.isAbsent, next.notes)) {
        if (existing) await ctx.db.delete(existing._id);
        return null;
    }

    const data = {
        isAbsent: next.isAbsent || undefined,
        marks: JSON.stringify(next.marks),
        notes: next.notes.trim() || undefined,
        updatedAt: Date.now(),
        updatedBy: params.updatedBy,
    };

    if (existing) {
        await ctx.db.patch(existing._id, data);
        return existing._id;
    }
    return await ctx.db.insert("followUpRecords", {
        schoolId: school._id,
        sessionId: session._id,
        classId: params.classId,
        studentId: params.studentId,
        studentName: student.fullName,
        className: cls.name,
        subjectName: params.subjectName,
        date: params.date,
        ...data,
    });
}

export const setMark = mutation({
    args: {
        classId: v.id("classes"),
        subjectName: v.string(),
        date: v.string(),
        studentId: v.id("students"),
        criterionId: v.string(),
        // null = met, so the entry is removed
        value: v.union(v.literal("no"), v.null()),
        teacherName: v.optional(v.string()),
        updatedBy: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        return await writeRecord(ctx, {
            ...args,
            mutate: current => {
                const marks = { ...current.marks };
                if (args.value === null) delete marks[args.criterionId];
                else marks[args.criterionId] = args.value;
                return { ...current, marks };
            },
        });
    },
});

export const setAbsent = mutation({
    args: {
        classId: v.id("classes"),
        subjectName: v.string(),
        date: v.string(),
        studentId: v.id("students"),
        isAbsent: v.boolean(),
        teacherName: v.optional(v.string()),
        updatedBy: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        return await writeRecord(ctx, {
            ...args,
            // An absent student cannot miss criteria — clear them so the sheet
            // does not double-count the same day against them.
            mutate: current => args.isAbsent
                ? { ...current, isAbsent: true, marks: {} }
                : { ...current, isAbsent: false },
        });
    },
});

export const setNotes = mutation({
    args: {
        classId: v.id("classes"),
        subjectName: v.string(),
        date: v.string(),
        studentId: v.id("students"),
        notes: v.string(),
        teacherName: v.optional(v.string()),
        updatedBy: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        return await writeRecord(ctx, {
            ...args,
            mutate: current => ({ ...current, notes: args.notes }),
        });
    },
});

// Mark one criterion for several students at once (the column "ملء" equivalent).
export const setMarkForStudents = mutation({
    args: {
        classId: v.id("classes"),
        subjectName: v.string(),
        date: v.string(),
        studentIds: v.array(v.id("students")),
        criterionId: v.string(),
        value: v.union(v.literal("no"), v.null()),
        teacherName: v.optional(v.string()),
        updatedBy: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        let changed = 0;
        for (const studentId of args.studentIds) {
            await writeRecord(ctx, {
                classId: args.classId,
                subjectName: args.subjectName,
                date: args.date,
                studentId,
                teacherName: args.teacherName,
                updatedBy: args.updatedBy,
                mutate: current => {
                    if (current.isAbsent) return current; // leave absentees alone
                    const marks = { ...current.marks };
                    if (args.value === null) delete marks[args.criterionId];
                    else marks[args.criterionId] = args.value;
                    return { ...current, marks };
                },
            });
            changed++;
        }
        return { changed };
    },
});

// Reset the sheet back to "everyone met everything" (the session stays).
export const clearSheet = mutation({
    args: { classId: v.id("classes"), subjectName: v.string(), date: v.string() },
    handler: async (ctx, args) => {
        const session = await ctx.db.query("followUpSessions")
            .withIndex("by_class_subject_date", q =>
                q.eq("classId", args.classId)
                 .eq("subjectName", args.subjectName)
                 .eq("date", args.date))
            .first();
        if (!session) return { cleared: 0 };

        const records = await ctx.db.query("followUpRecords")
            .withIndex("by_session", q => q.eq("sessionId", session._id))
            .collect();
        for (const r of records) await ctx.db.delete(r._id);
        return { cleared: records.length };
    },
});

export const deleteSheet = mutation({
    args: { classId: v.id("classes"), subjectName: v.string(), date: v.string() },
    handler: async (ctx, args) => {
        const session = await ctx.db.query("followUpSessions")
            .withIndex("by_class_subject_date", q =>
                q.eq("classId", args.classId)
                 .eq("subjectName", args.subjectName)
                 .eq("date", args.date))
            .first();
        if (!session) return { deleted: 0 };

        const records = await ctx.db.query("followUpRecords")
            .withIndex("by_session", q => q.eq("sessionId", session._id))
            .collect();
        for (const r of records) await ctx.db.delete(r._id);
        await ctx.db.delete(session._id);
        return { deleted: records.length + 1 };
    },
});

// One-off: the scale used to have a middle state. Rewrite those marks as
// "not met" so the stored rows match what the sheet now shows.
export const convertPartialMarks = mutation({
    args: {},
    handler: async (ctx) => {
        const school = await getSchool(ctx);
        const records = await ctx.db.query("followUpRecords")
            .withIndex("by_school", q => q.eq("schoolId", school._id))
            .collect();

        let converted = 0;
        for (const r of records) {
            let raw: Record<string, string>;
            try { raw = JSON.parse(r.marks || "{}"); } catch { continue; }
            const partials = Object.entries(raw).filter(([, v]) => v === "partial");
            if (partials.length === 0) continue;
            for (const [k] of partials) raw[k] = "no";
            await ctx.db.patch(r._id, { marks: JSON.stringify(raw), updatedAt: Date.now() });
            converted += partials.length;
        }
        return { converted };
    },
});

// ── Analysis: what the paper sheet can never tell you ─────────────────────
// Every flagged entry in a date range, per student and per criterion.
export const getAnalysis = query({
    args: {
        from: v.string(),
        to: v.string(),
        classId: v.optional(v.id("classes")),
        subjectName: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const school = await ctx.db.query("schools").first();
        if (!school) return null;

        const sessions = (await ctx.db.query("followUpSessions")
            .withIndex("by_school", q => q.eq("schoolId", school._id))
            .collect())
            .filter(s => s.date >= args.from && s.date <= args.to)
            .filter(s => !args.classId || s.classId === args.classId)
            .filter(s => !args.subjectName || s.subjectName === args.subjectName);

        const sessionIds = new Set(sessions.map(s => s._id as string));

        const records = (await ctx.db.query("followUpRecords")
            .withIndex("by_school", q => q.eq("schoolId", school._id))
            .collect())
            .filter(r => sessionIds.has(r.sessionId as string));

        const criteria = school.followUpCriteria?.length ? school.followUpCriteria : DEFAULT_CRITERIA;

        // Per criterion: how often it was missed
        const byCriterion: Record<string, { no: number }> = {};
        for (const c of criteria) byCriterion[c.id] = { no: 0 };

        // Per student: total flags and a per-criterion breakdown
        const byStudent = new Map<string, {
            studentId: string; studentName: string; className: string;
            guardianPhone?: string;
            flags: number; absences: number;
            perCriterion: Record<string, number>;
            subjects: Set<string>;
            dates: Set<string>;
        }>();

        for (const r of records) {
            const marks = parseMarks(r.marks);
            const key = r.studentId as string;

            const entry = byStudent.get(key) ?? {
                studentId: key,
                studentName: r.studentName,
                className: r.className,
                flags: 0,
                absences: 0,
                perCriterion: Object.fromEntries(criteria.map(c => [c.id, 0])),
                subjects: new Set<string>(),
                dates: new Set<string>(),
            };

            for (const [criterionId] of Object.entries(marks)) {
                if (byCriterion[criterionId]) byCriterion[criterionId].no++;
                entry.perCriterion[criterionId] = (entry.perCriterion[criterionId] ?? 0) + 1;
                entry.flags++;
                entry.subjects.add(r.subjectName);
                entry.dates.add(r.date);
            }
            if (r.isAbsent) entry.absences++;

            byStudent.set(key, entry);
        }

        // Guardian phones for the flagged students, for the messaging shortcut
        const students = await Promise.all(
            [...byStudent.keys()].map(id => ctx.db.get(id as any)));
        for (const s of students) {
            if (!s) continue;
            const entry = byStudent.get(s._id as string);
            if (entry) entry.guardianPhone = (s as any).guardianPhone;
        }

        return {
            sessionCount: sessions.length,
            recordCount: records.length,
            criteria,
            byCriterion: criteria.map(c => ({
                id: c.id,
                label: c.label,
                total: byCriterion[c.id]?.no ?? 0,
            })).sort((a, b) => b.total - a.total),
            students: [...byStudent.values()]
                .map(e => ({
                    studentId: e.studentId,
                    studentName: e.studentName,
                    className: e.className,
                    guardianPhone: e.guardianPhone,
                    flags: e.flags,
                    absences: e.absences,
                    perCriterion: e.perCriterion,
                    subjectCount: e.subjects.size,
                    dayCount: e.dates.size,
                }))
                .sort((a, b) => b.flags - a.flags),
        };
    },
});

// Which sheets were taken recently — makes gaps in the record obvious.
export const getRecentSessions = query({
    args: { limit: v.optional(v.number()) },
    handler: async (ctx, args) => {
        const school = await ctx.db.query("schools").first();
        if (!school) return [];

        const sessions = (await ctx.db.query("followUpSessions")
            .withIndex("by_school", q => q.eq("schoolId", school._id))
            .collect())
            .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt)
            .slice(0, args.limit ?? 40);

        return await Promise.all(sessions.map(async s => {
            const records = await ctx.db.query("followUpRecords")
                .withIndex("by_session", q => q.eq("sessionId", s._id))
                .collect();
            let flags = 0;
            for (const r of records) flags += Object.keys(parseMarks(r.marks)).length;
            return {
                _id: s._id,
                classId: s.classId,
                className: s.className,
                subjectName: s.subjectName,
                date: s.date,
                teacherName: s.teacherName,
                flaggedStudents: records.filter(r => Object.keys(parseMarks(r.marks)).length > 0).length,
                flags,
                absences: records.filter(r => r.isAbsent).length,
            };
        }));
    },
});

// The whole week for one class+subject — the layout of the official sheet.
export const getWeekSheet = query({
    args: {
        classId: v.id("classes"),
        subjectName: v.string(),
        dates: v.array(v.string()),
    },
    handler: async (ctx, args) => {
        const school = await ctx.db.query("schools").first();
        if (!school) return null;
        const cls = await ctx.db.get(args.classId);
        if (!cls) return null;

        const criteria = school.followUpCriteria?.length ? school.followUpCriteria : DEFAULT_CRITERIA;

        const students = (await ctx.db.query("students")
            .withIndex("by_class", q => q.eq("classId", args.classId))
            .collect())
            .filter(s => s.isActive !== false)
            .sort((a, b) => a.fullName.localeCompare(b.fullName, "ar"));

        const days = await Promise.all(args.dates.map(async date => {
            const session = await ctx.db.query("followUpSessions")
                .withIndex("by_class_subject_date", q =>
                    q.eq("classId", args.classId)
                     .eq("subjectName", args.subjectName)
                     .eq("date", date))
                .first();

            const records = session
                ? await ctx.db.query("followUpRecords")
                    .withIndex("by_session", q => q.eq("sessionId", session._id))
                    .collect()
                : [];

            return {
                date,
                isRecorded: session !== null,
                teacherName: session?.teacherName ?? "",
                byStudent: Object.fromEntries(records.map(r => [
                    r.studentId as string,
                    { isAbsent: r.isAbsent ?? false, marks: parseMarks(r.marks), notes: r.notes ?? "" },
                ])),
            };
        }));

        return {
            schoolName: school.name,
            className: cls.name,
            grade: cls.grade,
            track: cls.track ?? "عام",
            subjectName: args.subjectName,
            criteria,
            students: students.map(s => ({ studentId: s._id, fullName: s.fullName })),
            days,
        };
    },
});
