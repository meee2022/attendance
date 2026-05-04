import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// ── Default 24 criteria from the original Excel form ───────────────────────
const DEFAULT_CRITERIA: { domain: "planning" | "execution" | "evaluation" | "management"; text: string }[] = [
    // التخطيط (3)
    { domain: "planning",   text: "خطة الدرس متوفرة وبنودها مستكملة ومناسبة ومعلنة على نظام قطر للتعليم." },
    { domain: "planning",   text: "أهداف التعلم مناسبة ودقيقة الصياغة وقابلة للقياس." },
    { domain: "planning",   text: "أنشطة الدرس الرئيسة واضحة ومتدرجة ومرتبطة بالأهداف." },
    // تنفيذ الدرس (13)
    { domain: "execution",  text: "أهداف التعلم معروضة ويتم مناقشتها." },
    { domain: "execution",  text: "أنشطة التمهيد مفعّلة بشكل مناسب." },
    { domain: "execution",  text: "محتوى الدرس واضح، والعرض منظم ومترابط." },
    { domain: "execution",  text: "طرائق التدريس وإستراتيجياته متنوعة وتتمحور حول الطالب." },
    { domain: "execution",  text: "مصادر التعلم الرئيسة والمساندة موظفة بصورة واضحة وسليمة." },
    { domain: "execution",  text: "الوسائل التعليمية والتكنولوجيا موظفة بصورة مناسبة." },
    { domain: "execution",  text: "الأسئلة الصفية ذات صياغة سليمة ومتدرجة ومثيرة للتفكير." },
    { domain: "execution",  text: "المادة العلمية دقيقة ومناسبة." },
    { domain: "execution",  text: "الكفايات الأساسية متضمنة في السياق المعرفي للدرس." },
    { domain: "execution",  text: "القيم الأساسيّة متضمنة في السياق المعرفي للدرس." },
    { domain: "execution",  text: "التكامل بين محاور المادة ومع المواد الأخرى يتم بشكل مناسب." },
    { domain: "execution",  text: "الفروق الفردية بين الطلبة يتم مراعاتها." },
    { domain: "execution",  text: "غلق الدرس يتم بشكل مناسب." },
    // التقويم (3)
    { domain: "evaluation", text: "أساليب التقويم (القبلي والبنائي والختامي) مناسبة ومتنوعة." },
    { domain: "evaluation", text: "التغذية الراجعة متنوعة ومستمرة." },
    { domain: "evaluation", text: "أعمال الطلبة متابعة ومصححة بدقة ورقيّاً وإلكترونياً." },
    // الإدارة الصفية (4)
    { domain: "management", text: "البيئة الصفيّة إيجابيّة وآمنة وداعمة للتعلّم." },
    { domain: "management", text: "إدارة أنشطة التعلّم والمشاركات الصفيّة تتم بصورة منظمّة." },
    { domain: "management", text: "قوانين إدارة الصف وإدارة السلوك مفعلة." },
    { domain: "management", text: "الاستثمار الأمثل لزمن الحصّة." },
];

async function getSchool(ctx: any) {
    const sch = await ctx.db.query("schools").first();
    if (!sch) throw new Error("لا توجد مدرسة مُهيَّأة");
    return sch;
}

// ── Criteria ──────────────────────────────────────────────────────────────
export const getCriteria = query({
    args: {},
    handler: async (ctx) => {
        const school = await ctx.db.query("schools").first();
        if (!school) return [];
        return ctx.db.query("supervisionCriteria")
            .withIndex("by_school", q => q.eq("schoolId", school._id))
            .collect();
    },
});

export const seedDefaultCriteria = mutation({
    args: {},
    handler: async (ctx) => {
        const school = await getSchool(ctx);
        const existing = await ctx.db.query("supervisionCriteria")
            .withIndex("by_school", q => q.eq("schoolId", school._id))
            .collect();
        if (existing.length > 0) return { skipped: existing.length };
        let order = 0;
        for (const c of DEFAULT_CRITERIA) {
            await ctx.db.insert("supervisionCriteria", {
                schoolId: school._id,
                domain: c.domain,
                text: c.text,
                order: order++,
                isActive: true,
            });
        }
        return { added: DEFAULT_CRITERIA.length };
    },
});

