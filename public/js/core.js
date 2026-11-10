/* ============================================================
   A-140 · CORE — state, routing, dashboard, networks, persons
   ============================================================ */

/* ---------------- tiny utilities ---------------- */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = (p = 'ID') => p + '-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase();
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const pad2 = n => String(n).padStart(2, '0');
const val = (sel, scope = document) => (scope.querySelector(sel)?.value ?? '').trim();

const fmtDate = (v) => {
  if (!v) return '—';
  const d = new Date(v);
  if (isNaN(d.getTime())) return String(v);
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
};
const fmtTime = (v) => {
  if (!v) return '—';
  const d = new Date(v);
  if (isNaN(d.getTime())) return '—';
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
};
const fmtDateTime = (v) => `${fmtDate(v)} · ${fmtTime(v)}`;

function timeAgo(ts) {
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'الآن';
  if (m < 60) return `قبل ${m} دقيقة`;
  const h = Math.floor(m / 60);
  if (h < 24) return `قبل ${h} ساعة`;
  const d = Math.floor(h / 24);
  if (d < 30) return `قبل ${d} يوم`;
  return fmtDate(ts);
}
function fmtSize(b) {
  if (!b) return '';
  return b > 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB';
}
function fmtMoney(n) {
  const v = Number(n) || 0;
  return v.toLocaleString('en-US');
}

/* ---------------- reference data ---------------- */
const THREAT_W = { 'منخفض': 1, 'متوسط': 2, 'مرتفع': 3, 'خطر بالغ': 4 };
const THREAT_LIST = ['منخفض', 'متوسط', 'مرتفع', 'خطر بالغ'];
const RANKS = ['زعيم', 'نائب', 'كابو', 'عضو', 'مبتدئ', 'متعاقد'];
const P_STATUS = ['مطلوب', 'موقوف', 'مفرج عنه', 'قيد المراقبة'];

/* ---------------- forensic evidence catalog ---------------- */
const EVIDENCE_TYPES = {
  weapon: { label: 'سلاح ناري', icon: 'fa-gun' },
  bullet: { label: 'مقذوف / رصاصة', icon: 'fa-bullseye' },
  casing: { label: 'ظرف فارغ / كبسولة', icon: 'fa-bullseye' },
  fingerprint: { label: 'بصمات', icon: 'fa-fingerprint' },
  dna: { label: 'حمض نووي (DNA)', icon: 'fa-dna' },
  blood: { label: 'آثار دماء', icon: 'fa-droplet' },
  drug: { label: 'مخدرات', icon: 'fa-pills' },
  cash: { label: 'نقد / أموال', icon: 'fa-money-bill-wave' },
  document: { label: 'مستند / وثيقة', icon: 'fa-file-lines' },
  digital: { label: 'جهاز رقمي', icon: 'fa-mobile-screen' },
  media: { label: 'صور / فيديو', icon: 'fa-photo-film' },
  audio: { label: 'تسجيل صوتي', icon: 'fa-microphone' },
  fiber: { label: 'ألياف / آثار', icon: 'fa-shirt' },
  explosive: { label: 'متفجرات / حرائق', icon: 'fa-bomb' },
  vehicle: { label: 'مركبة / آثار إطارات', icon: 'fa-car' },
  other: { label: 'أخرى', icon: 'fa-box-archive' }
};
const EVIDENCE_STATUS = ['مُجمّع', 'محوّل للمختبر', 'قيد التحليل', 'نتيجة واردة', 'مُحلّل', 'مُفرج عنه'];
const evType = t => EVIDENCE_TYPES[t] || EVIDENCE_TYPES.other;
const DOC_TYPES = {
  search: { label: 'مذكرة تفتيش', en: 'SEARCH WARRANT' },
  raid: { label: 'مذكرة مداهمة', en: 'RAID WARRANT' },
  arrest: { label: 'مذكرة إحضار', en: 'ARREST WARRANT' },
  seizure: { label: 'أمر ضبط وتسليم', en: 'SEIZURE ORDER' },
  records: { label: 'طلب تفريغ سجلات', en: 'RECORDS SUBPOENA' },
  surveillance: { label: 'أمر مراقبة تقنية', en: 'SURVEILLANCE ORDER' }
};

/* ---------------- state ---------------- */
const LS_KEY = 'fib140.state.v1';
let DB = null;
let remoteReady = false; /* الوضع المشترك: البيانات محفوظة في PostgreSQL */
let route = { page: 'dashboard', id: null };
let _confirmCb = null;
let activeModalEl = null;

const RENDERERS = {};
const MOUNTS = {};
const ACTIONS = {};
const registerPage = (n, fn) => { RENDERERS[n] = fn; };
const registerMount = (n, fn) => { MOUNTS[n] = fn; };
const action = (n, fn) => { ACTIONS[n] = fn; };

const PAGE_TITLES = {
  dashboard: 'لوحة القيادة المركزية',
  networks: 'الشبكات والهياكل التنظيمية',
  persons: 'المطلوبون والسجلات الجنائية',
  map: 'الخريطة التشغيلية',
  documents: 'المذكرات والطلبات القضائية',
  doj: 'قضايا الوزارة — الاعتماد القضائي',
  bulletins: 'البرقيات والتعميمات',
  cases: 'ملفات القضايا',
  reports: 'سجل تقارير الأدلة',
  evidence: 'سجل الأدلة الجنائية',
  media: 'ملف الصور والشعارات',
  audit: 'سجل التدقيق والعمليات',
  settings: 'الإعدادات والنسخ الاحتياطي'
};

/* ---------------- seed archive ---------------- */
function seedState() {
  const now = Date.now();
  const ago = d => new Date(now - d * 86400000).toISOString();
  const networks = [
    { id: 'NET-01', name: 'عصابة البالاس', type: 'عصابة شوارع', threat: 'مرتفع', color: '#a855f7', territory: 'ديفيس · ستوب سيتي', coords: { x: 772, y: 872 }, logo: '', notes: 'سيطرة على تجارة المخدرات في جنوب لوس سانتوس. توتر مستمر مع عائلة غروف.', createdAt: ago(140) },
    { id: 'NET-02', name: 'عائلة شارع غروف', type: 'عائلة إجرامية', threat: 'متوسط', color: '#22c55e', territory: 'غروف ستريت · ديفيس', coords: { x: 752, y: 900 }, logo: '', notes: 'شبكة عائلية متماسكة، تورطت مؤخراً في حيازة أسلحة غير مرخصة.', createdAt: ago(120) },
    { id: 'NET-03', name: 'كارتل لوس سانتوس', type: 'كارتل مخدرات', threat: 'خطر بالغ', color: '#ef4444', territory: 'ساندي شورز · طريق 68', coords: { x: 500, y: 398 }, logo: '', notes: 'أكبر شبكة تهريب في الولاية. تُدار من مستودعات الصحراء عبر ميناء إليسيان.', createdAt: ago(210) },
    { id: 'NET-04', name: 'شبكة ميناء إليسيان', type: 'شبكة تهريب', threat: 'مرتفع', color: '#f59e0b', territory: 'إليسيان آيلاند · الميناء', coords: { x: 842, y: 884 }, logo: '', notes: 'تهريب حاويات عبر الرصيف 7، يشتبه بوجود حماية داخلية.', createdAt: ago(90) }
  ];

  const person = (o) => Object.assign({
    photo: '', dob: '', nationality: 'أمريكي', bounty: 0, charges: '', phone: '', address: '',
    coords: null, notes: '', reportsTo: '', addedAt: ago(30)
  }, o);

  const persons = [
    person({ id: 'P-01', name: 'ماركوس ريد', alias: 'الشبح', networkId: 'NET-03', rank: 'زعيم', threat: 'خطر بالغ', status: 'مطلوب', bounty: 750000, charges: 'تهريب مواد مخدرة · غسيل أموال · تهديد أمن الولاية · حيازة أسلحة آلية', dob: '1985-04-12', coords: { x: 498, y: 394 }, address: 'ساندي شورز — مستودع 4', notes: 'يتنقل بمركبة سوداء مصفحة. يُعتبر مسلحاً وخطراً — لا يُقترب دون دعم وحدات.' }),
    person({ id: 'P-02', name: 'دييغو فارغاس', alias: 'كوبرا', networkId: 'NET-03', rank: 'نائب', reportsTo: 'P-01', threat: 'مرتفع', status: 'مطلوب', bounty: 300000, charges: 'توزيع مخدرات · مقاومة توقيف · تهريب', dob: '1990-09-03', coords: { x: 522, y: 428 }, address: 'طريق 68 — محطة وقود مهجورة' }),
    person({ id: 'P-03', name: 'لينا كروز', alias: 'الأرملة', networkId: 'NET-03', rank: 'كابو', reportsTo: 'P-01', threat: 'مرتفع', status: 'قيد المراقبة', bounty: 185000, charges: 'غسيل أموال · تزوير مستندات', dob: '1992-01-27', coords: { x: 468, y: 362 }, address: 'غريبيزيد — مزرعة النهر' }),
    person({ id: 'P-04', name: 'تيريل واشنطن', alias: 'T-Bone', networkId: 'NET-01', rank: 'زعيم', threat: 'مرتفع', status: 'مطلوب', bounty: 420000, charges: 'اتجار مخدرات · إطلاق نار في مكان عام · تهديد شهود', dob: '1988-11-19', coords: { x: 772, y: 870 }, address: 'ديفيس — شارع كروجر' }),
    person({ id: 'P-05', name: 'أندريه كولمان', alias: 'ديزل', networkId: 'NET-01', rank: 'كابو', reportsTo: 'P-04', threat: 'متوسط', status: 'مطلوب', bounty: 120000, charges: 'حيازة أسلحة · اعتداء', dob: '1994-06-08', coords: { x: 792, y: 890 } }),
    person({ id: 'P-06', name: 'صوفيا منديز', alias: 'لا سانتا', networkId: 'NET-01', rank: 'عضو', reportsTo: 'P-05', threat: 'متوسط', status: 'موقوف', bounty: 0, charges: 'مساعدة في جريمة · حيازة مخدرات', dob: '1997-03-14', coords: { x: 748, y: 858 } }),
    person({ id: 'P-07', name: 'كيفن برايس', alias: 'غروف', networkId: 'NET-02', rank: 'زعيم', threat: 'متوسط', status: 'قيد المراقبة', bounty: 90000, charges: 'حيازة سلاح غير مرخص', dob: '1983-08-30', coords: { x: 752, y: 902 } }),
    person({ id: 'P-08', name: 'جمال كارتر', alias: 'سي-جيه', networkId: 'NET-02', rank: 'عضو', reportsTo: 'P-07', threat: 'منخفض', status: 'مفرج عنه', bounty: 0, charges: 'إخلال بالنظام العام', dob: '1999-12-02', coords: { x: 764, y: 916 } }),
    person({ id: 'P-09', name: 'فيكتور روسي', alias: 'V', networkId: 'NET-04', rank: 'زعيم', threat: 'مرتفع', status: 'مطلوب', bounty: 380000, charges: 'تهريب بضائع · رشوة موظف عام · تزوير manifests', dob: '1979-02-17', coords: { x: 842, y: 884 }, address: 'إليسيان آيلاند — الرصيف 7' }),
    person({ id: 'P-10', name: 'هانا كيم', alias: 'الطبيبة', networkId: 'NET-04', rank: 'عضو', reportsTo: 'P-09', threat: 'متوسط', status: 'مطلوب', bounty: 75000, charges: 'تزوير سجلات شحن', dob: '1991-07-21', coords: { x: 856, y: 902 } })
  ];

  const cases = [
    {
      id: 'CASE-01', code: 'CR-2026-0001', title: 'عملية نهر الفولاذ', type: 'تهريب مخدرات', priority: 'حرج', status: 'مفتوحة', stage: 3,
      openedAt: ago(26), summary: 'تحقيق موسّع في شبكة تهريب تقودها كارتل لوس سانتوس عبر مستودعات ساندي شورز وصولاً إلى ميناء إليسيان. تشير المصادر السرية إلى شحنات أسبوعية تُخفي داخل حاويات بناء.',
      personIds: ['P-01', 'P-02', 'P-09'], networkIds: ['NET-03', 'NET-04'],
      timeline: [
        { at: ago(26), text: 'فتح ملف القضية — تصنيف «حرج»', by: 'A-140' },
        { at: ago(14), text: 'الانتقال إلى مرحلة «تحقيق موسع»', by: 'A-140' },
        { at: ago(3), text: 'الانتقال إلى مرحلة «طلب مذكرة»', by: 'A-140' }
      ],
      evidence: [
        { id: 'EV-01', title: 'صور جوية لمستودع 4', kind: 'صور', desc: 'تحليق مراقبة — 14 لقطة تُظهر تحميل صناديق ليلاً.', fileId: '' },
        { id: 'EV-02', title: 'سجل شحن الرصيف 7', kind: 'مستند', desc: 'بيان حاوية رقم MSKU-7741 يطابق نمط التهريب.', fileId: '' }
      ]
    },
    {
      id: 'CASE-02', code: 'CR-2026-0002', title: 'ملف حرب الشوارع — ديفيس', type: 'عنف مسلح', priority: 'مرتفع', status: 'مفتوحة', stage: 1,
      openedAt: ago(11), summary: 'سلسلة إطلاق نار متبادل بين البالاس وعائلة غروف. يجري جمع شهادات الشهود وتحليل كاميرات المراقبة المحلية.',
      personIds: ['P-04', 'P-05', 'P-07'], networkIds: ['NET-01', 'NET-02'],
      timeline: [
        { at: ago(11), text: 'فتح ملف القضية — عنف مسلح', by: 'A-140' },
        { at: ago(6), text: 'الانتقال إلى مرحلة «تحقيق أولي»', by: 'A-140' }
      ],
      evidence: []
    }
  ];

  const docs = [
    {
      id: 'DOC-01', ref: 'FIB-A140-2026-0001', type: 'search', caseNo: 'CR-2026-0001',
      target: 'مستودع 4 — ساندي شورز', personId: 'P-01', networkId: 'NET-03',
      location: 'ساندي شورز، المخرج 68، المستودع رقم 4', justification: 'بناءً على معلومات واردة من مصدر سري موثوق، وتطابق صور المراقبة الجوية مع نشاط تحميل ليلي متكرر، تتوفر أسباب محتملة كافية للاعتقاد بوجود أدلة على تهريب مواد مخدرة وأسلحة داخل المستودع المذكور.',
      attachments: [], signature: { fileId: '', name: 'العميل A-140', rank: 'محقق فيدرالي متقدم', date: new Date(now - 2 * 86400000).toISOString().slice(0, 10) },
      status: 'pending', createdAt: now - 2 * 86400000, createdBy: 'A-140'
    }
  ];

  const bulletins = [
    {
      id: 'BRQ-01', serial: 'BRQ-2026-0001', priority: 'urgent', from: 'إدارة العمليات الخاصة', to: 'جميع الوحدات الميدانية',
      subject: 'رفع مستوى التأهب في نطاق الميناء', body: 'يُعمَّم على جميع الوحدات رفع مستوى التأهب إلى الدرجة الثانية في نطاق ميناء إليسيان والطرق المؤدية إليه حتى إشعار آخر. يُمنع التحرك الفردي، وتُبلَّغ غرفة العمليات فوراً عن أي مركبة تحمل لوحات مؤقتة أو حاويات غير مفحوصة. الدعم الجوي متاح عند الطلب.',
      attachments: [], createdAt: now - 5 * 3600000, createdBy: 'A-140'
    },
    {
      id: 'BRQ-02', serial: 'BRQ-2026-0002', priority: 'high', from: 'مكتب المدعي العام', to: 'وحدة التحقيقات الجنائية',
      subject: 'تحديث إجراءات تسليم المطلوبين', body: 'اعتباراً من تاريخه، تُرفق نسخة رقمية من مذكرة الإحضار مع كل عملية تسليم، وتُسجَّل بيانات التوقيف في السجل المركزي خلال ساعة من الضبط.',
      attachments: [], createdAt: now - 2 * 86400000, createdBy: 'DOJ'
    }
  ];

  const markers = [
    { id: 'MK-01', type: 'raid', label: 'مستودع 4 — ساندي شورز', x: 498, y: 394, notes: 'موقع مداهمة مخطط — مذكرة قيد المراجعة', createdAt: ago(2) },
    { id: 'MK-02', type: 'evidence', label: 'حاوية MSKU-7741 — الرصيف 7', x: 846, y: 888, notes: 'دليل مادي محتمل', createdAt: ago(4) },
    { id: 'MK-03', type: 'custom', label: 'نقطة تجمع الوحدة — وسط المدينة', x: 702, y: 762, notes: 'نقطة انطلاق العمليات الميدانية', createdAt: ago(6) }
  ];

  return {
    version: 3,
    settings: { agentName: 'العميل A-140', agentId: 'A-140', rank: 'محقق فيدرالي متقدم', division: 'وحدة العمليات الخاصة — لوس سانتوس', photo: '', signature: '' },
    networks, persons, cases, docs, bulletins, markers, reports: [],
    activity: [
      { at: now - 1800000, text: 'تم رفع طلب مذكرة تفتيش لمستودع 4 — ساندي شورز', kind: 'doc' },
      { at: now - 5 * 3600000, text: 'برقية عاجلة: رفع التأهب في نطاق الميناء', kind: 'brq' },
      { at: now - 86400000, text: 'تحديث هيكل شبكة ميناء إليسيان', kind: 'net' },
      { at: now - 2 * 86400000, text: 'فتح ملف قضية CR-2026-0002 — حرب الشوارع', kind: 'case' }
    ]
  };
}

