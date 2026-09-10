import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// ── الاختبارات التشخيصية ──────────────────────────────────────────────────
// The spreadsheet computed everything with SUMIF chains over fixed ranges,
// which capped it at 23 questions, 19 skills, 220 students and 11 classes.
// Here the test carries its own definition and every figure is derived, so
// none of those ceilings exist.

async function getSchool(ctx: any) {
    const school = await ctx.db.query("schools").first();
    if (!school) throw new Error("لا توجد مدرسة مُهيَّأة");
    return school;
}

function parseScores(raw: string | undefined): Record<string, number> {
    if (!raw) return {};
    try {
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
        return {};
    }
}

const questionValidator = v.object({
    n: v.number(),
    skillId: v.optional(v.string()),
    subjectName: v.optional(v.string()),
    maxMark: v.number(),
});

const skillValidator = v.object({
    id: v.string(),
    label: v.string(),
    subjectName: v.optional(v.string()),
});

// A combined test (science = chemistry + biology + physics) lists its subjects;
// a single-subject test just has the one.
function subjectsOf(test: { subjectName: string; subjectNames?: string[] }): string[] {
    return test.subjectNames?.length ? test.subjectNames : [test.subjectName];
}

// A question with no subject belongs to the test's only subject; on a combined
// test it stays unassigned rather than being guessed.
function subjectOfQuestion(
    q: { subjectName?: string },
    test: { subjectName: string; subjectNames?: string[] },
): string {
    if (q.subjectName) return q.subjectName;
    const subjects = subjectsOf(test);
    return subjects.length === 1 ? subjects[0] : "غير محدد";
}

function totalMarks(questions: { maxMark: number }[]) {
    return questions.reduce((sum, q) => sum + (q.maxMark || 0), 0);
}

// ── Tests ─────────────────────────────────────────────────────────────────
export const listTests = query({
    args: {},
    handler: async (ctx) => {
        const school = await ctx.db.query("schools").first();
        if (!school) return [];

        const tests = (await ctx.db.query("diagnosticTests")
            .withIndex("by_school", q => q.eq("schoolId", school._id))
            .collect())
            .sort((a, b) => b.createdAt - a.createdAt);

        return await Promise.all(tests.map(async t => {
            const scores = await ctx.db.query("diagnosticScores")
                .withIndex("by_test", q => q.eq("testId", t._id))
                .collect();
            const graded = scores.filter(s => !s.isAbsent && Object.keys(parseScores(s.scores)).length > 0);
            return {
                ...t,
                totalMarks: totalMarks(t.questions),
                questionCount: t.questions.length,
                skillCount: t.skills.length,
                unmappedQuestions: t.questions.filter(q => !q.skillId).length,
                gradedCount: graded.length,
                absentCount: scores.filter(s => s.isAbsent).length,
            };
        }));
    },
});

export const getTest = query({
    args: { testId: v.id("diagnosticTests") },
    handler: async (ctx, args) => {
        const test = await ctx.db.get(args.testId);
        if (!test) return null;
        return { ...test, totalMarks: totalMarks(test.questions) };
    },
});

export const createTest = mutation({
    args: {
        title: v.string(),
        subjectName: v.string(),
        subjectNames: v.optional(v.array(v.string())),
        grade: v.number(),
        term: v.optional(v.string()),
        testDate: v.optional(v.string()),
        masteryThreshold: v.optional(v.number()),
        classNames: v.array(v.string()),
        skills: v.optional(v.array(skillValidator)),
        questions: v.optional(v.array(questionValidator)),
    },
    handler: async (ctx, args) => {
        const school = await getSchool(ctx);
        if (!args.title.trim()) throw new Error("اسم الاختبار مطلوب.");

        return await ctx.db.insert("diagnosticTests", {
            schoolId: school._id,
            title: args.title.trim(),
            subjectName: args.subjectName.trim(),
            subjectNames: args.subjectNames?.length ? args.subjectNames : undefined,
            grade: args.grade,
            term: args.term?.trim() || undefined,
            testDate: args.testDate,
            masteryThreshold: args.masteryThreshold ?? 0.6,
            classNames: args.classNames,
            skills: args.skills ?? [],
            questions: args.questions ?? [],
            isActive: true,
            createdAt: Date.now(),
        });
    },
});

