import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
    schools: defineTable({
        name: v.string(),
        code: v.string(),
        logoUrl: v.optional(v.string()),
        createdAt: v.string(), // ISO date
    }),
    classes: defineTable({
        schoolId: v.id("schools"),
        name: v.string(), // e.g., "10-1"
        grade: v.number(), // e.g., 10, 11, 12
        track: v.optional(v.string()), // e.g., "علمي", "أدبي"
        isActive: v.boolean(),
    }).index("by_school", ["schoolId"]),
    students: defineTable({
        schoolId: v.id("schools"),
        classId: v.id("classes"),
        fullName: v.string(),
        nationalId: v.optional(v.string()),
        guardianPhone: v.optional(v.string()),
        isActive: v.boolean(),
    }).index("by_class", ["classId"]).index("by_school", ["schoolId"]),
    teachers: defineTable({
        schoolId: v.id("schools"),
        fullName: v.string(),
        email: v.string(),
        phone: v.optional(v.string()),
        isActive: v.boolean(),
    }),
    subjects: defineTable({
        schoolId: v.id("schools"),
        name: v.string(),
        code: v.string(),
    }),
    periods: defineTable({
        schoolId: v.id("schools"),
        classId: v.id("classes"),
        subjectId: v.id("subjects"),
        teacherId: v.optional(v.id("teachers")),
        date: v.string(), // YYYY-MM-DD local logic mostly
        periodNumber: v.number(),
        status: v.string(), // "open", "uploaded", "finalized"
    }).index("by_class_date", ["classId", "date"]),
    attendance: defineTable({
        schoolId: v.id("schools"),
        classId: v.id("classes"),
        studentId: v.optional(v.id("students")),
        periodId: v.id("periods"),
        status: v.string(), // "present", "absent", "unverified"
        source: v.string(), // "upload", "manual"
        notes: v.optional(v.string()), // For unverified names
    }).index("by_period", ["periodId"]).index("by_student", ["studentId"]),
});
