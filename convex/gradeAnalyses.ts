import { ConvexError, v } from "convex/values";
import { staffQuery, staffMutation } from "./platformAccess";

// Ministry grade sheets kept for analysis — the deputy's and the admin's only.
// The sheet is read in the browser (src/lib/gradeSheet.ts); the server checks
// its shape before keeping it.

const MARK = (x: any) => x === null || x === "غائب" || x === "محروم" || (typeof x === "number" && Number.isFinite(x) && x >= 0 && x <= 1000);

export function validateSheet(raw: string) {
    if (new TextEncoder().encode(raw).length > 900_000) throw new ConvexError("الملف كبير؛ قسّمه إلى ملفات أصغر");
    let s: any;
    try { s = JSON.parse(raw); } catch { throw new ConvexError("بيانات الكشف غير صالحة"); }
    const str = (x: any, n: number) => typeof x === "string" && x.length <= n;
    const ok = s && str(s.title, 200) && s.title.trim() && str(s.period, 200) && str(s.fileName, 255)
        && Number.isInteger(s.grade) && s.grade >= 0 && s.grade <= 12
        && Array.isArray(s.components) && s.components.length >= 1 && s.components.length <= 6 && s.components.every((c: any) => str(c, 100))
        && Array.isArray(s.maxes) && s.maxes.length === s.components.length && s.maxes.every((m: any) => typeof m === "number" && m >= 0 && m <= 1000)
        && Array.isArray(s.subjects) && s.subjects.length >= 1 && s.subjects.length <= 60 && s.subjects.every((x: any) => str(x, 120) && x.trim())
        && Array.isArray(s.students) && s.students.length >= 1 && s.students.length <= 3000
        && s.students.every((st: any) => st && str(st.id, 40) && str(st.name, 200) && st.name.trim() && str(st.cls, 40)
            && Array.isArray(st.marks) && st.marks.length === s.subjects.length
            && st.marks.every((m: any) => Array.isArray(m) && m.length === s.components.length && m.every(MARK)));
    if (!ok) throw new ConvexError("راجع عناوين المواد ودرجات الطلاب في الملف");
    return {
        title: s.title.trim(), period: s.period.trim(), fileName: s.fileName, grade: s.grade,
        components: s.components, maxes: s.maxes, subjects: s.subjects.map((x: string) => x.trim()),
        students: s.students.map((st: any) => ({ id: st.id, name: st.name.trim(), cls: st.cls, marks: st.marks })),
    };
}

async function owned(ctx: any, id: any) {
    const row = await ctx.db.get(id);
    if (!row || row.schoolId !== ctx.platformSession.schoolId) throw new ConvexError("الكشف غير متاح");
    return row;
}

export const list = staffQuery({ args: {}, handler: async (ctx) => {
    const rows = await ctx.db.query("gradeAnalyses").withIndex("by_school", q => q.eq("schoolId", (ctx as any).platformSession.schoolId)).collect();
    return rows.map(({ data, ...row }) => row).sort((a, b) => b.grade - a.grade || b.updatedAt - a.updatedAt);
} });

export const get = staffQuery({ args: { id: v.id("gradeAnalyses") }, handler: async (ctx, args) => owned(ctx, args.id) });

export const save = staffMutation({ args: { id: v.optional(v.id("gradeAnalyses")), expectedUpdatedAt: v.optional(v.number()), data: v.string() }, handler: async (ctx, args) => {
    const s = validateSheet(args.data);
    let previous: any;
    if (args.id) {
        previous = await owned(ctx, args.id);
        if (previous.updatedAt !== args.expectedUpdatedAt) throw new ConvexError("تغيّر الكشف؛ أعد فتحه قبل الحفظ");
    }
    const value = {
        title: s.title, fileName: s.fileName, period: s.period, grade: s.grade, data: JSON.stringify(s),
        studentCount: s.students.length, subjectCount: s.subjects.length,
        updatedAt: Math.max(Date.now(), (previous?.updatedAt ?? 0) + 1), updatedBy: (ctx as any).platformSession.name,
    };
    if (args.id) { await ctx.db.patch(args.id, value); return args.id; }
    return ctx.db.insert("gradeAnalyses", { ...value, schoolId: (ctx as any).platformSession.schoolId });
} });

export const remove = staffMutation({ args: { id: v.id("gradeAnalyses") }, handler: async (ctx, args) => {
    await owned(ctx, args.id);
    await ctx.db.delete(args.id);
} });
