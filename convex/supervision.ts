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
            // منع التعديل بعد توقيع المعلم
            if (existing.teacherSignedAt) {
                throw new Error("لا يمكن تعديل زيارة موقَّعة من المعلم");
            }
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
            // audit log
            await ctx.db.insert("supervisionAuditLog", {
                schoolId: school._id,
                visitId: args.id,
                action: args.status === "submitted" && !wasSubmitted ? "submitted" : "updated",
                actorRole: args.visitorRole,
                actorName: args.visitorName.trim(),
                details: `تعديل زيارة ${args.teacherName.trim()}`,
                timestamp: Date.now(),
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
        await ctx.db.insert("supervisionAuditLog", {
            schoolId: school._id,
            visitId: id,
            action: "created",
            actorRole: args.visitorRole,
            actorName: args.visitorName.trim(),
            details: `إنشاء زيارة لـ ${args.teacherName.trim()}`,
            timestamp: Date.now(),
        });
        return id;
    },
});

// ── Default school teachers from Excel ────────────────────────────────────
const SCHOOL_TEACHERS_SEED: { fullName: string; department: string; email: string }[] = [
    { fullName: "محمد رشيد عبدالله حاجى", department: "التربية الإسلامية", email: "m.haji0312@education.qa" },
    { fullName: "محمد معاذ محمود قناعه", department: "التربية الإسلامية", email: "m.kanaah0103@education.qa" },
    { fullName: "طه اسماعيل عبدالله", department: "التربية الإسلامية", email: "t.abdulla0607@education.qa" },
    { fullName: "حسن عبدالسلام محمد ابوسريه", department: "التربية الإسلامية", email: "h.abdelsalam1008@education.qa" },
    { fullName: "سائد سمير عدنان صالح", department: "التربية الإسلامية", email: "s.salih0103@education.qa" },
    { fullName: "احمد حسن خلف لبابنه", department: "التربية الإسلامية", email: "a.lababneh0111@education.qa" },
    { fullName: "محسن محمد احمد فرحات", department: "التربية الإسلامية", email: "m.farahat1401@education.qa" },
    { fullName: "يوسف مروان البواب", department: "اللغة العربية", email: "y.albawab0910@education.qa" },
    { fullName: "محمد عايد عبدالله", department: "اللغة العربية", email: "m.abdullah1905@education.qa" },
    { fullName: "البشير بنمحمد بشطوله", department: "اللغة العربية", email: "b.bachtoula1001@education.qa" },
    { fullName: "نور مرعي حسين الهدروسي", department: "اللغة العربية", email: "n.alhadrusi0808@education.qa" },
    { fullName: "نصر اسماعيل عبدالعزيز اسماعيل", department: "اللغة العربية", email: "n.ismail0201@education.qa" },
    { fullName: "باسل مفلح علي الدلابيح", department: "اللغة العربية", email: "b.aldalabeeh1307@education.qa" },
    { fullName: "احمد عبدالمنصف نصر محمود", department: "اللغة العربية", email: "a.mahmoud2312@education.qa" },
    { fullName: "عباس الداخلى محمد عباس", department: "اللغة العربية", email: "a.abbas0105@education.qa" },
    { fullName: "خالد حمدى محمد مهنى مهنى", department: "اللغة العربية", email: "k.mehanni0101@education.qa" },
    { fullName: "احمد راضي صالح شافعي", department: "اللغة العربية", email: "a.shafey0709@education.qa" },
    { fullName: "زناتى محمد محمد حسين", department: "اللغة العربية", email: "z.hussein0201@education.qa" },
    { fullName: "مصباح محمد علي حسين دسوقي", department: "اللغة الإنجليزية", email: "m.desoqi0101@education.qa" },
    { fullName: "وليد محمود حامد احمد", department: "اللغة الإنجليزية", email: "w.ahmed0106@education.qa" },
    { fullName: "سامح عبدالكريم عبدالله محمود", department: "اللغة الإنجليزية", email: "s.mahmoud0612@education.qa" },
    { fullName: "حسان احمد محمد ابوشمله", department: "اللغة الإنجليزية", email: "h.abushamleh0101@education.qa" },
    { fullName: "معاذ يوسف فالح حجازي", department: "اللغة الإنجليزية", email: "m.hijazi0401@education.qa" },
    { fullName: "فوزي اتار", department: "اللغة الإنجليزية", email: "f.atar0306@education.qa" },
    { fullName: "عمر فرح ارشيد ابو غزله", department: "اللغة الإنجليزية", email: "o.ghazleh2210@education.qa" },
    { fullName: "مراد بن الشاذلي الذوادي", department: "اللغة الإنجليزية", email: "m.dhaouadi0211@education.qa" },
    { fullName: "كامل شرف كامل عبدالجابر", department: "اللغة الإنجليزية", email: "k.abdelgaer1603@education.qa" },
    { fullName: "ابراهيم محمد محمد على", department: "اللغة الإنجليزية", email: "i.ali1611@education.qa" },
    { fullName: "محسين خامحمد", department: "اللغة الإنجليزية", email: "m.khamhammed1607@education.qa" },
    { fullName: "فيصل زاهد الملحم", department: "الرياضيات", email: "f.almulhem0604@education.qa" },
    { fullName: "محمد عطيه حامد عبدالرحيم", department: "الرياضيات", email: "m.hamed1008@education.qa" },
    { fullName: "محمد الشحات عبدالوهاب حسانين", department: "الرياضيات", email: "m.hassanein2411@education.qa" },
    { fullName: "ايمن يوسف عبدالرزاق حجازي", department: "الرياضيات", email: "a.hijazi2310@education.qa" },
    { fullName: "مراد زهير محمد نهاد عبدالمجيد", department: "الرياضيات", email: "m.abdelmajid2006@education.qa" },
    { fullName: "علي كليب عبد اللطيف العطار", department: "الرياضيات", email: "a.elattar1801@education.qa" },
    { fullName: "رجب عبدالله عبدالعزيز محمود", department: "الرياضيات", email: "r.mahmoud0207@education.qa" },
    { fullName: "محمد جابر الرحماني", department: "الرياضيات", email: "m.rahmeni2911@education.qa" },
    { fullName: "احمد محمد عبدالحميد محروس", department: "الرياضيات", email: "a.mahrouh0309@education.qa" },
    { fullName: "عادل بن صغير السمعلي", department: "الرياضيات", email: "a.samaali1505@education.qa" },
    { fullName: "علي قره خالد", department: "الرياضيات", email: "a.karahalit1501@education.qa" },
    { fullName: "اشرف صبحي محمد اسماعيل عابدين", department: "الأحياء", email: "a.abdeen1605@education.qa" },
    { fullName: "رجاء سليمان محمد مصطفى سعد", department: "الأحياء", email: "r.saad2001@education.qa" },
    { fullName: "محمد على ابراهيم محمد احمد", department: "الأحياء", email: "m.ahmed0108@education.qa" },
    { fullName: "محمد صلاح محمد رزق نايل", department: "الأحياء", email: "m.naiel0108@education.qa" },
    { fullName: "عاصم محمد عطاالله المطارنه", department: "الأحياء", email: "a.almatarneh0610@education.qa" },
    { fullName: "حسام تيسير عبدالفتاح داغر", department: "الأحياء", email: "h.dagher0102@education.qa" },
    { fullName: "يوسف محمد عبدالله طبل", department: "الكيمياء", email: "y.tabl0112@education.qa" },
    { fullName: "كرم احمد عمار اكرم قزعل", department: "الكيمياء", email: "k.kazeal0205@education.qa" },
    { fullName: "محمد ربيع فهيم حماد", department: "الكيمياء", email: "m.hammad1012@education.qa" },
    { fullName: "محمد عبد العظيم احمد جاد المولي", department: "الكيمياء", email: "m.elmawla1404@education.qa" },
    { fullName: "احمد يوسف اسماعيل منسي", department: "الكيمياء", email: "a.mansi0112@education.qa" },
    { fullName: "امير غزلان", department: "الكيمياء", email: "a.ghuzlaan1604@education.qa" },
    { fullName: "سامر كساب شحادة العبدالله", department: "الكيمياء", email: "s.alabdallah0103@education.qa" },
    { fullName: "محمد كامل محمد عجاج", department: "الكيمياء", email: "m.ajaj3012@education.qa" },
    { fullName: "محمد مصطفى احمد سليمان", department: "الفيزياء", email: "m.suliman2404@education.qa" },
    { fullName: "احمد الروبي تمام على", department: "الفيزياء", email: "a.aly2903@education.qa" },
    { fullName: "محمد سيف النصر احمد سيف", department: "الفيزياء", email: "m.seif0909@education.qa" },
    { fullName: "نبيل قاسم محمد جرادات", department: "الفيزياء", email: "n.jaradat0109@education.qa" },
    { fullName: "علي الصالح عبدالحمبد حاجي", department: "الفيزياء", email: "a.hajji27121@education.qa" },
    { fullName: "محمد احمد يسن ابراهيم", department: "العلوم الاجتماعية", email: "m.ibrahim1102@education.qa" },
    { fullName: "رجب محمد سعيد حموده", department: "العلوم الاجتماعية", email: "r.hammouda0204@education.qa" },
    { fullName: "احمد محمد احمد ابراهيم", department: "العلوم الاجتماعية", email: "a.ibrahim1102@education.qa" },
    { fullName: "حاتم صالح مصطفى عامريه", department: "العلوم الاجتماعية", email: "h.amryeh3010@education.qa" },
    { fullName: "أحمد عسكر أنور أحمد", department: "العلوم الاجتماعية", email: "a.ahmed2910@education.qa" },
    { fullName: "طالب حمد الله عليان المصاروه", department: "العلوم الاجتماعية", email: "t.almasarweh0405@education.qa" },
    { fullName: "محمد هلال الغزاوي", department: "العلوم الاجتماعية", email: "m.alghezawi0104@education.qa" },
    { fullName: "محمد رضى موسي محمد خليل", department: "العلوم الاجتماعية", email: "m.khalil1404@education.qa" },
    { fullName: "محمدامين علي عبدالرحمن المحاسنه", department: "العلوم الاجتماعية", email: "m.almahasneh2610@education.qa" },
    { fullName: "محمد عباس مرسى ابوالعلا", department: "الحوسبة وتكنولوجيا المعلومات", email: "m.abouelela0609@education.qa" },
    { fullName: "محمد المهدي بورماش", department: "الحوسبة وتكنولوجيا المعلومات", email: "m.bourmeche2309@education.qa" },
    { fullName: "حاتم المنوبي المنوبي", department: "الحوسبة وتكنولوجيا المعلومات", email: "h.mannoubi2012@education.qa" },
    { fullName: "أسامة اليوسف", department: "الحوسبة وتكنولوجيا المعلومات", email: "u.alyousf2409@education.qa" },
    { fullName: "مصطفى السر فضل المولى احمد", department: "الحوسبة وتكنولوجيا المعلومات", email: "m.ahmed29083@education.qa" },
    { fullName: "فراس محمد أحمد العبسي", department: "الحوسبة وتكنولوجيا المعلومات", email: "f.alabsi2510@education.qa" },
    { fullName: "السيد ابوالنور ابوالنور السيد عوف", department: "التربية الرياضية", email: "e.ouf2512@education.qa" },
    { fullName: "غانم محمد عبدالرحمن احمد المحمودى", department: "التربية الرياضية", email: "g.mahmoudi2308@education.qa" },
    { fullName: "رائد اسعود موسى دييه", department: "التربية الرياضية", email: "r.deebh1003@education.qa" },
    { fullName: "محمود عبدالرازق خليفه محمد عطيه", department: "التربية الرياضية", email: "m.attia12021@education.qa" },
    { fullName: "وجيه زغدود", department: "التربية الرياضية", email: "w.zaghdoud0405@education.qa" },
    { fullName: "احمد سعيد العلى", department: "المهارات الحياتية", email: "a.alali2801@education.qa" },
    { fullName: "أحمد الأحمد", department: "المهارات الحياتية", email: "a.elahmed1505@education.qa" },
    { fullName: "احمد جمال العبيد", department: "المهارات الحياتية", email: "a.alobeid1010@education.qa" },
];

