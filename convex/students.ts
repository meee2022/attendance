import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const importStudentsFromSheet = mutation({
    args: {
        schoolId: v.id("schools"),
        rows: v.array(v.object({
            fullName: v.string(),
            className: v.string(),  // Already normalized (e.g. "10-1", "11-3")
            phones: v.string()
        }))
    },
    handler: async (ctx, args) => {
        let importedCount = 0;

        // Fetch existing classes for this school
        const existingClasses = await ctx.db.query("classes")
            .withIndex("by_school", q => q.eq("schoolId", args.schoolId))
            .collect();

        const classNameToId = new Map<string, string>();
        for (const cls of existingClasses) {
            // Normalize stored class names too (in case they were stored as "10/1")
            const normalized = cls.name.trim().replace(/\//g, "-");
            classNameToId.set(normalized, cls._id);
        }

        // Skip rows with no name or no class
        const validRows = args.rows.filter(r => r.fullName.trim() && r.className.trim());

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

        for (const row of validRows) {
            const normalizedClass = row.className.trim().replace(/\//g, "-");

            // Derive grade from the part before the dash: "10-1" → 10
            const gradeMatch = normalizedClass.match(/^(\d+)/);
            const grade = gradeMatch ? parseInt(gradeMatch[1], 10) : 0;

            // Find or create the class
            let classId = classNameToId.get(normalizedClass);
            if (!classId) {
                classId = await ctx.db.insert("classes", {
                    schoolId: args.schoolId,
                    name: normalizedClass,
                    grade,
                    track: getTrack(grade, normalizedClass),
                    isActive: true,
                });
                classNameToId.set(normalizedClass, classId);
            }

            // Parse phone number: split on /, ,, ; — keep only the first non-empty one
            let guardianPhone: string | undefined = undefined;
            if (row.phones) {
                const parts = row.phones
                    .split(/[\/,;]/)
                    .map(p => p.trim())
                    .filter(Boolean);
                if (parts.length > 0) {
                    guardianPhone = parts[0];
                }
            }

            // Insert student
            await ctx.db.insert("students", {
                schoolId: args.schoolId,
                classId: classId as any,
                fullName: row.fullName.trim(),
                guardianPhone,
                isActive: true,
            });

            importedCount++;
        }

        return { importedCount };
    }
});

export const deleteAllStudentsAndAttendance = mutation({
    args: { schoolId: v.id("schools") },
    handler: async (ctx, args) => {
        // Delete all attendance records for the school
        const allAtt = await ctx.db.query("attendance")
            .filter(q => q.eq(q.field("schoolId"), args.schoolId))
            .collect();
        for (const a of allAtt) await ctx.db.delete(a._id);

        // Delete all periods
        const allPeriods = await ctx.db.query("periods")
            .filter(q => q.eq(q.field("schoolId"), args.schoolId))
            .collect();
        for (const p of allPeriods) await ctx.db.delete(p._id);

        // Delete all students
        const allStudents = await ctx.db.query("students")
            .withIndex("by_school", q => q.eq("schoolId", args.schoolId))
            .collect();
        for (const s of allStudents) await ctx.db.delete(s._id);

        return {
            students: allStudents.length,
            attendance: allAtt.length,
            periods: allPeriods.length,
        };
    },
});

export const deleteDummyStudents = mutation({
    args: { schoolId: v.id("schools") },
    handler: async (ctx, args) => {
        const students = await ctx.db.query("students")
            .withIndex("by_school", q => q.eq("schoolId", args.schoolId))
            .collect();

        let studentCount = 0;
        let attendanceCount = 0;

        for (const student of students) {
            // Seeded students have nationalId starting with 12345 or names starting with "طالب"
            const isDummy =
                student.fullName.startsWith("طالب") ||
                student.nationalId?.startsWith("12345");

            if (isDummy) {
                // Delete all attendance records for this dummy student
                const atts = await ctx.db.query("attendance")
                    .withIndex("by_student", q => q.eq("studentId", student._id))
                    .collect();

                for (const a of atts) {
                    await ctx.db.delete(a._id);
                    attendanceCount++;
                }

                await ctx.db.delete(student._id);
                studentCount++;
            }
        }
        return { studentCount, attendanceCount };
    },
});
