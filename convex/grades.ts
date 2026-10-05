import { memberMutation as mutation, memberQuery as query, staffMutation as adminMutation, staffQuery } from "./platformAccess";
import { v, ConvexError } from "convex/values";
import { dueByNow, planContext } from "./assessmentPlan";

async function getSchool(ctx: any) {
    const sch = await ctx.db.query("schools").first();
    if (!sch) throw new Error("لا توجد مدرسة مُهيَّأة");
    return sch;
}

const DEFAULT_LABELS = ["تقييم 1", "تقييم 2", "تقييم 3", "تقييم 4", "تقييم 5"];
const SLOTS = ["a1", "a2", "a3", "a4", "a5"] as const;
const DEFAULT_INCLUDED_GRADES = [10, 11, 12];

// Which grades take short assessments at all — the الثاني عشر does not.
async function includedGrades(ctx: any, schoolId: any): Promise<number[]> {
    const s = await ctx.db.query("gradeSettings")
        .withIndex("by_school", (q: any) => q.eq("schoolId", schoolId))
        .first();
    return s?.includedGrades ?? DEFAULT_INCLUDED_GRADES;
}

// ── What each assessment is marked out of ─────────────────────────────────
// The school default (20) holds unless the teacher has set another total for
// that assessment on that sheet — a 30- or 40-mark assessment is recorded as
// it was marked. Only totals that differ from the default are stored.
type SlotMaxes = Partial<Record<(typeof SLOTS)[number], number>>;

async function defaultMax(ctx: any, schoolId: any): Promise<number> {
    const s = await ctx.db.query("gradeSettings")
        .withIndex("by_school", (q: any) => q.eq("schoolId", schoolId))
        .first();
    return s?.maxPerAssessment ?? 20;
}

function overridesOf(doc: any): SlotMaxes | undefined {
    if (!doc) return undefined;
    const out: SlotMaxes = {};
    for (const slot of SLOTS) if (typeof doc[slot] === "number") out[slot] = doc[slot];
    return Object.keys(out).length ? out : undefined;
}

async function sheetMaxDoc(ctx: any, schoolId: any, className: string, subjectName: string) {
    return ctx.db.query("assessmentMaxes")
        .withIndex("by_class_subject", (q: any) =>
            q.eq("schoolId", schoolId).eq("className", className).eq("subjectName", subjectName))
        .first();
}

// The five totals of one sheet, defaults filled in
async function sheetMaxes(ctx: any, schoolId: any, className: string, subjectName: string): Promise<Record<string, number>> {
    const fallback = await defaultMax(ctx, schoolId);
    const doc = await sheetMaxDoc(ctx, schoolId, className, subjectName);
    return Object.fromEntries(SLOTS.map(slot => [slot, typeof doc?.[slot] === "number" ? doc[slot] : fallback]));
}

const sheetKey = (className: string, subjectName: string) => `${className}\u0000${subjectName}`;

async function allOverrides(ctx: any, schoolId: any): Promise<Map<string, SlotMaxes>> {
    const docs = await ctx.db.query("assessmentMaxes")
        .withIndex("by_school", (q: any) => q.eq("schoolId", schoolId))
        .collect();
    const map = new Map<string, SlotMaxes>();
    for (const d of docs) {
        const o = overridesOf(d);
        if (o) map.set(sheetKey(d.className, d.subjectName), o);
    }
    return map;
}

// Support (ESE) sections sit outside the short-assessment scheme altogether.
const isSupportClass = (name: string | undefined) => /ESE/i.test(name ?? "");

// ── Roster helpers ────────────────────────────────────────────────────────
// Grades are stored denormalised by student name, so a brand-new school year
// starts with an empty studentGrades table. The roster therefore comes from the
// real students/classes tables, and existing grade rows are merged on top —
// that way imported rows whose name no longer matches a student still show up.

type RosterEntry = {
    studentId?: string;
    studentName: string;
    className: string;
    grade: number;
    track: string;
    nationalId?: string;
};

const byArabicName = (a: { studentName: string }, b: { studentName: string }) =>
    a.studentName.localeCompare(b.studentName, "ar");

async function activeClasses(ctx: any, schoolId: any) {
    const classes = await ctx.db.query("classes")
        .withIndex("by_school", (q: any) => q.eq("schoolId", schoolId))
        .collect();
    return classes.filter((c: any) => c.isActive !== false);
}

