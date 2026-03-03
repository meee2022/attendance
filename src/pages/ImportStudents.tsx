import React, { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import * as xlsx from "xlsx";
import { UserPlus, FileSpreadsheet, CheckCircle2, AlertCircle } from "lucide-react";
// @ts-ignore
import { api } from "../../convex/_generated/api";

type ParsedRow = {
    fullName: string;
    className: string;
    phones: string;
};

export default function ImportStudents() {
    const data = useQuery(api.setup.getInitialData);
    const importStudents = useMutation(api.students.importStudentsFromSheet);

    const [file, setFile] = useState<File | null>(null);
    const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);

    const [isProcessing, setIsProcessing] = useState(false);
    const [result, setResult] = useState<any>(null);
    const [error, setError] = useState("");

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const uploadedFile = e.target.files?.[0];
        if (!uploadedFile) return;
        setFile(uploadedFile);
        setError("");
        setParsedRows([]);
        setResult(null);

        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const bstr = evt.target?.result;
                const wb = xlsx.read(bstr, { type: "binary" });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];

                // Parse as Json with headers
                const rows = xlsx.utils.sheet_to_json<any>(ws);

                const newRows: ParsedRow[] = [];
                for (const row of rows) {
                    // Real Excel columns: الاسم, الشعبة الصفية, رقم الهاتف
                    const fullName =
                        row["الاسم"] ||
                        row["اسم الطالب"] ||
                        row["Name"] || "";

                    const rawClass =
                        row["الشعبة الصفية"] ||
                        row["الشعبة"] ||
                        row["الصف"] ||
                        row["Class"] || "";

                    // Normalize: "10/1" → "10-1"
                    const className = rawClass
                        .toString()
                        .trim()
                        .replace(/\//g, "-");

                    const phones =
                        row["رقم الهاتف"] ||
                        row["رقم التليفون"] ||
                        row["الهاتف"] ||
                        row["Phone"] || "";

                    if (fullName && className) {
                        newRows.push({
                            fullName: fullName.toString().trim(),
                            className,
                            phones: phones.toString().trim()
                        });
                    }
                }

                if (newRows.length === 0) {
                    setError("لم يتم العثور على بيانات. يرجى التأكد من وجود أعمدة: 'الاسم', 'الشعبة الصفية', 'رقم الهاتف'.");
                }

                setParsedRows(newRows);
            } catch (err) {
                setError("فشل في قراءة ملف الإكسل. يرجى التأكد من الصيغة.");
                setParsedRows([]);
            }
        };
        reader.readAsBinaryString(uploadedFile);
    };

    const handleSubmit = async () => {
        if (!data) return;
        const schoolId = data.schools[0]?._id;
        if (!schoolId) {
            setError("لا يوجد مدرسة مسجلة نظامياً.");
            return;
        }

        if (parsedRows.length === 0) {
            setError("لا يوجد بيانات للاستيراد.");
            return;
        }

        setIsProcessing(true);
        setError("");
        setResult(null);

        try {
            const res = await importStudents({
                schoolId,
                rows: parsedRows
            });
            setResult(res);
        } catch (err: any) {
            setError("حدث خطأ أثناء استيراد البيانات: " + err.message);
        } finally {
            setIsProcessing(false);
        }
    };

    if (!data) return (
        <div className="flex flex-col items-center justify-center min-h-[400px]">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-qatar-maroon"></div>
        </div>
    );

    return (
        <div className="max-w-5xl mx-auto space-y-10 font-sans transition-all animate-in fade-in duration-500 pb-20">
            {/* Header */}
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-black text-slate-800 flex items-center gap-3">
                    <UserPlus className="w-8 h-8 text-qatar-maroon" />
                    تحميل بيانات الطلاب
                </h1>
                <p className="text-qatar-gray-text font-medium italic">قم استيراد قائمة الطلاب من ملف إكسل لتحديث بيانات المدرسة</p>
            </div>

            <div className="bg-white rounded-2xl qatar-card-shadow border border-qatar-gray-border overflow-hidden">
                <div className="bg-qatar-maroon px-8 py-5 flex items-center justify-between">
                    <h2 className="text-xl font-black text-white">إعدادات الاستيراد</h2>
                    <FileSpreadsheet className="w-6 h-6 text-white/50" />
                </div>

                <div className="p-8 space-y-8">
                    <div className="bg-indigo-50/50 border border-indigo-100 p-6 rounded-2xl flex gap-4">
                        <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                            <FileSpreadsheet className="w-6 h-6 text-indigo-600" />
                        </div>
                        <div>
                            <p className="font-black text-indigo-900 mb-2">تعليمات ملف البيانات:</p>
                            <p className="text-sm text-indigo-800 leading-relaxed opacity-80">
                                يرجى التأكد من أن ملف الإكسل يحتوي على العناوين التالية في الصف الأول:
                                <span className="font-black underline mx-2">الاسم</span>،
                                <span className="font-black underline mx-2">الشعبة الصفية</span>،
                                <span className="font-black underline mx-2">رقم الهاتف</span>
                            </p>
                        </div>
                    </div>

                    {/* Upload Section */}
                    <div className="space-y-4">
                        <div
                            className={`group relative mt-1 flex justify-center px-10 py-12 border-2 border-dashed rounded-2xl transition-all duration-300 ${file ? 'border-qatar-maroon bg-qatar-maroon/5' : 'border-qatar-gray-border hover:bg-slate-50'
                                }`}
                        >
                            <div className="space-y-4 text-center">
                                <div className={`mx-auto h-20 w-20 rounded-full flex items-center justify-center transition-colors duration-300 ${file ? 'bg-qatar-maroon text-white shadow-lg' : 'bg-slate-100 text-slate-300 group-hover:text-slate-400'}`}>
                                    <FileSpreadsheet className="h-10 w-10" />
                                </div>
                                <div className="flex flex-col gap-2">
                                    <label htmlFor="student-file-upload" className="relative cursor-pointer rounded-md font-black text-qatar-maroon hover:text-qatar-maroon-dark focus-within:outline-none transition-colors">
                                        <span className="text-xl italic">{file ? 'تغيير الملف المختار' : 'اختر ملف إكسل من جهازك'}</span>
                                        <input id="student-file-upload" type="file" className="sr-only" accept=".xlsx,.xls,.csv" onChange={handleFileUpload} />
                                    </label>
                                    <p className="text-sm text-qatar-gray-text font-medium italic">يدعم تنسيقات Excel و CSV المختلفة</p>
                                </div>
                            </div>
                        </div>

                        {file && (
                            <div className="bg-emerald-50 text-emerald-800 px-6 py-4 rounded-xl border border-emerald-100 flex items-center gap-3 animate-in slide-in-from-top-2">
                                <CheckCircle2 className="w-5 h-5" />
                                <span className="text-sm font-black">
                                    تم تحميل: <span className="underline italic ml-1">{file.name}</span>
                                    <span className="bg-emerald-200/50 px-3 py-1 rounded-md mr-4 text-xs">({parsedRows.length} طالب جاهز)</span>
                                </span>
                            </div>
                        )}

                        {error && (
                            <div className="bg-rose-50 text-rose-800 px-6 py-4 rounded-xl border border-rose-100 flex items-center gap-3 animate-shake">
                                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                                <span className="text-sm font-black">{error}</span>
                            </div>
                        )}
                    </div>

                    {/* Preview parsed rows */}
                    {parsedRows.length > 0 && (
                        <div className="mt-8 space-y-6 animate-in fade-in duration-700">
                            <div className="flex items-center justify-between border-b border-qatar-gray-border pb-4">
                                <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
                                    <div className="w-1.5 h-6 bg-qatar-maroon rounded-full"></div>
                                    معاينة البيانات المكتشفة
                                </h3>
                                <div className="text-xs text-qatar-gray-text font-black px-3 py-1 bg-qatar-gray-bg rounded-lg border border-qatar-gray-border uppercase tracking-widest">
                                    عرض أول 10 صفوف
                                </div>
                            </div>

                            {/* Class breakdown bubbles */}
                            <div className="flex flex-wrap gap-2 py-2">
                                {(() => {
                                    const counts: Record<string, number> = {};
                                    parsedRows.forEach(r => { counts[r.className] = (counts[r.className] || 0) + 1; });
                                    return Object.entries(counts).sort().map(([cls, n]) => (
                                        <div key={cls} className="bg-white border border-qatar-gray-border px-3 py-1.5 rounded-xl flex items-center gap-3 shadow-sm group hover:border-qatar-maroon transition-colors">
                                            <span className="text-sm font-black text-slate-700 group-hover:text-qatar-maroon">{cls}</span>
                                            <span className="bg-qatar-gray-bg px-2 py-0.5 rounded text-[10px] font-black text-slate-400 group-hover:bg-qatar-maroon/10 group-hover:text-qatar-maroon">{n}</span>
                                        </div>
                                    ));
                                })()}
                            </div>

                            {/* Preview table */}
                            <div className="overflow-hidden border border-qatar-gray-border rounded-2xl qatar-card-shadow">
                                <table className="min-w-full text-right border-collapse">
                                    <thead>
                                        <tr className="bg-slate-800 text-white">
                                            <th className="px-6 py-4 text-xs font-black uppercase tracking-widest border-l border-white/10 w-16 text-center">#</th>
                                            <th className="px-6 py-4 text-xs font-black uppercase tracking-widest border-l border-white/10">اسم الطالب</th>
                                            <th className="px-6 py-4 text-xs font-black uppercase tracking-widest border-l border-white/10">الشعبة</th>
                                            <th className="px-6 py-4 text-xs font-black uppercase tracking-widest">أرقام التواصل</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-qatar-gray-border">
                                        {parsedRows.slice(0, 10).map((r, i) => (
                                            <tr key={i} className="hover:bg-slate-50 transition-colors group">
                                                <td className="px-6 py-3 text-slate-400 font-bold text-center border-l border-qatar-gray-border italic">{i + 1}</td>
                                                <td className="px-6 py-3 font-black text-slate-800 border-l border-qatar-gray-border group-hover:text-qatar-maroon transition-colors">{r.fullName}</td>
                                                <td className="px-6 py-3 border-l border-qatar-gray-border">
                                                    <span className="bg-indigo-50 text-indigo-700 px-3 py-1 rounded-lg text-xs font-black border border-indigo-100">{r.className}</span>
                                                </td>
                                                <td className="px-6 py-3 text-slate-500 font-medium text-xs font-mono" dir="ltr">{r.phones || "─"}</td>
                                            </tr>
                                        ))}
                                        {parsedRows.length > 10 && (
                                            <tr className="bg-slate-50 border-t border-qatar-gray-border">
                                                <td colSpan={4} className="px-6 py-4 text-center font-black text-slate-400 italic text-sm">
                                                    ... و {parsedRows.length - 10} طلاب آخرين سيتم استيرادهم
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Action Button */}
                    <div className="flex justify-center pt-6">
                        <button
                            onClick={handleSubmit}
                            disabled={isProcessing || parsedRows.length === 0}
                            className="group relative overflow-hidden px-12 py-4 bg-qatar-maroon text-white font-black rounded-2xl shadow-lg hover:shadow-maroon-300/30 transition-all active:scale-95 disabled:opacity-30 disabled:pointer-events-none"
                        >
                            <span className="relative z-10 flex items-center gap-3 text-lg">
                                {isProcessing ? (
                                    <>
                                        <div className="animate-spin w-5 h-5 border-2 border-white/30 border-t-white rounded-full"></div>
                                        جاري المعالجة...
                                    </>
                                ) : (
                                    <>
                                        <UserPlus className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                                        تأكيد الاستيراد للنظام
                                    </>
                                )}
                            </span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Results Section */}
            {result && (
                <div className="bg-white rounded-2xl qatar-card-shadow border border-qatar-gray-border overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="bg-emerald-600 px-8 py-5 flex items-center gap-3">
                        <CheckCircle2 className="w-8 h-8 text-white" />
                        <h3 className="text-xl font-black text-white">إتمام الاستيراد بنجاح</h3>
                    </div>
                    <div className="p-10 flex flex-col items-center text-center gap-4">
                        <div className="text-qatar-gray-text font-black uppercase tracking-widest text-sm">عدد الطلاب الذين تم إضافتهم</div>
                        <div className="text-6xl font-black text-qatar-maroon drop-shadow-sm">{result.importedCount}</div>
                        <div className="text-slate-400 font-medium italic mt-2">يمكنك الآن عرض الطلاب في لوحة المتابعة أو التقارير</div>
                    </div>
                </div>
            )}
        </div>
    );
}