const COORDINATORS_SEED: { department: string; coordinator: string; supervisor?: string }[] = [
    { department: "التربية الإسلامية", coordinator: "محمد رشيد عبدالله حاجى" },
    { department: "اللغة العربية", coordinator: "يوسف مروان البواب" },
    { department: "اللغة الإنجليزية", coordinator: "مصباح محمد علي حسين دسوقي" },
    { department: "الرياضيات", coordinator: "فيصل زاهد الملحم", supervisor: "حاتم الضاوي" },
    { department: "الأحياء", coordinator: "اشرف صبحي محمد اسماعيل عابدين" },
    { department: "الكيمياء", coordinator: "محمد ربيع فهيم حماد" },
    { department: "الفيزياء", coordinator: "محمد مصطفى احمد سليمان" },
    { department: "العلوم الاجتماعية", coordinator: "محمد احمد يسن ابراهيم" },
    { department: "الحوسبة وتكنولوجيا المعلومات", coordinator: "محمد عباس مرسى ابوالعلا" },
    { department: "التربية الرياضية", coordinator: "السيد ابوالنور ابوالنور السيد عوف" },
];

export const seedSchoolTeachersDefault = mutation({
    args: { clearExisting: v.optional(v.boolean()) },
    handler: async (ctx, args) => {
        const school = await getSchool(ctx);
        if (args.clearExisting) {
            const existing = await ctx.db.query("schoolTeachers")
                .withIndex("by_school", q => q.eq("schoolId", school._id))
                .collect();
            for (const t of existing) await ctx.db.delete(t._id);
        }
        const existing = await ctx.db.query("schoolTeachers")
            .withIndex("by_school", q => q.eq("schoolId", school._id))
            .collect();
        const existingNames = new Set(existing.map(t => t.fullName));
        let added = 0, skipped = 0;
        for (const t of SCHOOL_TEACHERS_SEED) {
            if (existingNames.has(t.fullName)) { skipped++; continue; }
            await ctx.db.insert("schoolTeachers", {
                schoolId: school._id,
                fullName: t.fullName,
                department: t.department,
                email: t.email || undefined,
                isActive: true,
            });
            added++;
        }
        // Seed coordinators as supervisors
        const existingSupervisors = await ctx.db.query("supervisors")
            .withIndex("by_school", q => q.eq("schoolId", school._id))
            .collect();
        const existingSupNames = new Set(existingSupervisors.map(s => `${s.fullName}|${s.role}`));
        for (const c of COORDINATORS_SEED) {
            const coordKey = `${c.coordinator}|coordinator`;
            if (!existingSupNames.has(coordKey)) {
                await ctx.db.insert("supervisors", {
                    schoolId: school._id,
                    fullName: c.coordinator,
                    role: "coordinator",
                    subjects: [c.department],
                    isActive: true,
                });
            }
            if (c.supervisor) {
                const supKey = `${c.supervisor}|supervisor`;
                if (!existingSupNames.has(supKey)) {
                    await ctx.db.insert("supervisors", {
                        schoolId: school._id,
                        fullName: c.supervisor,
                        role: "supervisor",
                        subjects: [c.department],
                        isActive: true,
                    });
                }
            }
        }
        return { added, skipped, total: SCHOOL_TEACHERS_SEED.length };
    },
});