export const resetCriteria = mutation({
    args: {},
    handler: async (ctx) => {
        const school = await getSchool(ctx);
        const existing = await ctx.db.query("supervisionCriteria")
            .withIndex("by_school", q => q.eq("schoolId", school._id))
            .collect();
        for (const c of existing) await ctx.db.delete(c._id);
        let order = 0;
        for (const c of DEFAULT_CRITERIA) {
            await ctx.db.insert("supervisionCriteria", {
                schoolId: school._id,
                domain: c.domain,
                text: c.text,
                order: order++,
                isActive: true,
            });
        }
        return { reset: DEFAULT_CRITERIA.length };
    },
});

export const updateCriterion = mutation({
    args: { id: v.id("supervisionCriteria"), text: v.optional(v.string()), isActive: v.optional(v.boolean()), order: v.optional(v.number()) },
    handler: async (ctx, args) => {
        const patch: any = {};
        if (args.text !== undefined) patch.text = args.text.trim();
        if (args.isActive !== undefined) patch.isActive = args.isActive;
        if (args.order !== undefined) patch.order = args.order;
        await ctx.db.patch(args.id, patch);
    },
});

export const addCriterion = mutation({
    args: { domain: v.union(v.literal("planning"), v.literal("execution"), v.literal("evaluation"), v.literal("management")), text: v.string() },
    handler: async (ctx, args) => {
        const school = await getSchool(ctx);
        const existing = await ctx.db.query("supervisionCriteria")
            .withIndex("by_school_domain", q => q.eq("schoolId", school._id).eq("domain", args.domain))
            .collect();
        const order = existing.length > 0 ? Math.max(...existing.map(c => c.order)) + 1 : 0;
        await ctx.db.insert("supervisionCriteria", {
            schoolId: school._id,
            domain: args.domain,
            text: args.text.trim(),
            order,
            isActive: true,
        });
    },
});

export const deleteCriterion = mutation({
    args: { id: v.id("supervisionCriteria") },
    handler: async (ctx, args) => {
        await ctx.db.delete(args.id);
    },
});

// ── Supervisors ───────────────────────────────────────────────────────────
export const getSupervisors = query({
    args: {},
    handler: async (ctx) => {
        const school = await ctx.db.query("schools").first();
        if (!school) return [];
        return ctx.db.query("supervisors")
            .withIndex("by_school", q => q.eq("schoolId", school._id))
            .collect();
    },
});

export const addSupervisor = mutation({
    args: {
        fullName: v.string(),
        role: v.union(v.literal("coordinator"), v.literal("supervisor"), v.literal("deputy")),
        subjects: v.array(v.string()),
        email: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const school = await getSchool(ctx);
        await ctx.db.insert("supervisors", {
            schoolId: school._id,
            fullName: args.fullName.trim(),
            role: args.role,
            subjects: args.subjects,
            email: args.email,
            isActive: true,
        });
    },
});

export const updateSupervisor = mutation({
    args: {
        id: v.id("supervisors"),
        fullName: v.optional(v.string()),
        subjects: v.optional(v.array(v.string())),
        email: v.optional(v.string()),
        pin: v.optional(v.string()),
        isActive: v.optional(v.boolean()),
    },
    handler: async (ctx, args) => {
        const patch: any = {};
        if (args.fullName !== undefined) patch.fullName = args.fullName.trim();
        if (args.subjects !== undefined) patch.subjects = args.subjects;
        if (args.email !== undefined) patch.email = args.email;
        if (args.pin !== undefined) patch.pin = args.pin;
        if (args.isActive !== undefined) patch.isActive = args.isActive;
        await ctx.db.patch(args.id, patch);
    },
});

export const deleteSupervisor = mutation({
    args: { id: v.id("supervisors") },
    handler: async (ctx, args) => {
        await ctx.db.delete(args.id);
    },
});

