import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Helper for name normalization
const normalizeName = (name: string) => {
    if (!name) return "";
    return name
        .trim()
        .toLowerCase()
        .replace(/[أإآ]/g, 'ا')
        .replace(/ة/g, 'ه')
        .replace(/\s+/g, ' ');
};

const getFirstAndLastWords = (name: string) => {
    const words = name.split(' ').filter(w => w.length > 0);
    if (words.length === 0) return { first: "", last: "" };
    return { first: words[0], last: words[words.length - 1] };
};

// The teacher uploads a list of absent student names.
export const processAttendance = mutation({
    args: {
        schoolId: v.id("schools"),
        classId: v.id("classes"),
        subjectId: v.id("subjects"),
        date: v.string(), // YYYY-MM-DD
        periodNumber: v.number(),
        absentNames: v.array(v.string()) // The parsed names from excel
    },
    handler: async (ctx, args) => {
        // 1. Find or create the period
        let period = await ctx.db.query("periods")
            .withIndex("by_class_date", q => q.eq("classId", args.classId).eq("date", args.date))
            .filter(q => q.eq(q.field("periodNumber"), args.periodNumber))
            .first();

        let periodId = period?._id;

        if (!periodId) {
            periodId = await ctx.db.insert("periods", {
                schoolId: args.schoolId,
                classId: args.classId,
                subjectId: args.subjectId,
                date: args.date,
                periodNumber: args.periodNumber,
                status: "uploaded"
            });
        } else {
            // If we are overriding, we update status and subject just in case it changed
            await ctx.db.patch(periodId, {
                subjectId: args.subjectId,
                status: "uploaded"
            });
            // Delete existing attendance for this period to override safely
            const existingAtt = await ctx.db.query("attendance")
                .withIndex("by_period", q => q.eq("periodId", periodId as any))
                .collect();
            for (const att of existingAtt) await ctx.db.delete(att._id);
        }

        // 2. Normalize and match students
        const classStudents = await ctx.db.query("students")
            .withIndex("by_class", q => q.eq("classId", args.classId))
            .filter(q => q.eq(q.field("isActive"), true))
            .collect();

        const unverified: string[] = [];
        const matchedAbsentIds = new Set<string>();

        for (const rawName of args.absentNames) {
            const cleanName = normalizeName(rawName);
            if (!cleanName) continue;

            const matchedStudent = classStudents.find(s => normalizeName(s.fullName) === cleanName);

            if (matchedStudent) {
                matchedAbsentIds.add(matchedStudent._id);
                await ctx.db.insert("attendance", {
                    schoolId: args.schoolId,
                    classId: args.classId,
                    periodId: periodId,
                    studentId: matchedStudent._id,
                    status: "absent",
                    source: "upload"
                });
            } else {
                unverified.push(rawName);
                await ctx.db.insert("attendance", {
                    schoolId: args.schoolId,
                    classId: args.classId,
                    periodId: periodId,
                    status: "unverified",
                    source: "upload",
                    notes: rawName
                });
            }
        }

        // 3. Mark the rest as present
        const presentCount = classStudents.length - matchedAbsentIds.size;
        for (const student of classStudents) {
            if (!matchedAbsentIds.has(student._id)) {
                await ctx.db.insert("attendance", {
                    schoolId: args.schoolId,
                    classId: args.classId,
                    periodId: periodId,
                    studentId: student._id,
                    status: "present",
                    source: "upload"
                });
            }
        }

        return {
            message: "Processed",
            periodId,
            totalStudents: classStudents.length,
            presentCount,
            absentCount: matchedAbsentIds.size,
            unverifiedCount: unverified.length,
            unverifiedNames: unverified
        };
    }
});

