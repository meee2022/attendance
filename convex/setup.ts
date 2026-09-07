import { mutation, query } from "./_generated/server";

export const seedDatabase = mutation({
    args: {},
    handler: async (ctx) => {
        // Check if we already have a school
        const existingSchool = await ctx.db.query("schools").first();
        if (existingSchool) return "Already seeded.";

        const schoolId = await ctx.db.insert("schools", {
            name: "Qatar School for Boys",
            code: "QSB-001",
            createdAt: new Date().toISOString(),
        });

        const subjectsToCreate = [
            { name: "شرعية", code: "ISL" },
            { name: "عربي", code: "ARB" },
            { name: "انجليزي", code: "ENG" },
            { name: "رياضيات", code: "MAT" },
            { name: "كيمياء", code: "CHM" },
            { name: "فيزياء", code: "PHY" },
            { name: "أحياء", code: "BIO" },
            { name: "تاريخ", code: "HIS" },
            { name: "حوسبة", code: "COM" }
        ];

        for (const sub of subjectsToCreate) {
            await ctx.db.insert("subjects", {
                schoolId,
                name: sub.name,
                code: sub.code
            });
        }

        const classesToCreate = [
            { name: "10-1", grade: 10 },
            { name: "10-2", grade: 10 },
            { name: "11-1", grade: 11 },
            { name: "12-1", grade: 12 },
        ];

        for (const cls of classesToCreate) {
            const classId = await ctx.db.insert("classes", {
                schoolId,
                name: cls.name,
                grade: cls.grade,
                isActive: true,
            });

            // Insert 5 dummy students per class
            for (let i = 1; i <= 5; i++) {
                await ctx.db.insert("students", {
                    schoolId,
                    classId,
                    fullName: `طالب ${i} في الصف ${cls.name}`,
                    nationalId: `12345${cls.grade}${i}`,
                    isActive: true
                });
            }
        }

        return "Database seeded successfully.";
    },
});

// ── Canonical class structure ─────────────────────────────────────────────
// Single source of truth for "تحديث هيكل الصفوف". Sections are numbered 1..n
// plus an optional ESE section; the track follows the section number.
// Importing a registry sheet overrides this with whatever the sheet says.
const CLASS_STRUCTURE: { grade: number; sections: number; ese: boolean }[] = [
    { grade: 10, sections: 10, ese: true },
    { grade: 11, sections: 9,  ese: true },
    { grade: 12, sections: 10, ese: true },
];

// Track from grade + section name: 1-3 علمي · 4-5 تكنولوجي · 6+ أدبي
function trackForSection(grade: number, className: string): string {
    if (grade === 10) return "عام";
    const match = className.match(/-(\d+)$/);
    if (!match) return "أدبي"; // ESE sections sit with the humanities track
    const num = parseInt(match[1], 10);
    if (num >= 1 && num <= 3) return "علمي";
    if (num >= 4 && num <= 5) return "تكنولوجي";
    return "أدبي";
}

function expandStructure(): { name: string; grade: number; track: string }[] {
    const out: { name: string; grade: number; track: string }[] = [];
    for (const { grade, sections, ese } of CLASS_STRUCTURE) {
        for (let i = 1; i <= sections; i++) {
            const name = `${grade}-${i}`;
            out.push({ name, grade, track: trackForSection(grade, name) });
        }
        if (ese) {
            const name = `${grade}-ESE`;
            out.push({ name, grade, track: trackForSection(grade, name) });
        }
    }
    return out;
}

// Exposed so the maintenance screen shows the real structure instead of a
// hard-coded caption that drifts every school year.
export const getClassStructure = query({
    args: {},
    handler: async () => {
        return CLASS_STRUCTURE.map(({ grade, sections, ese }) => ({
            grade,
            sections,
            ese,
            label: `${grade}-1 إلى ${grade}-${sections}${ese ? ` + ${grade}-ESE` : ""}`,
        }));
    },
});

export const ensureAllClasses = mutation({
    args: {},
    handler: async (ctx) => {
        const school = await ctx.db.query("schools").first();
        if (!school) throw new Error("لا توجد مدرسة. يرجى تهيئة البيانات أولاً.");

        const existingClasses = await ctx.db.query("classes")
            .withIndex("by_school", q => q.eq("schoolId", school._id))
            .collect();

        const byName = new Map(existingClasses.map(c => [c.name.trim(), c]));

        const createdNames: string[] = [];
        const updatedNames: string[] = [];

        for (const cls of expandStructure()) {
            const existing = byName.get(cls.name);
            if (!existing) {
                await ctx.db.insert("classes", {
                    schoolId: school._id,
                    name: cls.name,
                    grade: cls.grade,
                    track: cls.track,
                    isActive: true,
                });
                createdNames.push(cls.name);
                continue;
            }

            // Reactivate and correct grade/track on classes that already exist
            const patch: Record<string, unknown> = {};
            if (existing.grade !== cls.grade) patch.grade = cls.grade;
            if (existing.track !== cls.track) patch.track = cls.track;
            if (existing.isActive !== true) patch.isActive = true;
            if (Object.keys(patch).length > 0) {
                await ctx.db.patch(existing._id, patch);
                updatedNames.push(cls.name);
            }
        }

        return {
            created: createdNames.length,
            createdNames,
            updated: updatedNames.length,
            updatedNames,
            totalExisting: existingClasses.length,
        };
    },
});

export const getInitialData = query({
    args: {},
    handler: async (ctx) => {
        const school = await ctx.db.query("schools").first();
        if (!school) return { schools: [], classes: [], subjects: [] };
        const classes = await ctx.db.query("classes")
            .withIndex("by_school", q => q.eq("schoolId", school._id))
            .collect();
        const subjects = await ctx.db.query("subjects")
            .filter(q => q.eq(q.field("schoolId"), school._id))
            .collect();
        return { schools: [school], classes, subjects };
    },
});

export const getStudentCounts = query({
    args: {},
    handler: async (ctx) => {
        const school = await ctx.db.query("schools").first();
        if (!school) return { total: 0, perClass: {} };
        // Use by_school index — no full table scan
        const students = await ctx.db.query("students")
            .withIndex("by_school", q => q.eq("schoolId", school._id))
            .collect();
        const total = students.length;
        const perClass: Record<string, number> = {};
        for (const s of students) {
            const cid = s.classId as string;
            perClass[cid] = (perClass[cid] || 0) + 1;
        }
        return { total, perClass };
    },
});
