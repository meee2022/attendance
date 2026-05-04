import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import * as XLSX from "xlsx";
// @ts-ignore
import { api } from "../../convex/_generated/api";
import { Upload, Save, Trash2, RotateCcw, Settings as Cog, Download, AlertCircle, CheckCircle2, FileSpreadsheet, Database } from "lucide-react";

const KNOWN_TRACKS = ["عام", "علمي", "أدبي", "تكنولوجي"];

function parseGrade(v: any) {
    if (v === undefined || v === null || v === "") return undefined;
    const s = String(v).trim();
    if (s === "غ" || s === "غياب") return "absent";
    if (s === "معذور") return "excused";
    const n = Number(s);
    if (!isNaN(n)) return n;
    return undefined;
}

type ParsedFile = {
    fileName: string;
    grade: number;
    track: string;
    records: any[];
    error?: string;
};

export default function GradesAdmin() {
    const settings = useQuery(api.grades.getSettings) as any;
    const updateSettings = useMutation(api.grades.updateSettings);
    const bulkImport = useMutation(api.grades.bulkImportGrades);
    const allGrades = useQuery(api.grades.getAllGrades) as any[] | undefined;
    const [tab, setTab] = useState<"import" | "config">("import");

    if (!settings) return <div className="flex justify-center py-10"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-qatar-maroon"/></div>;

    return (
        <div dir="rtl" className="space-y-4">
            <div className="bg-white rounded-2xl border border-qatar-gray-border qatar-card-shadow overflow-hidden">
                <div className="bg-slate-700 px-5 py-3 flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex gap-2">
                        <button onClick={() => setTab("import")}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black ${tab === "import" ? "bg-white text-slate-700 shadow" : "bg-white/10 text-white hover:bg-white/20"}`}>
                            <Upload className="w-3.5 h-3.5"/>الاستيراد
                        </button>
                        <button onClick={() => setTab("config")}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black ${tab === "config" ? "bg-white text-slate-700 shadow" : "bg-white/10 text-white hover:bg-white/20"}`}>
                            <Cog className="w-3.5 h-3.5"/>الإعدادات
                        </button>
                    </div>
                    <span className="font-black text-white text-sm">إدارة الدرجات · {allGrades?.length ?? 0} سجل</span>
                </div>
                <div className="p-5">
                    {tab === "import" && <ImportTab onImport={bulkImport}/>}
                    {tab === "config" && <ConfigTab settings={settings} onUpdate={updateSettings}/>}
                </div>
            </div>
        </div>
    );
}