// NEW FLOW: Prepare Single Period Attendance (Draft)
export const prepareSinglePeriodAttendance = mutation({
    args: {
        schoolId: v.id("schools"),
        classId: v.id("classes"),
        subjectId: v.id("subjects"),
        date: v.string(), // YYYY-MM-DD
        periodNumber: v.number(),
        presentNames: v.array(v.string()) // The raw names from excel
    },
    handler: async (ctx, args) => {
        // 1. Normalize and deduplicate uploaded names
        const presentNamesSet = new Set<string>();
        args.presentNames.forEach(name => {
            const clean = normalizeName(name);
            if (clean) presentNamesSet.add(clean);
        });
        const normalizedUploadedNames = Array.from(presentNamesSet);

        // 2. Find or create the period doc (draft state)
        let period = await ctx.db.query("periods")
            .withIndex("by_class_date", q => q.eq("classId", args.classId).eq("date", args.date))
            .filter(q => q.eq(q.field("periodNumber"), args.periodNumber))
            .first();

        let periodId = period?._id;
        if (!periodId) {
            periodId = await ctx.db.insert("periods", {
                schoolId: args.schoolId,
                classId: args.classId,
                subjectId: args.subjectId,
                date: args.date,
                periodNumber: args.periodNumber,
                status: "open"
            });
        }

        // 3. Fetch all active students in this class
        const classStudents = await ctx.db.query("students")
            .withIndex("by_class", q => q.eq("classId", args.classId))
            .filter(q => q.eq(q.field("isActive"), true))
            .collect();

        const studentData = classStudents.map(s => ({
            id: s._id,
            fullName: s.fullName,
            normalized: normalizeName(s.fullName)
        }));

        // 4. Matching Logic
        const matchedStudentIds = new Set<string>();
        const usedUploadedNames = new Set<string>();

        // Exact Matches First
        for (const uploadedName of normalizedUploadedNames) {
            const match = studentData.find(s => s.normalized === uploadedName);
            if (match) {
                matchedStudentIds.add(match.id);
                usedUploadedNames.add(uploadedName);
            }
        }

        // Fuzzy Matches
        const fuzzyMatches: { uploadedName: string; suggestedStudents: { studentId: string; fullName: string }[] }[] = [];
        const unknownNames: string[] = [];

        for (const uploadedName of normalizedUploadedNames) {
            if (usedUploadedNames.has(uploadedName)) continue;

            const upWords = getFirstAndLastWords(uploadedName);
            const suggestions = studentData
                .filter(s => {
                    const stWords = getFirstAndLastWords(s.normalized);
                    return stWords.first === upWords.first && stWords.last === upWords.last;
                })
                .map(s => ({ studentId: s.id, fullName: s.fullName }));

            if (suggestions.length > 0) {
                fuzzyMatches.push({ uploadedName, suggestedStudents: suggestions });
            } else {
                unknownNames.push(uploadedName);
            }
        }

        // 5. Construct Grid Model
        const gridStudents = classStudents.map(s => ({
            studentId: s._id,
            fullName: s.fullName,
            present: matchedStudentIds.has(s._id)
        }));

        return {
            periodId,
            students: gridStudents,
            fuzzyMatches,
            unknownNames
        };
    }
});

// NEW FLOW: Finalize Single Period Attendance
export const finalizeSinglePeriodAttendance = mutation({
    args: {
        schoolId: v.id("schools"),
        classId: v.id("classes"),
        subjectId: v.id("subjects"),
        date: v.string(),
        periodNumber: v.number(),
        finalStudents: v.array(v.object({
            studentId: v.id("students"),
            present: v.boolean()
        }))
    },
    handler: async (ctx, args) => {
        // 1. Find or create period
        let period = await ctx.db.query("periods")
            .withIndex("by_class_date", q => q.eq("classId", args.classId).eq("date", args.date))
            .filter(q => q.eq(q.field("periodNumber"), args.periodNumber))
            .first();

        let periodId = period?._id;
        if (!periodId) {
            periodId = await ctx.db.insert("periods", {
                schoolId: args.schoolId,
                classId: args.classId,
                subjectId: args.subjectId,
                date: args.date,
                periodNumber: args.periodNumber,
                status: "finalized"
            });
        } else {
            await ctx.db.patch(periodId, { status: "finalized", subjectId: args.subjectId });
            // Delete existing attendance
            const existing = await ctx.db.query("attendance")
                .withIndex("by_period", q => q.eq("periodId", periodId as any))
                .collect();
            for (const att of existing) await ctx.db.delete(att._id);
        }

        // 2. Insert finalized attendance
        let presentCount = 0;
        let absentCount = 0;

        for (const s of args.finalStudents) {
            if (s.present) presentCount++;
            else absentCount++;

            await ctx.db.insert("attendance", {
                schoolId: args.schoolId,
                classId: args.classId,
                periodId: periodId,
                studentId: s.studentId,
                status: s.present ? "present" : "absent",
                source: "upload"
            });
        }

        return {
            success: true,
            presentCount,
            absentCount
        };
    }
});

