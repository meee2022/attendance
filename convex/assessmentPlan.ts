import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// The school publishes one grid for the whole term: subjects down the side,
// the fourteen weeks across the top, a slash where a short assessment falls.
// Storing it here lets every other view answer «هل نحن متأخرون؟» — a question
// the marks alone cannot answer, because they never say when a mark was due.
//
// A row with no grade applies to every grade. A subject whose sciences run on
// a different rhythm per grade gets its own rows, and those win for that grade.

async function getSchool(ctx: any) {
    const sch = await ctx.db.query("schools").first();
    if (!sch) throw new Error("لا توجد مدرسة مُهيَّأة");
    return sch;
}

export const today = () => new Date().toISOString().slice(0, 10);

export async function planContext(ctx: any, schoolId: any) {
    const weeks = (await ctx.db.query("assessmentWeeks")
        .withIndex("by_school", (q: any) => q.eq("schoolId", schoolId))
        .collect())
        .sort((a: any, b: any) => a.week - b.week);

    const entries = await ctx.db.query("assessmentPlan")
        .withIndex("by_school", (q: any) => q.eq("schoolId", schoolId))
        .collect();

    return { weeks, entries };
}

// The weeks planned for one subject in one grade: its own rows when it has
// them, otherwise the rows that cover every grade.
export function weeksFor(entries: any[], subjectName: string, grade?: number): number[] {
    const mine = entries.filter(e => e.subjectName === subjectName);
    const forGrade = grade === undefined ? [] : mine.filter(e => e.grade === grade);
    const source = forGrade.length ? forGrade : mine.filter(e => e.grade === undefined);
    return [...new Set(source.map(e => e.week))].sort((a, b) => a - b);
}

// How many short assessments should already be recorded, counting only weeks
// that have finished. Capped by the number of slots the grid actually has.
export function dueByNow(
    weeks: any[], entries: any[], subjectName: string, grade: number | undefined,
    slots: number, date = today(),
): number {
    const byWeek = new Map(weeks.map((w: any) => [w.week, w]));
    const done = weeksFor(entries, subjectName, grade)
        .filter(w => {
            const week = byWeek.get(w);
            return week ? week.endDate < date : false;
        });
    return Math.min(done.length, slots);
}

export const getPlan = query({
    args: {},
    handler: async (ctx) => {
        const school = await ctx.db.query("schools").first();
        if (!school) return null;

        const { weeks, entries } = await planContext(ctx, school._id);

        const subjects = (await ctx.db.query("subjects")
            .filter((q: any) => q.eq(q.field("schoolId"), school._id))
            .collect())
            .map((s: any) => ({ name: s.name, targetClasses: s.targetClasses ?? [] }));

        // Subjects that only exist in the imported grid still deserve a row
        const names = new Set(subjects.map(s => s.name));
        for (const e of entries) if (!names.has(e.subjectName)) {
            names.add(e.subjectName);
            subjects.push({ name: e.subjectName, targetClasses: [] });
        }

        const now = today();
        const current = weeks.find((w: any) => w.startDate <= now && now <= w.endDate)
            ?? weeks.find((w: any) => now < w.startDate);

        return {
            schoolName: school.name,
            weeks,
            entries: entries.map((e: any) => ({
                subjectName: e.subjectName, grade: e.grade, week: e.week,
            })),
            subjects: subjects.sort((a, b) => a.name.localeCompare(b.name, "ar")),
            today: now,
            currentWeek: current ? current.week : null,
            currentWeekLabel: current ? current.label : null,
            currentWeekNote: current?.note ?? null,
            isBeforeCurrent: current ? now < current.startDate : false,
        };
    },
});

