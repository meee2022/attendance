// Ministry criteria shared by setup and the supported PDF template reader.
export const DEFAULT_CRITERIA: { domain: "planning" | "execution" | "evaluation" | "management"; text: string }[] = [
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

// «استمارة الإشراف على أداء معلم التربية الخاصة/ معلم الدعم الإضافي» (form 12
// of the special-education section): its own 21 criteria in five domains,
// rated 1–5 with no «لم يتم قياسه». Fixed in code, so its ids never change.
export const SUPPORT_DEPARTMENT = "الدعم الإضافي";
export const isSupportDepartment = (department?: string | null) => (department ?? "").trim() === SUPPORT_DEPARTMENT;

export const SUPPORT_DOMAINS = ["planning", "execution", "management", "behavior", "evaluation"] as const;
export const SUPPORT_DOMAIN_LABELS: Record<(typeof SUPPORT_DOMAINS)[number], string> = {
    planning: "التخطيط",
    execution: "تنفيذ الدرس",
    management: "الإدارة الصفية",
    behavior: "الجانب السلوكي والمهاري",
    evaluation: "التقويم",
};

export const SUPPORT_CRITERIA: { _id: string; domain: (typeof SUPPORT_DOMAINS)[number]; text: string; order: number; max: 5 }[] = ([
    ["planning", "خطة الدرس متوفرة وبنودها مستكملة"],
    ["planning", "أهداف الدرس مخططة في ضوء الأهداف طويلة المدى"],
    ["planning", "أهداف التعلم مصاغة بشكل صحيح وقابلة للقياس"],
    ["execution", "أنشطة التمهيد مفعلة بشكل مناسب"],
    ["execution", "استخدام استراتيجيات مناسبة لموضوع الدرس ولمستوى الطالب"],
    ["execution", "استخدام أدوات ووسائل مناسبة لموضوع الدرس"],
    ["execution", "استخدام تدريبات وأنشطة مرنة"],
    ["execution", "مصادر التعلم المساندة موظفة بصورة واضحة وسليمة"],
    ["execution", "المادة العلمية دقيقة ومناسبة"],
    ["execution", "مراعاة الفروق الفردية بين الطلاب في نفس المجموعة"],
    ["execution", "التكامل بين المواد والخدمات المساندة بما يتناسب مع الطلبة."],
    ["management", "البيئة الصفية إيجابية وآمنة وداعمة للتعلم"],
    ["management", "استثمار وقت الحصة بفاعلية"],
    ["management", "قوانين إدارة الصف وإدارة السلوك مفعلة"],
    ["management", "إدارة أنشطة التعلم واستجابات الطلبة بصورة منظمة وفاعلة."],
    ["behavior", "تقويم الجانب السلوكي للطلاب (وفقاً للخطة التربوية الفردية)"],
    ["behavior", "تعزيز السلوكيات المرغوبة والحد من السلوكيات غير المرغوبة."],
    ["behavior", "تنمية مهارات الطلاب (اللغة - المهارات الحياتية – التفاعل الاجتماعي– مهارات التواصل - ....)"],
    ["evaluation", "أساليب التقويم (القبلي والبنائي والختامي) مناسبة ومتنوعة"],
    ["evaluation", "أعمال الطلبة متابعة ومصححة بدقة."],
    ["evaluation", "تفعيل دفتر المتابعة والواجبات المدرسية"],
] as const).map(([domain, text], i) => ({ _id: `sp${String(i + 1).padStart(2, "0")}`, domain, text, order: i + 1, max: 5 as const }));

// The domains a teacher's form has, in the order the form lists them
export const domainList = (support: boolean): [string, string][] =>
    (support ? [...SUPPORT_DOMAINS] : ["planning", "execution", "evaluation", "management"] as const)
        .map(d => [d, SUPPORT_DOMAIN_LABELS[d]]);

// The form's key, printed at its foot
export const SUPPORT_SCALE = [
    { value: 1, label: "ضعيف" }, { value: 2, label: "مقبول" }, { value: 3, label: "جيد" },
    { value: 4, label: "جيد جداً" }, { value: 5, label: "ممتاز" },
] as const;
