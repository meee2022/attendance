import { memberMutation } from "./platformAccess";
import { v } from "convex/values";

const value = v.union(v.number(), v.string(), v.null());
export const save = memberMutation({
    args: {
        mode: v.union(v.literal("grades"), v.literal("diagnostics")),
        className: v.string(), subjectName: v.optional(v.string()), testId: v.optional(v.id("diagnosticTests")),
        overwrite: v.boolean(),
        rows: v.array(v.object({ studentId: v.id("students"), expectedAbsent: v.optional(v.boolean()), cells: v.array(v.object({ key: v.string(), value, expected: value, max: v.number() })) })),
    },
    handler: async (ctx, args) => {
        const school = await ctx.db.query("schools").first();
        if (!school) throw new Error("المدرسة غير متاحة");
        const cls = (await ctx.db.query("classes").withIndex("by_school", q => q.eq("schoolId", school._id)).collect()).find(c => c.name === args.className && c.isActive !== false);
        if (!cls) throw new Error("الفصل غير متاح");
        if (!args.rows.length || args.rows.length > 500 || new Set(args.rows.map(r => r.studentId)).size !== args.rows.length) throw new Error("قائمة الطلاب فارغة أو مكررة أو أكبر من 500 طالب");
        const students = (await ctx.db.query("students").withIndex("by_class", q => q.eq("classId", cls._id)).collect()).filter(s => s.isActive !== false);
        const test = args.testId ? await ctx.db.get(args.testId) : null;
        if (args.mode === "diagnostics" && (!test || test.schoolId !== school._id || !test.isActive || !test.classNames.includes(cls.name))) throw new Error("الاختبار غير متاح لهذا الفصل");
        if (args.mode === "grades" && !args.subjectName?.trim()) throw new Error("اختر المادة");
        const settings = await ctx.db.query("gradeSettings").withIndex("by_school", q => q.eq("schoolId", school._id)).first();
        // a short assessment may be out of more than the default on this sheet
        const sheetMax: any = args.mode === "grades" ? await ctx.db.query("assessmentMaxes").withIndex("by_class_subject", q => q.eq("schoolId", school._id).eq("className", cls.name).eq("subjectName", args.subjectName!)).first() : null;
        const saved: any[] = args.mode === "diagnostics"
            ? await ctx.db.query("diagnosticScores").withIndex("by_test_class", q => q.eq("testId", test!._id).eq("className", cls.name)).collect()
            : await ctx.db.query("studentGrades").withIndex("by_class_subject", q => q.eq("schoolId", school._id).eq("className", cls.name).eq("subjectName", args.subjectName!)).collect();
        let changed = 0, skipped = 0;
        for (const row of args.rows) {
            const student = students.find(s => s._id === row.studentId);
            if (!student || !row.cells.length || row.cells.length > 200 || new Set(row.cells.map(c => c.key)).size !== row.cells.length) throw new Error("طالب غير متاح أو أعمدة مكررة");
            if (args.mode === "grades" && students.filter(s => s.fullName.trim() === student.fullName.trim()).length !== 1) throw new Error("اسم الطالب مكرر في الفصل؛ يلزم معالجة التكرار أولًا");
            const matches = saved.filter(s => args.mode === "diagnostics" ? s.studentId === row.studentId : s.studentName.trim() === student.fullName.trim());
            if (matches.length > 1) throw new Error("توجد سجلات درجات مكررة؛ راجع الإدارة");
            const existing = matches[0];
            if (args.mode === "diagnostics" && Boolean(existing?.isAbsent) !== Boolean(row.expectedAbsent)) throw new Error("تغيرت حالة حضور طالب بعد المعاينة؛ أعد المعاينة");
            const original = args.mode === "diagnostics" ? JSON.parse(existing?.scores || "{}") : existing || {};
            const patch: Record<string, number | string> = {};
            for (const cell of row.cells) {
                const q = test?.questions.find(x => String(x.n) === cell.key);
                const max = args.mode === "diagnostics" ? q?.maxMark : sheetMax?.[cell.key] ?? settings?.maxPerAssessment ?? 20;
                if (max === undefined || !Number.isFinite(max) || max <= 0 || cell.max !== max || args.mode === "grades" && !/^a[1-5]$/.test(cell.key)) throw new Error("تغير توزيع الدرجات أو العمود غير صحيح؛ أعد المعاينة");
                if (cell.value === null || typeof cell.value === "number" && (!Number.isFinite(cell.value) || cell.value < 0 || cell.value > max) || typeof cell.value === "string" && (args.mode !== "grades" || !["absent", "excused"].includes(cell.value))) throw new Error("توجد درجة غير صالحة أو تتجاوز الدرجة النهائية");
                if ((original[cell.key] ?? null) !== cell.expected) throw new Error("تغيرت درجات طالب بعد المعاينة؛ أعد المعاينة قبل الحفظ");
                if (!args.overwrite && (original[cell.key] != null || existing?.isAbsent)) { skipped++; continue; }
                patch[cell.key] = cell.value;
                changed++;
            }
            if (!Object.keys(patch).length) continue;
            if (args.mode === "diagnostics") {
                const data = { scores: JSON.stringify({ ...original, ...patch }), isAbsent: false, updatedAt: Date.now() };
                if (existing) await ctx.db.patch(existing._id, data);
                else await ctx.db.insert("diagnosticScores", { schoolId: school._id, testId: test!._id, studentId: student._id, studentName: student.fullName, className: cls.name, ...data });
            } else {
                const data = { ...patch, updatedAt: Date.now(), updatedBy: (ctx as any).platformSession.name };
                if (existing) await ctx.db.patch(existing._id, data);
                else await ctx.db.insert("studentGrades", { schoolId: school._id, studentName: student.fullName, className: cls.name, grade: cls.grade, track: cls.track ?? "عام", subjectName: args.subjectName!, ...data });
            }
        }
        return { changed, skipped, students: args.rows.length };
    },
});
