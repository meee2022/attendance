// The arithmetic and the rules of the ministry's teacher-supervision form, in
// one dependency-free module. The server computes and validates with it when a
// visit is saved; the form imports the same functions to show the average live
// and to flag a missing field before the teacher is even asked to wait.
//
// Carried over from the Excel workbook (modVisit.bas, v4):
//   score           3 | 2 | 1 | 0, or null for «لم يتم قياسه»
//   average         Σ measured ÷ (3 × measured count)
//   domain average  the same within one domain — null, not zero, when nothing
//                   in that domain was measured

export type Domain = "planning" | "execution" | "evaluation" | "management";
export type VisitorRole = "coordinator" | "supervisor" | "deputy";
export type Rating = 0 | 1 | 2 | 3 | "not_measured";

export const DOMAINS: Domain[] = ["planning", "execution", "evaluation", "management"];

export const DOMAIN_LABELS: Record<Domain, string> = {
    planning: "التخطيط",
    execution: "تنفيذ الدرس",
    evaluation: "التقويم",
    management: "الإدارة الصفية",
};

export const ROLE_LABELS: Record<VisitorRole, string> = {
    coordinator: "المنسق",
    supervisor: "الموجّه",
    deputy: "النائب الأكاديمي",
};

// The five columns of the form, in the order they are printed
export const RATING_SCALE: { value: Rating; label: string; short: string }[] = [
    { value: 3, label: "الأدلة مستكملة وفاعلة", short: "مستكملة" },
    { value: 2, label: "تتوفر معظم الأدلة", short: "معظم" },
    { value: 1, label: "تتوفر بعض الأدلة", short: "بعض" },
    { value: 0, label: "الأدلة غير متوفرة أو محدودة", short: "محدودة" },
    { value: "not_measured", label: "لم يتم قياسه", short: "لم يُقَس" },
];

export type CriterionRef = { _id: string; domain: Domain };

export function parseRatings(json: string | undefined | null): Record<string, Rating> {
    if (!json) return {};
    try {
        const raw = JSON.parse(json);
        const out: Record<string, Rating> = {};
        for (const [k, v] of Object.entries(raw ?? {})) {
            if (v === "not_measured" || v === 0 || v === 1 || v === 2 || v === 3) out[k] = v as Rating;
        }
        return out;
    } catch {
        return {};
    }
}

export type VisitScores = {
    average: number | null;
    domains: Record<Domain, number | null>;
    measured: number;
    rated: number;           // measured + «لم يتم قياسه»
};

export function computeScores(ratings: Record<string, Rating>, criteria: CriterionRef[]): VisitScores {
    const acc: Record<Domain, { sum: number; n: number }> = {
        planning: { sum: 0, n: 0 }, execution: { sum: 0, n: 0 },
        evaluation: { sum: 0, n: 0 }, management: { sum: 0, n: 0 },
    };
    let sum = 0, measured = 0, rated = 0;

    for (const c of criteria) {
        const r = ratings[c._id];
        if (r === undefined) continue;
        rated++;
        if (r === "not_measured") continue;
        acc[c.domain].sum += r;
        acc[c.domain].n++;
        sum += r;
        measured++;
    }

    const domains = {} as Record<Domain, number | null>;
    for (const d of DOMAINS) domains[d] = acc[d].n ? acc[d].sum / (3 * acc[d].n) : null;

    return { average: measured ? sum / (3 * measured) : null, domains, measured, rated };
}

const WEEKDAYS = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

// «2026-09-24» → «الخميس». Read as a calendar date, never through a timezone.
export function dayName(isoDate: string): string {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate || "");
    if (!m) return "";
    const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    return WEEKDAYS[d.getUTCDay()] ?? "";
}

export function formatDate(isoDate: string): string {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate || "");
    return m ? `${m[3]}/${m[2]}/${m[1]}` : isoDate || "";
}

// Today in Doha, as the form's date would read on the classroom wall
export function todayInQatar(now = Date.now()): string {
    return new Date(now + 3 * 3600 * 1000).toISOString().slice(0, 10);
}

export type VisitDraftInput = {
    teacherId?: string | null;
    classId?: string | null;
    lessonTopic?: string;
    visitDate?: string;
    followUpType?: "full" | "partial" | null;
    ratings: Record<string, Rating>;
    planningRec?: string;
    executionRec?: string;
    evalMgmtRec?: string;
    notes?: string;
};

export type ValidationIssue = { field: string; message: string };

// ValidateForm from the workbook. A draft may be saved half-done; a submitted
// visit must pass every rule. `allowOldDate` is the explicit exception for
// entering a visit that happened more than a year ago.
export function validateVisit(
    input: VisitDraftInput,
    criteria: CriterionRef[],
    opts: { today?: string; allowOldDate?: boolean } = {},
): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const today = opts.today ?? todayInQatar();

    if (!input.teacherId) issues.push({ field: "teacher", message: "اختر المعلم" });
    if (!input.classId) issues.push({ field: "class", message: "اختر الصف" });
    if (!input.lessonTopic?.trim()) issues.push({ field: "lesson", message: "اكتب عنوان الدرس" });

    const date = input.visitDate ?? "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        issues.push({ field: "date", message: "أدخل تاريخ الزيارة" });
    } else {
        if (date > today) issues.push({ field: "date", message: "تاريخ الزيارة لا يمكن أن يكون في المستقبل" });
        const yearAgo = `${Number(today.slice(0, 4)) - 1}${today.slice(4)}`;
        if (!opts.allowOldDate && date < yearAgo) {
            issues.push({ field: "date", message: "تاريخ الزيارة أقدم من سنة" });
        }
    }

    if (input.followUpType !== "full" && input.followUpType !== "partial") {
        issues.push({ field: "followUp", message: "حدّد نوع المتابعة: كلية أو جزئية" });
    }

    const missing = criteria.filter(c => input.ratings[c._id] === undefined).length;
    if (missing > 0) {
        issues.push({ field: "ratings", message: `بقي ${missing} ${missing === 1 ? "معيار" : "معايير"} بلا تقدير` });
    }

    const anyText = [input.planningRec, input.executionRec, input.evalMgmtRec, input.notes]
        .some(t => (t ?? "").trim().length > 0);
    if (!anyText) issues.push({ field: "recs", message: "اكتب توصية واحدة على الأقل أو ملاحظة عامة" });

    return issues;
}

// A search key for names: one spacing, no NBSP, the hamza seats and taa
// marbuta folded. For matching only — the name shown is never changed.
export function nameKey(s: string): string {
    return (s ?? "")
        .normalize("NFC")
        .replace(/[ \s]+/g, " ")
        .trim()
        .replace(/[أإآ]/g, "ا")
        .replace(/ة/g, "ه")
        .replace(/ى/g, "ي");
}