export const updateTest = mutation({
    args: {
        testId: v.id("diagnosticTests"),
        title: v.optional(v.string()),
        subjectName: v.optional(v.string()),
        subjectNames: v.optional(v.array(v.string())),
        grade: v.optional(v.number()),
        term: v.optional(v.string()),
        testDate: v.optional(v.string()),
        masteryThreshold: v.optional(v.number()),
        classNames: v.optional(v.array(v.string())),
        skills: v.optional(v.array(skillValidator)),
        questions: v.optional(v.array(questionValidator)),
        isActive: v.optional(v.boolean()),
    },
    handler: async (ctx, args) => {
        const { testId, ...rest } = args;
        const test = await ctx.db.get(testId);
        if (!test) throw new Error("الاختبار غير موجود.");

        const patch: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(rest)) {
            if (value !== undefined) patch[key] = value;
        }
        if (typeof patch.title === "string") patch.title = patch.title.trim();
        await ctx.db.patch(testId, patch);
        return "تم الحفظ.";
    },
});

// Copying a test keeps the skills and questions but drops the marks — this is
// how a pre-test becomes a post-test that is actually comparable.
export const duplicateTest = mutation({
    args: { testId: v.id("diagnosticTests"), title: v.string() },
    handler: async (ctx, args) => {
        const test = await ctx.db.get(args.testId);
        if (!test) throw new Error("الاختبار غير موجود.");

        return await ctx.db.insert("diagnosticTests", {
            schoolId: test.schoolId,
            title: args.title.trim() || `${test.title} (نسخة)`,
            subjectName: test.subjectName,
            subjectNames: test.subjectNames,
            grade: test.grade,
            term: test.term,
            testDate: undefined,
            masteryThreshold: test.masteryThreshold,
            classNames: test.classNames,
            skills: test.skills,
            questions: test.questions,
            isActive: true,
            createdAt: Date.now(),
        });
    },
});

export const deleteTest = mutation({
    args: { testId: v.id("diagnosticTests") },
    handler: async (ctx, args) => {
        const scores = await ctx.db.query("diagnosticScores")
            .withIndex("by_test", q => q.eq("testId", args.testId))
            .collect();
        for (const s of scores) await ctx.db.delete(s._id);
        await ctx.db.delete(args.testId);
        return { deleted: scores.length + 1 };
    },
});

// ── Score entry ───────────────────────────────────────────────────────────
export const getEntrySheet = query({
    args: { testId: v.id("diagnosticTests"), className: v.string() },
    handler: async (ctx, args) => {
        const test = await ctx.db.get(args.testId);
        if (!test) return null;

        const school = await ctx.db.query("schools").first();
        if (!school) return null;

        const cls = (await ctx.db.query("classes")
            .withIndex("by_school", q => q.eq("schoolId", school._id))
            .collect())
            .find(c => c.name.trim() === args.className.trim());
        if (!cls) return null;

        const saved = await ctx.db.query("diagnosticScores")
            .withIndex("by_test_class", q =>
                q.eq("testId", args.testId).eq("className", args.className))
            .collect();
        const byStudent = new Map(saved.map(s => [s.studentId as string, s]));

        const students = (await ctx.db.query("students")
            .withIndex("by_class", q => q.eq("classId", cls._id))
            .collect())
            .filter(s => s.isActive !== false)
            .sort((a, b) => a.fullName.localeCompare(b.fullName, "ar"))
            .map(s => {
                const rec = byStudent.get(s._id as string);
                const scores = parseScores(rec?.scores);
                const answered = Object.keys(scores).length;
                return {
                    studentId: s._id,
                    fullName: s.fullName,
                    guardianPhone: s.guardianPhone,
                    isAbsent: rec?.isAbsent ?? false,
                    scores,
                    answered,
                    total: Object.values(scores).reduce((a, b) => a + b, 0),
                };
            });

        return {
            test: { ...test, totalMarks: totalMarks(test.questions) },
            className: args.className,
            track: cls.track ?? "عام",
            students,
        };
    },
});