async function rosterForClass(ctx: any, schoolId: any, className: string): Promise<RosterEntry[]> {
    const cls = (await activeClasses(ctx, schoolId))
        .find((c: any) => c.name.trim() === className.trim());
    if (!cls) return [];

    const students = await ctx.db.query("students")
        .withIndex("by_class", (q: any) => q.eq("classId", cls._id))
        .collect();

    return students
        .filter((s: any) => s.isActive !== false)
        .map((s: any) => ({
            studentId: s._id,
            studentName: s.fullName,
            className: cls.name,
            grade: cls.grade,
            track: cls.track ?? "عام",
            nationalId: s.nationalId,
        }))
        .sort(byArabicName);
}

// Everything needed to keep a copy of a class's short assessments: one subject,
// or every subject the class takes (its study plan plus anything already marked).
export const getClassExport = query({
    args: { className: v.string(), subjectName: v.optional(v.string()) },
    handler: async (ctx, args) => {
        const school = await ctx.db.query("schools").first();
        if (!school) return null;

        const cls = (await activeClasses(ctx, school._id))
            .find((c: any) => c.name.trim() === args.className.trim());
        if (!cls) return null;

        const stored = await ctx.db.query("gradeSettings")
            .withIndex("by_school", q => q.eq("schoolId", school._id))
            .first();
        const settings = {
            maxPerAssessment: stored?.maxPerAssessment ?? 20,
            finalScoreOutOf: stored?.finalScoreOutOf ?? 5,
            passThreshold: stored?.passThreshold ?? 2.5,
            excellenceThreshold: stored?.excellenceThreshold ?? 4.5,
            assessmentLabels: stored?.assessmentLabels ?? DEFAULT_LABELS,
        };

        const track = cls.track ?? "عام";
        const saved = (await ctx.db.query("studentGrades")
            .withIndex("by_school", q => q.eq("schoolId", school._id))
            .collect())
            .filter(g => g.className === cls.name);

        let subjectNames: string[];
        if (args.subjectName) {
            subjectNames = [args.subjectName];
        } else {
            const planned = (await ctx.db.query("subjects")
                .filter(q => q.eq(q.field("schoolId"), school._id))
                .collect())
                .filter(s => (s.targetClasses ?? []).some(t => t.trim() === `${cls.grade}-${track}`))
                .map(s => s.name);
            subjectNames = [...new Set([...planned, ...saved.map(g => g.subjectName)])]
                .sort((a, b) => a.localeCompare(b, "ar"));
        }

        const roster = await rosterForClass(ctx, school._id, cls.name);
        const overrides = await allOverrides(ctx, school._id);

        const sheets = subjectNames.map(subjectName => {
            const maxes = overrides.get(sheetKey(cls.name, subjectName));
            const byName = new Map(saved
                .filter(g => g.subjectName === subjectName)
                .map(g => [g.studentName.trim(), g] as const));
            const marksOf = (g: any) => ({
                a1: g?.a1 ?? null, a2: g?.a2 ?? null, a3: g?.a3 ?? null,
                a4: g?.a4 ?? null, a5: g?.a5 ?? null,
            });

            const students = roster.map(entry => {
                const key = entry.studentName.trim();
                const g = byName.get(key);
                byName.delete(key);
                return { studentName: entry.studentName, nationalId: entry.nationalId ?? "", ...marksOf(g), maxes };
            });
            // Marks under a name no longer on the roster still belong in the record
            for (const g of [...byName.values()].sort(byArabicName)) {
                students.push({ studentName: g.studentName, nationalId: "", ...marksOf(g), maxes });
            }
            return {
                subjectName, students,
                maxes: SLOTS.map(slot => maxes?.[slot] ?? settings.maxPerAssessment),
            };
        });

        return {
            schoolName: school.name,
            className: cls.name,
            grade: cls.grade,
            track,
            settings,
            sheets,
        };
    },
});

// ── Settings ──────────────────────────────────────────────────────────────
export const getSettings = query({
    args: {},
    handler: async (ctx) => {
        const school = await ctx.db.query("schools").first();
        if (!school) return null;
        const s = await ctx.db.query("gradeSettings")
            .withIndex("by_school", q => q.eq("schoolId", school._id))
            .first();
        if (s) return { ...s, includedGrades: s.includedGrades ?? DEFAULT_INCLUDED_GRADES };
        return {
            schoolId: school._id,
            maxPerAssessment: 20,
            finalScoreOutOf: 5,
            passThreshold: 2.5,
            excellenceThreshold: 4.5,
            assessmentLabels: DEFAULT_LABELS,
            includedGrades: DEFAULT_INCLUDED_GRADES,
        };
    },
});

