// @ts-nocheck
import { useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useSearchParams } from "react-router-dom";
import { Upload, Printer, ArrowRight, Trash2, RefreshCw } from "lucide-react";
import { useQuery, useMutation, usePlatformSession } from "../lib/platformSession";
import { api } from "../../convex/_generated/api";
import { buildSurvey, refreshSurvey, analyze, filterable, analyzeColumn, TYPES } from "../lib/surveyAnalysis";
import "./surveyAnalysis.css";
export default function SurveyAnalysisPage() {
  const session = usePlatformSession();
  return ["admin", "deputy"].includes(session?.role) ? <ConnectedAnalysis/> : <p className="p-8 text-center">تحليل ملفات الاستبانات متاح لمسؤول المنصة والنائب فقط.</p>;
}
function ConnectedAnalysis() {
  const [params, setParams] = useSearchParams();
  const id = params.get("id");
  const list = useQuery(api.surveyAnalyses.list);
  const row = useQuery(api.surveyAnalyses.get, id ? { id } : "skip");
  const save = useMutation(api.surveyAnalyses.save), remove = useMutation(api.surveyAnalyses.remove);
  return <SurveyWorkspace list={list} row={row} id={id} onOpen={id => setParams(id ? {id} : {})} onSave={save} onRemove={remove}/>;
}
export function SurveyWorkspace({ list, row, id, onOpen, onSave, onRemove }) {
  const [draft, setDraft] = useState(null), [busy,setBusy] = useState(false), [message,setMessage] = useState("");
  const input = useRef(null), target = useRef(null);
  const saved = row ? JSON.parse(row.data) : null;
  async function upload(e) {
    const file = e.target.files?.[0]; e.target.value = "";
    if (!file) return;
    setBusy(true); setMessage("");
    try {
      const table = await readTable(file);
      let fresh = buildSurvey(table,file.name);
      const old = target.current;
      if (old) fresh = refreshSurvey(JSON.parse(old.data),fresh);
      // Review before sending any imported answers to the server.
      setDraft({ survey:fresh, previous:old });
    } catch(e) { setMessage(e.message || "تعذّر قراءة الملف. راجع العناوين والردود."); }
    finally { setBusy(false); target.current=null; }
  }
  async function persist(survey, previous) {
    setBusy(true); setMessage("");
    try {
      const nextId = await onSave({ data:JSON.stringify(survey), ...(previous ? {id:previous._id,expectedUpdatedAt:previous.updatedAt} : {}) });
      setDraft(null); onOpen(nextId); setMessage("تم حفظ التحليل.");
    } catch(e) { setMessage(e.data || e.message || "تعذّر الحفظ. أعد المحاولة."); }
    finally { setBusy(false); }
  }
  const pick = previous => { target.current=previous; input.current?.click(); };
  return <div className="survey-analysis" dir="rtl">
    <input ref={input} type="file" accept=".xlsx,.xls,.csv" hidden onChange={upload} aria-label="ملف ردود الاستبانة"/>
    <Link className="text-button" to="/surveys"><ArrowRight size={16} aria-hidden="true"/> الاستبانات</Link>
    <header className="page-heading"><div><h1>تحليل الاستبانات</h1><p>ارفع ملف الردود من Microsoft Forms أو Excel، وراجع الأسئلة قبل حفظ التحليل.</p></div><button className="button primary" disabled={busy} onClick={()=>pick(null)}><Upload size={17} aria-hidden="true"/> {busy ? "جارٍ المعالجة…" : "استيراد ملف ردود"}</button></header>
    {message && <p role="status" className="sv-message">{String(message)}</p>}
    {draft ? <SurveyDetail key={draft.survey.id} survey={draft.survey} review busy={busy} onSave={s=>persist(s,draft.previous)} onCancel={()=>setDraft(null)}/>
      : id ? row === undefined ? <p role="status">جارٍ تحميل التحليل…</p> : saved && <><button className="text-button" onClick={()=>onOpen(null)}>كل التحليلات</button><SurveyDetail key={row._id+row.updatedAt} survey={saved} busy={busy} onSave={s=>persist(s,row)} onRefresh={()=>pick(row)}/></>
      : list === undefined ? <p role="status">جارٍ تحميل الاستبانات…</p> : list.length ? <div className="sv-library">{list.map(s=><article key={s._id}><div><h2><button className="text-button" onClick={()=>onOpen(s._id)}>{s.title}</button></h2><p>{s.responseCount} رد · {s.questionCount} سؤال · تحديث {day(new Date(s.updatedAt).toISOString())}</p></div><button className="button subtle" disabled={busy} onClick={async()=>{if(!window.confirm(`حذف تحليل «${s.title}»؟ لا يمكن التراجع.`))return;setBusy(true);try{await onRemove({id:s._id});}catch(e){setMessage(e.data||e.message);}finally{setBusy(false);}}} aria-label={`حذف ${s.title}`}><Trash2 size={16} aria-hidden="true"/></button></article>)}</div>
      : <section className="panel sv-empty"><h2>ابدأ بملف الردود</h2><p>في Microsoft Forms، افتح الردود واختر «فتح في Excel»، ثم نزّل الملف وارفعه هنا. يدعم Excel وCSV حتى 5000 رد.</p><button className="button primary" disabled={busy} onClick={()=>pick(null)}>استيراد أول استبانة</button></section>}
  </div>;
}
function SurveyDetail({survey,review,busy,onSave,onCancel,onRefresh}) {
  const [editing,setEditing] = useState(review), [current,setCurrent] = useState(survey), [filter,setFilter] = useState({column:-1,value:""});
  const [print,setPrint] = useState(false);
  const [pdfBusy,setPdfBusy] = useState(false), [pdfError,setPdfError] = useState("");
  const downloadPdf = async () => {
    setPdfBusy(true);setPdfError("");
    try {
      const {createSurveyPdf}=await import("../lib/surveyPdf");
      const blob=await createSurveyPdf(<Report survey={current} result={result} filterLabel={filterLabel} print/>);
      const url=URL.createObjectURL(blob), a=document.createElement("a");
      a.href=url;a.download=`${current.title}.pdf`.replace(/[<>:"/\\|?*]/g,"-");a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);
    }catch(e){setPdfError(e.message||"تعذّر إنشاء التقرير؛ أعد المحاولة.");}finally{setPdfBusy(false);}
  };
  const result = useMemo(()=>analyze(current,filter),[current,filter]);
  const options=filterable(current), col=current.columns[filter.column];
  const values=col ? analyzeColumn(col,current.rows.map(r=>r[filter.column])).items?.map(x=>x.label) ?? [] : [];
  const filterLabel=filter.value && col ? `${col.name}: ${filter.value}` : "";
  // columns nobody answered: the form's other branches, nothing to set
  const unanswered=i=>current.columns[i].type==="skip"&&current.rows.every(r=>!r[i]);
  const empty=current.columns.filter((_,i)=>unanswered(i)).length;
  function configure(i,type) {
    setCurrent(s=>({...s,columns:s.columns.map((c,j)=>j===i?{...c,type}:c)})); setFilter({column:-1,value:""});
  }
  return <div className="sv-view">
    {pdfError && <p role="alert">{pdfError}</p>}
    <header className="page-heading"><div><h2>{review ? "مراجعة الاستيراد" : survey.title}</h2><p>{survey.fileName} · {survey.rows.length} رد</p></div><div className="heading-actions">{!review && <><button className="button subtle" disabled={busy||editing} onClick={onRefresh}><RefreshCw size={16} aria-hidden="true"/> تحديث بملف أحدث</button><button className="button subtle" onClick={()=>setEditing(!editing)}>{editing ? "إغلاق الإعدادات" : "تعديل التحليل"}</button><button className="button primary" disabled={pdfBusy} onClick={downloadPdf}><Printer size={16} aria-hidden="true"/> {pdfBusy ? "جارٍ تجهيز PDF…" : "تنزيل تقرير PDF"}</button></>}</div></header>
    {editing && <section className="panel sv-setup"><label className="field-label">عنوان الاستبانة<input name="survey-title" autoComplete="off" maxLength={160} value={current.title} onChange={e=>setCurrent(s=>({...s,title:e.target.value}))}/></label><p className="muted">راجع نوع كل سؤال. «لا يُحلّل» يخفيه من التقرير؛ «استبعاد من الحفظ» يحذف بياناته قبل رفعها.</p>{current.columns.map((c,i)=>c.type==="rating"||unanswered(i)?null:<label key={i}><span>{c.name}</span><select aria-label={`نوع السؤال ${c.name}`} value={c.type} onChange={e=>configure(i,e.target.value)}>{Object.entries(TYPES).map(([k,label])=><option value={k} key={k}>{label}</option>)}<option value="exclude">استبعاد من الحفظ</option></select></label>)}{empty>0 && <p className="muted">أُخفي {empty} من الأعمدة لم يُجب عنها أحد (فروع أخرى من النموذج).</p>}{result.ratings && <RatingSetup survey={current} ratings={result.ratings} onChange={setCurrent}/>}{current.hidden?.length>0 && <p className="muted">استُبعدت بيانات التواصل تلقائيًا: {current.hidden.join("، ")}</p>}<div className="heading-actions"><button className="button primary" disabled={busy||!current.title.trim()||current.columns.every(c=>c.type==="exclude")} onClick={()=>{const kept=current.columns.map((c,i)=>({c,i})).filter(x=>x.c.type!=="exclude");onSave({...current,columns:kept.map(x=>x.c),rows:current.rows.map(r=>kept.map(x=>r[x.i]))});}}>{busy?"جارٍ الحفظ…":review?"حفظ الاستبانة وتحليلها":"حفظ التعديلات"}</button>{review && <button className="button subtle" disabled={busy} onClick={onCancel}>إلغاء الاستيراد</button>}</div></section>}
    <div className="sv-controls"><label className="field-label">فرز الردود حسب<select value={filter.column} onChange={e=>setFilter({column:Number(e.target.value),value:""})}><option value={-1}>كل الردود</option>{options.map(c=><option key={c.i} value={c.i}>{c.name}</option>)}</select></label>{col && <label className="field-label">القيمة<select value={filter.value} onChange={e=>setFilter({...filter,value:e.target.value})}><option value="">الكل</option>{values.map(v=><option key={v}>{v}</option>)}</select></label>}</div>
    <Report survey={current} result={result} filterLabel={filterLabel}/>
    {print && createPortal(<div className="sv-print-root survey-analysis"><Report survey={current} result={result} filterLabel={filterLabel} print/></div>,document.body)}
  </div>;
}
// The Forms export keeps the subjects of a rating grid but not the wording of
// its questions: it is typed here once, and kept with the analysis
function RatingSetup({ survey, ratings, onChange }) {
  const count = survey.columns.filter((c) => c.type === 'rating').length;
  const setStatement = (k, text) =>
    onChange((s) => ({ ...s, statements: ratings.statements.map((x, j) => (j === k ? text : s.statements?.[j] ?? '')) }));
  return (
    <div className="sv-rating-setup">
      <p className="muted">
        أسئلة التقييم ({count} عمودًا · {ratings.subjects.length} مادة · مقياس من 1 إلى {ratings.max}) تُحلَّل معًا في جدول
        واحد. ملف Forms لا يحفظ نص هذه الأسئلة؛ اكتب نص كل بند كما في النموذج ليظهر في التقرير.
      </p>
      {ratings.statements.map((st, k) => (
        <label key={k}>
          <span>البند {k + 1}</span>
          <input name={`statement-${k}`} autoComplete="off" maxLength={500} placeholder={`نص البند ${k + 1}`}
            value={survey.statements?.[k] ?? ''} onChange={(e) => setStatement(k, e.target.value)} />
        </label>
      ))}
    </div>
  );
}

const TOP = 8;
const one = (x) => (x === null || x === undefined ? '—' : x.toFixed(2));
// a mean as a share of the scale: strong, fair, weak — the cell's background
const tone = (m, max) => (m === null ? '' : m / max >= 0.85 ? 'good' : m / max >= 0.7 ? '' : m / max >= 0.55 ? 'fair' : 'weak');

function Ratings({ r }) {
  const best = r.subjects[0], worst = r.subjects.at(-1);
  return (
    <>
      <section className="panel sv-q">
        <header>
          <div>
            <h3>تقييم المواد</h3>
            <small>
              متوسط كل مادة من {r.max} على جميع البنود · المتوسط العام <b>{one(r.mean)}</b>
              {r.subjects.length > 1 && <> · الأعلى: {best.name} ({one(best.mean)}) · الأدنى: {worst.name} ({one(worst.mean)})</>}
            </small>
          </div>
        </header>
        <div className="sv-bars" role="list">
          {r.subjects.map((s) => (
            <div className="sv-bar" role="listitem" key={s.name} title={`${s.name}: ${one(s.mean)} من ${r.max}`}>
              <span className="sv-bar-label">{s.name}</span>
              <span className="sv-bar-track"><i className={tone(s.mean, r.max)} style={{ width: `${(s.mean / r.max) * 100}%` }} /></span>
              <span className="sv-bar-value"><b>{one(s.mean)}</b> <small>من {r.max}</small></span>
            </div>
          ))}
        </div>
      </section>
      <section className="panel sv-q">
        <header>
          <div>
            <h3>المواد حسب البنود</h3>
            <small>متوسط كل بند لكل مادة · «الدرجة {r.max}» نسبة من اختاروا أعلى تقدير</small>
          </div>
        </header>
        <div className="sv-grid-wrap">
          <table className="sv-grid">
            <thead>
              <tr>
                <th>المادة</th>
                {r.statements.map((st, k) => <th key={k} title={st.label}>{r.statements.some((x) => !/^البند \d+$/.test(x.label)) ? k + 1 : st.label}</th>)}
                <th>المتوسط</th>
                <th>الدرجة {r.max}</th>
                <th>المقيّمون</th>
              </tr>
            </thead>
            <tbody>
              {r.subjects.map((s) => (
                <tr key={s.name}>
                  <th>{s.name}</th>
                  {s.per.map((m, k) => <td key={k} className={tone(m, r.max)}>{one(m)}</td>)}
                  <td className={`sv-grid-mean ${tone(s.mean, r.max)}`}>{one(s.mean)}</td>
                  <td>{Math.round(s.top * 100)}%</td>
                  <td>{s.raters}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th>كل المواد</th>
                {r.statements.map((st, k) => <td key={k} className={tone(st.mean, r.max)}>{one(st.mean)}</td>)}
                <td className={`sv-grid-mean ${tone(r.mean, r.max)}`}>{one(r.mean)}</td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>
        {r.statements.some((x) => !/^البند \d+$/.test(x.label)) && (
          <ol className="sv-statements">{r.statements.map((st, k) => <li key={k}><b>{k + 1}</b> {st.label}</li>)}</ol>
        )}
      </section>
    </>
  );
}
const pct = (n, of) => (of ? Math.round((n / of) * 100) : 0);
const day = (iso) =>
  iso
    ? new Date(iso).toLocaleDateString('ar-QA-u-nu-latn', { day: 'numeric', month: 'long', year: 'numeric' })
    : '—';

async function readTable(file) {
  if (file.size > 8 * 1024 * 1024) throw Error('الملف أكبر من 8 ميجابايت.');
  if (!/\.(xlsx|xls|csv)$/i.test(file.name)) throw Error('اختاري ملف Excel (‎.xlsx) كما يُنزَّل من النماذج.');
  const XLSX = await import('xlsx');
  const wb = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true, codepage: 65001 });
  return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true, defval: '' });
}

// أعمدة أفقية: فئة لكل سطر، مرتبة تنازليًا، ولون واحد لأن السلسلة واحدة
function Bars({ items, of }) {
  // بند «إجابات أخرى» مجموع فئات صغيرة: لا يدخل في مقياس الأعمدة ويُرسم بلون محايد
  const max = Math.max(...items.filter((x) => !x.other).map((x) => x.count), 1);
  return (
    <div className="sv-bars" role="list">
      {items.map((x) => (
        <div
          className={x.other ? 'sv-bar other' : 'sv-bar'}
          role="listitem"
          key={x.label}
          title={`${x.label}: ${x.count} (${pct(x.count, of)}%)`}
        >
          <span className="sv-bar-label">{x.label}</span>
          <span className="sv-bar-track">
            <i style={{ width: `${Math.min(100, (x.count / max) * 100)}%` }} />
          </span>
          <span className="sv-bar-value">
            <b>{x.count}</b> {!x.noPct && <small>{pct(x.count, of)}%</small>}
          </span>
        </div>
      ))}
    </div>
  );
}

function Question({ q, print }) {
  const [all, setAll] = useState(false),
    [table, setTable] = useState(false);
  const note = `${q.answered} من ${q.total} أجابوا`;
  if (q.items) {
    const rest = q.items.slice(TOP),
      shown =
        all || print || q.type === 'grade' || q.items.length <= TOP + 1
          ? q.items
          : [
              ...q.items.slice(0, TOP),
              {
                label: `إجابات أخرى (${rest.length})`,
                count: rest.reduce((n, x) => n + x.count, 0),
                other: true,
                noPct: q.type === 'multi',
              },
            ];
    return (
      <section className="panel sv-q">
        <header>
          <div>
            <h3>{q.name}</h3>
            <small>
              {TYPES[q.type]} · {note}
              {q.type === 'multi' && ' · النسبة من عدد المجيبين، وقد يختار المجيب أكثر من إجابة'}
            </small>
          </div>
          {!print && (
            <div className="sv-q-tools">
              {q.items.length > TOP + 1 && q.type !== 'grade' && (
                <button className="text-button" onClick={() => setAll(!all)}>
                  {all ? 'الأكثر تكرارًا فقط' : `كل الإجابات (${q.items.length})`}
                </button>
              )}
              <button className="text-button" onClick={() => setTable(!table)}>
                {table ? 'رسم' : 'جدول'}
              </button>
            </div>
          )}
        </header>
        {table && !print ? (
          <table className="lux-table sv-table">
            <thead>
              <tr>
                <th>الإجابة</th>
                <th>العدد</th>
                <th>النسبة</th>
              </tr>
            </thead>
            <tbody>
              {q.items.map((x) => (
                <tr key={x.label}>
                  <td>{x.label}</td>
                  <td>{x.count}</td>
                  <td>{pct(x.count, q.answered)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <Bars items={shown} of={q.answered} />
        )}
      </section>
    );
  }
  if (q.type === 'name')
    return (
      <section className="panel sv-q">
        <header>
          <div>
            <h3>{q.name}</h3>
            <small>{note}</small>
          </div>
        </header>
        <p className="sv-line">
          <b>{q.distinct}</b> اسمًا مختلفًا
          {q.repeated.length > 0 && (
            <>
              {' '}
              · <b>{q.repeated.length}</b> مكرر: {q.repeated.map((x) => `${x.label} (${x.count})`).join('، ')}
            </>
          )}
        </p>
      </section>
    );
  const list = all || print ? q.answers : q.answers.slice(0, 6);
  return (
    <section className="panel sv-q">
      <header>
        <div>
          <h3>{q.name}</h3>
          <small>
            {TYPES.text} · {q.answers.length} إجابة مكتوبة من {q.total}
          </small>
        </div>
        {!print && q.answers.length > 6 && (
          <button className="text-button" onClick={() => setAll(!all)}>
            {all ? 'عرض أقل' : `كل الإجابات (${q.answers.length})`}
          </button>
        )}
      </header>
      {list.length ? (
        <ul className="sv-answers">
          {list.map((a, i) => (
            <li key={i}>{a}</li>
          ))}
        </ul>
      ) : (
        <p className="muted">لا توجد إجابات مكتوبة.</p>
      )}
    </section>
  );
}

export function Report({ survey, result, filterLabel, print }) {
  const highlights = result.questions
    .filter((q) => q.items?.length && q.answered)
    .map((q) => ({
      name: q.name,
      answered: q.answered,
      top: [...q.items].sort((a, b) => b.count - a.count)[0],
    }));
  return (
    <div className={print ? 'sv-report sv-print' : 'sv-report'} dir="rtl">
      {print && (
        <header className="sv-print-head">
          <h1>{survey.title}</h1>
          <p>
            تحليل الاستبيان · {result.responses} ردًّا{filterLabel && ` · ${filterLabel}`} · من{' '}
            {day(result.from)} إلى {day(result.to)}
          </p>
        </header>
      )}
      <div className="sv-tiles">
        <div>
          <b>{result.responses}</b>
          <span>{filterLabel ? `ردًّا من ${result.total}` : 'عدد الردود'}</span>
        </div>
        <div>
          <b>{result.questions.length + (result.ratings?.statements.length ?? 0)}</b>
          <span>أسئلة محلَّلة</span>
        </div>
        <div>
          <b>{day(result.from)}</b>
          <span>أول رد</span>
        </div>
        <div>
          <b>{day(result.to)}</b>
          <span>آخر رد</span>
        </div>
      </div>
      {highlights.length > 0 && (
        <section className="panel sv-q sv-highlights">
          <header>
            <div>
              <h3>أبرز النتائج</h3>
              <small>الإجابة الأكثر تكرارًا في كل سؤال</small>
            </div>
          </header>
          <ul>
            {highlights.map((h) => (
              <li key={h.name}>
                <span>{h.name}</span>
                <b>{h.top.label}</b>
                <small>
                  {h.top.count} · {pct(h.top.count, h.answered)}%
                </small>
              </li>
            ))}
          </ul>
        </section>
      )}
      {result.days.length > 1 && (
        <section className="panel sv-q">
          <header>
            <div>
              <h3>الردود حسب اليوم</h3>
              <small>بتوقيت قطر</small>
            </div>
          </header>
          <div className="sv-days" role="img" aria-label="عدد الردود في كل يوم">
            {result.days.map((d) => (
              <div key={d.label} title={`${d.label}: ${d.count}`}>
                <b>{d.count}</b>
                <i style={{ height: `${(d.count / Math.max(...result.days.map((x) => x.count))) * 100}%` }} />
                <small>{d.label.slice(5).split('-').reverse().join('/')}</small>
              </div>
            ))}
          </div>
        </section>
      )}
      {result.ratings && <Ratings r={result.ratings} />}
      {result.questions.map((q) => (
        <Question key={q.name} q={q} print={print} />
      ))}
    </div>
  );
}