async function writeScoreRecord(ctx: any, params: {
    testId: any; studentId: any;
    mutate: (current: { scores: Record<string, number>; isAbsent: boolean })
        => { scores: Record<string, number>; isAbsent: boolean };
}) {
    const test = await ctx.db.get(params.testId);
    if (!test) throw new Error("الاختبار غير موجود.");

    const student = await ctx.db.get(params.studentId);
    if (!student) throw new Error("الطالب غير موجود.");

    const cls = await ctx.db.get(student.classId);
    const className = cls?.name ?? "";

    const existing = (await ctx.db.query("diagnosticScores")
        .withIndex("by_test", (q: any) => q.eq("testId", params.testId))
        .collect())
        .find((s: any) => s.studentId === params.studentId);

    const current = {
        scores: parseScores(existing?.scores),
        isAbsent: existing?.isAbsent ?? false,
    };
    const next = params.mutate(current);

    // Nothing recorded → no row, so "not sat yet" stays distinct from "zero"
    if (Object.keys(next.scores).length === 0 && !next.isAbsent) {
        if (existing) await ctx.db.delete(existing._id);
        return null;
    }

    const data = {
        scores: JSON.stringify(next.scores),
        isAbsent: next.isAbsent || undefined,
        updatedAt: Date.now(),
    };

    if (existing) {
        await ctx.db.patch(existing._id, data);
        return existing._id;
    }
    return await ctx.db.insert("diagnosticScores", {
        schoolId: test.schoolId,
        testId: params.testId,
        studentId: params.studentId,
        studentName: student.fullName,
        className,
        ...data,
    });
}

export const setScore = mutation({
    args: {
        testId: v.id("diagnosticTests"),
        studentId: v.id("students"),
        questionNumber: v.number(),
        // null clears the cell — an unanswered question is not a zero
        value: v.union(v.number(), v.null()),
    },
    handler: async (ctx, args) => {
        const test = await ctx.db.get(args.testId);
        if (!test) throw new Error("الاختبار غير موجود.");

        const question = test.questions.find(q => q.n === args.questionNumber);
        if (!question) throw new Error(`السؤال ${args.questionNumber} غير معرّف في هذا الاختبار.`);

        if (args.value !== null) {
            if (args.value < 0) throw new Error("الدرجة لا يمكن أن تكون أقل من صفر.");
            if (args.value > question.maxMark) {
                throw new Error(`الدرجة لا يمكن أن تتجاوز ${question.maxMark} لهذا السؤال.`);
            }
        }

        return await writeScoreRecord(ctx, {
            ...args,
            mutate: current => {
                const scores = { ...current.scores };
                if (args.value === null) delete scores[String(args.questionNumber)];
                else scores[String(args.questionNumber)] = args.value;
                return { scores, isAbsent: false };
            },
        });
    },
});

export const setAbsent = mutation({
    args: {
        testId: v.id("diagnosticTests"),
        studentId: v.id("students"),
        isAbsent: v.boolean(),
    },
    handler: async (ctx, args) => {
        return await writeScoreRecord(ctx, {
            ...args,
            // An absentee has no marks; keeping them would skew every average
            mutate: current => args.isAbsent
                ? { scores: {}, isAbsent: true }
                : { ...current, isAbsent: false },
        });
    },
});

// Give one question its full mark for a whole class — the common case where
// nearly everyone got an easy question right.
export const fillQuestion = mutation({
    args: {
        testId: v.id("diagnosticTests"),
        studentIds: v.array(v.id("students")),
        questionNumber: v.number(),
        value: v.union(v.number(), v.null()),
        overwrite: v.optional(v.boolean()),
    },
    handler: async (ctx, args) => {
        const test = await ctx.db.get(args.testId);
        if (!test) throw new Error("الاختبار غير موجود.");
        const question = test.questions.find(q => q.n === args.questionNumber);
        if (!question) throw new Error(`السؤال ${args.questionNumber} غير معرّف.`);
        if (args.value !== null && (args.value < 0 || args.value > question.maxMark)) {
            throw new Error(`الدرجة يجب أن تكون بين 0 و ${question.maxMark}.`);
        }

        const key = String(args.questionNumber);
        let filled = 0;
        let skipped = 0;

        for (const studentId of args.studentIds) {
            let didWrite = false;
            await writeScoreRecord(ctx, {
                testId: args.testId,
                studentId,
                mutate: current => {
                    if (current.isAbsent) return current;
                    const has = current.scores[key] !== undefined;
                    if (has && !args.overwrite) return current;
                    const scores = { ...current.scores };
                    if (args.value === null) delete scores[key];
                    else scores[key] = args.value;
                    didWrite = true;
                    return { ...current, scores };
                },
            });
            if (didWrite) filled++; else skipped++;
        }
        return { filled, skipped };
    },
});

