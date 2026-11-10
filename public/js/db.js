/* ============================================================
   FileStore — IndexedDB backed storage for photos, signatures,
   PDFs and any other evidence attachments.
   Files are cached in memory after boot so views can read them
   synchronously (records hold only the file id).
   ============================================================ */
const FileStore = (() => {
  const DB_NAME = 'fib140_files';
  const STORE = 'files';
  const cache = new Map();
  let db = null;

  function open() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const d = req.result;
        if (!d.objectStoreNames.contains(STORE)) d.createObjectStore(STORE, { keyPath: 'id' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function init() {
    /* الوضع المشترك: الملفات محفوظة في PostgreSQL عبر الخادم */
    if (typeof Api !== 'undefined' && Api.isRemote()) {
      try {
        const files = await Api.listFiles();
        files.forEach(f => cache.set(f.id, f));
        return;
      } catch (e) {
        console.warn('[FileStore] server files unavailable', e);
      }
    }
    try {
      db = await open();
      await new Promise((resolve) => {
        const tx = db.transaction(STORE, 'readonly');
        const rq = tx.objectStore(STORE).getAll();
        rq.onsuccess = () => { (rq.result || []).forEach(f => cache.set(f.id, f)); resolve(); };
        rq.onerror = () => resolve();
      });
    } catch (err) {
      console.warn('[FileStore] IndexedDB unavailable, files will not persist.', err);
    }
  }

  function newId() {
    return 'F' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  async function put(record) {
    const rec = { id: record.id || newId(), name: record.name || 'file', type: record.type || '', dataUrl: record.dataUrl, size: record.size || record.dataUrl.length, at: Date.now() };
    cache.set(rec.id, rec);
    if (typeof Api !== 'undefined' && Api.isRemote()) Api.putFile(rec);
    if (db) {
      try {
        const tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).put(rec);
      } catch (e) { console.warn('[FileStore] write failed', e); }
    }
    return rec.id;
  }

  function get(id) { return cache.get(id) || null; }
  function url(id) { const f = cache.get(id); return f ? f.dataUrl : ''; }
  function name(id) { const f = cache.get(id); return f ? f.name : ''; }
  function size(id) { const f = cache.get(id); return f ? (f.size || 0) : 0; }

  function remove(id) {
    cache.delete(id);
    if (typeof Api !== 'undefined' && Api.isRemote()) Api.deleteFile(id);
    if (db) {
      try {
        const tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).delete(id);
      } catch (e) { console.warn('[FileStore] delete failed', e); }
    }
  }

  function usage() {
    let bytes = 0;
    cache.forEach(f => { bytes += (f.size || f.dataUrl.length || 0); });
    return bytes;
  }

  function readAsDataURL(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = () => reject(r.error);
      r.readAsDataURL(file);
    });
  }

  /* downscale + recompress photos so the archive stays light */
  async function storeImage(file, maxDim = 1100, quality = 0.84) {
    const dataUrl = await readAsDataURL(file);
    try {
      const img = await new Promise((res, rej) => {
        const im = new Image();
        im.onload = () => res(im);
        im.onerror = rej;
        im.src = dataUrl;
      });
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const cv = document.createElement('canvas');
      cv.width = w; cv.height = h;
      cv.getContext('2d').drawImage(img, 0, 0, w, h);
      const out = cv.toDataURL('image/jpeg', quality);
      return put({ name: file.name, type: 'image/jpeg', dataUrl: out, size: Math.round(out.length * 0.75) });
    } catch (e) {
      return put({ name: file.name, type: file.type, dataUrl, size: file.size });
    }
  }

  async function storeRaw(file) {
    const dataUrl = await readAsDataURL(file);
    return put({ name: file.name, type: file.type, dataUrl, size: file.size });
  }

  return { init, put, get, url, name, size, remove, usage, readAsDataURL, storeImage, storeRaw, cache };
})();