// ── School Teachers (مصدر الحقيقة الموحد) ────────────────────────────────
export const getSchoolTeachers = query({
    args: {},
    handler: async (ctx) => {
        const school = await ctx.db.query("schools").first();
        if (!school) return [];
        const teachers = await ctx.db.query("schoolTeachers")
            .withIndex("by_school", q => q.eq("schoolId", school._id))
            .collect();
        return teachers.filter(t => t.isActive !== false);
    },
});

export const importSchoolTeachersBulk = mutation({
    args: {
        teachers: v.array(v.object({
            fullName: v.string(),
            department: v.string(),
            email: v.optional(v.string()),
            phone: v.optional(v.string()),
            teachingClasses: v.optional(v.array(v.string())),
        })),
        clearExisting: v.optional(v.boolean()),
    },
    handler: async (ctx, args) => {
        const school = await getSchool(ctx);
        if (args.clearExisting) {
            const existing = await ctx.db.query("schoolTeachers")
                .withIndex("by_school", q => q.eq("schoolId", school._id))
                .collect();
            for (const t of existing) await ctx.db.delete(t._id);
        }
        let added = 0, skipped = 0;
        const existing = await ctx.db.query("schoolTeachers")
            .withIndex("by_school", q => q.eq("schoolId", school._id))
            .collect();
        const existingNames = new Set(existing.map(t => t.fullName));
        for (const t of args.teachers) {
            if (existingNames.has(t.fullName.trim())) { skipped++; continue; }
            await ctx.db.insert("schoolTeachers", {
                schoolId: school._id,
                fullName: t.fullName.trim(),
                department: t.department.trim(),
                email: t.email?.trim() || undefined,
                phone: t.phone?.trim() || undefined,
                teachingClasses: t.teachingClasses,
                isActive: true,
            });
            added++;
        }
        return { added, skipped };
    },
});