// Undo for fillQuestion: puts each cell back to what it held before the fill
// (null = it was blank, so the cell — and an emptied row — goes away).
export const restoreQuestion = mutation({
    args: {
        testId: v.id("diagnosticTests"),
        questionNumber: v.number(),
        entries: v.array(v.object({
            studentId: v.id("students"),
            value: v.union(v.number(), v.null()),
        })),
    },
    handler: async (ctx, args) => {
        const test = await ctx.db.get(args.testId);
        if (!test) throw new Error("الاختبار غير موجود.");
        const question = test.questions.find(q => q.n === args.questionNumber);
        if (!question) throw new Error(`السؤال ${args.questionNumber} غير معرّف.`);

        const key = String(args.questionNumber);
        let restored = 0;

        for (const entry of args.entries) {
            if (entry.value !== null && (entry.value < 0 || entry.value > question.maxMark)) continue;
            await writeScoreRecord(ctx, {
                testId: args.testId,
                studentId: entry.studentId,
                mutate: current => {
                    if (current.isAbsent) return current;
                    const scores = { ...current.scores };
                    if (entry.value === null) delete scores[key];
                    else scores[key] = entry.value;
                    return { ...current, scores };
                },
            });
            restored++;
        }
        return { restored };
    },
});

export const clearClassScores = mutation({
    args: { testId: v.id("diagnosticTests"), className: v.string() },
    handler: async (ctx, args) => {
        const rows = await ctx.db.query("diagnosticScores")
            .withIndex("by_test_class", q =>
                q.eq("testId", args.testId).eq("className", args.className))
            .collect();
        for (const r of rows) await ctx.db.delete(r._id);
        return { cleared: rows.length };
    },
});

// Wipe the whole test in one action — clearing a column at a time only ever
// touches the class on screen, which is how marks get left behind elsewhere.
export const clearAllScores = mutation({
    args: { testId: v.id("diagnosticTests") },
    handler: async (ctx, args) => {
        const rows = await ctx.db.query("diagnosticScores")
            .withIndex("by_test", q => q.eq("testId", args.testId))
            .collect();
        for (const r of rows) await ctx.db.delete(r._id);
        return { cleared: rows.length };
    },
});

// Where the marks actually are, so no class is silently left half-entered.
export const getClassProgress = query({
    args: { testId: v.id("diagnosticTests") },
    handler: async (ctx, args) => {
        const test = await ctx.db.get(args.testId);
        if (!test) return [];

        const school = await ctx.db.query("schools").first();
        if (!school) return [];

        const classes = await ctx.db.query("classes")
            .withIndex("by_school", q => q.eq("schoolId", school._id))
            .collect();

        const rows = await ctx.db.query("diagnosticScores")
            .withIndex("by_test", q => q.eq("testId", args.testId))
            .collect();

        return await Promise.all(test.classNames.map(async className => {
            const cls = classes.find(c => c.name.trim() === className.trim());
            const students = cls
                ? (await ctx.db.query("students")
                    .withIndex("by_class", q => q.eq("classId", cls._id))
                    .collect())
                    .filter(s => s.isActive !== false)
                : [];

            const mine = rows.filter(r => r.className === className);
            return {
                className,
                expected: students.length,
                gradedCount: mine.filter(r => !r.isAbsent && Object.keys(parseScores(r.scores)).length > 0).length,
                absentCount: mine.filter(r => r.isAbsent).length,
            };
        }));
    },
});

// ── Analysis ──────────────────────────────────────────────────────────────
type Bucket = { sum: number; max: number };

function skillTotals(questions: { n: number; skillId?: string; maxMark: number }[]) {
    const perSkill: Record<string, number> = {};
    for (const q of questions) {
        if (!q.skillId) continue;
        perSkill[q.skillId] = (perSkill[q.skillId] ?? 0) + q.maxMark;
    }
    return perSkill;
}