function ImportTab({ onImport }: { onImport: any }) {
    const [files, setFiles] = useState<ParsedFile[]>([]);
    const [importing, setImporting] = useState(false);
    const [result, setResult] = useState<{ inserted: number; matched: number } | null>(null);
    const [clearExisting, setClearExisting] = useState(false);

    const detectGradeTrack = (filename: string): { grade: number; track: string } => {
        const name = filename.toLowerCase();
        let grade = 10;
        let track = "عام";
        if (name.includes("حادي") || name.includes("11")) grade = 11;
        if (name.includes("ثاني") || name.includes("12")) grade = 12;
        if (name.includes("علمي")) track = "علمي";
        else if (name.includes("أدبي") || name.includes("ادبي")) track = "أدبي";
        else if (name.includes("تكنولوجي")) track = "تكنولوجي";
        return { grade, track };
    };

    const parseFile = (f: File): Promise<ParsedFile> => new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = e => {
            try {
                const buf = e.target?.result;
                const wb = XLSX.read(buf, { type: "array" });
                const { grade, track } = detectGradeTrack(f.name);
                const records: any[] = [];
                for (const sheetName of wb.SheetNames) {
                    if (sheetName === "Sheet1") continue;
                    const ws = wb.Sheets[sheetName];
                    if (!ws["!ref"]) continue;
                    const range = XLSX.utils.decode_range(ws["!ref"]);
                    const subject = sheetName.trim();
                    let currentClass = "";
                    for (let R = range.s.r; R <= range.e.r; R++) {
                        const a = ws[XLSX.utils.encode_cell({ r: R, c: 0 })]?.v;
                        const b = ws[XLSX.utils.encode_cell({ r: R, c: 1 })]?.v;
                        const c = ws[XLSX.utils.encode_cell({ r: R, c: 2 })]?.v;
                        if (typeof b === "string" && b.includes("صف ") && !c) {
                            currentClass = b.replace("صف ", "").trim();
                            continue;
                        }
                        if (!a || typeof a !== "number") continue;
                        if (!b || typeof b !== "string") continue;
                        const name = b.replace(/\s+/g, " ").trim();
                        const classId = c ? String(c).trim() : currentClass;
                        if (!classId) continue;
                        records.push({
                            studentName: name,
                            className: classId,
                            grade,
                            track,
                            subjectName: subject,
                            a1: parseGrade(ws[XLSX.utils.encode_cell({ r: R, c: 3 })]?.v),
                            a2: parseGrade(ws[XLSX.utils.encode_cell({ r: R, c: 4 })]?.v),
                            a3: parseGrade(ws[XLSX.utils.encode_cell({ r: R, c: 5 })]?.v),
                            a4: parseGrade(ws[XLSX.utils.encode_cell({ r: R, c: 6 })]?.v),
                            a5: parseGrade(ws[XLSX.utils.encode_cell({ r: R, c: 7 })]?.v),
                        });
                    }
                }
                resolve({ fileName: f.name, grade, track, records });
            } catch (e: any) {
                resolve({ fileName: f.name, grade: 0, track: "—", records: [], error: e.message });
            }
        };
        reader.readAsArrayBuffer(f);
    });

    const handleFiles = async (fileList: FileList | null) => {
        if (!fileList) return;
        const parsed: ParsedFile[] = [];
        for (const f of Array.from(fileList)) {
            parsed.push(await parseFile(f));
        }
        setFiles(parsed);
        setResult(null);
    };

    const handleImport = async () => {
        const allRecords = files.flatMap(f => f.records);
        if (allRecords.length === 0) return;
        setImporting(true);
        try {
            // Convex has request size limit. Send in chunks.
            const CHUNK = 500;
            let totalInserted = 0, totalMatched = 0;
            for (let i = 0; i < allRecords.length; i += CHUNK) {
                const chunk = allRecords.slice(i, i + CHUNK);
                const r = await onImport({
                    records: chunk,
                    clearExisting: clearExisting && i === 0,
                    matchExistingStudents: true,
                }) as any;
                totalInserted += r.inserted;
                totalMatched += r.matched;
            }
            setResult({ inserted: totalInserted, matched: totalMatched });
            setFiles([]);
        } catch (e: any) {
            alert("خطأ: " + e.message);
        } finally {
            setImporting(false);
        }
    };

    const totalRecords = files.reduce((a, f) => a + f.records.length, 0);
    const totalStudents = new Set(files.flatMap(f => f.records.map(r => r.studentName))).size;

    return (
        <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-xs font-bold text-blue-800">
                <p className="flex items-center gap-1.5"><AlertCircle className="w-4 h-4"/>كيفية الاستيراد:</p>
                <ul className="list-disc pr-4 mt-2 space-y-0.5 font-medium">
                    <li>اسم الملف يحدّد المرحلة والمسار تلقائياً (مثل "حادي عشر-علمي")</li>
                    <li>كل ورقة في الملف = مادة دراسية</li>
                    <li>الأعمدة: م · الاسم · الصف · 5 تقييمات</li>
                    <li>القيم الخاصة: غ (غياب) · معذور</li>
                </ul>
            </div>

            <label className="block">
                <div className="border-2 border-dashed border-slate-200 rounded-2xl p-8 text-center hover:border-qatar-maroon hover:bg-rose-50/30 transition-all cursor-pointer">
                    <FileSpreadsheet className="w-12 h-12 text-slate-300 mx-auto mb-2"/>
                    <p className="font-black text-slate-600">اسحب الملفات هنا أو اضغط للاختيار</p>
                    <p className="text-[10px] text-slate-400 font-bold mt-1">يمكن اختيار 1-4 ملفات في وقت واحد (.xlsx)</p>
                </div>
                <input type="file" multiple accept=".xlsx,.xls" onChange={e => handleFiles(e.target.files)} className="hidden"/>
            </label>

            {files.length > 0 && (
                <div className="space-y-2">
                    {files.map((f, i) => (
                        <div key={i} className="bg-white rounded-xl border border-slate-200 p-3 flex items-center justify-between">
                            <span className="text-[10px] font-black text-slate-400">{f.records.length} سجل</span>
                            <div className="flex-1 text-right mr-3">
                                <p className="text-sm font-black text-slate-700 truncate">{f.fileName}</p>
                                <p className="text-[10px] font-bold text-slate-400 mt-0.5">
                                    صف {f.grade} {f.track !== "—" && `· ${f.track}`}
                                    {f.error && <span className="text-rose-500"> · خطأ: {f.error}</span>}
                                </p>
                            </div>
                            <button onClick={() => setFiles(p => p.filter((_, idx) => idx !== i))} className="text-rose-500 hover:bg-rose-50 p-1.5 rounded">
                                <Trash2 className="w-3.5 h-3.5"/>
                            </button>
                        </div>
                    ))}

                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center justify-between">
                        <span className="text-xs font-black text-emerald-700">{totalStudents} طالب · {totalRecords} سجل</span>
                        <span className="text-xs font-black text-emerald-700">جاهز للاستيراد</span>
                    </div>

                    <label className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl cursor-pointer">
                        <input type="checkbox" checked={clearExisting} onChange={e => setClearExisting(e.target.checked)} className="w-4 h-4"/>
                        <span className="text-xs font-bold text-amber-800">حذف كل البيانات السابقة قبل الاستيراد (احذر!)</span>
                    </label>

                    <button onClick={handleImport} disabled={importing}
                        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-white font-black text-sm hover:opacity-90 disabled:opacity-50 qatar-card-shadow"
                        style={{ background: "linear-gradient(135deg,#5C1A1B,#7A2425)" }}>
                        {importing ? <><RotateCcw className="w-4 h-4 animate-spin"/>جارٍ الاستيراد...</> : <><Upload className="w-4 h-4"/>استيراد الكل</>}
                    </button>
                </div>
            )}

            {result && (
                <div className="bg-emerald-50 border-2 border-emerald-300 rounded-xl p-4 flex items-center gap-3">
                    <CheckCircle2 className="w-6 h-6 text-emerald-600 flex-shrink-0"/>
                    <div>
                        <p className="font-black text-emerald-800 text-sm">تم الاستيراد بنجاح</p>
                        <p className="text-xs text-emerald-700 font-bold mt-0.5">{result.inserted} سجل · {result.matched} طالب مطابق مع قاعدة البيانات</p>
                    </div>
                </div>
            )}
        </div>
    );
}

