import React, { useState, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { Users, UserPlus, Edit, Trash2, ArrowRightLeft, Search, X } from "lucide-react";
// @ts-ignore
import { api } from "../../convex/_generated/api";

const GRADE_SHORT: Record<number, string> = { 10: "عاشر", 11: "حادي عشر", 12: "ثاني عشر" };

const TRACK_COLORS: Record<string, { active: string; badge: string }> = {
    "علمي":     { active: "bg-blue-600 text-white",    badge: "bg-blue-100 text-blue-800 border-blue-200" },
    "أدبي":     { active: "bg-amber-500 text-white",   badge: "bg-amber-100 text-amber-800 border-amber-200" },
    "تكنولوجي": { active: "bg-purple-600 text-white",  badge: "bg-purple-100 text-purple-800 border-purple-200" },
    "عام":      { active: "bg-qatar-maroon text-white", badge: "bg-rose-100 text-qatar-maroon border-rose-200" },
};

function getTrack(track: string | undefined) {
    return TRACK_COLORS[track || "عام"] || TRACK_COLORS["عام"];
}

export default function StudentsPage() {
    const initialData = useQuery(api.setup.getInitialData);
    
    const [selectedGrade, setSelectedGrade] = useState<number>(10);
    const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");

    const schoolId = initialData?.schools?.[0]?._id;

    const classStudents = useQuery(api.students.getStudentsByClass, 
        selectedClassId ? { classId: selectedClassId as any } : "skip" as any
    );

    const addStudent = useMutation(api.students.addStudent);
    const updateStudentClass = useMutation(api.students.updateStudentClass);
    const updateStudentDetails = useMutation(api.students.updateStudentDetails);
    const deleteStudent = useMutation(api.students.deleteStudent);

    // Modals state
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [editStudentData, setEditStudentData] = useState<any>(null);
    const [transferStudentData, setTransferStudentData] = useState<any>(null);

    // Forms state
    const [fullName, setFullName] = useState("");
    const [guardianPhone, setGuardianPhone] = useState("");
    const [targetClassId, setTargetClassId] = useState("");

    if (!initialData) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-qatar-maroon"></div>
            </div>
        );
    }

    const gradeClasses = initialData.classes
        ? initialData.classes.filter((c: any) => c.grade === selectedGrade && c.isActive)
            .sort((a: any, b: any) => {
                const na = parseInt(a.name.split("-")[1] || "0", 10);
                const nb = parseInt(b.name.split("-")[1] || "0", 10);
                return na - nb;
            })
        : [];

    const trackGroups = gradeClasses.reduce((acc: any, cls: any) => {
        const track = cls.track || "عام";
        if (!acc[track]) acc[track] = [];
        acc[track].push(cls);
        return acc;
    }, {});

    const trackOrder = Object.keys(trackGroups);

    // Filter students
    const filteredStudents = classStudents?.filter((s: any) => 
        s.fullName.toLowerCase().includes(searchQuery.toLowerCase()) || 
        (s.guardianPhone && s.guardianPhone.includes(searchQuery))
    ) || [];

    const handleAddStudent = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!fullName.trim() || !selectedClassId || !schoolId) return;
        try {
            await addStudent({
                schoolId,
                classId: selectedClassId as any,
                fullName,
                guardianPhone
            });
            setIsAddModalOpen(false);
            setFullName("");
            setGuardianPhone("");
        } catch (err) {
            console.error("Failed to add student:", err);
            alert("حدث خطأ أثناء الإضافة.");
        }
    };

    const handleEditStudent = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editStudentData || !fullName.trim()) return;
        try {
            await updateStudentDetails({
                studentId: editStudentData._id,
                fullName,
                guardianPhone
            });
            setEditStudentData(null);
        } catch (err) {
            alert("حدث خطأ أثناء التعديل.");
        }
    };

    const handleTransferStudent = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!transferStudentData || !targetClassId) return;
        try {
            await updateStudentClass({
                studentId: transferStudentData._id,
                newClassId: targetClassId as any
            });
            setTransferStudentData(null);
            // Optionally clear selectedClassId if you want to force them to select again, but keeping it is fine.
        } catch (err) {
            alert("حدث خطأ أثناء النقل.");
        }
    };

    const handleDeleteStudent = async (studentId: string, studentName: string) => {
        if (window.confirm(`هل أنت متأكد من حذف الطالب ${studentName}؟ سيتم حذف كافة بياناته وحضوره.`)) {
            try {
                await deleteStudent({ studentId: studentId as any });
            } catch (err) {
                alert("حدث خطأ أثناء الحذف.");
            }
        }
    };

    const openEditModal = (student: any) => {
        setFullName(student.fullName);
        setGuardianPhone(student.guardianPhone || "");
        setEditStudentData(student);
    };

    const openTransferModal = (student: any) => {
        setTargetClassId("");
        setTransferStudentData(student);
    };

    return (
        <div className="max-w-7xl mx-auto space-y-8 font-sans transition-all animate-in fade-in duration-500 pb-20 mt-4">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl qatar-card-shadow border border-qatar-gray-border/50">
                <div className="flex items-center gap-4">
                    <div className="bg-qatar-maroon p-3 rounded-2xl shadow-inner">
                        <Users className="w-7 h-7 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-slate-800 tracking-tight">إدارة الطلاب</h1>
                        <p className="text-slate-500 font-bold text-sm mt-1">تعديل بيانات الطلاب ونقلهم بين الصفوف</p>
                    </div>
                </div>
            </div>

            {/* Selection UI */}
            <div className="bg-white rounded-3xl qatar-card-shadow border border-slate-200 overflow-hidden">
                {/* Grade Toggle Tabs */}
                <div className="flex bg-slate-50 p-2 sm:p-3 border-b border-slate-100">
                    {[10, 11, 12].map((g) => (
                        <button
                            key={g}
                            onClick={() => {
                                setSelectedGrade(g);
                                setSelectedClassId(null);
                            }}
                            className={`flex-1 py-3 text-sm sm:text-base font-black rounded-2xl transition-all duration-300 ${
                                selectedGrade === g
                                    ? "bg-qatar-maroon text-white shadow-md scale-[1.02]"
                                    : "text-slate-500 hover:bg-slate-200 hover:text-slate-700"
                            }`}
                        >
                            الصف {GRADE_SHORT[g]}
                        </button>
                    ))}
                </div>

                {/* Class Pills */}
                <div className="p-4 sm:p-6 bg-slate-50">
                    {gradeClasses.length === 0 ? (
                        <div className="text-center py-6">
                            <p className="text-slate-500 font-bold">لا توجد صفوف مضافة في هذا المستوى.</p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {trackOrder.map(track => {
                                const classes = trackGroups[track];
                                return (
                                    <div key={track} className="space-y-3">
                                        <div className="flex items-center gap-3">
                                            <div className="h-[1px] flex-1 bg-slate-200"></div>
                                            <span className={`px-4 py-1 rounded-full text-xs font-black border ${getTrack(track).badge}`}>
                                                مسار {track}
                                            </span>
                                            <div className="h-[1px] flex-1 bg-slate-200"></div>
                                        </div>
                                        <div className="flex flex-wrap gap-2 justify-center">
                                            {classes.map((cls: any) => {
                                                const isActive = selectedClassId === cls._id;
                                                return (
                                                    <button
                                                        key={cls._id}
                                                        onClick={() => setSelectedClassId(cls._id)}
                                                        className={`relative flex items-center gap-1.5 px-6 py-2.5 rounded-xl font-black text-sm transition-all whitespace-nowrap border ${
                                                            isActive
                                                                ? getTrack(track).active + " border-transparent shadow-md scale-105"
                                                                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100 hover:text-qatar-maroon"
                                                        }`}
                                                    >
                                                        {cls.name}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Students Table */}
            {selectedClassId && classStudents && (
                <div className="bg-white rounded-3xl qatar-card-shadow border border-slate-200 overflow-hidden animate-in slide-in-from-bottom-6">
                    <div className="bg-slate-800 px-6 py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <h2 className="text-xl font-black text-white flex items-center gap-3">
                            <Users className="w-6 h-6 text-slate-400" />
                            بيانات طلاب الصف
                            <span className="bg-slate-700 text-white text-sm px-3 py-1 rounded-full">{classStudents.length}</span>
                        </h2>
                        
                        <div className="flex items-center gap-3 w-full sm:w-auto">
                            <div className="relative flex-1 sm:w-64">
                                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input 
                                    type="text"
                                    placeholder="بحث بالاسم..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full bg-slate-700 border-none outline-none text-white placeholder:text-slate-400 text-sm font-bold pl-3 pr-10 py-2.5 rounded-xl focus:bg-slate-600 transition-colors"
                                />
                            </div>
                            <button 
                                onClick={() => { setFullName(""); setGuardianPhone(""); setIsAddModalOpen(true); }}
                                className="bg-qatar-maroon text-white px-4 py-2.5 rounded-xl font-black hover:bg-rose-800 transition-colors flex items-center gap-2 whitespace-nowrap"
                            >
                                <UserPlus className="w-4 h-4" />
                                <span className="hidden sm:inline">إضافة طالب</span>
                            </button>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        {filteredStudents.length === 0 ? (
                            <div className="p-10 text-center">
                                <p className="text-slate-500 font-bold">لا يوجد طلاب يطابقون بحثك.</p>
                            </div>
                        ) : (
                            <table className="w-full border-collapse text-right min-w-[700px]">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-200">
                                        <th className="py-4 px-6 text-sm font-black text-slate-500 w-16 text-center">#</th>
                                        <th className="py-4 px-6 text-sm font-black text-slate-500">اسم الطالب</th>
                                        <th className="py-4 px-6 text-sm font-black text-slate-500 text-center">هاتف ولي الأمر</th>
                                        <th className="py-4 px-6 text-sm font-black text-slate-500 text-center">الإجراءات</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredStudents.map((student: any, idx: number) => (
                                        <tr key={student._id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                                            <td className="py-4 px-6 font-bold text-slate-400 text-center">{idx + 1}</td>
                                            <td className="py-4 px-6 font-black text-slate-800">{student.fullName}</td>
                                            <td className="py-4 px-6 font-bold text-slate-600 text-center" dir="ltr">{student.guardianPhone || "-"}</td>
                                            <td className="py-4 px-6">
                                                <div className="flex items-center justify-center gap-2">
                                                    <button 
                                                        onClick={() => openTransferModal(student)}
                                                        title="نقل لصف آخر"
                                                        className="p-2 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white rounded-lg transition-colors"
                                                    >
                                                        <ArrowRightLeft className="w-4 h-4" />
                                                    </button>
                                                    <button 
                                                        onClick={() => openEditModal(student)}
                                                        title="تعديل البيانات"
                                                        className="p-2 bg-amber-50 text-amber-600 hover:bg-amber-500 hover:text-white rounded-lg transition-colors"
                                                    >
                                                        <Edit className="w-4 h-4" />
                                                    </button>
                                                    <button 
                                                        onClick={() => handleDeleteStudent(student._id, student.fullName)}
                                                        title="حذف الطالب"
                                                        className="p-2 bg-rose-50 text-rose-600 hover:bg-rose-500 hover:text-white rounded-lg transition-colors"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            )}

            {/* Adding Student Modal */}
            {isAddModalOpen && (
                <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center p-6 border-b border-slate-100">
                            <h3 className="font-black text-lg text-slate-800 flex items-center gap-2">
                                <UserPlus className="w-5 h-5 text-qatar-maroon" />
                                إضافة طالب جديد
                            </h3>
                            <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                                <X className="w-6 h-6" />
                            </button>
                        </div>
                        <form onSubmit={handleAddStudent} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-black text-slate-600 mb-1.5">اسم الطالب الرباعي *</label>
                                <input 
                                    type="text" 
                                    required
                                    value={fullName}
                                    onChange={e => setFullName(e.target.value)}
                                    className="w-full border border-slate-200 bg-slate-50 py-3 px-4 rounded-xl font-bold outline-none focus:border-qatar-maroon focus:bg-white transition-colors"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-black text-slate-600 mb-1.5">رقم هاتف ولي الأمر</label>
                                <input 
                                    type="text" 
                                    value={guardianPhone}
                                    onChange={e => setGuardianPhone(e.target.value)}
                                    dir="ltr"
                                    className="w-full text-right border border-slate-200 bg-slate-50 py-3 px-4 rounded-xl font-bold outline-none focus:border-qatar-maroon focus:bg-white transition-colors"
                                />
                            </div>
                            <div className="pt-4">
                                <button type="submit" className="w-full bg-qatar-maroon text-white font-black py-3.5 rounded-xl hover:bg-rose-800 transition-colors shadow-lg shadow-qatar-maroon/20">
                                    حفظ وإضافة
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Editing Student Modal */}
            {editStudentData && (
                <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center p-6 border-b border-slate-100">
                            <h3 className="font-black text-lg text-slate-800 flex items-center gap-2">
                                <Edit className="w-5 h-5 text-amber-500" />
                                تعديل بيانات الطالب
                            </h3>
                            <button onClick={() => setEditStudentData(null)} className="text-slate-400 hover:text-slate-600">
                                <X className="w-6 h-6" />
                            </button>
                        </div>
                        <form onSubmit={handleEditStudent} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-black text-slate-600 mb-1.5">اسم الطالب *</label>
                                <input 
                                    type="text" 
                                    required
                                    value={fullName}
                                    onChange={e => setFullName(e.target.value)}
                                    className="w-full border border-slate-200 bg-slate-50 py-3 px-4 rounded-xl font-bold outline-none focus:border-amber-500 focus:bg-white transition-colors"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-black text-slate-600 mb-1.5">رقم هاتف ولي الأمر</label>
                                <input 
                                    type="text" 
                                    value={guardianPhone}
                                    onChange={e => setGuardianPhone(e.target.value)}
                                    dir="ltr"
                                    className="w-full text-right border border-slate-200 bg-slate-50 py-3 px-4 rounded-xl font-bold outline-none focus:border-amber-500 focus:bg-white transition-colors"
                                />
                            </div>
                            <div className="pt-4">
                                <button type="submit" className="w-full bg-amber-500 text-white font-black py-3.5 rounded-xl hover:bg-amber-600 transition-colors shadow-lg shadow-amber-500/20">
                                    حفظ التعديلات
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Transfer Student Modal */}
            {transferStudentData && (
                <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center p-6 border-b border-slate-100">
                            <h3 className="font-black text-lg text-slate-800 flex items-center gap-2">
                                <ArrowRightLeft className="w-5 h-5 text-blue-500" />
                                نقل الطالب
                            </h3>
                            <button onClick={() => setTransferStudentData(null)} className="text-slate-400 hover:text-slate-600">
                                <X className="w-6 h-6" />
                            </button>
                        </div>
                        <form onSubmit={handleTransferStudent} className="p-6 space-y-4">
                            <div className="bg-slate-50 p-4 rounded-xl mb-2">
                                <p className="text-sm font-bold text-slate-500">اسم الطالب</p>
                                <p className="text-base font-black text-slate-800">{transferStudentData.fullName}</p>
                            </div>
                            <div>
                                <label className="block text-sm font-black text-slate-600 mb-1.5">اختر الصف الجديد للاستلام *</label>
                                <select 
                                    required
                                    value={targetClassId}
                                    onChange={e => setTargetClassId(e.target.value)}
                                    className="w-full border border-slate-200 bg-white py-3 px-4 rounded-xl font-bold outline-none focus:border-blue-500 transition-colors"
                                >
                                    <option value="" disabled>-- الرجاء اختيار الصف --</option>
                                    {initialData.classes?.map((cls: any) => (
                                        // Optional: filter out the current class id
                                        cls._id !== transferStudentData.classId && cls.isActive && (
                                            <option key={cls._id} value={cls._id}>{cls.name} (عاشر {cls.grade}) - {cls.track || "عام"}</option>
                                        )
                                    ))}
                                </select>
                            </div>
                            
                            <div className="pt-4">
                                <button type="submit" className="w-full bg-blue-600 text-white font-black py-3.5 rounded-xl hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/20">
                                    تأكيد النقل
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
