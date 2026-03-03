import { Routes, Route, Link } from "react-router-dom";
import { Users, LayoutDashboard, Database } from "lucide-react";
import TeacherUpload from "./pages/TeacherUpload";
import AdminDashboard from "./pages/AdminDashboard";
import ClassDetails from "./pages/ClassDetails";
import SeedPage from "./pages/SeedPage";
import ImportStudents from "./pages/ImportStudents";
import ReportsPage from "./pages/ReportsPage";
import { BarChart3 } from "lucide-react";

function App() {
  return (
    <div className="min-h-screen bg-qatar-gray-bg text-slate-900 font-sans" dir="rtl">
      {/* Navbar */}
      <nav className="bg-white shadow-sm border-b-2 border-qatar-maroon sticky top-0 z-20 text-right">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <div className="flex items-center gap-6">
              <div className="flex-shrink-0 flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-qatar-maroon flex items-center justify-center text-white font-black text-2xl shadow-md">
                  Q
                </div>
                <div className="flex flex-col">
                  <span className="font-black text-xl text-slate-800 leading-tight">نظام حضور قطر</span>
                  <span className="text-[10px] text-qatar-gray-text font-bold uppercase tracking-wider">Ibn Taymiyyah School</span>
                </div>
              </div>

              <div className="hidden lg:flex items-center mr-8 gap-1">
                <NavLink to="/" icon={<LayoutDashboard className="w-4 h-4" />} label="لوحة المتابعة" />
                <NavLink to="/upload" icon={<span className="text-lg">📝</span>} label="رصد الغياب" />
                <NavLink to="/import-students" icon={<Users className="w-4 h-4" />} label="بيانات الطلاب" />
                <NavLink to="/reports" icon={<BarChart3 className="w-4 h-4" />} label="التقارير" />
                <NavLink to="/seed" icon={<Database className="w-4 h-4" />} label="الإعدادات" />
              </div>
            </div>

            {/* User Indicator / Desktop */}
            <div className="hidden sm:flex items-center gap-3">
              <div className="text-left">
                <p className="text-xs font-bold text-slate-400">المسؤول</p>
                <p className="text-sm font-black text-slate-700">مدير النظام</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500 font-bold">
                AD
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-10 px-4 sm:px-6 lg:px-8">
        <Routes>
          <Route path="/" element={<AdminDashboard />} />
          <Route path="/upload" element={<TeacherUpload />} />
          <Route path="/import-students" element={<ImportStudents />} />
          <Route path="/class/:classId" element={<ClassDetails />} />
          <Route path="/seed" element={<SeedPage />} />
          <Route path="/reports" element={<ReportsPage />} />
        </Routes>
      </main>
    </div>
  );
}

function NavLink({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      to={to}
      className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold text-slate-600 hover:bg-slate-50 hover:text-qatar-maroon transition-all group"
    >
      <span className="text-slate-400 group-hover:text-qatar-maroon transition-colors">{icon}</span>
      {label}
    </Link>
  );
}

export default App;
