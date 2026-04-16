import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const updateAdminPin = mutation({
    args: { currentPin: v.string(), newPin: v.string() },
    handler: async (ctx, args) => {
        const school = await ctx.db.query("schools").first();
        if (!school) throw new Error("لا توجد مدرسة.");
        const stored = school.adminPin ?? "1234";
        if (args.currentPin !== stored) throw new Error("الرمز الحالي غير صحيح.");
        if (args.newPin.length < 4) throw new Error("يجب أن يكون الرمز 4 أرقام على الأقل.");
        await ctx.db.patch(school._id, { adminPin: args.newPin });
        return "تم تغيير الرمز.";
    },
});

export const verifyAdminPin = mutation({
    args: { pin: v.string() },
    handler: async (ctx, args) => {
        const school = await ctx.db.query("schools").first();
        const stored = school?.adminPin ?? "1234";
        return args.pin === stored;
    },
});

export const updateCurrentDate = mutation({
    args: { date: v.string() },
    handler: async (ctx, args) => {
        const school = await ctx.db.query("schools").first();
        if (!school) throw new Error("لا توجد مدرسة.");
        await ctx.db.patch(school._id, { currentDate: args.date });
        return "تم حفظ التاريخ.";
    },
});

export const updatePeriodsPerDay = mutation({
    args: { periodsPerDay: v.number() },
    handler: async (ctx, args) => {
        const school = await ctx.db.query("schools").first();
        if (!school) throw new Error("لا توجد مدرسة.");
        await ctx.db.patch(school._id, { periodsPerDay: Math.max(1, Math.min(10, args.periodsPerDay)) });
        return "تم الحفظ.";
    }
});

export const updateDailyAbsenceThreshold = mutation({
    args: { threshold: v.number() },
    handler: async (ctx, args) => {
        const school = await ctx.db.query("schools").first();
        if (!school) throw new Error("لا توجد مدرسة.");
        const clamped = Math.max(0, Math.min(10, Math.floor(args.threshold)));
        await ctx.db.patch(school._id, { dailyAbsenceThreshold: clamped });
        return "تم حفظ عتبة الغياب.";
    },
});

export const updateClass = mutation({
    args: {
        id: v.id("classes"),
        track: v.optional(v.string()),
        name: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const patch: any = {};
        if (args.track !== undefined) patch.track = args.track.trim() || undefined;
        if (args.name !== undefined) patch.name = args.name.trim();
        await ctx.db.patch(args.id, patch);
        return "تم التعديل.";
    }
});

export const updateSubject = mutation({
    args: {
        id: v.id("subjects"),
        name: v.string(),
        code: v.string(),
    },
    handler: async (ctx, args) => {
        await ctx.db.patch(args.id, {
            name: args.name.trim(),
            code: args.code.trim().toUpperCase(),
        });
        return "تم التعديل.";
    }
});

export const createSubject = mutation({
    args: {
        schoolId: v.id("schools"),
        name: v.string(),
        code: v.string(),
    },
    handler: async (ctx, args) => {
        // Check if a subject with the same code already exists for this school
        const existing = await ctx.db.query("subjects")
            .filter(q => q.and(
                q.eq(q.field("schoolId"), args.schoolId),
                q.eq(q.field("code"), args.code.trim().toUpperCase())
            ))
            .first();
        if (existing) throw new Error("مادة بهذا الكود موجودة بالفعل.");

        await ctx.db.insert("subjects", {
            schoolId: args.schoolId,
            name: args.name.trim(),
            code: args.code.trim().toUpperCase()
        });
        return "تم إضافة المادة.";
    }
});

export const createClass = mutation({
    args: {
        schoolId: v.id("schools"),
        name: v.string(),
        grade: v.number(),
        track: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const existing = await ctx.db.query("classes")
            .withIndex("by_school", q => q.eq("schoolId", args.schoolId))
            .filter(q => q.eq(q.field("name"), args.name.trim()))
            .first();
        if (existing) throw new Error("صف بهذا الاسم موجود بالفعل.");

        await ctx.db.insert("classes", {
            schoolId: args.schoolId,
            name: args.name.trim(),
            grade: args.grade,
            track: args.track?.trim() || undefined,
            isActive: true,
        });
        return "تم إضافة الصف.";
    }
});

export const deleteSubject = mutation({
    args: { id: v.id("subjects") },
    handler: async (ctx, args) => {
        await ctx.db.delete(args.id);
    }
});

export const deleteClass = mutation({
    args: { id: v.id("classes") },
    handler: async (ctx, args) => {
        await ctx.db.delete(args.id);
    }
});

export const toggleSubjectTarget = mutation({
    args: {
        subjectId: v.id("subjects"),
        targetString: v.string(),
    },
    handler: async (ctx, args) => {
        const subject = await ctx.db.get(args.subjectId);
        if (!subject) throw new Error("المادة غير موجودة.");
        
        let currentTargets = subject.targetClasses || [];
        
        if (currentTargets.includes(args.targetString)) {
            // Remove it
            currentTargets = currentTargets.filter(t => t !== args.targetString);
        } else {
            // Add it
            currentTargets = [...currentTargets, args.targetString];
        }
        
        await ctx.db.patch(args.subjectId, {
            targetClasses: currentTargets,
        });
        
        return "تم التحديث.";
    }
});
