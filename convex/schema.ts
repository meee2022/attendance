import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
    surveyAnalyses: defineTable({
        schoolId: v.id("schools"), title: v.string(), fileName: v.string(),
        data: v.string(), responseCount: v.number(), questionCount: v.number(),
        updatedAt: v.number(), updatedBy: v.string(),
    }).index("by_school", ["schoolId"]),
    // A ministry «كشف درجات الشعبة» imported for analysis (src/lib/gradeSheet.ts)
    gradeAnalyses: defineTable({
        schoolId: v.id("schools"), title: v.string(), fileName: v.string(), period: v.string(), grade: v.number(),
        data: v.string(), studentCount: v.number(), subjectCount: v.number(),
        updatedAt: v.number(), updatedBy: v.string(),
    }).index("by_school", ["schoolId"]),
    // ── رأي المعلمين في الطلاب ──────────────────────────────────────────
    // A round asks every teacher of one grade for their view of each student;
    // once the deputy publishes it, each guardian reads their son's report
    // through a private link.
    opinionRounds: defineTable({
        schoolId: v.id("schools"), title: v.string(), grade: v.number(),
        open: v.boolean(), published: v.boolean(),
        createdAt: v.number(), createdBy: v.string(),
    }).index("by_school", ["schoolId"]),
    studentOpinions: defineTable({
        schoolId: v.id("schools"), roundId: v.id("opinionRounds"),
        studentId: v.id("students"), classId: v.id("classes"),
        teacherId: v.id("schoolTeachers"), teacherName: v.string(), subjectName: v.string(),
        academic: v.optional(v.number()),   // 5 ممتاز … 1 ضعيف
        behavior: v.optional(v.number()),
        distraction: v.optional(v.union(v.literal("no"), v.literal("sometimes"), v.literal("yes"))),
        advice: v.optional(v.string()),     // نصيحة لولي الأمر
        updatedAt: v.number(),
    }).index("by_round", ["roundId"])
      .index("by_round_student", ["roundId", "studentId"])
      .index("by_round_teacher", ["roundId", "teacherId", "subjectName"]),
    guardianLinks: defineTable({
        schoolId: v.id("schools"), roundId: v.id("opinionRounds"), studentId: v.id("students"),
        token: v.string(), expiresAt: v.number(), createdAt: v.number(),
        openCount: v.number(), firstOpenedAt: v.optional(v.number()), lastOpenedAt: v.optional(v.number()),
    }).index("by_token", ["token"]).index("by_round", ["roundId"]),
    teacherTasks: defineTable({
        schoolId: v.id("schools"), title: v.string(), url: v.string(), description: v.string(),
        audience: v.array(v.string()), audienceLabel: v.string(), category: v.string(), academicYear: v.string(),
        order: v.number(), isActive: v.boolean(), updatedAt: v.number(),
    }).index("by_school", ["schoolId"]),
    supervisionImports: defineTable({
        schoolId: v.id("schools"), ownerId: v.string(), storageId: v.id("_storage"),
        filename: v.string(), sha256: v.string(), createdAt: v.number(),
        visitId: v.optional(v.id("supervisionVisits")),
    }).index("by_hash", ["schoolId", "sha256"]),
    // Visit forms e-mailed to the visited teacher
    supervisionEmails: defineTable({
        schoolId: v.id("schools"),
        visitId: v.id("supervisionVisits"),
        to: v.string(),
        byName: v.string(),
        status: v.union(v.literal("queued"), v.literal("sent"), v.literal("failed")),
        error: v.optional(v.string()),
        createdAt: v.number(),
        sentAt: v.optional(v.number()),
    }).index("by_visit", ["visitId"]),

    supervisionAcknowledgements: defineTable({
        schoolId: v.id("schools"), visitId: v.id("supervisionVisits"), tokenHash: v.string(),
        visitUpdatedAt: v.number(), expiresAt: v.number(), createdBy: v.string(),
        acknowledgedAt: v.optional(v.number()), comment: v.optional(v.string()),
        // a link the teacher signs the form through, not only reads it
        sign: v.optional(v.boolean()), signatureId: v.optional(v.id("_storage")),
        revoked: v.boolean(),
    }).index("by_token", ["tokenHash"]).index("by_visit", ["visitId"]),
    supervisionSessions: defineTable({
        schoolId: v.id("schools"), tokenHash: v.string(), credentialHash: v.string(),
        role: v.union(v.literal("coordinator"), v.literal("supervisor"), v.literal("deputy"), v.literal("admin"), v.literal("teacher")),
        visitorId: v.optional(v.id("supervisors")), name: v.string(), expiresAt: v.number(),
        // a teacher signed in with their own account; absent on the shared teacher code
        teacherId: v.optional(v.id("schoolTeachers")),
    }).index("by_token", ["tokenHash"]),
    // A person's own sign-in: a password only they know, kept salted and hashed.
    // The owner is a coordinator (visitorId), a teacher (teacherId), or — for
    // the deputy and the platform admin, who have no row of their own — the role.
    supervisionAccounts: defineTable({
        schoolId: v.id("schools"), role: v.union(v.literal("coordinator"), v.literal("deputy"), v.literal("admin"), v.literal("teacher")),
        visitorId: v.optional(v.id("supervisors")), teacherId: v.optional(v.id("schoolTeachers")),
        salt: v.string(), passwordHash: v.string(), updatedAt: v.number(),
    }).index("by_owner", ["schoolId", "role", "visitorId"]).index("by_teacher", ["teacherId"]),
    // The one-time link a person sets that password through
    accountActivations: defineTable({
        schoolId: v.id("schools"), role: v.union(v.literal("coordinator"), v.literal("deputy"), v.literal("admin"), v.literal("teacher")),
        visitorId: v.optional(v.id("supervisors")), teacherId: v.optional(v.id("schoolTeachers")),
        tokenHash: v.string(), expiresAt: v.number(), createdBy: v.string(),
    }).index("by_token", ["tokenHash"]).index("by_owner", ["schoolId", "role", "visitorId"]).index("by_teacher", ["teacherId"]),
    supervisionLoginAttempts: defineTable({
        key: v.string(), failures: v.number(), resetAt: v.number(),
    }).index("by_key", ["key"]),
    supervisionActions: defineTable({
        schoolId: v.id("schools"), teacherId: v.id("schoolTeachers"), department: v.string(),
        visitId: v.optional(v.id("supervisionVisits")), completionVisitId: v.optional(v.id("supervisionVisits")),
        kind: v.union(v.literal("improvement"), v.literal("training"), v.literal("visit")),
        title: v.string(), owner: v.string(), dueDate: v.string(), evidence: v.string(),
        status: v.union(v.literal("open"), v.literal("done"), v.literal("cancelled")),
        createdBy: v.string(), updatedBy: v.string(), createdAt: v.number(), updatedAt: v.number(),
    }).index("by_school", ["schoolId"]),
    schools: defineTable({
        name: v.string(),
        code: v.string(),
        logoUrl: v.optional(v.string()),
        createdAt: v.string(),
        periodsPerDay: v.optional(v.number()),
        currentDate: v.optional(v.string()),
        teacherPin: v.optional(v.string()),
        adminPin: v.optional(v.string()), // default "1234"
        dailyAbsenceThreshold: v.optional(v.number()), // max absent periods still = present
        // Supervision role PINs
        coordinatorPin: v.optional(v.string()), // افتراضي "1111"
        supervisorPin: v.optional(v.string()),  // افتراضي "2222"
        deputyPin: v.optional(v.string()),      // افتراضي "3333"
        // Feature toggles: array of feature keys that are HIDDEN
        hiddenFeatures: v.optional(v.array(v.string())),
        // Practical exam categories: list of category labels (legacy, kept for compat)
        practicalCategories: v.optional(v.array(v.string())),
        // Practical exam subjects: subject ↔ category mapping
        practicalSubjects: v.optional(v.array(v.object({
            subject: v.string(),
            category: v.string(),
        }))),
        // Practical exam WhatsApp template
        practicalAbsenceTemplate: v.optional(v.string()),
        // معايير كشف المتابعة اليومية (قابلة للتعديل من الإعدادات)
        followUpCriteria: v.optional(v.array(v.object({
            id: v.string(),
            label: v.string(),
        }))),
        followUpTemplate: v.optional(v.string()),
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
        signatureId: v.optional(v.id("_storage")),  // uploaded once, printed on the visitor's submitted visits
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

    // الدرجة الكلية لكل تقييم في كشف (شعبة + مادة) حين تختلف عن الافتراضية:
    // تقييم من 30 أو 40 يُرصد بدرجته الفعلية
    assessmentMaxes: defineTable({
        schoolId: v.id("schools"),
        className: v.string(),
        subjectName: v.string(),
        a1: v.optional(v.number()),
        a2: v.optional(v.number()),
        a3: v.optional(v.number()),
        a4: v.optional(v.number()),
        a5: v.optional(v.number()),
        updatedAt: v.number(),
        updatedBy: v.optional(v.string()),
    }).index("by_class_subject", ["schoolId", "className", "subjectName"])
      .index("by_school", ["schoolId"]),

    // إعدادات نظام الدرجات
    gradeSettings: defineTable({
        schoolId: v.id("schools"),
        maxPerAssessment: v.number(),       // افتراضي 20
        finalScoreOutOf: v.number(),        // افتراضي 5
        passThreshold: v.number(),          // حد النجاح من finalScoreOutOf (افتراضي 2.5)
        excellenceThreshold: v.number(),    // حد التميز (افتراضي 4.5)
        assessmentLabels: v.array(v.string()), // ["تقييم 1", ..., "تقييم 5"]
        // الصفوف المشمولة بالتقييمات القصيرة (الصف 12 مثلاً ليس له تقييمات قصيرة)
        includedGrades: v.optional(v.array(v.number())),
    }).index("by_school", ["schoolId"]),

    // أسابيع الفصل الدراسي كما في جدول المدرسة المعتمد
    assessmentWeeks: defineTable({
        schoolId: v.id("schools"),
        week: v.number(),                   // 1..14
        label: v.string(),                  // "30/8-3/9"
        startDate: v.string(),              // "2026-08-30"
        endDate: v.string(),                // "2026-09-03"
        note: v.optional(v.string()),       // اختبارات منتصف · إجازة · مراجعة
    }).index("by_school", ["schoolId"])
      .index("by_week", ["schoolId", "week"]),

    // خطة التقييمات القصيرة: في أي أسبوع تُجرى كل مادة
    // grade غير محدد = الخطة تسري على كل الصفوف، وأي صف له أسابيعه الخاصة يتقدّم عليها
    assessmentPlan: defineTable({
        schoolId: v.id("schools"),
        subjectName: v.string(),
        grade: v.optional(v.number()),
        week: v.number(),
    }).index("by_school", ["schoolId"])
      .index("by_subject", ["schoolId", "subjectName"]),

    // قاعدة بيانات المعلمين الموحدة
    schoolTeachers: defineTable({
        schoolId: v.id("schools"),
        fullName: v.string(),
        department: v.string(),
        email: v.optional(v.string()),
        phone: v.optional(v.string()),
        teachingClasses: v.optional(v.array(v.string())),
        isActive: v.boolean(),
        // When two coordinators cover one department: the one who supervises
        // this teacher. The other then sees neither the teacher nor their forms.
        coordinatorId: v.optional(v.id("supervisors")),
    }).index("by_school", ["schoolId"])
      .index("by_dept", ["schoolId", "department"]),

    // Every earlier state of an edited visit — the workbook's «log» sheet
    supervisionVisitVersions: defineTable({
        schoolId: v.id("schools"),
        visitId: v.id("supervisionVisits"),
        version: v.number(),
        data: v.string(),                   // JSON of the visit before the change
        changedBy: v.optional(v.string()),
        changedAt: v.number(),
        reason: v.optional(v.string()),
    }).index("by_visit", ["visitId"]),

    // Settings of the supervision form that change from year to year
    supervisionSettings: defineTable({
        schoolId: v.id("schools"),
        academicYear: v.string(),           // "2026 - 2027"
        yearStart: v.optional(v.string()),  // ISO — bounds «this year» in the dashboards
        yearEnd: v.optional(v.string()),
        schoolNameOnForm: v.optional(v.string()),
        principalName: v.optional(v.string()),
        deputyName: v.optional(v.string()),
        headerImageId: v.optional(v.id("_storage")),
        footerImageId: v.optional(v.id("_storage")),
        // The academic deputy's signature, printed on the deputy's submitted visits
        deputySignatureId: v.optional(v.id("_storage")),
        // Visits expected per teacher per year, by visitor type
        requiredCoordinator: v.optional(v.number()),
        requiredSupervisor: v.optional(v.number()),
        requiredDeputy: v.optional(v.number()),
    }).index("by_school", ["schoolId"]),

    // سجل المراجعات (audit log)
    // ── تقييم الأداء السنوي (استمارة تقييم أداء المعلم) ────────────────────
    // What the appraisal form prints about the teacher. Kept apart from
    // schoolTeachers, which other pages read whole.
    teacherProfiles: defineTable({
        schoolId: v.id("schools"), teacherId: v.id("schoolTeachers"),
        employeeNo: v.optional(v.string()), personalNo: v.optional(v.string()), hireDate: v.optional(v.string()),
        jobTitle: v.optional(v.string()), nationality: v.optional(v.string()),
    }).index("by_teacher", ["teacherId"]),
    teacherEvaluations: defineTable({
        schoolId: v.id("schools"), academicYear: v.string(),
        // absent on an archived form of a teacher who has left
        teacherId: v.optional(v.id("schoolTeachers")),
        teacherName: v.string(), department: v.string(),
        profile: v.object({ employeeNo: v.string(), personalNo: v.string(), hireDate: v.string(), jobTitle: v.string(), nationality: v.string() }),
        penalties: v.array(v.object({ type: v.string(), reason: v.string(), date: v.string() })),
        courses: v.array(v.object({ name: v.string(), place: v.string(), duration: v.string(), date: v.string() })),
        scores: v.string(),                 // JSON { [indicatorId]: mark }
        total: v.number(),
        status: v.union(v.literal("draft"), v.literal("sent"), v.literal("approved")),
        evaluatorId: v.optional(v.id("supervisors")), evaluatorName: v.string(),
        evaluatorRole: v.union(v.literal("coordinator"), v.literal("deputy")),
        // The form as the coordinator sent it: the deputy then edits the form
        // itself, and the coordinator can still open what they wrote
        coordinatorVersion: v.optional(v.object({
            scores: v.string(), total: v.number(), at: v.number(), name: v.string(),
            penalties: v.array(v.object({ type: v.string(), reason: v.string(), date: v.string() })),
            courses: v.array(v.object({ name: v.string(), place: v.string(), duration: v.string(), date: v.string() })),
        })),
        // The deputy's notes to the coordinator: one on the whole form, and one
        // beside each mark they changed (JSON { [indicatorId]: note })
        review: v.optional(v.object({ note: v.string(), items: v.string() })),
        approval: v.optional(v.object({ name: v.string(), at: v.number() })),
        teacherSign: v.optional(v.object({ at: v.number(), signatureId: v.id("_storage"), comment: v.optional(v.string()) })),
        archived: v.optional(v.boolean()),  // a past year's form, kept for comparison
        createdAt: v.number(), updatedAt: v.number(),
    }).index("by_school_year", ["schoolId", "academicYear"]).index("by_teacher", ["teacherId"]),
    // The private link a teacher reads and signs their approved form through
    evaluationLinks: defineTable({
        schoolId: v.id("schools"), evaluationId: v.id("teacherEvaluations"), tokenHash: v.string(),
        evaluationUpdatedAt: v.number(), expiresAt: v.number(), createdBy: v.string(), revoked: v.boolean(),
    }).index("by_token", ["tokenHash"]).index("by_evaluation", ["evaluationId"]),

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

    // ── Practical Absences (تبسيط: لا يوجد "اختبارات"، فقط تعليم غياب) ──
    practicalAbsences: defineTable({
        schoolId: v.id("schools"),
        studentId: v.optional(v.id("students")),
        studentName: v.string(),
        className: v.string(),
        grade: v.number(),
        subject: v.optional(v.string()),  // المادة مثل "الفيزياء"
        category: v.string(),             // الفئة مثل "عملي"
        status: v.union(v.literal("absent"), v.literal("excused")),
        notes: v.optional(v.string()),
        markedAt: v.number(),
        markedBy: v.optional(v.string()),
    }).index("by_school", ["schoolId"])
      .index("by_class", ["schoolId", "className"])
      .index("by_student", ["schoolId", "studentName"]),

    // ── المتابعة اليومية (كشف تقييم يومي للطلاب) ──────────────────────────
    // A sheet is one (class, subject, date). Recording it creates a session.
    followUpSessions: defineTable({
        schoolId: v.id("schools"),
        classId: v.id("classes"),
        className: v.string(),
        subjectName: v.string(),
        date: v.string(),                 // YYYY-MM-DD
        teacherName: v.optional(v.string()),
        createdAt: v.number(),
    }).index("by_school", ["schoolId"])
      .index("by_school_date", ["schoolId", "date"])
      .index("by_class_subject_date", ["classId", "subjectName", "date"]),

    // Exceptions only — a student who met every criterion has no row at all.
    // That is what makes "الكل ملتزم" the free default instead of 125 cells.
    followUpRecords: defineTable({
        schoolId: v.id("schools"),
        sessionId: v.id("followUpSessions"),
        classId: v.id("classes"),
        studentId: v.id("students"),
        studentName: v.string(),
        className: v.string(),
        subjectName: v.string(),
        date: v.string(),
        isAbsent: v.optional(v.boolean()),
        // JSON { [criterionId]: "partial" | "no" } — met criteria are omitted
        marks: v.string(),
        notes: v.optional(v.string()),
        updatedAt: v.number(),
        updatedBy: v.optional(v.string()),
    }).index("by_session", ["sessionId"])
      .index("by_student", ["studentId"])
      .index("by_school", ["schoolId"])
      .index("by_school_date", ["schoolId", "date"]),

    // ── الاختبارات التشخيصية وتحليل المهارات ──────────────────────────────
    // A test defines its questions, each carrying a max mark and the skill it
    // measures. Analysis is derived from those two facts, never stored.
    diagnosticTests: defineTable({
        schoolId: v.id("schools"),
        title: v.string(),
        subjectName: v.string(),             // المادة الرئيسية (أو مسمّى الاختبار المجمّع)
        // اختبار مجمّع كاختبار العلوم يغطي أكثر من مادة؛ إن غابت فالمادة واحدة
        subjectNames: v.optional(v.array(v.string())),
        grade: v.number(),
        term: v.optional(v.string()),
        testDate: v.optional(v.string()),
        masteryThreshold: v.number(),        // 0..1 — افتراضي 0.6
        classNames: v.array(v.string()),     // الشعب التي تؤدي الاختبار
        skills: v.array(v.object({
            id: v.string(),
            label: v.string(),
            subjectName: v.optional(v.string()),
        })),
        questions: v.array(v.object({
            n: v.number(),
            skillId: v.optional(v.string()),
            subjectName: v.optional(v.string()),
            maxMark: v.number(),
        })),
        isActive: v.boolean(),
        createdAt: v.number(),
    }).index("by_school", ["schoolId"]),

    diagnosticScores: defineTable({
        schoolId: v.id("schools"),
        testId: v.id("diagnosticTests"),
        studentId: v.id("students"),
        studentName: v.string(),
        className: v.string(),
        // JSON { "<questionNumber>": mark } — unanswered questions are omitted
        scores: v.string(),
        isAbsent: v.optional(v.boolean()),
        updatedAt: v.number(),
    }).index("by_test", ["testId"])
      .index("by_test_class", ["testId", "className"])
      .index("by_student", ["studentId"])
      .index("by_school", ["schoolId"]),

    supervisionVisits: defineTable({
        sourceImportId: v.optional(v.id("supervisionImports")),
        schoolId: v.id("schools"),
        // الزائر
        visitorRole: v.union(v.literal("coordinator"), v.literal("supervisor"), v.literal("deputy")),
        visitorId: v.optional(v.id("supervisors")),
        visitorName: v.string(),
        recordedByVisitorId: v.optional(v.id("supervisors")),
        recordedByName: v.optional(v.string()),
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
        evalMgmtRec: v.optional(v.string()),     // التقويم (and, in visits before the split, الإدارة الصفية too)
        managementRec: v.optional(v.string()),   // الإدارة الصفية وبيئة التعلم
        notes: v.optional(v.string()),
        // Support teachers are visited on their own form (visitCriteria.SUPPORT_CRITERIA),
        // with a recommendation beside each criterion: JSON { [criterionId]: text }
        formKind: v.optional(v.literal("support")),
        criterionRecs: v.optional(v.string()),
        // A draft sent to the deputy or a colleague to review before it is submitted
        reviewRequest: v.optional(v.object({
            toRole: v.union(v.literal("deputy"), v.literal("coordinator")),
            toVisitorId: v.optional(v.id("supervisors")),
            toName: v.string(),
            byName: v.string(),
            note: v.optional(v.string()),
            at: v.number(),
        })),
        // …and what the reviewer said when sending it back
        reviewReturn: v.optional(v.object({ byName: v.string(), note: v.string(), at: v.number() })),
        submittedByName: v.optional(v.string()),
        coordinatorApproval: v.optional(v.object({ name: v.string(), at: v.number(), signatureId: v.optional(v.id("_storage")) })),
        deputyApproval: v.optional(v.object({ name: v.string(), at: v.number(), signatureId: v.optional(v.id("_storage")) })),
        // «ميدانيّة / عن بُعد» and, for a remote lesson, «بث مباشر مدمج / غير مدمج»
        deliveryMode: v.optional(v.union(v.literal("field"), v.literal("remote"))),
        streamMode: v.optional(v.union(v.literal("merged"), v.literal("unmerged"))),
        // إطراء المعلم
        praiseText: v.optional(v.string()),
        // الحالة والتوقيع
        status: v.union(v.literal("draft"), v.literal("submitted")),
        submittedAt: v.optional(v.number()),
        teacherSignedAt: v.optional(v.number()),
        teacherSignedNote: v.optional(v.string()),
        // «توقيع المعلم»: drawn on the visitor's device, drawn through the
        // teacher's own link, signed on the printed form, or not obtained — with why
        teacherSign: v.optional(v.object({
            method: v.union(v.literal("device"), v.literal("link"), v.literal("paper"), v.literal("none")),
            at: v.number(),
            byName: v.optional(v.string()),
            signatureId: v.optional(v.id("_storage")),
            reason: v.optional(v.string()),
            comment: v.optional(v.string()),
        })),
        createdAt: v.number(),
        // ── references by id: the names above are display text only ──
        teacherId: v.optional(v.id("schoolTeachers")),
        classId: v.optional(v.id("classes")),
        // رقم السجل: sequential across the school within an academic year
        recordNo: v.optional(v.number()),
        academicYear: v.optional(v.string()),
        // The form as it stood when the visit was made — criteria wording, school,
        // deputy — so a later change never rewrites an old PDF. JSON.
        snapshot: v.optional(v.string()),
        updatedAt: v.optional(v.number()),
        updatedBy: v.optional(v.string()),
        // Soft delete: a visit is never lost, only moved to the bin
        deletedAt: v.optional(v.number()),
        deletedBy: v.optional(v.string()),
        deleteReason: v.optional(v.string()),
    }).index("by_school", ["schoolId"])
      .index("by_teacher_id", ["schoolId", "teacherId"])
      .index("by_teacher", ["schoolId", "teacherName"])
      .index("by_role", ["schoolId", "visitorRole"])
      .index("by_subject", ["schoolId", "subjectName"])
      .index("by_date", ["schoolId", "visitDate"]),

    // بنك التوصيات للإشراف الصفي
    supervisionRecommendationBank: defineTable({
        schoolId: v.id("schools"),
        domain: v.union(
            v.literal("planning"),
            v.literal("execution"),
            v.literal("evaluation"),
            v.literal("management"),
            v.literal("general"),   // توصيات عامة
        ),
        text: v.string(),
        order: v.number(),
        isActive: v.boolean(),
    }).index("by_school", ["schoolId"])
      .index("by_school_domain", ["schoolId", "domain"]),
});