export const updateSettings = adminMutation({
    args: {
        maxPerAssessment: v.optional(v.number()),
        finalScoreOutOf: v.optional(v.number()),
        passThreshold: v.optional(v.number()),
        excellenceThreshold: v.optional(v.number()),
        assessmentLabels: v.optional(v.array(v.string())),
        includedGrades: v.optional(v.array(v.number())),
    },
    handler: async (ctx, args) => {
        const school = await getSchool(ctx);
        const existing = await ctx.db.query("gradeSettings")
            .withIndex("by_school", q => q.eq("schoolId", school._id))
            .first();
        if (existing) {
            await ctx.db.patch(existing._id, args);
        } else {
            await ctx.db.insert("gradeSettings", {
                schoolId: school._id,
                maxPerAssessment: args.maxPerAssessment ?? 20,
                finalScoreOutOf: args.finalScoreOutOf ?? 5,
                passThreshold: args.passThreshold ?? 2.5,
                excellenceThreshold: args.excellenceThreshold ?? 4.5,
                assessmentLabels: args.assessmentLabels ?? DEFAULT_LABELS,
                includedGrades: args.includedGrades ?? DEFAULT_INCLUDED_GRADES,
            });
        }
    },
});

// ── Queries ───────────────────────────────────────────────────────────────
// Returns one row per student in the class — a saved grade row where one
// exists, otherwise an empty placeholder so the sheet can be filled in.
export const getGradesByClassSubject = query({
    args: { className: v.string(), subjectName: v.string() },
    handler: async (ctx, args) => {
        const school = await ctx.db.query("schools").first();
        if (!school) return [];

        const saved = await ctx.db.query("studentGrades")
            .withIndex("by_class_subject", q =>
                q.eq("schoolId", school._id)
                 .eq("className", args.className)
                 .eq("subjectName", args.subjectName))
            .collect();

        const savedByName = new Map(saved.map(g => [g.studentName.trim(), g]));
        const roster = await rosterForClass(ctx, school._id, args.className);
        const maxes = overridesOf(await sheetMaxDoc(ctx, school._id, args.className, args.subjectName));

        const rows: any[] = roster.map(entry => {
            const existing = savedByName.get(entry.studentName.trim());
            if (existing) {
                savedByName.delete(entry.studentName.trim());
                return { ...existing, maxes };
            }
            return {
                maxes,
                studentId: entry.studentId,
                studentName: entry.studentName,
                className: entry.className,
                grade: entry.grade,
                track: entry.track,
                subjectName: args.subjectName,
            };
        });

        // Imported rows whose name no longer matches anyone on the roster —
        // keep them visible rather than silently dropping entered marks.
        const orphans = [...savedByName.values()].sort(byArabicName).map(g => ({ ...g, maxes }));
        return [...rows, ...orphans];
    },
});

export const getStudentGrades = query({
    args: { studentName: v.string() },
    handler: async (ctx, args) => {
        const school = await ctx.db.query("schools").first();
        if (!school) return [];
        const overrides = await allOverrides(ctx, school._id);
        const rows = await ctx.db.query("studentGrades")
            .withIndex("by_student", q => q.eq("schoolId", school._id).eq("studentName", args.studentName))
            .collect();
        return rows.map(g => ({ ...g, maxes: overrides.get(sheetKey(g.className, g.subjectName)) }));
    },
});

export const getAllGrades = query({
    args: {},
    handler: async (ctx) => {
        const school = await ctx.db.query("schools").first();
        if (!school) return [];
        const included = await includedGrades(ctx, school._id);
        const all = await ctx.db.query("studentGrades")
            .withIndex("by_school", q => q.eq("schoolId", school._id))
            .collect();
        const overrides = await allOverrides(ctx, school._id);
        // Keep the result views in step with the class list
        return all.filter(g => included.includes(g.grade) && !isSupportClass(g.className))
            .map(g => ({ ...g, maxes: overrides.get(sheetKey(g.className, g.subjectName)) }));
    },
});