/* ---------------- map projection (old stylized grid → real atlas) ---------------- */
const MAP_ANCHORS = [
  [270, 110, 438, 156], [330, 180, 388, 263], [490, 310, 500, 347], [515, 410, 584, 391],
  [700, 200, 631, 269], [300, 470, 475, 475], [200, 600, 281, 416], [620, 672, 456, 631],
  [712, 756, 481, 734], [606, 920, 431, 819], [856, 900, 406, 875], [718, 884, 550, 775],
  [520, 768, 375, 725]
];

function toMapSpace(x, y) {
  let ws = 0, ox = 0, oy = 0;
  for (const [sx, sy, nx, ny] of MAP_ANCHORS) {
    const w = 1 / (((x - sx) ** 2 + (y - sy) ** 2) + 60);
    ws += w; ox += nx * w; oy += ny * w;
  }
  return { x: clamp(ox / ws, 12, 988), y: clamp(oy / ws, 12, 988) };
}

function migrateMapCoords(s) {
  if (!s || (Number(s.version) || 0) >= 4) return s;
  (s.persons || []).forEach(p => {
    if (p.coords && isFinite(p.coords.x) && isFinite(p.coords.y)) p.coords = toMapSpace(+p.coords.x, +p.coords.y);
  });
  (s.networks || []).forEach(n => {
    if (n.coords && isFinite(n.coords.x) && isFinite(n.coords.y)) n.coords = toMapSpace(+n.coords.x, +n.coords.y);
  });
  (s.markers || []).forEach(m => {
    if (isFinite(m.x) && isFinite(m.y)) { const c = toMapSpace(+m.x, +m.y); m.x = c.x; m.y = c.y; }
  });
  s.version = 4;
  return s;
}

/* ---------------- persistence ---------------- */
function normalizeState(s) {
  s = migrateMapCoords(s);
  const base = seedState();
  if (!s || typeof s !== 'object') return base;
  const out = {
    version: 4,
    settings: Object.assign({}, base.settings, s.settings || {}),
    networks: Array.isArray(s.networks) ? s.networks : [],
    persons: Array.isArray(s.persons) ? s.persons : [],
    cases: Array.isArray(s.cases) ? s.cases : [],
    docs: Array.isArray(s.docs) ? s.docs : [],
    bulletins: Array.isArray(s.bulletins) ? s.bulletins : [],
    markers: Array.isArray(s.markers) ? s.markers : [],
    reports: Array.isArray(s.reports) ? s.reports : [],
    activity: Array.isArray(s.activity) ? s.activity : []
  };
  out.persons = out.persons.map(p => Object.assign({ photo: '', photos: [], charges: '', coords: null, reportsTo: '', bounty: 0, status: 'مطلوب', threat: 'متوسط', rank: 'عضو', networkId: '' }, p));
  out.networks = out.networks.map(n => Object.assign({ color: '#3d7fb8', coords: null, threat: 'متوسط', logo: '', notes: '' }, n));
  out.cases = out.cases.map(c => {
    const obj = Object.assign({ stage: 0, evidence: [], personIds: [], networkIds: [], timeline: [] }, c);
    obj.evidence = (obj.evidence || []).map(e => Object.assign({
      type: 'other', status: 'مُجمّع', custody: [], collectedAt: '', collectedBy: '',
      lab: '', examiner: '', result: '', location: '', no: '', serial: '', caliber: '',
      weaponType: '', matchStatus: '', nibin: '', weight: '', amount: '', desc: ''
    }, e));
    return obj;
  });
  out.docs = out.docs.map(d => Object.assign({ attachments: [], signature: {}, status: 'pending', type: 'search' }, d));
  out.bulletins = out.bulletins.map(b => Object.assign({ attachments: [], priority: 'normal' }, b));
  out.markers = out.markers.map(m => Object.assign({ type: 'custom', notes: '' }, m));
  return out;
}

function loadState() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return normalizeState(JSON.parse(raw));
  } catch (e) { console.warn('state load failed', e); }
  const seeded = normalizeState(seedState());
  try { localStorage.setItem(LS_KEY, JSON.stringify(seeded)); } catch (e) { }
  return seeded;
}

function save() {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(DB));
  } catch (e) {
    if (!remoteReady) toast('تعذر حفظ البيانات — مساحة التخزين ممتلئة', 'err');
  }
  if (remoteReady && typeof Api !== 'undefined' && Api.isRemote()) Api.queueSave(DB);
  updateChrome();
}

function actorId() {
  const u = (typeof Auth !== 'undefined' && Auth.current) ? Auth.current() : null;
  return u ? u.user : ((DB.settings && DB.settings.agentId) || '—');
}

/* هوية صاحب الحساب الحالي — تُستخدم في المذكرات والبرقيات والتواقيع */
function accountInfo() {
  const u = (typeof Auth !== 'undefined' && Auth.current) ? Auth.current() : null;
  return {
    user: u ? u.user : (DB.settings.agentId || '—'),
    name: (u ? u.name : '') || DB.settings.agentName || '—',
    rank: (u ? u.rank : '') || DB.settings.rank || '',
    division: (u ? u.division : '') || DB.settings.division || '',
    signature: (u && u.signature) || '',
    seal: (u && u.seal) || ''
  };
}

/* أفضل توقيع/ختم متاح: من السجل ثم من الحساب ثم الإعدادات العامة */
function sigOf(rec) {
  if (rec && rec.signature && rec.signature.fileId) return rec.signature.fileId;
  if (rec && rec.signatureFile) return rec.signatureFile;
  const acct = accountInfo();
  return acct.signature || DB.settings.signature || '';
}
function sealOf(rec) {
  if (rec && rec.seal) return rec.seal;
  const acct = accountInfo();
  return acct.seal || DB.settings.seal || '';
}