export const addSchoolTeacher = mutation({
    args: { fullName: v.string(), department: v.string(), email: v.optional(v.string()), phone: v.optional(v.string()) },
    handler: async (ctx, args) => {
        const school = await getSchool(ctx);
        await ctx.db.insert("schoolTeachers", {
            schoolId: school._id,
            fullName: args.fullName.trim(),
            department: args.department.trim(),
            email: args.email?.trim() || undefined,
            phone: args.phone?.trim() || undefined,
            isActive: true,
        });
    },
});

export const updateSchoolTeacher = mutation({
    args: {
        id: v.id("schoolTeachers"),
        fullName: v.optional(v.string()),
        department: v.optional(v.string()),
        email: v.optional(v.string()),
        phone: v.optional(v.string()),
        teachingClasses: v.optional(v.array(v.string())),
        isActive: v.optional(v.boolean()),
    },
    handler: async (ctx, args) => {
        const patch: any = {};
        if (args.fullName !== undefined) patch.fullName = args.fullName.trim();
        if (args.department !== undefined) patch.department = args.department.trim();
        if (args.email !== undefined) patch.email = args.email.trim() || undefined;
        if (args.phone !== undefined) patch.phone = args.phone.trim() || undefined;
        if (args.teachingClasses !== undefined) patch.teachingClasses = args.teachingClasses;
        if (args.isActive !== undefined) patch.isActive = args.isActive;
        await ctx.db.patch(args.id, patch);
    },
});

