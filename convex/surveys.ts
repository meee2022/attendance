import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const DEFAULT_SURVEY = {
    title: "استبانة حصر الاحتياجات التدريبية والمهنية لمعلم التربية الخاصة",
    description: "يرجى تحديد درجة احتياجك لكل بند وفق المقياس المرفق.",
    academicYear: "2025-2026",
    ratingLabels: ["لا أحتاج", "منخفض", "متوسط", "مرتفع", "مرتفع جداً"],
    sections: [
        {
            id: "s1",
            title: "المحور الأول: التخطيط للدرس",
            color: "#3b82f6",
            questions: [
                { id: "s1q1", text: "هل تحتاج إلى دعم في إعداد خطة درس مكتملة البنود وفق المتطلبات الأكاديمية والمهارية؟", type: "rating" as const },
                { id: "s1q2", text: "هل تحتاج إلى دعم في ربط أهداف الدرس اليومية بالأهداف طويلة المدى للخطة التربوية الفردية؟", type: "rating" as const },
                { id: "s1q3", text: "هل تحتاج إلى دعم في صياغة أهداف تعلم دقيقة وقابلة للقياس على المستويين الأكاديمي والمهاري؟", type: "rating" as const },
                { id: "s1q4", text: "هل تحتاج إلى دعم في تصميم أنشطة رئيسية واضحة ومتدرجة مرتبطة بأهداف الدرس؟", type: "rating" as const },
            ],
        },
        {
            id: "s2",
            title: "المحور الثاني: تنفيذ الدرس",
            color: "#10b981",
            questions: [
                { id: "s2q1", text: "هل تحتاج إلى دعم في تصميم أنشطة تمهيدية فعّالة تُهيّئ الطلاب لموضوع الدرس؟", type: "rating" as const },
                { id: "s2q2", text: "هل تحتاج إلى دعم في تنظيم محتوى الدرس وعرضه بصورة واضحة ومترابطة؟", type: "rating" as const },
                { id: "s2q3", text: "هل تحتاج إلى دعم في تنويع طرائق التدريس واستراتيجياته المتمحورة حول الطالب؟", type: "rating" as const },
                { id: "s2q4", text: "هل تحتاج إلى دعم في توظيف الوسائل التعليمية والتكنولوجيا بصورة فعّالة داخل الحصة؟", type: "rating" as const },
                { id: "s2q5", text: "هل تحتاج إلى دعم في استخدام تدريبات وأنشطة مرنة تناسب احتياجات الطلاب الفردية؟", type: "rating" as const },
                { id: "s2q6", text: "هل تحتاج إلى دعم في تنمية مهارات الطلبة الحياتية والتواصلية والاجتماعية أثناء الدرس؟", type: "rating" as const },
                { id: "s2q7", text: "هل تحتاج إلى دعم في توظيف مصادر التعلم الرئيسة والمساندة بصورة واضحة وسليمة؟", type: "rating" as const },
                { id: "s2q8", text: "هل تحتاج إلى دعم في تقديم المادة العلمية بدقة وملاءمتها لمستوى الطلاب وأهدافهم؟", type: "rating" as const },
                { id: "s2q9", text: "هل تحتاج إلى دعم في مراعاة الفروق الفردية بين طلاب المجموعة الواحدة أثناء التدريس؟", type: "rating" as const },
            ],
        },
        {
            id: "s3",
            title: "المحور الثالث: التقويم والمتابعة",
            color: "#f59e0b",
            questions: [
                { id: "s3q1", text: "هل تحتاج إلى دعم في تنويع أساليب التقويم القبلي والبنائي والختامي بما يناسب طلاب التربية الخاصة؟", type: "rating" as const },
                { id: "s3q2", text: "هل تحتاج إلى دعم في متابعة أعمال الطلبة وتصحيحها بدقة ومنهجية؟", type: "rating" as const },
                { id: "s3q3", text: "هل تحتاج إلى دعم في تقديم تغذية راجعة متنوعة ومستمرة تدعم تقدم الطلاب؟", type: "rating" as const },
                { id: "s3q4", text: "هل تحتاج إلى دعم في تفعيل دفتر المتابعة والواجبات المدرسية على المستويين الأكاديمي والمهاري؟", type: "rating" as const },
            ],
        },
        {
            id: "s4",
            title: "المحور الرابع: الجانب السلوكي والمهاري",
            color: "#ec4899",
            questions: [
                { id: "s4q1", text: "هل تحتاج إلى دعم في تقويم الجانب السلوكي للطلاب وفق خططهم التربوية الفردية؟", type: "rating" as const },
                { id: "s4q2", text: "هل تحتاج إلى دعم في اختيار وتطبيق استراتيجيات مناسبة لتحقيق الأهداف المهارية؟", type: "rating" as const },
                { id: "s4q3", text: "هل تحتاج إلى دعم في تصميم وتفعيل أنشطة صفية وغير صفية مرتبطة بالأهداف المهارية؟", type: "rating" as const },
                { id: "s4q4", text: "هل تحتاج إلى دعم في انتقاء الأدوات والوسائل الملائمة لتحقيق الأهداف المهارية؟", type: "rating" as const },
            ],
        },
        {
            id: "s5",
            title: "المحور الخامس: الإدارة الصفية وبيئة التعلم",
            color: "#8b5cf6",
            questions: [
                { id: "s5q1", text: "هل تحتاج إلى دعم في بناء بيئة صفية إيجابية وآمنة وداعمة لتعلم طلاب التربية الخاصة؟", type: "rating" as const },
                { id: "s5q2", text: "هل تحتاج إلى دعم في إدارة أنشطة التعلم والمشاركات الصفية بصورة منظمة وفعّالة؟", type: "rating" as const },
                { id: "s5q3", text: "هل تحتاج إلى دعم في تفعيل قوانين إدارة الصف وأساليب ضبط السلوك؟", type: "rating" as const },
                { id: "s5q4", text: "هل تحتاج إلى دعم في استثمار زمن الحصة الدراسية بأقصى فاعلية ممكنة؟", type: "rating" as const },
            ],
        },
        {
            id: "s6",
            title: "المحور السادس: التعاون بين المعلم والمساعد",
            color: "#f97316",
            questions: [
                { id: "s6q1", text: "هل تحتاج إلى دعم في وضع خطة تنسيق مسبقة وواضحة مع مساعد المعلم قبل بدء الحصة؟", type: "rating" as const },
                { id: "s6q2", text: "هل تحتاج إلى دعم في توزيع أدوار الدعم الجماعي والفردي للطلاب بينك وبين المساعد؟", type: "rating" as const },
                { id: "s6q3", text: "هل تحتاج إلى دعم في تنسيق إعداد المواد والأدوات التعليمية اللازمة للحصة مع المساعد؟", type: "rating" as const },
                { id: "s6q4", text: "هل تحتاج إلى دعم في إدارة الصف بشكل مشترك مع المساعد لضمان بيئة منظمة وآمنة؟", type: "rating" as const },
            ],
        },
        {
            id: "s7",
            title: "نوع الدعم والتطوير المفضّل",
            color: "#6366f1",
            questions: [
                { id: "s7q1", text: "التدريب والتأهيل", type: "multicheck" as const, options: ["ورشة عمل داخلية", "دورة تدريبية خارجية", "تعلم إلكتروني ذاتي", "مجتمع تعلم مهني", "حضور مؤتمر متخصص"] },
                { id: "s7q2", text: "الإشراف والمتابعة", type: "multicheck" as const, options: ["زيارة إشرافية متابعة", "ملاحظة صفية من زميل", "تدريب ميداني (Coaching)", "إشراف تشاركي مع معلم خبير", "تحليل تسجيلات صفية"] },
                { id: "s7q3", text: "الموارد والأدوات", type: "multicheck" as const, options: ["أدوات وموارد تعليمية", "دليل استراتيجيات التدريس", "بنك أنشطة التربية الخاصة", "نماذج تخطيط محدّثة", "مكتبة فيديوهات تعليمية"] },
            ],
        },
        {
            id: "s8",
            title: "الموضوعات التدريبية التي تقترحها",
            color: "#14b8a6",
            questions: [{ id: "s8q1", text: "اكتب هنا الموضوعات أو المجالات التي تودّ التطور فيها", type: "textarea" as const }],
        },
        {
            id: "s9",
            title: "ملاحظات وإضافات",
            color: "#64748b",
            questions: [{ id: "s9q1", text: "أي ملاحظات أو تعليقات إضافية", type: "textarea" as const }],
        },
    ],
};

