import { Routes, Route, Link, useLocation } from "react-router-dom";
import { LayoutDashboard, Database, Settings, BarChart3, Upload, Shield, X, MessageSquare, Users, ClipboardCheck, GraduationCap, ChevronDown, MoreHorizontal, LogOut, BookOpen } from "lucide-react";
import { useState, useEffect, useRef } from "react";
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
import GradesPage from "./pages/GradesPage";
import GradesPrint from "./pages/GradesPrint";

// Primary nav: most-used daily operations
const PRIMARY_NAV = [
    { to: "/",          icon: <LayoutDashboard className="w-5 h-5" />, label: "الرئيسية" },
    { to: "/upload",    icon: <Upload className="w-5 h-5" />,          label: "رصد الغياب" },
    { to: "/grades",    icon: <GraduationCap className="w-5 h-5" />,   label: "الدرجات" },
    { to: "/reports",   icon: <BarChart3 className="w-5 h-5" />,       label: "التقارير" },
];

// Secondary nav: in dropdown menu
const SECONDARY_NAV = [
    { to: "/assessments",icon: <FileCheck className="w-4 h-4" />,       label: "التطبيقات" },
    { to: "/supervision",icon: <ClipboardCheck className="w-4 h-4" />,  label: "الإشراف الصفي" },
    { to: "/surveys",   icon: <ClipboardList className="w-4 h-4" />,   label: "الاستبانات" },
    { to: "/messages",  icon: <MessageSquare className="w-4 h-4" />,   label: "الرسائل" },
];

const PUBLIC_NAV = [...PRIMARY_NAV, ...SECONDARY_NAV];

const ADMIN_NAV = [
    { to: "/students", icon: <Users className="w-5 h-5" />, label: "إدارة الطلاب", admin: true },
    { to: "/settings", icon: <Settings className="w-5 h-5" />, label: "الإعدادات", admin: true },
];

const ALL_NAV = [...PUBLIC_NAV, ...ADMIN_NAV];