// Which (class, subject) pairs the plan expects and which have no marks yet —
// the gap a spreadsheet per subject can never show, because nothing knows the
// full set of sheets that ought to exist.
export const getCoverage = query({
    args: {},
    handler: async (ctx) => {
        const school = await ctx.db.query("schools").first();
        if (!school) return null;

        const included = await includedGrades(ctx, school._id);
        const classes = (await activeClasses(ctx, school._id))
            .filter((c: any) => included.includes(c.grade) && !isSupportClass(c.name));

        // The published week grid — what should have been recorded by today
        const { weeks, entries: planEntries } = await planContext(ctx, school._id);

        const subjects = await ctx.db.query("subjects")
            .filter(q => q.eq(q.field("schoolId"), school._id))
            .collect();

        const rows = await ctx.db.query("studentGrades")
            .withIndex("by_school", q => q.eq("schoolId", school._id))
            .collect();

        const settings = await ctx.db.query("gradeSettings")
            .withIndex("by_school", (q: any) => q.eq("schoolId", school._id))
            .first();
        const labels = SLOTS.map((_, i) => settings?.assessmentLabels?.[i]?.trim() || DEFAULT_LABELS[i]);

        // How many marks exist per class+subject, and in which assessment slots
        const seen = new Map<string, { entries: number; slots: Set<string> }>();
        for (const r of rows) {
            const key = `${r.className}|${r.subjectName}`;
            const acc = seen.get(key) ?? { entries: 0, slots: new Set<string>() };
            for (const slot of SLOTS) {
                const v = (r as any)[slot];
                if (v !== undefined && v !== null && v !== "") {
                    acc.entries++;
                    acc.slots.add(slot);
                }
            }
            seen.set(key, acc);
        }

        const cells: {
            className: string; grade: number; track: string; subjectName: string;
            studentCount: number; entries: number; slots: string[]; recorded: boolean;
            due: number; late: number;
        }[] = [];

        for (const cls of classes) {
            const track = cls.track ?? "عام";
            const trackKey = `${cls.grade}-${track}`;
            const planned = subjects
                .filter(s => (s.targetClasses ?? []).some(t => t.trim() === trackKey))
                .map(s => s.name);
            if (planned.length === 0) continue;

            const students = (await ctx.db.query("students")
                .withIndex("by_class", q => q.eq("classId", cls._id))
                .collect())
                .filter(s => s.isActive !== false);

            for (const subjectName of planned) {
                const acc = seen.get(`${cls.name}|${subjectName}`);
                const due = dueByNow(weeks, planEntries, subjectName, cls.grade, SLOTS.length);
                cells.push({
                    due,
                    late: Math.max(0, due - (acc ? acc.slots.size : 0)),
                    className: cls.name,
                    grade: cls.grade,
                    track,
                    subjectName,
                    studentCount: students.length,
                    entries: acc?.entries ?? 0,
                    slots: acc ? [...acc.slots].sort() : [],
                    recorded: (acc?.entries ?? 0) > 0,
                });
            }
        }

        const missing = cells.filter(c => !c.recorded);

        // Which of the five assessments each subject (or class) has actually
        // recorded, and in how many of its sheets — «رصدنا تقييمين من خمسة».
        const slotTally = (mine: typeof cells) => SLOTS.map((slot, i) => ({
            slot,
            label: labels[i],
            sheets: mine.filter(c => c.slots.includes(slot)).length,
        }));
        const slotsDone = (tally: { sheets: number }[], expected: number) =>
            tally.filter(t => t.sheets === expected).length;

        return {
            labels,
            hasPlan: weeks.length > 0,
            lateSheets: cells.filter(c => c.late > 0).length,
            cells,
            totalExpected: cells.length,
            recordedCount: cells.length - missing.length,
            missing,
            // Subjects with nothing recorded anywhere — the ones to chase first
            bySubject: [...new Set(cells.map(c => c.subjectName))].map(subjectName => {
                const mine = cells.filter(c => c.subjectName === subjectName);
                const assessments = slotTally(mine);
                return {
                    subjectName,
                    due: Math.max(...mine.map(c => c.due)),
                    lateSheets: mine.filter(c => c.late > 0).length,
                    expected: mine.length,
                    recorded: mine.filter(c => c.recorded).length,
                    missingClasses: mine.filter(c => !c.recorded).map(c => c.className),
                    assessments,
                    assessmentsDone: slotsDone(assessments, mine.length),
                    assessmentsStarted: assessments.filter(a => a.sheets > 0).length,
                };
            }).sort((a, b) => (a.recorded / a.expected) - (b.recorded / b.expected)),
            byClass: [...new Set(cells.map(c => c.className))].map(className => {
                const mine = cells.filter(c => c.className === className);
                const assessments = slotTally(mine);
                return {
                    className,
                    due: Math.max(...mine.map(c => c.due)),
                    lateSheets: mine.filter(c => c.late > 0).length,
                    grade: mine[0].grade,
                    expected: mine.length,
                    recorded: mine.filter(c => c.recorded).length,
                    missingSubjects: mine.filter(c => !c.recorded).map(c => c.subjectName),
                    assessments,
                    assessmentsDone: slotsDone(assessments, mine.length),
                    assessmentsStarted: assessments.filter(a => a.sheets > 0).length,
                };
            }).sort((a, b) => (a.grade - b.grade)
                || a.className.localeCompare(b.className, "ar", { numeric: true })),
        };
    },
});

