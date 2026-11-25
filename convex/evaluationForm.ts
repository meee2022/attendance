// «استمارة تقييم أداء المعلم»: the yearly appraisal every department fills on
// the same sheet. Seven domains, 34 indicators, each with its «الدرجة المقررة»;
// they add up to 100 and the total names the level. Shared by the server (which
// validates and totals) and the pages (which show the same numbers live).

export const EVALUATION_DOMAINS: { title: string; percent: number; indicators: [text: string, max: number][] }[] = [
    { title: "التخطيط لتطوير أداء وتحصيل الطلبة", percent: 15, indicators: [
        ["وضع أهداف تعلم قابلة للقياس وتعكس المنهج المقرر.", 3],
        ["اختيار مجموعة من مصادر التعليم والتعلم المساندة لتحقيق أهداف المنهج.", 3],
        ["مراعاة كافة فئات الطلبة المختلفة بمن فيهم (المتفوقون –الموهوبون –التربية الخاصة) في عمليات التخطيط.", 3],
        ["توظيف بيانات الطلبة للتخطيط لتقدمهم.", 2],
        ["اختيار إستراتيجيات تدريس وأنشطة صفية تتميز بالمرونة والحداثة.", 4],
    ] },
    { title: "إشراك الطلبة في عملية التعلم وتطويرهم كمتعلمين", percent: 25, indicators: [
        ["إشراك الطلبة في تعلم فاعل ومثير للتحدي.", 4],
        ["استخدام مجموعة متنوعة من الأنشطة ومصادر التعلم المساندة.", 4],
        ["إكساب الطلبة خبرات تعلم تلبي احتياجاتهم واهتماماتهم.", 4],
        ["تنمية مهارات الطلبة اللغوية والحسابية.", 4],
        ["تطوير قدرة الطالب كمتعلم مستقل.", 3],
        ["تطوير مهارات التفكير العليا لدى الطلبة.", 4],
        ["تنفيذ المناهج والمعايير الخاصة بوزارة التربية والتعليم والتعليم العالي وتحقيق التكامل بين المواد.", 2],
    ] },
    { title: "توفير بيئة تعلم آمنة وداعمة ومثيرة للتحدي", percent: 10, indicators: [
        ["تأسيس قواعد صفية وتوقعات سلوكية عالية لدعم عملية التعلم.", 3],
        ["تشجيع الطلبة على المبادرة وتحمل مسؤولية سلوكهم وتعلمهم.", 4],
        ["تشجيع الطلبة على احترام الآخرين والتعاطف معهم.", 3],
    ] },
    { title: "تقييم تعلم الطلبة واستخدام بيانات التقييم لتحسين تحصيلهم", percent: 15, indicators: [
        ["إعداد وتوثيق كافة أنواع التقييمات.", 4],
        ["تصحيح أعمال الطلبة بشكل مستمر.", 2],
        ["قراءة بيانات التقييم وتوظيفها لدعم تعلم الطلبة.", 4],
        ["تقديم التغذية الراجعة البناءة للطلبة حول أعمالهم وتقييماتهم.", 3],
        ["تبادل المعلومات الخاصة بتقييم الطلبة مع الزملاء لدعم التعلم.", 2],
    ] },
    { title: "إظهار ممارسات مهنية عالية الجودة والمشاركة في التطوير المهني المستمر.", percent: 10, indicators: [
        ["التدبر بصورة ناقدة في الممارسة المهنية لتحسين الأداء.", 3],
        ["التنمية المهنية الذاتية والمساهمة في شبكات التعلم المهنية.", 1],
        ["مواكبة المستجدات في مادة التخصص والمجالات التربوية.", 2],
        ["إظهار ممارسات مهنية تعكس أثر الخبرات المكتسبة من التطوير المهني.", 2],
        ["القيام بالأدوار والمسؤوليات المكلف بها.", 2],
    ] },
    { title: "الحفاظ على الشراكة الفاعلة مع أولياء الأمور والمجتمع.", percent: 10, indicators: [
        ["التواصل بفاعلية مع أولياء الأمور بهدف تحسين تعلم الطلبة وتحصيلهم", 3],
        ["الاستفادة من الشراكات المحلية لدعم تعلم الطلبة وتحصيلهم.", 3],
        ["إعداد الطلبة ليكونوا مواطنين فاعلين محليا ودوليًا.", 4],
    ] },
    { title: "الجوانب الشخصية والمهنية", percent: 15, indicators: [
        ["تحمل المسؤوليات والقدرة على حل المشكلات.", 2],
        ["الالتزام بالمسؤوليات الإدارية والفنية", 2],
        ["الالمام بالمادة العلمية وتمكنه منها.", 3],
        ["العلاقة الإيجابية مع الرؤساء والزملاء", 2],
        ["تقبل التوجيهات وتنفيذها", 2],
        ["الانضباط والمواظبة", 4],
    ] },
];

export type Indicator = { id: string; domain: number; no: number; text: string; max: number };

// «2.3»: the third indicator of the second domain — the key its score is kept under
export const INDICATORS: Indicator[] = EVALUATION_DOMAINS.flatMap((d, di) =>
    d.indicators.map(([text, max], i) => ({ id: `${di + 1}.${i + 1}`, domain: di + 1, no: i + 1, text, max })));

export const LEVELS = [
    { label: "ضعيف", range: "أقل من 50 %", from: 0 },
    { label: "مقبول", range: "50-65%", from: 50 },
    { label: "جيد", range: "66 – 75%", from: 66 },
    { label: "جيد جداً", range: "76 – 89 %", from: 76 },
    { label: "ممتاز", range: "90 – 100 %", from: 90 },
] as const;

export type Scores = Record<string, number>;

// Only marks from 0 to the indicator's own maximum survive, in steps of half
// a mark — the school's forms use halves (2.5 of 3)
export function parseScores(json?: string | null): Scores {
    try {
        const raw = json ? JSON.parse(json) : {};
        const out: Scores = {};
        for (const i of INDICATORS) {
            const v = raw?.[i.id];
            if (typeof v === "number" && Number.isInteger(v * 2) && v >= 0 && v <= i.max) out[i.id] = v;
        }
        return out;
    } catch { return {}; }
}

export const scoredCount = (scores: Scores) => INDICATORS.filter(i => scores[i.id] !== undefined).length;
export const totalOf = (scores: Scores) => INDICATORS.reduce((sum, i) => sum + (scores[i.id] ?? 0), 0);
export const domainTotal = (scores: Scores, domain: number) => INDICATORS.filter(i => i.domain === domain).reduce((sum, i) => sum + (scores[i.id] ?? 0), 0);
export const levelOf = (total: number) => [...LEVELS].reverse().find(l => total >= l.from)!.label;

// "2026 - 2027" as the form prints it: (2026/2027)
export const yearOnForm = (academicYear: string) => academicYear.replace(/\s*-\s*/, "/");