// ── Visits ────────────────────────────────────────────────────────────────
export const getVisits = query({
    args: { teacherName: v.optional(v.string()), visitorRole: v.optional(v.union(v.literal("coordinator"), v.literal("supervisor"), v.literal("deputy"))), subjectName: v.optional(v.string()) },
    handler: async (ctx, args) => {
        const school = await ctx.db.query("schools").first();
        if (!school) return [];
        let q;
        if (args.teacherName) {
            q = ctx.db.query("supervisionVisits").withIndex("by_teacher", x => x.eq("schoolId", school._id).eq("teacherName", args.teacherName!));
        } else if (args.visitorRole) {
            q = ctx.db.query("supervisionVisits").withIndex("by_role", x => x.eq("schoolId", school._id).eq("visitorRole", args.visitorRole!));
        } else if (args.subjectName) {
            q = ctx.db.query("supervisionVisits").withIndex("by_subject", x => x.eq("schoolId", school._id).eq("subjectName", args.subjectName!));
        } else {
            q = ctx.db.query("supervisionVisits").withIndex("by_school", x => x.eq("schoolId", school._id));
        }
        const visits = await q.collect();
        return visits.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
    },
});

export const getVisit = query({
    args: { id: v.id("supervisionVisits") },
    handler: async (ctx, args) => ctx.db.get(args.id),
});

function computeAverages(ratings: Record<string, number | string>, criteria: { _id: string; domain: string }[]) {
    const byDomain: Record<string, { sum: number; cnt: number }> = {
        planning: { sum: 0, cnt: 0 },
        execution: { sum: 0, cnt: 0 },
        evaluation: { sum: 0, cnt: 0 },
        management: { sum: 0, cnt: 0 },
    };
    let totalSum = 0, totalCnt = 0;
    for (const c of criteria) {
        const v = ratings[c._id];
        if (typeof v === "number" && v >= 0 && v <= 3) {
            byDomain[c.domain].sum += v;
            byDomain[c.domain].cnt++;
            totalSum += v;
            totalCnt++;
        }
    }
    const dom: Record<string, number> = {};
    for (const k of Object.keys(byDomain)) {
        dom[k] = byDomain[k].cnt > 0 ? byDomain[k].sum / byDomain[k].cnt / 3 : 0;
    }
    return {
        averageScore: totalCnt > 0 ? totalSum / totalCnt / 3 : 0,
        domainAverages: dom,
    };
}

export const saveVisit = mutation({
    args: {
        id: v.optional(v.id("supervisionVisits")),
        visitorRole: v.union(v.literal("coordinator"), v.literal("supervisor"), v.literal("deputy")),
        visitorName: v.string(),
        teacherName: v.string(),
        teacherDepartment: v.string(),
        subjectName: v.string(),
        className: v.string(),
        lessonTopic: v.string(),
        visitDate: v.string(),
        followUpType: v.union(v.literal("full"), v.literal("partial")),
        ratings: v.string(),  // JSON
        planningRec: v.optional(v.string()),
        executionRec: v.optional(v.string()),
        evalMgmtRec: v.optional(v.string()),
        notes: v.optional(v.string()),
        status: v.union(v.literal("draft"), v.literal("submitted")),
    },
    handler: async (ctx, args) => {
        const school = await getSchool(ctx);
        const criteria = await ctx.db.query("supervisionCriteria")
            .withIndex("by_school", q => q.eq("schoolId", school._id))
            .collect();
        let parsedRatings: Record<string, number | string> = {};
        try { parsedRatings = JSON.parse(args.ratings); } catch {}
        const { averageScore, domainAverages } = computeAverages(parsedRatings, criteria as any);

        if (args.id) {
            const existing = await ctx.db.get(args.id);
            if (!existing) throw new Error("الزيارة غير موجودة");
            const wasSubmitted = existing.status === "submitted";
            await ctx.db.patch(args.id, {
                visitorRole: args.visitorRole,
                visitorName: args.visitorName.trim(),
                teacherName: args.teacherName.trim(),
                teacherDepartment: args.teacherDepartment,
                subjectName: args.subjectName,
                className: args.className,
                lessonTopic: args.lessonTopic.trim(),
                visitDate: args.visitDate,
                followUpType: args.followUpType,
                ratings: args.ratings,
                averageScore,
                domainAverages: JSON.stringify(domainAverages),
                planningRec: args.planningRec?.trim(),
                executionRec: args.executionRec?.trim(),
                evalMgmtRec: args.evalMgmtRec?.trim(),
                notes: args.notes?.trim(),
                status: args.status,
                submittedAt: args.status === "submitted" && !wasSubmitted ? Date.now() : existing.submittedAt,
            });
            return args.id;
        }

        // Compute visit number for this teacher
        const previous = await ctx.db.query("supervisionVisits")
            .withIndex("by_teacher", q => q.eq("schoolId", school._id).eq("teacherName", args.teacherName.trim()))
            .collect();
        const visitNumber = previous.length + 1;

        const id = await ctx.db.insert("supervisionVisits", {
            schoolId: school._id,
            visitorRole: args.visitorRole,
            visitorName: args.visitorName.trim(),
            teacherName: args.teacherName.trim(),
            teacherDepartment: args.teacherDepartment,
            subjectName: args.subjectName,
            className: args.className,
            lessonTopic: args.lessonTopic.trim(),
            visitDate: args.visitDate,
            followUpType: args.followUpType,
            visitNumber,
            ratings: args.ratings,
            averageScore,
            domainAverages: JSON.stringify(domainAverages),
            planningRec: args.planningRec?.trim(),
            executionRec: args.executionRec?.trim(),
            evalMgmtRec: args.evalMgmtRec?.trim(),
            notes: args.notes?.trim(),
            status: args.status,
            submittedAt: args.status === "submitted" ? Date.now() : undefined,
            createdAt: Date.now(),
        });
        return id;
    },
});

