import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

async function getSchool(ctx: any) {
    const sch = await ctx.db.query("schools").first();
    if (!sch) throw new Error("لا توجد مدرسة مُهيَّأة");
    return sch;
}

const DEFAULT_SUBJECTS = [
    { subject: "الفيزياء", category: "عملي" },
    { subject: "الكيمياء", category: "عملي" },
    { subject: "الأحياء", category: "عملي" },
    { subject: "المهارات الحياتية", category: "مهارات حياتية" },
    { subject: "اللغة العربية", category: "شفوي" },
    { subject: "اللغة الإنجليزية", category: "شفوي" },
    { subject: "التربية البدنية", category: "تربية بدنية" },
];

const DEFAULT_TEMPLATE = `السلام عليكم ولي أمر الطالب {studentName}
نود إعلامكم بـ غياب الطالب عن:
🎯 اختبار: {category} - {subject}
🏫 الفصل: {className}
📅 التاريخ: {date}

نأمل التواصل مع إدارة المدرسة بشأن الاختبار التعويضي.

مدرسة ابن تيمية الثانوية للبنين`;

// ── Settings ──────────────────────────────────────────────────────────────
export const getSettings = query({
    args: {},
    handler: async (ctx) => {
        const school = await ctx.db.query("schools").first();
        if (!school) return null;
        return {
            subjects: school.practicalSubjects ?? DEFAULT_SUBJECTS,
            template: school.practicalAbsenceTemplate ?? DEFAULT_TEMPLATE,
        };
    },
});

export const updateSubjects = mutation({
    args: { subjects: v.array(v.object({ subject: v.string(), category: v.string() })) },
    handler: async (ctx, args) => {
        const school = await getSchool(ctx);
        await ctx.db.patch(school._id, { practicalSubjects: args.subjects });
    },
});

export const updateTemplate = mutation({
    args: { template: v.string() },
    handler: async (ctx, args) => {
        const school = await getSchool(ctx);
        await ctx.db.patch(school._id, { practicalAbsenceTemplate: args.template });
    },
});

// ── Classes (from existing classes table) ────────────────────────────────
export const getClassesWithStats = query({
    args: {},
    handler: async (ctx) => {
        const school = await ctx.db.query("schools").first();
        if (!school) return [];
        const classes = await ctx.db.query("classes")
            .withIndex("by_school", q => q.eq("schoolId", school._id))
            .collect();
        const absences = await ctx.db.query("practicalAbsences")
            .withIndex("by_school", q => q.eq("schoolId", school._id))
            .collect();
        const result = await Promise.all(classes.filter(c => c.isActive !== false).map(async (cls) => {
            const students = await ctx.db.query("students")
                .withIndex("by_class", q => q.eq("classId", cls._id))
                .collect();
            const activeStudents = students.filter(s => s.isActive !== false);
            // Normalize comparison with trim
            const clsNameTrim = cls.name.trim();
            const classAbsences = absences.filter(a => (a.className ?? "").trim() === clsNameTrim);
            return {
                _id: cls._id,
                name: cls.name,
                grade: cls.grade,
                track: cls.track ?? "",
                totalStudents: activeStudents.length,
                absenceCount: classAbsences.length,
            };
        }));
        return result;
    },
});

// ── Class Roster ──────────────────────────────────────────────────────────
export const getClassRoster = query({
    args: { className: v.string() },
    handler: async (ctx, args) => {
        const school = await ctx.db.query("schools").first();
        if (!school) return { students: [], absences: [], classMeta: null };
        const requested = args.className.trim();
        const classes = await ctx.db.query("classes")
            .withIndex("by_school", q => q.eq("schoolId", school._id))
            .collect();
        const cls = classes.find(c => c.name.trim() === requested);
        if (!cls) return { students: [], absences: [], classMeta: null };

        const students = await ctx.db.query("students")
            .withIndex("by_class", q => q.eq("classId", cls._id))
            .collect();
        const activeStudents = students.filter(s => s.isActive !== false);

        // Match absences by normalized className (legacy data might have extra spaces)
        const allAbsences = await ctx.db.query("practicalAbsences")
            .withIndex("by_school", q => q.eq("schoolId", school._id))
            .collect();
        const absences = allAbsences.filter(a => (a.className ?? "").trim() === requested);

        return {
            classMeta: { _id: cls._id, name: cls.name, grade: cls.grade, track: cls.track ?? "" },
            students: activeStudents,
            absences,
        };
    },
});