export const getActiveSurvey = query({
    args: {},
    handler: async (ctx) => {
        const school = await ctx.db.query("schools").first();
        if (!school) return null;
        return ctx.db.query("surveys")
            .withIndex("by_school", q => q.eq("schoolId", school._id))
            .filter(q => q.eq(q.field("isActive"), true))
            .first();
    },
});

export const seedDefaultSurvey = mutation({
    args: {},
    handler: async (ctx) => {
        const school = await ctx.db.query("schools").first();
        if (!school) throw new Error("لا توجد مدرسة");

        const existing = await ctx.db.query("surveys")
            .withIndex("by_school", q => q.eq("schoolId", school._id))
            .first();
        if (existing) return existing._id;

        return ctx.db.insert("surveys", {
            schoolId: school._id,
            ...DEFAULT_SURVEY,
            isActive: true,
        });
    },
});

export const resetSurvey = mutation({
    args: {},
    handler: async (ctx) => {
        const school = await ctx.db.query("schools").first();
        if (!school) throw new Error("لا توجد مدرسة");

        const surveys = await ctx.db.query("surveys")
            .withIndex("by_school", q => q.eq("schoolId", school._id))
            .collect();

        for (const survey of surveys) {
            const responses = await ctx.db.query("surveyResponses")
                .withIndex("by_survey", q => q.eq("surveyId", survey._id))
                .collect();
            for (const r of responses) await ctx.db.delete(r._id);
            await ctx.db.delete(survey._id);
        }

        return ctx.db.insert("surveys", {
            schoolId: school._id,
            ...DEFAULT_SURVEY,
            isActive: true,
        });
    },
});

