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

// Ensure all required classes exist: Grade 10 (8), Grade 11 (10), Grade 12 (10)
export const ensureAllClasses = mutation({
    args: {},
    handler: async (ctx) => {
        const school = await ctx.db.query("schools").first();
        if (!school) throw new Error("لا توجد مدرسة. يرجى تهيئة البيانات أولاً.");

        const existingClasses = await ctx.db.query("classes")
            .withIndex("by_school", q => q.eq("schoolId", school._id))
            .collect();

        const existingNames = new Set(existingClasses.map(c => c.name));

        const classesToCreate: { name: string; grade: number }[] = [];

        // Grade 10: 8 classes
        for (let i = 1; i <= 8; i++) {
            const name = `10-${i}`;
            if (!existingNames.has(name)) {
                classesToCreate.push({ name, grade: 10 });
            }
        }

        // Grade 11: 10 classes
        for (let i = 1; i <= 10; i++) {
            const name = `11-${i}`;
            if (!existingNames.has(name)) {
                classesToCreate.push({ name, grade: 11 });
            }
        }

        // Grade 12: 10 classes
        for (let i = 1; i <= 10; i++) {
            const name = `12-${i}`;
            if (!existingNames.has(name)) {
                classesToCreate.push({ name, grade: 12 });
            }
        }

        // Helper to determine track based on grade and class name
        function getTrack(grade: number, className: string): string {
            if (grade === 10) return "عام";

            // Extract class number: "11-4" -> 4
            const match = className.match(/-(\d+)$/);
            const num = match ? parseInt(match[1], 10) : 0;

            if (num >= 1 && num <= 3) return "علمي";
            if (num >= 4 && num <= 5) return "تكنولوجي";
            if (num >= 6 && num <= 10) return "أدبي";
            return "عام";
        }

        for (const cls of classesToCreate) {
            await ctx.db.insert("classes", {
                schoolId: school._id,
                name: cls.name,
                grade: cls.grade,
                track: getTrack(cls.grade, cls.name),
                isActive: true,
            });
        }

        return {
            created: classesToCreate.length,
            createdNames: classesToCreate.map(c => c.name),
            totalExisting: existingClasses.length,
        };
    },
});

export const getInitialData = query({
    args: {},
    handler: async (ctx) => {
        const schools = await ctx.db.query("schools").collect();
        const classes = await ctx.db.query("classes").collect();
        const subjects = await ctx.db.query("subjects").collect();
        // Do NOT load all students — use getStudentCounts for counts
        return { schools, classes, subjects };
    },
});

export const getStudentCounts = query({
    args: {},
    handler: async (ctx) => {
        const students = await ctx.db.query("students").collect();
        const total = students.length;
        const perClass: Record<string, number> = {};
        for (const s of students) {
            const cid = s.classId as string;
            perClass[cid] = (perClass[cid] || 0) + 1;
        }
        return { total, perClass };
    },
});