// ── Mark / Unmark ─────────────────────────────────────────────────────────
export const toggleAbsence = mutation({
    args: {
        studentId: v.optional(v.id("students")),
        studentName: v.string(),
        className: v.string(),
        grade: v.number(),
        subject: v.string(),
        category: v.string(),
        status: v.optional(v.union(v.literal("absent"), v.literal("excused"))),
        markedBy: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const school = await getSchool(ctx);
        const classNameNorm = args.className.trim();
        const studentNameNorm = args.studentName.trim();
        const subjectNorm = args.subject.trim();

        // Find existing record (defensive normalization in case old data had extra spaces)
        const candidates = await ctx.db.query("practicalAbsences")
            .withIndex("by_school", q => q.eq("schoolId", school._id))
            .collect();
        const existing = candidates.find(c =>
            (c.className ?? "").trim() === classNameNorm &&
            (c.studentName ?? "").trim() === studentNameNorm &&
            (c.subject ?? "").trim() === subjectNorm
        );

        const desiredStatus = args.status ?? "absent";

        if (existing) {
            if (existing.status === desiredStatus) {
                await ctx.db.delete(existing._id);
                return { action: "removed" };
            }
            await ctx.db.patch(existing._id, {
                status: desiredStatus,
                markedAt: Date.now(),
                markedBy: args.markedBy,
            });
            return { action: "updated" };
        }

        await ctx.db.insert("practicalAbsences", {
            schoolId: school._id,
            studentId: args.studentId,
            studentName: studentNameNorm,
            className: classNameNorm,
            grade: args.grade,
            subject: subjectNorm,
            category: args.category.trim(),
            status: desiredStatus,
            markedAt: Date.now(),
            markedBy: args.markedBy,
        });
        return { action: "created" };
    },
});

export const clearAbsencesForSubject = mutation({
    args: { className: v.string(), subject: v.string() },
    handler: async (ctx, args) => {
        const school = await getSchool(ctx);
        const list = await ctx.db.query("practicalAbsences")
            .withIndex("by_class", q => q.eq("schoolId", school._id).eq("className", args.className))
            .filter(q => q.eq(q.field("subject"), args.subject))
            .collect();
        for (const a of list) await ctx.db.delete(a._id);
        return { cleared: list.length };
    },
});

// Delete a single absence record by id
export const deleteAbsence = mutation({
    args: { id: v.id("practicalAbsences") },
    handler: async (ctx, args) => {
        await ctx.db.delete(args.id);
    },
});

// Delete all legacy records (those without subject)
export const deleteLegacyAbsences = mutation({
    args: {},
    handler: async (ctx) => {
        const school = await getSchool(ctx);
        const all = await ctx.db.query("practicalAbsences")
            .withIndex("by_school", q => q.eq("schoolId", school._id))
            .collect();
        let deleted = 0;
        for (const a of all) {
            if (!a.subject || a.subject.trim() === "") {
                await ctx.db.delete(a._id);
                deleted++;
            }
        }
        return { deleted };
    },
});

// ── Maintenance: normalize whitespace in existing records ────────────────
export const normalizeAllRecords = mutation({
    args: {},
    handler: async (ctx) => {
        const school = await getSchool(ctx);
        const all = await ctx.db.query("practicalAbsences")
            .withIndex("by_school", q => q.eq("schoolId", school._id))
            .collect();
        let normalized = 0;
        for (const r of all) {
            const patch: any = {};
            const cn = (r.className ?? "").trim();
            const sn = (r.studentName ?? "").trim();
            const sub = (r.subject ?? "").trim();
            const cat = (r.category ?? "").trim();
            if (cn !== r.className) patch.className = cn;
            if (sn !== r.studentName) patch.studentName = sn;
            if (sub !== r.subject) patch.subject = sub;
            if (cat !== r.category) patch.category = cat;
            if (Object.keys(patch).length > 0) {
                await ctx.db.patch(r._id, patch);
                normalized++;
            }
        }
        return { normalized, total: all.length };
    },
});

// ── Reports ───────────────────────────────────────────────────────────────
export const getAllAbsences = query({
    args: {},
    handler: async (ctx) => {
        const school = await ctx.db.query("schools").first();
        if (!school) return [];
        const absences = await ctx.db.query("practicalAbsences")
            .withIndex("by_school", q => q.eq("schoolId", school._id))
            .collect();
        const students = await ctx.db.query("students").collect();
        const studentMap = new Map<string, any>();
        for (const s of students) studentMap.set(s.fullName.replace(/\s+/g, " ").trim(), s);
        return absences.map(a => {
            const student = a.studentId
                ? students.find(s => s._id === a.studentId)
                : studentMap.get(a.studentName.replace(/\s+/g, " ").trim());
            return {
                ...a,
                guardianPhone: student?.guardianPhone ?? null,
            };
        });
    },
});