export const updateSurveyAxes = mutation({
    args: {
        surveyId: v.id("surveys"),
        title: v.string(),
        axes: v.array(v.string()),
    },
    handler: async (ctx, args) => {
        const COLORS = ["#3b82f6","#10b981","#f59e0b","#ec4899","#8b5cf6","#f97316","#14b8a6","#6366f1","#ef4444","#64748b"];
        const sections = args.axes
            .filter(a => a.trim())
            .map((title, i) => ({
                id: `s${i + 1}`,
                title: title.trim(),
                color: COLORS[i % COLORS.length],
                questions: [{ id: `s${i + 1}q1`, text: "", type: "rating" as const }],
            }));
        await ctx.db.patch(args.surveyId, { title: args.title.trim(), sections });
    },
});

export const toggleSurveyActive = mutation({
    args: { surveyId: v.id("surveys"), isActive: v.boolean() },
    handler: async (ctx, args) => {
        await ctx.db.patch(args.surveyId, { isActive: args.isActive });
    },
});

export const getRespondents = query({
    args: { surveyId: v.id("surveys") },
    handler: async (ctx, args) => {
        return ctx.db.query("surveyRespondents")
            .withIndex("by_survey", q => q.eq("surveyId", args.surveyId))
            .collect();
    },
});

export const addRespondent = mutation({
    args: {
        surveyId: v.id("surveys"),
        name: v.string(),
        department: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const school = await ctx.db.query("schools").first();
        if (!school) throw new Error("لا توجد مدرسة");

        const existing = await ctx.db.query("surveyRespondents")
            .withIndex("by_survey", q => q.eq("surveyId", args.surveyId))
            .filter(q => q.eq(q.field("name"), args.name))
            .first();
        if (existing) throw new Error("المعلم مضاف مسبقاً");

        return ctx.db.insert("surveyRespondents", {
            schoolId: school._id,
            surveyId: args.surveyId,
            name: args.name,
            department: args.department,
            hasResponded: false,
        });
    },
});

export const removeRespondent = mutation({
    args: { respondentId: v.id("surveyRespondents") },
    handler: async (ctx, args) => {
        const response = await ctx.db.query("surveyResponses")
            .withIndex("by_respondent", q => q.eq("respondentId", args.respondentId))
            .first();
        if (response) await ctx.db.delete(response._id);
        await ctx.db.delete(args.respondentId);
    },
});

