import { Routes, Route, Link, useLocation } from "react-router-dom";
import { LayoutDashboard, Database, Settings, BarChart3, Upload, Shield, X, MessageSquare, Users, ClipboardCheck } from "lucide-react";
import { useState } from "react";
import TeacherUpload from "./pages/TeacherUpload";
import AdminDashboard from "./pages/AdminDashboard";
import ClassDetails from "./pages/ClassDetails";
import SeedPage from "./pages/SeedPage";
import ImportStudents from "./pages/ImportStudents";
import ReportsPage from "./pages/ReportsPage";
import SettingsPage from "./pages/SettingsPage";
import MessagesPage from "./pages/MessagesPage";
import MessageTemplatesPage from "./pages/MessageTemplatesPage";
import AdminGuard, { clearAdminSession } from "./components/AdminGuard";
import AssessmentsPage from "./pages/AssessmentsPage";
import StudentsPage from "./pages/StudentsPage";
import { FileCheck, ClipboardList } from "lucide-react";
import SurveysPage from "./pages/SurveysPage";
import SupervisionPage from "./pages/SupervisionPage";
import SupervisionPrint from "./pages/SupervisionPrint";

const PUBLIC_NAV = [
    { to: "/",          icon: <LayoutDashboard className="w-5 h-5" />, label: "المتابعة",      admin: false },
    { to: "/upload",    icon: <Upload className="w-5 h-5" />,          label: "رصد الغياب",    admin: false },
    { to: "/assessments",icon: <FileCheck className="w-5 h-5" />,       label: "التطبيقات",     admin: false },
    { to: "/reports",   icon: <BarChart3 className="w-5 h-5" />,       label: "التقارير",      admin: false },
    { to: "/messages",  icon: <MessageSquare className="w-5 h-5" />,   label: "الرسائل",       admin: false },
    { to: "/surveys",   icon: <ClipboardList className="w-5 h-5" />,   label: "الاستبانات",    admin: false },
    { to: "/supervision",icon: <ClipboardCheck className="w-5 h-5" />,  label: "الإشراف الصفي",  admin: false },
];

const ADMIN_NAV = [
    { to: "/students", icon: <Users className="w-5 h-5" />, label: "إدارة الطلاب", admin: true },
    { to: "/settings", icon: <Settings className="w-5 h-5" />, label: "الإعدادات", admin: true },
];

const ALL_NAV = [...PUBLIC_NAV, ...ADMIN_NAV];

function App() {
  return (
    <div className="min-h-screen bg-qatar-gray-bg text-slate-900 font-sans" dir="rtl">
      <Navbar />
      <main className="max-w-7xl mx-auto py-4 lg:py-10 px-3 sm:px-6 lg:px-8 pb-24 lg:pb-10">
        <Routes>
          <Route path="/"                    element={<AdminDashboard />} />
          <Route path="/upload"              element={<TeacherUpload />} />
          <Route path="/assessments"         element={<AssessmentsPage />} />
          <Route path="/class/:classId"      element={<ClassDetails />} />
          <Route path="/reports"             element={<ReportsPage />} />
          <Route path="/messages"            element={<MessagesPage />} />
          <Route path="/surveys"             element={<SurveysPage />} />
          <Route path="/supervision"         element={<SupervisionPage />} />
          <Route path="/supervision/print/:id" element={<SupervisionPrint />} />
          <Route path="/import-students"     element={<AdminGuard><ImportStudents /></AdminGuard>} />
          <Route path="/students"            element={<AdminGuard><StudentsPage /></AdminGuard>} />
          <Route path="/settings"            element={<AdminGuard><SettingsPage /></AdminGuard>} />
          <Route path="/message-templates"   element={<AdminGuard><MessageTemplatesPage /></AdminGuard>} />
          <Route path="/seed"                element={<AdminGuard><SeedPage /></AdminGuard>} />
        </Routes>
      </main>
      <BottomNav />
    </div>
  );
}

