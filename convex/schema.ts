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
        // Supervision role PINs
        coordinatorPin: v.optional(v.string()), // افتراضي "1111"
        supervisorPin: v.optional(v.string()),  // افتراضي "2222"
        deputyPin: v.optional(v.string()),      // افتراضي "3333"
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

    // ── Classroom Supervision (الإشراف الصفي) ──────────────────────────────
    supervisionCriteria: defineTable({
        schoolId: v.id("schools"),
        domain: v.union(
            v.literal("planning"),       // التخطيط
            v.literal("execution"),      // تنفيذ الدرس
            v.literal("evaluation"),     // التقويم
            v.literal("management"),     // الإدارة الصفية
        ),
        text: v.string(),
        order: v.number(),
        isActive: v.boolean(),
    }).index("by_school", ["schoolId"])
      .index("by_school_domain", ["schoolId", "domain"]),

    supervisors: defineTable({
        schoolId: v.id("schools"),
        fullName: v.string(),
        role: v.union(
            v.literal("coordinator"),   // المنسق
            v.literal("supervisor"),    // الموجه
            v.literal("deputy"),        // النائب الأكاديمي
        ),
        subjects: v.array(v.string()),  // قائمة المواد التي يغطيها
        email: v.optional(v.string()),
        pin: v.optional(v.string()),    // PIN خاص بالزائر (اختياري - افتراضياً موحد لكل دور)
        isActive: v.boolean(),
    }).index("by_school", ["schoolId"])
      .index("by_role", ["schoolId", "role"]),

    // ── نظام رصد الدرجات (Grade Tracking) ─────────────────────────────────
    // كل صف من الجدول = درجات طالب واحد في مادة واحدة (5 تقييمات)
    studentGrades: defineTable({
        schoolId: v.id("schools"),
        studentId: v.optional(v.id("students")),  // مرتبط بالطالب الأصلي إن وجد
        studentName: v.string(),                  // الاسم (للأشخاص غير المرتبطين)
        className: v.string(),                    // اسم الفصل (مثل 10-1)
        grade: v.number(),                        // 10 أو 11
        track: v.string(),                        // عام · علمي · أدبي · تكنولوجي
        subjectName: v.string(),                  // اسم المادة
        // 5 تقييمات: number | "absent" | "excused" | null
        a1: v.optional(v.union(v.number(), v.string())),
        a2: v.optional(v.union(v.number(), v.string())),
        a3: v.optional(v.union(v.number(), v.string())),
        a4: v.optional(v.union(v.number(), v.string())),
        a5: v.optional(v.union(v.number(), v.string())),
        notes: v.optional(v.string()),
        updatedAt: v.number(),
        updatedBy: v.optional(v.string()),
    }).index("by_school", ["schoolId"])
      .index("by_class_subject", ["schoolId", "className", "subjectName"])
      .index("by_student", ["schoolId", "studentName"])
      .index("by_subject", ["schoolId", "subjectName"]),

    // إعدادات نظام الدرجات
    gradeSettings: defineTable({
        schoolId: v.id("schools"),
        maxPerAssessment: v.number(),       // افتراضي 20
        finalScoreOutOf: v.number(),        // افتراضي 5
        passThreshold: v.number(),          // حد النجاح من finalScoreOutOf (افتراضي 2.5)
        excellenceThreshold: v.number(),    // حد التميز (افتراضي 4.5)
        assessmentLabels: v.array(v.string()), // ["تقييم 1", ..., "تقييم 5"]
    }).index("by_school", ["schoolId"]),

    // قاعدة بيانات المعلمين الموحدة
    schoolTeachers: defineTable({
        schoolId: v.id("schools"),
        fullName: v.string(),
        department: v.string(),
        email: v.optional(v.string()),
        phone: v.optional(v.string()),
        teachingClasses: v.optional(v.array(v.string())),
        isActive: v.boolean(),
    }).index("by_school", ["schoolId"])
      .index("by_dept", ["schoolId", "department"]),

    // سجل المراجعات (audit log)
    supervisionAuditLog: defineTable({
        schoolId: v.id("schools"),
        visitId: v.optional(v.id("supervisionVisits")),
        action: v.string(),
        actorRole: v.optional(v.string()),
        actorName: v.optional(v.string()),
        details: v.optional(v.string()),
        timestamp: v.number(),
    }).index("by_school", ["schoolId"])
      .index("by_visit", ["visitId"]),

    // خطط تطوير المعلم
    teacherImprovementPlans: defineTable({
        schoolId: v.id("schools"),
        teacherName: v.string(),
        relatedVisitId: v.optional(v.id("supervisionVisits")),
        weakAreas: v.array(v.string()),
        actionItems: v.array(v.string()),
        targetDate: v.optional(v.string()),
        status: v.union(v.literal("active"), v.literal("achieved"), v.literal("cancelled")),
        createdAt: v.number(),
        updatedAt: v.number(),
    }).index("by_school", ["schoolId"])
      .index("by_teacher", ["schoolId", "teacherName"]),

    supervisionVisits: defineTable({
        schoolId: v.id("schools"),
        // الزائر
        visitorRole: v.union(v.literal("coordinator"), v.literal("supervisor"), v.literal("deputy")),
        visitorId: v.optional(v.id("supervisors")),
        visitorName: v.string(),
        // المعلم المُقَيَّم
        teacherName: v.string(),
        teacherDepartment: v.string(),
        // تفاصيل الحصة
        subjectName: v.string(),
        className: v.string(),       // e.g. "حادي عشر 1"
        lessonTopic: v.string(),
        visitDate: v.string(),       // YYYY-MM-DD
        followUpType: v.union(v.literal("full"), v.literal("partial")),
        visitNumber: v.number(),     // رقم الزيارة
        // التقييمات: { [criterionId]: 0|1|2|3|"not_measured" }
        ratings: v.string(),         // JSON
        // المعدل
        averageScore: v.number(),    // 0..1
        domainAverages: v.string(),  // JSON { planning, execution, evaluation, management }
        // التوصيات
        planningRec: v.optional(v.string()),
        executionRec: v.optional(v.string()),
        evalMgmtRec: v.optional(v.string()),
        notes: v.optional(v.string()),
        // الحالة والتوقيع
        status: v.union(v.literal("draft"), v.literal("submitted")),
        submittedAt: v.optional(v.number()),
        teacherSignedAt: v.optional(v.number()),
        teacherSignedNote: v.optional(v.string()),
        createdAt: v.number(),
    }).index("by_school", ["schoolId"])
      .index("by_teacher", ["schoolId", "teacherName"])
      .index("by_role", ["schoolId", "visitorRole"])
      .index("by_subject", ["schoolId", "subjectName"])
      .index("by_date", ["schoolId", "visitDate"]),
});
