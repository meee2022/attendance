import React, { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import * as xlsx from "xlsx";
import { format } from "date-fns";
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, Layers, Search, Save, RotateCcw, UserCheck, UserX } from "lucide-react";
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
                date,
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

    const resolveFuzzyMatch = (uploadedName: string, studentId: string) => {
        if (!draftResult) return;
        // Mark the selected student as present
        const newStudents = draftResult.students.map((s: any) =>
            s.studentId === studentId ? { ...s, present: true } : s
        );
        // Remove this fuzzy match from the list
        const newFuzzy = draftResult.fuzzyMatches.filter((f: any) => f.uploadedName !== uploadedName);
        setDraftResult({ ...draftResult, students: newStudents, fuzzyMatches: newFuzzy });
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
                date,
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
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-black text-slate-800 flex items-center gap-3">
                    <Upload className="w-8 h-8 text-qatar-maroon" />
                    رصد حضور الحصص
                </h1>
                <p className="text-qatar-gray-text font-medium italic">ارفع ملف حضور Teams أو Excel وسنقوم بمطابقته تلقائياً مع قائمة الصف</p>
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

                    <div className="p-8 space-y-8">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            <FormGroup label="الصف الدراسي" icon={<Layers className="w-4 h-4" />}>
                                <select className="w-full bg-qatar-gray-bg border-qatar-gray-border rounded-xl px-4 py-3 font-black text-slate-700 outline-none appearance-none" value={selectedClass} onChange={e => setSelectedClass(e.target.value)}>
                                    <option value="">-- اختر الصف --</option>
                                    {data.classes.map((c: any) => (
                                        <option key={c._id} value={c._id}>{c.name}</option>
                                    ))}
                                </select>
                            </FormGroup>
                            <FormGroup label="المادة" icon={<Layers className="w-4 h-4" />}>
                                <select className="w-full bg-qatar-gray-bg border-qatar-gray-border rounded-xl px-4 py-3 font-black text-slate-700 outline-none appearance-none" value={selectedSubject} onChange={e => setSelectedSubject(e.target.value)}>
                                    <option value="">-- اختر المادة --</option>
                                    {data.subjects.map((s: any) => (
                                        <option key={s._id} value={s._id}>{s.name}</option>
                                    ))}
                                </select>
                            </FormGroup>
                            <FormGroup label="تاريخ الحصة" icon={<Layers className="w-4 h-4" />}>
                                <input type="date" className="w-full bg-qatar-gray-bg border-qatar-gray-border rounded-xl px-4 py-3 font-black text-slate-700 outline-none" value={date} onChange={e => setDate(e.target.value)} />
                            </FormGroup>
                            <FormGroup label="رقم الحصة" icon={<Layers className="w-4 h-4" />}>
                                <select className="w-full bg-qatar-gray-bg border-qatar-gray-border rounded-xl px-4 py-3 font-black text-slate-700 outline-none appearance-none" value={periodNumber} onChange={e => setPeriodNumber(e.target.value)}>
                                    {[1, 2, 3, 4, 5, 6, 7, 8].map(num => (
                                        <option key={num} value={num}>الحصة {num}</option>
                                    ))}
                                </select>
                            </FormGroup>
                        </div>

                        <div className="space-y-4">
                            <div className={`group relative mt-1 flex justify-center px-10 py-12 border-2 border-dashed rounded-2xl transition-all duration-300 ${file ? 'border-qatar-maroon bg-qatar-maroon/5' : 'border-qatar-gray-border hover:bg-slate-50'}`}>
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
                            {/* Fuzzy Matches Notification / Resolver */}
                            {draftResult.fuzzyMatches.length > 0 && (
                                <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl overflow-hidden animate-pulse-subtle">
                                    <div className="bg-amber-600 px-6 py-3 flex items-center gap-3 text-white">
                                        <AlertCircle className="w-5 h-5" />
                                        <span className="font-black text-lg">مطابقات غير دقيقة تحتاج تدخل بشري ({draftResult.fuzzyMatches.length})</span>
                                    </div>
                                    <div className="p-6 space-y-4">
                                        {draftResult.fuzzyMatches.map((fm: any, i: number) => (
                                            <div key={i} className="flex flex-col lg:flex-row lg:items-center justify-between p-5 bg-white rounded-xl border border-amber-100 gap-5 shadow-sm transition-all hover:bg-amber-50/30">
                                                <div>
                                                    <p className="text-xs font-black text-amber-600 mb-1 uppercase tracking-widest">المكتشف في الملف:</p>
                                                    <p className="text-xl font-black text-slate-800 italic underline decoration-qatar-maroon decoration-2 underline-offset-4">{fm.uploadedName}</p>
                                                </div>
                                                <div className="flex flex-wrap gap-2">
                                                    {fm.suggestedStudents.map((s: any) => (
                                                        <button
                                                            key={s.studentId}
                                                            onClick={() => resolveFuzzyMatch(fm.uploadedName, s.studentId)}
                                                            className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-3 rounded-xl text-sm font-black shadow-md transition-all active:scale-95"
                                                        >
                                                            مطابقة مع: {s.fullName}
                                                        </button>
                                                    ))}
                                                    <button onClick={() => resolveFuzzyMatch(fm.uploadedName, "")} className="bg-slate-100 hover:bg-slate-200 text-slate-600 px-5 py-3 rounded-xl text-sm font-black border border-slate-200 transition-colors">
                                                        تجاهل هذا الاسم
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Unknown Names List */}
                            {draftResult.unknownNames.length > 0 && (
                                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6">
                                    <div className="flex items-center gap-3 text-slate-500 font-black mb-4 uppercase tracking-widest text-xs">
                                        <UserX className="w-4 h-4" />
                                        <span>أسماء مجهولة في الملف (لم يتم التعرف عليها):</span>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {draftResult.unknownNames.map((n: string, i: number) => (
                                            <span key={i} className="bg-white border border-slate-200 px-3 py-1.5 rounded-lg text-xs font-black text-slate-400 opacity-70 line-through decoration-rose-400 italic shadow-sm">{n}</span>
                                        ))}
                                    </div>
                                </div>
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
                                <button
                                    onClick={handleFinalize}
                                    disabled={isFinalizing || draftResult.fuzzyMatches.length > 0}
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
                                {draftResult.fuzzyMatches.length > 0 && (
                                    <p className="text-rose-600 font-black italic animate-bounce flex items-center gap-2">
                                        <AlertCircle className="w-4 h-4" />
                                        يرجى حل جميع المطابقات غير الدقيقة أولاً
                                    </p>
                                )}
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
                <PeriodGridSection date={date} />
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
