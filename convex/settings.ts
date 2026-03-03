import { mutation } from "./_generated/server";
import { v } from "convex/values";

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