export const deleteVisit = mutation({
    args: { id: v.id("supervisionVisits") },
    handler: async (ctx, args) => {
        await ctx.db.delete(args.id);
    },
});

export const signVisitAsTeacher = mutation({
    args: { id: v.id("supervisionVisits"), note: v.optional(v.string()) },
    handler: async (ctx, args) => {
        await ctx.db.patch(args.id, {
            teacherSignedAt: Date.now(),
            teacherSignedNote: args.note?.trim(),
        });
    },
});

// ── PIN authentication for visitor roles ──────────────────────────────────
export const verifyRolePin = query({
    args: {
        role: v.union(v.literal("coordinator"), v.literal("supervisor"), v.literal("deputy")),
        pin: v.string(),
    },
    handler: async (ctx, args) => {
        const school = await ctx.db.query("schools").first();
        if (!school) return false;
        const expected = args.role === "coordinator" ? (school.coordinatorPin ?? "1111")
            : args.role === "supervisor" ? (school.supervisorPin ?? "2222")
            : (school.deputyPin ?? "3333");
        return args.pin === expected;
    },
});

export const updateRolePin = mutation({
    args: {
        role: v.union(v.literal("coordinator"), v.literal("supervisor"), v.literal("deputy")),
        newPin: v.string(),
    },
    handler: async (ctx, args) => {
        const school = await getSchool(ctx);
        const patch: any = {};
        if (args.role === "coordinator") patch.coordinatorPin = args.newPin;
        else if (args.role === "supervisor") patch.supervisorPin = args.newPin;
        else patch.deputyPin = args.newPin;
        await ctx.db.patch(school._id, patch);
    },
});

// ── Bulk import from Excel ────────────────────────────────────────────────
export const bulkImportVisits = mutation({
    args: {
        visits: v.array(v.object({
            visitorRole: v.union(v.literal("coordinator"), v.literal("supervisor"), v.literal("deputy")),
            visitorName: v.string(),
            teacherName: v.string(),
            teacherDepartment: v.string(),
            subjectName: v.string(),
            className: v.string(),
            lessonTopic: v.string(),
            visitDate: v.string(),
            followUpType: v.union(v.literal("full"), v.literal("partial")),
            visitNumber: v.number(),
            ratings: v.string(),
            averageScore: v.number(),
            domainAverages: v.string(),
            planningRec: v.optional(v.string()),
            executionRec: v.optional(v.string()),
            evalMgmtRec: v.optional(v.string()),
            notes: v.optional(v.string()),
        })),
    },
    handler: async (ctx, args) => {
        const school = await getSchool(ctx);
        let inserted = 0;
        for (const v of args.visits) {
            await ctx.db.insert("supervisionVisits", {
                schoolId: school._id,
                ...v,
                status: "submitted",
                submittedAt: Date.now(),
                createdAt: Date.now(),
            });
            inserted++;
        }
        return { inserted };
    },
});
