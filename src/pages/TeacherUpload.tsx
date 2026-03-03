import React, { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import * as xlsx from "xlsx";
import { format } from "date-fns";
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, Layers, Search, Save, RotateCcw, UserCheck, UserX, BookOpen, Calendar, Hash, Lock, ChevronDown } from "lucide-react";
// @ts-ignore
import { api } from "../../convex/_generated/api";
import PeriodGridSection from "./PeriodGridSection";

/**
 * Parses raw Microsoft Teams attendance CSV exports.
 * Structure: 
 * 1. Summary...
 * 2. Participants
 * Name, First Join, ...
 * Arabic Name..., ...
 * 3. In-Meeting Activities
 */
function extractPresentNamesFromTeamsCsv(csvText: string): string[] {
    const lines = csvText.split(/\r?\n/);
    let inParticipantsSection = false;
    let nameColumnIndex = -1;
    let delimiter = ",";
    const names: string[] = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // Detect start of section 2
        if (line.includes("2. Participants")) {
            inParticipantsSection = true;
            continue;
        }

        if (inParticipantsSection) {
            // Detect start of section 3 (exit)
            if (line.includes("3. In-Meeting Activities")) {
                break;
            }

            // Detect header row in section 2
            if (nameColumnIndex === -1 && (line.startsWith("Name") || line.includes("Email"))) {
                // Determine separator (Teams often uses Tab for CSV exports)
                delimiter = line.includes("\t") ? "\t" : ",";
                const cols = line.split(delimiter);
                nameColumnIndex = cols.findIndex(c => c.trim().replace(/^"|"$/g, "") === "Name");
                continue;
            }

            // Collect names
            if (nameColumnIndex !== -1) {
                const cols = line.split(delimiter);
                const rawName = cols[nameColumnIndex]?.trim().replace(/^"|"$/g, "");
                if (rawName && rawName !== "Name") {
                    names.push(rawName);
                }
            }
        }
    }
    return names;
}

