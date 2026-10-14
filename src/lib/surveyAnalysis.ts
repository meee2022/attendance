// @ts-nocheck
// Adapted from the read-only Nora reference; no reference project files are modified.
// تحليل ملفات الاستبيانات (تصدير Microsoft Forms وما يشبهه): قراءة الأعمدة، تخمين نوع كل سؤال، وتجميع الإجابات.

export const clean = (v) =>
  String(v ?? '')
    .replace(/[ ​-‏]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

// مفتاح تجميع يوحّد صور الكتابة: «سودانيه / سودانية»، «الأول / الاول»
export const keyOf = (v) =>
  clean(v)
    .replace(/[ً-ٰٟـ]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة(?=\s|$)/g, 'ه')
    .replace(/[.،؛;:!؟?]+$/g, '')
    .trim()
    .toLowerCase();

const SYSTEM = [
  'id',
  'وقت البدء',
  'وقت الإكمال',
  'وقت الاكمال',
  'البريد الإلكتروني',
  'البريد الالكتروني',
  'الاسم',
  'وقت آخر تعديل',
  'start time',
  'completion time',
  'email',
  'name',
  'last modified time',
];
const TIME = ['وقت الإكمال', 'وقت الاكمال', 'completion time', 'وقت البدء', 'start time'];
const ORDINALS = [
  ['حادي عشر', 11],
  ['ثاني عشر', 12],
  ['اول', 1],
  ['ثاني', 2],
  ['ثالث', 3],
  ['رابع', 4],
  ['خامس', 5],
  ['سادس', 6],
  ['سابع', 7],
  ['ثامن', 8],
  ['تاسع', 9],
  ['عاشر', 10],
];
const GRADE_NAMES = [
  '',
  'الأول',
  'الثاني',
  'الثالث',
  'الرابع',
  'الخامس',
  'السادس',
  'السابع',
  'الثامن',
  'التاسع',
  'العاشر',
  'الحادي عشر',
  'الثاني عشر',
];
const digits = (s) => s.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));

// «السادس 2»، «6/2»، «الصف الاول ب» → 6 أو 1
export function gradeOf(value) {
  const k = digits(keyOf(value));
  const word = ORDINALS.find(([w]) => k.includes(w));
  if (word) return word[1];
  const n = Number((k.match(/\d{1,2}/) || [])[0]);
  return n >= 1 && n <= 12 ? n : 0;
}
export const gradeLabel = (n) => (n ? 'الصف ' + GRADE_NAMES[n] : 'غير محدد');

const EMPTY_ANSWERS = [
  'لا',
  'لا يوجد',
  'لايوجد',
  'لا شيء',
  'لا شي',
  '-',
  '.',
  'لا يوجد مقترحات',
  'نعم',
  'none',
  'no',
];

export const TYPES = {
  choice: 'اختيار واحد',
  multi: 'اختيار متعدد',
  grade: 'الصف',
  class: 'الفصل / الشعبة',
  text: 'إجابة مفتوحة',
  name: 'اسم',
  skip: 'لا يُحلَّل',
};

// يخمّن نوع السؤال من عنوانه وإجاباته
export function guessType(header, values) {
  const h = keyOf(header),
    filled = values.map(clean).filter(Boolean),
    n = filled.length;
  if (SYSTEM.map(keyOf).includes(h)) return 'meta';
  if (/بريد|ايميل|email|هاتف|جوال|mobile|phone|رقم شخصي|الرقم الشخصي|national.?id/.test(h)) return 'private';
  if (!n) return 'skip';
  if (/مقترح|اقتراح|تعليق|ملاحظ|comment|suggestion/.test(h)) return 'text';
  // أرقام الجوال وما يشبهها بيانات تواصل: لا تُحلَّل ولا تُخزَّن
  if (filled.filter((v) => /^\+?[\d٠-٩\s-]{7,}$/.test(v)).length >= n * 0.8) return 'private';
  if (filled.filter((v) => /[;؛]/.test(v)).length >= n * 0.2) return 'multi';
  if (/الصف|grade/.test(h) && filled.filter((v) => gradeOf(v)).length >= n * 0.6) return filled.some(v => /\d+\s*[/\-]\s*\d+/.test(digits(v))) ? 'class' : 'grade';
  const distinct = new Set(filled.map(keyOf)).size;
  if (/^(ال)?اسم /.test(h + ' ') && distinct > n * 0.5) return 'name';
  // إجابات تتكرر بين المجيبين = اختيار؛ إجابة مختلفة لكل مجيب = نص مفتوح
  if (distinct <= Math.max(8, n * 0.3) && distinct <= n * 0.7) return 'choice';
  return 'text';
}

// يحوّل جدول الملف (صف العناوين ثم الردود) إلى استبيان يُخزَّن
export function buildSurvey(table, fileName) {
  const [head = [], ...body] = table;
  const rows = body.filter((r) => r.some((c) => clean(c)));
  if (head.length > 300) throw Error('الملف يتجاوز 300 عمودًا.');
  if (!head.length || !rows.length) throw Error('الملف لا يحتوي عناوين أسئلة وردودًا.');
  if (rows.length > 5000) throw Error('الملف يتجاوز 5000 رد.');
  const all = head.map((name, i) => ({
    name: clean(name) || `عمود ${i + 1}`,
    type: guessType(
      name,
      rows.map((r) => r[i]),
    ),
    i,
  }));
  const timeCol =
    all.find((c) => TIME.slice(0, 3).includes(clean(c.name).toLowerCase())) ||
    all.find((c) => TIME.includes(clean(c.name).toLowerCase()));
  const kept = all.filter((c) => !['meta', 'private'].includes(c.type));
  if (!kept.length) throw Error('لم نجد أسئلة قابلة للتحليل في الملف.');
  const stamp = (v) => {
    if (v instanceof Date) return v.toISOString();
    const d = Date.parse(clean(v));
    return Number.isFinite(d) ? new Date(d).toISOString() : '';
  };
  return {
    id: crypto.randomUUID(),
    title: clean(fileName)
      .replace(/\.(xlsx|xls|csv)$/i, '')
      .replace(/\s*\(\d+-\d+\)\s*$/, ''),
    fileName: clean(fileName),
    uploaded: new Date().toISOString(),
    hidden: all.filter((c) => c.type === 'private').map((c) => c.name),
    columns: kept.map(({ name, type }) => ({ name, type })),
    rows: rows.map((r) => kept.map((c) => clean(r[c.i]))),
    times: timeCol ? rows.map((r) => stamp(r[timeCol.i])) : [],
  };
}

