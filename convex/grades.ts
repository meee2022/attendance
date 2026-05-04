import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

async function getSchool(ctx: any) {
    const sch = await ctx.db.query("schools").first();
    if (!sch) throw new Error("لا توجد مدرسة مُهيَّأة");
    return sch;
}

const DEFAULT_LABELS = ["تقييم 1", "تقييم 2", "تقييم 3", "تقييم 4", "تقييم 5"];

// ── Settings ──────────────────────────────────────────────────────────────
export const getSettings = query({
    args: {},
    handler: async (ctx) => {
        const school = await ctx.db.query("schools").first();
        if (!school) return null;
        const s = await ctx.db.query("gradeSettings")
            .withIndex("by_school", q => q.eq("schoolId", school._id))
            .first();
        return s ?? {
            schoolId: school._id,
            maxPerAssessment: 20,
            finalScoreOutOf: 5,
            passThreshold: 2.5,
            excellenceThreshold: 4.5,
            assessmentLabels: DEFAULT_LABELS,
        };
    },
});

export const updateSettings = mutation({
    args: {
        maxPerAssessment: v.optional(v.number()),
        finalScoreOutOf: v.optional(v.number()),
        passThreshold: v.optional(v.number()),
        excellenceThreshold: v.optional(v.number()),
        assessmentLabels: v.optional(v.array(v.string())),
    },
    handler: async (ctx, args) => {
        const school = await getSchool(ctx);
        const existing = await ctx.db.query("gradeSettings")
            .withIndex("by_school", q => q.eq("schoolId", school._id))
            .first();
        if (existing) {
            await ctx.db.patch(existing._id, args);
        } else {
            await ctx.db.insert("gradeSettings", {
                schoolId: school._id,
                maxPerAssessment: args.maxPerAssessment ?? 20,
                finalScoreOutOf: args.finalScoreOutOf ?? 5,
                passThreshold: args.passThreshold ?? 2.5,
                excellenceThreshold: args.excellenceThreshold ?? 4.5,
                assessmentLabels: args.assessmentLabels ?? DEFAULT_LABELS,
            });
        }
    },
});

// ── Queries ───────────────────────────────────────────────────────────────
export const getGradesByClassSubject = query({
    args: { className: v.string(), subjectName: v.string() },
    handler: async (ctx, args) => {
        const school = await ctx.db.query("schools").first();
        if (!school) return [];
        return ctx.db.query("studentGrades")
            .withIndex("by_class_subject", q =>
                q.eq("schoolId", school._id)
                 .eq("className", args.className)
                 .eq("subjectName", args.subjectName))
            .collect();
    },
});

export const getStudentGrades = query({
    args: { studentName: v.string() },
    handler: async (ctx, args) => {
        const school = await ctx.db.query("schools").first();
        if (!school) return [];
        return ctx.db.query("studentGrades")
            .withIndex("by_student", q => q.eq("schoolId", school._id).eq("studentName", args.studentName))
            .collect();
    },
});

export const getAllGrades = query({
    args: {},
    handler: async (ctx) => {
        const school = await ctx.db.query("schools").first();
        if (!school) return [];
        return ctx.db.query("studentGrades")
            .withIndex("by_school", q => q.eq("schoolId", school._id))
            .collect();
    },
});

export const getClassRoster = query({
    args: { className: v.string() },
    handler: async (ctx, args) => {
        const school = await ctx.db.query("schools").first();
        if (!school) return [];
        const all = await ctx.db.query("studentGrades")
            .withIndex("by_school", q => q.eq("schoolId", school._id))
            .collect();
        const filtered = all.filter(g => g.className === args.className);
        const seen = new Set<string>();
        const roster: { studentName: string; studentId?: string; grade: number; track: string }[] = [];
        for (const g of filtered) {
            if (seen.has(g.studentName)) continue;
            seen.add(g.studentName);
            roster.push({ studentName: g.studentName, studentId: g.studentId as any, grade: g.grade, track: g.track });
        }
        return roster.sort((a, b) => a.studentName.localeCompare(b.studentName, "ar"));
    },
});