export const getClassRoster = query({
    args: { className: v.string() },
    handler: async (ctx, args) => {
        const school = await ctx.db.query("schools").first();
        if (!school) return [];

        const roster = await rosterForClass(ctx, school._id, args.className);
        const known = new Set(roster.map(r => r.studentName.trim()));

        // Names that only exist in imported grade rows
        const all = await ctx.db.query("studentGrades")
            .withIndex("by_school", q => q.eq("schoolId", school._id))
            .collect();

        const extras: RosterEntry[] = [];
        for (const g of all) {
            if (g.className !== args.className) continue;
            const name = g.studentName.trim();
            if (known.has(name)) continue;
            known.add(name);
            extras.push({
                studentId: g.studentId as any,
                studentName: g.studentName,
                className: g.className,
                grade: g.grade,
                track: g.track,
            });
        }

        return [...roster, ...extras.sort(byArabicName)];
    },
});

// The class list comes from the school's real classes and the subject plan
// (subjects.targetClasses, set in الإعدادات › المواد والخطة الدراسية), so grade
// entry works on a fresh year before a single mark exists. Anything found only
// in previously imported grade rows is merged in on top.
export const getClassesAndSubjects = query({
    args: {},
    handler: async (ctx) => {
        const school = await ctx.db.query("schools").first();
        if (!school) return { classes: [], subjects: [], trackSubjects: [], includedGrades: DEFAULT_INCLUDED_GRADES };

        const classesArr: { className: string; grade: number; track: string }[] = [];
        const seenClass = new Set<string>();
        const trackSubjects: { trackKey: string; grade: number; track: string; subjects: string[] }[] = [];
        const seenSubject = new Set<string>();

        const addClass = (className: string, grade: number, track: string) => {
            if (!className || seenClass.has(className)) return;
            seenClass.add(className);
            classesArr.push({ className, grade, track });
        };

        const bucketFor = (grade: number, track: string) => {
            const trackKey = `${grade}-${track}`;
            let bucket = trackSubjects.find(t => t.trackKey === trackKey);
            if (!bucket) {
                bucket = { trackKey, grade, track, subjects: [] };
                trackSubjects.push(bucket);
            }
            return bucket;
        };

        const included = await includedGrades(ctx, school._id);

        for (const cls of await activeClasses(ctx, school._id)) {
            if (!included.includes(cls.grade) || isSupportClass(cls.name)) continue;
            addClass(cls.name, cls.grade, cls.track ?? "عام");
            bucketFor(cls.grade, cls.track ?? "عام");
        }

        // Subject plan: targetClasses entries look like "10-عام" / "11-علمي"
        const subjects = await ctx.db.query("subjects")
            .filter(q => q.eq(q.field("schoolId"), school._id))
            .collect();

        for (const subject of subjects) {
            for (const target of subject.targetClasses ?? []) {
                const bucket = trackSubjects.find(t => t.trackKey === target.trim());
                if (!bucket) continue;
                if (!bucket.subjects.includes(subject.name)) bucket.subjects.push(subject.name);
                seenSubject.add(subject.name);
            }
        }

        // Merge whatever previously imported grade rows refer to
        const all = await ctx.db.query("studentGrades")
            .withIndex("by_school", q => q.eq("schoolId", school._id))
            .collect();

        for (const g of all) {
            if (!g.className) continue;
            if (!included.includes(g.grade ?? 0) || isSupportClass(g.className)) continue;
            addClass(g.className, g.grade ?? 0, g.track ?? "عام");
            if (!g.subjectName) continue;
            const bucket = bucketFor(g.grade ?? 0, g.track ?? "عام");
            if (!bucket.subjects.includes(g.subjectName)) bucket.subjects.push(g.subjectName);
            seenSubject.add(g.subjectName);
        }

        for (const bucket of trackSubjects) {
            bucket.subjects.sort((a, b) => a.localeCompare(b, "ar"));
        }

        return {
            classes: classesArr.sort((a, b) =>
                (a.grade - b.grade) || a.className.localeCompare(b.className, "ar", { numeric: true })),
            trackSubjects,
            subjects: [...seenSubject].sort((a, b) => a.localeCompare(b, "ar")),
            includedGrades: included,
        };
    },
});