export const deleteSchoolTeacher = mutation({
    args: { id: v.id("schoolTeachers") },
    handler: async (ctx, args) => { await ctx.db.delete(args.id); },
});

// ── Audit Log ─────────────────────────────────────────────────────────────
export const getAuditLog = query({
    args: { visitId: v.optional(v.id("supervisionVisits")), limit: v.optional(v.number()) },
    handler: async (ctx, args) => {
        const school = await ctx.db.query("schools").first();
        if (!school) return [];
        let q;
        if (args.visitId) {
            q = ctx.db.query("supervisionAuditLog").withIndex("by_visit", x => x.eq("visitId", args.visitId!));
        } else {
            q = ctx.db.query("supervisionAuditLog").withIndex("by_school", x => x.eq("schoolId", school._id));
        }
        const all = await q.collect();
        const sorted = all.sort((a, b) => b.timestamp - a.timestamp);
        return args.limit ? sorted.slice(0, args.limit) : sorted;
    },
});

// ── Improvement Plans ─────────────────────────────────────────────────────
export const getImprovementPlans = query({
    args: { teacherName: v.optional(v.string()) },
    handler: async (ctx, args) => {
        const school = await ctx.db.query("schools").first();
        if (!school) return [];
        if (args.teacherName) {
            return ctx.db.query("teacherImprovementPlans")
                .withIndex("by_teacher", q => q.eq("schoolId", school._id).eq("teacherName", args.teacherName!))
                .collect();
        }
        return ctx.db.query("teacherImprovementPlans")
            .withIndex("by_school", q => q.eq("schoolId", school._id))
            .collect();
    },
});

export const createImprovementPlan = mutation({
    args: {
        teacherName: v.string(),
        relatedVisitId: v.optional(v.id("supervisionVisits")),
        weakAreas: v.array(v.string()),
        actionItems: v.array(v.string()),
        targetDate: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const school = await getSchool(ctx);
        await ctx.db.insert("teacherImprovementPlans", {
            schoolId: school._id,
            teacherName: args.teacherName.trim(),
            relatedVisitId: args.relatedVisitId,
            weakAreas: args.weakAreas,
            actionItems: args.actionItems,
            targetDate: args.targetDate,
            status: "active",
            createdAt: Date.now(),
            updatedAt: Date.now(),
        });
    },
});

export const updateImprovementPlanStatus = mutation({
    args: { id: v.id("teacherImprovementPlans"), status: v.union(v.literal("active"), v.literal("achieved"), v.literal("cancelled")) },
    handler: async (ctx, args) => {
        await ctx.db.patch(args.id, { status: args.status, updatedAt: Date.now() });
    },
});

export const deleteImprovementPlan = mutation({
    args: { id: v.id("teacherImprovementPlans") },
    handler: async (ctx, args) => { await ctx.db.delete(args.id); },
});

export const deleteVisit = mutation({
    args: { id: v.id("supervisionVisits"), actorRole: v.optional(v.string()), actorName: v.optional(v.string()) },
    handler: async (ctx, args) => {
        const v = await ctx.db.get(args.id);
        if (v?.teacherSignedAt) throw new Error("لا يمكن حذف زيارة موقَّعة");
        const school = await ctx.db.query("schools").first();
        if (school && v) {
            await ctx.db.insert("supervisionAuditLog", {
                schoolId: school._id,
                visitId: args.id,
                action: "deleted",
                actorRole: args.actorRole,
                actorName: args.actorName,
                details: `حذف زيارة ${v.teacherName}`,
                timestamp: Date.now(),
            });
        }
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