export const getAnalysis = query({
    args: { testId: v.id("diagnosticTests") },
    handler: async (ctx, args) => {
        const test = await ctx.db.get(args.testId);
        if (!test) return null;

        const total = totalMarks(test.questions);
        const masteryMark = total * test.masteryThreshold;
        const perSkillMax = skillTotals(test.questions);

        const rows = await ctx.db.query("diagnosticScores")
            .withIndex("by_test", q => q.eq("testId", args.testId))
            .collect();

        // How many students the test covers, whether or not they were graded
        const school = await ctx.db.query("schools").first();
        const classes = school
            ? (await ctx.db.query("classes")
                .withIndex("by_school", q => q.eq("schoolId", school._id))
                .collect())
                .filter(c => test.classNames.includes(c.name.trim()))
            : [];

        let expected = 0;
        for (const cls of classes) {
            const students = await ctx.db.query("students")
                .withIndex("by_class", q => q.eq("classId", cls._id))
                .collect();
            expected += students.filter(s => s.isActive !== false).length;
        }

        const graded = rows.filter(r => !r.isAbsent && Object.keys(parseScores(r.scores)).length > 0);

        // Per student: total, percentage, per-skill percentage
        const students = graded.map(r => {
            const scores = parseScores(r.scores);
            const scored = test.questions.reduce((sum, q) => sum + (scores[String(q.n)] ?? 0), 0);

            const perSkill: Record<string, number> = {};
            const skillBuckets: Record<string, Bucket> = {};
            for (const q of test.questions) {
                if (!q.skillId) continue;
                const b = skillBuckets[q.skillId] ??= { sum: 0, max: 0 };
                b.sum += scores[String(q.n)] ?? 0;
                b.max += q.maxMark;
            }
            for (const [skillId, b] of Object.entries(skillBuckets)) {
                perSkill[skillId] = b.max > 0 ? b.sum / b.max : 0;
            }

            return {
                studentId: r.studentId,
                studentName: r.studentName,
                className: r.className,
                total: scored,
                percent: total > 0 ? scored / total : 0,
                mastered: scored >= masteryMark,
                perSkill,
                answered: Object.keys(scores).length,
            };
        }).sort((a, b) => b.total - a.total);

        const totals = students.map(s => s.total);
        const mean = totals.length ? totals.reduce((a, b) => a + b, 0) / totals.length : 0;
        const variance = totals.length > 1
            ? totals.reduce((acc, t) => acc + (t - mean) ** 2, 0) / (totals.length - 1)
            : 0;

        // Per skill across the cohort
        const bySkill = test.skills.map(skill => {
            const max = perSkillMax[skill.id] ?? 0;
            const values = students.map(s => s.perSkill[skill.id] ?? 0);
            const avg = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
            const masteredCount = values.filter(v => v >= test.masteryThreshold).length;
            const firstQ = test.questions.find(q => q.skillId === skill.id);
            return {
                id: skill.id,
                label: skill.label,
                subjectName: firstQ ? subjectOfQuestion(firstQ, test) : skill.subjectName,
                questionCount: test.questions.filter(q => q.skillId === skill.id).length,
                maxMark: max,
                averagePercent: avg,
                masteredCount,
                masteredPercent: values.length ? masteredCount / values.length : 0,
                highest: values.length ? Math.max(...values) : 0,
                lowest: values.length ? Math.min(...values) : 0,
            };
        }).sort((a, b) => a.averagePercent - b.averagePercent); // weakest first

        // Per question
        const byQuestion = test.questions.map(q => {
            const marks = graded.map(r => parseScores(r.scores)[String(q.n)]).filter(m => m !== undefined) as number[];
            const avg = marks.length ? marks.reduce((a, b) => a + b, 0) / marks.length : 0;
            const masteredCount = marks.filter(m => q.maxMark > 0 && m / q.maxMark >= test.masteryThreshold).length;
            return {
                n: q.n,
                skillId: q.skillId,
                subjectName: subjectOfQuestion(q, test),
                skillLabel: test.skills.find(s => s.id === q.skillId)?.label ?? "—",
                maxMark: q.maxMark,
                average: avg,
                successRate: q.maxMark > 0 ? avg / q.maxMark : 0,
                masteredCount,
                masteredPercent: marks.length ? masteredCount / marks.length : 0,
                zeroCount: marks.filter(m => m === 0).length,
                answeredCount: marks.length,
            };
        });

        // Per subject — a combined test (العلوم = كيمياء + أحياء + فيزياء) needs
        // to say how the cohort did in each of its subjects, not just overall.
        const subjects = subjectsOf(test);
        const bySubject = subjects.map(subject => {
            const qs = test.questions.filter(q => subjectOfQuestion(q, test) === subject);
            const max = qs.reduce((sum, q) => sum + q.maxMark, 0);
            const values = students.map(st => {
                const row = graded.find(r => r.studentId === st.studentId);
                const scores = parseScores(row?.scores);
                const got = qs.reduce((sum, q) => sum + (scores[String(q.n)] ?? 0), 0);
                return max > 0 ? got / max : 0;
            });
            const avg = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
            const masteredCount = values.filter(v => v >= test.masteryThreshold).length;
            return {
                subject,
                questionCount: qs.length,
                maxMark: max,
                averagePercent: avg,
                averageMark: avg * max,
                masteredCount,
                masteredPercent: values.length ? masteredCount / values.length : 0,
                skills: test.skills
                    .filter(sk => test.questions.some(q =>
                        q.skillId === sk.id && subjectOfQuestion(q, test) === subject))
                    .map(sk => sk.label),
            };
        }).sort((a, b) => a.averagePercent - b.averagePercent);

        // Per class
        const byClass = test.classNames.map(className => {
            const list = students.filter(s => s.className === className);
            const classTotals = list.map(s => s.total);
            const classMastered = list.filter(s => s.mastered).length;
            return {
                className,
                gradedCount: list.length,
                average: classTotals.length ? classTotals.reduce((a, b) => a + b, 0) / classTotals.length : 0,
                percent: classTotals.length && total > 0
                    ? (classTotals.reduce((a, b) => a + b, 0) / classTotals.length) / total : 0,
                highest: classTotals.length ? Math.max(...classTotals) : 0,
                lowest: classTotals.length ? Math.min(...classTotals) : 0,
                masteredCount: classMastered,
                masteredPercent: list.length ? classMastered / list.length : 0,
            };
        });

        // Level distribution
        const bands = [
            { label: "ممتاز (90% فأكثر)", min: 0.9, max: Infinity },
            { label: "جيد جدًا (80% – 89%)", min: 0.8, max: 0.9 },
            { label: "جيد (70% – 79%)", min: 0.7, max: 0.8 },
            { label: "مقبول (60% – 69%)", min: 0.6, max: 0.7 },
            { label: "دون المستوى (أقل من 60%)", min: -Infinity, max: 0.6 },
        ].map(b => {
            const count = students.filter(s => s.percent >= b.min && s.percent < b.max).length;
            return { ...b, count, percent: students.length ? count / students.length : 0 };
        });

        return {
            test: { ...test, totalMarks: total, masteryMark },
            expected,
            gradedCount: students.length,
            absentCount: rows.filter(r => r.isAbsent).length,
            average: mean,
            averagePercent: total > 0 ? mean / total : 0,
            highest: totals.length ? Math.max(...totals) : 0,
            lowest: totals.length ? Math.min(...totals) : 0,
            masteredCount: students.filter(s => s.mastered).length,
            masteredPercent: students.length ? students.filter(s => s.mastered).length / students.length : 0,
            stdDev: Math.sqrt(variance),
            subjects,
            bySubject,
            bySkill,
            byQuestion,
            byClass,
            bands,
            students,
        };
    },
});