// ── Mutations ─────────────────────────────────────────────────────────────
// A mark is checked against the total of its own assessment on its own sheet.
// ConvexError, so the teacher reads the reason rather than «Server Error».
function validateAssessment(value: any, max: number): void {
    if (value === undefined || value === null) return;
    if (value === "absent" || value === "excused") return;
    if (typeof value === "number" && Number.isFinite(value)) {
        if (value < 0) throw new ConvexError("الدرجة لا يمكن أن تكون أقل من 0");
        if (value > max) throw new ConvexError(`الدرجة ${value} أكبر من الدرجة الكلية للتقييم (${max}) — عدّل الدرجة الكلية من رأس العمود إن كان التقييم من أكثر`);
        return;
    }
    throw new ConvexError(`قيمة غير صالحة: ${value}`);
}

// The teacher sets what an assessment is out of. It cannot drop below a mark
// already recorded in that column.
export const getSheetMaxes = query({
    args: { className: v.string(), subjectName: v.string() },
    handler: async (ctx, args) => {
        const school = await ctx.db.query("schools").first();
        if (!school) return SLOTS.map(() => 20);
        const maxes = await sheetMaxes(ctx, school._id, args.className, args.subjectName);
        return SLOTS.map(slot => maxes[slot]);
    },
});

export const setAssessmentMax = mutation({
    args: {
        className: v.string(),
        subjectName: v.string(),
        which: v.union(v.literal("a1"), v.literal("a2"), v.literal("a3"), v.literal("a4"), v.literal("a5")),
        max: v.number(),
        updatedBy: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const school = await getSchool(ctx);
        if (!Number.isFinite(args.max) || args.max < 1 || args.max > 200) throw new ConvexError("الدرجة الكلية بين 1 و200");
        const rows = await ctx.db.query("studentGrades")
            .withIndex("by_class_subject", q =>
                q.eq("schoolId", school._id).eq("className", args.className).eq("subjectName", args.subjectName))
            .collect();
        const highest = Math.max(0, ...rows.map(r => (typeof (r as any)[args.which] === "number" ? (r as any)[args.which] : 0)));
        if (highest > args.max) throw new ConvexError(`توجد درجة مرصودة (${highest}) أعلى من ${args.max} — عدّلها أولاً أو اختر درجة كلية أكبر`);

        const fallback = await defaultMax(ctx, school._id);
        const doc = await sheetMaxDoc(ctx, school._id, args.className, args.subjectName);
        const value = args.max === fallback ? undefined : args.max;
        if (doc) {
            await ctx.db.patch(doc._id, { [args.which]: value, updatedAt: Date.now(), updatedBy: args.updatedBy } as any);
        } else if (value !== undefined) {
            await ctx.db.insert("assessmentMaxes", {
                schoolId: school._id, className: args.className, subjectName: args.subjectName,
                [args.which]: value, updatedAt: Date.now(), updatedBy: args.updatedBy,
            } as any);
        }
        return args.max;
    },
});

export const upsertGrade = mutation({
    args: {
        studentName: v.string(),
        className: v.string(),
        grade: v.number(),
        track: v.string(),
        subjectName: v.string(),
        a1: v.optional(v.union(v.number(), v.string(), v.null())),
        a2: v.optional(v.union(v.number(), v.string(), v.null())),
        a3: v.optional(v.union(v.number(), v.string(), v.null())),
        a4: v.optional(v.union(v.number(), v.string(), v.null())),
        a5: v.optional(v.union(v.number(), v.string(), v.null())),
        updatedBy: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const school = await getSchool(ctx);
        // Each mark against the total of its own assessment
        const maxes = await sheetMaxes(ctx, school._id, args.className, args.subjectName);
        for (const slot of SLOTS) validateAssessment(args[slot], maxes[slot]);

        const all = await ctx.db.query("studentGrades")
            .withIndex("by_class_subject", q =>
                q.eq("schoolId", school._id)
                 .eq("className", args.className)
                 .eq("subjectName", args.subjectName))
            .collect();
        const existing = all.find(g => g.studentName === args.studentName);
        const data: any = {
            studentName: args.studentName.trim(),
            className: args.className,
            grade: args.grade,
            track: args.track,
            subjectName: args.subjectName,
            updatedAt: Date.now(),
            updatedBy: args.updatedBy,
        };
        // Only set fields that were provided
        if (args.a1 !== undefined) data.a1 = args.a1 ?? undefined;
        if (args.a2 !== undefined) data.a2 = args.a2 ?? undefined;
        if (args.a3 !== undefined) data.a3 = args.a3 ?? undefined;
        if (args.a4 !== undefined) data.a4 = args.a4 ?? undefined;
        if (args.a5 !== undefined) data.a5 = args.a5 ?? undefined;

        // Clearing the last mark should remove the record, not leave a blank row
        // behind — otherwise the class looks "graded" while every cell is empty.
        const merged = existing ? { ...existing, ...data } : data;
        if (isBlankGradeRow(merged)) {
            if (existing) await ctx.db.delete(existing._id);
            return null;
        }

        if (existing) {
            await ctx.db.patch(existing._id, data);
            return existing._id;
        } else {
            return await ctx.db.insert("studentGrades", { schoolId: school._id, ...data });
        }
    },
});

