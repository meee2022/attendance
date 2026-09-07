import React, { useState, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import * as xlsx from "xlsx";
import {
    UserPlus, FileSpreadsheet, CheckCircle2, AlertCircle,
    Users, GraduationCap, Layers, Phone, BookOpen, BarChart3, Trash2, Hash
} from "lucide-react";
// @ts-ignore
import { api } from "../../convex/_generated/api";
import { UNASSIGNED_LABEL, resolveClass } from "../../convex/classHelpers";
import StatCard from "../components/StatCard";

type ParsedRow = {
    fullName: string;
    className: string;   // raw section cell, e.g. "10/1" or "-"
    phones: string;
    nationalId: string;
    sourceGrade: string; // raw "الصف" cell, e.g. "12-Science"
};

// Column aliases, so a sheet exported with slightly different headers still works.
const COLUMNS = {
    nationalId: ["الرقم", "الرقم الشخصي", "رقم الطالب", "ID"],
    fullName:   ["الاسم", "اسم الطالب", "Name"],
    grade:      ["الصف", "المرحلة", "Grade"],
    section:    ["الشعبة الصفية", "الشعبة", "Class", "Section"],
    phones:     ["رقم الهاتف", "رقم التليفون", "الهاتف", "Phone"],
};

const GRADE_LABELS: Record<number, string> = { 10: "العاشر", 11: "الحادي عشر", 12: "الثاني عشر" };
const TRACK_COLORS: Record<string, string> = {
    "علمي":     "bg-blue-100 text-blue-800 border-blue-200",
    "أدبي":     "bg-amber-100 text-amber-800 border-amber-200",
    "تكنولوجي": "bg-purple-100 text-purple-800 border-purple-200",
    "عام":      "bg-slate-100 text-slate-600 border-slate-200",
};

export default function ImportStudents() {
    const data = useQuery(api.setup.getInitialData);
    // @ts-ignore
    const counts = useQuery(api.setup.getStudentCounts);
    const importStudents = useMutation(api.students.importStudentsFromSheet);
    // @ts-ignore
    const deleteAll = useMutation(api.students.deleteAllStudentsAndAttendance);

    const [file, setFile]               = useState<File | null>(null);
    const [parsedRows, setParsedRows]   = useState<ParsedRow[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress]       = useState("");
    const [replaceExisting, setReplaceExisting] = useState(false);
    const [result, setResult]           = useState<any>(null);
    const [importedRows, setImportedRows] = useState<ParsedRow[]>([]);
    const [sheetNames, setSheetNames]   = useState<string[]>([]);
    const [error, setError]             = useState("");

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const uploadedFile = e.target.files?.[0];
        if (!uploadedFile) return;
        setFile(uploadedFile);
        setError("");
        setParsedRows([]);
        setSheetNames([]);
        setResult(null);

        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const wb = xlsx.read(evt.target?.result, { type: "binary" });
                const newRows: ParsedRow[] = [];

                // سجل القيد splits the school across one sheet per grade — read them all.
                for (const sheetName of wb.SheetNames) {
                    const grid = xlsx.utils.sheet_to_json<any[]>(wb.Sheets[sheetName], {
                        header: 1, raw: false, defval: "",
                    });

                    // The real header sits below a couple of title rows.
                    const headerIndex = grid.findIndex(r =>
                        r.some(cell => COLUMNS.fullName.includes(String(cell ?? "").trim())));
                    if (headerIndex === -1) continue;

                    const header = grid[headerIndex].map(c => String(c ?? "").trim());
                    const columnOf = (aliases: string[]) =>
                        header.findIndex(h => aliases.includes(h));

                    const idx = {
                        nationalId: columnOf(COLUMNS.nationalId),
                        fullName:   columnOf(COLUMNS.fullName),
                        grade:      columnOf(COLUMNS.grade),
                        section:    columnOf(COLUMNS.section),
                        phones:     columnOf(COLUMNS.phones),
                    };
                    if (idx.fullName === -1) continue;

                    const cell = (row: any[], i: number) =>
                        i === -1 ? "" : String(row[i] ?? "").trim();

                    for (const row of grid.slice(headerIndex + 1)) {
                        const fullName = cell(row, idx.fullName);
                        if (!fullName) continue;
                        newRows.push({
                            fullName,
                            nationalId: cell(row, idx.nationalId),
                            sourceGrade: cell(row, idx.grade),
                            className: cell(row, idx.section),
                            phones: cell(row, idx.phones),
                        });
                    }
                }

                if (newRows.length === 0) {
                    setError("لم يتم العثور على بيانات. تأكد من الأعمدة: الرقم، الاسم، الصف، الشعبة الصفية، رقم الهاتف");
                }
                setSheetNames(wb.SheetNames);
                setParsedRows(newRows);
            } catch {
                setError("فشل في قراءة الملف. تأكد من صيغة Excel.");
                setParsedRows([]);
            }
        };
        reader.readAsBinaryString(uploadedFile);
    };

    const handleSubmit = async () => {
        if (!data) return;
        const schoolId = data.schools[0]?._id;
        if (!schoolId || parsedRows.length === 0) { setError("لا يوجد بيانات للاستيراد."); return; }

        if (replaceExisting && !window.confirm(
            `سيتم حذف جميع الطلاب الحاليين (${counts?.total ?? "?"}) وسجلات الحضور والدرجات المرتبطة بهم نهائياً، ثم استيراد ${parsedRows.length} طالب. هل أنت متأكد؟`
        )) return;

        setIsProcessing(true);
        setError("");
        try {
            if (replaceExisting) {
                // The reset runs in batches; keep calling until it reports done.
                let removed = 0;
                for (let guard = 0; guard < 500; guard++) {
                    const res: any = await deleteAll({ schoolId, includeGrades: true });
                    removed += res.students;
                    setProgress(`جاري حذف البيانات القديمة… (${removed} طالب)`);
                    if (res.done) break;
                }
            }

            setProgress("جاري استيراد الطلاب…");
            const res = await importStudents({
                schoolId,
                rows: parsedRows,
                deactivateMissingClasses: true,
            });
            setResult(res);
            setImportedRows(parsedRows);
            setParsedRows([]);
            setFile(null);
        } catch (err: any) {
            setError("خطأ أثناء الاستيراد: " + err.message);
        } finally {
            setIsProcessing(false);
            setProgress("");
        }
    };

    const activeClasses = (data?.classes ?? []).filter((c: any) => c.isActive !== false);

    // Same resolution the mutation applies, so the preview matches what is saved.
    const classNameFor = (r: ParsedRow) =>
        resolveClass(r.sourceGrade, r.className)?.className ?? "—";

    // Build class breakdown (keyed by className)
    const classMap = useMemo(() => {
        if (!data?.classes) return {};
        const m: Record<string, any> = {};
        for (const c of data.classes) m[c.name] = c;
        return m;
    }, [data]);

    const breakdownOf = (rows: ParsedRow[]) => {
        const counts: Record<string, number> = {};
        rows.forEach(r => {
            const cn = classNameFor(r);
            counts[cn] = (counts[cn] || 0) + 1;
        });
        return Object.entries(counts)
            .sort((a, b) => a[0].localeCompare(b[0], "ar", { numeric: true }));
    };

    // Per-class counts from parsedRows (preview)
    const previewBreakdown = useMemo(() => breakdownOf(parsedRows), [parsedRows]);

    // Per-class counts from importedRows (result)
    const resultBreakdown = useMemo(() => breakdownOf(importedRows), [importedRows]);

    const unassignedPreview = useMemo(
        () => parsedRows.filter(r => classNameFor(r).includes(UNASSIGNED_LABEL)).length,
        [parsedRows]);

    // Per-grade & per-track summary
    const gradeTrackSummary = useMemo(() => {
        const grades: Record<number, { total: number; tracks: Record<string, number> }> = {};
        for (const r of importedRows) {
            const target = resolveClass(r.sourceGrade, r.className);
            if (!target) continue;
            const bucket = grades[target.grade] ??= { total: 0, tracks: {} };
            bucket.total += 1;
            bucket.tracks[target.track] = (bucket.tracks[target.track] || 0) + 1;
        }
        return grades;
    }, [importedRows]);

    if (!data) return (
        <div className="flex items-center justify-center min-h-[400px]">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-qatar-maroon" />
        </div>
    );

    return (
        <div className="max-w-5xl mx-auto space-y-8 font-sans animate-in fade-in duration-500 pb-20">

            {/* ── Page Header ── */}
            <div className="workspace-page-header rounded-2xl overflow-hidden qatar-card-shadow"
                 >
                <div className="p-6 sm:p-8">
                    <h1 className="text-3xl font-black text-white">
                        استيراد بيانات الطلاب
                    </h1>
                    <p className="text-white/70 font-medium text-sm mt-1">رفع قائمة الطلاب من ملف إكسل وإضافتهم للنظام</p>
                </div>
            </div>

            {/* ── Quick Stats ── */}
            <div className="grid grid-cols-2 gap-4">
                <StatCard
                    label="إجمالي الطلاب في النظام"
                    value={counts?.total ?? "..."}
                    icon={<Users className="w-5 h-5" />}
                    color="maroon"
                />
                <StatCard
                    label="الصفوف المُعدَّة"
                    value={activeClasses.length}
                    icon={<Layers className="w-5 h-5" />}
                    color="blue"
                />
            </div>

            {/* ── Upload Card ── */}
            <div className="bg-white rounded-2xl qatar-card-shadow border border-qatar-gray-border overflow-hidden">
                <div className="bg-qatar-maroon px-8 py-5 flex items-center justify-between">
                    <h2 className="text-xl font-black text-white flex items-center gap-3">
                        <FileSpreadsheet className="w-6 h-6 text-white/70" />
                        رفع ملف بيانات الطلاب
                    </h2>
                    <span className="bg-white/10 text-white/80 text-xs font-bold px-3 py-1 rounded-full border border-white/20">
                        Excel / CSV
                    </span>
                </div>

                <div className="p-8 space-y-6">
                    {/* Instructions */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        {[
                            { icon: <Hash className="w-4 h-4" />, label: "الرقم", desc: "الرقم الشخصي — اختياري", color: "bg-slate-50 border-slate-200 text-slate-600" },
                            { icon: <BookOpen className="w-4 h-4" />, label: "الاسم", desc: "اسم الطالب الكامل", color: "bg-blue-50 border-blue-200 text-blue-700" },
                            { icon: <GraduationCap className="w-4 h-4" />, label: "الصف", desc: "مثال: 12-Science", color: "bg-purple-50 border-purple-200 text-purple-700" },
                            { icon: <Layers className="w-4 h-4" />, label: "الشعبة الصفية", desc: "مثال: 11/3 أو 11/ESE", color: "bg-amber-50 border-amber-200 text-amber-700" },
                            { icon: <Phone className="w-4 h-4" />, label: "رقم الهاتف", desc: "اختياري", color: "bg-emerald-50 border-emerald-200 text-emerald-700" },
                        ].map(col => (
                            <div key={col.label} className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${col.color}`}>
                                <div className="flex-shrink-0">{col.icon}</div>
                                <div>
                                    <p className="font-black text-sm">{col.label}</p>
                                    <p className="text-[11px] opacity-70 font-medium">{col.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Drop zone */}
                    <div className={`relative flex flex-col items-center justify-center gap-4 px-8 py-14 border-2 border-dashed rounded-2xl transition-all duration-300 ${
                        file ? 'border-qatar-maroon bg-gradient-to-br from-rose-50 to-white'
                             : 'border-slate-300 bg-gradient-to-br from-slate-50 to-white hover:border-qatar-maroon/50 hover:from-rose-50/20'
                    }`}>
                        <div className={`w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300 ${file ? 'bg-qatar-maroon text-white shadow-lg' : 'bg-slate-100 text-slate-300'}`}>
                            <FileSpreadsheet className="w-10 h-10" />
                        </div>
                        <label className="cursor-pointer text-center">
                            <span className="text-xl font-black text-qatar-maroon hover:underline">
                                {file ? file.name : 'اختر ملف إكسل أو اسحبه هنا'}
                            </span>
                            <input type="file" className="sr-only" accept=".xlsx,.xls,.csv" onChange={handleFileUpload} />
                        </label>
                        {!file && <p className="text-slate-400 text-sm font-medium">يدعم xlsx, xls, csv — تُقرأ جميع أوراق الملف</p>}
                        {file && parsedRows.length > 0 && (
                            <div className="flex flex-wrap items-center justify-center gap-2">
                                <div className="flex items-center gap-2 bg-white border border-emerald-200 text-emerald-700 px-5 py-2 rounded-full shadow-sm">
                                    <CheckCircle2 className="w-4 h-4" />
                                    <span className="font-black text-sm">{parsedRows.length} طالب جاهز للاستيراد</span>
                                </div>
                                {sheetNames.length > 1 && (
                                    <div className="flex items-center gap-2 bg-white border border-slate-200 text-slate-600 px-5 py-2 rounded-full shadow-sm">
                                        <FileSpreadsheet className="w-4 h-4" />
                                        <span className="font-black text-sm">{sheetNames.length} أوراق: {sheetNames.join("، ")}</span>
                                    </div>
                                )}
                                {unassignedPreview > 0 && (
                                    <div className="flex items-center gap-2 bg-white border border-amber-200 text-amber-700 px-5 py-2 rounded-full shadow-sm">
                                        <AlertCircle className="w-4 h-4" />
                                        <span className="font-black text-sm">{unassignedPreview} بدون شعبة → صفوف «{UNASSIGNED_LABEL}»</span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Replace-existing toggle */}
                    <label className={`flex items-start gap-3 px-5 py-4 rounded-xl border-2 cursor-pointer transition-colors ${
                        replaceExisting ? 'bg-red-50 border-red-300' : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                    }`}>
                        <input
                            type="checkbox"
                            className="mt-1 w-5 h-5 accent-red-600"
                            checked={replaceExisting}
                            onChange={e => setReplaceExisting(e.target.checked)}
                        />
                        <span>
                            <span className={`flex items-center gap-2 font-black text-sm ${replaceExisting ? 'text-red-800' : 'text-slate-700'}`}>
                                <Trash2 className="w-4 h-4" />
                                استبدال البيانات الحالية (بداية سنة دراسية جديدة)
                            </span>
                            <span className="block text-[11px] font-medium mt-1 text-slate-500 leading-relaxed">
                                يحذف جميع الطلاب الحاليين وسجلات الحضور والدرجات والغياب العملي المرتبطة بهم، ثم يستورد الكشف الجديد.
                                بدون تفعيله يُضاف الطلاب الجدد فوق الموجودين.
                            </span>
                        </span>
                    </label>

                    {error && (
                        <div className="flex items-center gap-3 bg-rose-50 text-rose-800 px-5 py-4 rounded-xl border border-rose-200">
                            <AlertCircle className="w-5 h-5 flex-shrink-0" />
                            <p className="text-sm font-black">{error}</p>
                        </div>
                    )}

                    {/* Preview breakdown bubbles */}
                    {parsedRows.length > 0 && (
                        <div className="space-y-4 animate-in fade-in duration-500">
                            <div className="flex items-center justify-between border-b border-qatar-gray-border pb-3">
                                <h3 className="font-black text-slate-700 flex items-center gap-2">
                                    <BarChart3 className="w-4 h-4 text-qatar-maroon" />
                                    توزيع الطلاب حسب الصف
                                </h3>
                                <span className="text-xs font-black text-slate-400 bg-slate-100 px-3 py-1 rounded-full">
                                    {parsedRows.length} طالب إجمالاً
                                </span>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {previewBreakdown.map(([cn, count]) => {
                                    const cls = classMap[cn];
                                    return (
                                        <div key={cn} className="flex items-center gap-2 bg-white border border-qatar-gray-border px-3 py-2 rounded-xl shadow-sm hover:border-qatar-maroon transition-colors">
                                            <span className="font-black text-slate-800 text-sm">{cn}</span>
                                            {cls?.track && (
                                                <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full border ${TRACK_COLORS[cls.track] || TRACK_COLORS["عام"]}`}>{cls.track}</span>
                                            )}
                                            <span className="bg-qatar-maroon/10 text-qatar-maroon text-xs font-black px-2 py-0.5 rounded-full">{count}</span>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Preview table (first 8 rows) */}
                            <div className="overflow-hidden border border-qatar-gray-border rounded-xl">
                                <table className="min-w-full text-right border-collapse text-sm">
                                    <thead>
                                        <tr className="bg-qatar-maroon text-white">
                                            <th className="px-5 py-3 font-black text-xs w-12 text-center">#</th>
                                            <th className="px-5 py-3 font-black text-xs">الرقم</th>
                                            <th className="px-5 py-3 font-black text-xs">اسم الطالب</th>
                                            <th className="px-5 py-3 font-black text-xs">الشعبة</th>
                                            <th className="px-5 py-3 font-black text-xs">الهاتف</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-qatar-gray-border">
                                        {parsedRows.slice(0, 8).map((r, i) => (
                                            <tr key={i} className={`transition-colors hover:bg-rose-50/30 ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>
                                                <td className="px-5 py-2.5 text-slate-400 text-center font-bold text-xs">{i + 1}</td>
                                                <td className="px-5 py-2.5 text-slate-400 text-xs font-mono" dir="ltr">{r.nationalId || "─"}</td>
                                                <td className="px-5 py-2.5 font-black text-slate-800">{r.fullName}</td>
                                                <td className="px-5 py-2.5">
                                                    <span className="bg-rose-50 text-qatar-maroon border border-rose-200 px-2 py-0.5 rounded-lg text-xs font-black">{classNameFor(r)}</span>
                                                </td>
                                                <td className="px-5 py-2.5 text-slate-400 text-xs font-mono" dir="ltr">{r.phones || "─"}</td>
                                            </tr>
                                        ))}
                                        {parsedRows.length > 8 && (
                                            <tr className="bg-slate-50">
                                                <td colSpan={5} className="px-5 py-3 text-center text-xs font-black text-slate-400 italic">
                                                    ... و {parsedRows.length - 8} طلاب آخرين
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Submit Button */}
                    <div className="flex flex-col items-center gap-3 pt-2">
                        <button
                            onClick={handleSubmit}
                            disabled={isProcessing || parsedRows.length === 0}
                            className={`flex items-center gap-3 px-14 py-4 text-white font-black text-lg rounded-2xl shadow-lg hover:opacity-90 transition-all active:scale-95 disabled:opacity-30 disabled:pointer-events-none ${
                                replaceExisting ? 'bg-red-600' : 'bg-qatar-maroon'
                            }`}
                        >
                            {isProcessing ? (
                                <><div className="animate-spin w-5 h-5 border-2 border-white/30 border-t-white rounded-full" />جاري الاستيراد...</>
                            ) : (
                                <>
                                    {replaceExisting ? <Trash2 className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />}
                                    {replaceExisting ? "استبدال الكشف بـ" : "تأكيد استيراد"} {parsedRows.length || ""} طالب
                                </>
                            )}
                        </button>
                        {progress && <p className="text-xs font-black text-slate-500">{progress}</p>}
                    </div>
                </div>
            </div>

            {/* ── Import Result Summary ── */}
            {result && importedRows.length > 0 && (
                <div className="bg-white rounded-2xl qatar-card-shadow border border-qatar-gray-border overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {/* Header */}
                    <div className="bg-gradient-to-l from-emerald-600 to-emerald-700 px-8 py-6 flex items-center gap-4">
                        <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center">
                            <CheckCircle2 className="w-8 h-8 text-white" />
                        </div>
                        <div>
                            <h3 className="text-2xl font-black text-white">تم الاستيراد بنجاح</h3>
                            <p className="text-white/70 text-sm font-bold">تفاصيل ما تم إضافته للنظام</p>
                        </div>
                        <div className="mr-auto text-right flex items-center gap-6">
                            <div>
                                <div className="text-5xl font-black text-white">{result.importedCount}</div>
                                <div className="text-white/70 text-xs font-black uppercase tracking-widest">طالب مُضاف</div>
                            </div>
                            {result.updatedCount > 0 && (
                                <div>
                                    <div className="text-5xl font-black text-white/80">{result.updatedCount}</div>
                                    <div className="text-white/70 text-xs font-black uppercase tracking-widest">طالب مُحدَّث</div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="p-8 space-y-8">
                        {/* What changed in the class structure */}
                        {(result.createdClasses?.length > 0 || result.updatedClasses?.length > 0
                          || result.deactivatedClasses?.length > 0 || result.unassignedCount > 0) && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {[
                                    { show: result.createdClasses?.length,  title: "صفوف جديدة أُنشئت", items: result.createdClasses,  color: "bg-emerald-50 border-emerald-200 text-emerald-800" },
                                    { show: result.updatedClasses?.length,  title: "صفوف حُدِّث مسارها", items: result.updatedClasses,  color: "bg-blue-50 border-blue-200 text-blue-800" },
                                    { show: result.deactivatedClasses?.length, title: "صفوف أُلغي تفعيلها (لم تعد بالكشف)", items: result.deactivatedClasses, color: "bg-amber-50 border-amber-200 text-amber-800" },
                                ].filter(b => b.show).map(b => (
                                    <div key={b.title} className={`rounded-xl border p-4 ${b.color}`}>
                                        <p className="font-black text-xs mb-2">{b.title} ({b.items.length})</p>
                                        <p className="text-[11px] font-bold leading-relaxed">{b.items.join("، ")}</p>
                                    </div>
                                ))}
                                {result.unassignedCount > 0 && (
                                    <div className="rounded-xl border p-4 bg-slate-50 border-slate-200 text-slate-700">
                                        <p className="font-black text-xs mb-2">طلاب بدون شعبة ({result.unassignedCount})</p>
                                        <p className="text-[11px] font-bold leading-relaxed">
                                            وُضعوا في صفوف «{UNASSIGNED_LABEL}» حسب المسار — يمكن نقلهم لشعبهم من صفحة الطلاب.
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Per-grade cards */}
                        <div>
                            <h4 className="font-black text-slate-700 mb-4 flex items-center gap-2">
                                <GraduationCap className="w-5 h-5 text-qatar-maroon" />
                                ملخص حسب المرحلة الدراسية
                            </h4>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                {[10, 11, 12].map(g => {
                                    const info = gradeTrackSummary[g];
                                    if (!info) return null;
                                    return (
                                        <div key={g} className="bg-slate-50 border border-qatar-gray-border rounded-2xl p-5 space-y-3 relative overflow-hidden">
                                            <div className="absolute top-0 right-0 left-0 h-1 bg-qatar-maroon" />
                                            <div className="flex justify-between items-center">
                                                <span className="font-black text-slate-800">الصف ال{GRADE_LABELS[g]}</span>
                                                <span className="text-2xl font-black text-qatar-maroon">{info.total}</span>
                                            </div>
                                            <div className="flex flex-wrap gap-1.5">
                                                {Object.entries(info.tracks).map(([track, cnt]) => (
                                                    <span key={track} className={`text-[11px] font-black px-2 py-0.5 rounded-full border ${TRACK_COLORS[track] || TRACK_COLORS["عام"]}`}>
                                                        {track}: {cnt}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Per-class breakdown grid */}
                        <div>
                            <h4 className="font-black text-slate-700 mb-4 flex items-center gap-2">
                                <Layers className="w-5 h-5 text-qatar-maroon" />
                                تفصيل حسب الصف الدراسي
                            </h4>
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                                {resultBreakdown.map(([cn, count]) => {
                                    const cls = classMap[cn];
                                    const pct = Math.round((count / importedRows.length) * 100);
                                    return (
                                        <div key={cn} className="bg-white border-2 border-qatar-gray-border rounded-xl p-4 space-y-2 hover:border-qatar-maroon transition-colors">
                                            <div className="flex items-center justify-between">
                                                <span className="font-black text-slate-800">{cn}</span>
                                                <span className="text-xl font-black text-qatar-maroon">{count}</span>
                                            </div>
                                            {cls?.track && (
                                                <span className={`inline-block text-[11px] font-black px-2 py-0.5 rounded-full border ${TRACK_COLORS[cls.track] || TRACK_COLORS["عام"]}`}>
                                                    {cls.track}
                                                </span>
                                            )}
                                            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                <div className="h-full bg-qatar-maroon rounded-full" style={{ width: `${pct}%` }} />
                                            </div>
                                            <p className="text-[10px] text-slate-400 font-bold">{pct}% من المستورَدين</p>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
