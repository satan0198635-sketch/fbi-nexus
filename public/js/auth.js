/* ============================================================
   A-140 · AUTH — authorized user accounts (username + password),
   session lock, role permissions, auto-lock.
   Passwords are stored as salted SHA-256 digests; only the
   accounts seeded here (or added by A-140) can enter.
   ============================================================ */
const Auth = (() => {
  const SESSION_KEY = 'fib140.unlocked';
  const USER_KEY = 'fib140.user';
  const AUTO_LOCK_MS = 15 * 60 * 1000;
  let timer = null;
  let lastActivity = Date.now();
  let remoteAccounts = [];
  const remoteMode = () => (typeof Api !== 'undefined' && Api.isRemote());
  function setRemote(list) { remoteAccounts = Array.isArray(list) ? list.map(a => String(a)) : []; }

  /* الحسابات المخوّلة الافتراضية — تُزرع مرة واحدة */
  const DEFAULTS = [
    {
      user: 'A-140', pass: '11779933', full: true,
      name: 'العميل A-140', rank: 'محقق فيدرالي متقدم',
      division: 'وحدة العمليات الخاصة — لوس سانتوس', clearance: 'CLEARANCE 5'
    },
    {
      user: 'A-8', pass: 'A8-6Qx4mT9', full: false,
      name: 'العميل A-8', rank: 'محقق فيدرالي',
      division: 'وحدة العمليات الخاصة — لوس سانتوس', clearance: 'CLEARANCE 3'
    },
    {
      user: 'A', pass: 'A-9Zr2vK7', full: false,
      name: 'العميل A', rank: 'محقق فيدرالي',
      division: 'وحدة العمليات الخاصة — لوس سانتوس', clearance: 'CLEARANCE 2'
    }
  ];

  /* الرتب والمواقع المعتمدة داخل مكتب التحقيقات الفيدرالي */
  const RANKS = [
    'رئيس الـFBI (المدير)',
    'نائب مدير الـFBI',
    'مساعد المدير التنفيذي',
    'مساعد المدير',
    'رئيس التحقيق',
    'نائب رئيس التحقيق',
    'رئيس المباحث الفيدرالية',
    'مشرف وحدة',
    'محقق فيدرالي متقدم',
    'محقق فيدرالي',
    'عميل خاص أول',
    'عميل خاص',
    'محلل استخبارات',
    'محلل جنائي',
    'فني أدلة',
    'ضابط اتصال'
  ];

  /* إجراءات محصورة بالعميل A-140 (كامل الصلاحيات) */
  const RESTRICTED = ['data:wipe', 'set:reset', 'user:add', 'user:del', 'user:reset', 'user:edit'];

  /* حسابات وزارة العدل: اعتماد المذكرات والاطلاع على القضايا المرفوعة فقط */
  const DOJ_ROLE = 'doj';
  const DOJ_ACTIONS = [
    'go', 'noop', 'modal:close', 'lock:now', 'file:open', 'file:download',
    'doc:view', 'doc:approve', 'doc:reject', 'doc:print',
    'doj:case', 'doj:case-approve', 'doj:case-reject', 'doj:comment', 'case:print', 'acct:media'
  ];
  const DOJ_PAGES = ['documents', 'doj'];

  const sec = () => (DB.settings.security = DB.settings.security || {});
  const users = () => (Array.isArray(sec().users) ? sec().users : (sec().users = []));
  const hasUsers = () => users().length > 0;

  function sha256(text) {
    return crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
      .then(buf => Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join(''));
  }
  function newSalt() {
    const a = crypto.getRandomValues(new Uint8Array(16));
    return Array.from(a).map(b => b.toString(16).padStart(2, '0')).join('');
  }
  const passHash = (pass, s) => sha256(s + ':' + pass + ':A140');
  const normUser = u => String(u || '').trim();

  const publicUser = u => ({
    user: u.user, name: u.name || ('العميل ' + u.user), rank: u.rank || '',
    division: u.division || '', clearance: u.clearance || (u.full ? 'CLEARANCE 5' : u.role === DOJ_ROLE ? 'DOJ ACCESS' : 'CLEARANCE 2'),
    role: u.role === DOJ_ROLE ? DOJ_ROLE : 'fib',
    full: !!u.full, signature: u.signature || '', seal: u.seal || '', createdAt: u.createdAt || null
  });

  /* ---------------- seeding / migration ---------------- */
  async function seed(defaults, reason) {
    const s = sec();
    s.users = [];
    for (const acc of defaults) {
      const salt = newSalt();
      s.users.push({
        user: normUser(acc.user), salt, hash: await passHash(acc.pass, salt),
        name: acc.name, rank: acc.rank, division: acc.division, clearance: acc.clearance,
        role: 'fib', full: !!acc.full, failed: 0, lockUntil: 0, createdAt: Date.now()
      });
    }
    /* إزالة رمز PIN القديم — الدخول أصبح بالحسابات فقط */
    if (s.hash || s.salt) { delete s.hash; delete s.salt; }
    save();
    if (typeof logActivity === 'function') {
      logActivity(reason || 'تهيئة الحسابات المخوّلة للدخول', 'auth');
      save();
    }
  }

  async function ensureAccounts() {
    if (hasUsers()) return false;
    await seed(DEFAULTS, 'تهيئة الحسابات المخوّلة — A-140 / A-8 / A');
    return true;
  }

  function current() {
    let key = '';
    try { key = sessionStorage.getItem(USER_KEY) || ''; } catch (e) { }
    if (!key) return null;
    const u = users().find(x => x.user === key);
    return u ? publicUser(u) : null;
  }
  const isAdmin = () => !!current()?.full;
  const isDoj = () => current()?.role === DOJ_ROLE;
  const allowed = (name) => {
    const u = current();
    if (!u) return true;
    if (u.role === DOJ_ROLE) return DOJ_ACTIONS.indexOf(name) !== -1;
    if (u.full) return true;
    return RESTRICTED.indexOf(name) === -1;
  };
  const canPage = (page) => {
    const u = current();
    if (!u) return false;
    if (u.role === DOJ_ROLE) return DOJ_PAGES.indexOf(page) !== -1;
    return true;
  };
  const homePage = () => (isDoj() ? 'documents' : 'dashboard');

  /* ---------------- screens ---------------- */
  function mount(html) {
    const root = $('#authRoot');
    if (!root) return;
    root.innerHTML = html;
    root.classList.add('open');
  }
  function unmount() {
    const root = $('#authRoot');
    if (!root) return;
    root.classList.remove('open');
    root.innerHTML = '';
  }

  function frame(title, sub, inner) {
    return `<div class="auth-screen">
      <div class="auth-grid">
        <aside class="auth-brand">
          <div class="auth-seal">${fbiSeal('')}</div>
          <div class="auth-org">FBI-NEXUS</div>
          <div class="auth-org-ar">مكتب التحقيقات الفيدرالي · لوس سانتوس</div>
          <div class="auth-office">NETWORK FOR ENFORCEMENT · X-INTELLIGENCE · UNIFIED SECURITY</div>
          <div class="auth-office" style="margin-top:2px;opacity:.75">LOS SANTOS FIELD OFFICE</div>
          <div class="auth-class">SECRET // LAW ENFORCEMENT SENSITIVE</div>
          <div class="auth-legal">الوصول مقيّد للأفراد المصرّح لهم فقط. تُسجَّل جميع عمليات الدخول والقفل في سجل التدقيق.</div>
        </aside>
        <section class="auth-panel">
          <div class="auth-eyebrow">SECURE ACCESS TERMINAL</div>
          <h2>${title}</h2>
          <p class="auth-sub">${sub}</p>
          ${inner}
          <div class="auth-foot">
            <span><i class="fa-solid fa-shield-halved"></i> SECURE SESSION</span>
            <span><i class="fa-solid fa-lock"></i> AES-256</span>
            <span><i class="fa-solid fa-database"></i> LOCAL ARCHIVE</span>
          </div>
        </section>
      </div>
    </div>`;
  }

  function lockScreen(mode = 'unlock', msg = '') {
    if (typeof closeModal === 'function') closeModal();
    const known = remoteMode() && remoteAccounts.length ? remoteAccounts : users().map(u => u.user);
    const list = known.join(' · ') || '—';
    mount(frame(
      mode === 'auto' ? 'تم قفل الجلسة' : 'الدخول إلى النظام',
      mode === 'auto'
        ? 'قُفلت الجلسة تلقائياً بعد فترة عدم نشاط. أدخل اسم المستخدم وكلمة المرور لمتابعة العمل.'
        : 'أدخل اسم المستخدم وكلمة المرور للحساب المخوّل للوصول إلى الأرشيف الفيدرالي.',
      `<div class="auth-form">
        <div class="auth-field">
          <label for="au_user"><i class="fa-solid fa-user-shield"></i> اسم المستخدم</label>
          <input class="inp" id="au_user" autocomplete="username" spellcheck="false" placeholder="A-140" dir="ltr">
        </div>
        <div class="auth-field">
          <label for="au_pass"><i class="fa-solid fa-key"></i> كلمة المرور</label>
          <input class="inp" id="au_pass" type="password" autocomplete="current-password" placeholder="••••••••" dir="ltr">
        </div>
        <div class="auth-error" id="au_err">${esc(msg)}</div>
        <button class="btn auth-btn" id="au_submit"><i class="fa-solid fa-shield-halved"></i><span>دخول آمن</span></button>
        <div class="auth-policy">
          <div class="auth-policy-head"><i class="fa-solid fa-id-card-clip"></i> الحسابات المخوّلة</div>
          <div class="auth-accounts">${known.map(u => `<b>${esc(u)}</b>`).join('') || '<b>—</b>'}</div>
          <div class="auth-policy-note">لا يمكن إنشاء حساب أو استعادة كلمة المرور إلا من داخل النظام بصلاحية العميل A-140. تُسجَّل كل محاولات الدخول.</div>
        </div>
      </div>`));

    const submit = async () => {
      const err = $('#au_err');
      const name = normUser(val('#au_user'));
      const pass = val('#au_pass');
      if (!name || !pass) { err.textContent = 'أدخل اسم المستخدم وكلمة المرور'; return; }

      /* الوضع المشترك: التحقق يتم على الخادم مقابل قاعدة PostgreSQL */
      if (remoteMode()) {
        const btn = $('#au_submit');
        if (btn) btn.disabled = true;
        try {
          const r = await Api.login(name, pass);
          if (!r.ok) {
            err.textContent = r.error === 'locked' ? 'الحساب مقفل مؤقتاً — أعد المحاولة بعد دقيقة'
              : r.error === 'too_many_attempts' ? 'محاولات كثيرة — حاول بعد قليل'
                : r.error === 'db_unavailable' ? 'قاعدة البيانات غير متاحة'
                  : 'اسم المستخدم أو كلمة المرور غير صحيحة';
            $('#au_pass').value = '';
            return;
          }
          DB = normalizeState(await Api.getState());
          remoteReady = true;
          await FileStore.init();
          const acc = users().find(x => x.user === name);
          if (!acc) { err.textContent = 'الحساب غير موجود في قاعدة البيانات'; return; }
          await unlock(acc);
        } catch (e) {
          err.textContent = 'تعذر الاتصال بالخادم — أعد المحاولة';
        } finally {
          if (btn) btn.disabled = false;
        }
        return;
      }

      const u = users().find(x => x.user === name);
      if (!u) {
        err.textContent = 'اسم المستخدم أو كلمة المرور غير صحيحة';
        $('#au_pass').value = '';
        return;
      }
      if (u.lockUntil && Date.now() < u.lockUntil) {
        err.textContent = 'الحساب مقفل مؤقتاً — أعد المحاولة بعد دقيقة';
        return;
      }
      const h = await passHash(pass, u.salt);
      if (h !== u.hash) {
        u.failed = (u.failed || 0) + 1;
        if (u.failed >= 5) {
          u.lockUntil = Date.now() + 60000;
          u.failed = 0;
          save();
          err.textContent = 'تجاوزت عدد المحاولات المسموحة — الحساب مقفل دقيقة';
          $('#au_pass').value = '';
          return;
        }
        save();
        err.textContent = `بيانات الدخول غير صحيحة — المحاولة ${u.failed} من 5`;
        $('#au_pass').value = '';
        return;
      }
      u.failed = 0; u.lockUntil = 0; u.lastLogin = Date.now();
      await unlock(u);
    };
    $('#au_submit').addEventListener('click', submit);
    ['#au_user', '#au_pass'].forEach(sel => $(sel)?.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); }));
    setTimeout(() => {
      const uInp = $('#au_user');
      if (!uInp) return;
      (uInp.value ? $('#au_pass') : uInp)?.focus();
    }, 120);
  }

  /* ---------------- session ---------------- */
  async function unlock(u) {
    unmount();
    try {
      sessionStorage.setItem(SESSION_KEY, '1');
      sessionStorage.setItem(USER_KEY, u.user);
    } catch (e) { }
    DB.settings.activeUser = u.user;
    lastActivity = Date.now();
    startAutoLock();
    if (typeof logActivity === 'function') logActivity(`دخول آمن — ${u.user}`, 'auth');
    save();
    if (RENDERERS[route.page]) render(); else go('dashboard');
    if (typeof toast === 'function') toast('مرحباً ' + (u.name || u.user));
  }

  function startAutoLock() {
    stopAutoLock();
    timer = setInterval(() => {
      if (Date.now() - lastActivity > AUTO_LOCK_MS) lockNow();
    }, 30000);
  }
  function stopAutoLock() { if (timer) clearInterval(timer); timer = null; }

  function lockNow() {
    const root = $('#authRoot');
    if (root && root.classList.contains('open')) return;
    stopAutoLock();
    if (remoteMode()) Api.logout();
    try {
      sessionStorage.removeItem(SESSION_KEY);
      sessionStorage.removeItem(USER_KEY);
    } catch (e) { }
    if (typeof logActivity === 'function') logActivity('قفل الجلسة', 'auth');
    save();
    lockScreen('auto');
  }

  async function gate() {
    if (remoteMode()) {
      const serverUser = await Api.session().catch(() => null);
      const known = serverUser && users().some(u => u.user === serverUser);
      if (known) {
        try {
          sessionStorage.setItem(SESSION_KEY, '1');
          sessionStorage.setItem(USER_KEY, serverUser);
        } catch (e) { }
        DB.settings.activeUser = serverUser;
        lastActivity = Date.now();
        startAutoLock();
        return true;
      }
      try { sessionStorage.removeItem(SESSION_KEY); sessionStorage.removeItem(USER_KEY); } catch (e) { }
      lockScreen('unlock');
      return false;
    }

    await ensureAccounts();
    let session = false, key = '';
    try {
      session = sessionStorage.getItem(SESSION_KEY) === '1';
      key = sessionStorage.getItem(USER_KEY) || '';
    } catch (e) { }
    const known = key && users().some(u => u.user === key);
    if (session && known) {
      lastActivity = Date.now();
      startAutoLock();
      return true;
    }
    lockScreen('unlock');
    return false;
  }

  /* ---------------- account management ---------------- */
  function me() {
    const c = current();
    return c ? users().find(u => u.user === c.user) : null;
  }

  /* توقيع وختم الحساب الحالي */
  function media() {
    const u = me();
    return { signature: (u && u.signature) || '', seal: (u && u.seal) || '' };
  }

  function setMedia(ids) {
    const u = me();
    if (!u) return 'لا توجد جلسة مفتوحة';
    if (ids && 'signature' in ids) u.signature = ids.signature || '';
    if (ids && 'seal' in ids) u.seal = ids.seal || '';
    save();
    return 'ok';
  }

  function updateProfile(data) {
    const u = me();
    if (!u) return 'لا توجد جلسة مفتوحة';
    if (data && data.name != null) u.name = String(data.name).trim() || ('العميل ' + u.user);
    if (data && data.rank != null && RANKS.indexOf(data.rank) !== -1) u.rank = data.rank;
    if (data && data.division != null) u.division = String(data.division).trim();
    save();
    return 'ok';
  }

  function updateUser(user, data) {
    if (!isAdmin()) return 'هذا الإجراء متاح للعميل A-140 فقط';
    const u = users().find(x => x.user === normUser(user));
    if (!u) return 'الحساب غير موجود';
    if (data && data.name != null) u.name = String(data.name).trim() || ('العميل ' + u.user);
    if (data && data.rank != null && RANKS.indexOf(data.rank) !== -1) u.rank = data.rank;
    if (data && data.division != null) u.division = String(data.division).trim();
    if (data && data.clearance != null) u.clearance = String(data.clearance).trim();
    if (data && typeof data.full === 'boolean' && u.role !== DOJ_ROLE) u.full = data.full;
    save();
    return 'ok';
  }

  async function changePass(currentPass, nextPass) {
    const u = me();
    if (!u) return 'لا توجد جلسة مفتوحة';
    const h = await passHash(currentPass, u.salt);
    if (h !== u.hash) return 'كلمة المرور الحالية غير صحيحة';
    if (!nextPass || String(nextPass).length < 6) return 'كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل';
    u.salt = newSalt();
    u.hash = await passHash(nextPass, u.salt);
    save();
    return 'ok';
  }

  async function addUser(data) {
    if (!isAdmin()) return 'هذا الإجراء متاح للعميل A-140 فقط';
    const name = normUser(data.user);
    const pass = String(data.pass || '');
    if (!/^[A-Za-z0-9_-]{1,24}$/.test(name)) return 'اسم المستخدم يجب أن يكون أحرفاً إنجليزية/أرقاماً (بدون مسافات)';
    if (users().some(u => u.user.toLowerCase() === name.toLowerCase())) return 'اسم المستخدم مستخدم مسبقاً';
    if (pass.length < 6) return 'كلمة المرور يجب أن تكون 6 أحرف على الأقل';
    const salt = newSalt();
    const doj = data.role === DOJ_ROLE;
    users().push({
      user: name, salt, hash: await passHash(pass, salt),
      name: data.name || (doj ? 'ممثل وزارة العدل — ' + name : 'العميل ' + name),
      rank: doj ? 'اعتماد وزارة العدل' : (RANKS.indexOf(data.rank) !== -1 ? data.rank : 'محقق فيدرالي'),
      division: data.division || (doj ? 'وزارة العدل — مكتب الاعتماد القضائي' : 'وحدة العمليات الخاصة — لوس سانتوس'),
      clearance: doj ? 'DOJ ACCESS' : (data.full ? 'CLEARANCE 5' : 'CLEARANCE 2'),
      role: doj ? DOJ_ROLE : 'fib',
      full: doj ? false : !!data.full, failed: 0, lockUntil: 0, createdAt: Date.now()
    });
    save();
    return 'ok';
  }

  async function resetPass(user, pass) {
    if (!isAdmin()) return 'هذا الإجراء متاح للعميل A-140 فقط';
    const u = users().find(x => x.user === normUser(user));
    if (!u) return 'الحساب غير موجود';
    if (String(pass).length < 6) return 'كلمة المرور يجب أن تكون 6 أحرف على الأقل';
    u.salt = newSalt();
    u.hash = await passHash(pass, u.salt);
    u.failed = 0; u.lockUntil = 0;
    save();
    return 'ok';
  }

  function removeUser(user) {
    if (!isAdmin()) return 'هذا الإجراء متاح للعميل A-140 فقط';
    const key = normUser(user);
    const target = users().find(u => u.user === key);
    if (!target) return 'الحساب غير موجود';
    const admins = users().filter(u => u.full).length;
    if (target.full && admins <= 1) return 'لا يمكن حذف آخر حساب كامل الصلاحيات';
    if (current()?.user === key) return 'لا يمكن حذف الحساب المفتوح حالياً';
    sec().users = users().filter(u => u.user !== key);
    save();
    return 'ok';
  }

  ['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach(ev =>
    document.addEventListener(ev, () => { lastActivity = Date.now(); }, { passive: true }));  return {
    setRemote, gate, lockNow, lockScreen, ensureAccounts, current, isAdmin, isDoj, allowed, canPage, homePage, hasUsers,
    changePass, addUser, resetPass, removeUser, media, setMedia, updateProfile, updateUser,
    RANKS,
    list: () => users().map(publicUser),
    RESTRICTED
  };
})();