export default function TeacherUpload() {
    const data = useQuery(api.setup.getInitialData);
    const prepareAttendance = useMutation(api.attendance.prepareSinglePeriodAttendance);
    const finalizeAttendance = useMutation(api.attendance.finalizeSinglePeriodAttendance);

    const [selectedClass, setSelectedClass] = useState("");
    const [selectedSubject, setSelectedSubject] = useState("");
    const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
    // Override with locked date from settings as soon as it loads
    const lockedDate: string | undefined = data?.schools?.[0]?.currentDate;
    const activeDate = lockedDate ?? date;
    const [periodNumber, setPeriodNumber] = useState("1");
    const [file, setFile] = useState<File | null>(null);
    const [parsedNames, setParsedNames] = useState<string[]>([]);

    const [isProcessing, setIsProcessing] = useState(false);
    const [isFinalizing, setIsFinalizing] = useState(false);
    const [draftResult, setDraftResult] = useState<any>(null); // { periodId, students, fuzzyMatches, unknownNames }
    const [finalResult, setFinalResult] = useState<any>(null);
    const [error, setError] = useState("");

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const uploadedFile = e.target.files?.[0];
        if (!uploadedFile) return;

        if (!selectedClass || !selectedSubject || !periodNumber) {
            setError("يرجى تحديد الصف والحصة والمادة وتحرَّ الدقة في الاختيار قبل رفع الملف.");
            e.target.value = "";
            return;
        }

        setFile(uploadedFile);
        setError("");
        setDraftResult(null);
        setFinalResult(null);

        const reader = new FileReader();

        // Handle text/csv for Teams specifically, or fallback to XLSX
        if (uploadedFile.name.toLowerCase().endsWith(".csv")) {
            reader.onload = (evt) => {
                const text = evt.target?.result as string;
                // Detect if it's a Teams export
                if (text.includes("2. Participants")) {
                    const names = extractPresentNamesFromTeamsCsv(text);
                    setParsedNames(names);
                } else {
                    // Standard CSV handling via XLSX
                    try {
                        const wb = xlsx.read(text, { type: "string" });
                        const ws = wb.Sheets[wb.SheetNames[0]];
                        const json = xlsx.utils.sheet_to_json<string[]>(ws, { header: 1 });
                        const names = json.map(row => row[0]).filter(n => n && typeof n === 'string' && n !== "Name" && n !== "الاسم").map(n => n.trim());
                        setParsedNames(names);
                    } catch (err) {
                        setError("فشل في قراءة ملف CSV.");
                    }
                }
            };
            reader.readAsText(uploadedFile);
        } else {
            // Standard Excel (.xlsx, .xls)
            reader.onload = (evt) => {
                try {
                    const bstr = evt.target?.result;
                    const wb = xlsx.read(bstr, { type: "binary" });
                    const wsname = wb.SheetNames[0];
                    const ws = wb.Sheets[wsname];
                    const jsonData = xlsx.utils.sheet_to_json<string[]>(ws, { header: 1 });

                    const names: string[] = [];
                    jsonData.forEach((row) => {
                        if (row && row.length > 0 && typeof row[0] === 'string') {
                            const val = row[0].trim();
                            if (val && val !== "الاسم" && val !== "Name" && val !== "Student Name") {
                                names.push(val);
                            }
                        }
                    });
                    setParsedNames(names);
                } catch (err) {
                    setError("فشل في قراءة ملف الإكسل. يرجى التأكد من الصيغة.");
                    setParsedNames([]);
                }
            };
            reader.readAsBinaryString(uploadedFile);
        }
    };

    const handlePrepare = async () => {
        if (!selectedClass || !selectedSubject || !data || parsedNames.length === 0) {
            setError("يرجى التأكد من اختيار الصف والمادة ورفع ملف يحتوي على أسماء.");
            return;
        }

        const schoolId = data.schools[0]?._id;
        if (!schoolId) return;

        setIsProcessing(true);
        setError("");

        try {
            const res = await prepareAttendance({
                schoolId,
                classId: selectedClass as any,
                subjectId: selectedSubject as any,
                date: activeDate,
                periodNumber: parseInt(periodNumber, 10),
                presentNames: parsedNames
            });
            setDraftResult(res);
        } catch (err: any) {
            setError("حدث خطأ أثناء فحص البيانات: " + err.message);
        } finally {
            setIsProcessing(false);
        }
    };

    const togglePresence = (studentId: string) => {
        if (!draftResult) return;
        const newStudents = draftResult.students.map((s: any) =>
            s.studentId === studentId ? { ...s, present: !s.present } : s
        );
        setDraftResult({ ...draftResult, students: newStudents });
    };

    const handleFinalize = async () => {
        if (!draftResult || !data) return;

        const schoolId = data.schools[0]?._id;
        if (!schoolId) return;

        setIsFinalizing(true);
        setError("");

        try {
            const res = await finalizeAttendance({
                schoolId,
                classId: selectedClass as any,
                subjectId: selectedSubject as any,
                date: activeDate,
                periodNumber: parseInt(periodNumber, 10),
                finalStudents: draftResult.students.map((s: any) => ({
                    studentId: s.studentId,
                    present: s.present
                }))
            });
            setFinalResult(res);
            setDraftResult(null);
            setFile(null);
            setParsedNames([]);
        } catch (err: any) {
            setError("حدث خطأ أثناء حفظ الغياب المتأكد: " + err.message);
        } finally {
            setIsFinalizing(false);
        }
    };

    if (!data) return (
        <div className="flex flex-col items-center justify-center min-h-[400px]">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-qatar-maroon"></div>
        </div>
    );

    return (
        <div className="max-w-7xl mx-auto space-y-10 font-sans transition-all animate-in fade-in duration-500 pb-20">
            <div className="rounded-2xl overflow-hidden qatar-card-shadow"
                 style={{ background: "linear-gradient(135deg, #9B1239 0%, #C0184C 50%, #9B1239 100%)" }}>
                <div className="flex flex-col gap-1 p-5 sm:p-8">
                    <h1 className="text-3xl font-black text-white flex items-center gap-3">
                        <Upload className="w-8 h-8 text-white/80" />
                        رصد حضور الحصص
                    </h1>
                    <p className="text-white/70 font-medium mr-11">ارفع ملف حضور Teams أو Excel وسنقوم بمطابقته تلقائياً مع قائمة الصف</p>
                </div>
            </div>

            {/* Step 1: Configuration & Upload */}
            {!draftResult && (
                <div className="bg-white rounded-2xl qatar-card-shadow border border-qatar-gray-border overflow-hidden animate-in slide-in-from-top-4 duration-500">
                    <div className="bg-qatar-maroon px-8 py-5 flex items-center justify-between">
                        <h2 className="text-xl font-black text-white flex items-center gap-3">
                            <Layers className="w-6 h-6 text-white/50" />
                            ١. اختيار تفاصيل الحصة والملف
                        </h2>
                    </div>

                    <div className="p-4 sm:p-8 space-y-6 sm:space-y-8">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">

                            {/* Class */}
                            <div className={`rounded-2xl border-2 p-4 transition-all ${selectedClass ? 'border-qatar-maroon bg-rose-50' : 'border-rose-200 bg-rose-50/40 hover:border-qatar-maroon/60'}`}>
                                <div className="flex items-center gap-2 mb-3">
                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${selectedClass ? 'bg-qatar-maroon text-white' : 'bg-rose-100 text-qatar-maroon'}`}>
                                        <Layers className="w-4 h-4" />
                                    </div>
                                    <span className="text-xs font-black text-qatar-maroon">الصف الدراسي</span>
                                    {selectedClass && <span className="mr-auto text-[10px] bg-qatar-maroon text-white px-2 py-0.5 rounded-full font-black">✓ محدد</span>}
                                </div>
                                <select
                                    className={`w-full rounded-xl px-3 py-2.5 font-black text-sm outline-none appearance-none border transition-colors ${selectedClass ? 'bg-white border-qatar-maroon/30 text-qatar-maroon' : 'bg-white/70 border-rose-200 text-slate-500'}`}
                                    value={selectedClass}
                                    onChange={e => setSelectedClass(e.target.value)}
                                >
                                    <option value="">-- اختر الصف --</option>
                                    {data.classes.map((c: any) => (
                                        <option key={c._id} value={c._id}>{c.name}{c.track ? ` — ${c.track}` : ""}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Subject */}
                            <div className={`rounded-2xl border-2 p-4 transition-all ${selectedSubject ? 'border-blue-500 bg-blue-50' : 'border-blue-200 bg-blue-50/40 hover:border-blue-400'}`}>
                                <div className="flex items-center gap-2 mb-3">
                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${selectedSubject ? 'bg-blue-600 text-white' : 'bg-blue-100 text-blue-600'}`}>
                                        <BookOpen className="w-4 h-4" />
                                    </div>
                                    <span className="text-xs font-black text-blue-600">المادة</span>
                                    {selectedSubject && <span className="mr-auto text-[10px] bg-blue-600 text-white px-2 py-0.5 rounded-full font-black">✓ محدد</span>}
                                </div>
                                <select
                                    className={`w-full rounded-xl px-3 py-2.5 font-black text-sm outline-none appearance-none border transition-colors ${selectedSubject ? 'bg-white border-blue-300 text-blue-700' : 'bg-white/70 border-blue-200 text-slate-500'}`}
                                    value={selectedSubject}
                                    onChange={e => setSelectedSubject(e.target.value)}
                                >
                                    <option value="">-- اختر المادة --</option>
                                    {data.subjects.map((s: any) => (
                                        <option key={s._id} value={s._id}>{s.name}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Date — locked, read-only */}
                            <div className="rounded-2xl border-2 border-emerald-300 bg-emerald-50 p-4">
                                <div className="flex items-center gap-2 mb-3">
                                    <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center">
                                        <Calendar className="w-4 h-4" />
                                    </div>
                                    <span className="text-xs font-black text-emerald-700">تاريخ الحصة</span>
                                    <span className="mr-auto flex items-center gap-1 text-[10px] bg-emerald-600 text-white px-2 py-0.5 rounded-full font-black">
                                        <Lock className="w-2.5 h-2.5" />
                                        مثبَّت
                                    </span>
                                </div>
                                <div className="w-full rounded-xl px-3 py-2.5 font-black text-sm text-emerald-900 bg-white border border-emerald-300 text-center tracking-widest select-none">
                                    {activeDate}
                                </div>
                                <p className="mt-1.5 text-[10px] text-emerald-600/70 font-bold text-center">يُحدَّد من صفحة الإعدادات فقط</p>
                            </div>

                            {/* Period Number */}
                            <div className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-4 hover:border-amber-400 transition-all">
                                <div className="flex items-center gap-2 mb-3">
                                    <div className="w-8 h-8 rounded-lg bg-amber-500 text-white flex items-center justify-center">
                                        <Hash className="w-4 h-4" />
                                    </div>
                                    <span className="text-xs font-black text-amber-700">رقم الحصة</span>
                                    {periodNumber && <span className="mr-auto text-[10px] bg-amber-500 text-white px-2 py-0.5 rounded-full font-black">ح {periodNumber}</span>}
                                </div>
                                <select
                                    className="w-full rounded-xl px-3 py-2.5 font-black text-sm text-amber-800 bg-white border border-amber-300 outline-none appearance-none"
                                    value={periodNumber}
                                    onChange={e => setPeriodNumber(e.target.value)}
                                >
                                    {Array.from({ length: data.schools?.[0]?.periodsPerDay ?? 5 }, (_, i) => i + 1).map(num => (
                                        <option key={num} value={num}>الحصة {num}</option>
                                    ))}
                                </select>
                            </div>

                        </div>

                        {/* Upload Area */}
                        <div className="space-y-4">
                        <div className={`relative flex justify-center px-10 py-14 border-2 border-dashed rounded-2xl transition-all duration-300 ${
                            file
                                ? 'border-qatar-maroon bg-gradient-to-br from-rose-50 to-white'
                                : 'border-slate-300 bg-gradient-to-br from-slate-50 to-white hover:border-qatar-maroon/50 hover:from-rose-50/30'
                        }`}>
                                <div className="space-y-4 text-center">
                                    <div className={`mx-auto h-20 w-20 rounded-full flex items-center justify-center transition-colors duration-300 ${file ? 'bg-qatar-maroon text-white shadow-lg' : 'bg-slate-100 text-slate-300'}`}>
                                        <FileSpreadsheet className="h-10 w-10" />
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <label className="relative cursor-pointer rounded-md font-black text-qatar-maroon hover:text-qatar-maroon-dark transition-colors">
                                            <span className="text-xl italic">{file ? 'تغيير الملف المختار' : 'اختر ملف حضور Teams أو Excel'}</span>
                                            <input type="file" className="sr-only" accept=".xlsx,.xls,.csv" onChange={handleFileUpload} />
                                        </label>
                                        <p className="text-sm text-qatar-gray-text font-medium italic">سيتم الفلترة والبحث عن أسماء الطلاب تلقائياً</p>
                                    </div>
                                </div>
                            </div>

                            {file && (
                                <div className="flex items-center gap-4 bg-emerald-50 text-emerald-800 px-6 py-5 rounded-2xl border border-emerald-100 animate-in slide-in-from-top-2">
                                    <div className="w-10 h-10 rounded-full bg-emerald-600 flex items-center justify-center text-white flex-shrink-0">
                                        <CheckCircle2 className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <p className="font-black text-lg">تم اكتشاف {parsedNames.length} طالب حاضر</p>
                                        <p className="text-xs opacity-70 font-bold italic">الملف جاهز للمعالجة والمطابقة مع كشف الصف</p>
                                    </div>
                                </div>
                            )}

                            {error && (
                                <div className="flex items-center gap-4 bg-rose-50 text-rose-800 px-6 py-5 rounded-2xl border border-rose-100 animate-shake">
                                    <AlertCircle className="w-6 h-6 flex-shrink-0" />
                                    <p className="text-sm font-black italic">{error}</p>
                                </div>
                            )}
                        </div>

                        <div className="flex justify-center pt-4">
                            <button
                                onClick={handlePrepare}
                                disabled={isProcessing || !file || !selectedClass}
                                className="group relative overflow-hidden px-16 py-5 bg-slate-800 text-white font-black rounded-2xl shadow-xl hover:shadow-slate-400/30 transition-all active:scale-95 disabled:opacity-30 disabled:pointer-events-none"
                            >
                                <span className="relative z-10 flex items-center gap-3 text-lg">
                                    {isProcessing ? (
                                        <>
                                            <div className="animate-spin w-5 h-5 border-2 border-white/30 border-t-white rounded-full"></div>
                                            جاري جلب بيانات الصف...
                                        </>
                                    ) : (
                                        <>
                                            <Search className="w-5 h-5 group-hover:scale-125 transition-transform" />
                                            بدء عملية المطابقة والتدقيق
                                        </>
                                    )}
                                </span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Step 2: Verification Grid & Fuzzy Matching */}
            {draftResult && (
                <div className="space-y-10 animate-in slide-in-from-bottom-6 duration-700">
                    <div className="bg-white rounded-2xl qatar-card-shadow border border-qatar-gray-border overflow-hidden">
                        <div className="bg-qatar-maroon px-8 py-5 flex items-center justify-between">
                            <h2 className="text-xl font-black text-white flex items-center gap-3">
                                <CheckCircle2 className="w-6 h-6 text-white/50" />
                                ٢. مراجعة وتدقيق كشف الحضور
                            </h2>
                            <button onClick={() => setDraftResult(null)} className="p-2 hover:bg-white/10 rounded-lg text-white/80 transition-colors">
                                <RotateCcw className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-8 space-y-12">
                            {/* Ambiguous Names Panel */}
                            {draftResult.pendingNames?.length > 0 && (
                                <AmbiguousNamesPanel
                                    pendingNames={draftResult.pendingNames}
                                    onConfirm={(studentId) => {
                                        const newStudents = draftResult.students.map((s: any) =>
                                            s.studentId === studentId ? { ...s, present: true } : s
                                        );
                                        setDraftResult((prev: any) => ({ ...prev, students: newStudents }));
                                    }}
                                    onResolve={(uploadedName) => {
                                        setDraftResult((prev: any) => ({
                                            ...prev,
                                            pendingNames: prev.pendingNames.filter((p: any) => p.uploadedName !== uploadedName)
                                        }));
                                    }}
                                />
                            )}

                            {/* Verification Grid */}
                            <div className="space-y-6">
                                <div className="flex items-center justify-between border-b border-qatar-gray-border pb-4">
                                    <h3 className="text-xl font-black text-slate-800 flex items-center gap-3">
                                        <div className="w-1.5 h-6 bg-emerald-600 rounded-full"></div>
                                        تأكيد حالة حضور طلاب الصف
                                    </h3>
                                    <div className="flex items-center gap-6">
                                        <div className="flex items-center gap-2">
                                            <div className="w-3 h-3 bg-emerald-500 rounded-full"></div>
                                            <span className="text-xs font-black text-slate-500">حاضر ({draftResult.students.filter((s: any) => s.present).length})</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="w-3 h-3 bg-rose-400 rounded-full"></div>
                                            <span className="text-xs font-black text-slate-500">غائب ({draftResult.students.filter((s: any) => !s.present).length})</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                    {draftResult.students.map((s: any) => (
                                        <div
                                            key={s.studentId}
                                            onClick={() => togglePresence(s.studentId)}
                                            className={`group relative p-5 rounded-2xl border-2 transition-all cursor-pointer overflow-hidden ${s.present ? 'bg-emerald-50 border-emerald-500 shadow-md' : 'bg-white border-slate-100 opacity-60 grayscale hover:grayscale-0 hover:opacity-100 hover:border-rose-300'}`}
                                        >
                                            <div className="flex flex-col gap-1 relative z-10">
                                                <span className={`text-lg font-black leading-tight ${s.present ? 'text-emerald-900' : 'text-slate-700'}`}>{s.fullName}</span>
                                                <div className="flex items-center gap-2 mt-1">
                                                    {s.present ? (
                                                        <span className="bg-emerald-200 text-emerald-800 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest">حاضر فعلي</span>
                                                    ) : (
                                                        <span className="bg-rose-100 text-rose-700 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest">غائب الآن</span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className={`absolute top-0 bottom-0 left-0 w-1 transition-all ${s.present ? 'bg-emerald-500' : 'bg-transparent'}`}></div>
                                            <div className="absolute top-4 left-4">
                                                {s.present ? (
                                                    <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                                                        <UserCheck className="w-5 h-5" />
                                                    </div>
                                                ) : (
                                                    <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-300 flex items-center justify-center group-hover:bg-rose-100 group-hover:text-rose-500 transition-all">
                                                        <UserX className="w-5 h-5" />
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="flex flex-col items-center gap-6 pt-10 border-t border-qatar-gray-border">
                                {draftResult.pendingNames?.length > 0 && (
                                    <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-800 px-5 py-3 rounded-xl text-sm font-black">
                                        <AlertCircle className="w-4 h-4 flex-shrink-0" />
                                        هناك {draftResult.pendingNames.length} {draftResult.pendingNames.length === 1 ? "اسم غير متطابق" : "أسماء غير متطابقة"} لم يتم التعامل معها بعد — ستُتجاهل عند الحفظ.
                                    </div>
                                )}
                                <button
                                    onClick={handleFinalize}
                                    disabled={isFinalizing}
                                    className="group relative overflow-hidden bg-emerald-600 hover:bg-emerald-700 text-white px-20 py-6 rounded-2xl font-black text-2xl shadow-2xl active:scale-95 transition-all disabled:opacity-30 disabled:pointer-events-none"
                                >
                                    <span className="relative z-10 flex items-center gap-4">
                                        {isFinalizing ? (
                                            <>
                                                <div className="animate-spin w-6 h-6 border-4 border-white/30 border-t-white rounded-full"></div>
                                                جاري حفظ البيانات...
                                            </>
                                        ) : (
                                            <>
                                                <Save className="w-6 h-6" />
                                                تأكيد وحفظ السجل نهائياً
                                            </>
                                        )}
                                    </span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Final Success Result Message */}
            {finalResult && (
                <div className="bg-white rounded-3xl qatar-card-shadow border-4 border-emerald-500 overflow-hidden animate-in zoom-in duration-500 max-w-2xl mx-auto text-center">
                    <div className="bg-emerald-500 py-8 flex flex-col items-center justify-center gap-3">
                        <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center text-emerald-500 shadow-xl mb-2">
                            <CheckCircle2 className="w-12 h-12" />
                        </div>
                        <h3 className="text-3xl font-black text-white px-8 leading-tight">تم الحفظ بنجاح للبيانات الحقيقية</h3>
                        <p className="text-white/80 font-bold italic tracking-wider">سجل الحصة {periodNumber} أصبح متاحاً في التقارير الآن</p>
                    </div>
                    <div className="p-10 grid grid-cols-2 gap-8 bg-emerald-50 italic">
                        <div className="flex flex-col items-center">
                            <span className="text-xs font-black text-emerald-700/60 uppercase tracking-widest mb-1">إجمالي الحضور</span>
                            <span className="text-5xl font-black text-emerald-700">{finalResult.presentCount}</span>
                        </div>
                        <div className="flex flex-col items-center border-r border-emerald-200">
                            <span className="text-xs font-black text-rose-700/60 uppercase tracking-widest mb-1">إجمالي الغياب</span>
                            <span className="text-5xl font-black text-rose-700">{finalResult.absentCount}</span>
                        </div>
                    </div>
                    <div className="p-6">
                        <button onClick={() => setFinalResult(null)} className="text-slate-400 font-black hover:text-qatar-maroon transition-colors underline decoration-2 underline-offset-4 decoration-slate-200">إغلاق وتدوين حصة أخرى</button>
                    </div>
                </div>
            )}

            {/* Overall Grid View */}
            <div className="pt-10 border-t border-qatar-gray-border">
                <div className="mb-6 flex items-center justify-between">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <div className="w-2 h-2 bg-qatar-maroon rounded-full"></div>
                            <h2 className="text-2xl font-black text-slate-800 italic uppercase tracking-tight">متابعة غياب الحصص</h2>
                        </div>
                        <p className="text-qatar-gray-text font-medium mr-4">استعراض سريع لحالة جميع فصول المدرسة لهذا اليوم</p>
                    </div>
                    <button onClick={() => window.location.reload()} className="group bg-white border border-qatar-gray-border text-slate-500 p-3 rounded-xl shadow-sm hover:border-qatar-maroon hover:text-qatar-maroon transition-all active:scale-95">
                        <RotateCcw className="w-5 h-5 group-hover:rotate-180 transition-transform duration-500" />
                    </button>
                </div>
                <PeriodGridSection date={activeDate} focusClassId={selectedClass || null} />
            </div>
        </div>
    );
}

function FormGroup({ label, children, icon }: { label: string; children: React.ReactNode; icon?: React.ReactNode }) {
    return (
        <div className="space-y-2">
            <label className="block text-sm font-black text-slate-700 mr-1 flex items-center gap-2">
                {icon && <span className="opacity-40">{icon}</span>}
                {label}
            </label>
            <div className="relative group">
                {children}
            </div>
        </div>
    );
}

/* ─── Ambiguous Names Panel ─── */
interface PendingEntry {
    uploadedName: string;
    candidateStudents: { studentId: string; fullName: string }[];
}

function AmbiguousNamesPanel({
    pendingNames,
    onConfirm,
    onResolve,
}: {
    pendingNames: PendingEntry[];
    onConfirm: (studentId: string) => void;
    onResolve: (uploadedName: string) => void;
}) {
    // Track the selected candidate per uploaded name
    const [selections, setSelections] = React.useState<Record<string, string>>({});

    const handleConfirm = (uploadedName: string) => {
        const studentId = selections[uploadedName];
        if (!studentId) return;
        onConfirm(studentId);
        onResolve(uploadedName);
    };

    return (
        <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl overflow-hidden">
            <div className="bg-amber-600 px-6 py-3 flex items-center gap-3 text-white">
                <AlertCircle className="w-5 h-5" />
                <span className="font-black text-lg">
                    أسماء غير متطابقة – تحتاج مراجعة المعلم ({pendingNames.length})
                </span>
            </div>
            <div className="p-6 space-y-4">
                {pendingNames.map((entry) => (
                    <div key={entry.uploadedName}
                        className="bg-white rounded-2xl border border-amber-100 shadow-sm p-5 space-y-4">

                        {/* Uploaded name */}
                        <div>
                            <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-1">
                                الاسم المكتشف في الملف:
                            </p>
                            <p className="text-xl font-black text-slate-800 italic">
                                {entry.uploadedName}
                            </p>
                        </div>

                        {entry.candidateStudents.length > 0 ? (
                            <div className="space-y-3">
                                <p className="text-xs font-black text-slate-500">
                                    اختر الطالب المقصود (إن وجد):
                                </p>
                                <div className="relative">
                                    <select
                                        value={selections[entry.uploadedName] ?? ""}
                                        onChange={e => setSelections(prev => ({
                                            ...prev,
                                            [entry.uploadedName]: e.target.value
                                        }))}
                                        className="w-full rounded-xl border-2 border-amber-200 bg-amber-50 px-4 py-3 font-bold text-sm text-slate-700 outline-none appearance-none focus:border-amber-400 cursor-pointer"
                                    >
                                        <option value="">-- اختر من القائمة --</option>
                                        {entry.candidateStudents.map(c => (
                                            <option key={c.studentId} value={c.studentId}>
                                                {c.fullName}
                                            </option>
                                        ))}
                                    </select>
                                    <ChevronDown className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-500 pointer-events-none" />
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => handleConfirm(entry.uploadedName)}
                                        disabled={!selections[entry.uploadedName]}
                                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-30 disabled:cursor-not-allowed text-white px-5 py-2.5 rounded-xl text-sm font-black shadow-sm transition-all active:scale-95 flex items-center justify-center gap-2"
                                    >
                                        <UserCheck className="w-4 h-4" />
                                        تأكيد – وضع كحاضر
                                    </button>
                                    <button
                                        onClick={() => onResolve(entry.uploadedName)}
                                        className="bg-slate-100 hover:bg-slate-200 text-slate-600 px-5 py-2.5 rounded-xl text-sm font-black border border-slate-200 transition-colors active:scale-95 flex items-center gap-2"
                                    >
                                        <UserX className="w-4 h-4" />
                                        تجاهل
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-center gap-3">
                                <p className="text-xs text-slate-400 font-bold flex-1 italic">
                                    لا يوجد طالب مطابق في هذا الصف.
                                </p>
                                <button
                                    onClick={() => onResolve(entry.uploadedName)}
                                    className="bg-slate-100 hover:bg-slate-200 text-slate-600 px-5 py-2.5 rounded-xl text-sm font-black border border-slate-200 transition-colors active:scale-95 flex items-center gap-2"
                                >
                                    <UserX className="w-4 h-4" />
                                    تجاهل
                                </button>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