export const getRespondentResponse = query({
    args: { respondentId: v.id("surveyRespondents") },
    handler: async (ctx, args) => {
        return ctx.db.query("surveyResponses")
            .withIndex("by_respondent", q => q.eq("respondentId", args.respondentId))
            .first();
    },
});

export const submitResponse = mutation({
    args: {
        respondentId: v.id("surveyRespondents"),
        subject: v.optional(v.string()),
        yearsExperience: v.optional(v.string()),
        qualification: v.optional(v.string()),
        responseDate: v.optional(v.string()),
        answers: v.string(),
    },
    handler: async (ctx, args) => {
        const respondent = await ctx.db.get(args.respondentId);
        if (!respondent) throw new Error("المعلم غير موجود");

        const school = await ctx.db.query("schools").first();
        if (!school) throw new Error("لا توجد مدرسة");

        const existing = await ctx.db.query("surveyResponses")
            .withIndex("by_respondent", q => q.eq("respondentId", args.respondentId))
            .first();

        const data = {
            schoolId: school._id,
            surveyId: respondent.surveyId,
            respondentId: args.respondentId,
            teacherName: respondent.name,
            department: respondent.department,
            subject: args.subject,
            yearsExperience: args.yearsExperience,
            qualification: args.qualification,
            responseDate: args.responseDate,
            answers: args.answers,
            submittedAt: Date.now(),
        };

        if (existing) {
            await ctx.db.patch(existing._id, data);
        } else {
            await ctx.db.insert("surveyResponses", data);
        }

        await ctx.db.patch(args.respondentId, { hasResponded: true });
    },
});

export const getAllResponses = query({
    args: { surveyId: v.id("surveys") },
    handler: async (ctx, args) => {
        return ctx.db.query("surveyResponses")
            .withIndex("by_survey", q => q.eq("surveyId", args.surveyId))
            .collect();
    },
});

export const updateRespondent = mutation({
    args: {
        respondentId: v.id("surveyRespondents"),
        name: v.string(),
        department: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        await ctx.db.patch(args.respondentId, { name: args.name.trim(), department: args.department?.trim() || undefined });
        // Keep teacherName in sync in any existing response
        const response = await ctx.db.query("surveyResponses")
            .withIndex("by_respondent", q => q.eq("respondentId", args.respondentId))
            .first();
        if (response) {
            await ctx.db.patch(response._id, { teacherName: args.name.trim(), department: args.department?.trim() || undefined });
        }
    },
});