function Navbar() {
  const { pathname } = useLocation();
  const isActive = (to: string) => to === "/" ? pathname === "/" : pathname.startsWith(to);
  const isAdminAuthed = sessionStorage.getItem("qatar_admin_auth") === "true";

  const handleLogout = () => {
    clearAdminSession();
    window.location.href = "/";
  };

  return (
    <nav className="bg-white shadow-sm border-b border-slate-200 sticky top-0 z-20" dir="rtl">
      {/* Top accent bar */}
      <div className="h-1 w-full" style={{ background: "linear-gradient(90deg, #9B1239 0%, #C0184C 50%, #9B1239 100%)" }} />

      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 gap-4">

          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 flex-shrink-0">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-black text-lg shadow-md"
                 style={{ background: "linear-gradient(135deg, #9B1239, #C0184C)" }}>Q</div>
            <div className="flex flex-col leading-tight">
              <span className="font-black text-sm text-slate-800">ابن تيمية الثانوية للبنين</span>
              <span className="hidden sm:block text-[9px] text-slate-400 font-bold uppercase tracking-wider">Ibn Taymiyyah School</span>
            </div>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden lg:flex items-center gap-1 flex-1 justify-center">
            {/* Public tabs */}
            {PUBLIC_NAV.map(({ to, icon, label }) => {
              const active = isActive(to);
              return (
                <Link key={to} to={to}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-bold transition-all ${
                    active
                      ? "bg-qatar-maroon text-white shadow-sm"
                      : "text-slate-500 hover:bg-rose-50 hover:text-qatar-maroon"
                  }`}
                >
                  {icon}{label}
                </Link>
              );
            })}

            {/* Divider */}
            <div className="w-px h-6 bg-slate-200 mx-1" />

            {/* Admin tabs */}
            {ADMIN_NAV.map(({ to, icon, label }) => {
              const active = isActive(to);
              return (
                <Link key={to} to={to}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-bold transition-all ${
                    active
                      ? "bg-qatar-maroon text-white shadow-sm"
                      : "text-slate-400 hover:bg-rose-50 hover:text-qatar-maroon"
                  }`}
                >
                  {icon}
                  <span className="text-xs">{label}</span>
                  <Shield className={`w-2.5 h-2.5 opacity-50 ${active ? "text-white" : "text-slate-300"}`} />
                </Link>
              );
            })}
          </div>

          {/* Right side: user info */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {isAdminAuthed && (
              <button onClick={handleLogout}
                className="hidden sm:flex items-center gap-1.5 text-[11px] font-black text-slate-400 hover:text-qatar-maroon border border-slate-200 hover:border-qatar-maroon/40 px-3 py-1.5 rounded-xl transition-all">
                <Shield className="w-3.5 h-3.5" />خروج
              </button>
            )}
            <div className="hidden sm:flex flex-col items-end leading-tight">
              <span className="text-[10px] font-bold text-slate-400">{isAdminAuthed ? "مسؤول النظام" : "معلم"}</span>
              <span className="text-sm font-black text-slate-700">{isAdminAuthed ? "Admin" : "Teacher"}</span>
            </div>
            <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center font-black text-xs ${
              isAdminAuthed ? "bg-qatar-maroon text-white border-qatar-maroon" : "bg-qatar-maroon/10 border-qatar-maroon/20 text-qatar-maroon"
            }`}>
              {isAdminAuthed ? "AD" : "T"}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}

function BottomNav() {
  const { pathname } = useLocation();
  const isActive = (to: string) => to === "/" ? pathname === "/" : pathname.startsWith(to);
  const isAdminAuthed = sessionStorage.getItem("qatar_admin_auth") === "true";
  const [showAdminDrawer, setShowAdminDrawer] = useState(false);

  const handleLogout = () => {
    clearAdminSession();
    setShowAdminDrawer(false);
    window.location.href = "/";
  };

  const isAdminRouteActive = ADMIN_NAV.some(n => isActive(n.to));

  return (
    <>
      {showAdminDrawer && (
        <div className="lg:hidden fixed inset-0 z-40" dir="rtl">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowAdminDrawer(false)} />
          <div className="absolute bottom-16 right-0 left-0 bg-white rounded-t-3xl shadow-2xl border-t border-slate-100 animate-in slide-in-from-bottom-4 duration-300">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <span className="font-black text-slate-700 flex items-center gap-2">
                <Shield className="w-4 h-4 text-qatar-maroon" />صفحات المسؤول
              </span>
              <button onClick={() => setShowAdminDrawer(false)} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>
            <div className="p-4 space-y-2">
              {ADMIN_NAV.map(({ to, icon, label }) => (
                <Link key={to} to={to} onClick={() => setShowAdminDrawer(false)}
                  className={`flex items-center gap-4 px-4 py-3.5 rounded-2xl font-bold text-sm transition-colors ${
                    isActive(to) ? "bg-qatar-maroon text-white" : "bg-slate-50 text-slate-700 hover:bg-rose-50 hover:text-qatar-maroon"
                  }`}
                >
                  {icon}{label}
                </Link>
              ))}
              {isAdminAuthed && (
                <button onClick={handleLogout}
                  className="w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl font-bold text-sm text-red-600 bg-red-50 hover:bg-red-100 transition-colors mt-1">
                  <Shield className="w-5 h-5" />تسجيل الخروج من Admin
                </button>
              )}
            </div>
            <div className="pb-2" />
          </div>
        </div>
      )}

      <nav className="lg:hidden fixed bottom-0 right-0 left-0 z-30 bg-white border-t-2 border-qatar-maroon shadow-[0_-4px_20px_rgba(0,0,0,0.08)]" dir="rtl">
        <div className="flex items-stretch h-16" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
          {PUBLIC_NAV.map(({ to, icon, label }) => {
            const active = isActive(to);
            return (
              <Link key={to} to={to}
                className={`flex-1 flex flex-col items-center justify-center gap-0.5 text-[9px] font-black transition-colors ${
                  active ? "text-qatar-maroon" : "text-slate-400"
                }`}
              >
                <span className={`transition-all ${active ? "scale-110" : ""}`}>{icon}</span>
                {label}
              </Link>
            );
          })}
          <button onClick={() => setShowAdminDrawer(v => !v)}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 text-[9px] font-black transition-colors relative ${
              isAdminRouteActive || showAdminDrawer ? "text-qatar-maroon" : "text-slate-400"
            }`}
          >
            <Shield className={`w-5 h-5 transition-all ${isAdminRouteActive || showAdminDrawer ? "scale-110" : ""}`} />
            {isAdminAuthed ? "إدارة" : "Admin"}
            {isAdminAuthed && (
              <span className="absolute top-2 left-1/2 translate-x-3 w-2 h-2 bg-qatar-maroon rounded-full border-2 border-white" />
            )}
          </button>
        </div>
      </nav>
    </>
  );
}

export default App;