function isBlankGradeRow(row: any): boolean {
    const hasMark = (["a1", "a2", "a3", "a4", "a5"] as const)
        .some(k => row[k] !== undefined && row[k] !== null && row[k] !== "");
    return !hasMark && !row.notes?.trim();
}

// Fill one assessment column in a single transaction — the usual start of
// grading is "everyone gets full marks, then I lower the ones who didn't".
export const fillAssessment = mutation({
    args: {
        className: v.string(),
        subjectName: v.string(),
        grade: v.number(),
        track: v.string(),
        which: v.union(v.literal("a1"), v.literal("a2"), v.literal("a3"), v.literal("a4"), v.literal("a5")),
        value: v.union(v.number(), v.string()),
        studentNames: v.array(v.string()),
        // Off by default: already-entered marks are left alone.
        overwrite: v.optional(v.boolean()),
        updatedBy: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const school = await getSchool(ctx);
        validateAssessment(args.value, (await sheetMaxes(ctx, school._id, args.className, args.subjectName))[args.which]);

        const existing = await ctx.db.query("studentGrades")
            .withIndex("by_class_subject", q =>
                q.eq("schoolId", school._id)
                 .eq("className", args.className)
                 .eq("subjectName", args.subjectName))
            .collect();

        const byName = new Map(existing.map(g => [g.studentName.trim(), g]));

        let filled = 0;
        let skipped = 0;

        for (const raw of args.studentNames) {
            const name = raw.trim();
            if (!name) continue;

            const row = byName.get(name);
            const current = row ? (row as any)[args.which] : undefined;
            const isEmpty = current === undefined || current === null || current === "";
            if (!isEmpty && !args.overwrite) { skipped++; continue; }

            if (row) {
                await ctx.db.patch(row._id, {
                    [args.which]: args.value,
                    updatedAt: Date.now(),
                    updatedBy: args.updatedBy,
                } as any);
            } else {
                await ctx.db.insert("studentGrades", {
                    schoolId: school._id,
                    studentName: name,
                    className: args.className,
                    grade: args.grade,
                    track: args.track,
                    subjectName: args.subjectName,
                    [args.which]: args.value,
                    updatedAt: Date.now(),
                    updatedBy: args.updatedBy,
                } as any);
            }
            filled++;
        }

        return { filled, skipped };
    },
});

// Undo for fillAssessment: puts each cell back to the value it held before the
// fill (null = it was empty, so the cell — and an emptied row — goes away).
export const restoreAssessment = mutation({
    args: {
        className: v.string(),
        subjectName: v.string(),
        grade: v.number(),
        track: v.string(),
        which: v.union(v.literal("a1"), v.literal("a2"), v.literal("a3"), v.literal("a4"), v.literal("a5")),
        entries: v.array(v.object({
            studentName: v.string(),
            value: v.union(v.number(), v.string(), v.null()),
        })),
        updatedBy: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const school = await getSchool(ctx);
        const restoreMax = (await sheetMaxes(ctx, school._id, args.className, args.subjectName))[args.which];
        for (const e of args.entries) validateAssessment(e.value, restoreMax);

        const existing = await ctx.db.query("studentGrades")
            .withIndex("by_class_subject", q =>
                q.eq("schoolId", school._id)
                 .eq("className", args.className)
                 .eq("subjectName", args.subjectName))
            .collect();

        const byName = new Map(existing.map(g => [g.studentName.trim(), g]));
        let restored = 0;

        for (const entry of args.entries) {
            const name = entry.studentName.trim();
            if (!name) continue;

            const row = byName.get(name);
            const value = entry.value ?? undefined;

            if (!row) {
                if (value === undefined) continue; // was empty, still empty
                await ctx.db.insert("studentGrades", {
                    schoolId: school._id,
                    studentName: name,
                    className: args.className,
                    grade: args.grade,
                    track: args.track,
                    subjectName: args.subjectName,
                    [args.which]: value,
                    updatedAt: Date.now(),
                    updatedBy: args.updatedBy,
                } as any);
                restored++;
                continue;
            }

            const patch = { [args.which]: value, updatedAt: Date.now(), updatedBy: args.updatedBy };
            if (isBlankGradeRow({ ...row, ...patch })) {
                await ctx.db.delete(row._id);
            } else {
                await ctx.db.patch(row._id, patch as any);
            }
            restored++;
        }

        return { restored };
    },
});

