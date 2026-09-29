// Aggregation of classroom visits for the dashboard, the analysis tab and the
// teacher file. Each visit's own average was fixed by the server when it was
// submitted; these helpers only combine visits, with the same rule the
// workbook's stats sheets use: Σ scores ÷ (3 × measured), «لم يتم قياسه»
// never counted.

import {
    DOMAINS, parseRatings,
    type Domain, type Rating, type VisitorRole,
} from "../../convex/visitMath";

export type VisitRow = {
    sourceImportId?: string | null;
    criteriaSnapshot?: Criterion[] | null;
    _id: string;
    visitorId?: string | null;
    recordedByVisitorId?: string | null;
    recordedByName?: string | null;
    academicYear?: string | null;
    recordNo: number | null;
    visitNumber: number | null;
    teacherId: string | null;
    teacherName: string;
    department: string;
    subjectName: string;
    className: string;
    lessonTopic: string;
    visitDate: string;
    visitorRole: VisitorRole;
    visitorName: string;
    followUpType: "full" | "partial";
    status: "draft" | "submitted";
    averageScore: number | null;
    domainAverages: string;
    ratings: string;
    planningRec: string;
    executionRec: string;
    evalMgmtRec: string;
    managementRec?: string;
    deliveryMode?: "field" | "remote";
    streamMode?: "merged" | "unmerged" | null;
    reviewRequest?: { toRole: "deputy" | "coordinator"; toVisitorId?: string; toName: string; byName: string; note?: string; at: number } | null;
    reviewReturn?: { byName: string; note: string; at: number } | null;
    notes: string;
    createdAt: number;
    updatedAt: number;
    deletedAt: number | null;
    deleteReason: string | null;
};

export type Criterion = { _id: string; domain: Domain; text: string; order: number };
export type Teacher = { _id: string; fullName: string; department: string; email: string };

export type Filters = {
    department: string;         // "" = every department
    teacherId: string;          // "" = every teacher
    role: VisitorRole | "";     // "" = every visitor type
    from: string;               // ISO or ""
    to: string;
};

export const EMPTY_FILTERS: Filters = { department: "", teacherId: "", role: "", from: "", to: "" };

export function applyFilters(visits: VisitRow[], f: Filters): VisitRow[] {
    return visits.filter(x =>
        (!f.department || x.department === f.department)
        && (!f.teacherId || x.teacherId === f.teacherId)
        && (!f.role || x.visitorRole === f.role)
        && (!f.from || x.visitDate >= f.from)
        && (!f.to || x.visitDate <= f.to));
}

export const submittedOnly = (visits: VisitRow[]) => visits.filter(x => x.status === "submitted");

// Compare two dates from the same role and named visitor, on unchanged criteria
// measured in both visits. Missing evidence is not evidence of decline.
export function roleComparisons(visits: VisitRow[], criteria: Criterion[]) {
    const valid = submittedOnly(visits).filter(v => !v.deletedAt);
    return (["coordinator", "deputy", "supervisor"] as VisitorRole[]).map(role => {
        const rows = valid.filter(v => v.visitorRole === role).sort((a,b) => a.visitDate.localeCompare(b.visitDate) || a.createdAt - b.createdAt);
        const last = rows.at(-1);
        const sameVisitor = (v: VisitRow) => last && (last.visitorId ? v.visitorId === last.visitorId : v.visitorName === last.visitorName);
        const first = last ? rows.find(v => sameVisitor(v) && v.visitDate < last.visitDate) : undefined;
        const a = first ? parseRatings(first.ratings) : {}, b = last ? parseRatings(last.ratings) : {};
        const common = first && last ? criteria.filter(c => {
            const ca = first.criteriaSnapshot?.find(x => x._id === c._id), cb = last.criteriaSnapshot?.find(x => x._id === c._id);
            return ca && cb && ca.text === cb.text && ca.domain === cb.domain && cb.text === c.text && cb.domain === c.domain && typeof a[c._id] === "number" && typeof b[c._id] === "number";
        }) : [];
        const mean = (r: Record<string, Rating>) => common.reduce((sum,c) => sum + (r[c._id] as number), 0) / (3 * common.length);
        return { role, count: rows.length, stats: criterionAverages(rows, criteria), first, last, commonCount: common.length,
            before: common.length ? mean(a) : null, after: common.length ? mean(b) : null,
            delta: common.length ? mean(b) - mean(a) : null };
    });
}

type Acc = { sum: number; n: number };
const ratio = (a: Acc) => (a.n ? a.sum / (3 * a.n) : null);