// Everything needed to write the marks out to a file — the record the school
// keeps on paper. Optionally narrowed to one class or one subject.
export const getExportData = query({
    args: {
        testId: v.id("diagnosticTests"),
        className: v.optional(v.string()),
        subjectName: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const test = await ctx.db.get(args.testId);
        if (!test) return null;

        const school = await ctx.db.query("schools").first();

        const questions = test.questions
            .filter(q => !args.subjectName || subjectOfQuestion(q, test) === args.subjectName)
            .sort((a, b) => a.n - b.n)
            .map(q => ({
                n: q.n,
                maxMark: q.maxMark,
                subjectName: subjectOfQuestion(q, test),
                skillLabel: test.skills.find(s => s.id === q.skillId)?.label ?? "",
            }));

        const total = questions.reduce((sum, q) => sum + q.maxMark, 0);
        const classNames = args.className ? [args.className] : test.classNames;

        const classes = school
            ? await ctx.db.query("classes")
                .withIndex("by_school", q => q.eq("schoolId", school._id))
                .collect()
            : [];

        const rows = await ctx.db.query("diagnosticScores")
            .withIndex("by_test", q => q.eq("testId", args.testId))
            .collect();

        const sheets = await Promise.all(classNames.map(async className => {
            const cls = classes.find(c => c.name.trim() === className.trim());
            const students = cls
                ? (await ctx.db.query("students")
                    .withIndex("by_class", q => q.eq("classId", cls._id))
                    .collect())
                    .filter(s => s.isActive !== false)
                    .sort((a, b) => a.fullName.localeCompare(b.fullName, "ar"))
                : [];

            return {
                className,
                track: cls?.track ?? "عام",
                students: students.map(s => {
                    const row = rows.find(r => r.studentId === s._id);
                    const scores = parseScores(row?.scores);
                    // Only the questions in scope count toward this total
                    const scored = questions.reduce((sum, q) => sum + (scores[String(q.n)] ?? 0), 0);
                    const answered = questions.filter(q => scores[String(q.n)] !== undefined).length;
                    return {
                        studentName: s.fullName,
                        nationalId: s.nationalId ?? "",
                        isAbsent: row?.isAbsent ?? false,
                        marks: questions.map(q => scores[String(q.n)] ?? null),
                        answered,
                        total: answered > 0 ? scored : null,
                        percent: answered > 0 && total > 0 ? scored / total : null,
                        mastered: answered > 0 && total > 0 && scored / total >= test.masteryThreshold,
                    };
                }),
            };
        }));

        return {
            schoolName: school?.name ?? "",
            test: {
                title: test.title,
                subjectName: test.subjectName,
                subjectNames: subjectsOf(test),
                grade: test.grade,
                term: test.term ?? "",
                testDate: test.testDate ?? "",
                masteryThreshold: test.masteryThreshold,
            },
            scope: {
                className: args.className ?? null,
                subjectName: args.subjectName ?? null,
            },
            questions,
            totalMarks: total,
            sheets,
        };
    },
});