export const getDailySummary = query({
    args: { date: v.string() },
    handler: async (ctx, args) => {
        // 1. Collect all periods for the date
        const periods = await ctx.db.query("periods")
            .filter(q => q.eq(q.field("date"), args.date))
            .collect();

        const school = await ctx.db.query("schools").first();
        if (!school) return { classes: [], summary: null };

        const classes = await ctx.db.query("classes")
            .withIndex("by_school", q => q.eq("schoolId", school._id))
            .collect();

        const students = await ctx.db.query("students")
            .withIndex("by_school", q => q.eq("schoolId", school._id))
            .collect();

        // 2. Optimization: Only fetch attendance for the relevant periods
        const periodIdsArr = periods.map(p => p._id);
        const periodIdsSet = new Set(periodIdsArr.map(id => id.toString()));

        // In a real app we'd filter attendance by periodId index, but for simplicity we fetch and filter
        const allAtt = await ctx.db.query("attendance").collect();
        const dailyAtt = allAtt.filter(a => periodIdsSet.has(a.periodId.toString()));

        const classStats = classes.map(cls => {
            const clsStudents = students.filter(s => s.classId === cls._id && s.isActive);
            const totalStudents = clsStudents.length;

            const clsPeriods = periods.filter(p => p.classId === cls._id);
            const clsPeriodIdsSet = new Set(clsPeriods.map(p => p._id.toString()));

            // All attendance for this class today
            const clsAtt = dailyAtt.filter(a => clsPeriodIdsSet.has(a.periodId.toString()));

            let dayAbsent = 0;
            let dayPresent = 0;
            const hasData = clsPeriods.length > 0;

            if (hasData) {
                clsStudents.forEach(st => {
                    const stAtt = clsAtt.filter(a => a.studentId === st._id);
                    if (stAtt.length > 0) {
                        const hasAbsence = stAtt.some(a => a.status === "absent");
                        if (hasAbsence) dayAbsent++;
                        else dayPresent++; // Attended all recorded periods
                    }
                });
            }

            const presentPercentage = totalStudents > 0 && hasData ? (dayPresent / totalStudents) * 100 : 0;

            return {
                ...cls,
                totalStudents,
                dayPresent,
                dayAbsent,
                presentPercentage,
                hasData
            };
        });

        const totalSchoolStudents = classStats.reduce((acc, c) => acc + c.totalStudents, 0);
        const classesWithData = classStats.filter(c => c.hasData);
        const totalAccountedFor = classesWithData.reduce((acc, c) => acc + c.totalStudents, 0);
        const totalSchoolPresent = classesWithData.reduce((acc, c) => acc + c.dayPresent, 0);
        const totalSchoolAbsent = classesWithData.reduce((acc, c) => acc + c.dayAbsent, 0);

        const realPercentage = totalAccountedFor > 0 ? (totalSchoolPresent / totalAccountedFor) * 100 : 0;

        return {
            classes: classStats,
            summary: {
                totalStudents: totalAccountedFor, // Real-time population
                totalCapacity: totalSchoolStudents, // Total school size
                totalPresent: totalSchoolPresent,
                totalAbsent: totalSchoolAbsent,
                percentage: realPercentage,
                classesImported: classesWithData.length,
                totalClasses: classStats.length
            }
        };
    }
});

export const getClassDetails = query({
    args: { classId: v.id("classes"), date: v.string() },
    handler: async (ctx, args) => {
        const cls = await ctx.db.get(args.classId);
        if (!cls) return null;

        const periods = await ctx.db.query("periods")
            .withIndex("by_class_date", q => q.eq("classId", args.classId).eq("date", args.date))
            .collect();

        const students = await ctx.db.query("students")
            .withIndex("by_class", q => q.eq("classId", args.classId))
            .collect();

        const periodIds = periods.map(p => p._id);
        const attendances = await ctx.db.query("attendance")
            .filter(q => q.neq(q.field("status"), "DUMMY"))
            .collect();

        // Filter to just periods of today
        const classAtt = attendances.filter(a => periodIds.includes(a.periodId));

        const studentStats = students.map(st => {
            const stAtt = classAtt.filter(a => a.studentId === st._id);
            const absentCount = stAtt.filter(a => a.status === "absent").length;
            return {
                ...st,
                absentCount,
                attendances: stAtt
            };
        });

        return {
            cls,
            periods,
            studentStats
        };
    }
});