export const getClassesAndSubjects = query({
    args: {},
    handler: async (ctx) => {
        const school = await ctx.db.query("schools").first();
        if (!school) return { classes: [], subjects: [], trackSubjects: [] };
        const all = await ctx.db.query("studentGrades")
            .withIndex("by_school", q => q.eq("schoolId", school._id))
            .collect();

        const classesArr: { className: string; grade: number; track: string }[] = [];
        const seenClass: string[] = [];
        const trackSubjects: { trackKey: string; grade: number; track: string; subjects: string[] }[] = [];
        const seenSubject: string[] = [];

        for (const g of all) {
            if (!g.className) continue;
            if (!seenClass.includes(g.className)) {
                seenClass.push(g.className);
                classesArr.push({ className: g.className, grade: g.grade ?? 0, track: g.track ?? "عام" });
            }
            const trackKey = `${g.grade ?? 0}-${g.track ?? "general"}`;
            let bucket = trackSubjects.find(t => t.trackKey === trackKey);
            if (!bucket) {
                bucket = { trackKey, grade: g.grade ?? 0, track: g.track ?? "عام", subjects: [] };
                trackSubjects.push(bucket);
            }
            if (g.subjectName && !bucket.subjects.includes(g.subjectName)) {
                bucket.subjects.push(g.subjectName);
            }
            if (g.subjectName && !seenSubject.includes(g.subjectName)) {
                seenSubject.push(g.subjectName);
            }
        }

        return {
            classes: classesArr.sort((a, b) => a.className < b.className ? -1 : 1),
            trackSubjects,
            subjects: seenSubject.sort(),
        };
    },
});

// ── Mutations ─────────────────────────────────────────────────────────────
async function validateAssessment(ctx: any, value: any): Promise<void> {
    if (value === undefined || value === null) return;
    if (value === "absent" || value === "excused") return;
    if (typeof value === "number") {
        const school = await ctx.db.query("schools").first();
        const settings = school
            ? await ctx.db.query("gradeSettings")
                .withIndex("by_school", (q: any) => q.eq("schoolId", school._id)).first()
            : null;
        const max = settings?.maxPerAssessment ?? 20;
        if (value < 0) throw new Error(`الدرجة لا يمكن أن تكون أقل من 0`);
        if (value > max) throw new Error(`الدرجة لا يمكن أن تتجاوز ${max}`);
        return;
    }
    throw new Error(`قيمة غير صالحة: ${value}`);
}

export const upsertGrade = mutation({
    args: {
        studentName: v.string(),
        className: v.string(),
        grade: v.number(),
        track: v.string(),
        subjectName: v.string(),
        a1: v.optional(v.union(v.number(), v.string(), v.null())),
        a2: v.optional(v.union(v.number(), v.string(), v.null())),
        a3: v.optional(v.union(v.number(), v.string(), v.null())),
        a4: v.optional(v.union(v.number(), v.string(), v.null())),
        a5: v.optional(v.union(v.number(), v.string(), v.null())),
        updatedBy: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        // Validate ranges
        await Promise.all([args.a1, args.a2, args.a3, args.a4, args.a5].map(v => validateAssessment(ctx, v)));

        const school = await getSchool(ctx);
        const all = await ctx.db.query("studentGrades")
            .withIndex("by_class_subject", q =>
                q.eq("schoolId", school._id)
                 .eq("className", args.className)
                 .eq("subjectName", args.subjectName))
            .collect();
        const existing = all.find(g => g.studentName === args.studentName);
        const data: any = {
            studentName: args.studentName.trim(),
            className: args.className,
            grade: args.grade,
            track: args.track,
            subjectName: args.subjectName,
            updatedAt: Date.now(),
            updatedBy: args.updatedBy,
        };
        // Only set fields that were provided
        if (args.a1 !== undefined) data.a1 = args.a1 ?? undefined;
        if (args.a2 !== undefined) data.a2 = args.a2 ?? undefined;
        if (args.a3 !== undefined) data.a3 = args.a3 ?? undefined;
        if (args.a4 !== undefined) data.a4 = args.a4 ?? undefined;
        if (args.a5 !== undefined) data.a5 = args.a5 ?? undefined;
        if (existing) {
            await ctx.db.patch(existing._id, data);
            return existing._id;
        } else {
            return await ctx.db.insert("studentGrades", { schoolId: school._id, ...data });
        }
    },
});