// تحديث استبيان بملف أحدث من النموذج نفسه مع إبقاء اختيارات المنسقة لأنواع الأسئلة
export function refreshSurvey(old, fresh) {
  if (old.columns.length !== fresh.columns.length || old.columns.some(c => !fresh.columns.some(n => keyOf(n.name) === keyOf(c.name)))) throw Error('أسئلة الملف مختلفة. ارفعه كاستبانة جديدة بدل تحديث هذا التحليل.');
  const types = new Map(old.columns.map((c) => [keyOf(c.name), c.type]));
  return {
    ...fresh,
    id: old.id,
    title: old.title,
    columns: fresh.columns.map((c) => ({ ...c, type: types.get(keyOf(c.name)) || c.type })),
  };
}

const tally = (items) => {
  const groups = new Map();
  for (const raw of items) {
    const k = keyOf(raw);
    if (!k) continue;
    const g = groups.get(k) || { count: 0, forms: new Map() };
    g.count++;
    g.forms.set(raw, (g.forms.get(raw) || 0) + 1);
    groups.set(k, g);
  }
  return [...groups.values()]
    .map((g) => ({
      // تُعرض الصورة المنتهية بتاء مربوطة إن وُجدت («سودانية» لا «سودانيه»)، وإلا فأكثر الصور تكرارًا
      label: [...g.forms].sort(
        (a, b) => (b[0].endsWith('ة') ? 1 : 0) - (a[0].endsWith('ة') ? 1 : 0) || b[1] - a[1],
      )[0][0],
      count: g.count,
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'ar'));
};

// تحليل سؤال واحد على مجموعة ردود
export function analyzeColumn(column, values) {
  const filled = values.map(clean).filter(Boolean),
    answered = filled.length;
  const base = { name: column.name, type: column.type, answered, total: values.length };
  if (column.type === 'grade') {
    const counts = new Map();
    for (const v of filled) counts.set(gradeOf(v), (counts.get(gradeOf(v)) || 0) + 1);
    return {
      ...base,
      items: [...counts]
        .sort((a, b) => (a[0] || 99) - (b[0] || 99))
        .map(([g, count]) => ({ label: gradeLabel(g), count })),
    };
  }
  if (column.type === 'multi')
    return {
      ...base,
      // الطالبة الواحدة قد تختار أكثر من إجابة؛ النسبة من عدد المجيبات
      items: tally(filled.flatMap((v) => [...new Set(v.split(/[;؛]/).map(clean).filter(Boolean))])),
    };
  if (column.type === 'choice' || column.type === 'class') return { ...base, items: tally(filled) };
  if (column.type === 'name') {
    const names = tally(filled);
    return { ...base, distinct: names.length, repeated: names.filter((x) => x.count > 1) };
  }
  if (column.type === 'text')
    return { ...base, answers: filled.filter((v) => !EMPTY_ANSWERS.includes(keyOf(v))) };
  return base;
}

// أعمدة تصلح للفرز بها (الصف، الجنسية، نعم/لا…)
export const filterable = (survey) =>
  survey.columns.map((c, i) => ({ ...c, i })).filter((c) => ['grade', 'class', 'choice'].includes(c.type));

export const matches = (survey, filter) => (row) => {
  if (!filter?.value) return true;
  const c = survey.columns[filter.column];
  if (!c) return true;
  const v = row[filter.column];
  return c.type === 'grade' ? gradeLabel(gradeOf(v)) === filter.value : keyOf(v) === keyOf(filter.value);
};

export function analyze(survey, filter) {
  const keep = survey.rows.map(matches(survey, filter));
  const rows = survey.rows.filter((_, i) => keep[i]);
  const times = (survey.times || []).filter((t, i) => keep[i] && t).sort();
  const perDay = new Map();
  for (const t of times) {
    const day = new Date(t).toLocaleDateString('en-CA', { timeZone: 'Asia/Qatar' });
    perDay.set(day, (perDay.get(day) || 0) + 1);
  }
  return {
    responses: rows.length,
    total: survey.rows.length,
    from: times[0] || '',
    to: times.at(-1) || '',
    days: [...perDay].map(([label, count]) => ({ label, count })),
    questions: survey.columns
      .map((c, i) =>
        analyzeColumn(
          c,
          rows.map((r) => r[i]),
        ),
      )
      .filter((q) => q.type !== 'skip' && q.type !== 'exclude'),
  };
}

export const surveysOf = (data) => data.surveys || [];
export const validateSurveys = (list) =>
  list === undefined ||
  (Array.isArray(list) &&
    list.every(
      (s) =>
        s &&
        typeof s.id === 'string' &&
        typeof s.title === 'string' &&
        Array.isArray(s.columns) &&
        Array.isArray(s.rows) &&
        s.rows.every((r) => Array.isArray(r) && r.length === s.columns.length),
    ));
