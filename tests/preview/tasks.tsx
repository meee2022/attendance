import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import TeacherTasks, { TeacherTasksAdmin } from "../../src/pages/TeacherTasks";
import "../../src/index.css";
const params = new URLSearchParams(location.search);
createRoot(document.getElementById("root")!).render(<BrowserRouter><div dir="rtl" className="p-4"><p className="p-3 mb-4 bg-amber-50 text-amber-900">معاينة اختبار — بيانات وروابط تجريبية</p>{params.has("mobile") ? <iframe title="معاينة الجوال" src="/tests/preview/tasks.html?as=teacher" style={{width:390,height:1000,border:0}}/> : params.has("admin") ? <TeacherTasksAdmin/> : <TeacherTasks/>}</div></BrowserRouter>);