// Who needs remediation in one skill — the list the paper analysis never gave.
export const getRemediationList = query({
    args: { testId: v.id("diagnosticTests"), skillId: v.string() },
    handler: async (ctx, args) => {
        const test = await ctx.db.get(args.testId);
        if (!test) return null;

        const questions = test.questions.filter(q => q.skillId === args.skillId);
        const max = questions.reduce((sum, q) => sum + q.maxMark, 0);
        if (max === 0) return { skillLabel: "", students: [] };

        const rows = await ctx.db.query("diagnosticScores")
            .withIndex("by_test", q => q.eq("testId", args.testId))
            .collect();

        const below = [];
        for (const r of rows) {
            if (r.isAbsent) continue;
            const scores = parseScores(r.scores);
            if (Object.keys(scores).length === 0) continue;
            const got = questions.reduce((sum, q) => sum + (scores[String(q.n)] ?? 0), 0);
            const percent = got / max;
            if (percent >= test.masteryThreshold) continue;

            const student = await ctx.db.get(r.studentId);
            below.push({
                studentId: r.studentId,
                studentName: r.studentName,
                className: r.className,
                guardianPhone: (student as any)?.guardianPhone,
                score: got,
                maxMark: max,
                percent,
            });
        }

        return {
            skillLabel: test.skills.find(s => s.id === args.skillId)?.label ?? "",
            masteryThreshold: test.masteryThreshold,
            students: below.sort((a, b) => a.percent - b.percent),
        };
    },
});

// Pre-test vs post-test on the same skills — impossible in a single-test sheet.
export const compareTests = query({
    args: { beforeId: v.id("diagnosticTests"), afterId: v.id("diagnosticTests") },
    handler: async (ctx, args) => {
        const before = await ctx.db.get(args.beforeId);
        const after = await ctx.db.get(args.afterId);
        if (!before || !after) return null;

        const summarise = async (test: typeof before) => {
            const rows = await ctx.db.query("diagnosticScores")
                .withIndex("by_test", q => q.eq("testId", test._id))
                .collect();
            const graded = rows.filter(r => !r.isAbsent && Object.keys(parseScores(r.scores)).length > 0);

            const perSkill: Record<string, { sum: number; n: number }> = {};
            const perStudent: Record<string, { name: string; className: string; percent: number }> = {};
            const total = totalMarks(test.questions);

            for (const r of graded) {
                const scores = parseScores(r.scores);
                const buckets: Record<string, Bucket> = {};
                for (const q of test.questions) {
                    if (!q.skillId) continue;
                    const b = buckets[q.skillId] ??= { sum: 0, max: 0 };
                    b.sum += scores[String(q.n)] ?? 0;
                    b.max += q.maxMark;
                }
                for (const [skillId, b] of Object.entries(buckets)) {
                    const acc = perSkill[skillId] ??= { sum: 0, n: 0 };
                    acc.sum += b.max > 0 ? b.sum / b.max : 0;
                    acc.n++;
                }
                const scored = test.questions.reduce((sum, q) => sum + (scores[String(q.n)] ?? 0), 0);
                perStudent[r.studentId as string] = {
                    name: r.studentName,
                    className: r.className,
                    percent: total > 0 ? scored / total : 0,
                };
            }
            return { perSkill, perStudent, gradedCount: graded.length };
        };

        const b = await summarise(before);
        const a = await summarise(after);

        // Match skills by label so two separately-built tests still line up
        const skillRows = before.skills.map(skill => {
            const afterSkill = after.skills.find(s => s.label.trim() === skill.label.trim());
            const beforeAvg = b.perSkill[skill.id] ? b.perSkill[skill.id].sum / b.perSkill[skill.id].n : null;
            const afterAvg = afterSkill && a.perSkill[afterSkill.id]
                ? a.perSkill[afterSkill.id].sum / a.perSkill[afterSkill.id].n : null;
            return {
                label: skill.label,
                before: beforeAvg,
                after: afterAvg,
                change: beforeAvg !== null && afterAvg !== null ? afterAvg - beforeAvg : null,
                matched: afterSkill !== undefined,
            };
        }).sort((x, y) => (x.change ?? 0) - (y.change ?? 0));

        const studentRows = Object.entries(b.perStudent)
            .filter(([id]) => a.perStudent[id])
            .map(([id, bef]) => ({
                studentId: id,
                studentName: bef.name,
                className: bef.className,
                before: bef.percent,
                after: a.perStudent[id].percent,
                change: a.perStudent[id].percent - bef.percent,
            }))
            .sort((x, y) => x.change - y.change);

        return {
            before: { title: before.title, gradedCount: b.gradedCount },
            after: { title: after.title, gradedCount: a.gradedCount },
            skills: skillRows,
            students: studentRows,
            unmatchedSkills: skillRows.filter(s => !s.matched).map(s => s.label),
        };
    },
});