const SCHOOL_TEACHERS: { name: string; department: string }[] = [
    { name: "محمد ابراهيم محمد كمال", department: "منسق المشاريع الالكترونية" },
    { name: "مهدي بن محمد الخماسي", department: "مهندس مختبرات العلوم والتكنولوجيا" },
    { name: "محمد فؤاد محمود دومه", department: "فنون بصرية" },
    { name: "وائل محمد عبده نجم", department: "فنون بصرية" },
    { name: "احمد سعيد العلى", department: "مهارات حياتية" },
    { name: "أحمد الأحمد", department: "مهارات حياتية" },
    { name: "احمد جمال العبيد", department: "مرشد أكاديمي" },
    { name: "محمد رشيد عبدالله حاجى", department: "علوم شرعية" },
    { name: "محمد معاذ محمود قناعه", department: "علوم شرعية" },
    { name: "طه اسماعيل عبدالله", department: "علوم شرعية" },
    { name: "حسن عبدالسلام محمد ابوسريه", department: "علوم شرعية" },
    { name: "سائد سمير عدنان صالح", department: "علوم شرعية" },
    { name: "احمد حسن خلف لبابنه", department: "علوم شرعية" },
    { name: "محسن محمد احمد فرحات", department: "علوم شرعية" },
    { name: "يوسف مروان البواب", department: "لغة عربية" },
    { name: "محمد عايد عبدالله", department: "لغة عربية" },
    { name: "البشير بنمحمد بشطوله", department: "لغة عربية" },
    { name: "نور مرعي حسين الهدروسي", department: "لغة عربية" },
    { name: "نصر اسماعيل عبدالعزيز اسماعيل", department: "لغة عربية" },
    { name: "باسل مفلح علي الدلابيح", department: "لغة عربية" },
    { name: "احمد عبدالمنصف نصر محمود", department: "لغة عربية" },
    { name: "عباس الداخلى محمد عباس", department: "لغة عربية" },
    { name: "خالد حمدى محمد مهنى", department: "لغة عربية" },
    { name: "احمد راضي صالح شافعي", department: "لغة عربية" },
    { name: "زناتى محمد محمد حسين", department: "لغة عربية" },
    { name: "مصباح محمد علي حسين دسوقي", department: "لغة إنجليزية" },
    { name: "وليد محمود حامد احمد", department: "لغة إنجليزية" },
    { name: "سامح عبدالكريم عبدالله محمود", department: "لغة إنجليزية" },
    { name: "حسان احمد محمد ابوشمله", department: "لغة إنجليزية" },
    { name: "معاذ يوسف فالح حجازي", department: "لغة إنجليزية" },
    { name: "فوزي اتار", department: "لغة إنجليزية" },
    { name: "عمر فرح ارشيد ابو غزله", department: "لغة إنجليزية" },
    { name: "مراد بن الشاذلي الذوادي", department: "لغة إنجليزية" },
    { name: "كامل شرف كامل عبدالجابر", department: "لغة إنجليزية" },
    { name: "ابراهيم محمد محمد على", department: "لغة إنجليزية" },
    { name: "محسين خامحمد", department: "لغة إنجليزية" },
    { name: "فيصل زاهد الملحم", department: "رياضيات" },
    { name: "محمد عطيه حامد عبدالرحيم", department: "رياضيات" },
    { name: "محمد الشحات عبدالوهاب حسانين", department: "رياضيات" },
    { name: "ايمن يوسف عبدالرزاق حجازي", department: "رياضيات" },
    { name: "مراد زهير محمد نهاد عبدالمجيد", department: "رياضيات" },
    { name: "علي كليب عبد اللطيف العطار", department: "رياضيات" },
    { name: "رجب عبدالله عبدالعزيز محمود", department: "رياضيات" },
    { name: "محمد جابر الرحماني", department: "رياضيات" },
    { name: "احمد محمد عبدالحميد محروس", department: "رياضيات" },
    { name: "عادل بن صغير السمعلي", department: "رياضيات" },
    { name: "علي قره خالد", department: "رياضيات" },
    { name: "اشرف صبحي محمد اسماعيل عابدين", department: "أحياء" },
    { name: "رجاء سليمان محمد مصطفى سعد", department: "أحياء" },
    { name: "محمد على ابراهيم محمد احمد", department: "أحياء" },
    { name: "محمد صلاح محمد رزق نايل", department: "أحياء" },
    { name: "عاصم محمد عطاالله المطارنه", department: "أحياء" },
    { name: "يوسف محمد عبدالله طبل", department: "علوم" },
    { name: "حسام تيسير عبدالفتاح داغر", department: "علوم" },
    { name: "كرم احمد عمار اكرم قزعل", department: "علوم" },
    { name: "محمد مصطفى احمد سليمان", department: "فيزياء" },
    { name: "احمد الروبي تمام على", department: "فيزياء" },
    { name: "محمد سيف النصر احمد سيف", department: "فيزياء" },
    { name: "نبيل قاسم محمد جرادات", department: "فيزياء" },
    { name: "علي الصالح عبدالحمبد حاجي", department: "فيزياء" },
    { name: "محمد ربيع فهيم حماد", department: "كيمياء" },
    { name: "محمد عبد العظيم احمد جاد المولي", department: "كيمياء" },
    { name: "احمد يوسف اسماعيل منسي", department: "كيمياء" },
    { name: "امير غزلان", department: "كيمياء" },
    { name: "سامر كساب شحادة العبدالله", department: "كيمياء" },
    { name: "محمد كامل محمد عجاج", department: "كيمياء" },
    { name: "محمد احمد يسن ابراهيم", department: "علوم اجتماعية" },
    { name: "رجب محمد سعيد حموده", department: "علوم اجتماعية" },
    { name: "احمد محمد احمد ابراهيم", department: "علوم اجتماعية" },
    { name: "حاتم صالح مصطفى عامريه", department: "علوم اجتماعية" },
    { name: "أحمد عسكر أنور أحمد", department: "علوم اجتماعية" },
    { name: "طالب حمد الله عليان المصاروه", department: "علوم اجتماعية" },
    { name: "محمد هلال الغزاوي", department: "علوم اجتماعية" },
    { name: "محمد رضى موسي محمد خليل", department: "علوم اجتماعية" },
    { name: "محمدامين علي عبدالرحمن المحاسنه", department: "علوم اجتماعية" },
    { name: "محمد عباس مرسى ابوالعلا", department: "تكنولوجيا المعلومات" },
    { name: "محمد المهدي بورماش", department: "تكنولوجيا المعلومات" },
    { name: "حاتم المنوبي المنوبي", department: "تكنولوجيا المعلومات" },
    { name: "أسامة اليوسف", department: "تكنولوجيا المعلومات" },
    { name: "مصطفى السر فضل المولى احمد", department: "تكنولوجيا المعلومات" },
    { name: "فراس محمد احمد العبسي", department: "تكنولوجيا المعلومات" },
    { name: "السيد ابوالنور ابوالنور السيد عوف", department: "تربية رياضية" },
    { name: "غانم محمد عبدالرحمن احمد المحمودى", department: "تربية رياضية" },
    { name: "رائد اسعود موسى دييه", department: "تربية رياضية" },
    { name: "محمود عبدالرازق خليفه محمد عطيه", department: "تربية رياضية" },
    { name: "وجيه زغدود", department: "تربية رياضية" },
    { name: "هيثم محمد عبدالحميد حسن الدراوى", department: "الدعم الإضافي" },
    { name: "محمد معوض فرج ابراهيم", department: "الدعم الإضافي" },
    { name: "محمود سعيد حميد خليل", department: "الدعم الإضافي" },
    { name: "رجب احمد عبدالحميد احمد", department: "الدعم الإضافي" },
    { name: "محمود حسن محمد البيارى", department: "الدعم الإضافي" },
    { name: "احمد روبي عبدالعظيم موسى", department: "الدعم الإضافي" },
    { name: "احمد محمود حسن التعمرى", department: "الدعم الإضافي" },
    { name: "تامر على عبدالحكيم عبدالله", department: "الدعم الإضافي" },
    { name: "رفعت سالمان أحمد أبوسلمه محسن", department: "الدعم الإضافي" },
    { name: "عمر محمود مفلح الغانم", department: "الدعم الإضافي" },
];