export const getClassPeriodGrid = query({
    args: {
        classId: v.id("classes"),
        date: v.string(),
        periodsPerDay: v.number(),
    },
    handler: async (ctx, args) => {
        const cls = await ctx.db.get(args.classId);
        if (!cls) return null;

        // Get all students for this class
        const students = await ctx.db.query("students")
            .withIndex("by_class", q => q.eq("classId", args.classId))
            .filter(q => q.eq(q.field("isActive"), true))
            .collect();

        // Get all periods for this class + date
        const periods = await ctx.db.query("periods")
            .withIndex("by_class_date", q => q.eq("classId", args.classId).eq("date", args.date))
            .collect();

        // Build a map: periodNumber -> periodId
        const periodMap = new Map<number, string>();
        for (const p of periods) {
            periodMap.set(p.periodNumber, p._id);
        }

        // Fetch all attendance records for these periods
        const allAttendance: any[] = [];
        for (const p of periods) {
            const att = await ctx.db.query("attendance")
                .withIndex("by_period", q => q.eq("periodId", p._id))
                .collect();
            allAttendance.push(...att);
        }

        // Build a lookup: studentId+periodId -> status
        const attLookup = new Map<string, string>();
        for (const a of allAttendance) {
            if (a.studentId) {
                attLookup.set(`${a.studentId}_${a.periodId}`, a.status);
            }
        }

        // Build the grid rows
        const rows = students.map((st, idx) => {
            const periodStatuses: { periodNumber: number; status: string }[] = [];
            let absentCount = 0;
            let presentCount = 0;
            for (let p = 1; p <= args.periodsPerDay; p++) {
                const periodId = periodMap.get(p);
                if (!periodId) {
                    periodStatuses.push({ periodNumber: p, status: "no_data" });
                } else {
                    const status = attLookup.get(`${st._id}_${periodId}`) || "no_data";
                    periodStatuses.push({ periodNumber: p, status });
                    if (status === "absent") absentCount++;
                    if (status === "present") presentCount++;
                }
            }
            return {
                studentId: st._id,
                studentName: st.fullName,
                guardianPhone: st.guardianPhone || "",
                classSection: cls.name,
                index: idx + 1,
                periods: periodStatuses,
                absentCount,
                presentCount,
                totalRecordedPeriods: presentCount + absentCount,
            };
        });

        // Build period summary (totals per period)
        const periodSummary: { periodNumber: number; present: number; absent: number; total: number }[] = [];
        for (let p = 1; p <= args.periodsPerDay; p++) {
            const periodId = periodMap.get(p);
            let present = 0;
            let absent = 0;
            if (periodId) {
                for (const st of students) {
                    const status = attLookup.get(`${st._id}_${periodId}`);
                    if (status === "present") present++;
                    else if (status === "absent") absent++;
                }
            }
            periodSummary.push({ periodNumber: p, present, absent, total: students.length });
        }

        return {
            className: cls.name,
            grade: cls.grade,
            totalStudents: students.length,
            rows,
            periodSummary,
        };
    }
});

// Toggle a single student's attendance for a specific period
export const toggleAttendance = mutation({
    args: {
        schoolId: v.id("schools"),
        classId: v.id("classes"),
        studentId: v.id("students"),
        date: v.string(),
        periodNumber: v.number(),
    },
    handler: async (ctx, args) => {
        // Find or create the period
        let period = await ctx.db.query("periods")
            .withIndex("by_class_date", q => q.eq("classId", args.classId).eq("date", args.date))
            .filter(q => q.eq(q.field("periodNumber"), args.periodNumber))
            .first();

        let periodId = period?._id;

        if (!periodId) {
            // Create a period (with a placeholder subject)
            const subjects = await ctx.db.query("subjects")
                .filter(q => q.eq(q.field("schoolId"), args.schoolId))
                .first();
            const subjectId = subjects?._id;
            if (!subjectId) throw new Error("لا توجد مواد دراسية. يرجى إضافة مادة أولاً.");

            periodId = await ctx.db.insert("periods", {
                schoolId: args.schoolId,
                classId: args.classId,
                subjectId,
                date: args.date,
                periodNumber: args.periodNumber,
                status: "open",
            });

            // Mark all students as present by default
            const students = await ctx.db.query("students")
                .withIndex("by_class", q => q.eq("classId", args.classId))
                .filter(q => q.eq(q.field("isActive"), true))
                .collect();

            for (const st of students) {
                await ctx.db.insert("attendance", {
                    schoolId: args.schoolId,
                    classId: args.classId,
                    periodId,
                    studentId: st._id,
                    status: st._id === args.studentId ? "absent" : "present",
                    source: "manual",
                });
            }
            return { newStatus: "absent" };
        }

        // Period exists — find existing attendance for this student+period
        const existing = await ctx.db.query("attendance")
            .withIndex("by_period", q => q.eq("periodId", periodId as any))
            .filter(q => q.eq(q.field("studentId"), args.studentId))
            .first();

        if (existing) {
            const newStatus = existing.status === "absent" ? "present" : "absent";
            await ctx.db.patch(existing._id, { status: newStatus, source: "manual" });
            return { newStatus };
        } else {
            // No record yet — mark as absent
            await ctx.db.insert("attendance", {
                schoolId: args.schoolId,
                classId: args.classId,
                periodId: periodId,
                studentId: args.studentId,
                status: "absent",
                source: "manual",
            });
            return { newStatus: "absent" };
        }
    }
});