export const updateAssessment = mutation({
    args: {
        id: v.id("studentGrades"),
        which: v.union(v.literal("a1"), v.literal("a2"), v.literal("a3"), v.literal("a4"), v.literal("a5")),
        value: v.union(v.number(), v.string(), v.null()),
        updatedBy: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        await validateAssessment(ctx, args.value);
        const patch: any = { updatedAt: Date.now(), updatedBy: args.updatedBy };
        patch[args.which] = args.value ?? undefined;
        await ctx.db.patch(args.id, patch);
    },
});

export const deleteGrade = mutation({
    args: { id: v.id("studentGrades") },
    handler: async (ctx, args) => {
        await ctx.db.delete(args.id);
    },
});

// ── Bulk import from Excel ────────────────────────────────────────────────
export const bulkImportGrades = mutation({
    args: {
        records: v.array(v.object({
            studentName: v.string(),
            className: v.string(),
            grade: v.number(),
            track: v.string(),
            subjectName: v.string(),
            a1: v.optional(v.union(v.number(), v.string())),
            a2: v.optional(v.union(v.number(), v.string())),
            a3: v.optional(v.union(v.number(), v.string())),
            a4: v.optional(v.union(v.number(), v.string())),
            a5: v.optional(v.union(v.number(), v.string())),
        })),
        clearExisting: v.optional(v.boolean()),
        matchExistingStudents: v.optional(v.boolean()),
    },
    handler: async (ctx, args) => {
        const school = await getSchool(ctx);
        if (args.clearExisting) {
            const existing = await ctx.db.query("studentGrades")
                .withIndex("by_school", q => q.eq("schoolId", school._id))
                .collect();
            for (const r of existing) await ctx.db.delete(r._id);
        }

        // Build a lookup of existing students for matching
        let studentLookup = new Map<string, string>();
        if (args.matchExistingStudents) {
            const allStudents = await ctx.db.query("students").collect();
            for (const s of allStudents) {
                const norm = s.fullName.replace(/\s+/g, " ").trim();
                studentLookup.set(norm, s._id as any);
                // Also try without diacritics
                const noSpace = norm.replace(/\s+/g, "");
                studentLookup.set(noSpace, s._id as any);
            }
        }

        let inserted = 0, matched = 0;
        for (const rec of args.records) {
            const cleanName = rec.studentName.replace(/\s+/g, " ").trim();
            let studentId: any = undefined;
            if (args.matchExistingStudents) {
                studentId = studentLookup.get(cleanName) ?? studentLookup.get(cleanName.replace(/\s+/g, ""));
                if (studentId) matched++;
            }
            await ctx.db.insert("studentGrades", {
                schoolId: school._id,
                studentId,
                studentName: cleanName,
                className: rec.className,
                grade: rec.grade,
                track: rec.track,
                subjectName: rec.subjectName,
                a1: rec.a1,
                a2: rec.a2,
                a3: rec.a3,
                a4: rec.a4,
                a5: rec.a5,
                updatedAt: Date.now(),
                updatedBy: "import",
            });
            inserted++;
        }
        return { inserted, matched };
    },
});

// ── Get guardian phone for student (via name match) ───────────────────────
export const getGuardianPhone = query({
    args: { studentName: v.string() },
    handler: async (ctx, args) => {
        const allStudents = await ctx.db.query("students").collect();
        const cleanName = args.studentName.replace(/\s+/g, " ").trim();
        const match = allStudents.find(s =>
            s.fullName.replace(/\s+/g, " ").trim() === cleanName
        );
        return match?.guardianPhone ?? null;
    },
});