function App() {
  return (
    <div className="min-h-screen bg-qatar-gray-bg text-slate-900 font-sans" dir="rtl">
      <Navbar />
      <main className="max-w-7xl mx-auto py-4 lg:py-10 px-3 sm:px-6 lg:px-8 pb-28 lg:pb-10">
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
          <Route path="/grades"              element={<GradesPage />} />
          <Route path="/grades/print/student/:studentName" element={<GradesPrint />} />
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
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const handleLogout = () => {
    clearAdminSession();
    window.location.href = "/";
  };

  const moreActive = SECONDARY_NAV.some(n => isActive(n.to));

  return (
    <nav className="sticky top-0 z-20 bg-white/80 backdrop-blur-xl border-b border-slate-200/60" dir="rtl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">

          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 flex-shrink-0 group">
            <div className="relative">
              <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-white font-black text-base shadow-lg shadow-rose-900/20 transition-transform group-hover:scale-105"
                   style={{ background: "linear-gradient(135deg, #5C1A1B, #7A2425)" }}>
                <BookOpen className="w-5 h-5"/>
              </div>
              <div className="absolute -bottom-1 -left-1 w-3 h-3 rounded-full bg-emerald-400 border-2 border-white" />
            </div>
            <div className="hidden md:flex flex-col leading-tight">
              <span className="font-black text-[15px] text-slate-800">ابن تيمية الثانوية</span>
              <span className="text-[10px] text-slate-400 font-bold tracking-wide">Ibn Taymiyyah School</span>
            </div>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden lg:flex items-center gap-0.5 flex-1 justify-center">
            {PRIMARY_NAV.map(({ to, icon, label }) => {
              const active = isActive(to);
              return (
                <Link key={to} to={to}
                  className={`relative flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-bold transition-all ${
                    active
                      ? "text-qatar-maroon"
                      : "text-slate-500 hover:text-qatar-maroon hover:bg-slate-50"
                  }`}
                >
                  {icon}{label}
                  {active && <span className="absolute bottom-0 right-3 left-3 h-0.5 rounded-full bg-qatar-maroon"/>}
                </Link>
              );
            })}

            {/* More dropdown */}
            <div ref={moreRef} className="relative">
              <button onClick={() => setMoreOpen(v => !v)}
                className={`flex items-center gap-1 px-3.5 py-2 rounded-xl text-sm font-bold transition-all ${
                  moreActive ? "text-qatar-maroon" : "text-slate-500 hover:text-qatar-maroon hover:bg-slate-50"
                }`}>
                <MoreHorizontal className="w-4 h-4"/>
                المزيد
                <ChevronDown className={`w-3 h-3 transition-transform ${moreOpen ? "rotate-180" : ""}`}/>
              </button>
              {moreOpen && (
                <div className="absolute top-full left-0 mt-2 w-56 bg-white rounded-2xl shadow-2xl shadow-slate-300/40 border border-slate-100 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="p-2">
                    {SECONDARY_NAV.map(({ to, icon, label }) => {
                      const active = isActive(to);
                      return (
                        <Link key={to} to={to} onClick={() => setMoreOpen(false)}
                          className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-colors ${
                            active ? "bg-rose-50 text-qatar-maroon" : "text-slate-600 hover:bg-slate-50"
                          }`}>
                          <span className={`w-8 h-8 rounded-lg flex items-center justify-center ${active ? "bg-qatar-maroon text-white" : "bg-slate-100 text-slate-500"}`}>
                            {icon}
                          </span>
                          {label}
                        </Link>
                      );
                    })}
                  </div>
                  {isAdminAuthed && (
                    <>
                      <div className="border-t border-slate-100 mx-2"/>
                      <div className="p-2">
                        <p className="text-[10px] font-black text-slate-400 px-3 py-1">الإدارة</p>
                        {ADMIN_NAV.map(({ to, icon, label }) => {
                          const active = isActive(to);
                          return (
                            <Link key={to} to={to} onClick={() => setMoreOpen(false)}
                              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-colors ${
                                active ? "bg-rose-50 text-qatar-maroon" : "text-slate-600 hover:bg-slate-50"
                              }`}>
                              <span className={`w-8 h-8 rounded-lg flex items-center justify-center ${active ? "bg-qatar-maroon text-white" : "bg-slate-100 text-slate-500"}`}>
                                {icon}
                              </span>
                              {label}
                            </Link>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* User pill */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {isAdminAuthed ? (
              <button onClick={handleLogout}
                className="hidden sm:flex items-center gap-2 pr-1 pl-3 py-1 rounded-full bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-qatar-maroon transition-colors group">
                <div className="w-7 h-7 rounded-full flex items-center justify-center font-black text-[10px] text-white"
                     style={{ background: "linear-gradient(135deg,#5C1A1B,#7A2425)" }}>AD</div>
                <span className="text-xs font-black">Admin</span>
                <LogOut className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity"/>
              </button>
            ) : (
              <div className="hidden sm:flex items-center gap-2 pr-1 pl-3 py-1 rounded-full bg-slate-100">
                <div className="w-7 h-7 rounded-full bg-slate-300 flex items-center justify-center font-black text-[10px] text-white">G</div>
                <span className="text-xs font-bold text-slate-600">زائر</span>
              </div>
            )}
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
  const isSecondaryActive = SECONDARY_NAV.some(n => isActive(n.to));

  return (
    <>
      {showAdminDrawer && (
        <div className="lg:hidden fixed inset-0 z-40" dir="rtl">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-md" onClick={() => setShowAdminDrawer(false)} />
          <div className="absolute bottom-20 right-3 left-3 bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl shadow-slate-900/30 border border-white/60 overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <span className="font-black text-slate-700">القائمة الكاملة</span>
              <button onClick={() => setShowAdminDrawer(false)} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center hover:bg-slate-200">
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>
            <div className="p-3">
              <p className="text-[10px] font-black text-slate-400 px-3 py-1.5">الميزات</p>
              <div className="grid grid-cols-2 gap-2">
                {SECONDARY_NAV.map(({ to, icon, label }) => {
                  const active = isActive(to);
                  return (
                    <Link key={to} to={to} onClick={() => setShowAdminDrawer(false)}
                      className={`flex flex-col items-start gap-1.5 px-3 py-3 rounded-2xl font-bold text-xs transition-colors ${
                        active ? "bg-rose-50 text-qatar-maroon" : "bg-slate-50 text-slate-600"
                      }`}>
                      <span className={`w-9 h-9 rounded-xl flex items-center justify-center ${active ? "bg-qatar-maroon text-white" : "bg-white text-slate-500"}`}>
                        {icon}
                      </span>
                      {label}
                    </Link>
                  );
                })}
              </div>
            </div>
            {isAdminAuthed && (
              <>
                <div className="border-t border-slate-100 mx-3"/>
                <div className="p-3">
                  <p className="text-[10px] font-black text-slate-400 px-3 py-1.5">الإدارة</p>
                  <div className="space-y-1.5">
                    {ADMIN_NAV.map(({ to, icon, label }) => (
                      <Link key={to} to={to} onClick={() => setShowAdminDrawer(false)}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-2xl font-bold text-sm transition-colors ${
                          isActive(to) ? "bg-qatar-maroon text-white" : "bg-slate-50 text-slate-700"
                        }`}>
                        <span className={`w-9 h-9 rounded-xl flex items-center justify-center ${isActive(to) ? "bg-white/20" : "bg-white"}`}>
                          {icon}
                        </span>
                        {label}
                      </Link>
                    ))}
                    <button onClick={handleLogout}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl font-bold text-sm text-rose-600 bg-rose-50 hover:bg-rose-100 transition-colors">
                      <span className="w-9 h-9 rounded-xl bg-white flex items-center justify-center">
                        <LogOut className="w-4 h-4"/>
                      </span>
                      تسجيل الخروج
                    </button>
                  </div>
                </div>
              </>
            )}
            <div className="pb-2" />
          </div>
        </div>
      )}

      <nav className="lg:hidden fixed bottom-3 right-3 left-3 z-30" dir="rtl">
        <div className="bg-white/90 backdrop-blur-xl rounded-3xl shadow-2xl shadow-slate-900/15 border border-white/60"
             style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
          <div className="flex items-stretch h-14 px-1">
            {PRIMARY_NAV.map(({ to, icon, label }) => {
              const active = isActive(to);
              return (
                <Link key={to} to={to}
                  className="flex-1 flex flex-col items-center justify-center relative">
                  <div className={`flex flex-col items-center justify-center gap-0.5 px-3 py-1.5 rounded-2xl transition-all ${
                    active ? "text-white" : "text-slate-400"
                  }`}
                    style={active ? { background: "linear-gradient(135deg,#5C1A1B,#7A2425)" } : {}}>
                    <span className={`transition-transform ${active ? "scale-110" : ""}`}>{icon}</span>
                    <span className="text-[8.5px] font-black">{label}</span>
                  </div>
                </Link>
              );
            })}
            <button onClick={() => setShowAdminDrawer(v => !v)}
              className="flex-1 flex flex-col items-center justify-center relative">
              <div className={`flex flex-col items-center justify-center gap-0.5 px-3 py-1.5 rounded-2xl transition-all ${
                showAdminDrawer || isSecondaryActive || isAdminRouteActive ? "text-white" : "text-slate-400"
              }`}
                style={showAdminDrawer || isSecondaryActive || isAdminRouteActive ? { background: "linear-gradient(135deg,#5C1A1B,#7A2425)" } : {}}>
                <MoreHorizontal className={`w-5 h-5 transition-transform ${showAdminDrawer ? "scale-110" : ""}`}/>
                <span className="text-[8.5px] font-black">المزيد</span>
              </div>
              {isAdminAuthed && !showAdminDrawer && (
                <span className="absolute top-1 left-1/2 translate-x-2 w-2 h-2 bg-emerald-400 rounded-full border-2 border-white" />
              )}
            </button>
          </div>
        </div>
      </nav>
    </>
  );
}

export default App;
