import { staffMutation as mutation, memberQuery as query, adminMutation } from "./platformAccess";
import { v } from "convex/values";

// ── Feature toggle (hidden pages/sections) ────────────────────────────────
export const getHiddenFeatures = query({
    args: {},
    handler: async (ctx) => {
        const school = await ctx.db.query("schools").first();
        const role = (ctx as any).platformSession.role;
        const restricted = role === "admin" || role === "deputy" ? [] : ["/messages", "/surveys", ...(role === "teacher" ? ["/supervision"] : [])];
        return [...new Set([...(school?.hiddenFeatures ?? []), ...restricted])];
    },
});

export const teacherAccessStatus = query({
    args: {}, handler: async ctx => {
        if ((ctx as any).platformSession.role !== "admin") throw new Error("متاح لمسؤول المنصة فقط");
        const school = await ctx.db.query("schools").first();
        return { enabled: !!school?.teacherPin };
    },
});
export const setTeacherAccess = adminMutation({
    args: { enabled: v.boolean(), newPin: v.optional(v.string()) },
    handler: async (ctx, args) => {
        const school = await ctx.db.query("schools").first();
        if (!school) throw new Error("المدرسة غير مهيأة");
        if (args.enabled && (!args.newPin || !/^\d{6,12}$/.test(args.newPin))) throw new Error("اختر رمزًا من 6 إلى 12 رقمًا");
        if (args.enabled && [school.adminPin, school.deputyPin, school.coordinatorPin].includes(args.newPin!)) throw new Error("اختر رمزًا مختلفًا عن رموز الإدارة والإشراف");
        await ctx.db.patch(school._id, { teacherPin: args.enabled ? args.newPin : undefined });
        const sessions = await ctx.db.query("supervisionSessions").collect();
        for (const session of sessions) if (session.schoolId === school._id && session.role === "teacher") await ctx.db.delete(session._id);
        return null;
    },
});

export const toggleFeature = mutation({
    args: { featureKey: v.string(), hidden: v.boolean() },
    handler: async (ctx, args) => {
        const school = await ctx.db.query("schools").first();
        if (!school) throw new Error("لا توجد مدرسة.");
        const current = school.hiddenFeatures ?? [];
        let next: string[];
        if (args.hidden) {
            next = current.includes(args.featureKey) ? current : [...current, args.featureKey];
        } else {
            next = current.filter(k => k !== args.featureKey);
        }
        await ctx.db.patch(school._id, { hiddenFeatures: next });
        return next;
    },
});

export const updateAdminPin = adminMutation({
    args: { currentPin: v.string(), newPin: v.string() },
    handler: async (ctx, args) => {
        const school = await ctx.db.query("schools").first();
        if (!school) throw new Error("لا توجد مدرسة.");
        const stored = school.adminPin;
        if (args.currentPin !== stored) throw new Error("الرمز الحالي غير صحيح.");
        if (args.newPin.length < 4) throw new Error("يجب أن يكون الرمز 4 أرقام على الأقل.");
        await ctx.db.patch(school._id, { adminPin: args.newPin });
        return "تم تغيير الرمز.";
    },
});

export const verifyAdminPin = adminMutation({
    args: { pin: v.string() },
    handler: async (ctx, args) => {
        const school = await ctx.db.query("schools").first();
        const stored = school?.adminPin;
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
        isActive: v.optional(v.boolean()),
    },
    handler: async (ctx, args) => {
        const patch: any = {};
        if (args.track !== undefined) patch.track = args.track.trim() || undefined;
        if (args.name !== undefined) patch.name = args.name.trim();
        if (args.isActive !== undefined) patch.isActive = args.isActive;
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
        // Deleting a class that still holds students would orphan them — the
        // class would vanish from every screen while the students stayed in the
        // table pointing at a missing id.
        const students = await ctx.db.query("students")
            .withIndex("by_class", q => q.eq("classId", args.id))
            .take(1);
        if (students.length > 0) {
            throw new Error("لا يمكن حذف صف يحتوي على طلاب. انقل الطلاب أولاً أو ألغِ تفعيل الصف.");
        }
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