function logActivity(text, kind = 'info') {
  DB.activity.unshift({ at: Date.now(), text, kind, by: actorId() });
  DB.activity = DB.activity.slice(0, 500);
}

function caseLog(c, text) {
  if (!c) return;
  c.timeline = Array.isArray(c.timeline) ? c.timeline : [];
  c.timeline.unshift({ at: Date.now(), text, by: actorId() });
  c.timeline = c.timeline.slice(0, 80);
}

const caseById = id => DB.cases.find(c => c.id === id);

/* ---------------- helpers: entities ---------------- */
const netById = id => DB.networks.find(n => n.id === id);
const personById = id => DB.persons.find(p => p.id === id);
const netName = id => netById(id)?.name || 'غير مرتبط';
const netColor = id => netById(id)?.color || '#3d7fb8';

function avatar(name, color = '#3d7fb8') {
  const words = String(name || '؟').trim().split(/\s+/).filter(Boolean).slice(0, 2);
  const initials = words.map(w => w[0]).join('') || '؟';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="220"><rect width="180" height="220" fill="#0e1720"/><rect width="180" height="220" fill="${color}" opacity="0.13"/><path d="M0 176h180v44H0z" fill="${color}" opacity="0.08"/><text x="90" y="128" font-family="Tajawal,Segoe UI,sans-serif" font-size="70" font-weight="700" fill="${color}" text-anchor="middle" opacity="0.9">${esc(initials)}</text></svg>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

function personPhoto(p) {
  if (p.photo) { const u = FileStore.url(p.photo); if (u) return u; }
  return avatar(p.alias || p.name, netColor(p.networkId));
}
function networkLogo(n) {
  if (n.logo) { const u = FileStore.url(n.logo); if (u) return u; }
  return '';
}
function fbiSealVector(extra = '') {
  const u = 'fs' + Math.random().toString(36).slice(2, 8);
  return `<svg class="fbi-seal ${extra}" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="FBI seal">
    <defs>
      <path id="${u}t" d="M 30 100 A 70 70 0 0 1 170 100" fill="none"/>
      <path id="${u}b" d="M 34 100 A 66 66 0 0 0 166 100" fill="none"/>
    </defs>
    <circle cx="100" cy="100" r="97" fill="#0a2750" stroke="#c8a24a" stroke-width="3"/>
    <circle cx="100" cy="100" r="87" fill="none" stroke="#c8a24a" stroke-width="1" opacity=".7"/>
    <circle cx="100" cy="100" r="60" fill="#0d305c" stroke="#c8a24a" stroke-width="2"/>
    <text fill="#e9d9a8" font-family="Georgia,'Times New Roman',serif" font-size="7.8" letter-spacing="1">
      <textPath href="#${u}t" startOffset="50%" text-anchor="middle">FEDERAL BUREAU OF INVESTIGATION</textPath>
    </text>
    <text fill="#e9d9a8" font-family="Georgia,'Times New Roman',serif" font-size="7.4" letter-spacing="1.1">
      <textPath href="#${u}b" startOffset="50%" text-anchor="middle">LOS SANTOS FIELD OFFICE</textPath>
    </text>
    <path d="M100 46 L140 62 V104 C140 131 122 147 100 155 C78 147 60 131 60 104 V62 Z" fill="#f2f5f8" stroke="#c8a24a" stroke-width="2.2"/>
    <path d="M100 53 L135 66.5 V103 C135 126 119 139.5 100 146.5 C81 139.5 65 126 65 103 V66.5 Z" fill="#0a2750"/>
    <g stroke="#e9d9a8" stroke-width="2.4" fill="none" stroke-linecap="round">
      <path d="M100 71 V127"/>
      <path d="M80 82 H120"/>
      <path d="M80 82 L72 98 M80 82 L88 98"/>
      <path d="M120 82 L112 98 M120 82 L128 98"/>
    </g>
    <path d="M64 98 A 8 7 0 0 0 80 98 Z" fill="#e9d9a8"/>
    <path d="M112 98 A 8 7 0 0 0 128 98 Z" fill="#e9d9a8"/>
    <path d="M89 127 H111" stroke="#e9d9a8" stroke-width="2.4" stroke-linecap="round"/>
    <circle cx="100" cy="60" r="2.2" fill="#c8a24a"/>
  </svg>`;
}
function fbiSeal(extra = '') {
  return `<img class="fbi-seal ${extra}" src="assets/fbi-seal.svg" alt="FBI seal" draggable="false" onerror="window.__sealFallback && window.__sealFallback(this)">`;
}

window.__sealFallback = (img) => {
  try {
    img.onerror = null;
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(fbiSealVector(''));
  } catch (e) { img.style.display = 'none'; }
};

const sealSVG = () => fbiSeal('seal-print');
function stampHTML(text = 'SENSITIVE') { return `<div class="stamp">${esc(text)}</div>`; }
function barcodeHTML(seed) {
  let h = 7;
  for (const ch of String(seed || 'X')) h = (h * 31 + ch.charCodeAt(0)) % 999983;
  let bars = '';
  for (let i = 0; i < 46; i++) {
    h = (h * 1103515245 + 12345) % 2147483648;
    const w = 1 + (h % 3);
    const gap = (h >> 4) % 2 ? 1 : 2;
    bars += `<i style="width:${w}px;margin-left:${gap}px"></i>`;
  }
  return `<div class="barcode">${bars}</div>`;
}

/* ---------------- chrome ---------------- */
function threatIndex() {
  const wanted = DB.persons.filter(p => p.status === 'مطلوب');
  const score = wanted.reduce((s, p) => s + (THREAT_W[p.threat] || 1), 0);
  return Math.min(100, Math.round(score * 4));
}
function threatLevel() {
  const i = threatIndex();
  return i >= 65 ? 'خطر بالغ' : i >= 40 ? 'مرتفع' : i >= 20 ? 'متوسط' : 'منخفض';
}
function updateChrome() {
  if (!DB) return;
  const pill = $('#threatPill');
  if (pill) {
    const lvl = threatLevel();
    pill.className = 'threat-pill ' + (lvl === 'منخفض' ? 'lvl-low' : lvl === 'متوسط' ? 'lvl-mid' : '');
    $('#threatText').textContent = 'التهديد: ' + lvl;
  }
  const pending = DB.docs.filter(d => d.status === 'pending').length;
  const bell = $('#bellCount');
  if (bell) { bell.textContent = pending; bell.style.display = pending ? '' : 'none'; }
  const bytes = FileStore.usage();
  const txt = $('#storageText');
  if (txt) txt.textContent = bytes > 1048576 ? (bytes / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(bytes / 1024)) + ' KB';
  const fill = $('#storageFill');
  if (fill) fill.style.width = clamp(bytes / (25 * 1048576) * 100, 2, 100) + '%';
  const store = $('#sbStore');
  if (store) store.textContent = remoteReady ? 'POSTGRESQL' : 'LOCAL ARCHIVE';
  const cu = (typeof Auth !== 'undefined' && Auth.current) ? Auth.current() : null;
  const dispName = cu ? (cu.name || cu.user) : (DB.settings.agentName || '—');
  $('#agentName').textContent = dispName;
  $('#agentRank').textContent = (cu ? [cu.rank, cu.division].filter(Boolean).join(' · ') : [DB.settings.rank, DB.settings.division].filter(Boolean).join(' · ')) || '—';
  const chip = $('#officerChip');
  if (chip) chip.innerHTML = `<b>${esc(cu ? cu.user : '—')}</b><small>${esc(cu ? cu.clearance : '')}</small>`;
  const cbRight = $('#cbRight');
  if (cbRight) cbRight.textContent = cu ? cu.user : 'A-140';
  const ap = $('#agentPhoto');
  const photo = DB.settings.photo ? FileStore.url(DB.settings.photo) : '';
  ap.innerHTML = photo ? `<img src="${photo}" alt="">` : '<i class="fa-solid fa-user-shield"></i>';
}
function tickClock() {
  const now = new Date();
  const el = $('#clock');
  if (el) el.textContent = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const sb = $('#sbDate');
  if (sb) sb.textContent = now.toISOString().slice(0, 16).replace('T', ' ') + 'Z';
}

/* ---------------- toast / modal ---------------- */
function toast(msg, type = 'ok') {
  const el = document.createElement('div');
  el.className = 'toast ' + (type === 'err' ? 'err' : type === 'ok' ? 'ok' : '');
  el.innerHTML = `<i class="fa-solid ${type === 'err' ? 'fa-circle-exclamation' : type === 'ok' ? 'fa-circle-check' : 'fa-circle-info'}"></i><span>${esc(msg)}</span>`;
  $('#toastRoot').appendChild(el);
  setTimeout(() => {
    el.style.transition = '.3s';
    el.style.opacity = '0';
    el.style.transform = 'translateX(-12px)';
    setTimeout(() => el.remove(), 320);
  }, 3400);
}

function openModal({ title, icon = 'fa-circle-info', body = '', footer = '', size = '' }) {
  const root = $('#modalRoot');
  root.innerHTML = `<div class="modal-backdrop"><div class="modal ${size}" role="dialog" aria-modal="true">
      <div class="modal-head"><h3><i class="fa-solid ${icon}"></i> ${esc(title)}</h3>
        <button class="icon-btn" data-act="modal:close" aria-label="إغلاق"><i class="fa-solid fa-xmark"></i></button></div>
      <div class="modal-body">${body}</div>
      ${footer ? `<div class="modal-foot">${footer}</div>` : ''}
    </div></div>`;
  root.classList.add('open');
  activeModalEl = root.querySelector('.modal');
  const backdrop = root.querySelector('.modal-backdrop');
  backdrop.addEventListener('click', e => { if (e.target === backdrop) closeModal(); });
  mountUploads(activeModalEl);
  return activeModalEl;
}
function closeModal() {
  const root = $('#modalRoot');
  root.classList.remove('open');
  root.innerHTML = '';
  activeModalEl = null;
}
function confirmDialog({ title = 'تأكيد العملية', text = '', confirmText = 'تأكيد', danger = false, onConfirm }) {
  _confirmCb = onConfirm;
  openModal({
    title, icon: 'fa-triangle-exclamation', size: 'narrow',
    body: `<p style="font-size:.86rem;line-height:1.9;color:var(--muted)">${esc(text)}</p>`,
    footer: `<button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-act="confirm:yes">${esc(confirmText)}</button>
             <button class="btn btn-ghost" data-act="modal:close">إلغاء</button>`
  });
}

/* ---------------- uploads ---------------- */
function imageUploader(prefix, label, value = '', hint = 'JPG / PNG — تُضغط الصورة وتُحفظ محلياً') {
  const has = value ? FileStore.url(value) : '';
  return `<div class="field">
    <label>${esc(label)}</label>
    <div class="upload">
      <div class="upload-box" id="${prefix}_prev">${has ? `<img src="${has}" alt="">` : '<i class="fa-solid fa-image"></i>'}</div>
      <div>
        <label class="btn btn-ghost btn-sm" for="${prefix}_file"><i class="fa-solid fa-upload"></i> اختيار صورة</label>
        <input type="file" id="${prefix}_file" accept="image/*" data-upload="image" data-target="#${prefix}_id" data-preview="#${prefix}_prev">
        <input type="hidden" id="${prefix}_id" value="${value || ''}">
        <div class="upload-text">${esc(hint)}</div>
      </div>
    </div></div>`;
}

function galleryUploader(prefix, label, photos = []) {
  const ids = Array.isArray(photos) ? photos : [];
  return `<div class="field">
    <label>${esc(label)}</label>
    <div class="upload" style="align-items:center">
      <label class="btn btn-ghost btn-sm" for="${prefix}_file"><i class="fa-solid fa-images"></i> إضافة صور</label>
      <input type="file" id="${prefix}_file" accept="image/*" multiple data-upload="gallery" data-json="#${prefix}_json" data-list="#${prefix}_list">
      <span class="upload-text">تُرفق في ملف المشتبه به وتقرير الأدلة.</span>
    </div>
    <input type="hidden" id="${prefix}_json" value='${JSON.stringify(ids)}'>
    <div class="gal-list" id="${prefix}_list" data-json="#${prefix}_json">${ids.length
      ? ids.map((id, i) => `<span class="gal-item"><img src="${FileStore.url(id)}" alt=""><button type="button" data-remove-photo="${i}" data-target="#${prefix}_json" data-list="#${prefix}_list"><i class="fa-solid fa-xmark"></i></button></span>`).join('')
      : '<span class="tiny muted">لا صور إضافية</span>'}</div>
  </div>`;
}

function renderGallery(scope, listSel, ids) {
  const list = scope.querySelector(listSel);
  if (!list) return;
  if (!ids.length) { list.innerHTML = '<span class="tiny muted">لا صور إضافية</span>'; return; }
  list.innerHTML = ids.map((id, i) => `<span class="gal-item"><img src="${FileStore.url(id)}" alt="">
    <button type="button" data-remove-photo="${i}" data-target="${list.dataset.json || ''}" data-list="${listSel}" title="إزالة"><i class="fa-solid fa-xmark"></i></button></span>`).join('');
}

function renderAttachList(scope, listSel) {
  const list = scope.querySelector(listSel);
  if (!list) return;
  const items = scope.__attach || [];
  if (!items.length) { list.innerHTML = `<span class="tiny muted">لا مرفقات مرفوعة</span>`; return; }
  list.innerHTML = items.map((a, i) => `<span class="attach-chip"><i class="fa-solid ${a.type && a.type.includes('pdf') ? 'fa-file-pdf' : 'fa-paperclip'}"></i>${esc(a.name)} <span class="sz">${fmtSize(a.size)}</span><button type="button" data-remove-attach="${i}" title="إزالة"><i class="fa-solid fa-xmark"></i></button></span>`).join('');
}

function mountUploads(scope) {
  if (!scope) return;
  scope.querySelectorAll('input[type=file][data-upload]').forEach(inp => {
    inp.addEventListener('change', async () => {
      const mode = inp.dataset.upload;
      const files = Array.from(inp.files || []);
      if (!files.length) return;
      if (mode === 'multi') {
        scope.__attach = scope.__attach || [];
        for (const f of files) {
          try {
            const id = await FileStore.storeRaw(f);
            scope.__attach.push({ fileId: id, name: f.name, size: f.size, type: f.type });
          } catch (err) { toast('تعذر رفع الملف', 'err'); }
        }
        renderAttachList(scope, inp.dataset.list || '#attachList');
        toast('تم إرفاق ' + files.length + ' ملف');
      } else if (mode === 'gallery') {
        const hidden = scope.querySelector(inp.dataset.json);
        let ids = [];
        try { ids = JSON.parse(hidden.value || '[]'); } catch (err) { ids = []; }
        for (const f of files) {
          try { ids.push(await FileStore.storeImage(f)); } catch (err) { toast('تعذر رفع الصورة', 'err'); }
        }
        hidden.value = JSON.stringify(ids);
        renderGallery(scope, inp.dataset.list, ids);
        toast('تمت إضافة ' + files.length + ' صورة');
      } else {
        const target = scope.querySelector(inp.dataset.target);
        const preview = scope.querySelector(inp.dataset.preview);
        try {
          const id = mode === 'raw' ? await FileStore.storeRaw(files[0]) : await FileStore.storeImage(files[0]);
          if (target) target.value = id;
          if (preview) preview.innerHTML = `<img src="${FileStore.url(id)}" alt="">`;
          toast('تم حفظ الملف');
        } catch (err) {
          toast('تعذر معالجة الملف', 'err');
        }
      }
      inp.value = '';
    });
  });
  if (scope.__uploadClickBound) return;
  scope.__uploadClickBound = true;
  scope.addEventListener('click', (e) => {
    const rp = e.target.closest('[data-remove-photo]');
    if (rp) {
      const hidden = scope.querySelector(rp.dataset.target);
      const listSel = rp.dataset.list;
      let ids = [];
      try { ids = JSON.parse(hidden.value || '[]'); } catch (err) { ids = []; }
      ids.splice(Number(rp.dataset.removePhoto), 1);
      hidden.value = JSON.stringify(ids);
      renderGallery(scope, listSel, ids);
      return;
    }
    const rm = e.target.closest('[data-remove-attach]');
    if (!rm) return;
    const idx = Number(rm.dataset.removeAttach);
    if (scope.__attach && !isNaN(idx)) {
      scope.__attach.splice(idx, 1);
      renderAttachList(scope, '#attachList');
      renderAttachList(scope, '#df_attach');
      renderAttachList(scope, '#bf_attach');
    }
  });
}

function openFile(fileId) {
  const f = FileStore.get(fileId);
  if (!f || !f.dataUrl) { toast('الملف غير متوفر في الأرشيف', 'err'); return; }
  try {
    const parts = f.dataUrl.split(',');
    const mime = (parts[0].match(/data:([^;]+)/) || [])[1] || 'application/octet-stream';
    if (/;base64/.test(parts[0])) {
      const bin = atob(parts[1]);
      const arr = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      const url = URL.createObjectURL(new Blob([arr], { type: mime }));
      window.open(url, '_blank');
    } else {
      window.open(f.dataUrl, '_blank');
    }
  } catch (e) { toast('تعذر فتح الملف', 'err'); }
}
function downloadFile(fileId) {
  const f = FileStore.get(fileId);
  if (!f) return toast('الملف غير متوفر', 'err');
  const a = document.createElement('a');
  a.href = f.dataUrl;
  a.download = f.name || 'file';
  a.click();
}
function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/* ---------------- router ---------------- */
function render() {
  if (typeof Auth !== 'undefined' && Auth.canPage && !Auth.canPage(route.page)) {
    route = { page: Auth.homePage(), id: null };
  }
  const fn = RENDERERS[route.page] || RENDERERS.dashboard;
  const view = $('#view');
  view.innerHTML = `<div class="page">${fn()}</div>`;
  mountUploads(view);
  $('#pageTitle').textContent = PAGE_TITLES[route.page] || '';
  const dojUser = typeof Auth !== 'undefined' && Auth.isDoj && Auth.isDoj();
  $$('.nav-item').forEach(b => {
    b.style.display = (!Auth.canPage || Auth.canPage(b.dataset.id)) ? '' : 'none';
    b.classList.toggle('active', b.dataset.id === route.page);
  });
  $$('.nav-label').forEach(l => { l.style.display = dojUser ? 'none' : ''; });
  $('#sidebar').classList.remove('open');
  view.scrollTop = 0;
  window.scrollTo(0, 0);
  const mount = MOUNTS[route.page];
  if (mount) { try { mount(); } catch (e) { console.error(e); } }
  updateChrome();
}

function go(page, id = null) {
  route = { page, id };
  render();
}

/* ---------------- shared chips ---------------- */
function threatChip(t) {
  const cls = t === 'خطر بالغ' ? 'chip-red' : t === 'مرتفع' ? 'chip-amber' : t === 'متوسط' ? 'chip-cyan' : 'chip-green';
  return `<span class="chip ${cls}"><i class="fa-solid fa-triangle-exclamation"></i>${esc(t)}</span>`;
}
function dashStageLabel(c) {
  const stages = (typeof CASE_STAGES !== 'undefined') ? CASE_STAGES : ['بلاغ', 'تحقيق أولي', 'تحقيق موسع', 'طلب مذكرة', 'تنفيذ', 'إحالة للنيابة', 'مغلقة'];
  const i = clamp(Number(c.stage) || 0, 0, stages.length - 1);
  return { i, label: stages[i], total: stages.length };
}
function statusChip(s) {
  const cls = s === 'مطلوب' ? 'chip-red' : s === 'موقوف' ? 'chip-green' : s === 'قيد المراقبة' ? 'chip-amber' : 'chip';
  return `<span class="chip ${cls}">${esc(s)}</span>`;
}

/* ============================================================
   DASHBOARD
   ============================================================ */
function pageDashboard() {
  const cu = (typeof Auth !== 'undefined' && Auth.current) ? Auth.current() : null;
  const meName = (cu ? cu.name : '') || DB.settings.agentName;
  const meId = (cu ? cu.user : '') || DB.settings.agentId;
  const meDiv = (cu ? cu.division : '') || DB.settings.division;
  const wanted = DB.persons.filter(p => p.status === 'مطلوب');
  const pending = DB.docs.filter(d => d.status === 'pending');
  const openCases = DB.cases.filter(c => c.status === 'مفتوحة');
  const top = [...wanted].sort((a, b) => (THREAT_W[b.threat] || 0) - (THREAT_W[a.threat] || 0) || (b.bounty || 0) - (a.bounty || 0)).slice(0, 4);
  const idx = threatIndex();

  return `
  <div class="hero">
    <div class="hero-top">
      <div>
        <div class="eyebrow">SECURE CHANNEL · ${esc(cu ? cu.clearance : 'CLEARANCE LEVEL 5')} · ${esc(meId || '—')}</div>
        <h2>مرحباً${meName ? '، ' + esc(meName) : ' بك'}</h2>
        <p>غرفة العمليات المركزية لمكتب لوس سانتوس الميداني. جميع السجلات في هذا الأرشيف محفوظة ${remoteReady ? 'في قاعدة بيانات PostgreSQL مشتركة يراها كل العملاء المخوّلين' : 'محلياً ومشفّرة على هذا الجهاز'}، وتشمل الشبكات الإجرامية، المطلوبين، المذكرات القضائية، والبرقيات الميدانية.</p>
        <div class="hero-tags">
          <span class="chip chip-cyan"><i class="fa-solid fa-shield-halved"></i> ${esc(meDiv || '—')}</span>
          <span class="chip">مؤشر التهديد ${idx}%</span>
          <span class="chip chip-amber"><i class="fa-solid fa-hourglass-half"></i> ${pending.length} طلب قيد المراجعة</span>
        </div>
      </div>
      <div class="hero-seal">${fbiSeal('seal-hero')}</div>
    </div>
  </div>

  <div class="stats">
    <div class="stat"><div class="stat-ico i-red"><i class="fa-solid fa-user-secret"></i></div>
      <div><div class="stat-val">${wanted.length}</div><div class="stat-lbl">مطلوبون نشطون</div></div></div>
    <div class="stat"><div class="stat-ico i-violet"><i class="fa-solid fa-sitemap"></i></div>
      <div><div class="stat-val">${DB.networks.length}</div><div class="stat-lbl">شبكات تحت المراقبة</div></div></div>
    <div class="stat"><div class="stat-ico i-cyan"><i class="fa-solid fa-folder-open"></i></div>
      <div><div class="stat-val">${openCases.length}</div><div class="stat-lbl">قضايا مفتوحة</div></div></div>
    <div class="stat"><div class="stat-ico i-amber"><i class="fa-solid fa-file-signature"></i></div>
      <div><div class="stat-val">${DB.docs.length}</div><div class="stat-lbl">مذكرات وطلبات</div></div></div>
  </div>

  <div class="quick-actions">
    <button class="qa" data-act="case:new"><i class="fa-solid fa-folder-plus"></i><span>فتح قضية</span></button>
    <button class="qa" data-act="doc:new"><i class="fa-solid fa-file-signature"></i><span>مذكرة جديدة</span></button>
    <button class="qa" data-act="brq:new"><i class="fa-solid fa-tower-broadcast"></i><span>برقية</span></button>
    <button class="qa" data-act="case:evidence-pdf"><i class="fa-solid fa-file-pdf"></i><span>تقرير أدلة</span></button>
    <button class="qa" data-act="per:new"><i class="fa-solid fa-user-plus"></i><span>مطلوب جديد</span></button>
    <button class="qa" data-act="search:open"><i class="fa-solid fa-magnifying-glass"></i><span>بحث شامل</span></button>
  </div>

  <div class="grid-2">
    <div class="card">
      <div class="card-head"><div class="card-title"><i class="fa-solid fa-clock-rotate-left"></i> سجل النشاط اللحظي</div>
        <span class="chip chip-cyan">${DB.activity.length} حدث</span></div>
      ${DB.activity.length ? `<div class="timeline">${DB.activity.slice(0, 8).map(a => `
        <div class="tl">${esc(a.text)}<small>${fmtDateTime(a.at)} · ${timeAgo(a.at)}</small></div>`).join('')}</div>`
      : `<div class="empty"><i class="fa-solid fa-wave-square"></i><p>لا توجد أحداث مسجلة بعد.</p></div>`}
    </div>

    <div class="card">
      <div class="card-head"><div class="card-title"><i class="fa-solid fa-crosshairs"></i> أخطر المطلوبين</div>
        <button class="btn btn-ghost btn-sm" data-act="go" data-id="persons">السجل الكامل</button></div>
      ${top.length ? top.map(p => `
        <div class="loc-item" style="margin-bottom:8px;cursor:pointer" data-act="per:view" data-id="${p.id}">
          <div class="p-photo" style="width:38px;height:46px;flex:0 0 38px;border-radius:7px;overflow:hidden">
            <img src="${personPhoto(p)}" alt="" style="width:100%;height:100%;object-fit:cover">
          </div>
          <div style="min-width:0">
            <div class="loc-name">${esc(p.name)}</div>
            <div class="loc-sub">${esc(p.alias || '—')} · ${esc(netName(p.networkId))}</div>
          </div>
          <div class="loc-actions">${threatChip(p.threat)}</div>
        </div>`).join('') : `<div class="empty"><i class="fa-solid fa-user-check"></i><p>لا يوجد مطلوبون حالياً.</p></div>`}
    </div>
  </div>

  <div class="grid-2 mt">
    <div class="card">
      <div class="card-head"><div class="card-title"><i class="fa-solid fa-file-signature"></i> طلبات بانتظار المراجعة القضائية</div>
        <button class="btn btn-primary btn-sm" data-act="doc:new"><i class="fa-solid fa-plus"></i> طلب جديد</button></div>
      ${pending.length ? `<table class="tbl"><thead><tr><th>الرقم</th><th>النوع</th><th>الجهة المستهدفة</th><th>الحالة</th></tr></thead><tbody>
        ${pending.slice(0, 5).map(d => `<tr style="cursor:pointer" data-act="doc:view" data-id="${d.id}">
          <td class="mono tiny">${esc(d.ref)}</td><td>${esc(DOC_TYPES[d.type]?.label || d.type)}</td>
          <td>${esc(d.target)}</td><td><span class="st st-pending">قيد المراجعة</span></td></tr>`).join('')}
      </tbody></table>` : `<div class="empty"><i class="fa-solid fa-gavel"></i><p>لا توجد طلبات معلقة.</p></div>`}
    </div>

    <div class="card">
      <div class="card-head"><div class="card-title"><i class="fa-solid fa-diagram-project"></i> خريطة الشبكات</div>
        <button class="btn btn-ghost btn-sm" data-act="go" data-id="networks">إدارة</button></div>
      ${DB.networks.length ? DB.networks.map(n => {
        const count = DB.persons.filter(p => p.networkId === n.id).length;
        return `<div class="loc-item" style="margin-bottom:8px;cursor:pointer" data-act="net:view" data-id="${n.id}">
          <span class="loc-ico" style="background:${n.color}22;color:${n.color};border:1px solid ${n.color}55"><i class="fa-solid fa-sitemap"></i></span>
          <div style="min-width:0"><div class="loc-name">${esc(n.name)}</div>
            <div class="loc-sub">${count} عضو · ${esc(n.territory || '—')}</div></div>
          <div class="loc-actions">${threatChip(n.threat)}</div>
        </div>`;
      }).join('') : `<div class="empty"><i class="fa-solid fa-sitemap"></i><p>لا توجد شبكات مسجلة بعد.</p>
        <button class="btn btn-ghost btn-sm" data-act="net:new"><i class="fa-solid fa-plus"></i> إضافة شبكة</button></div>`}
    </div>
  </div>

  ${(() => {
    const decisions = [
      ...DB.docs.filter(d => d.decision).map(d => ({ at: d.decision.at, kind: 'مذكرة', label: d.ref, status: d.status, to: d.createdBy, act: 'doc:view', id: d.id })),
      ...DB.cases.filter(c => c.dojDecision).map(c => ({ at: c.dojDecision.at, kind: 'قضية', label: c.code + ' — ' + c.title, status: c.dojDecision.status, to: c.openedBy, act: 'case:view', id: c.id }))
    ].sort((a, b) => b.at - a.at).slice(0, 6);
    return decisions.length ? `<div class="card mt">
      <div class="card-head"><div class="card-title"><i class="fa-solid fa-scale-balanced"></i> ردود وزارة العدل</div>
        <span class="chip chip-cyan">${decisions.length} قرار</span></div>
      ${decisions.map(dcl => `<div class="loc-item" style="margin-bottom:8px;cursor:pointer" data-act="${dcl.act}" data-id="${dcl.id}">
        <span class="loc-ico" style="background:${dcl.status === 'approved' ? 'rgba(34,197,94,.12)' : 'rgba(176,57,47,.14)'};color:${dcl.status === 'approved' ? '#4ade80' : '#e2a19a'};border:1px solid ${dcl.status === 'approved' ? 'rgba(34,197,94,.32)' : 'rgba(176,57,47,.4)'}"><i class="fa-solid ${dcl.status === 'approved' ? 'fa-circle-check' : 'fa-circle-xmark'}"></i></span>
        <div style="min-width:0"><div class="loc-name">${esc(dcl.kind)} ${esc(dcl.label)}</div>
          <div class="loc-sub">${dcl.status === 'approved' ? 'معتمد' : 'مرفوض'} · إلى: ${esc(dcl.to || '—')} · ${timeAgo(dcl.at)}</div></div>
        <div class="loc-actions"><span class="chip ${dcl.status === 'approved' ? 'chip-green' : 'chip-red'}">${dcl.status === 'approved' ? 'اعتماد' : 'رفض'}</span></div>
      </div>`).join('')}
    </div>` : '';
  })()}

  ${DB.cases.length ? `<div class="card mt">
    <div class="card-head"><div class="card-title"><i class="fa-solid fa-list-check"></i> تقدم القضايا حسب المرحلة</div>
      <button class="btn btn-ghost btn-sm" data-act="go" data-id="cases">كل القضايا</button></div>
    ${DB.cases.map(c => {
      const st = dashStageLabel(c);
      return `<div class="prog-row" data-act="case:view" data-id="${c.id}">
        <div class="prog-top"><span>${esc(c.code)} · ${esc(c.title)}</span>
          <span class="tiny muted">${esc(st.label)} · ${st.i + 1}/${st.total}</span></div>
        <div class="prog-bar"><i style="width:${Math.round((st.i + 1) / st.total * 100)}%"></i></div>
      </div>`;
    }).join('')}
  </div>` : ''}`;
}

/* ============================================================
   NETWORKS
   ============================================================ */
function pageNetworks() {
  if (route.id) return networkDetail(route.id);
  return `
  <div class="page-head">
    <div>
      <h2><i class="fa-solid fa-sitemap"></i> الشبكات والهياكل التنظيمية</h2>
      <p>سجّل الشبكات الإجرامية، ارسم هرمها التنظيمي، واربط كل فرد بمنصبه والمُشرف عليه. الهيكل يُحدَّث تلقائياً عند إضافة أعضاء جدد.</p>
    </div>
    <div class="head-actions">
      <button class="btn btn-primary" data-act="net:new"><i class="fa-solid fa-plus"></i> شبكة جديدة</button>
    </div>
  </div>

  ${DB.networks.length ? `<div class="net-grid">
    ${DB.networks.map(n => {
      const members = DB.persons.filter(p => p.networkId === n.id);
      const logo = networkLogo(n);
      return `<article class="net-card" style="--nc:${n.color}" data-act="net:view" data-id="${n.id}">
        <div class="net-head">
          <div class="net-logo">${logo ? `<img src="${logo}" alt="">` : '<i class="fa-solid fa-sitemap"></i>'}</div>
          <div><div class="net-name">${esc(n.name)}</div><div class="net-type">${esc(n.type)}</div></div>
        </div>
        <div class="chips">${threatChip(n.threat)}<span class="chip"><i class="fa-solid fa-location-dot"></i>${esc(n.territory || '—')}</span></div>
        <div class="net-meta"><span>الأعضاء <b>${members.length}</b></span>
          <span>المطلوبون <b>${members.filter(m => m.status === 'مطلوب').length}</b></span>
          <span>${n.coords ? 'موقع محفوظ' : 'بلا موقع'}</span></div>
      </article>`;
    }).join('')}
  </div>` : `<div class="card empty"><i class="fa-solid fa-sitemap"></i><p>لا توجد شبكات مسجلة. ابدأ بإنشاء أول شبكة.</p>
      <button class="btn btn-primary" data-act="net:new"><i class="fa-solid fa-plus"></i> إنشاء شبكة</button></div>`}`;
}

function orgChart(networkId) {
  const members = DB.persons.filter(p => p.networkId === networkId);
  if (!members.length) return `<div class="empty"><i class="fa-solid fa-user-slash"></i><p>لا يوجد أعضاء مسجلون في هذه الشبكة بعد.</p></div>`;
  const ids = new Set(members.map(m => m.id));
  const roots = members.filter(m => !m.reportsTo || !ids.has(m.reportsTo));
  const node = (p, root) => {
    const kids = members.filter(m => m.reportsTo === p.id);
    return `<li class="${root ? 'org-root' : ''}">
      <div class="org-node ${p.rank === 'زعيم' ? 'is-leader' : ''}" data-act="per:view" data-id="${p.id}" title="فتح ملف ${esc(p.name)}">
        <img src="${personPhoto(p)}" alt="">
        <div style="min-width:0">
          <div class="org-name">${esc(p.name)}</div>
          <div class="org-alias">${esc(p.alias ? '"' + p.alias + '"' : '—')}</div>
          <span class="rank-chip">${esc(p.rank)} · ${esc(p.status)}</span>
        </div>
      </div>
      ${kids.length ? `<ul>${kids.map(k => node(k, false)).join('')}</ul>` : ''}
    </li>`;
  };
  return `<div class="org-wrap"><ul class="org-tree">${roots.map(r => node(r, true)).join('')}</ul></div>`;
}

function networkDetail(id) {
  const n = netById(id);
  if (!n) return `<div class="card empty"><p>الشبكة غير موجودة.</p></div>`;
  const members = DB.persons.filter(p => p.networkId === id);
  const docs = DB.docs.filter(d => d.networkId === id);
  const logo = networkLogo(n);
  return `
  <div class="page-head">
    <div>
      <h2><i class="fa-solid fa-sitemap" style="color:${n.color}"></i> ${esc(n.name)}</h2>
      <p>${esc(n.notes || 'لا توجد ملاحظات استخباراتية مسجلة.')}</p>
    </div>
    <div class="head-actions">
      <button class="btn btn-ghost" data-act="net:back"><i class="fa-solid fa-arrow-right"></i> رجوع</button>
      <button class="btn btn-ghost" data-act="per:new" data-id="${n.id}"><i class="fa-solid fa-user-plus"></i> إضافة عضو</button>
      <button class="btn btn-ghost" data-act="net:edit" data-id="${n.id}"><i class="fa-solid fa-pen"></i> تعديل</button>
      <button class="btn btn-danger" data-act="net:del" data-id="${n.id}"><i class="fa-solid fa-trash"></i> حذف</button>
    </div>
  </div>

  <div class="stats" style="grid-template-columns:repeat(4,1fr)">
    <div class="stat"><div class="stat-ico" style="background:${n.color}18;color:${n.color};border:1px solid ${n.color}44"><i class="fa-solid fa-users"></i></div>
      <div><div class="stat-val">${members.length}</div><div class="stat-lbl">إجمالي الأعضاء</div></div></div>
    <div class="stat"><div class="stat-ico i-red"><i class="fa-solid fa-user-secret"></i></div>
      <div><div class="stat-val">${members.filter(m => m.status === 'مطلوب').length}</div><div class="stat-lbl">مطلوبون</div></div></div>
    <div class="stat"><div class="stat-ico i-amber"><i class="fa-solid fa-sack-dollar"></i></div>
      <div><div class="stat-val">${fmtMoney(members.reduce((s, m) => s + (Number(m.bounty) || 0), 0))}</div><div class="stat-lbl">إجمالي المكافآت ($)</div></div></div>
    <div class="stat"><div class="stat-ico i-cyan"><i class="fa-solid fa-file-signature"></i></div>
      <div><div class="stat-val">${docs.length}</div><div class="stat-lbl">مذكرات مرتبطة</div></div></div>
  </div>

  <div class="card">
    <div class="card-head"><div class="card-title"><i class="fa-solid fa-diagram-project"></i> الهيكل التنظيمي</div>
      <span class="chip">${esc(n.type)} · ${esc(n.territory || '—')}</span></div>
    ${orgChart(id)}
  </div>

  <div class="grid-2 mt">
    <div class="card">
      <div class="card-head"><div class="card-title"><i class="fa-solid fa-users"></i> كشف الأعضاء</div></div>
      ${members.length ? `<table class="tbl"><thead><tr><th>الاسم</th><th>المنصب</th><th>المُشرف</th><th>الحالة</th><th></th></tr></thead><tbody>
        ${members.map(m => `<tr><td><b>${esc(m.name)}</b><div class="tiny muted">${esc(m.alias || '')}</div></td>
          <td><span class="rank-chip">${esc(m.rank)}</span></td>
          <td class="tiny">${esc(m.reportsTo ? (personById(m.reportsTo)?.name || '—') : '—')}</td>
          <td>${statusChip(m.status)}</td>
          <td class="actions"><button class="btn btn-ghost btn-sm" data-act="per:view" data-id="${m.id}">ملف</button></td></tr>`).join('')}
      </tbody></table>` : `<div class="empty"><i class="fa-solid fa-user-slash"></i><p>لا أعضاء مسجلون.</p></div>`}
    </div>

    <div class="card">
      <div class="card-head"><div class="card-title"><i class="fa-solid fa-location-crosshairs"></i> النطاق والمذكرات</div></div>
      <dl class="kv">
        <dt>النطاق الجغرافي</dt><dd>${esc(n.territory || '—')}</dd>
        <dt>الموقع المحفوظ</dt><dd>${n.coords ? `X ${n.coords.x.toFixed(0)} · Y ${n.coords.y.toFixed(0)}` : 'لم يُحدد بعد'}</dd>
        <dt>مستوى التهديد</dt><dd>${threatChip(n.threat)}</dd>
        <dt>تاريخ التسجيل</dt><dd>${fmtDate(n.createdAt)}</dd>
      </dl>
      <div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap">
        ${n.coords ? `<button class="btn btn-ghost btn-sm" data-act="map:focus" data-id="n:${n.id}"><i class="fa-solid fa-map-location-dot"></i> عرض على الخريطة</button>` : ''}
        <button class="btn btn-ghost btn-sm" data-act="doc:new"><i class="fa-solid fa-file-signature"></i> طلب مذكرة</button>
      </div>
      <div class="section-title">المذكرات المرتبطة</div>
      ${docs.length ? docs.map(d => `<div class="loc-item" style="margin-bottom:7px">
        <span class="loc-ico" style="background:rgba(61,127,184,.16);color:#9fc7e8"><i class="fa-solid fa-file-lines"></i></span>
        <div><div class="loc-name">${esc(DOC_TYPES[d.type]?.label || d.type)}</div><div class="loc-sub">${esc(d.ref)}</div></div>
        <div class="loc-actions"><button class="btn btn-ghost btn-sm" data-act="doc:view" data-id="${d.id}">عرض</button></div>
      </div>`).join('') : `<p class="tiny muted">لا مذكرات مرتبطة بهذه الشبكة.</p>`}
    </div>
  </div>`;
}

/* ---------------- network form ---------------- */
function networkForm(id) {
  const n = id ? netById(id) : null;
  const data = n || { name: '', type: 'عصابة شوارع', threat: 'متوسط', color: '#3d7fb8', territory: '', notes: '', logo: '', coords: null };
  const color = data.color || '#3d7fb8';
  openModal({
    title: n ? 'تعديل بيانات الشبكة' : 'تسجيل شبكة جديدة',
    icon: 'fa-sitemap', size: 'wide',
    body: `
      <div class="form-grid">
        <div class="field"><label>اسم الشبكة / العصابة</label><input class="inp" id="nf_name" value="${esc(data.name)}" placeholder="مثال: كارتل لوس سانتوس"></div>
        <div class="field"><label>التصنيف</label><input class="inp" id="nf_type" value="${esc(data.type)}" list="nf_types" placeholder="عصابة شوارع / كارتل / شبكة تهريب">
          <datalist id="nf_types"><option>عصابة شوارع</option><option>عائلة إجرامية</option><option>كارتل مخدرات</option><option>شبكة تهريب</option><option>منظمة غسيل أموال</option><option>خلية منظمة</option></datalist></div>
        <div class="field"><label>مستوى التهديد</label><select class="inp" id="nf_threat">${THREAT_LIST.map(t => `<option ${data.threat === t ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
        <div class="field"><label>لون الهوية التحليلية</label><input class="inp" type="color" id="nf_color" value="${color}" style="height:40px;padding:4px"></div>
        <div class="field span-2"><label>النطاق الجغرافي</label><input class="inp" id="nf_territory" value="${esc(data.territory)}" placeholder="مثال: ساندي شورز · طريق 68"></div>
        <div class="field span-2"><label>ملاحظات استخباراتية</label><textarea class="inp" id="nf_notes" rows="3" placeholder="طبيعة النشاط، مصادر التمويل، التحالفات...">${esc(data.notes)}</textarea></div>
        <div class="span-2">${imageUploader('nfLogo', 'شعار الشبكة (اختياري)', data.logo)}</div>
        <div class="field span-2"><label>الموقع على الخريطة — انقر لتحديد النطاق</label>
          <div id="nf_map" class="mini-map"></div>
          <div class="coord-line"><span>X <b id="nf_cx">${data.coords ? data.coords.x.toFixed(0) : '—'}</b></span><span>Y <b id="nf_cy">${data.coords ? data.coords.y.toFixed(0) : '—'}</b></span>
            <input type="hidden" id="nf_x" value="${data.coords ? data.coords.x : ''}"><input type="hidden" id="nf_y" value="${data.coords ? data.coords.y : ''}"></div>
        </div>
        <div class="field span-2">
          <label>أعضاء الشبكة — أضفهم الآن <span class="tiny muted">(اختياري · بلا حد)</span></label>
          <div class="tiny muted" style="margin-bottom:8px;line-height:1.8">أضف أعضاء الشبكة مباشرة هنا، ويُنشأ لكل عضو ملف كامل في سجل المطلوبين مرتبط بهذه الشبكة وموقعها. يمكنك لاحقاً تعديل الصور والتهم والمُشرف من ملف كل عضو.</div>
          <div id="nf_members"></div>
          <button type="button" class="btn btn-ghost btn-sm" data-act="nf:add-member"><i class="fa-solid fa-user-plus"></i> إضافة عضو</button>
        </div>
      </div>`,
    footer: `<button class="btn btn-primary" data-act="net:save" data-id="${id || ''}"><i class="fa-solid fa-floppy-disk"></i> حفظ الشبكة</button>
             <button class="btn btn-ghost" data-act="modal:close">إلغاء</button>`
  });
  const mapEl = activeModalEl.querySelector('#nf_map');
  new TacticalMap(mapEl, {
    initial: data.coords || null,
    initialZoom: data.coords ? 1.6 : null,
    onPick: (c) => {
      activeModalEl.querySelector('#nf_x').value = c.x.toFixed(1);
      activeModalEl.querySelector('#nf_y').value = c.y.toFixed(1);
      activeModalEl.querySelector('#nf_cx').textContent = c.x.toFixed(0);
      activeModalEl.querySelector('#nf_cy').textContent = c.y.toFixed(0);
    }
  });

  if (!id) {
    activeModalEl.querySelector('#nf_members').insertAdjacentHTML('beforeend', nfMemberRow());
    activeModalEl.querySelector('.modal-body').scrollTop = 0;
  }
}

let nfMemberSeq = 0;
function nfMemberRow() {
  nfMemberSeq++;
  return `<div class="member-row" data-row="${nfMemberSeq}">
    <input class="inp" data-f="name" placeholder="اسم العضو">
    <input class="inp" data-f="alias" placeholder="اللقب">
    <select class="inp" data-f="rank">${RANKS.map(r => `<option ${r === 'عضو' ? 'selected' : ''}>${r}</option>`).join('')}</select>
    <select class="inp" data-f="status">${P_STATUS.map(s => `<option ${s === 'مطلوب' ? 'selected' : ''}>${s}</option>`).join('')}</select>
    <button type="button" class="btn btn-danger btn-sm" data-act="nf:rm-member" data-id="${nfMemberSeq}" title="إزالة العضو"><i class="fa-solid fa-xmark"></i></button>
  </div>`;
}

action('nf:add-member', () => {
  const box = $('#nf_members'); if (!box) return;
  box.insertAdjacentHTML('beforeend', nfMemberRow());
  const rows = box.querySelectorAll('.member-row');
  rows[rows.length - 1]?.querySelector('input')?.focus();
});
action('nf:rm-member', (i) => {
  const row = document.querySelector(`#nf_members .member-row[data-row="${i}"]`);
  if (row) row.remove();
});

action('net:new', () => networkForm(null));
action('net:edit', (id) => networkForm(id));
action('net:view', (id) => { route = { page: 'networks', id }; render(); });
action('net:back', () => { route = { page: 'networks', id: null }; render(); });

action('net:save', (id) => {
  const name = val('#nf_name');
  if (!name) return toast('اسم الشبكة مطلوب', 'err');
  const x = parseFloat(val('#nf_x')), y = parseFloat(val('#nf_y'));
  const coords = (!isNaN(x) && !isNaN(y)) ? { x, y } : null;
  const payload = {
    name, type: val('#nf_type') || 'غير مصنف', threat: val('#nf_threat') || 'متوسط',
    color: val('#nf_color') || '#3d7fb8', territory: val('#nf_territory'),
    notes: val('#nf_notes'), logo: val('#nfLogo_id'), coords
  };
  const members = $$('#nf_members .member-row').map(r => ({
    name: r.querySelector('[data-f="name"]').value.trim(),
    alias: r.querySelector('[data-f="alias"]').value.trim(),
    rank: r.querySelector('[data-f="rank"]').value,
    status: r.querySelector('[data-f="status"]').value
  })).filter(m => m.name);

  let netId = id;
  if (id) {
    Object.assign(netById(id), payload);
    logActivity(`تحديث بيانات الشبكة: ${name}`, 'net');
  } else {
    const net = Object.assign({ id: uid('NET'), createdAt: new Date().toISOString() }, payload);
    DB.networks.unshift(net);
    netId = net.id;
    logActivity(`تسجيل شبكة جديدة: ${name}`, 'net');
  }

  members.forEach(m => {
    DB.persons.unshift({
      id: uid('P'), name: m.name, alias: m.alias, networkId: netId, rank: m.rank, status: m.status,
      threat: payload.threat, bounty: 0, charges: '', photo: '', photos: [],
      coords: coords ? { x: coords.x, y: coords.y } : null,
      reportsTo: '', dob: '', nationality: 'أمريكي', phone: '', address: '', notes: '',
      addedAt: new Date().toISOString()
    });
  });
  if (members.length) logActivity(`إضافة ${members.length} عضو إلى الشبكة ${name}`, 'person');

  save(); closeModal();
  route = { page: 'networks', id: netId };
  render();
  toast(members.length ? `تم حفظ الشبكة مع ${members.length} عضو` : 'تم حفظ بيانات الشبكة');
});

action('net:del', (id) => {
  const n = netById(id); if (!n) return;
  confirmDialog({
    title: 'حذف الشبكة', danger: true, confirmText: 'حذف نهائي',
    text: `سيتم حذف «${n.name}» من الأرشيف. الأعضاء المرتبطون سيبقون في السجل بدون شبكة.`,
    onConfirm: () => {
      DB.networks = DB.networks.filter(x => x.id !== id);
      DB.persons.forEach(p => { if (p.networkId === id) { p.networkId = ''; p.reportsTo = ''; } });
      logActivity(`حذف شبكة: ${n.name}`, 'net');
      save(); route = { page: 'networks', id: null }; render(); toast('تم حذف الشبكة');
    }
  });
});

/* ============================================================
   PERSONS
   ============================================================ */
let personFilters = { q: '', net: '', status: '', threat: '' };

function pagePersons() {
  const list = [...DB.persons].sort((a, b) => (THREAT_W[b.threat] || 0) - (THREAT_W[a.threat] || 0));
  return `
  <div class="page-head">
    <div>
      <h2><i class="fa-solid fa-user-secret"></i> المطلوبون والسجلات الجنائية</h2>
      <p>سجل مركزي لكل شخص: البيانات الشخصية، الصور، الاتهامات، المكافأة، الموقع الأخير، والارتباط التنظيمي.</p>
    </div>
    <div class="head-actions">
      <button class="btn btn-primary" data-act="per:new"><i class="fa-solid fa-user-plus"></i> إضافة شخص</button>
    </div>
  </div>

  <div class="card" style="padding:14px;margin-bottom:18px">
    <div style="display:grid;grid-template-columns:1.6fr 1fr 1fr 1fr;gap:10px" class="filter-row">
      <input class="inp" id="personSearch" placeholder="بحث بالاسم أو اللقب أو الاتهام..." value="${esc(personFilters.q)}">
      <select class="inp" id="filterNet"><option value="">كل الشبكات</option>
        ${DB.networks.map(n => `<option value="${n.id}" ${personFilters.net === n.id ? 'selected' : ''}>${esc(n.name)}</option>`).join('')}</select>
      <select class="inp" id="filterStatus"><option value="">كل الحالات</option>
        ${P_STATUS.map(s => `<option ${personFilters.status === s ? 'selected' : ''}>${s}</option>`).join('')}</select>
      <select class="inp" id="filterThreat"><option value="">كل مستويات التهديد</option>
        ${THREAT_LIST.map(t => `<option ${personFilters.threat === t ? 'selected' : ''}>${t}</option>`).join('')}</select>
    </div>
    <div class="tiny muted" style="margin-top:10px">عدد النتائج: <b id="personCount" style="color:var(--cyan)">${list.length}</b></div>
  </div>

  <div class="grid-auto" id="personGrid">
    ${list.map(p => `
      <article class="person-card" data-name="${esc((p.name + ' ' + (p.alias || '') + ' ' + (p.charges || '')).toLowerCase())}"
        data-net="${esc(p.networkId || '')}" data-status="${esc(p.status)}" data-threat="${esc(p.threat)}">
        <div class="p-photo"><img src="${personPhoto(p)}" alt=""></div>
        <div class="p-body">
          <div class="p-name">${esc(p.name)}</div>
          <div class="p-alias">${esc(p.alias ? '"' + p.alias + '"' : 'بدون لقب معروف')}</div>
          <div class="p-meta">
            <span><i class="fa-solid fa-sitemap"></i> ${esc(netName(p.networkId))}</span>
            <span><i class="fa-solid fa-ranking-star"></i> ${esc(p.rank)}</span>
            ${p.bounty ? `<span><i class="fa-solid fa-sack-dollar"></i> ${fmtMoney(p.bounty)}</span>` : ''}
          </div>
          <div class="p-foot">
            ${statusChip(p.status)} ${threatChip(p.threat)}
            <button class="btn btn-ghost btn-sm" data-act="per:view" data-id="${p.id}"><i class="fa-solid fa-folder-open"></i> الملف</button>
            ${p.coords ? `<button class="btn btn-ghost btn-sm" data-act="map:focus" data-id="p:${p.id}"><i class="fa-solid fa-location-crosshairs"></i></button>` : ''}
          </div>
        </div>
      </article>`).join('')}
  </div>
  <div id="personEmpty" class="card empty" style="display:none"><i class="fa-solid ${DB.persons.length ? 'fa-magnifying-glass' : 'fa-user-plus'}"></i>
    <p>${DB.persons.length ? 'لا نتائج مطابقة لمعايير البحث.' : 'لا يوجد أشخاص مسجلون بعد — ابدأ بإضافة أول ملف.'}</p>
    ${DB.persons.length ? '' : `<button class="btn btn-primary" data-act="per:new"><i class="fa-solid fa-plus"></i> إضافة شخص</button>`}</div>`;
}

function mountPersons() {
  const apply = () => {
    const q = ($('#personSearch')?.value || '').trim().toLowerCase();
    const net = $('#filterNet')?.value || '';
    const st = $('#filterStatus')?.value || '';
    const th = $('#filterThreat')?.value || '';
    personFilters = { q, net, status: st, threat: th };
    let shown = 0;
    $$('#personGrid .person-card').forEach(card => {
      const ok = (!q || card.dataset.name.includes(q)) && (!net || card.dataset.net === net) &&
        (!st || card.dataset.status === st) && (!th || card.dataset.threat === th);
      card.style.display = ok ? '' : 'none';
      if (ok) shown++;
    });
    const c = $('#personCount');
    if (c) c.textContent = shown;
    const emptyEl = $('#personEmpty');
    if (emptyEl) emptyEl.style.display = shown ? 'none' : '';
  };
  ['#personSearch', '#filterNet', '#filterStatus', '#filterThreat'].forEach(sel => {
    const el = $(sel);
    if (!el) return;
    el.addEventListener('input', apply);
    el.addEventListener('change', apply);
  });
  apply();
}

function personForm(id, presetNetwork) {
  const p = id ? personById(id) : null;
  const data = p || {
    name: '', alias: '', dob: '', nationality: 'أمريكي', networkId: presetNetwork || '', rank: 'عضو',
    reportsTo: '', status: 'مطلوب', threat: 'متوسط', bounty: '', charges: '', phone: '', address: '',
    coords: null, notes: '', photo: ''
  };
  const netOpts = DB.networks.map(n => `<option value="${n.id}" ${data.networkId === n.id ? 'selected' : ''}>${esc(n.name)}</option>`).join('');
  const reportsOpts = DB.persons.filter(x => x.networkId === data.networkId && x.id !== id)
    .map(x => `<option value="${x.id}" ${data.reportsTo === x.id ? 'selected' : ''}>${esc(x.name)} — ${esc(x.rank)}</option>`).join('');

  openModal({
    title: p ? 'تعديل ملف الشخص' : 'تسجيل شخص جديد',
    icon: 'fa-user-secret', size: 'wide',
    body: `
      <div class="form-grid">
        <div class="field"><label>الاسم الكامل *</label><input class="inp" id="pf_name" value="${esc(data.name)}" placeholder="الاسم الحقيقي أو المرجّح"></div>
        <div class="field"><label>الاسم الحركي / اللقب</label><input class="inp" id="pf_alias" value="${esc(data.alias)}" placeholder="مثال: الشبح"></div>
        <div class="field"><label>تاريخ الميلاد</label><input class="inp" type="date" id="pf_dob" value="${esc(data.dob)}"></div>
        <div class="field"><label>الجنسية</label><input class="inp" id="pf_nationality" value="${esc(data.nationality)}"></div>
        <div class="field"><label>الشبكة / العصابة</label><select class="inp" id="pf_network">
          <option value="">— غير مرتبط (ذئب منفرد) —</option>${netOpts}</select></div>
        <div class="field"><label>المنصب داخل الشبكة</label><select class="inp" id="pf_rank">
          ${RANKS.map(r => `<option ${data.rank === r ? 'selected' : ''}>${r}</option>`).join('')}</select></div>
        <div class="field"><label>المُشرف المباشر</label><select class="inp" id="pf_reports"><option value="">— بدون مُشرف (قمة الهرم) —</option>${reportsOpts}</select></div>
        <div class="field"><label>حالة الشخص</label><select class="inp" id="pf_status">
          ${P_STATUS.map(s => `<option ${data.status === s ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
        <div class="field"><label>مستوى الخطورة</label><select class="inp" id="pf_threat">
          ${THREAT_LIST.map(t => `<option ${data.threat === t ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
        <div class="field"><label>المكافأة المعلنة ($)</label><input class="inp" id="pf_bounty" type="number" min="0" value="${esc(data.bounty)}" placeholder="0"></div>
        <div class="field"><label>الهاتف المسجل</label><input class="inp" id="pf_phone" value="${esc(data.phone)}" placeholder="555-0000"></div>
        <div class="field"><label>العنوان / آخر موقع معروف</label><input class="inp" id="pf_address" value="${esc(data.address)}" placeholder="الشارع، الحي"></div>
        <div class="field span-2"><label>الاتهامات والتهم المسجلة</label>
          <textarea class="inp" id="pf_charges" rows="2" placeholder="افصل بين التهم بعلامة ·">${esc(data.charges)}</textarea></div>
        <div class="field span-2">${imageUploader('pfPhoto', 'الصورة الشخصية (mugshot)', data.photo)}</div>
        <div class="field span-2">${galleryUploader('pfGallery', 'صور إضافية للمشتبه به (موقع، مركبة، وشم)', data.photos)}</div>
        <div class="field span-2"><label>الموقع على الخريطة — انقر لتحديد الموقع الأخير</label>
          <div id="pf_map" class="mini-map"></div>
          <div class="coord-line"><span>X <b id="pf_cx">${data.coords ? data.coords.x.toFixed(0) : '—'}</b></span>
            <span>Y <b id="pf_cy">${data.coords ? data.coords.y.toFixed(0) : '—'}</b></span>
            <input type="hidden" id="pf_x" value="${data.coords ? data.coords.x : ''}">
            <input type="hidden" id="pf_y" value="${data.coords ? data.coords.y : ''}"></div>
        </div>
        <div class="field span-2"><label>ملاحظات المحقق</label>
          <textarea class="inp" id="pf_notes" rows="2" placeholder="سلوكيات، تحركات، تحذيرات ميدانية...">${esc(data.notes)}</textarea></div>
      </div>`,
    footer: `<button class="btn btn-primary" data-act="per:save" data-id="${id || ''}"><i class="fa-solid fa-floppy-disk"></i> حفظ الملف</button>
             <button class="btn btn-ghost" data-act="modal:close">إلغاء</button>`
  });

  const netSel = activeModalEl.querySelector('#pf_network');
  netSel.addEventListener('change', () => {
    const opts = DB.persons.filter(x => x.networkId === netSel.value && x.id !== id)
      .map(x => `<option value="${x.id}">${esc(x.name)} — ${esc(x.rank)}</option>`).join('');
    activeModalEl.querySelector('#pf_reports').innerHTML = `<option value="">— بدون مُشرف (قمة الهرم) —</option>` + opts;
  });

  new TacticalMap(activeModalEl.querySelector('#pf_map'), {
    initial: data.coords || null,
    initialZoom: data.coords ? 1.8 : null,
    onPick: (c) => {
      activeModalEl.querySelector('#pf_x').value = c.x.toFixed(1);
      activeModalEl.querySelector('#pf_y').value = c.y.toFixed(1);
      activeModalEl.querySelector('#pf_cx').textContent = c.x.toFixed(0);
      activeModalEl.querySelector('#pf_cy').textContent = c.y.toFixed(0);
    }
  });
}

action('per:new', (presetNet) => personForm(null, presetNet || ''));
action('per:edit', (id) => personForm(id));

action('per:save', (id) => {
  const name = val('#pf_name');
  if (!name) return toast('اسم الشخص مطلوب', 'err');
  const x = parseFloat(val('#pf_x')), y = parseFloat(val('#pf_y'));
  const payload = {
    name, alias: val('#pf_alias'), dob: val('#pf_dob'), nationality: val('#pf_nationality'),
    networkId: val('#pf_network'), rank: val('#pf_rank') || 'عضو', reportsTo: val('#pf_reports'),
    status: val('#pf_status') || 'مطلوب', threat: val('#pf_threat') || 'متوسط',
    bounty: Number(val('#pf_bounty')) || 0, phone: val('#pf_phone'), address: val('#pf_address'),
    charges: val('#pf_charges'), notes: val('#pf_notes'), photo: val('#pfPhoto_id'),
    photos: (() => { try { return JSON.parse(val('#pfGallery_json') || '[]'); } catch (e) { return []; } })(),
    coords: (!isNaN(x) && !isNaN(y)) ? { x, y } : null
  };
  if (id) {
    Object.assign(personById(id), payload);
    logActivity(`تحديث ملف: ${name}`, 'person');
  } else {
    DB.persons.unshift(Object.assign({ id: uid('P'), addedAt: new Date().toISOString() }, payload));
    logActivity(`تسجيل شخص جديد: ${name}`, 'person');
  }
  save(); closeModal(); render(); toast('تم حفظ ملف الشخص');
});

action('per:view', (id) => {
  const p = personById(id); if (!p) return;
  const net = netById(p.networkId);
  const docs = DB.docs.filter(d => d.personId === id);
  const cases = DB.cases.filter(c => (c.personIds || []).includes(id));
  openModal({
    title: 'ملف الشخص — ' + p.name,
    icon: 'fa-id-card', size: 'wide',
    body: `
      <div class="profile-hero">
        <div class="profile-photo"><img src="${personPhoto(p)}" alt=""></div>
        <div style="flex:1;min-width:240px">
          <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
            ${statusChip(p.status)} ${threatChip(p.threat)}
            ${p.bounty ? `<span class="chip chip-amber"><i class="fa-solid fa-sack-dollar"></i> مكافأة ${fmtMoney(p.bounty)} $</span>` : ''}
          </div>
          <div class="section-title">البيانات الأساسية</div>
          <dl class="kv">
            <dt>الاسم الكامل</dt><dd>${esc(p.name)}</dd>
            <dt>الاسم الحركي</dt><dd>${esc(p.alias || '—')}</dd>
            <dt>تاريخ الميلاد</dt><dd>${esc(p.dob || '—')} ${p.dob ? '' : ''}</dd>
            <dt>الجنسية</dt><dd>${esc(p.nationality || '—')}</dd>
            <dt>الشبكة</dt><dd>${esc(net ? net.name : 'غير مرتبط')}</dd>
            <dt>المنصب</dt><dd>${esc(p.rank)}</dd>
            <dt>المُشرف</dt><dd>${esc(p.reportsTo ? (personById(p.reportsTo)?.name || '—') : '—')}</dd>
            <dt>الهاتف</dt><dd class="mono">${esc(p.phone || '—')}</dd>
            <dt>العنوان</dt><dd>${esc(p.address || '—')}</dd>
            <dt>الموقع</dt><dd>${p.coords ? `X ${p.coords.x.toFixed(0)} · Y ${p.coords.y.toFixed(0)}` : '—'}</dd>
          </dl>
        </div>
      </div>

      <div class="section-title">الاتهامات</div>
      <p style="font-size:.82rem;line-height:1.9">${p.charges ? p.charges.split('·').map(c => `<span class="chip chip-red" style="margin:0 3px 5px 0">${esc(c.trim())}</span>`).join('') : '<span class="muted tiny">لا تهم مسجلة.</span>'}</p>

      ${(p.photos || []).length ? `<div class="section-title">صور إضافية (${p.photos.length})</div>
        <div class="gal-list">${p.photos.map(id => `<span class="gal-item big" data-act="file:open" data-id="${id}" title="فتح الصورة"><img src="${FileStore.url(id)}" alt=""></span>`).join('')}</div>` : ''}

      ${p.notes ? `<div class="section-title">ملاحظات المحقق</div><p style="font-size:.82rem;line-height:1.9;color:var(--muted)">${esc(p.notes)}</p>` : ''}

      <div class="section-title">الارتباطات</div>
      <div class="chips">
        <span class="chip">مذكرات: ${docs.length}</span>
        <span class="chip">قضايا: ${cases.length}</span>
        <span class="chip">أُضيف: ${fmtDate(p.addedAt)}</span>
      </div>
      ${cases.length ? `<div class="mt">${cases.map(c => `<div class="loc-item" style="margin-bottom:7px"><span class="loc-ico i-cyan" style="background:rgba(61,127,184,.16);color:#9fc7e8;display:grid"><i class="fa-solid fa-folder-open"></i></span>
        <div><div class="loc-name">${esc(c.title)}</div><div class="loc-sub">${esc(c.code)}</div></div>
        <div class="loc-actions"><button class="btn btn-ghost btn-sm" data-act="case:view" data-id="${c.id}">عرض</button></div></div>`).join('')}</div>` : ''}
    `,
    footer: `
      <button class="btn btn-primary" data-act="per:print" data-id="${p.id}"><i class="fa-solid fa-print"></i> نشرة مطلوب / PDF</button>
      <button class="btn btn-ghost" data-act="per:edit" data-id="${p.id}"><i class="fa-solid fa-pen"></i> تعديل</button>
      ${p.coords ? `<button class="btn btn-ghost" data-act="map:focus" data-id="p:${p.id}"><i class="fa-solid fa-map-location-dot"></i> الخريطة</button>` : ''}
      <button class="btn btn-ghost" data-act="doc:new" data-id="${p.id}"><i class="fa-solid fa-file-signature"></i> مذكرة</button>
      <button class="btn btn-danger" data-act="per:del" data-id="${p.id}"><i class="fa-solid fa-trash"></i></button>
      <button class="btn btn-ghost" data-act="modal:close">إغلاق</button>`
  });
});

action('per:del', (id) => {
  const p = personById(id); if (!p) return;
  confirmDialog({
    title: 'حذف ملف الشخص', danger: true, confirmText: 'حذف نهائي',
    text: `سيتم حذف ملف «${p.name}» نهائياً من الأرشيف.`,
    onConfirm: () => {
      DB.persons = DB.persons.filter(x => x.id !== id);
      DB.persons.forEach(x => { if (x.reportsTo === id) x.reportsTo = ''; });
      logActivity(`حذف ملف: ${p.name}`, 'person');
      save(); closeModal(); render(); toast('تم حذف الملف');
    }
  });
});

/* ============================================================
   GLOBAL WIRING
   ============================================================ */
action('go', (id) => go(id || 'dashboard'));
action('toggle-nav', () => $('#sidebar').classList.toggle('open'));
action('modal:close', () => closeModal());
action('noop', () => { });
action('confirm:yes', () => {
  const cb = _confirmCb;
  _confirmCb = null;
  closeModal();
  if (cb) cb();
});
action('file:open', (id) => openFile(id));
action('file:download', (id) => downloadFile(id));

function bindGlobal() {
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]');
    if (!el) return;
    const act = el.dataset.act;
    if (act === 'noop') return;
    const fn = ACTIONS[act];
    if (!fn) return;
    if (typeof Auth !== 'undefined' && Auth.allowed && !Auth.allowed(act)) {
      e.preventDefault();
      toast(Auth.isDoj() ? 'هذا الإجراء غير متاح لحساب وزارة العدل' : 'هذا الإجراء متاح للعميل A-140 فقط', 'err');
      return;
    }
    e.preventDefault();
    fn(el.dataset.id, el, e);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && $('#modalRoot').classList.contains('open')) closeModal();
    if ((e.ctrlKey || e.metaKey) && String(e.key).toLowerCase() === 'k') {
      e.preventDefault();
      if (!$('#authRoot').classList.contains('open')) ACTIONS['search:open'] && ACTIONS['search:open']();
    }
  });
}

async function boot() {
  const remote = typeof Api !== 'undefined' && await Api.probe();

  if (remote) {
    const accounts = await Api.accounts().catch(() => []);
    Auth.setRemote(accounts);
    if (!(await Api.seeded().catch(() => true))) {
      /* أول تشغيل على قاعدة فارغة: نزرع الأرشيف والحسابات الافتراضية */
      DB = normalizeState(seedState());
      await Auth.ensureAccounts();
      await Api.bootstrap(DB);
    }
    const session = await Api.session().catch(() => null);
    if (session) {
      try {
        sessionStorage.setItem('fib140.unlocked', '1');
        sessionStorage.setItem('fib140.user', session);
        DB = normalizeState(await Api.getState());
        remoteReady = true;
        await FileStore.init();
      } catch (e) {
        console.warn('state load failed', e);
      }
    }
    Api.watch((data, conflict) => {
      DB = normalizeState(data);
      remoteReady = true;
      if (conflict) toast('حُدِّثت البيانات من مستخدم آخر — حُمِّلت أحدث نسخة', 'info');
      render(); updateChrome();
    });
  } else {
    await FileStore.init();
    DB = loadState();
  }

  bindGlobal();
  registerPage('dashboard', pageDashboard);
  registerPage('networks', pageNetworks);
  registerPage('persons', pagePersons);
  registerMount('persons', mountPersons);
  const bs = $('#brandSeal');
  if (bs) bs.innerHTML = fbiSeal('seal-lg');
  const fav = $('#favicon');
  if (fav) fav.href = 'assets/fbi-seal.svg';
  if (!DB) DB = normalizeState(seedState());
  const unlocked = await Auth.gate();
  if (unlocked && DB) render();
  tickClock();
  setInterval(tickClock, 1000);
  updateChrome();
}

document.addEventListener('DOMContentLoaded', boot);