function ConfigTab({ settings, onUpdate }: { settings: any; onUpdate: any }) {
    const [maxA, setMaxA] = useState(settings.maxPerAssessment);
    const [final, setFinal] = useState(settings.finalScoreOutOf);
    const [pass, setPass] = useState(settings.passThreshold);
    const [excellence, setExcellence] = useState(settings.excellenceThreshold);
    const [labels, setLabels] = useState<string[]>(settings.assessmentLabels);
    const [saved, setSaved] = useState(false);

    const handleSave = async () => {
        await onUpdate({
            maxPerAssessment: maxA,
            finalScoreOutOf: final,
            passThreshold: pass,
            excellenceThreshold: excellence,
            assessmentLabels: labels,
        });
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    };

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                    <label className="block text-xs font-black text-slate-500 mb-1.5">الدرجة القصوى لكل تقييم</label>
                    <input type="number" value={maxA} onChange={e => setMaxA(Number(e.target.value))}
                        className="w-full border-2 border-slate-100 rounded-xl px-3 py-2.5 text-sm font-bold bg-slate-50 focus:outline-none focus:border-qatar-maroon"/>
                </div>
                <div>
                    <label className="block text-xs font-black text-slate-500 mb-1.5">الدرجة النهائية من</label>
                    <input type="number" value={final} onChange={e => setFinal(Number(e.target.value))}
                        className="w-full border-2 border-slate-100 rounded-xl px-3 py-2.5 text-sm font-bold bg-slate-50 focus:outline-none focus:border-qatar-maroon"/>
                </div>
                <div>
                    <label className="block text-xs font-black text-slate-500 mb-1.5">حد النجاح (من {final})</label>
                    <input type="number" step="0.1" value={pass} onChange={e => setPass(Number(e.target.value))}
                        className="w-full border-2 border-slate-100 rounded-xl px-3 py-2.5 text-sm font-bold bg-slate-50 focus:outline-none focus:border-qatar-maroon"/>
                </div>
                <div>
                    <label className="block text-xs font-black text-slate-500 mb-1.5">حد التميز (من {final})</label>
                    <input type="number" step="0.1" value={excellence} onChange={e => setExcellence(Number(e.target.value))}
                        className="w-full border-2 border-slate-100 rounded-xl px-3 py-2.5 text-sm font-bold bg-slate-50 focus:outline-none focus:border-qatar-maroon"/>
                </div>
            </div>

            <div>
                <label className="block text-xs font-black text-slate-500 mb-2">أسماء التقييمات الـ 5</label>
                <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
                    {labels.map((l, i) => (
                        <input key={i} value={l} onChange={e => setLabels(p => p.map((x, idx) => idx === i ? e.target.value : x))}
                            className="border-2 border-slate-100 rounded-xl px-3 py-2 text-sm font-bold bg-slate-50 focus:outline-none focus:border-qatar-maroon text-center"/>
                    ))}
                </div>
            </div>

            <button onClick={handleSave}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-qatar-maroon text-white font-black text-sm hover:opacity-90">
                {saved ? <><CheckCircle2 className="w-4 h-4"/>تم الحفظ</> : <><Save className="w-4 h-4"/>حفظ الإعدادات</>}
            </button>
        </div>
    );
}