export const importSchoolTeachers = mutation({
    args: { surveyId: v.id("surveys") },
    handler: async (ctx, args) => {
        const school = await ctx.db.query("schools").first();
        if (!school) throw new Error("لا توجد مدرسة");

        const existing = await ctx.db.query("surveyRespondents")
            .withIndex("by_survey", q => q.eq("surveyId", args.surveyId))
            .collect();
        const existingNames = new Set(existing.map(r => r.name));

        let added = 0;
        for (const t of SCHOOL_TEACHERS) {
            if (!existingNames.has(t.name)) {
                await ctx.db.insert("surveyRespondents", {
                    schoolId: school._id,
                    surveyId: args.surveyId,
                    name: t.name,
                    department: t.department,
                    hasResponded: false,
                });
                added++;
            }
        }
        return { added, skipped: SCHOOL_TEACHERS.length - added };
    },
});

export const deleteSurvey = mutation({
    args: { surveyId: v.id("surveys") },
    handler: async (ctx, args) => {
        const respondents = await ctx.db.query("surveyRespondents")
            .withIndex("by_survey", q => q.eq("surveyId", args.surveyId))
            .collect();
        for (const r of respondents) {
            const resp = await ctx.db.query("surveyResponses")
                .withIndex("by_respondent", q => q.eq("respondentId", r._id))
                .first();
            if (resp) await ctx.db.delete(resp._id);
            await ctx.db.delete(r._id);
        }
        await ctx.db.delete(args.surveyId);
    },
});
