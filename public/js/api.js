/* ============================================================
   FBI-NEXUS · API — shared PostgreSQL backend client.
   When /api/health is unavailable (e.g. GitHub Pages static
   hosting) the app falls back to local-only mode.
   ============================================================ */
const Api = (() => {
  const BASE = 'api/';
  let remote = false;
  let rev = 0;
  let queue = null;
  let pending = null;
  let saving = false;
  let onChange = null;
  let watchTimer = null;

  const url = (p) => BASE + p;

  async function call(method, p, body) {
    const res = await fetch(url(p), {
      method,
      credentials: 'same-origin',
      cache: 'no-store',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined
    });
    let data = null;
    try { data = await res.json(); } catch (e) { }
    return { status: res.status, ok: res.ok, data: data || {} };
  }

  async function probe() {
    try {
      const r = await call('GET', 'health');
      remote = !!(r.ok && r.data && r.data.ok && r.data.db);
      if (remote) rev = Number(r.data.rev) || 0;
    } catch (e) {
      remote = false;
    }
    return remote;
  }

  const isRemote = () => remote;

  async function accounts() {
    const r = await call('GET', 'accounts');
    return (r.data && r.data.accounts) || [];
  }
  async function seeded() {
    const r = await call('GET', 'accounts');
    return !!(r.data && r.data.seeded);
  }
  async function bootstrap(state) {
    const r = await call('POST', 'bootstrap', { data: state });
    if (r.ok || r.status === 409) {
      const s = await call('GET', 'accounts');
      if (s.data && s.data.seeded) rev = 0;
      return true;
    }
    return false;
  }
  async function login(user, pass) {
    const r = await call('POST', 'login', { user, pass });
    return { ok: r.ok, error: (r.data && r.data.error) || 'server_error' };
  }
  async function logout() {
    try { await call('POST', 'logout'); } catch (e) { }
  }
  async function session() {
    try {
      const r = await call('GET', 'session');
      return (r.data && r.data.user) || null;
    } catch (e) { return null; }
  }

  async function getState() {
    const r = await call('GET', 'state');
    if (!r.ok) {
      const err = new Error((r.data && r.data.error) || 'state_failed');
      err.status = r.status;
      throw err;
    }
    rev = Number(r.data.rev) || 0;
    return r.data.data;
  }

  function queueSave(state) {
    pending = state;
    if (saving || queue) return;
    queue = setTimeout(flush, 500);
  }

  async function flush() {
    queue = null;
    if (!remote || saving || !pending) return;
    const state = pending;
    pending = null;
    saving = true;
    try {
      const r = await call('PUT', 'state', { baseRev: rev, data: state });
      if (r.ok) {
        rev = Number(r.data.rev) || rev;
      } else if (r.status === 409) {
        rev = Number(r.data.rev) || rev;
        if (onChange && r.data.data) onChange(r.data.data, true);
      } else if (r.status === 401) {
        if (typeof toast === 'function') toast('انتهت جلسة الخادم — أعد تسجيل الدخول', 'err');
      }
    } catch (e) {
      if (typeof toast === 'function') toast('تعذر مزامنة البيانات مع الخادم', 'err');
    } finally {
      saving = false;
      if (pending) queueSave(pending);
    }
  }

  async function listFiles() {
    const r = await call('GET', 'files');
    const files = (r.ok && r.data && r.data.files) || [];
    return files.map(f => ({ id: f.id, name: f.name, type: f.type, size: f.size, dataUrl: f.data, at: f.at }));
  }
  function putFile(rec) {
    call('PUT', 'files', {
      id: rec.id, name: rec.name, type: rec.type,
      size: rec.size, data: rec.dataUrl, at: rec.at
    }).catch(() => { });
  }
  function deleteFile(id) {
    call('DELETE', 'files/' + encodeURIComponent(id)).catch(() => { });
  }

  /* يفحص الخادم دوريًا ويبلّغ الواجهة عند تغيّر النسخة */
  function watch(cb) {
    onChange = cb;
    if (!remote) return;
    clearInterval(watchTimer);
    watchTimer = setInterval(async () => {
      if (saving || pending || document.hidden) return;
      if (document.getElementById('modalRoot')?.classList.contains('open')) return;
      try {
        const r = await call('GET', 'health');
        if (!r.ok) return;
        const serverRev = Number(r.data.rev) || 0;
        if (serverRev > rev) {
          const data = await getState();
          if (onChange) onChange(data, false);
        }
      } catch (e) { }
    }, 20000);
  }

  return {
    probe, isRemote, accounts, seeded, bootstrap, login, logout, session,
    getState, queueSave, listFiles, putFile, deleteFile, watch,
    rev: () => rev
  };
})();