// One student's card: total, level, and every skill with its percentage.
export const getStudentReport = query({
    args: { testId: v.id("diagnosticTests"), studentId: v.id("students") },
    handler: async (ctx, args) => {
        const test = await ctx.db.get(args.testId);
        if (!test) return null;

        const row = (await ctx.db.query("diagnosticScores")
            .withIndex("by_test", q => q.eq("testId", args.testId))
            .collect())
            .find(s => s.studentId === args.studentId);
        if (!row) return null;

        const school = await ctx.db.query("schools").first();
        const scores = parseScores(row.scores);
        const total = totalMarks(test.questions);
        const scored = test.questions.reduce((sum, q) => sum + (scores[String(q.n)] ?? 0), 0);

        const skills = test.skills.map(skill => {
            const qs = test.questions.filter(q => q.skillId === skill.id);
            const max = qs.reduce((sum, q) => sum + q.maxMark, 0);
            const got = qs.reduce((sum, q) => sum + (scores[String(q.n)] ?? 0), 0);
            return {
                label: skill.label,
                questionCount: qs.length,
                score: got,
                maxMark: max,
                percent: max > 0 ? got / max : 0,
                mastered: max > 0 && got / max >= test.masteryThreshold,
            };
        }).sort((a, b) => a.percent - b.percent);

        const reportSubjects = subjectsOf(test).map(subject => {
            const qs = test.questions.filter(q => subjectOfQuestion(q, test) === subject);
            const max = qs.reduce((sum, q) => sum + q.maxMark, 0);
            const got = qs.reduce((sum, q) => sum + (scores[String(q.n)] ?? 0), 0);
            return {
                subject,
                questionCount: qs.length,
                score: got,
                maxMark: max,
                percent: max > 0 ? got / max : 0,
                mastered: max > 0 && got / max >= test.masteryThreshold,
            };
        });

        return {
            schoolName: school?.name ?? "",
            test: { ...test, totalMarks: total, masteryMark: total * test.masteryThreshold },
            subjects: reportSubjects,
            studentName: row.studentName,
            className: row.className,
            isAbsent: row.isAbsent ?? false,
            total: scored,
            percent: total > 0 ? scored / total : 0,
            mastered: scored >= total * test.masteryThreshold,
            skills: skills.map(sk => {
                const firstQ = test.questions.find(q => test.skills.find(x => x.label === sk.label)?.id === q.skillId);
                return { ...sk, subjectName: firstQ ? subjectOfQuestion(firstQ, test) : undefined };
            }),
            questions: test.questions.map(q => ({
                n: q.n,
                maxMark: q.maxMark,
                score: scores[String(q.n)],
                subjectName: subjectOfQuestion(q, test),
                skillLabel: test.skills.find(s => s.id === q.skillId)?.label ?? "—",
            })),
        };
    },
});