export const getAttendanceReport = query({
    args: {
        schoolId: v.id("schools"),
        date: v.string(),
        absentThreshold: v.optional(v.number()), // Default 2
        presentThreshold: v.optional(v.number()), // Default 1
    },
    handler: async (ctx, args) => {
        const date = args.date;
        const absentThreshold = args.absentThreshold ?? 2;
        const presentThreshold = args.presentThreshold ?? 1;

        // 1. Fetch school-specific data
        const allClasses = await ctx.db.query("classes")
            .withIndex("by_school", q => q.eq("schoolId", args.schoolId))
            .filter(q => q.eq(q.field("isActive"), true))
            .collect();

        const allStudents = await ctx.db.query("students")
            .withIndex("by_school", q => q.eq("schoolId", args.schoolId))
            .filter(q => q.eq(q.field("isActive"), true))
            .collect();

        // 2. Fetch periods for the date in this school
        const periods = await ctx.db.query("periods")
            .filter(q => q.eq(q.field("schoolId"), args.schoolId) && q.eq(q.field("date"), date))
            .collect();
        const periodIds = new Set(periods.map(p => p._id));

        // 3. Fetch attendance records for this school
        const schoolAttendance = await ctx.db.query("attendance")
            .filter(q => q.eq(q.field("schoolId"), args.schoolId))
            .collect();
        const dailyAttendance = schoolAttendance.filter(a => periodIds.has(a.periodId));

        // 4. Group attendance by student
        const studentAttMap = new Map<string, string[]>();
        for (const att of dailyAttendance) {
            if (!att.studentId) continue;
            const statuses = studentAttMap.get(att.studentId) || [];
            statuses.push(att.status);
            studentAttMap.set(att.studentId, statuses);
        }

        // 5. Build report structure
        const classStats = allClasses.map(cls => {
            const clsStudents = allStudents.filter(s => s.classId === cls._id);
            let absentInRed = 0;   // absent >= absentThreshold
            let presentInTeal = 0; // present >= presentThreshold

            clsStudents.forEach(st => {
                const statuses = studentAttMap.get(st._id) || [];
                const absentCount = statuses.filter(s => s === "absent").length;
                const presentCount = statuses.filter(s => s === "present").length;
                if (absentCount >= absentThreshold) absentInRed++;
                if (presentCount >= presentThreshold) presentInTeal++;
            });

            return {
                classId: cls._id,
                className: cls.name,
                grade: cls.grade,
                track: cls.track || "عام",
                total: clsStudents.length,
                redTable: { absent: absentInRed, present: clsStudents.length - absentInRed },
                tealTable: { present: presentInTeal, absent: clsStudents.length - presentInTeal },
            };
        }).sort((a, b) => {
            if (a.grade !== b.grade) return a.grade - b.grade;
            return a.className.localeCompare(b.className, undefined, { numeric: true });
        });

        // 6. Calculate Grade-Level Totals (The "Complete Section" requirement)
        const grades = [10, 11, 12];
        const gradeTotals = grades.map(g => {
            const gClasses = classStats.filter(c => c.grade === g);
            const total = gClasses.reduce((acc, c) => acc + c.total, 0);
            const redAbsent = gClasses.reduce((acc, c) => acc + c.redTable.absent, 0);
            const tealPresent = gClasses.reduce((acc, c) => acc + c.tealTable.present, 0);
            return {
                grade: g,
                total,
                red: { absent: redAbsent, present: total - redAbsent },
                teal: { present: tealPresent, absent: total - tealPresent },
            };
        });

        return {
            date,
            totalStudents: allStudents.length,
            absentThreshold,
            presentThreshold,
            gradeTotals, // Summary by grade
            classStats,  // Detailed sections
        };
    }
});
