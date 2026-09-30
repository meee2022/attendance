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