export const updateAssessment = mutation({
    args: {
        id: v.id("studentGrades"),
        which: v.union(v.literal("a1"), v.literal("a2"), v.literal("a3"), v.literal("a4"), v.literal("a5")),
        value: v.union(v.number(), v.string(), v.null()),
        updatedBy: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const patch: any = { updatedAt: Date.now(), updatedBy: args.updatedBy };
        patch[args.which] = args.value ?? undefined;

        const existing = await ctx.db.get(args.id);
        if (existing) {
            validateAssessment(args.value, (await sheetMaxes(ctx, existing.schoolId, existing.className, existing.subjectName))[args.which]);
        }
        if (existing && isBlankGradeRow({ ...existing, ...patch })) {
            await ctx.db.delete(args.id);
            return;
        }
        await ctx.db.patch(args.id, patch);
    },
});

export const deleteGrade = mutation({
    args: { id: v.id("studentGrades") },
    handler: async (ctx, args) => {
        await ctx.db.delete(args.id);
    },
});

// ── Bulk import from Excel ────────────────────────────────────────────────
export const bulkImportGrades = adminMutation({
    args: {
        records: v.array(v.object({
            studentName: v.string(),
            className: v.string(),
            grade: v.number(),
            track: v.string(),
            subjectName: v.string(),
            a1: v.optional(v.union(v.number(), v.string())),
            a2: v.optional(v.union(v.number(), v.string())),
            a3: v.optional(v.union(v.number(), v.string())),
            a4: v.optional(v.union(v.number(), v.string())),
            a5: v.optional(v.union(v.number(), v.string())),
        })),
        clearExisting: v.optional(v.boolean()),
        matchExistingStudents: v.optional(v.boolean()),
    },
    handler: async (ctx, args) => {
        const school = await getSchool(ctx);
        if (args.clearExisting) {
            const existing = await ctx.db.query("studentGrades")
                .withIndex("by_school", q => q.eq("schoolId", school._id))
                .collect();
            for (const r of existing) await ctx.db.delete(r._id);
        }

        // Build a lookup of existing students for matching
        let studentLookup = new Map<string, string>();
        if (args.matchExistingStudents) {
            const allStudents = await ctx.db.query("students").collect();
            for (const s of allStudents) {
                const norm = s.fullName.replace(/\s+/g, " ").trim();
                studentLookup.set(norm, s._id as any);
                // Also try without diacritics
                const noSpace = norm.replace(/\s+/g, "");
                studentLookup.set(noSpace, s._id as any);
            }
        }

        let inserted = 0, matched = 0;
        for (const rec of args.records) {
            const cleanName = rec.studentName.replace(/\s+/g, " ").trim();
            let studentId: any = undefined;
            if (args.matchExistingStudents) {
                studentId = studentLookup.get(cleanName) ?? studentLookup.get(cleanName.replace(/\s+/g, ""));
                if (studentId) matched++;
            }
            await ctx.db.insert("studentGrades", {
                schoolId: school._id,
                studentId,
                studentName: cleanName,
                className: rec.className,
                grade: rec.grade,
                track: rec.track,
                subjectName: rec.subjectName,
                a1: rec.a1,
                a2: rec.a2,
                a3: rec.a3,
                a4: rec.a4,
                a5: rec.a5,
                updatedAt: Date.now(),
                updatedBy: "import",
            });
            inserted++;
        }
        return { inserted, matched };
    },
});

// ── Get guardian phone for student (via name match) ───────────────────────
export const getGuardianPhone = staffQuery({
    args: { studentName: v.string() },
    handler: async (ctx, args) => {
        const allStudents = await ctx.db.query("students").collect();
        const cleanName = args.studentName.replace(/\s+/g, " ").trim();
        const match = allStudents.find(s =>
            s.fullName.replace(/\s+/g, " ").trim() === cleanName
        );
        return match?.guardianPhone ?? null;
    },
});
