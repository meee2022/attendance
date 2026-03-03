import { useState, useMemo } from "react";
import { useQuery } from "convex/react";
import { Hash, Layers } from "lucide-react";
// @ts-ignore
import { api } from "../../convex/_generated/api";
import ClassPeriodGrid from "./ClassPeriodGrid";

const GRADE_LABELS: Record<number, string> = {
    10: "الصف العاشر",
    11: "الصف الحادي عشر",
    12: "الصف الثاني عشر",
};

interface PeriodGridSectionProps {
    date: string;
}

export default function PeriodGridSection({ date }: PeriodGridSectionProps) {
    const [selectedGrade, setSelectedGrade] = useState<number>(10);
    const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
    const [periodsPerDay, setPeriodsPerDay] = useState<number>(5);

    // Get school + all classes (not dependent on attendance data)
    const initData = useQuery(api.setup.getInitialData);

    const schoolId = initData?.schools?.[0]?._id || null;

    const gradeClasses = useMemo(() => {
        if (!initData?.classes) return [];
        return initData.classes
            .filter((c: any) => c.grade === selectedGrade && c.isActive)
            .sort((a: any, b: any) => {
                const numA = parseInt(a.name.split("-")[1] || "0", 10);
                const numB = parseInt(b.name.split("-")[1] || "0", 10);
                return numA - numB;
            });
    }, [initData, selectedGrade]);

    // Auto-select first class when grade changes or when classes load
    const activeClassId = useMemo(() => {
        if (selectedClassId && gradeClasses.some((c: any) => c._id === selectedClassId)) {
            return selectedClassId;
        }
        return gradeClasses.length > 0 ? gradeClasses[0]._id : null;
    }, [gradeClasses, selectedClassId]);

    return (
        <div className="space-y-4">
            {/* Section Banner */}
            <div className="bg-[#009b9f] text-white text-center py-3 text-2xl font-bold shadow-sm mt-6">
                سجل متابعة غياب حصص البث المباشر
            </div>

            {/* Controls Row */}
            <div className="flex flex-col sm:flex-row flex-wrap items-center gap-4 bg-white p-4 shadow-sm border border-slate-200">
                {/* Grade Selector */}
                <div className="flex items-center gap-2 bg-slate-50 p-2 border border-slate-300">
                    <Layers className="w-5 h-5 text-slate-500" />
                    <select
                        className="bg-transparent border-none outline-none text-slate-700 font-bold cursor-pointer pr-1"
                        value={selectedGrade}
                        onChange={(e) => {
                            setSelectedGrade(Number(e.target.value));
                            setSelectedClassId(null);
                        }}
                    >
                        {[10, 11, 12].map((g) => (
                            <option key={g} value={g}>
                                {GRADE_LABELS[g]}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Periods Per Day */}
                <div className="flex items-center gap-2 bg-slate-50 p-2 border border-slate-300">
                    <Hash className="w-5 h-5 text-slate-500" />
                    <label className="text-slate-700 font-bold text-sm whitespace-nowrap">
                        عدد الحصص في اليوم
                    </label>
                    <input
                        type="number"
                        min={1}
                        max={7}
                        value={periodsPerDay}
                        onChange={(e) => {
                            const v = Math.max(1, Math.min(7, Number(e.target.value)));
                            setPeriodsPerDay(v);
                        }}
                        className="w-14 text-center bg-white border border-slate-300 rounded px-2 py-1 font-bold text-slate-800"
                    />
                </div>
            </div>

            {/* Class Tabs */}
            {gradeClasses.length > 0 ? (
                <div className="bg-white shadow-sm border border-slate-200 p-2 overflow-x-auto">
                    <div className="flex gap-1 min-w-max">
                        {gradeClasses.map((cls: any) => {
                            const isActive = cls._id === activeClassId;
                            return (
                                <button
                                    key={cls._id}
                                    onClick={() => setSelectedClassId(cls._id)}
                                    className={`px-4 py-2 rounded-t font-bold text-sm transition-all whitespace-nowrap border-b-2 ${isActive
                                        ? "bg-[#009b9f] text-white border-[#009b9f] shadow-sm"
                                        : "bg-slate-50 text-slate-600 border-transparent hover:bg-slate-100 hover:text-slate-800"
                                        }`}
                                >
                                    {cls.name}
                                </button>
                            );
                        })}
                    </div>
                </div>
            ) : (
                <div className="bg-white p-8 text-center shadow-sm border border-slate-200">
                    <p className="text-slate-500 font-bold">لا توجد صفوف لهذه المرحلة</p>
                </div>
            )}

            {/* Period Grid */}
            {activeClassId && schoolId && (
                <div className="bg-white shadow-sm border border-slate-200 p-4">
                    <ClassPeriodGrid
                        classId={activeClassId}
                        schoolId={schoolId}
                        date={date}
                        periodsPerDay={periodsPerDay}
                    />
                </div>
            )}
        </div>
    );
}