// One click in the grid: mark or unmark a week for a subject (optionally for a
// single grade).
export const toggleCell = mutation({
    args: { subjectName: v.string(), grade: v.optional(v.number()), week: v.number() },
    handler: async (ctx, args) => {
        const school = await getSchool(ctx);
        const existing = (await ctx.db.query("assessmentPlan")
            .withIndex("by_subject", q => q.eq("schoolId", school._id).eq("subjectName", args.subjectName))
            .collect())
            .find(e => e.week === args.week && e.grade === args.grade);

        if (existing) {
            await ctx.db.delete(existing._id);
            return { marked: false };
        }
        await ctx.db.insert("assessmentPlan", {
            schoolId: school._id,
            subjectName: args.subjectName,
            grade: args.grade,
            week: args.week,
        });
        return { marked: true };
    },
});

// Copy the all-grades rows of a subject onto one grade, so the grid can then be
// tuned for that grade without touching the others.
export const splitSubjectByGrade = mutation({
    args: { subjectName: v.string(), grade: v.number() },
    handler: async (ctx, args) => {
        const school = await getSchool(ctx);
        const mine = await ctx.db.query("assessmentPlan")
            .withIndex("by_subject", q => q.eq("schoolId", school._id).eq("subjectName", args.subjectName))
            .collect();

        if (mine.some(e => e.grade === args.grade)) return { copied: 0 };

        const shared = mine.filter(e => e.grade === undefined);
        for (const e of shared) {
            await ctx.db.insert("assessmentPlan", {
                schoolId: school._id,
                subjectName: args.subjectName,
                grade: args.grade,
                week: e.week,
            });
        }
        return { copied: shared.length };
    },
});

export const clearSubjectGrade = mutation({
    args: { subjectName: v.string(), grade: v.number() },
    handler: async (ctx, args) => {
        const school = await getSchool(ctx);
        const mine = (await ctx.db.query("assessmentPlan")
            .withIndex("by_subject", q => q.eq("schoolId", school._id).eq("subjectName", args.subjectName))
            .collect())
            .filter(e => e.grade === args.grade);
        for (const e of mine) await ctx.db.delete(e._id);
        return { removed: mine.length };
    },
});

export const setWeek = mutation({
    args: {
        week: v.number(),
        label: v.optional(v.string()),
        startDate: v.optional(v.string()),
        endDate: v.optional(v.string()),
        note: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const school = await getSchool(ctx);
        const existing = await ctx.db.query("assessmentWeeks")
            .withIndex("by_week", q => q.eq("schoolId", school._id).eq("week", args.week))
            .first();
        if (!existing) throw new Error("الأسبوع غير موجود");
        const { week, ...patch } = args;
        await ctx.db.patch(existing._id, patch);
    },
});

// Replaces the whole grid — the import path for the school's published sheet.
export const importPlan = mutation({
    args: {
        weeks: v.array(v.object({
            week: v.number(),
            label: v.string(),
            startDate: v.string(),
            endDate: v.string(),
            note: v.optional(v.string()),
        })),
        rows: v.array(v.object({
            subjectName: v.string(),
            grade: v.optional(v.number()),
            weeks: v.array(v.number()),
        })),
    },
    handler: async (ctx, args) => {
        const school = await getSchool(ctx);

        for (const old of await ctx.db.query("assessmentWeeks")
            .withIndex("by_school", q => q.eq("schoolId", school._id)).collect()) {
            await ctx.db.delete(old._id);
        }
        for (const old of await ctx.db.query("assessmentPlan")
            .withIndex("by_school", q => q.eq("schoolId", school._id)).collect()) {
            await ctx.db.delete(old._id);
        }

        for (const w of args.weeks) {
            await ctx.db.insert("assessmentWeeks", { schoolId: school._id, ...w });
        }
        let cells = 0;
        for (const row of args.rows) {
            for (const week of row.weeks) {
                await ctx.db.insert("assessmentPlan", {
                    schoolId: school._id,
                    subjectName: row.subjectName,
                    grade: row.grade,
                    week,
                });
                cells++;
            }
        }
        return { weeks: args.weeks.length, subjects: args.rows.length, cells };
    },
});
