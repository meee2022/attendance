import { useState, useMemo } from "react";
import { useQuery } from "convex/react";
import { format } from "date-fns";
import * as XLSX from "xlsx";
import {
    MessageSquare, Calendar, Download, Users, UserX, UserCheck,
    Send, AlertCircle, Copy, CheckCircle2,
} from "lucide-react";
// @ts-ignore
import { api } from "../../convex/_generated/api";
import StatCard from "../components/StatCard";

const GRADE_LABELS: Record<number, string> = { 10: "عاشر", 11: "حادي عشر", 12: "ثاني عشر" };
const AR_DAYS = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

function getArabicDayName(dateStr: string): string {
    return AR_DAYS[new Date(dateStr + "T00:00:00").getDay()];
}

function formatDateAr(dateStr: string): string {
    const [y, m, d] = dateStr.split("-");
    return `${parseInt(d)}/${m}/${y}`;
}

function renderTemplate(body: string, vars: Record<string, string>): string {
    return body.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? "");
}

function exportMessagesExcel(rows: { phone: string; message: string }[], dateStr: string, type: string) {
    const data = rows.map(r => ({
        "Phone Number": r.phone,
        "Message Body": r.message,
    }));
    const ws = XLSX.utils.json_to_sheet(data, {
        header: ["Phone Number", "Message Body"],
        skipHeader: false,
    });
    // Auto column width
    ws["!cols"] = [{ wch: 20 }, { wch: 80 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    XLSX.writeFile(wb, `upload_messages-${dateStr}.xlsx`);
}

type MessageType = "absent" | "present";

interface GeneratedRow {
    idx: number;
    studentName: string;
    className: string;
    phone: string;
    message: string;
}

export default function MessagesPage() {
    const [date, setDate]           = useState(format(new Date(), "yyyy-MM-dd"));
    const [grade, setGrade]         = useState<number | undefined>(undefined);
    const [msgType, setMsgType]     = useState<MessageType>("absent");
    const [generated, setGenerated] = useState<GeneratedRow[] | null>(null);
    const [copied, setCopied]       = useState<number | null>(null);

    const templates = useQuery(api.messages.getTemplates);
    const students  = useQuery(api.messages.getStudentsForMessages, {
        date, grade, type: msgType,
    });

    const template = msgType === "absent" ? templates?.absent : templates?.present;
    const defaultBody = msgType === "absent" ? templates?.defaultAbsent : templates?.defaultPresent;
    const effectiveBody = template?.body ?? defaultBody ?? "";

    const handleGenerate = () => {
        if (!students) return;
        const dayName = getArabicDayName(date);
        const fmtDate = formatDateAr(date);
        const rows: GeneratedRow[] = students.map((st, idx) => ({
            idx: idx + 1,
            studentName: st.studentName,
            className:   st.className,
            phone:       st.phone,
            message: renderTemplate(effectiveBody, {
                studentName:  st.studentName,
                date:         fmtDate,
                dayName,
                subjects:     st.subjects || "—",
                schoolName:   "مدرسة ابن تيمية الثانوية للبنين",
                guardianName: "",
            }),
        }));
        setGenerated(rows);
    };

    const handleCopyRow = (msg: string, idx: number) => {
        navigator.clipboard.writeText(msg).then(() => {
            setCopied(idx);
            setTimeout(() => setCopied(null), 1800);
        });
    };

    const noPhone = generated?.filter(r => !r.phone).length ?? 0;
    const withPhone = (generated?.length ?? 0) - noPhone;

    return (
        <div className="max-w-7xl mx-auto space-y-6 pb-20 font-sans animate-in fade-in duration-500">

            {/* Header */}
            <div className="rounded-2xl overflow-hidden qatar-card-shadow"
                 style={{ background: "linear-gradient(135deg, #9B1239 0%, #C0184C 50%, #9B1239 100%)" }}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 sm:p-8">
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-black text-white flex items-center gap-3">
                            <MessageSquare className="w-7 h-7 text-white/80" />
                            الرسائل
                        </h1>
                        <p className="text-white/70 font-medium text-sm mt-1 mr-10">توليد رسائل الحضور والغياب لإرسالها لأولياء الأمور</p>
                    </div>
                    {generated && (
                        <button
                            onClick={() => exportMessagesExcel(generated.map(r => ({ phone: r.phone, message: r.message })), date, msgType)}
                            className="flex items-center gap-2 bg-white/20 backdrop-blur-sm text-white px-5 py-3 rounded-xl font-black text-sm hover:bg-white/30 transition-all border border-white/20 active:scale-95"
                        >
                            <Download className="w-4 h-4" />
                            تصدير ملف الرسائل للنظام
                        </button>
                    )}
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-2xl border border-qatar-gray-border qatar-card-shadow p-4 sm:p-5 space-y-4">

                {/* Type toggle */}
                <div className="flex gap-2 flex-wrap">
                    <span className="text-xs font-black text-slate-500 flex items-center gap-1.5 ml-2">نوع الرسالة:</span>
                    {(["absent", "present"] as MessageType[]).map(t => (
                        <button key={t} onClick={() => { setMsgType(t); setGenerated(null); }}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-black text-sm transition-all border ${
                                msgType === t
                                    ? t === "absent"
                                        ? "bg-rose-600 text-white border-rose-600"
                                        : "bg-emerald-600 text-white border-emerald-600"
                                    : "bg-slate-50 text-slate-600 border-slate-200 hover:border-slate-300"
                            }`}
                        >
                            {t === "absent" ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                            {t === "absent" ? "رسائل الغياب" : "رسائل الحضور"}
                        </button>
                    ))}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    {/* Grade buttons */}
                    <button
                        onClick={() => { setGrade(undefined); setGenerated(null); }}
                        className={`px-3 py-1.5 rounded-xl font-black text-xs transition-all border ${
                            grade === undefined
                                ? "bg-qatar-maroon text-white border-qatar-maroon"
                                : "bg-slate-50 text-slate-600 border-slate-200 hover:border-qatar-maroon/40"
                        }`}
                    >
                        جميع المراحل
                    </button>
                    {([10, 11, 12] as const).map(g => (
                        <button key={g} onClick={() => { setGrade(g); setGenerated(null); }}
                            className={`px-3 py-1.5 rounded-xl font-black text-xs transition-all border ${
                                grade === g
                                    ? "bg-qatar-maroon text-white border-qatar-maroon"
                                    : "bg-slate-50 text-slate-600 border-slate-200 hover:border-qatar-maroon/40"
                            }`}
                        >
                            {GRADE_LABELS[g]}
                        </button>
                    ))}

                    {/* Date */}
                    <div className="flex items-center gap-2 bg-qatar-gray-bg px-3 py-1.5 rounded-xl border border-qatar-gray-border text-sm mr-auto">
                        <Calendar className="w-4 h-4 text-qatar-maroon" />
                        <input
                            type="date"
                            value={date}
                            onChange={e => { setDate(e.target.value); setGenerated(null); }}
                            className="bg-transparent outline-none font-black text-slate-700 cursor-pointer text-sm"
                        />
                    </div>
                </div>

                {/* Template preview */}
                {effectiveBody && (
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm text-slate-600 font-medium leading-relaxed whitespace-pre-wrap">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">القالب المستخدم</span>
                        {effectiveBody}
                    </div>
                )}

                {/* Generate button */}
                <button
                    onClick={handleGenerate}
                    disabled={!students || students.length === 0}
                    className="w-full flex items-center justify-center gap-3 bg-qatar-maroon text-white py-3.5 rounded-xl font-black text-base hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-[0.98] shadow-sm"
                >
                    <Send className="w-5 h-5" />
                    توليد الرسائل
                    {students !== undefined && (
                        <span className="bg-white/20 text-white text-xs font-black px-2.5 py-1 rounded-full">
                            {students.length} طالب
                        </span>
                    )}
                </button>

                {students !== undefined && students.length === 0 && (
                    <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-xl text-sm font-bold">
                        <AlertCircle className="w-4 h-4 flex-shrink-0" />
                        لا توجد بيانات حضور لهذا التاريخ والمرحلة المحددة.
                    </div>
                )}
            </div>

            {/* Results */}
            {generated && generated.length > 0 && (
                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-400">

                    {/* Stats */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        <StatCard label="إجمالي الرسائل" value={generated.length} icon={<MessageSquare className="w-5 h-5" />} color="maroon" />
                        <StatCard label="برقم هاتف" value={withPhone} icon={<UserCheck className="w-5 h-5" />} color="green" />
                        <StatCard label="بدون رقم هاتف" value={noPhone} icon={<AlertCircle className="w-5 h-5" />} color="amber" />
                    </div>

                    {/* Table */}
                    <div className="bg-white rounded-2xl qatar-card-shadow border border-qatar-gray-border overflow-hidden">
                        <div className="bg-qatar-maroon px-5 py-4 flex items-center justify-between">
                            <h2 className="text-white font-black flex items-center gap-2">
                                <MessageSquare className="w-5 h-5 text-white/70" />
                                الرسائل المولَّدة — {generated.length} رسالة
                            </h2>
                            <button
                                onClick={() => exportMessagesExcel(generated.map(r => ({ phone: r.phone, message: r.message })), date, msgType)}
                                className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white text-xs font-black px-3 py-1.5 rounded-xl border border-white/20 transition-colors"
                            >
                                <Download className="w-3.5 h-3.5" />
                                Excel
                            </button>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-right border-collapse text-sm">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-qatar-gray-border">
                                        <th className="py-3 px-4 text-xs font-black text-slate-400 text-center w-10">م</th>
                                        <th className="py-3 px-4 text-xs font-black text-slate-600">اسم الطالب</th>
                                        <th className="py-3 px-4 text-xs font-black text-slate-600 text-center">الصف</th>
                                        <th className="py-3 px-4 text-xs font-black text-slate-600 text-center">رقم الهاتف</th>
                                        <th className="py-3 px-4 text-xs font-black text-slate-600">نص الرسالة</th>
                                        <th className="py-3 px-4 text-xs font-black text-slate-400 text-center w-14">نسخ</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-qatar-gray-border">
                                    {generated.map(row => (
                                        <tr key={row.idx} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="py-3 px-4 text-slate-400 font-bold text-center text-xs">{row.idx}</td>
                                            <td className="py-3 px-4 font-black text-slate-800 whitespace-nowrap">{row.studentName}</td>
                                            <td className="py-3 px-4 text-center">
                                                <span className="bg-rose-50 text-qatar-maroon border border-rose-200 px-2 py-0.5 rounded-lg text-xs font-black whitespace-nowrap">
                                                    {row.className}
                                                </span>
                                            </td>
                                            <td className="py-3 px-4 text-center">
                                                {row.phone ? (
                                                    <span className="font-mono text-sm text-slate-700 font-bold" dir="ltr">{row.phone}</span>
                                                ) : (
                                                    <span className="text-xs text-slate-400 font-bold italic">غير محدد</span>
                                                )}
                                            </td>
                                            <td className="py-3 px-4 text-slate-600 font-medium text-xs leading-relaxed max-w-xs whitespace-pre-wrap">
                                                {row.message}
                                            </td>
                                            <td className="py-3 px-4 text-center">
                                                <button
                                                    onClick={() => handleCopyRow(row.message, row.idx)}
                                                    className={`w-8 h-8 rounded-lg flex items-center justify-center mx-auto transition-all ${
                                                        copied === row.idx
                                                            ? "bg-emerald-100 text-emerald-600"
                                                            : "bg-slate-100 text-slate-400 hover:bg-qatar-maroon/10 hover:text-qatar-maroon"
                                                    }`}
                                                    title="نسخ الرسالة"
                                                >
                                                    {copied === row.idx
                                                        ? <CheckCircle2 className="w-4 h-4" />
                                                        : <Copy className="w-4 h-4" />
                                                    }
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