// Per criterion and per domain, pooled over every measured rating
export function criterionAverages(visits: VisitRow[], criteria: Criterion[]) {
    const byCriterion = new Map<string, Acc>(criteria.map(c => [c._id, { sum: 0, n: 0 }]));
    const byDomain = new Map<Domain, Acc>(DOMAINS.map(d => [d, { sum: 0, n: 0 }]));
    const overall: Acc = { sum: 0, n: 0 };

    for (const visit of visits) {
        const ratings = parseRatings(visit.ratings);
        for (const c of criteria) {
            const frozen = visit.criteriaSnapshot?.find(x => x._id === c._id);
            if (visit.criteriaSnapshot && (!frozen || frozen.text !== c.text || frozen.domain !== c.domain)) continue;
            const r: Rating | undefined = ratings[c._id];
            if (r === undefined || r === "not_measured") continue;
            byCriterion.get(c._id)!.sum += r; byCriterion.get(c._id)!.n++;
            byDomain.get(c.domain)!.sum += r; byDomain.get(c.domain)!.n++;
            overall.sum += r; overall.n++;
        }
    }

    return {
        criteria: criteria.map(c => ({ ...c, average: ratio(byCriterion.get(c._id)!), n: byCriterion.get(c._id)!.n })),
        domains: Object.fromEntries(DOMAINS.map(d => [d, ratio(byDomain.get(d)!)])) as Record<Domain, number | null>,
        overall: ratio(overall),
    };
}

export function countByRole(visits: VisitRow[]) {
    return {
        coordinator: visits.filter(x => x.visitorRole === "coordinator").length,
        supervisor: visits.filter(x => x.visitorRole === "supervisor").length,
        deputy: visits.filter(x => x.visitorRole === "deputy").length,
    };
}

// The workbook's «sts» sheet: one row per department, ranked by average
export function departmentTable(visits: VisitRow[], teachers: Teacher[], criteria: Criterion[]) {
    const departments = [...new Set(teachers.map(t => t.department).filter(Boolean))];
    const schoolAvg = criterionAverages(visits, criteria).overall;

    const rows = departments.map(department => {
        const mine = visits.filter(x => x.department === department);
        const staff = teachers.filter(t => t.department === department);
        const visited = new Set(mine.map(x => x.teacherId).filter(Boolean));
        const avg = criterionAverages(mine, criteria);
        return {
            department,
            ...countByRole(mine),
            total: mine.length,
            teachers: staff.length,
            withoutVisit: staff.filter(t => !visited.has(t._id)).length,
            domains: avg.domains,
            average: avg.overall,
            vsSchool: avg.overall !== null && schoolAvg !== null ? avg.overall - schoolAvg : null,
        };
    });

    const ranked = rows.filter(r => r.average !== null).sort((a, b) => b.average! - a.average!);
    return rows
        .map(r => ({ ...r, rank: r.average === null ? null : ranked.indexOf(r) + 1 }))
        .sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999) || a.department.localeCompare(b.department, "ar"));
}

// Visits per month and visitor type — «2026-09» → counts
export function monthlyCounts(visits: VisitRow[]) {
    const months = new Map<string, { coordinator: number; supervisor: number; deputy: number }>();
    for (const x of visits) {
        const m = (x.visitDate || "").slice(0, 7);
        if (!m) continue;
        const row = months.get(m) ?? { coordinator: 0, supervisor: 0, deputy: 0 };
        row[x.visitorRole]++;
        months.set(m, row);
    }
    return [...months.entries()].sort((a, b) => a[0].localeCompare(b[0]))
        .map(([month, c]) => ({ month, ...c, total: c.coordinator + c.supervisor + c.deputy }));
}

const MONTHS = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
export const monthLabel = (ym: string) => `${MONTHS[Number(ym.slice(5, 7)) - 1] ?? ym} ${ym.slice(0, 4)}`;

// How far each teacher is from the number of visits expected this year
export function teacherCoverage(
    visits: VisitRow[], teachers: Teacher[],
    required: { coordinator: number; supervisor: number; deputy: number },
) {
    return teachers.map(t => {
        const mine = visits.filter(x => x.teacherId === t._id);
        const got = countByRole(mine);
        const last = mine.map(x => x.visitDate).sort().pop() ?? null;
        const missing =
            Math.max(0, required.coordinator - got.coordinator)
            + Math.max(0, required.supervisor - got.supervisor)
            + Math.max(0, required.deputy - got.deputy);
        return { teacher: t, ...got, total: mine.length, last, missing };
    });
}

export const pct = (x: number | null | undefined, digits = 0) =>
    x === null || x === undefined ? "—" : `${(x * 100).toFixed(digits)}%`;

export function scoreTone(x: number | null | undefined): string {
    if (x === null || x === undefined) return "#94a3b8";
    if (x >= 0.85) return "#059669";
    if (x >= 0.7) return "#2563eb";
    if (x >= 0.5) return "#d97706";
    return "#dc2626";
}
