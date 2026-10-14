import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

// The guardian's side of «رأي المعلمين في الطلاب» (studentOpinions.ts): a
// private token link, no sign-in. It shows only a published round, only to
// a link not yet expired, and only the subjects and what was written — no
// teacher names, contact details or identity numbers.

// ── The guardian's report ────────────────────────────────────────────────
async function linkOf(ctx: any, token: string) {
    if (!/^[a-f0-9]{48}$/.test(token)) return null;
    const link = await ctx.db.query("guardianLinks").withIndex("by_token", (q: any) => q.eq("token", token)).first();
    if (!link || link.expiresAt < Date.now()) return null;
    const round = await ctx.db.get(link.roundId);
    if (!round?.published) return null;
    return { link, round };
}

// What the guardian sees: the subjects and what each teacher wrote — not the
// teachers' names, nor any contact or identity number
export const report = query({ args: { token: v.string() }, handler: async (ctx, args) => {
    const found = await linkOf(ctx, args.token);
    if (!found) return null;
    const student: any = await ctx.db.get(found.link.studentId);
    if (!student) return null;
    const cls: any = await ctx.db.get(student.classId);
    const school: any = await ctx.db.get(found.round.schoolId);
    const rows = await ctx.db.query("studentOpinions")
        .withIndex("by_round_student", q => q.eq("roundId", found.round._id).eq("studentId", student._id)).collect();
    return {
        school: school?.name ?? "",
        title: found.round.title,
        studentName: student.fullName,
        className: cls?.name ?? "",
        subjects: rows
            .filter(o => o.academic != null || o.behavior != null || o.distraction != null || o.advice)
            .map(o => ({ subject: o.subjectName, academic: o.academic ?? null, behavior: o.behavior ?? null, distraction: o.distraction ?? null, advice: o.advice ?? "" }))
            .sort((a, b) => a.subject.localeCompare(b.subject, "ar")),
    };
} });

export const opened = mutation({ args: { token: v.string() }, handler: async (ctx, args) => {
    const found = await linkOf(ctx, args.token);
    if (!found) return;
    const now = Date.now();
    await ctx.db.patch(found.link._id, { openCount: found.link.openCount + 1, lastOpenedAt: now, firstOpenedAt: found.link.firstOpenedAt ?? now });
} });
