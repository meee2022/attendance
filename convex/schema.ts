import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
    schools: defineTable({
        name: v.string(),
        code: v.string(),
        logoUrl: v.optional(v.string()),
        createdAt: v.string(),
        periodsPerDay: v.optional(v.number()),
        currentDate: v.optional(v.string()),
        adminPin: v.optional(v.string()), // default "1234"
        dailyAbsenceThreshold: v.optional(v.number()), // max absent periods still = present
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
        isExempt: v.optional(v.boolean()),
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
        targetClasses: v.optional(v.array(v.string())), // e.g. ["10-عام", "11-علمي"]
    }),
    periods: defineTable({
        schoolId: v.id("schools"),
        classId: v.id("classes"),
        subjectId: v.id("subjects"),
        teacherId: v.optional(v.id("teachers")),
        date: v.string(), // YYYY-MM-DD local logic mostly
        periodNumber: v.number(),
        status: v.string(), // "open", "uploaded", "finalized"
    }).index("by_class_date", ["classId", "date"])
      .index("by_class", ["classId"])
      .index("by_school_date", ["schoolId", "date"]),
    attendance: defineTable({
        schoolId: v.id("schools"),
        classId: v.id("classes"),
        studentId: v.optional(v.id("students")),
        periodId: v.id("periods"),
        status: v.string(), // "present", "absent", "unverified"
        source: v.string(), // "upload", "manual"
        notes: v.optional(v.string()), // For unverified names
    }).index("by_period", ["periodId"]).index("by_student", ["studentId"]),
    messageTemplates: defineTable({
        schoolId: v.id("schools"),
        name: v.string(),
        type: v.union(v.literal("present"), v.literal("absent")),
        body: v.string(),
        isActive: v.boolean(),
    }).index("by_school", ["schoolId"]),
    assessments: defineTable({
        schoolId: v.id("schools"),
        classId: v.id("classes"),
        studentId: v.id("students"),
        subjectId: v.id("subjects"),
        isCompleted: v.boolean(),
    }).index("by_school", ["schoolId"])
      .index("by_class", ["classId"])
      .index("by_student", ["studentId"])
      .index("by_subject", ["subjectId"])
      .index("by_class_subject_student", ["classId", "subjectId", "studentId"]),

    surveys: defineTable({
        schoolId: v.id("schools"),
        title: v.string(),
        description: v.optional(v.string()),
        academicYear: v.string(),
        ratingLabels: v.array(v.string()),
        sections: v.array(v.object({
            id: v.string(),
            title: v.string(),
            color: v.optional(v.string()),
            questions: v.array(v.object({
                id: v.string(),
                text: v.string(),
                type: v.union(v.literal("rating"), v.literal("multicheck"), v.literal("textarea")),
                options: v.optional(v.array(v.string())),
            })),
        })),
        isActive: v.boolean(),
    }).index("by_school", ["schoolId"]),

    surveyRespondents: defineTable({
        schoolId: v.id("schools"),
        surveyId: v.id("surveys"),
        name: v.string(),
        department: v.optional(v.string()),
        hasResponded: v.boolean(),
        isParticipating: v.optional(v.boolean()), // default true; if false, hidden from teacher view
    }).index("by_survey", ["surveyId"])
      .index("by_school", ["schoolId"]),

    surveyResponses: defineTable({
        schoolId: v.id("schools"),
        surveyId: v.id("surveys"),
        respondentId: v.id("surveyRespondents"),
        teacherName: v.string(),
        department: v.optional(v.string()),
        subject: v.optional(v.string()),
        yearsExperience: v.optional(v.string()),
        qualification: v.optional(v.string()),
        responseDate: v.optional(v.string()),
        answers: v.string(), // JSON: { [questionId]: number | string[] | string }
        submittedAt: v.number(),
    }).index("by_survey", ["surveyId"])
      .index("by_respondent", ["respondentId"])
      .index("by_school", ["schoolId"]),
});
