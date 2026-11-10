/* ============================================================
   A-140 · OPS — map, documents, bulletins, cases, settings, print
   ============================================================ */

/* ============================================================
   MAP
   ============================================================ */
let mapPageInstance = null;
let mapFilter = { person: true, network: true, marker: true };
let mapArea = 'city';
const LS_MAP_AREA = { x: 321.875, y: 618.75, w: 300, h: 300 };

function pageMap() {
  const total = DB.persons.filter(p => p.coords).length + DB.networks.filter(n => n.coords).length + DB.markers.length;
  return `
  <div class="page-head">
    <div>
      <h2><i class="fa-solid fa-map-location-dot"></i> ${mapArea === 'city' ? 'خريطة لوس سانتوس التشغيلية' : 'خريطة سان أندرياس التشغيلية'}</h2>
      <p>${mapArea === 'city'
        ? 'خريطة مدينة لوس سانتوس بكامل أحيائها ومينائها ومطارها — حرّك، كبّر، والتقط مواقع المطلوبين والشبكات والأدلة بدقة.'
        : 'خريطة الولاية كاملة: لوس سانتوس، بلاين كاونتي، الصحراء، والميناء — لمتابعة النطاقات الممتدة خارج المدينة.'} كل موقع يُحفظ في سجل الشخص أو الشبكة ويُستدعى لاحقاً.</p>
    </div>
    <div class="head-actions">
      <div class="map-switch">
        <button class="ms ${mapArea === 'city' ? 'on' : ''}" data-act="map:area" data-id="city"><i class="fa-solid fa-city"></i> لوس سانتوس</button>
        <button class="ms ${mapArea === 'state' ? 'on' : ''}" data-act="map:area" data-id="state"><i class="fa-solid fa-mountain-sun"></i> سان أندرياس</button>
      </div>
      <button class="btn btn-ghost" data-act="doc:new"><i class="fa-solid fa-file-signature"></i> مذكرة من الخريطة</button>
      <button class="btn btn-primary" data-act="map:new-marker"><i class="fa-solid fa-location-dot"></i> إضافة علامة</button>
    </div>
  </div>

  <div class="map-layout">
    <div id="mapPage"></div>
    <aside class="map-side">
      <div class="card side-block">
        <div class="card-title" style="margin-bottom:10px"><i class="fa-solid fa-layer-group"></i> طبقات العرض · ${total} موقع</div>
        <div class="chips">
          <button class="chip chip-cyan" data-act="map:filter" data-id="person"><i class="fa-solid fa-user-secret"></i> الأشخاص</button>
          <button class="chip chip-violet" data-act="map:filter" data-id="network"><i class="fa-solid fa-sitemap"></i> الشبكات</button>
          <button class="chip chip-amber" data-act="map:filter" data-id="marker"><i class="fa-solid fa-location-dot"></i> العلامات</button>
        </div>
        <div class="section-title">دليل الرموز</div>
        <div class="legend">
          <span><i style="background:#dc2626"></i> موقع مطلوب</span>
          <span><i style="background:#7c3aed"></i> نطاق شبكة</span>
          <span><i style="background:#f59e0b"></i> نقطة مداهمة</span>
          <span><i style="background:#0891b2"></i> دليل مادي</span>
        </div>          <div class="tiny muted" style="margin-top:12px;line-height:1.8">انقر على الخريطة لتحديد إحداثيات، اسحب للتحريك، وعجلة الفأرة للتكبير. استخدم مفتاح «لوس سانتوس / سان أندرياس» للتبديل بين خريطة المدينة وخريطة الولاية — الإحداثيات تُحفظ موحّدة لكلتيهما.</div>
      </div>
      <div class="card side-block">
        <div class="card-head" style="margin-bottom:10px"><div class="card-title"><i class="fa-solid fa-list-ul"></i> المواقع المسجلة</div><span class="chip" id="locCount">0</span></div>
        <div class="loc-list" id="locList"></div>
      </div>
    </aside>
  </div>`;
}

function buildMarkers() {
  const out = [];
  DB.persons.forEach(p => {
    if (p.coords && isFinite(p.coords.x) && isFinite(p.coords.y)) {
      out.push({ id: 'p:' + p.id, kind: 'person', refId: p.id, x: p.coords.x, y: p.coords.y, type: 'person', label: p.alias || p.name, sub: p.status + ' · ' + p.rank });
    }
  });
  DB.networks.forEach(n => {
    if (n.coords && isFinite(n.coords.x) && isFinite(n.coords.y)) {
      out.push({ id: 'n:' + n.id, kind: 'network', refId: n.id, x: n.coords.x, y: n.coords.y, type: 'network', label: n.name, sub: 'نطاق · ' + (n.territory || '—') });
    }
  });
  DB.markers.forEach(m => {
    out.push({ id: 'm:' + m.id, kind: 'marker', refId: m.id, x: m.x, y: m.y, type: m.type || 'custom', label: m.label, sub: m.notes || '' });
  });
  return out;
}

function refreshMapMarkers() {
  if (!mapPageInstance) return;
  const all = buildMarkers();
  const visible = all.filter(m => mapFilter[m.kind]);
  mapPageInstance.setMarkers(visible);
  renderLocList(all, visible);
}

function renderLocList(all, visible) {
  const list = $('#locList');
  if (!list) return;
  const count = $('#locCount');
  if (count) count.textContent = visible.length;
  if (!visible.length) {
    list.innerHTML = `<p class="tiny muted">لا مواقع مطابقة لطبقات العرض الحالية.</p>`;
    return;
  }
  const icon = { person: ['fa-user-secret', '#dc2626'], network: ['fa-sitemap', '#7c3aed'], raid: ['fa-bullseye', '#f59e0b'], evidence: ['fa-box-archive', '#0891b2'], custom: ['fa-location-dot', '#64748b'] };
  list.innerHTML = visible.map(m => {
    const [ic, col] = icon[m.type] || icon.custom;
    return `<div class="loc-item">
      <span class="loc-ico" style="background:${col}22;color:${col};border:1px solid ${col}55"><i class="fa-solid ${ic}"></i></span>
      <div style="min-width:0;cursor:pointer" data-act="map:focus" data-id="${m.id}">
        <div class="loc-name">${esc(m.label)}</div>
        <div class="loc-sub">X ${m.x.toFixed(0)} · Y ${m.y.toFixed(0)}</div>
      </div>
      <div class="loc-actions">
        <button class="btn btn-ghost btn-sm" data-act="map:focus" data-id="${m.id}" title="تكبير"><i class="fa-solid fa-crosshairs"></i></button>
        ${m.kind === 'marker' ? `<button class="btn btn-ghost btn-sm" data-act="map:del-marker" data-id="${m.refId}" title="حذف"><i class="fa-solid fa-trash"></i></button>` : ''}
      </div>
    </div>`;
  }).join('');
}

function mountMap() {
  const host = $('#mapPage');
  if (!host) return;
  mapPageInstance = new TacticalMap(host, {
    area: mapArea === 'city' ? LS_MAP_AREA : null,
    onPin: (m) => {
      if (m.kind === 'person') { const p = personById(m.refId); if (p) ACTIONS['per:view'](p.id); }
      else if (m.kind === 'network') { ACTIONS['net:view'](m.refId); }
      else { const mk = DB.markers.find(x => x.id === m.refId); if (mk) markerDetail(mk); }
    }
  });
  refreshMapMarkers();
}

action('map:area', (id) => {
  mapArea = id === 'state' ? 'state' : 'city';
  render();
});

function markerDetail(mk) {
  const label = { raid: 'نقطة مداهمة', evidence: 'دليل مادي', custom: 'علامة مخصصة' }[mk.type] || 'علامة';
  openModal({
    title: mk.label, icon: 'fa-location-dot', size: 'narrow',
    body: `<dl class="kv"><dt>النوع</dt><dd>${esc(label)}</dd>
      <dt>الإحداثيات</dt><dd class="mono">X ${mk.x.toFixed(0)} · Y ${mk.y.toFixed(0)}</dd>
      <dt>ملاحظات</dt><dd>${esc(mk.notes || '—')}</dd>
      <dt>تاريخ الإضافة</dt><dd>${fmtDate(mk.createdAt)}</dd></dl>`,
    footer: `<button class="btn btn-primary" data-act="doc:new"><i class="fa-solid fa-file-signature"></i> طلب مذكرة</button>
             <button class="btn btn-danger" data-act="map:del-marker" data-id="${mk.id}"><i class="fa-solid fa-trash"></i> حذف</button>
             <button class="btn btn-ghost" data-act="modal:close">إغلاق</button>`
  });
}

function markerForm() {
  openModal({
    title: 'إضافة علامة على الخريطة', icon: 'fa-location-dot', size: 'wide',
    body: `
      <div class="form-grid">
        <div class="field"><label>اسم العلامة</label><input class="inp" id="mk_label" placeholder="مثال: مستودع 4 — ساندي شورز"></div>
        <div class="field"><label>نوع العلامة</label><select class="inp" id="mk_type">
          <option value="raid">نقطة مداهمة</option><option value="evidence">دليل مادي</option><option value="custom">علامة مخصصة</option></select></div>
        <div class="field span-2"><label>ملاحظات</label><textarea class="inp" id="mk_notes" rows="2" placeholder="تفاصيل الموقع، نقاط الوصول، التحذيرات..."></textarea></div>
        <div class="field span-2"><label>الموقع — انقر على الخريطة لتحديده</label>
          <div id="mk_map" class="mini-map"></div>
          <div class="coord-line"><span>X <b id="mk_cx">—</b></span><span>Y <b id="mk_cy">—</b></span>
            <input type="hidden" id="mk_x"><input type="hidden" id="mk_y"></div>
        </div>
      </div>`,
    footer: `<button class="btn btn-primary" data-act="map:save-marker"><i class="fa-solid fa-floppy-disk"></i> حفظ العلامة</button>
             <button class="btn btn-ghost" data-act="modal:close">إلغاء</button>`
  });
  new TacticalMap(activeModalEl.querySelector('#mk_map'), {
    onPick: (c) => {
      activeModalEl.querySelector('#mk_x').value = c.x.toFixed(1);
      activeModalEl.querySelector('#mk_y').value = c.y.toFixed(1);
      activeModalEl.querySelector('#mk_cx').textContent = c.x.toFixed(0);
      activeModalEl.querySelector('#mk_cy').textContent = c.y.toFixed(0);
    }
  });
}

action('map:new-marker', () => markerForm());
action('map:save-marker', () => {
  const label = val('#mk_label');
  const x = parseFloat(val('#mk_x')), y = parseFloat(val('#mk_y'));
  if (!label) return toast('اسم العلامة مطلوب', 'err');
  if (isNaN(x) || isNaN(y)) return toast('حدد الموقع على الخريطة أولاً', 'err');
  DB.markers.unshift({ id: uid('MK'), label, type: val('#mk_type') || 'custom', notes: val('#mk_notes'), x, y, createdAt: new Date().toISOString() });
  logActivity(`إضافة علامة على الخريطة: ${label}`, 'map');
  save(); closeModal();
  if (route.page === 'map') render(); else go('map');
  toast('تم حفظ الموقع على الخريطة');
});

action('map:filter', (k, el) => {
  mapFilter[k] = !mapFilter[k];
  if (el) {
    el.style.opacity = mapFilter[k] ? '1' : '.42';
    el.style.filter = mapFilter[k] ? '' : 'grayscale(1)';
  }
  refreshMapMarkers();
});

action('map:focus', (mid) => {
  if ($('#modalRoot').classList.contains('open')) closeModal();
  if (route.page !== 'map') go('map');
  setTimeout(() => {
    if (!mapPageInstance) return;
    const m = mapPageInstance.markers.find(x => x.id === mid);
    if (m) mapPageInstance.focus({ x: m.x, y: m.y }, 2.8);
  }, 220);
});

action('map:del-marker', (id) => {
  const mk = DB.markers.find(m => m.id === id);
  if (!mk) return;
  confirmDialog({
    title: 'حذف العلامة', danger: true, confirmText: 'حذف',
    text: `سيتم حذف «${mk.label}» من الخريطة.`,
    onConfirm: () => {
      DB.markers = DB.markers.filter(m => m.id !== id);
      logActivity(`حذف علامة: ${mk.label}`, 'map');
      save(); closeModal();
      if (route.page === 'map') render(); else go('map');
      toast('تم حذف العلامة');
    }
  });
});

/* ============================================================
   SHARED PRINT SHEETS
   ============================================================ */
function sheetHead(withDoj) {
  const acct = accountInfo();
  return `<div class="sheet-head">
    ${fbiSeal('seal-print')}
    <div class="sheet-org">
      <div class="l1">إدارة التحقيقات الفيدرالية${withDoj ? ' — وزارة العدل' : ''}</div>
      <div class="l2">FEDERAL BUREAU OF INVESTIGATION${withDoj ? ' · U.S. DEPARTMENT OF JUSTICE' : ''}</div>
      <div class="l3">LOS SANTOS FIELD OFFICE · AGENT ${esc(acct.user)}</div>
    </div>
    ${stampHTML('SENSITIVE')}
  </div>`;
}

function docSheet(d) {
  const t = DOC_TYPES[d.type] || DOC_TYPES.search;
  const person = d.personId ? personById(d.personId) : null;
  const net = d.networkId ? netById(d.networkId) : null;
  const sign = d.signature || {};
  const acct = accountInfo();
  const sigUrl = FileStore.url(sigOf(d)) || '';
  const sealUrl = FileStore.url(sealOf(d)) || '';
  return `<div class="sheet">
    <div class="sheet-frame"></div>
    <div class="watermark">CONFIDENTIAL</div>
    <div class="sheet-inner">
      ${sheetHead(true)}
      <div class="sheet-title"><h1>${esc(t.label)}</h1><div class="en">${t.en}</div></div>
      <div class="sheet-meta">
        <span>الرقم المرجعي: <b>${esc(d.ref)}</b></span>
        <span>رقم الملف: <b>${esc(d.caseNo || '—')}</b></span>
        <span>التاريخ: <b>${fmtDate(d.createdAt)}</b></span>
      </div>
      <div class="sheet-body">
        <div class="sheet-sec"><h4>الجهة المستهدفة</h4>
          <p>${esc(d.target)}${person ? ` — المشتبه به: ${esc(person.name)} (${esc(person.alias || 'بدون لقب')})` : ''}${net ? ` — الشبكة: ${esc(net.name)}` : ''}</p></div>
        <div class="sheet-sec"><h4>الموقع / العقار</h4><p>${esc(d.location || '—')}</p></div>
        <div class="sheet-sec"><h4>حيثيات الطلب والأسباب المحتملة</h4><p>${esc(d.justification || '—')}</p></div>
        ${(d.attachments || []).length ? `<div class="sheet-sec"><h4>المرفقات</h4><ol class="sheet-list">${d.attachments.map(a => `<li>${esc(a.name)} — ${fmtSize(a.size)}</li>`).join('')}</ol></div>` : ''}
        <p style="font-size:9pt">أُعدّ هذا الطلب بموجب الصلاحيات الممنوحة للعميل الفيدرالي <b>${esc(acct.user)}</b>، ويُرفع إلى مكتب المدعي العام للنظر في إصدار الأمر القضائي المطلوب.</p>
      </div>
      <div class="sheet-sign">
        <div>
          <div class="sig-role">مُقدّم الطلب</div>
          ${sigUrl ? `<img class="sig-img" src="${sigUrl}" alt="signature">` : '<div style="height:18mm"></div>'}
          <div class="sig-line"></div>
          <div class="sig-name">${esc(sign.name || acct.name)}</div>
          <div class="sig-role">${esc(sign.rank || acct.rank)} · ${esc(sign.date || fmtDate(d.createdAt))}</div>
        </div>
        ${sealUrl ? `<div style="text-align:center">
          <img class="seal-img" src="${sealUrl}" alt="seal">
          <div class="sig-role">ختم مُقدّم الطلب</div>
        </div>` : ''}
        <div>
          <div class="sig-role">اعتماد وزارة العدل</div>
          ${d.decision
            ? `${FileStore.url(d.decision.signature) ? `<img class="sig-img" src="${FileStore.url(d.decision.signature)}" alt="">` : '<div style="height:18mm"></div>'}
               <div class="sig-line"></div>
               <div class="sig-name">${esc(d.decision.name || 'ممثل وزارة العدل')}</div>
               <div class="sig-role">${esc(d.decision.rank || '')} · ${fmtDate(d.decision.at)} · ${d.status === 'approved' ? 'معتمد' : 'مرفوض'}</div>
               ${FileStore.url(d.decision.seal) ? `<img class="seal-img" style="max-height:18mm;margin-top:2mm" src="${FileStore.url(d.decision.seal)}" alt="">` : ''}`
            : `<div style="height:18mm"></div><div class="sig-line"></div><div class="sig-name">ممثل وزارة العدل</div><div class="sig-role">قيد مراجعة الوزارة</div>`}
        </div>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-top:4mm">
        <div style="font-size:7pt;color:#5b6b78">AUTHENTICATION · ${esc(d.ref)}</div>
        ${barcodeHTML(d.ref)}
      </div>
      <div class="sheet-foot"><span>هذا المستند سري — للاستخدام الرسمي فقط</span><span>FIB · DOJ · ${esc(acct.user)}</span></div>
    </div>
  </div>`;
}

function bulletinSheet(b) {
  const pr = PRIORITIES[b.priority] || PRIORITIES.normal;
  const acct = accountInfo();
  const sigUrl = FileStore.url(sigOf(b)) || '';
  const sealUrl = FileStore.url(sealOf(b)) || '';
  return `<div class="sheet">
    <div class="sheet-frame"></div>
    <div class="watermark">BULLETIN</div>
    <div class="sheet-inner">
      ${sheetHead(true)}
      <div class="sheet-title"><h1>برقية رسمية · ${esc(pr.label)}</h1><div class="en">OFFICIAL BULLETIN · ${esc(b.serial)}</div></div>
      <div class="sheet-meta">
        <span>من: <b>${esc(b.from)}</b></span>
        <span>إلى: <b>${esc(b.to)}</b></span>
        <span>التاريخ: <b>${fmtDate(b.createdAt)}</b></span>
      </div>
      <div class="sheet-body">
        <div class="sheet-sec"><h4>الموضوع</h4><p style="font-weight:700">${esc(b.subject)}</p></div>
        <div class="sheet-sec"><h4>النص</h4><p>${esc(b.body)}</p></div>
        ${(b.attachments || []).length ? `<div class="sheet-sec"><h4>المرفقات</h4><ol class="sheet-list">${b.attachments.map(a => `<li>${esc(a.name)} — ${fmtSize(a.size)}</li>`).join('')}</ol></div>` : ''}
      </div>
      <div class="sheet-sign">
        <div>
          <div class="sig-role">جهة الإصدار</div>
          ${sigUrl ? `<img class="sig-img" src="${sigUrl}" alt="signature">` : '<div style="height:18mm"></div>'}
          <div class="sig-line"></div>
          <div class="sig-name">${esc(acct.name)}</div>
          <div class="sig-role">${esc(acct.rank)} · ${esc(b.serial)}</div>
        </div>
        <div style="text-align:center">
          ${sealUrl ? `<img class="seal-img" src="${sealUrl}" alt="seal">` : sealSVG('#7a1414')}
          <div style="font-size:7pt;color:#5b6b78;margin-top:2mm">ختم الإصدار</div>
        </div>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-top:5mm">
        <div style="font-size:7pt;color:#5b6b78">AUTHENTICATION · ${esc(b.serial)}</div>
        ${barcodeHTML(b.serial)}
      </div>
      <div class="sheet-foot"><span>سري — للاستخدام الرسمي فقط</span><span>${esc(fmtDate(b.createdAt))}</span></div>
    </div>
  </div>`;
}

function wantedSheet(p) {
  const net = p.networkId ? netById(p.networkId) : null;
  const photo = personPhoto(p);
  return `<div class="sheet">
    <div class="sheet-frame"></div>
    <div class="watermark">WANTED</div>
    <div class="sheet-inner">
      ${sheetHead()}
      <div class="sheet-title"><h1>نشرة مطلوب · WANTED</h1><div class="en">FEDERAL ARREST NOTICE · ${esc(p.id)}</div></div>
      <div style="display:flex;gap:8mm;margin-bottom:4mm">
        <div class="wanted-photo"><img src="${photo}" alt="" style="width:100%;height:100%;object-fit:cover"></div>
        <div style="flex:1">
          <div style="font-size:17pt;font-weight:800">${esc(p.name)}</div>
          <div style="font-size:12pt;color:#5b6b78;margin-bottom:3mm">«${esc(p.alias || 'بدون لقب')}»</div>
          <div class="sheet-meta" style="display:grid;grid-template-columns:1fr 1fr;gap:2mm;margin:0 0 3mm">
            <span>الميلاد: <b>${esc(p.dob || '—')}</b></span>
            <span>الجنسية: <b>${esc(p.nationality || '—')}</b></span>
            <span>الشبكة: <b>${esc(net ? net.name : 'غير مرتبط')}</b></span>
            <span>المنصب: <b>${esc(p.rank)}</b></span>
          </div>
          <div style="font-size:8pt;color:#5b6b78">المكافأة المعلنة</div>
          <div class="bounty">${p.bounty ? '$' + fmtMoney(p.bounty) : '—'}</div>
        </div>
      </div>
      ${(p.photos || []).length ? `<div class="sheet-sec"><h4>صور إضافية</h4><div class="photo-grid">${p.photos.slice(0, 4).map(id => `<div class="photo-cell"><img src="${FileStore.url(id)}" alt=""></div>`).join('')}</div></div>` : ''}
      <div class="sheet-sec"><h4>التهم المسجلة</h4><p>${esc(p.charges || '—')}</p></div>
      <div class="sheet-sec"><h4>آخر موقع معروف</h4><p>${esc(p.address || '—')}${p.coords ? ` · الإحداثيات X ${p.coords.x.toFixed(0)} / Y ${p.coords.y.toFixed(0)}` : ''}</p></div>
      ${p.notes ? `<div class="sheet-sec"><h4>تحذير ميداني</h4><p>${esc(p.notes)}</p></div>` : ''}
      <div class="sheet-sec"><h4>التعليمات</h4><p>على أي وحدة تشاهد المذكور إبلاغ غرفة العمليات فوراً وعدم الاقتراب الفردي. يُعتبر المذكور ${p.threat === 'خطر بالغ' ? 'خطراً بالغاً ومسلحاً' : p.threat === 'مرتفع' ? 'مرتفع الخطورة' : 'قيد التتبع'}.</p></div>
      <div class="sheet-sign">
        <div>
          <div class="sig-role">جهة الإصدار</div>
          <div class="sig-line" style="margin-top:16mm"></div>
          <div class="sig-name">${esc(accountInfo().name)}</div>
          <div class="sig-role">${esc(accountInfo().rank)}</div>
        </div>
        <div>${barcodeHTML(p.id)}</div>
      </div>
      <div class="sheet-foot"><span>سري — للاستخدام الرسمي فقط</span><span>${fmtDate(new Date())}</span></div>
    </div>
  </div>`;
}

function printHTML(html, hint) {
  const root = $('#printRoot');
  root.innerHTML = html;
  if (hint) toast(hint);
  /* انتظر تحميل الأختام/التواقيع/الصور قبل فتح نافذة الطباعة حتى لا تخرج فارغة في الـ PDF */
  const imgs = $$('#printRoot img');
  const ready = Promise.all(imgs.map(im => im.complete && im.naturalWidth
    ? Promise.resolve()
    : new Promise(res => { im.onload = im.onerror = () => res(); })));
  ready.then(() => setTimeout(() => {
    try { window.print(); } catch (e) { toast('تعذر فتح نافذة الطباعة', 'err'); }
  }, 150));
}

/* ============================================================
   DOCUMENTS / MEMOS
   ============================================================ */
let docFilter = 'all';

function pageDocuments() {
  const doj = Auth.isDoj();
  const all = DB.docs;
  const list = all.filter(d => docFilter === 'all' || d.status === docFilter);
  const tabs = [['all', 'الكل'], ['pending', 'قيد المراجعة'], ['approved', 'معتمدة'], ['rejected', 'مرفوضة']];
  return `
  <div class="page-head">
    <div>
      <h2><i class="fa-solid ${doj ? 'fa-scale-balanced' : 'fa-file-signature'}"></i> ${doj ? 'المذكرات الواردة للاعتماد — وزارة العدل' : 'المذكرات والطلبات القضائية'}</h2>
      <p>${doj
        ? 'راجع المذكرات والطلبات الواردة من مكتب التحقيقات الفيدرالي، اطّلع على المستند كاملًا ثم اعتمدها أو ارفضها. لا يمكنك الاطلاع على أي سجلات أخرى.'
        : 'أنشئ مذكرات التفتيش والمداهمة والإحضار، أرفق ملفات PDF، أضف التوقيع واسم المحقق، ثم اطبعها أو صدّرها PDF جاهزة للاعتماد.'}</p>
    </div>
    <div class="head-actions">
      ${doj ? '' : `<button class="btn btn-primary" data-act="doc:new"><i class="fa-solid fa-plus"></i> طلب مذكرة جديدة</button>`}
    </div>
  </div>

  <div class="chips" style="margin-bottom:16px">
    ${tabs.map(([k, l]) => `<button class="chip ${docFilter === k ? 'chip-cyan' : ''}" data-act="doc:filter" data-id="${k}">${l}
      <b style="font-family:'Share Tech Mono',monospace">${k === 'all' ? all.length : all.filter(d => d.status === k).length}</b></button>`).join('')}
  </div>

  ${list.length ? `<div style="display:flex;flex-direction:column;gap:10px">
    ${list.map(d => {
      const st = d.status === 'approved' ? ['st-approved', 'معتمدة'] : d.status === 'rejected' ? ['st-rejected', 'مرفوضة'] : ['st-pending', 'قيد المراجعة'];
      const person = d.personId ? personById(d.personId) : null;
      return `<div class="doc-card">
        <div class="doc-ico"><i class="fa-solid ${d.type === 'raid' ? 'fa-shield-halved' : d.type === 'search' ? 'fa-magnifying-glass' : 'fa-file-lines'}"></i></div>
        <div style="min-width:0;flex:1">
          <div class="doc-ref">${esc(d.ref)} · ${esc(d.caseNo || 'بدون ملف')} · ${fmtDate(d.createdAt)}</div>
          <div class="doc-title">${esc(DOC_TYPES[d.type]?.label || d.type)} — ${esc(d.target)}</div>
          <div class="doc-info">${esc(d.location || '—')}${person ? ` · المشتبه به: ${esc(person.name)}` : ''}</div>
          <div class="chips" style="margin-top:7px">
            <span class="st ${st[0]}">${st[1]}</span>
            ${(d.attachments || []).length ? `<span class="chip"><i class="fa-solid fa-paperclip"></i>${d.attachments.length} مرفق</span>` : ''}
            ${d.signature && d.signature.fileId ? `<span class="chip chip-green"><i class="fa-solid fa-signature"></i>موقّعة</span>` : ''}
          </div>
        </div>
        <div class="doc-actions">
          <button class="btn btn-ghost btn-sm" data-act="doc:view" data-id="${d.id}"><i class="fa-solid fa-eye"></i> معاينة</button>
          <button class="btn btn-ghost btn-sm" data-act="doc:print" data-id="${d.id}"><i class="fa-solid fa-file-pdf"></i> PDF</button>
          ${doj ? `${d.status !== 'approved' ? `<button class="btn btn-green btn-sm" data-act="doc:approve" data-id="${d.id}"><i class="fa-solid fa-gavel"></i> اعتماد</button>` : ''}
            ${d.status !== 'rejected' ? `<button class="btn btn-danger btn-sm" data-act="doc:reject" data-id="${d.id}"><i class="fa-solid fa-ban"></i> رفض</button>` : ''}`
            : `<button class="btn btn-danger btn-sm" data-act="doc:del" data-id="${d.id}"><i class="fa-solid fa-trash"></i></button>`}
        </div>
      </div>`;
    }).join('')}
  </div>` : `<div class="card empty"><i class="fa-solid fa-file-circle-plus"></i><p>لا توجد مذكرات في هذه القائمة.</p>
      ${doj ? '' : `<button class="btn btn-primary" data-act="doc:new"><i class="fa-solid fa-plus"></i> إنشاء أول مذكرة</button>`}</div>`}`;
}

function docForm(personId) {
  const person = personId ? personById(personId) : null;
  const persons = [...DB.persons].sort((a, b) => a.name.localeCompare(b.name, 'ar'));
  const acct = accountInfo();
  openModal({
    title: 'طلب مذكرة / أمر قضائي', icon: 'fa-file-signature', size: 'wide',
    body: `
      <div class="form-grid">
        <div class="field"><label>نوع الطلب *</label><select class="inp" id="df_type">
          ${Object.entries(DOC_TYPES).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join('')}</select></div>
        <div class="field"><label>رقم الملف / القضية</label>
          <input class="inp" id="df_case" list="df_cases" value="${esc(DB.cases[0]?.code || '')}" placeholder="CR-2026-0001">
          <datalist id="df_cases">${DB.cases.map(c => `<option value="${esc(c.code)}">${esc(c.title)}</option>`).join('')}</datalist></div>
        <div class="field span-2"><label>الجهة المستهدفة *</label>
          <input class="inp" id="df_target" value="${person ? esc(person.name) : ''}" placeholder="اسم الشخص أو المنشأة أو المستودع"></div>
        <div class="field"><label>ربط بشخص مسجل</label><select class="inp" id="df_person">
          <option value="">— بدون ربط —</option>
          ${persons.map(p => `<option value="${p.id}" ${personId === p.id ? 'selected' : ''}>${esc(p.name)} (${esc(p.alias || 'بدون لقب')})</option>`).join('')}</select></div>
        <div class="field"><label>ربط بشبكة</label><select class="inp" id="df_network">
          <option value="">— بدون ربط —</option>
          ${DB.networks.map(n => `<option value="${n.id}">${esc(n.name)}</option>`).join('')}</select></div>
        <div class="field span-2"><label>الموقع / العقار</label>
          <input class="inp" id="df_location" placeholder="العنوان الكامل، معالم الوصول، رقم المستودع..."></div>
        <div class="field span-2"><label>حيثيات الطلب والأسباب المحتملة *</label>
          <textarea class="inp" id="df_reason" rows="4" placeholder="اسرد الأدلة، المصادر، نتائج المراقبة، وسبب كفاية الأسباب المحتملة..."></textarea></div>
        <div class="field span-2">
          <label>مرفقات (PDF / صور / مستندات)</label>
          <div class="upload" style="align-items:center">
            <label class="btn btn-ghost btn-sm" for="df_files"><i class="fa-solid fa-paperclip"></i> إرفاق ملفات</label>
            <input type="file" id="df_files" multiple accept=".pdf,.doc,.docx,image/*" data-upload="multi" data-list="#df_attach">
            <span class="upload-text">تُحفظ الملفات في الأرشيف المحلي (IndexedDB) وتُرفق بالمذكرة</span>
          </div>
          <div class="attach-list" id="df_attach"></div>
        </div>
      </div>

      <div class="section-title">بيانات التوقيع والاعتماد</div>
      <div class="form-grid">
        <div class="field"><label>اسم المحقق الموقّع (صاحب الحساب)</label><input class="inp" id="df_signer" value="${esc(acct.name)}"></div>
        <div class="field"><label>الرتبة / الصفة</label><input class="inp" id="df_rank" value="${esc(acct.rank)}"></div>
        <div class="field"><label>تاريخ الطلب</label><input class="inp" type="date" id="df_date" value="${new Date().toISOString().slice(0, 10)}"></div>
        <div class="field">${imageUploader('dfSig', 'صورة التوقيع', acct.signature, 'توقيع الحساب الحالي — يمكنك تغييره لهذه المذكرة فقط')}</div>
        <div class="field">${imageUploader('dfSeal', 'الختم الرسمي', acct.seal, 'ختم الحساب الحالي — يظهر بجانب التوقيع في المستند')}</div>
      </div>
      <div class="tiny muted" style="line-height:1.8">بالمتابعة أنت تُقرّ بصحة البيانات المذكورة وبأنها ستُرفع للاعتماد القضائي. يمكنك معاينة المستند قبل الطباعة.</div>`,
    footer: `<button class="btn btn-primary" data-act="doc:create"><i class="fa-solid fa-paper-plane"></i> تسجيل الطلب وإحالته</button>
             <button class="btn btn-ghost" data-act="modal:close">إلغاء</button>`
  });
  activeModalEl.__attach = [];
  renderAttachList(activeModalEl, '#df_attach');
}

function nextDocRef() {
  const y = new Date().getFullYear();
  const seq = DB.docs.length + 1;
  return `FIB-A140-${y}-${String(seq).padStart(4, '0')}`;
}

action('doc:new', (personId) => docForm(personId || ''));
action('doc:filter', (f) => { docFilter = f || 'all'; render(); });

action('doc:create', () => {
  const target = val('#df_target');
  const reason = val('#df_reason');
  if (!target || !reason) return toast('أكمل الجهة المستهدفة وحيثيات الطلب', 'err');
  const personId = val('#df_person');
  const person = personId ? personById(personId) : null;
  const doc = {
    id: uid('DOC'), ref: nextDocRef(),
    type: val('#df_type') || 'search',
    caseNo: val('#df_case'), target,
    personId,
    networkId: val('#df_network') || (person ? person.networkId : ''),
    location: val('#df_location'),
    justification: reason,
    attachments: (activeModalEl.__attach || []).map(a => ({ ...a })),
    signature: {
      fileId: val('#dfSig_id') || sigOf(), name: val('#df_signer') || accountInfo().name,
      rank: val('#df_rank') || accountInfo().rank, date: val('#df_date')
    },
    seal: val('#dfSeal_id') || sealOf(),
    status: 'pending', createdAt: Date.now(), createdBy: actorId()
  };
  DB.docs.unshift(doc);
  logActivity(`رفع طلب ${DOC_TYPES[doc.type].label} — ${target}`, 'doc');
  save(); closeModal(); render();
  toast('تم تسجيل الطلب وإحالته للمراجعة القضائية');
  setTimeout(() => ACTIONS['doc:view'](doc.id), 260);
});

action('doc:view', (id) => {
  const d = DB.docs.find(x => x.id === id);
  if (!d) return;
  openModal({
    title: 'معاينة المستند — ' + d.ref, icon: 'fa-file-lines', size: 'wide',
    body: `
      ${decisionBox(d.decision, d.status)}
      <div class="tiny muted" style="margin:0 0 10px">مقدم الطلب: <b class="mono" style="color:#dbe4ee">${esc(d.createdBy || '—')}</b>
        ${d.decision ? ` · تم إرسال قرار الوزارة إلى مقدم الطلب` : ' · بانتظار قرار وزارة العدل'}</div>
      <div class="preview-wrap">${docSheet(d)}</div>
      ${(d.attachments || []).length ? `<div class="section-title">المرفقات</div><div class="attach-list">
        ${d.attachments.map(a => `<span class="attach-chip"><i class="fa-solid fa-paperclip"></i>${esc(a.name)}
          <span class="sz">${fmtSize(a.size)}</span>
          <button type="button" data-act="file:open" data-id="${a.fileId}" title="فتح"><i class="fa-solid fa-up-right-from-square"></i></button>
          <button type="button" data-act="file:download" data-id="${a.fileId}" title="تنزيل"><i class="fa-solid fa-download"></i></button>
        </span>`).join('')}</div>` : ''}`,
    footer: `<button class="btn btn-primary" data-act="doc:print" data-id="${d.id}"><i class="fa-solid fa-file-pdf"></i> طباعة / حفظ PDF</button>
      ${d.status !== 'approved' ? `<button class="btn btn-green" data-act="doc:approve" data-id="${d.id}"><i class="fa-solid fa-gavel"></i> اعتماد قضائي</button>` : ''}
      ${d.status !== 'rejected' ? `<button class="btn btn-danger" data-act="doc:reject" data-id="${d.id}"><i class="fa-solid fa-ban"></i> رفض</button>` : ''}
      ${!Auth.isDoj() && d.status !== 'pending' ? `<button class="btn btn-ghost" data-act="doc:pending" data-id="${d.id}"><i class="fa-solid fa-rotate-left"></i> إعادة للمراجعة</button>` : ''}
      <button class="btn btn-ghost" data-act="modal:close">إغلاق</button>`
  });
});

action('doc:print', (id) => {
  const d = DB.docs.find(x => x.id === id);
  if (!d) return;
  printHTML(docSheet(d), 'اختر «حفظ كـ PDF» من نافذة الطباعة');
});

action('doc:approve', (id) => {
  const d = DB.docs.find(x => x.id === id); if (!d) return;
  d.status = 'approved';
  d.decision = Object.assign(dojStamp(), { status: 'approved' });
  logActivity(`اعتماد المذكرة ${d.ref} من وزارة العدل — طالبها ${d.createdBy || '—'}`, 'doc');
  save(); closeModal(); render(); toast('تم اعتماد المذكرة وإشعار مقدم الطلب');
});
action('doc:reject', (id) => {
  const d = DB.docs.find(x => x.id === id); if (!d) return;
  d.status = 'rejected';
  d.decision = Object.assign(dojStamp(), { status: 'rejected' });
  logActivity(`رفض المذكرة ${d.ref} من وزارة العدل — طالبها ${d.createdBy || '—'}`, 'doc');
  save(); closeModal(); render(); toast('تم رفض المذكرة وإشعار مقدم الطلب', 'err');
});
action('doc:pending', (id) => {
  const d = DB.docs.find(x => x.id === id); if (!d) return;
  d.status = 'pending';
  save(); closeModal(); render(); toast('أُعيدت المذكرة للمراجعة');
});
action('doc:del', (id) => {
  const d = DB.docs.find(x => x.id === id); if (!d) return;
  confirmDialog({
    title: 'حذف المذكرة', danger: true, confirmText: 'حذف',
    text: `سيتم حذف المذكرة ${d.ref} ومرفقاتها من الأرشيف.`,
    onConfirm: () => {
      (d.attachments || []).forEach(a => FileStore.remove(a.fileId));
      (d.signature && d.signature.fileId) ? FileStore.remove(d.signature.fileId) : null;
      DB.docs = DB.docs.filter(x => x.id !== id);
      logActivity(`حذف مذكرة ${d.ref}`, 'doc');
      save(); closeModal(); render(); toast('تم حذف المذكرة');
    }
  });
});

/* ============================================================
   BULLETINS
   ============================================================ */
const PRIORITIES = {
  normal: { label: 'عادي', cls: 'p-normal', chip: 'chip-cyan' },
  high: { label: 'هام', cls: 'p-high', chip: 'chip-amber' },
  urgent: { label: 'عاجل', cls: 'p-urgent', chip: 'chip-red' },
  secret: { label: 'سري للغاية', cls: 'p-secret', chip: 'chip-violet' }
};

function pageBulletins() {
  const list = [...DB.bulletins].sort((a, b) => b.createdAt - a.createdAt);
  return `
  <div class="page-head">
    <div>
      <h2><i class="fa-solid fa-tower-broadcast"></i> البرقيات والتعميمات</h2>
      <p>تعميمات رسمية من وإلى الوحدات، بأولويات واضحة (عادي · هام · عاجل · سري للغاية) ومرفقات وتوقيع، جاهزة للطباعة.</p>
    </div>
    <div class="head-actions">
      <button class="btn btn-primary" data-act="brq:new"><i class="fa-solid fa-plus"></i> برقية جديدة</button>
    </div>
  </div>

  ${list.length ? `<div style="display:flex;flex-direction:column;gap:11px">
    ${list.map(b => {
      const pr = PRIORITIES[b.priority] || PRIORITIES.normal;
      return `<article class="brq ${pr.cls}">
        <div class="brq-top">
          <span class="chip ${pr.chip}"><i class="fa-solid fa-bolt"></i>${pr.label}</span>
          <span class="mono tiny muted">${esc(b.serial)}</span>
          <span class="tiny muted">${fmtDateTime(b.createdAt)}</span>
        </div>
        <div class="brq-sub">${esc(b.subject)}</div>
        <div class="brq-body">${esc(b.body)}</div>
        <div class="brq-foot">
          <span><i class="fa-solid fa-arrow-up-left-from-circle"></i> من: ${esc(b.from)} &nbsp;·&nbsp; <i class="fa-solid fa-arrow-down-right"></i> إلى: ${esc(b.to)}</span>
          <span style="display:flex;gap:6px;flex-wrap:wrap">
            ${(b.attachments || []).length ? `<span class="chip"><i class="fa-solid fa-paperclip"></i>${b.attachments.length}</span>` : ''}
            <button class="btn btn-ghost btn-sm" data-act="brq:view" data-id="${b.id}"><i class="fa-solid fa-eye"></i> عرض</button>
            <button class="btn btn-ghost btn-sm" data-act="brq:print" data-id="${b.id}"><i class="fa-solid fa-print"></i> طباعة</button>
            <button class="btn btn-danger btn-sm" data-act="brq:del" data-id="${b.id}"><i class="fa-solid fa-trash"></i></button>
          </span>
        </div>
      </article>`;
    }).join('')}
  </div>` : `<div class="card empty"><i class="fa-solid fa-tower-broadcast"></i><p>لا برقيات مسجلة.</p>
      <button class="btn btn-primary" data-act="brq:new"><i class="fa-solid fa-plus"></i> إصدار برقية</button></div>`}`;
}

function bulletinForm() {
  const acct = accountInfo();
  openModal({
    title: 'إصدار برقية رسمية', icon: 'fa-tower-broadcast', size: 'wide',
    body: `
      <div class="form-grid">
        <div class="field"><label>الأولوية</label><select class="inp" id="bf_prio">
          ${Object.entries(PRIORITIES).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join('')}</select></div>
        <div class="field"><label>الموضوع *</label><input class="inp" id="bf_subject" placeholder="عنوان البرقية"></div>
        <div class="field"><label>من (صاحب الحساب)</label><input class="inp" id="bf_from" value="${esc(acct.name + (acct.rank ? ' · ' + acct.rank : ''))}"></div>
        <div class="field"><label>إلى</label><input class="inp" id="bf_to" value="جميع الوحدات الميدانية"></div>
        <div class="field span-2"><label>نص البرقية *</label>
          <textarea class="inp" id="bf_body" rows="5" placeholder="نص التعميم الكامل..."></textarea></div>
        <div class="field span-2"><label>مرفقات</label>
          <div class="upload" style="align-items:center">
            <label class="btn btn-ghost btn-sm" for="bf_files"><i class="fa-solid fa-paperclip"></i> إرفاق ملفات</label>
            <input type="file" id="bf_files" multiple accept=".pdf,image/*" data-upload="multi" data-list="#bf_attach">
            <span class="upload-text">PDF أو صور — تُحفظ في الأرشيف المحلي</span>
          </div>
          <div class="attach-list" id="bf_attach"></div>
        </div>
        <div class="field">${imageUploader('bfSig', 'توقيع صاحب الحساب', acct.signature, 'يظهر في أسفل البرقية عند الطباعة')}</div>
        <div class="field">${imageUploader('bfSeal', 'ختم صاحب الحساب', acct.seal, 'يظهر بجانب التوقيع في البرقية')}</div>
      </div>`,
    footer: `<button class="btn btn-primary" data-act="brq:create"><i class="fa-solid fa-paper-plane"></i> إصدار البرقية</button>
             <button class="btn btn-ghost" data-act="modal:close">إلغاء</button>`
  });
  activeModalEl.__attach = [];
  renderAttachList(activeModalEl, '#bf_attach');
}

action('brq:new', () => bulletinForm());
action('brq:create', () => {
  const subject = val('#bf_subject');
  const body = val('#bf_body');
  if (!subject || !body) return toast('الموضوع والنص مطلوبان', 'err');
  const y = new Date().getFullYear();
  const b = {
    id: uid('BRQ'), serial: `BRQ-${y}-${String(DB.bulletins.length + 1).padStart(4, '0')}`,
    priority: val('#bf_prio') || 'normal', from: val('#bf_from') || accountInfo().name, to: val('#bf_to'),
    subject, body, attachments: (activeModalEl.__attach || []).map(a => ({ ...a })),
    signature: { fileId: val('#bfSig_id') || sigOf(), name: accountInfo().name, rank: accountInfo().rank },
    seal: val('#bfSeal_id') || sealOf(),
    createdAt: Date.now(), createdBy: actorId()
  };
  DB.bulletins.unshift(b);
  logActivity(`إصدار برقية: ${subject}`, 'brq');
  save(); closeModal(); render(); toast('تم إصدار البرقية وتعميمها');
});

action('brq:view', (id) => {
  const b = DB.bulletins.find(x => x.id === id); if (!b) return;
  const pr = PRIORITIES[b.priority] || PRIORITIES.normal;
  openModal({
    title: b.serial, icon: 'fa-tower-broadcast', size: 'wide',
    body: `
      <div class="chips" style="margin-bottom:12px">
        <span class="chip ${pr.chip}">${pr.label}</span>
        <span class="chip">${fmtDateTime(b.createdAt)}</span>
      </div>
      <h3 style="font-size:1.05rem;margin-bottom:10px">${esc(b.subject)}</h3>
      <div class="kvdoc" style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:.78rem;color:var(--muted);margin-bottom:14px">
        <div>من: <b style="color:var(--txt)">${esc(b.from)}</b></div>
        <div>إلى: <b style="color:var(--txt)">${esc(b.to)}</b></div>
      </div>
      <p style="font-size:.84rem;line-height:2;white-space:pre-wrap">${esc(b.body)}</p>
      ${(b.attachments || []).length ? `<div class="section-title">المرفقات</div><div class="attach-list">
        ${b.attachments.map(a => `<span class="attach-chip"><i class="fa-solid fa-paperclip"></i>${esc(a.name)}<span class="sz">${fmtSize(a.size)}</span>
          <button type="button" data-act="file:open" data-id="${a.fileId}" title="فتح"><i class="fa-solid fa-up-right-from-square"></i></button></span>`).join('')}
      </div>` : ''}`,
    footer: `<button class="btn btn-primary" data-act="brq:print" data-id="${b.id}"><i class="fa-solid fa-print"></i> طباعة / PDF</button>
             <button class="btn btn-ghost" data-act="modal:close">إغلاق</button>`
  });
});

action('brq:print', (id) => {
  const b = DB.bulletins.find(x => x.id === id); if (!b) return;
  printHTML(bulletinSheet(b), 'اختر «حفظ كـ PDF» من نافذة الطباعة');
});

action('brq:del', (id) => {
  const b = DB.bulletins.find(x => x.id === id); if (!b) return;
  confirmDialog({
    title: 'حذف البرقية', danger: true, confirmText: 'حذف',
    text: `سيتم حذف البرقية ${b.serial}.`,
    onConfirm: () => {
      (b.attachments || []).forEach(a => FileStore.remove(a.fileId));
      DB.bulletins = DB.bulletins.filter(x => x.id !== id);
      save(); closeModal(); render(); toast('تم حذف البرقية');
    }
  });
});

/* ============================================================
   DOJ PORTAL — referred cases + own signature/seal
   ============================================================ */
function referredCases() {
  return DB.cases.filter(c => c.referredToDoj || (Number(c.stage) || 0) >= 5);
}

/* ختم قرار وزارة العدل + توقيعه وقت الاعتماد */
function dojStamp() {
  const u = Auth.current() || {};
  return {
    at: Date.now(), by: u.user || '—', name: u.name || 'ممثل وزارة العدل',
    rank: u.rank || 'اعتماد وزارة العدل', signature: u.signature || '', seal: u.seal || ''
  };
}

function dojNotesBox(c) {
  const list = (c && c.dojComments) || [];
  if (!list.length) return '';
  return `<div class="doj-notes">
    <div class="doj-notes-head"><i class="fa-solid fa-comment-dots"></i> ملاحظات وزارة العدل (${list.length})</div>
    ${list.map(n => `<div class="doj-note">
      <div class="doj-note-text">${esc(n.text)}</div>
      <div class="doj-note-meta">${esc(n.name || n.by || 'ممثل وزارة العدل')} · ${fmtDateTime(n.at)}</div>
    </div>`).join('')}
  </div>`;
}

function decisionBox(dec, status) {
  if (!dec) return '';
  const ok = status === 'approved';
  return `<div class="decision ${ok ? 'ok' : 'rej'}">
    <i class="fa-solid ${ok ? 'fa-circle-check' : 'fa-circle-xmark'}"></i>
    <div style="min-width:0">
      <div class="decision-title">قرار وزارة العدل: ${ok ? 'اعتماد' : 'رفض'}</div>
      <div class="decision-sub">${esc(dec.name || '')}${dec.rank ? ' · ' + esc(dec.rank) : ''} · ${fmtDateTime(dec.at)}</div>
      ${dec.note ? `<div class="decision-note">${esc(dec.note)}</div>` : ''}
    </div>
  </div>`;
}

function pageDoj() {
  const cases = referredCases();
  const cu = Auth.current();
  return `
  <div class="page-head">
    <div>
      <h2><i class="fa-solid fa-scale-balanced"></i> قضايا الوزارة — الاعتماد القضائي</h2>
      <p>الملفات التي أحالها مكتب التحقيقات الفيدرالي إلى وزارة العدل. الاطلاع للقراءة فقط، ويمكن طباعة الملف واستعراض محتواه.</p>
    </div>
    <div class="head-actions"><span class="chip">${cases.length} قضية محالة</span></div>
  </div>

  <div class="card mt" style="margin-bottom:16px">
    <div class="card-head">
      <div class="card-title"><i class="fa-solid fa-stamp"></i> توقيعي وختمي — ${esc(cu ? cu.user : '—')}</div>
      <span class="chip chip-cyan">يظهران عند اعتماد المذكرات</span>
    </div>
    <div class="form-grid">
      <div class="field">${imageUploader('acSig', 'التوقيع الشخصي', (cu && cu.signature) || '', 'توقيع ممثل وزارة العدل')}</div>
      <div class="field">${imageUploader('acSeal', 'ختم الوزارة', (cu && cu.seal) || '', 'ختم الاعتماد الرسمي')}</div>
    </div>
    <button class="btn btn-primary" data-act="acct:media"><i class="fa-solid fa-floppy-disk"></i> حفظ التوقيع والختم</button>
  </div>

  ${cases.length ? `<div style="display:flex;flex-direction:column;gap:10px">
    ${cases.map(c => {
      const st = dashStageLabel(c);
      return `<div class="doc-card">
        <div class="doc-ico" style="background:rgba(200,162,74,.1);color:#d9c79a;border-color:rgba(200,162,74,.35)"><i class="fa-solid fa-scale-balanced"></i></div>
        <div style="min-width:0;flex:1">
          <div class="doc-ref">${esc(c.code)} · ${fmtDate(c.openedAt)}${c.referredToDoj ? ' · أُحيلت ' + fmtDate(c.referredToDoj) : ''}</div>
          <div class="doc-title">${esc(c.title)}</div>
          <div class="doc-info">${esc(c.summary || '—').slice(0, 120)}</div>
          <div class="chips" style="margin-top:7px">
            <span class="chip">${esc(st.label)}</span>
            <span class="chip chip-amber">${esc(c.priority)}</span>
            <span class="chip">أدلة: ${(c.evidence || []).length}</span>
            ${(c.dojComments || []).length ? `<span class="chip chip-violet"><i class="fa-solid fa-comment-dots"></i>ملاحظات: ${c.dojComments.length}</span>` : ''}
            ${c.dojDecision
              ? `<span class="chip ${c.dojDecision.status === 'approved' ? 'chip-green' : 'chip-red'}"><i class="fa-solid ${c.dojDecision.status === 'approved' ? 'fa-circle-check' : 'fa-circle-xmark'}"></i>${c.dojDecision.status === 'approved' ? 'معتمدة من الوزارة' : 'مرفوضة من الوزارة'}</span>`
              : '<span class="chip chip-cyan">بانتظار قرار الوزارة</span>'}
          </div>
        </div>
        <div class="doc-actions">
          <button class="btn btn-ghost btn-sm" data-act="doj:case" data-id="${c.id}"><i class="fa-solid fa-eye"></i> استعراض</button>
          <button class="btn btn-ghost btn-sm" data-act="case:print" data-id="${c.id}"><i class="fa-solid fa-file-pdf"></i> PDF</button>
        </div>
      </div>`;
    }).join('')}
  </div>` : `<div class="card empty"><i class="fa-solid fa-folder-open"></i><p>لا توجد قضايا محالة إلى وزارة العدل بعد.</p></div>`}`;
}

registerPage('doj', pageDoj);

/* استعراض قراءة فقط لممثل الوزارة */
action('doj:case', (id) => {
  const c = DB.cases.find(x => x.id === id); if (!c) return;
  const persons = (c.personIds || []).map(personById).filter(Boolean);
  const nets = (c.networkIds || []).map(netById).filter(Boolean);
  openModal({
    title: `${c.code} — ${c.title}`, icon: 'fa-scale-balanced', size: 'wide',
    body: `
      ${decisionBox(c.dojDecision, c.dojDecision && c.dojDecision.status)}
      <div class="chips" style="margin-bottom:10px">
        <span class="st ${c.status === 'مفتوحة' ? 'st-open' : 'st-closed'}">${esc(c.status)}</span>
        <span class="chip chip-amber">${esc(c.priority)}</span>
        <span class="chip">${esc(c.type)}</span>
        <span class="chip">${fmtDate(c.openedAt)}</span>
        <span class="chip">مقدم الملف: ${esc(c.openedBy || '—')}</span>
      </div>
      ${stepperHTML(c)}
      <p style="font-size:.84rem;line-height:2;color:var(--muted)">${esc(c.summary || 'لا ملخص مسجل.')}</p>
      <div class="section-title">المشتبه بهم (${persons.length})</div>
      <div class="chips">${persons.map(p => `<span class="chip chip-red">${esc(p.name)}${p.alias ? ' — ' + esc(p.alias) : ''}</span>`).join('') || '<span class="tiny muted">لا أحد</span>'}</div>
      <div class="section-title">الشبكات (${nets.length})</div>
      <div class="chips">${nets.map(n => `<span class="chip chip-violet">${esc(n.name)}</span>`).join('') || '<span class="tiny muted">لا شبكات</span>'}</div>
      <div class="section-title">الأدلة (${(c.evidence || []).length})</div>
      ${(c.evidence || []).length ? `<table class="tbl"><thead><tr><th>#</th><th>العنوان</th><th>النوع</th><th>الحالة</th></tr></thead><tbody>
        ${c.evidence.map(ev => `<tr><td class="mono tiny">${esc(ev.no || '—')}</td><td>${esc(ev.title)}</td><td>${esc(evType(ev.type).label)}</td><td>${evStatusChip(ev.status)}</td></tr>`).join('')}
      </tbody></table>` : '<p class="tiny muted">لا أدلة مسجلة.</p>'}
      <div class="section-title">سجل الملف (${(c.timeline || []).length})</div>
      ${(c.timeline || []).length ? `<div class="timeline case-tl">${c.timeline.slice(0, 8).map(t => `<div class="tl">${esc(t.text)}<small>${fmtDateTime(t.at)} · ${esc(t.by || '')}</small></div>`).join('')}</div>` : '<p class="tiny muted">—</p>'}

      <div class="section-title">ملاحظات الوزارة على الملف</div>
      ${dojNotesBox(c) || '<p class="tiny muted">لا توجد ملاحظات سابقة على هذا الملف.</p>'}
      <div class="field" style="margin-top:10px">
        <label>إرسال تعليق إلى مكتب التحقيقات — تعديل مطلوب أو ملفات ناقصة</label>
        <textarea class="inp" id="dc_text" rows="3" placeholder="مثال: ناقص محضر التحقيق الأولي وصور مسرح الجريمة، وضوح التهم الموجهة..."></textarea>
      </div>
      <button class="btn btn-primary" data-act="doj:comment" data-id="${c.id}"><i class="fa-solid fa-paper-plane"></i> إرسال التعليق</button>`,
    footer: `${!c.dojDecision ? `<button class="btn btn-green" data-act="doj:case-approve" data-id="${c.id}"><i class="fa-solid fa-circle-check"></i> اعتماد القضية</button>
      <button class="btn btn-danger" data-act="doj:case-reject" data-id="${c.id}"><i class="fa-solid fa-circle-xmark"></i> رفض القضية</button>` : ''}
      <button class="btn btn-primary" data-act="case:print" data-id="${c.id}"><i class="fa-solid fa-file-pdf"></i> طباعة الملف / PDF</button>
      <button class="btn btn-ghost" data-act="modal:close">إغلاق</button>`
  });
});

action('doj:comment', (id) => {
  const c = DB.cases.find(x => x.id === id); if (!c) return;
  const text = val('#dc_text');
  if (!text) return toast('اكتب التعليق أولاً', 'err');
  const u = Auth.current() || {};
  c.dojComments = Array.isArray(c.dojComments) ? c.dojComments : [];
  c.dojComments.unshift({ at: Date.now(), by: u.user || '—', name: u.name || 'ممثل وزارة العدل', text });
  c.dojNeedsRevision = true;
  logActivity(`تعليق وزارة العدل على القضية ${c.code}: ${text.slice(0, 60)}`, 'case');
  caseLog(c, `ملاحظة من وزارة العدل: ${text.slice(0, 90)}`);
  save(); closeModal(); ACTIONS['doj:case'](id);
  toast('تم إرسال التعليق إلى مكتب التحقيقات');
});

action('doj:case-approve', (id) => {
  const c = DB.cases.find(x => x.id === id); if (!c) return;
  c.dojDecision = Object.assign(dojStamp(), { status: 'approved' });
  logActivity(`اعتماد وزارة العدل للقضية ${c.code} — مقدم الملف ${c.openedBy || '—'}`, 'case');
  caseLog(c, 'قرار وزارة العدل: اعتماد الملف');
  save(); closeModal(); render(); toast('تم اعتماد القضية وإشعار مقدم الملف');
});

action('doj:case-reject', (id) => {
  const c = DB.cases.find(x => x.id === id); if (!c) return;
  c.dojDecision = Object.assign(dojStamp(), { status: 'rejected' });
  logActivity(`رفض وزارة العدل للقضية ${c.code} — مقدم الملف ${c.openedBy || '—'}`, 'case');
  caseLog(c, 'قرار وزارة العدل: رفض الملف');
  save(); closeModal(); render(); toast('تم رفض القضية وإشعار مقدم الملف', 'err');
});

/* ============================================================
   CASES
   ============================================================ */
function pageCases() {
  return `
  <div class="page-head">
    <div>
      <h2><i class="fa-solid fa-folder-closed"></i> ملفات القضايا</h2>
      <p>اربط الأشخاص والشبكات والأدلة في ملف واحد، وتابع حالة القضية وأولويتها.</p>
    </div>
    <div class="head-actions">
      <button class="btn btn-primary" data-act="case:new"><i class="fa-solid fa-folder-plus"></i> فتح قضية</button>
    </div>
  </div>

  ${DB.cases.length ? `<div class="grid-auto">
    ${DB.cases.map(c => {
      const pr = c.priority === 'حرج' ? 'chip-red' : c.priority === 'مرتفع' ? 'chip-amber' : 'chip-cyan';
      return `<article class="doc-card" style="flex-direction:column;gap:10px">
        <div style="display:flex;gap:10px;align-items:center;width:100%">
          <div class="doc-ico" style="background:rgba(34,197,94,.1);color:#4ade80;border-color:rgba(34,197,94,.3)"><i class="fa-solid fa-folder-open"></i></div>
          <div style="min-width:0;flex:1">
            <div class="doc-ref">${esc(c.code)} · ${fmtDate(c.openedAt)}</div>
            <div class="doc-title">${esc(c.title)}</div>
          </div>
          <span class="st ${c.status === 'مفتوحة' ? 'st-open' : 'st-closed'}">${esc(c.status)}</span>
        </div>
        <div class="tiny muted" style="line-height:1.8;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">${esc(c.summary || '')}</div>
        <div class="chips">
          <span class="chip ${pr}">${esc(c.priority)}</span>
          <span class="chip"><i class="fa-solid fa-user-secret"></i>${(c.personIds || []).length}</span>
          <span class="chip"><i class="fa-solid fa-sitemap"></i>${(c.networkIds || []).length}</span>
          <span class="chip"><i class="fa-solid fa-box-archive"></i>${(c.evidence || []).length}</span>
          <span class="chip chip-cyan"><i class="fa-solid fa-diagram-project"></i>${esc(CASE_STAGES[Math.min(CASE_STAGES.length - 1, Math.max(0, Number(c.stage) || 0))])}</span>
          ${(c.dojComments || []).length ? `<span class="chip chip-violet"><i class="fa-solid fa-comment-dots"></i>ملاحظات الوزارة: ${c.dojComments.length}</span>` : ''}
          ${c.dojDecision ? `<span class="chip ${c.dojDecision.status === 'approved' ? 'chip-green' : 'chip-red'}">${c.dojDecision.status === 'approved' ? 'معتمدة' : 'مرفوضة'}</span>` : ''}
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <button class="btn btn-ghost btn-sm" data-act="case:view" data-id="${c.id}"><i class="fa-solid fa-folder-open"></i> فتح الملف</button>
          <button class="btn btn-ghost btn-sm" data-act="case:print" data-id="${c.id}"><i class="fa-solid fa-print"></i> طباعة</button>
          <button class="btn btn-ghost btn-sm" data-act="case:evidence-pdf" data-id="${c.id}"><i class="fa-solid fa-file-pdf"></i> تقرير الأدلة PDF</button>
          <button class="btn btn-danger btn-sm" data-act="case:del" data-id="${c.id}"><i class="fa-solid fa-trash"></i></button>
        </div>
      </article>`;
    }).join('')}
  </div>` : `<div class="card empty"><i class="fa-solid fa-folder-plus"></i><p>لا قضايا مفتوحة.</p>
      <button class="btn btn-primary" data-act="case:new"><i class="fa-solid fa-plus"></i> فتح قضية</button></div>`}`;
}

function caseForm() {
  openModal({
    title: 'فتح ملف قضية', icon: 'fa-folder-plus', size: 'wide',
    body: `
      <div class="form-grid">
        <div class="field span-2"><label>عنوان القضية *</label><input class="inp" id="cf_title" placeholder="مثال: عملية نهر الفولاذ"></div>
        <div class="field"><label>النوع</label><input class="inp" id="cf_type" list="cf_types" placeholder="تهريب / عنف / غسيل أموال">
          <datalist id="cf_types"><option>تهريب مخدرات</option><option>عنف مسلح</option><option>غسيل أموال</option><option>تهريب بضائع</option><option>تزوير</option></datalist></div>
        <div class="field"><label>الأولوية</label><select class="inp" id="cf_priority"><option>حرج</option><option selected>مرتفع</option><option>متوسط</option><option>منخفض</option></select></div>
        <div class="field span-2"><label>ملخص التحقيق</label><textarea class="inp" id="cf_summary" rows="3" placeholder="الوقائع، نطاق التحقيق، الفرضيات..."></textarea></div>
        <div class="field span-2"><label>المشتبه بهم المرتبطون</label>
          <div style="max-height:150px;overflow-y:auto;border:1px solid var(--line);border-radius:9px;padding:8px;background:rgba(0,0,0,.25)">
            ${DB.persons.map(p => `<label style="display:flex;gap:8px;align-items:center;font-size:.78rem;padding:5px">
              <input type="checkbox" class="cf_person" value="${p.id}"> ${esc(p.name)} <span class="tiny muted">${esc(p.alias || '')}</span></label>`).join('') || '<span class="tiny muted">لا أشخاص مسجلون</span>'}
          </div></div>
        <div class="field span-2"><label>الشبكات المرتبطة</label>
          <div style="max-height:120px;overflow-y:auto;border:1px solid var(--line);border-radius:9px;padding:8px;background:rgba(0,0,0,.25)">
            ${DB.networks.map(n => `<label style="display:flex;gap:8px;align-items:center;font-size:.78rem;padding:5px">
              <input type="checkbox" class="cf_net" value="${n.id}"> ${esc(n.name)}</label>`).join('') || '<span class="tiny muted">لا شبكات مسجلة</span>'}
          </div></div>
      </div>`,
    footer: `<button class="btn btn-primary" data-act="case:create"><i class="fa-solid fa-folder-plus"></i> فتح القضية</button>
             <button class="btn btn-ghost" data-act="modal:close">إلغاء</button>`
  });
}

action('case:new', () => caseForm());
action('case:create', () => {
  const title = val('#cf_title');
  if (!title) return toast('عنوان القضية مطلوب', 'err');
  const code = `CR-${new Date().getFullYear()}-${String(DB.cases.length + 1).padStart(4, '0')}`;
  const c = {
    id: uid('CASE'), code, title, type: val('#cf_type') || 'عام', priority: val('#cf_priority') || 'مرتفع',
    status: 'مفتوحة', stage: 0, openedAt: new Date().toISOString(), summary: val('#cf_summary'),
    personIds: $$('.cf_person:checked').map(i => i.value),
    networkIds: $$('.cf_net:checked').map(i => i.value),
    evidence: [], timeline: []
  };
  DB.cases.unshift(c);
  logActivity(`فتح ملف قضية ${code} — ${title}`, 'case');
  caseLog(c, 'فتح ملف القضية — تصنيف «' + c.priority + '»');
  save(); closeModal(); render(); toast('تم فتح ملف القضية');
});

action('case:view', (id) => {
  const c = DB.cases.find(x => x.id === id); if (!c) return;
  const persons = (c.personIds || []).map(personById).filter(Boolean);
  const nets = (c.networkIds || []).map(netById).filter(Boolean);
  openModal({
    title: `${c.code} — ${c.title}`, icon: 'fa-folder-open', size: 'wide',
    body: `
      ${decisionBox(c.dojDecision, c.dojDecision && c.dojDecision.status)}
      <div class="chips" style="margin-bottom:10px">
        <span class="st ${c.status === 'مفتوحة' ? 'st-open' : 'st-closed'}">${esc(c.status)}</span>
        <span class="chip chip-amber">${esc(c.priority)}</span>
        <span class="chip">${esc(c.type)}</span>
        <span class="chip">${fmtDate(c.openedAt)}</span>
        <span class="chip">مقدم الملف: ${esc(c.openedBy || '—')}</span>
      </div>
      ${stepperHTML(c)}
      <p style="font-size:.84rem;line-height:2;color:var(--muted)">${esc(c.summary || 'لا ملخص مسجل.')}</p>

      <div class="section-title">المشتبه بهم (${persons.length})</div>
      <div class="chips">${persons.map(p => `<span class="chip chip-red" style="cursor:pointer" data-act="per:view" data-id="${p.id}"><i class="fa-solid fa-user-secret"></i>${esc(p.name)}</span>`).join('') || '<span class="tiny muted">لا أحد</span>'}</div>

      <div class="section-title">الشبكات (${nets.length})</div>
      <div class="chips">${nets.map(n => `<span class="chip chip-violet" style="cursor:pointer" data-act="net:view" data-id="${n.id}"><i class="fa-solid fa-sitemap"></i>${esc(n.name)}</span>`).join('') || '<span class="tiny muted">لا شبكات</span>'}</div>

      <div class="section-title">الأدلة الجنائية (${(c.evidence || []).length})</div>
      ${(c.evidence || []).length ? (c.evidence || []).map(ev => {
        const t = evType(ev.type);
        return `<div class="loc-item" style="margin-bottom:7px;cursor:pointer" data-act="ev:view" data-id="${c.id}|${ev.id}">
        <span class="loc-ico" style="background:rgba(8,145,178,.14);color:#67e8f9"><i class="fa-solid ${t.icon}"></i></span>
        <div style="min-width:0"><div class="loc-name">${esc(ev.no || '')} ${esc(ev.title)}</div>
          <div class="loc-sub">${esc(t.label)}${ev.lab ? ' · ' + esc(ev.lab) : ''}${ev.desc ? ' · ' + esc(ev.desc) : ''}</div></div>
        <div class="loc-actions">${evStatusChip(ev.status)}</div>
      </div>`; }).join('') : '<p class="tiny muted">لا أدلة مسجلة بعد. أضف أول دليل من النموذج أدناه.</p>'}

      ${dojNotesBox(c)}
      <div class="section-title">الخط الزمني للقضية (${(c.timeline || []).length})</div>
      ${(c.timeline || []).length
        ? `<div class="timeline case-tl">${c.timeline.slice(0, 8).map(t => `<div class="tl">${esc(t.text)}<small>${fmtDateTime(t.at)} · ${esc(t.by || '')}</small></div>`).join('')}</div>`
        : `<div class="timeline case-tl"><div class="tl">فتح ملف القضية — تصنيف «${esc(c.priority)}»<small>${fmtDateTime(c.openedAt)} · ${esc(c.openedBy || actorId())}</small></div></div>`}

      <div class="section-title">إضافة دليل جنائي</div>
      <div class="form-grid">
        <div class="field"><label>نوع الدليل</label><select class="inp" id="ef_type">
          ${Object.entries(EVIDENCE_TYPES).map(([k, t]) => `<option value="${k}">${t.label}</option>`).join('')}</select></div>
        <div class="field"><label>عنوان الدليل *</label><input class="inp" id="ef_title" placeholder="مسدس 9مم / مقذوف / مسحة DNA"></div>
        <div class="field"><label>رقم الدليل</label><input class="inp" id="ef_no" value="${evidenceNo()}" readonly></div>
        <div class="field"><label>حالة الدليل</label><select class="inp" id="ef_status">${EVIDENCE_STATUS.map(s => `<option>${s}</option>`).join('')}</select></div>
        <div class="field"><label>تاريخ ووقت الجمع</label><input class="inp" type="datetime-local" id="ef_collected"></div>
        <div class="field"><label>جامع الدليل</label><input class="inp" id="ef_by" value="${esc(accountInfo().name)}"></div>
        <div class="field"><label>مكان الجمع / الموقع</label><input class="inp" id="ef_loc" placeholder="مستودع 4 — الرف الجنوبي"></div>
        <div class="field"><label>المختبر</label><input class="inp" id="ef_lab" placeholder="مختبر الجريمة الجنائي — لوس سانتوس"></div>
        <div class="field"><label>الخبير / المحلل</label><input class="inp" id="ef_examiner"></div>
        <div class="field"><label>نتيجة المختبر</label><input class="inp" id="ef_result" placeholder="مطابقة إيجابية / بصمة صالحة..."></div>
        <div class="field"><label>نوع السلاح</label><input class="inp" id="ef_weapon" placeholder="مسدس / بندقية آلية"></div>
        <div class="field"><label>العيار</label><input class="inp" id="ef_caliber" placeholder="9×19mm / 5.56mm"></div>
        <div class="field"><label>الرقم التسلسلي</label><input class="inp" id="ef_serial"></div>
        <div class="field"><label>نتيجة المطابقة الباليستية</label><input class="inp" id="ef_match" placeholder="مطابقة / غير مطابقة / قيد الفحص"></div>
        <div class="field"><label>مرجع NIBIN</label><input class="inp" id="ef_nibin"></div>
        <div class="field"><label>الوزن / الكمية</label><input class="inp" id="ef_weight" placeholder="12.4 غرام / 3 عبوات"></div>
        <div class="field"><label>المبلغ (نقد)</label><input class="inp" id="ef_amount"></div>
        <div class="field"><label>ملف الدليل (PDF / صورة)</label>
          <input type="file" class="inp" id="ef_file" accept=".pdf,image/*" data-upload="raw" data-target="#ef_fileId" data-preview="#ef_prev" style="padding:7px">
          <input type="hidden" id="ef_fileId"></div>
        <div class="field span-2"><label>وصف تفصيلي وحيثيات الجمع</label><textarea class="inp" id="ef_desc" rows="2"></textarea></div>
      </div>`,
    footer: `<button class="btn btn-primary" data-act="case:eve-save" data-id="${c.id}"><i class="fa-solid fa-plus"></i> حفظ الدليل</button>
      <button class="btn btn-ghost" data-act="case:stage" data-id="${c.id}"><i class="fa-solid fa-forward-step"></i> المرحلة التالية</button>
      <button class="btn btn-ghost" ${c.referredToDoj ? 'disabled' : ''} data-act="case:refer" data-id="${c.id}"><i class="fa-solid fa-scale-balanced"></i> ${c.referredToDoj ? 'محالة إلى الوزارة' : 'إحالة لوزارة العدل'}</button>
      <button class="btn btn-ghost" data-act="case:print" data-id="${c.id}"><i class="fa-solid fa-print"></i> طباعة الملف</button>
      <button class="btn btn-primary" data-act="case:evidence-pdf" data-id="${c.id}"><i class="fa-solid fa-file-pdf"></i> تقرير الأدلة</button>
      <button class="btn btn-ghost" data-act="case:status" data-id="${c.id}"><i class="fa-solid fa-rotate"></i> ${c.status === 'مفتوحة' ? 'إغلاق القضية' : 'إعادة فتح'}</button>
      <button class="btn btn-ghost" data-act="modal:close">إغلاق</button>`
  });
});

action('case:refer', (id) => {
  const c = DB.cases.find(x => x.id === id); if (!c) return;
  if (c.referredToDoj) return toast('القضية محالة بالفعل إلى وزارة العدل', 'err');
  confirmDialog({
    title: 'إحالة القضية إلى وزارة العدل', confirmText: 'إحالة الملف',
    text: `سيظهر ملف «${c.code} — ${c.title}» لممثلي وزارة العدل للاطلاع فقط، دون أي سجلات أخرى.`, 
    onConfirm: () => {
      c.referredToDoj = Date.now();
      c.stage = Math.max(Number(c.stage) || 0, 5);
      logActivity(`إحالة القضية ${c.code} إلى وزارة العدل`, 'case');
      caseLog(c, 'إحالة الملف إلى وزارة العدل');
      save(); closeModal(); render(); toast('تمت إحالة القضية إلى وزارة العدل');
    }
  });
});

action('case:eve-save', (id) => {
  const c = DB.cases.find(x => x.id === id); if (!c) return;
  const title = val('#ef_title');
  if (!title) return toast('عنوان الدليل مطلوب', 'err');
  c.evidence = c.evidence || [];
  const no = val('#ef_no') || evidenceNo();
  const collectedBy = val('#ef_by') || accountInfo().name;
  const collectedAt = val('#ef_collected');
  const ev = {
    id: uid('EV'), no, type: val('#ef_type') || 'other', title,
    desc: val('#ef_desc'), location: val('#ef_loc'),
    collectedAt: collectedAt ? new Date(collectedAt).toISOString() : new Date().toISOString(),
    collectedBy, lab: val('#ef_lab'), examiner: val('#ef_examiner'),
    status: val('#ef_status') || 'مُجمّع', result: val('#ef_result'),
    weaponType: val('#ef_weapon'), caliber: val('#ef_caliber'), serial: val('#ef_serial'),
    matchStatus: val('#ef_match'), nibin: val('#ef_nibin'), weight: val('#ef_weight'),
    amount: val('#ef_amount'), fileId: val('#ef_fileId'),
    custody: [{ at: Date.now(), action: 'جمع الدليل', by: collectedBy, note: val('#ef_loc') }]
  };
  c.evidence.push(ev);
  logActivity(`إضافة دليل جنائي ${no} للقضية ${c.code}: ${title}`, 'case');
  caseLog(c, `إضافة دليل جنائي ${no}: ${title}`);
  save(); closeModal();
  toast('تم تسجيل الدليل في سجل الأدلة');
  setTimeout(() => ACTIONS['case:view'](c.id), 180);
});

action('case:status', (id) => {
  const c = DB.cases.find(x => x.id === id); if (!c) return;
  c.status = c.status === 'مفتوحة' ? 'مغلقة' : 'مفتوحة';
  logActivity(`تغيير حالة القضية ${c.code} إلى ${c.status}`, 'case');
  caseLog(c, `تغيير حالة القضية إلى «${c.status}»`);
  save(); closeModal();
  toast('تم تحديث حالة القضية');
  setTimeout(() => ACTIONS['case:view'](id), 160);
});

action('case:del', (id) => {
  const c = DB.cases.find(x => x.id === id); if (!c) return;
  confirmDialog({
    title: 'حذف ملف القضية', danger: true, confirmText: 'حذف',
    text: `سيتم حذف القضية ${c.code} وكل أدلتها من الأرشيف.`,
    onConfirm: () => {
      (c.evidence || []).forEach(e => e.fileId ? FileStore.remove(e.fileId) : null);
      DB.cases = DB.cases.filter(x => x.id !== id);
      save(); closeModal(); render(); toast('تم حذف القضية');
    }
  });
});

/* ============================================================
   PERSON PRINT
   ============================================================ */
action('per:print', (id) => {
  const p = personById(id); if (!p) return;
  printHTML(wantedSheet(p), 'اختر «حفظ كـ PDF» من نافذة الطباعة');
});

/* ============================================================
   SETTINGS
   ============================================================ */
const rankOpts = (sel) => {
  const list = (Auth.RANKS || []).slice();
  if (sel && list.indexOf(sel) === -1) list.unshift(sel);
  return list.map(r => `<option value="${esc(r)}"${r === sel ? ' selected' : ''}>${esc(r)}</option>`).join('');
};

function pageSettings() {
  const bytes = FileStore.usage();
  const filesCount = FileStore.cache.size;
  const cu = Auth.current();
  const admin = Auth.isAdmin();
  const accounts = Auth.list();
  return `
  <div class="page-head">
    <div>
      <h2><i class="fa-solid fa-gears"></i> الإعدادات والنسخ الاحتياطي</h2>
      <p>هوية العميل الفيدرالي، التوقيع المعتمد، الحسابات المخوّلة للدخول، وأدوات تصدير الأرشيف كاملاً أو استعادته. كل البيانات محلية على هذا الجهاز.</p>
    </div>
  </div>

  <div class="grid-2">
    <div class="card">
      <div class="card-head"><div class="card-title"><i class="fa-solid fa-id-badge"></i> ملفي الشخصي</div>
        <span class="chip mono">${esc(cu ? cu.user : '—')}</span></div>
      <div class="form-grid">
        <div class="field"><label>الاسم المعروض</label><input class="inp" id="pr_name" value="${esc(cu ? cu.name : '')}"></div>
        <div class="field"><label>الرتبة / الموقع</label><select class="inp" id="pr_rank">${rankOpts(cu ? cu.rank : '')}</select></div>
        <div class="field"><label>اسم المستخدم</label><input class="inp mono" value="${esc(cu ? cu.user : '')}" disabled></div>
        <div class="field"><label>الوحدة</label><input class="inp" id="pr_div" value="${esc(cu ? cu.division : '')}"></div>
        <div class="field span-2">${imageUploader('stPhoto', 'الصورة الرسمية', DB.settings.photo)}</div>
      </div>
      <button class="btn btn-primary" data-act="acct:profile"><i class="fa-solid fa-floppy-disk"></i> حفظ ملفي</button>
      <div class="tiny muted" style="margin-top:10px;line-height:1.8">اسمك ورتبتك يظهران في الشريط الجانبي، وفي مقدمة المذكرات والبرقيات التي تصدرها.</div>
    </div>

    <div class="card">
      <div class="card-head"><div class="card-title"><i class="fa-solid fa-database"></i> الأرشيف والنسخ</div></div>
      <dl class="kv">
        <dt>الأشخاص</dt><dd>${DB.persons.length}</dd>
        <dt>الشبكات</dt><dd>${DB.networks.length}</dd>
        <dt>المذكرات</dt><dd>${DB.docs.length}</dd>
        <dt>البرقيات</dt><dd>${DB.bulletins.length}</dd>
        <dt>القضايا</dt><dd>${DB.cases.length}</dd>
        <dt>الملفات المرفقة</dt><dd>${filesCount}</dd>
        <dt>حجم الملفات</dt><dd dir="ltr" style="text-align:right">${bytes > 1048576 ? (bytes / 1048576).toFixed(2) + ' MB' : Math.round(bytes / 1024) + ' KB'}</dd>
      </dl>
      <div class="btn-grid">
        <button class="btn btn-primary" data-act="set:export"><i class="fa-solid fa-file-export"></i> تصدير الأرشيف الكامل</button>
        ${admin ? `<label class="btn btn-ghost" for="importFile"><i class="fa-solid fa-file-import"></i> استيراد نسخة</label>
        <input type="file" id="importFile" accept="application/json,.json" style="display:none">
        <button class="btn btn-danger" data-act="data:wipe"><i class="fa-solid fa-eraser"></i> تصفير كل السجلات</button>
        <button class="btn btn-ghost" data-act="set:reset"><i class="fa-solid fa-rotate-left"></i> استعادة البيانات التجريبية</button>` : ''}
      </div>
      <div class="tiny muted" style="margin-top:14px;line-height:1.9">
        التصدير يشمل السجلات والصور والمرفقات في ملف JSON واحد. احتفظ به خارج الجهاز — مسح بيانات المتصفح يحذف الأرشيف المحلي.<br>
        <b style="color:#e2a19a">تصفير كل السجلات</b> يمسح الأشخاص والشبكات والقضايا والمذكرات والبرقيات والعلامات والملفات، ويُبقي هويتك وتوقيعك وحسابات الدخول كما هي.
        ${admin ? '' : '<br>إجراءات التصفير والاستيراد وإدارة الحسابات محصورة بالعميل <b class="mono">A-140</b> (كامل الصلاحيات).'}
      </div>
    </div>
  </div>

  <div class="card mt">
    <div class="card-head">
      <div class="card-title"><i class="fa-solid fa-key"></i> أمان الحساب</div>
      <button class="btn btn-ghost btn-sm" data-act="lock:now"><i class="fa-solid fa-lock"></i> قفل الجلسة الآن</button>
    </div>
    <dl class="kv">
      <dt>الحساب الحالي</dt><dd class="mono">${esc(cu ? cu.user : '—')}</dd>
      <dt>الصلاحية</dt><dd>${cu && cu.full ? 'كامل الصلاحيات (A-140)' : 'مستخدم مخوّل — استعراض وإدخال'}</dd>
      <dt>الرتبة</dt><dd>${esc(cu ? cu.rank || '—' : '—')}</dd>
    </dl>
    <div class="form-grid" style="margin-top:14px">
      <div class="field"><label>كلمة المرور الحالية</label><input class="inp" type="password" id="se_cur" autocomplete="current-password" placeholder="••••••••"></div>
      <div class="field"><label>كلمة المرور الجديدة (6 أحرف فأكثر)</label><input class="inp" type="password" id="se_new" autocomplete="new-password" placeholder="••••••••"></div>
    </div>
    <button class="btn btn-primary" data-act="pin:change"><i class="fa-solid fa-key"></i> تحديث كلمة المرور</button>
    <div class="tiny muted" style="margin-top:10px;line-height:1.8">يُقفل النظام تلقائياً بعد 15 دقيقة من عدم النشاط، ويُطلب اسم المستخدم وكلمة المرور عند كل جلسة جديدة. جميع عمليات الدخول مسجّلة في سجل التدقيق.</div>
  </div>

  <div class="card mt">
    <div class="card-head">
      <div class="card-title"><i class="fa-solid fa-stamp"></i> توقيعي وختمي — ${esc(cu ? cu.user : '—')}</div>
      <span class="chip">خاص بالحساب الحالي</span>
    </div>
    <div class="form-grid">
      <div class="field">${imageUploader('acSig', 'التوقيع الشخصي', (cu && cu.signature) || '', 'يُستخدم تلقائياً في المذكرات والبرقيات التي تصدرها')}</div>
      <div class="field">${imageUploader('acSeal', 'الختم الشخصي', (cu && cu.seal) || '', 'يظهر بجوار توقيعك في المستندات المطبوعة')}</div>
    </div>
    <button class="btn btn-primary" data-act="acct:media"><i class="fa-solid fa-floppy-disk"></i> حفظ التوقيع والختم</button>
    <div class="tiny muted" style="margin-top:10px;line-height:1.8">كل حساب له توقيعه وختمه الخاص. عند إصدار مذكرة أو برقية يُستخدم توقيع صاحب الحساب وختمه تلقائياً، ويمكن تغييرهما لكل مستند على حدة.</div>
  </div>

  <div class="card mt">
    <div class="card-head">
      <div class="card-title"><i class="fa-solid fa-users-gear"></i> الحسابات المخوّلة للدخول</div>
      <span class="chip chip-cyan">${accounts.length} حساب</span>
    </div>
    <table class="tbl"><thead><tr><th>اسم المستخدم</th><th>الاسم</th><th>الرتبة / الموقع</th><th>الصلاحية</th>${admin ? '<th></th>' : ''}</tr></thead><tbody>
      ${accounts.map(u => `<tr>
        <td class="mono">${esc(u.user)}</td><td>${esc(u.name)}</td><td>${esc(u.rank || '—')}</td>
        <td>${u.role === 'doj' ? '<span class="chip chip-violet">وزارة العدل</span>' : u.full ? '<span class="chip chip-amber">كامل الصلاحيات</span>' : '<span class="chip">مخوّل</span>'}</td>
        ${admin ? `<td style="text-align:left;white-space:nowrap">
          <button class="btn btn-ghost btn-sm" data-act="user:edit" data-id="${esc(u.user)}" title="تعديل الاسم والرتبة"><i class="fa-solid fa-pen"></i></button>
          <button class="btn btn-ghost btn-sm" data-act="user:reset" data-id="${esc(u.user)}" title="إعادة تعيين كلمة المرور"><i class="fa-solid fa-key"></i></button>
          <button class="btn btn-danger btn-sm" data-act="user:del" data-id="${esc(u.user)}" title="حذف الحساب"><i class="fa-solid fa-trash"></i></button>
        </td>` : ''}
      </tr>`).join('')}
    </tbody></table>
    ${admin ? `<div class="form-grid" style="margin-top:14px">
      <div class="field"><label>اسم مستخدم جديد</label><input class="inp" id="nu_user" placeholder="A-9" dir="ltr" autocomplete="off"></div>
      <div class="field"><label>كلمة المرور</label><input class="inp" id="nu_pass" type="password" placeholder="••••••••" autocomplete="new-password"></div>
      <div class="field"><label>الاسم المعروض</label><input class="inp" id="nu_name" placeholder="العميل A-9"></div>
      <div class="field"><label>الرتبة / الموقع</label><select class="inp" id="nu_rank">${rankOpts('محقق فيدرالي')}</select></div>
      <div class="field"><label>الصلاحية</label><select class="inp" id="nu_full"><option value="0">مستخدم مخوّل</option><option value="1">كامل الصلاحيات</option></select></div>
      <div class="field"><label>نوع الحساب</label><select class="inp" id="nu_role">
        <option value="fib">مكتب التحقيقات (FBI)</option>
        <option value="doj">وزارة العدل (اعتماد المذكرات)</option></select></div>
    </div>
    <button class="btn btn-primary" data-act="user:add"><i class="fa-solid fa-user-plus"></i> إضافة حساب</button>
    <div class="tiny muted" style="margin-top:10px;line-height:1.8">إدارة الحسابات محصورة بالعميل <b class="mono">A-140</b>. كلمات المرور تُخزَّن مشفّرة (SHA-256 + Salt) ولا يمكن قراءتها بعد الحفظ — يمكن إعادة تعيينها فقط.</div>`
      : `<div class="tiny muted" style="margin-top:12px;line-height:1.8">إضافة الحسابات أو حذفها أو إعادة تعيين كلمات المرور متاح للعميل <b class="mono">A-140</b> فقط.</div>`}
  </div>

  <div class="card mt">
    <div class="card-head">
      <div class="card-title"><i class="fa-solid fa-scale-balanced"></i> حسابات وزارة العدل</div>
      <span class="chip chip-violet">${accounts.filter(u => u.role === 'doj').length} حساب</span>
    </div>
    <div class="tiny muted" style="line-height:1.9;margin-bottom:12px">
      حسابات وزارة العدل تفتح على <b>المذكرات الواردة لاعتمادها</b> و<b>القضايا المحالة للوزارة</b> فقط — اعتماد أو رفض المذكرات، واستعراض القضايا، دون الوصول لأي سجلات أخرى. لكل حساب توقيعه وختمه فقط.
    </div>
    ${accounts.filter(u => u.role === 'doj').length ? `<table class="tbl"><thead><tr><th>اسم المستخدم</th><th>الاسم</th><th></th></tr></thead><tbody>
      ${accounts.filter(u => u.role === 'doj').map(u => `<tr>
        <td class="mono">${esc(u.user)}</td><td>${esc(u.name)}</td>
        <td style="text-align:left;white-space:nowrap">${admin ? `<button class="btn btn-ghost btn-sm" data-act="user:reset" data-id="${esc(u.user)}" title="إعادة تعيين كلمة المرور"><i class="fa-solid fa-key"></i></button>
          <button class="btn btn-danger btn-sm" data-act="user:del" data-id="${esc(u.user)}" title="حذف الحساب"><i class="fa-solid fa-trash"></i></button>` : ''}</td>
      </tr>`).join('')}
    </tbody></table>` : '<div class="tiny muted">لا توجد حسابات وزارة عدل بعد.</div>'}
    ${admin ? `<div class="form-grid" style="margin-top:14px">
      <div class="field"><label>اسم المستخدم</label><input class="inp" id="du_user" placeholder="DOJ-01" dir="ltr" autocomplete="off"></div>
      <div class="field"><label>كلمة المرور</label><input class="inp" id="du_pass" type="password" placeholder="••••••••" autocomplete="new-password"></div>
      <div class="field"><label>الاسم المعروض</label><input class="inp" id="du_name" placeholder="ممثل وزارة العدل"></div>
    </div>
    <button class="btn btn-primary" data-act="doj:add"><i class="fa-solid fa-user-plus"></i> إضافة حساب وزارة العدل</button>`
      : ''}
  </div>

  <div class="card mt">
    <div class="card-head"><div class="card-title"><i class="fa-solid fa-shield-halved"></i> حالة النظام</div></div>
    <div class="grid-3">
      <div class="loc-item"><span class="loc-ico" style="background:rgba(34,197,94,.12);color:#4ade80"><i class="fa-solid fa-lock"></i></span>
        <div><div class="loc-name">التخزين المحلي</div><div class="loc-sub">localStorage + IndexedDB</div></div></div>
      <div class="loc-item"><span class="loc-ico" style="background:rgba(61,127,184,.16);color:#9fc7e8"><i class="fa-solid fa-shield"></i></span>
        <div><div class="loc-name">مؤشر التهديد</div><div class="loc-sub">${threatIndex()}% · ${threatLevel()}</div></div></div>
      <div class="loc-item"><span class="loc-ico" style="background:rgba(245,158,11,.12);color:#fcd34d"><i class="fa-solid fa-clock"></i></span>
        <div><div class="loc-name">آخر نشاط</div><div class="loc-sub">${DB.activity[0] ? timeAgo(DB.activity[0].at) : '—'}</div></div></div>
    </div>
  </div>`;
}

function mountSettings() {
  const inp = $('#importFile');
  if (!inp) return;
  inp.addEventListener('change', async () => {
    const file = inp.files && inp.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const state = data.state || data;
      const keepSecurity = DB.settings.security;
      confirmDialog({
        title: 'استيراد الأرشيف', confirmText: 'استيراد واستبدال',
        text: 'سيتم استبدال الأرشيف الحالي ببيانات النسخة المستوردة. هل تريد المتابعة؟',
        onConfirm: async () => {
          DB = normalizeState(state);
          if (keepSecurity && keepSecurity.users && keepSecurity.users.length) DB.settings.security = keepSecurity;
          save();
          const files = data.files || [];
          for (const f of files) { try { await FileStore.put(f); } catch (e) { } }
          logActivity('استيراد أرشيف خارجي', 'system');
          save(); render(); toast('تم استيراد الأرشيف بنجاح');
        }
      });
    } catch (err) {
      toast('ملف النسخة غير صالح', 'err');
    }
    inp.value = '';
  });
}

action('set:save', () => {
  Object.assign(DB.settings, {
    agentName: val('#st_name'),
    agentId: val('#st_id'),
    rank: val('#st_rank'),
    division: val('#st_division'),
    photo: val('#stPhoto_id'),
    signature: val('#stSig_id')
  });
  save(); render(); toast('تم حفظ هوية العميل');
});

action('set:export', () => {
  const payload = {
    app: 'FIB/DOJ', version: 4, exportedAt: new Date().toISOString(),
    state: DB, files: Array.from(FileStore.cache.values())
  };
  const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
  downloadBlob(blob, `A140-archive-${new Date().toISOString().slice(0, 10)}.json`);
  toast('تم تصدير الأرشيف الكامل');
});

action('data:wipe', () => {
  confirmDialog({
    title: 'تصفير جميع السجلات', danger: true, confirmText: 'تصفير نهائي',
    text: 'سيتم مسح كل الأشخاص والشبكات والقضايا والمذكرات والبرقيات وعلامات الخريطة وتقارير الأدلة والملفات المرفقة. تبقى هويتك وتوقيعك وحسابات الدخول بدون تغيير. لا يمكن التراجع — صدّر نسخة احتياطية أولاً إن أردت الاحتفاظ بها.',
    onConfirm: () => {
      const keep = new Set([DB.settings.photo, DB.settings.signature].filter(Boolean));
      Auth.list().forEach(u => { if (u.signature) keep.add(u.signature); if (u.seal) keep.add(u.seal); });
      Array.from(FileStore.cache.keys()).forEach(id => { if (!keep.has(id)) FileStore.remove(id); });
      DB.persons = [];
      DB.networks = [];
      DB.cases = [];
      DB.docs = [];
      DB.bulletins = [];
      DB.markers = [];
      DB.reports = [];
      DB.activity = [];
      Object.assign(DB.settings, { agentName: '', agentId: '', rank: '', division: '' });
      save(); closeModal();
      route = { page: 'dashboard', id: null };
      render();
      toast('تم تصفير الأرشيف — جاهز لبداية جديدة');
    }
  });
});

action('set:reset', () => {
  confirmDialog({
    title: 'استعادة البيانات الافتراضية', danger: true, confirmText: 'مسح واستعادة',
    text: 'سيتم مسح جميع السجلات والملفات المحلية واستعادة الأرشيف الافتراضي. لا يمكن التراجع.',
    onConfirm: () => {
      const keepSecurity = DB.settings.security;
      const keep = new Set([DB.settings.photo, DB.settings.signature].filter(Boolean));
      Auth.list().forEach(u => { if (u.signature) keep.add(u.signature); if (u.seal) keep.add(u.seal); });
      Array.from(FileStore.cache.keys()).forEach(id => { if (!keep.has(id)) FileStore.remove(id); });
      DB = normalizeState(seedState());
      if (keepSecurity && keepSecurity.users && keepSecurity.users.length) DB.settings.security = keepSecurity;
      save(); route = { page: 'dashboard', id: null }; render(); toast('تمت استعادة الأرشيف الافتراضي');
    }
  });
});

/* ============================================================
   CASE WORKFLOW · STAGES + DOSSIER
   ============================================================ */
const CASE_STAGES = ['بلاغ', 'تحقيق أولي', 'تحقيق موسع', 'طلب مذكرة', 'تنفيذ', 'إحالة للنيابة', 'مغلقة'];

function caseStage(c) {
  const i = clamp(Number(c.stage) || 0, 0, CASE_STAGES.length - 1);
  return { index: i, label: CASE_STAGES[i] };
}

function stepperHTML(c) {
  const cur = caseStage(c).index;
  return `<div class="stepper">${CASE_STAGES.map((s, i) =>
    `<span class="step ${i < cur ? 'done' : ''} ${i === cur ? 'current' : ''}"><span class="step-num">${String(i + 1).padStart(2, '0')}</span>${esc(s)}</span>`).join('')}</div>`;
}

action('case:stage', (id) => {
  const c = DB.cases.find(x => x.id === id); if (!c) return;
  const cur = caseStage(c).index;
  if (cur >= CASE_STAGES.length - 1) return toast('القضية في مرحلتها النهائية', 'err');
  c.stage = cur + 1;
  if (c.stage === CASE_STAGES.length - 1) c.status = 'مغلقة';
  logActivity(`القضية ${c.code}: الانتقال إلى مرحلة «${CASE_STAGES[c.stage]}»`, 'case');
  caseLog(c, `الانتقال إلى مرحلة «${CASE_STAGES[c.stage]}»`);
  save(); closeModal();
  toast('تم تحديث مرحلة القضية');
  ACTIONS['case:view'](id);
});

function caseSheet(c) {
  const persons = (c.personIds || []).map(personById).filter(Boolean);
  const nets = (c.networkIds || []).map(netById).filter(Boolean);
  const cur = caseStage(c).index;
  const acct = accountInfo();
  const sign = FileStore.url(sigOf()) || '';
  return `<div class="sheet">
    <div class="sheet-frame"></div>
    <div class="watermark">CASE FILE</div>
    <div class="sheet-inner">
      ${sheetHead()}
      <div class="sheet-title"><h1>ملف قضية · ${esc(c.code)}</h1><div class="en">CASE DOSSIER · ${esc(c.type || '')}</div></div>
      <div class="sheet-meta">
        <span>الحالة: <b>${esc(c.status)}</b></span>
        <span>الأولوية: <b>${esc(c.priority)}</b></span>
        <span>فتح الملف: <b>${fmtDate(c.openedAt)}</b></span>
        <span>المرحلة: <b>${esc(CASE_STAGES[cur])}</b></span>
      </div>
      <div class="sheet-sec"><h4>عنوان القضية</h4><p style="font-weight:700">${esc(c.title)}</p></div>
      <div class="sheet-sec"><h4>ملخص التحقيق</h4><p>${esc(c.summary || '—')}</p></div>
      <div class="sheet-sec"><h4>المشتبه بهم (${persons.length})</h4>
        ${persons.length ? `<table class="sheet-table"><thead><tr><th>الاسم</th><th>اللقب</th><th>الشبكة</th><th>الحالة</th><th>التهم</th></tr></thead><tbody>
          ${persons.map(p => `<tr><td>${esc(p.name)}</td><td>${esc(p.alias || '—')}</td><td>${esc(netName(p.networkId))}</td><td>${esc(p.status)}</td><td>${esc((p.charges || '—').slice(0, 90))}</td></tr>`).join('')}
        </tbody></table>` : '<p>—</p>'}</div>
      <div class="sheet-sec"><h4>الشبكات المرتبطة</h4><p>${nets.length ? nets.map(n => esc(n.name)).join(' · ') : '—'}</p></div>
      <div class="sheet-sec"><h4>الأدلة والمرفقات</h4>
        ${(c.evidence || []).length ? `<ol class="sheet-list">${c.evidence.map(e => `<li><b>${esc(e.title)}</b> — ${esc(e.kind || 'دليل')}${e.desc ? ' · ' + esc(e.desc) : ''}</li>`).join('')}</ol>` : '<p>—</p>'}</div>
      <div class="sheet-sec"><h4>مراحل القضية</h4>
        <div class="stage-line">${CASE_STAGES.map((s, i) => `<span class="stage-dot ${i <= cur ? 'on' : ''}">${esc(s)}</span>`).join('')}</div></div>
      <div class="sheet-sign">
        <div>
          <div class="sig-role">المحقق المسؤول</div>
          ${sign ? `<img class="sig-img" src="${sign}" alt="signature">` : '<div style="height:17mm"></div>'}
          <div class="sig-line"></div>
          <div class="sig-name">${esc(acct.name)}</div>
          <div class="sig-role">${esc(acct.rank)} · ${esc(acct.user)}</div>
        </div>
        <div>${barcodeHTML(c.code)}</div>
      </div>
      ${(c.dojComments || []).length ? `<div class="sheet-sec"><h4>ملاحظات وزارة العدل</h4><ol class="sheet-list">
        ${c.dojComments.map(n => `<li>${esc(n.text)} — <span style="color:#5b6b78;font-size:7.5pt">${esc(n.name || n.by || '')} · ${fmtDate(n.at)}</span></li>`).join('')}
      </ol></div>` : ''}
      ${c.dojDecision ? `<div class="sheet-sec" style="margin-top:3mm;border-top:1px dashed #b9c5d0;padding-top:3mm">
        <h4>قرار وزارة العدل</h4>
        <p><b>${c.dojDecision.status === 'approved' ? 'معتمد' : 'مرفوض'}</b> — ${esc(c.dojDecision.name || 'ممثل وزارة العدل')}${c.dojDecision.rank ? ' · ' + esc(c.dojDecision.rank) : ''} · ${fmtDate(c.dojDecision.at)}</p>
        <div style="display:flex;gap:8mm;align-items:flex-end">
          ${FileStore.url(c.dojDecision.signature) ? `<img class="sig-img" src="${FileStore.url(c.dojDecision.signature)}" alt="">` : ''}
          ${FileStore.url(c.dojDecision.seal) ? `<img class="seal-img" style="max-height:20mm" src="${FileStore.url(c.dojDecision.seal)}" alt="">` : ''}
        </div>
      </div>` : ''}
      <div class="sheet-foot"><span>سري — للاستخدام الرسمي فقط</span><span>${esc(c.code)} · ${fmtDate(new Date())}</span></div>
    </div>
  </div>`;
}

action('case:print', (id) => {
  const c = DB.cases.find(x => x.id === id); if (!c) return;
  printHTML(caseSheet(c), 'اختر «حفظ كـ PDF» من نافذة الطباعة');
});

/* ============================================================
   EVIDENCE / SUSPECT PDF REPORTS
   ============================================================ */
const EVIDENCE_RECIPIENTS = {
  chief: 'رئيس التحقيق',
  alpha: 'رئيس المباحث الفيدرالي — ألفا',
  doj: 'مكتب المدعي العام'
};

function nextEvidenceRef() {
  const y = new Date().getFullYear();
  return `EVD-${y}-${String(((DB.reports || []).length) + 1).padStart(4, '0')}`;
}

function photoCellsFor(persons, limitPerPerson = 3) {
  const cells = [];
  persons.forEach(p => {
    const ids = [p.photo, ...(p.photos || [])].filter(Boolean).slice(0, limitPerPerson);
    ids.forEach((fid, i) => {
      if (FileStore.get(fid)) cells.push({ src: FileStore.url(fid), cap: p.name + (i ? ` — ${i}` : '') });
    });
  });
  return cells.slice(0, 8);
}

function evidencePdfModal(caseId) {
  if (!DB.cases.length) return toast('افتح ملف قضية أولاً', 'err');
  const c = DB.cases.find(x => x.id === caseId) || DB.cases[0];
  openModal({
    title: 'إصدار تقرير أدلة PDF', icon: 'fa-file-pdf', size: 'narrow',
    body: `
      <div class="field"><label>القضية</label><select class="inp" id="ev_case">
        ${DB.cases.map(x => `<option value="${x.id}" ${x.id === c.id ? 'selected' : ''}>${esc(x.code)} — ${esc(x.title)}</option>`).join('')}
      </select></div>
      <div class="field"><label>الجهة المرسل إليها</label><select class="inp" id="ev_to">
        ${Object.entries(EVIDENCE_RECIPIENTS).map(([k, v], i) => `<option value="${k}" ${i === 0 ? 'selected' : ''}>${v}</option>`).join('')}
      </select></div>
      <div class="field"><label>مذكرة إلى الجهة (اختياري)</label><textarea class="inp" id="ev_note" rows="3" placeholder="نص موجز يرفع مع التقرير..."></textarea></div>
      <label class="chk"><input type="checkbox" id="ev_photos" checked> إدراج صور المشتبه بهم</label>
      <label class="chk"><input type="checkbox" id="ev_thumbs" checked> إدراج ملحق صور الأدلة</label>
      <div class="tiny muted" style="margin-top:10px;line-height:1.8">مستند A4 رسمي بالشعار والختم والباركود، يشمل بيانات المشتبه بهم وصورهم وجدول الأدلة — جاهز للحفظ كـ PDF.</div>`,
    footer: `<button class="btn btn-primary" data-act="evidence:print"><i class="fa-solid fa-print"></i> توليد وطباعة</button>
             <button class="btn btn-ghost" data-act="modal:close">إلغاء</button>`
  });
}

function evidenceSheet(c, opts) {
  const recipient = EVIDENCE_RECIPIENTS[opts.recipient] || opts.recipient || 'رئيس التحقيق';
  const persons = (c.personIds || []).map(personById).filter(Boolean);
  const evidence = c.evidence || [];
  const photos = opts.includePhotos ? photoCellsFor(persons) : [];
  const thumbs = [];
  if (opts.includeThumbs) {
    evidence.forEach(ev => {
      const f = ev.fileId ? FileStore.get(ev.fileId) : null;
      if (f && String(f.type || '').startsWith('image/')) thumbs.push({ src: f.dataUrl, cap: ev.title });
    });
  }
  const ref = opts.ref || nextEvidenceRef();
  const acct = accountInfo();
  const sign = FileStore.url(sigOf()) || '';
  return `<div class="sheet">
    <div class="sheet-frame"></div>
    <div class="watermark">EVIDENCE</div>
    <div class="sheet-inner">
      ${sheetHead()}
      <div class="sheet-title"><h1>تقرير أدلة ومستندات</h1><div class="en">EVIDENCE &amp; EXHIBITS REPORT</div></div>
      <div class="sheet-meta">
        <span>المرجع: <b>${esc(ref)}</b></span>
        <span>القضية: <b>${esc(c.code)}</b></span>
        <span>التاريخ: <b>${fmtDate(new Date())}</b></span>
      </div>
      <div class="report-to">
        <div><div class="sig-role">إلى</div><div style="font-weight:700;font-size:11pt">${esc(recipient)}</div></div>
        <div style="text-align:left"><div class="sig-role">من</div>
          <div style="font-weight:700;font-size:10pt">${esc(acct.name)} · ${esc(acct.user)}</div>
          <div class="sig-role">${esc(acct.rank)}</div></div>
      </div>
      <div class="sheet-body">
        <div class="sheet-sec"><h4>الموضوع</h4><p style="font-weight:700">${esc(c.title)} — ${esc(c.type || '')}</p></div>
        <div class="sheet-sec"><h4>ملخص التحقيق</h4><p>${esc(c.summary || '—')}</p></div>
        ${opts.note ? `<div class="sheet-sec"><h4>مذكرة إلى ${esc(recipient)}</h4><p>${esc(opts.note)}</p></div>` : ''}
        <div class="sheet-sec"><h4>المشتبه بهم (${persons.length})</h4>
          ${persons.length ? `<table class="sheet-table"><thead><tr><th>الاسم</th><th>اللقب</th><th>الرقم</th><th>الحالة</th><th>المنصب</th><th>التهم</th></tr></thead><tbody>
            ${persons.map(p => `<tr><td>${esc(p.name)}</td><td>${esc(p.alias || '—')}</td><td>${esc(p.id)}</td><td>${esc(p.status)}</td><td>${esc(p.rank)}</td><td>${esc((p.charges || '—').slice(0, 70))}</td></tr>`).join('')}
          </tbody></table>` : '<p>—</p>'}
        </div>
        ${photos.length ? `<div class="sheet-sec"><h4>صور المشتبه بهم</h4><div class="photo-grid">${photos.map(ph => `<div class="photo-cell"><img src="${ph.src}" alt=""><span>${esc(ph.cap)}</span></div>`).join('')}</div></div>` : ''}
        <div class="sheet-sec"><h4>جدول الأدلة (${evidence.length})</h4>
          ${evidence.length ? `<table class="sheet-table"><thead><tr><th>#</th><th>العنوان</th><th>النوع</th><th>الوصف</th><th>الحالة</th><th>المرفق</th></tr></thead><tbody>
            ${evidence.slice(0, 6).map((e, i) => `<tr><td>${String(i + 1).padStart(2, '0')}</td><td>${esc(e.title)}</td><td>${esc(evType(e.type).label)}</td><td>${esc(e.desc || '—')}</td><td>${esc(e.status || '—')}</td><td>${e.fileId ? esc(FileStore.name(e.fileId)) : '—'}</td></tr>`).join('')}
          </tbody></table>${evidence.length > 6 ? `<p class="tiny" style="color:#5b6b78;font-size:7.5pt;margin-top:2mm">بقية الأدلة (${evidence.length - 6}) مُدرجة في ملحق الأدلة المرفق.</p>` : ''}` : '<p>لا أدلة مسجلة في هذا الملف.</p>'}
        </div>
        ${thumbs.length ? `<div class="sheet-sec"><h4>ملحق صور الأدلة</h4><div class="photo-grid">${thumbs.slice(0, 4).map(t => `<div class="photo-cell"><img src="${t.src}" alt=""><span>${esc(t.cap)}</span></div>`).join('')}</div></div>` : ''}
        <p style="font-size:9pt">أُرفع هذا التقرير إلى ${esc(recipient)} لاتخاذ ما يلزم، والأدلة المذكورة محفوظة في الأرشيف الرقمي ويمكن طلب أصلها في أي وقت.</p>
      </div>
      <div class="sheet-sign">
        <div>
          <div class="sig-role">مُعد التقرير</div>
          ${sign ? `<img class="sig-img" src="${sign}" alt="">` : '<div style="height:16mm"></div>'}
          <div class="sig-line"></div>
          <div class="sig-name">${esc(acct.name)}</div>
          <div class="sig-role">${esc(acct.rank)} · ${esc(acct.user)}</div>
        </div>
        <div>
          <div class="sig-role">استلام / اعتماد</div>
          <div style="height:16mm"></div>
          <div class="sig-line"></div>
          <div class="sig-name">${esc(recipient)}</div>
          <div class="sig-role">التاريخ: ____ / ____ / ________</div>
        </div>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-top:4mm">
        <div style="font-size:7pt;color:#5b6b78">AUTHENTICATION · ${esc(ref)}</div>
        ${barcodeHTML(ref)}
      </div>
      <div class="sheet-foot"><span>سري — للاستخدام الرسمي فقط</span><span>${esc(c.code)} · FIB · صفحة 1 من ${opts.pages || 1}</span></div>
    </div>
  </div>`;
}

function evidenceAppendix(c, opts) {
  const evidence = c.evidence || [];
  const persons = (c.personIds || []).map(personById).filter(Boolean);
  const photos = opts.includePhotos ? photoCellsFor(persons, 2) : [];
  const thumbs = [];
  if (opts.includeThumbs) {
    evidence.forEach(ev => {
      const f = ev.fileId ? FileStore.get(ev.fileId) : null;
      if (f && String(f.type || '').startsWith('image/')) thumbs.push({ src: f.dataUrl, cap: ev.title });
    });
  }
  const perPage = 12;
  const pages = Math.max(1, Math.ceil(evidence.length / perPage));
  const total = pages + 1;
  let html = '';
  for (let p = 0; p < pages; p++) {
    const rows = evidence.slice(p * perPage, p * perPage + perPage);
    const last = p === pages - 1;
    html += `<div class="sheet">
      <div class="sheet-frame"></div>
      <div class="watermark">EXHIBITS</div>
      <div class="sheet-inner">
        ${sheetHead()}
        <div class="sheet-cont"><span>ملحق الأدلة · EXHIBIT SCHEDULE</span><span>${esc(c.code)} · ${esc(opts.ref || '')}</span></div>
        <div class="sheet-sec"><h4>جدول الأدلة الكامل (${evidence.length})</h4>
          <table class="sheet-table"><thead><tr><th>#</th><th>العنوان</th><th>النوع</th><th>الوصف</th><th>الحالة</th><th>المرفق</th></tr></thead><tbody>
          ${rows.map((e, i) => `<tr><td>${String(p * perPage + i + 1).padStart(2, '0')}</td><td>${esc(e.title)}</td><td>${esc(evType(e.type).label)}</td><td>${esc(e.desc || '—')}</td><td>${esc(e.status || '—')}</td><td>${e.fileId ? esc(FileStore.name(e.fileId)) : '—'}</td></tr>`).join('')}
          </tbody></table>
        </div>
        ${last && photos.length ? `<div class="sheet-sec"><h4>لوحة صور المشتبه بهم</h4><div class="photo-grid">${photos.map(ph => `<div class="photo-cell"><img src="${ph.src}" alt=""><span>${esc(ph.cap)}</span></div>`).join('')}</div></div>` : ''}
        ${last && thumbs.length ? `<div class="sheet-sec"><h4>صور الأدلة المادية</h4><div class="photo-grid">${thumbs.map(t => `<div class="photo-cell"><img src="${t.src}" alt=""><span>${esc(t.cap)}</span></div>`).join('')}</div></div>` : ''}
        <div class="sheet-foot"><span>سري — ملحق أدلة رسمي</span><span>${esc(c.code)} · صفحة ${p + 2} من ${total}</span></div>
      </div>
    </div>`;
  }
  return html;
}

function evidencePacketHTML(c, opts) {
  const pages = 1 + Math.max(1, Math.ceil(((c.evidence || []).length) / 12));
  return evidenceSheet(c, Object.assign({}, opts, { pages })) + evidenceAppendix(c, opts);
}

action('case:evidence-pdf', (id) => evidencePdfModal(id));

action('evidence:print', () => {
  const c = DB.cases.find(x => x.id === val('#ev_case'));
  if (!c) return toast('اختر القضية', 'err');
  const opts = {
    recipient: val('#ev_to') || 'chief',
    note: val('#ev_note'),
    includePhotos: $('#ev_photos') ? $('#ev_photos').checked : true,
    includeThumbs: $('#ev_thumbs') ? $('#ev_thumbs').checked : true
  };
  opts.ref = nextEvidenceRef();
  DB.reports = DB.reports || [];
  DB.reports.unshift({
    id: uid('RPT'), ref: opts.ref, caseId: c.id, caseCode: c.code, caseTitle: c.title,
    recipient: opts.recipient, note: opts.note, status: 'مُرسل',
    createdAt: Date.now(), by: actorId()
  });
  const label = EVIDENCE_RECIPIENTS[opts.recipient] || opts.recipient;
  logActivity(`إصدار تقرير أدلة ${opts.ref} للقضية ${c.code} إلى ${label}`, 'doc');
  caseLog(c, `إصدار تقرير أدلة ${opts.ref} إلى ${label}`);
  save();
  closeModal();
  printHTML(evidencePacketHTML(c, opts), 'اختر «حفظ كـ PDF» من نافذة الطباعة');
});

/* ============================================================
   GLOBAL SEARCH
   ============================================================ */
function openSearch() {
  openModal({
    title: 'البحث الشامل في الأرشيف', icon: 'fa-magnifying-glass', size: 'narrow',
    body: `<div class="search-box"><i class="fa-solid fa-magnifying-glass"></i>
        <input class="inp" id="gsInput" placeholder="اسم، لقب، رقم قضية، موضوع برقية..." autocomplete="off"></div>
      <div class="gs-results" id="gsResults"><p class="tiny muted">اكتب حرفين على الأقل للبحث في كل الأرشيف.</p></div>`,
    footer: `<span class="tiny muted" style="align-self:center">Ctrl + K لفتح البحث في أي وقت</span><button class="btn btn-ghost" data-act="modal:close">إغلاق</button>`
  });
  const input = $('#gsInput');
  input.addEventListener('input', () => renderSearch(input.value));
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') { const first = $('#gsResults .gs-item'); if (first) first.click(); }
  });
  setTimeout(() => input.focus(), 80);
}

function renderSearch(raw) {
  const box = $('#gsResults');
  const term = String(raw || '').trim().toLowerCase();
  if (term.length < 2) { box.innerHTML = '<p class="tiny muted">اكتب حرفين على الأقل للبحث في كل الأرشيف.</p>'; return; }
  const hit = v => String(v || '').toLowerCase().includes(term);
  const groups = [];

  const persons = DB.persons.filter(p => hit(p.name) || hit(p.alias) || hit(p.charges) || hit(p.phone) || hit(p.address)).slice(0, 5);
  if (persons.length) groups.push(['الأشخاص', persons.map(p => ({
    cls: 'fa-user-secret', title: p.name + (p.alias ? ' — ' + p.alias : ''), sub: netName(p.networkId) + ' · ' + p.status,
    act: 'per:view', id: p.id
  }))]);

  const nets = DB.networks.filter(n => hit(n.name) || hit(n.territory) || hit(n.type)).slice(0, 4);
  if (nets.length) groups.push(['الشبكات', nets.map(n => ({ cls: 'fa-sitemap', title: n.name, sub: n.type + ' · ' + (n.territory || '—'), act: 'net:view', id: n.id }))]);

  const cases = DB.cases.filter(c => hit(c.title) || hit(c.code) || hit(c.summary) || hit(c.type)).slice(0, 4);
  if (cases.length) groups.push(['القضايا', cases.map(c => ({ cls: 'fa-folder-open', title: c.title, sub: c.code + ' · ' + c.status, act: 'case:view', id: c.id }))]);

  const docs = DB.docs.filter(d => hit(d.ref) || hit(d.target) || hit(d.location) || hit(d.caseNo)).slice(0, 4);
  if (docs.length) groups.push(['المذكرات', docs.map(d => ({ cls: 'fa-file-signature', title: (DOC_TYPES[d.type]?.label || d.type) + ' — ' + d.target, sub: d.ref + ' · ' + d.status, act: 'doc:view', id: d.id }))]);

  const brqs = DB.bulletins.filter(b => hit(b.subject) || hit(b.body) || hit(b.serial)).slice(0, 4);
  if (brqs.length) groups.push(['البرقيات', brqs.map(b => ({ cls: 'fa-tower-broadcast', title: b.subject, sub: b.serial + ' · ' + fmtDate(b.createdAt), act: 'brq:view', id: b.id }))]);

  if (!groups.length) { box.innerHTML = '<div class="empty" style="padding:20px"><i class="fa-solid fa-magnifying-glass"></i><p>لا نتائج مطابقة.</p></div>'; return; }

  box.innerHTML = groups.map(([label, items]) =>
    `<div class="gs-group">${esc(label)}</div>` +
    items.map(it => `<div class="gs-item" data-act="${it.act}" data-id="${esc(it.id)}">
      <span class="gs-ico"><i class="fa-solid ${it.cls}"></i></span>
      <div style="min-width:0"><div class="gs-title">${esc(it.title)}</div><div class="gs-sub">${esc(it.sub)}</div></div>
    </div>`).join('')
  ).join('');
}

action('search:open', () => openSearch());

/* ============================================================
   EVIDENCE REPORTS REGISTRY
   ============================================================ */
const REPORT_STATUS = ['مُرسل', 'مُستلم', 'معتمد'];

function reportStatus(r) { return r.status || 'مُرسل'; }

function reportChip(s) {
  const cls = s === 'معتمد' ? 'rep-appr' : s === 'مُستلم' ? 'rep-recv' : 'rep-sent';
  const ico = s === 'معتمد' ? 'fa-circle-check' : s === 'مُستلم' ? 'fa-inbox' : 'fa-paper-plane';
  return `<span class="rep-status ${cls}"><i class="fa-solid ${ico}"></i>${esc(s)}</span>`;
}

function pageReports() {
  const list = DB.reports || [];
  const counts = REPORT_STATUS.map(s => [s, list.filter(r => reportStatus(r) === s).length]);
  return `
  <div class="page-head">
    <div><h2><i class="fa-solid fa-file-pdf"></i> سجل تقارير الأدلة</h2>
      <p>كل تقرير أدلة صدر من هذا الجهاز: مرجعه، القضية المرتبطة، الجهة المرسل إليها، وحالة التسلّم والاعتماد. يمكن إعادة طباعة أي تقرير بنفس مرجعه وباركوده.</p></div>
    <div class="head-actions"><button class="btn btn-primary" data-act="case:evidence-pdf"><i class="fa-solid fa-plus"></i> تقرير جديد</button></div>
  </div>
  <div class="chips" style="margin-bottom:12px">
    <span class="chip">الإجمالي: ${list.length}</span>
    ${counts.map(([s, n]) => `<span class="chip">${esc(s)}: ${n}</span>`).join('')}
  </div>
  ${list.length ? `<div class="card" style="padding:0;overflow-x:auto">
    <table class="tbl"><thead><tr><th>المرجع</th><th>القضية</th><th>الجهة المرسل إليها</th><th>التاريخ</th><th>الحالة</th><th></th></tr></thead><tbody>
    ${list.map(r => {
      const c = caseById(r.caseId);
      const st = reportStatus(r);
      return `<tr>
        <td class="mono" style="font-size:.66rem;white-space:nowrap">${esc(r.ref)}</td>
        <td>${c ? `<b>${esc(c.code)}</b><div class="tiny muted">${esc(c.title)}</div>` : `<span class="tiny muted">${esc(r.caseCode || 'قضية محذوفة')}</span>`}</td>
        <td style="font-size:.74rem">${esc(EVIDENCE_RECIPIENTS[r.recipient] || r.recipient || '—')}</td>
        <td class="tiny" style="white-space:nowrap">${fmtDateTime(r.createdAt)}</td>
        <td>${reportChip(st)}</td>
        <td class="actions" style="white-space:nowrap">
          ${c ? `<button class="btn btn-ghost btn-sm" data-act="case:view" data-id="${c.id}" title="فتح القضية"><i class="fa-solid fa-folder-open"></i></button>` : ''}
          <button class="btn btn-ghost btn-sm" data-act="report:reprint" data-id="${r.id}" title="إعادة طباعة"><i class="fa-solid fa-print"></i></button>
          ${st !== 'معتمد' ? `<button class="btn btn-ghost btn-sm" data-act="report:status" data-id="${r.id}" title="تقديم الحالة"><i class="fa-solid fa-arrow-up-right-dots"></i></button>` : ''}
        </td></tr>`;
    }).join('')}
    </tbody></table>
  </div>` : `<div class="card empty"><i class="fa-solid fa-file-pdf"></i><p>لم يُصدر أي تقرير أدلة بعد. افتح قضية واختر «تقرير الأدلة PDF».</p></div>`}`;
}

action('report:status', (id) => {
  const r = (DB.reports || []).find(x => x.id === id); if (!r) return;
  const cur = REPORT_STATUS.indexOf(reportStatus(r));
  r.status = REPORT_STATUS[Math.min(REPORT_STATUS.length - 1, cur + 1)];
  logActivity(`تقرير الأدلة ${r.ref}: الحالة «${r.status}»`, 'doc');
  save(); render(); toast('تم تحديث حالة التقرير إلى «' + r.status + '»');
});

action('report:reprint', (id) => {
  const r = (DB.reports || []).find(x => x.id === id); if (!r) return;
  const c = caseById(r.caseId);
  if (!c) return toast('القضية المرتبطة غير موجودة في الأرشيف', 'err');
  logActivity(`إعادة طباعة تقرير الأدلة ${r.ref}`, 'doc');
  save();
  printHTML(evidencePacketHTML(c, { recipient: r.recipient, note: r.note || '', includePhotos: true, includeThumbs: true, ref: r.ref }), `إعادة طباعة ${r.ref} — اختر «حفظ كـ PDF»`);
});

/* ============================================================
   AUDIT TRAIL
   ============================================================ */
const AUDIT_KINDS = { all: 'الكل', auth: 'دخول', person: 'أشخاص', net: 'شبكات', case: 'قضايا', doc: 'مذكرات', brq: 'برقيات', map: 'خريطة', system: 'نظام', info: 'عام' };
let auditKind = 'all';

function auditRows() {
  return DB.activity.filter(a => auditKind === 'all' || a.kind === auditKind);
}

function pageAudit() {
  const rows = auditRows();
  return `
  <div class="page-head">
    <div><h2><i class="fa-solid fa-clipboard-list"></i> سجل التدقيق والعمليات</h2>
      <p>سجل زمني لكل حركة في النظام: دخول العميل، تعديل السجلات، رفع المذكرات، الاعتماد القضائي، وتغيير مراحل القضايا. يُستخدم للمراجعة والمساءلة.</p></div>
    <div class="head-actions">
      <button class="btn btn-ghost" data-act="audit:export"><i class="fa-solid fa-file-csv"></i> تصدير CSV</button>
    </div>
  </div>
  <div class="chips" style="margin-bottom:12px">
    ${Object.entries(AUDIT_KINDS).map(([k, l]) => `<button class="chip ${auditKind === k ? 'chip-cyan' : ''}" data-act="audit:kind" data-id="${k}">${l}</button>`).join('')}
  </div>
  <div class="card" style="padding:14px">
    <div style="display:flex;gap:10px;align-items:center;margin-bottom:12px;flex-wrap:wrap">
      <input class="inp" id="auditSearch" placeholder="بحث في السجل..." style="max-width:320px">
      <span class="tiny muted">النتائج: <b id="auditCount" style="color:var(--cyan)">${rows.length}</b></span>
      <span class="tiny muted" style="margin-right:auto">يُحفظ آخر 500 حدث</span>
    </div>
    <table class="tbl"><thead><tr><th>الوقت</th><th>العميل</th><th>النوع</th><th>الحدث</th></tr></thead>
      <tbody id="auditBody">
      ${rows.length ? rows.slice(0, 300).map(a => `<tr class="audit-row" data-kind="${esc(a.kind || 'info')}" data-text="${esc((a.text + ' ' + (a.by || '')).toLowerCase())}">
        <td class="mono" style="font-size:.62rem;color:#8fa2b4;white-space:nowrap">${fmtDateTime(a.at)}</td>
        <td class="mono" style="font-size:.66rem">${esc(a.by || '—')}</td>
        <td><span class="chip">${esc(AUDIT_KINDS[a.kind] || 'عام')}</span></td>
        <td>${esc(a.text)}</td></tr>`).join('') : `<tr><td colspan="4" class="muted center tiny" style="padding:20px">لا أحداث في هذا التصنيف.</td></tr>`}
      </tbody></table>
  </div>`;
}

function mountAudit() {
  const input = $('#auditSearch');
  if (!input) return;
  const apply = () => {
    const q = input.value.trim().toLowerCase();
    let shown = 0;
    $$('#auditBody .audit-row').forEach(r => {
      const ok = !q || r.dataset.text.includes(q);
      r.style.display = ok ? '' : 'none';
      if (ok) shown++;
    });
    const c = $('#auditCount'); if (c) c.textContent = shown;
  };
  input.addEventListener('input', apply);
}

action('audit:kind', (k) => { auditKind = k || 'all'; render(); });
action('audit:export', () => {
  const rows = [['التاريخ', 'الوقت', 'العميل', 'النوع', 'الحدث']];
  auditRows().forEach(a => {
    const d = new Date(a.at);
    rows.push([d.toLocaleDateString('en-GB'), d.toLocaleTimeString('en-GB'), a.by || '', AUDIT_KINDS[a.kind] || 'عام', a.text]);
  });
  const csv = '\uFEFF' + rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\r\n');
  downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `A140-audit-${new Date().toISOString().slice(0, 10)}.csv`);
  toast('تم تصدير سجل التدقيق');
});

/* ============================================================
   SECURITY ACTIONS
   ============================================================ */
action('pin:change', async () => {
  const res = await Auth.changePass(val('#se_cur'), val('#se_new'));
  if (res !== 'ok') return toast(res, 'err');
  logActivity('تغيير كلمة مرور الحساب', 'auth');
  save(); render(); toast('تم تحديث كلمة المرور');
});
action('lock:now', () => Auth.lockNow());

action('acct:profile', () => {
  const res = Auth.updateProfile({ name: val('#pr_name'), rank: val('#pr_rank'), division: val('#pr_div') });
  if (res !== 'ok') return toast(res, 'err');
  DB.settings.photo = val('#stPhoto_id');
  logActivity('تحديث الملف الشخصي والرتبة', 'auth');
  save(); render(); toast('تم حفظ ملفك الشخصي');
});

action('user:edit', (user) => {
  const u = Auth.list().find(x => x.user === user);
  if (!u) return;
  openModal({
    title: 'تعديل الحساب — ' + u.user, icon: 'fa-user-pen', size: 'narrow',
    body: `<div class="field"><label>الاسم المعروض</label><input class="inp" id="ue_name" value="${esc(u.name)}"></div>
      <div class="field" style="margin-top:10px"><label>الرتبة / الموقع</label><select class="inp" id="ue_rank">${rankOpts(u.rank)}</select></div>
      <div class="field" style="margin-top:10px"><label>درجة التصريح</label><input class="inp mono" id="ue_clear" value="${esc(u.clearance || '')}" dir="ltr"></div>
      <div class="field" style="margin-top:10px"><label>الصلاحية</label><select class="inp" id="ue_full">
        <option value="0"${u.full ? '' : ' selected'}>مستخدم مخوّل</option>
        <option value="1"${u.full ? ' selected' : ''}>كامل الصلاحيات</option></select></div>`,
    footer: `<button class="btn btn-primary" id="ue_go"><i class="fa-solid fa-floppy-disk"></i> حفظ</button>
             <button class="btn btn-ghost" data-act="modal:close">إلغاء</button>`
  });
  $('#ue_go').addEventListener('click', () => {
    const res = Auth.updateUser(u.user, {
      name: val('#ue_name'), rank: val('#ue_rank'), clearance: val('#ue_clear'),
      full: val('#ue_full') === '1'
    });
    if (res !== 'ok') return toast(res, 'err');
    logActivity(`تعديل حساب: ${u.user}`, 'auth');
    save(); closeModal(); render(); toast('تم تحديث الحساب');
  });
});

action('acct:media', () => {
  const res = Auth.setMedia({ signature: val('#acSig_id'), seal: val('#acSeal_id') });
  if (res !== 'ok') return toast(res, 'err');
  logActivity('تحديث التوقيع والختم الشخصي', 'auth');
  save(); render(); toast('تم حفظ توقيعك وختمك');
});

action('user:add', async () => {
  const res = await Auth.addUser({
    user: val('#nu_user'), pass: val('#nu_pass'), name: val('#nu_name'), rank: val('#nu_rank'),
    role: val('#nu_role') === 'doj' ? 'doj' : 'fib',
    full: val('#nu_full') === '1'
  });
  if (res !== 'ok') return toast(res, 'err');
  logActivity(`إضافة حساب مخوّل: ${val('#nu_user')}`, 'auth');
  save(); render(); toast('تم إضافة الحساب المخوّل');
});

action('doj:add', async () => {
  const res = await Auth.addUser({
    user: val('#du_user'), pass: val('#du_pass'), name: val('#du_name'), role: 'doj'
  });
  if (res !== 'ok') return toast(res, 'err');
  logActivity(`إضافة حساب وزارة العدل: ${val('#du_user')}`, 'auth');
  save(); render(); toast('تم إضافة حساب وزارة العدل');
});

action('user:reset', async (user) => {
  openModal({
    title: 'إعادة تعيين كلمة المرور — ' + (user || ''), icon: 'fa-key', size: 'narrow',
    body: `<div class="field"><label>كلمة المرور الجديدة</label>
        <input class="inp" id="rp_new" type="password" autocomplete="new-password" placeholder="••••••••"></div>
      <div class="tiny muted" style="margin-top:10px">تُحفظ مشفّرة ولا يمكن قراءتها لاحقاً.</div>`,
    footer: `<button class="btn btn-primary" id="rp_go"><i class="fa-solid fa-floppy-disk"></i> حفظ</button>
             <button class="btn btn-ghost" data-act="modal:close">إلغاء</button>`
  });
  $('#rp_go').addEventListener('click', async () => {
    const res = await Auth.resetPass(user, val('#rp_new'));
    if (res !== 'ok') return toast(res, 'err');
    logActivity(`إعادة تعيين كلمة مرور الحساب: ${user}`, 'auth');
    save(); closeModal(); render(); toast('تم إعادة تعيين كلمة المرور');
  });
  setTimeout(() => $('#rp_new')?.focus(), 100);
});

action('user:del', (user) => {
  const target = Auth.list().find(u => u.user === user);
  if (!target) return;
  confirmDialog({
    title: 'حذف حساب مخوّل', danger: true, confirmText: 'حذف الحساب',
    text: `سيتم سحب صلاحية الدخول من الحساب «${target.user}» نهائياً. لن تتأثر السجلات.`,
    onConfirm: () => {
      const res = Auth.removeUser(target.user);
      if (res !== 'ok') { toast(res, 'err'); return; }
      logActivity(`حذف حساب مخوّل: ${target.user}`, 'auth');
      save(); closeModal(); render(); toast('تم حذف الحساب');
    }
  });
});

/* ============================================================
   FORENSIC EVIDENCE — registry, detail, chain of custody, labels
   ============================================================ */
function evidenceNo() {
  const y = new Date().getFullYear();
  const total = DB.cases.reduce((s, c) => s + (c.evidence || []).length, 0);
  return `EV-${y}-${String(total + 1).padStart(4, '0')}`;
}

const EV_STATUS_COLORS = {
  'مُجمّع': '#9fc7e8', 'محوّل للمختبر': '#e6c877', 'قيد التحليل': '#f59e0b',
  'نتيجة واردة': '#c4b5fd', 'مُحلّل': '#7ee0a1', 'مُفرج عنه': '#8fa2b4'
};

function evStatusChip(s) {
  const st = s || 'مُجمّع';
  const col = EV_STATUS_COLORS[st] || '#9fc7e8';
  return `<span class="ev-status" style="color:${col};border-color:${col}55;background:${col}16">${esc(st)}</span>`;
}

function parseEvId(id) {
  const parts = String(id || '').split('|');
  return { caseId: parts[0], evId: parts[1] };
}

function evidenceDetail(caseId, evId) {
  const c = caseById(caseId);
  const ev = c && (c.evidence || []).find(e => e.id === evId);
  if (!ev) return toast('الدليل غير موجود', 'err');
  const t = evType(ev.type);
  const specs = [
    ['نوع السلاح', ev.weaponType], ['العيار', ev.caliber], ['الرقم التسلسلي', ev.serial],
    ['نتيجة المطابقة', ev.matchStatus], ['مرجع NIBIN', ev.nibin], ['الوزن/الكمية', ev.weight], ['المبلغ', ev.amount]
  ].filter(([, v]) => v);
  openModal({
    title: `${ev.no || 'دليل'} — ${ev.title}`, icon: t.icon, size: 'wide',
    body: `
      <div class="chips" style="margin-bottom:10px">
        <span class="chip mono" style="font-size:.64rem">${esc(ev.no || '—')}</span>
        <span class="chip chip-cyan"><i class="fa-solid ${t.icon}"></i>${esc(t.label)}</span>
        ${evStatusChip(ev.status)}
        <span class="chip">${esc(c.code)}</span>
        ${ev.collectedAt ? `<span class="chip">${fmtDateTime(ev.collectedAt)}</span>` : ''}
      </div>
      <dl class="kv">
        <dt>المكان</dt><dd>${esc(ev.location || '—')}</dd>
        <dt>جامع الدليل</dt><dd>${esc(ev.collectedBy || '—')}</dd>
        <dt>المختبر</dt><dd>${esc(ev.lab || '—')}</dd>
        <dt>الخبير</dt><dd>${esc(ev.examiner || '—')}</dd>
        <dt>النتيجة</dt><dd>${esc(ev.result || '—')}</dd>
        ${specs.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}
        <dt>الوصف</dt><dd>${esc(ev.desc || '—')}</dd>
      </dl>
      ${ev.fileId ? `<div class="chips" style="margin-top:10px"><button class="btn btn-ghost btn-sm" data-act="file:open" data-id="${ev.fileId}">فتح المرفق</button>
        <button class="btn btn-ghost btn-sm" data-act="file:download" data-id="${ev.fileId}">تنزيل</button></div>` : ''}
      <div class="section-title">سلسلة الحفظ (${(ev.custody || []).length})</div>
      ${(ev.custody || []).length ? `<div class="timeline case-tl">${ev.custody.slice().reverse().map(x => `<div class="tl">${esc(x.action)}${x.note ? ' — ' + esc(x.note) : ''}<small>${fmtDateTime(x.at)} · ${esc(x.by || '')}</small></div>`).join('')}</div>` : '<p class="tiny muted">لا إجراءات حفظ مسجلة.</p>'}
      <div class="section-title">تسجيل إجراء / نقل حيازة</div>
      <div class="form-grid">
        <div class="field"><label>الإجراء</label><input class="inp" id="cu_action" placeholder="نقل للمختبر / تسليم للنيابة / فحص"></div>
        <div class="field"><label>بواسطة</label><input class="inp" id="cu_by" value="${esc(accountInfo().name)}"></div>
        <div class="field span-2"><label>ملاحظة</label><input class="inp" id="cu_note"></div>
        <div class="field"><label>تحديث النتيجة المخبرية</label><input class="inp" id="ev_result_edit" value="${esc(ev.result || '')}"></div>
        <div class="field"><label>الحالة</label><select class="inp" id="ev_status_edit">${EVIDENCE_STATUS.map(s => `<option ${s === (ev.status || 'مُجمّع') ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
      </div>`,
    footer: `<button class="btn btn-primary" data-act="ev:update" data-id="${c.id}|${ev.id}"><i class="fa-solid fa-floppy-disk"></i> حفظ الحالة والنتيجة</button>
      <button class="btn btn-ghost" data-act="ev:custody" data-id="${c.id}|${ev.id}"><i class="fa-solid fa-arrows-rotate"></i> إضافة إجراء</button>
      <button class="btn btn-ghost" data-act="ev:label" data-id="${c.id}|${ev.id}"><i class="fa-solid fa-print"></i> ملصق الدليل</button>
      <button class="btn btn-ghost" data-act="modal:close">إغلاق</button>`
  });
}

action('ev:view', (id) => { const p = parseEvId(id); evidenceDetail(p.caseId, p.evId); });

action('ev:update', (id) => {
  const p = parseEvId(id); const c = caseById(p.caseId); if (!c) return;
  const ev = (c.evidence || []).find(e => e.id === p.evId); if (!ev) return;
  const newStatus = val('#ev_status_edit') || ev.status;
  const newResult = val('#ev_result_edit');
  const changed = newStatus !== ev.status || newResult !== (ev.result || '');
  ev.status = newStatus; ev.result = newResult;
  if (changed) {
    ev.custody = ev.custody || [];
    ev.custody.push({ at: Date.now(), action: 'تحديث الحالة/النتيجة', by: accountInfo().name, note: `الحالة: ${newStatus}${newResult ? ' · النتيجة: ' + newResult : ''}` });
    logActivity(`تحديث دليل ${ev.no || ev.title} — ${newStatus}`, 'case');
    caseLog(c, `تحديث دليل ${ev.no || ev.title}: ${newStatus}`);
  }
  save();
  toast('تم حفظ تحديث الدليل');
  evidenceDetail(p.caseId, p.evId);
});

action('ev:custody', (id) => {
  const p = parseEvId(id); const c = caseById(p.caseId); if (!c) return;
  const ev = (c.evidence || []).find(e => e.id === p.evId); if (!ev) return;
  const actionText = val('#cu_action');
  if (!actionText) return toast('اكتب الإجراء أولاً', 'err');
  ev.custody = ev.custody || [];
  ev.custody.push({ at: Date.now(), action: actionText, by: val('#cu_by') || '—', note: val('#cu_note') });
  logActivity(`سلسلة حفظ دليل ${ev.no || ev.title}: ${actionText}`, 'case');
  caseLog(c, `إجراء على الدليل ${ev.no || ev.title}: ${actionText}`);
  save();
  toast('تم تسجيل الإجراء في سلسلة الحفظ');
  evidenceDetail(p.caseId, p.evId);
});

function evidenceLabelSheet(c, ev) {
  const t = evType(ev.type);
  return `<div class="sheet label-sheet">
    <div class="sheet-frame"></div>
    <div class="sheet-inner">
      ${sheetHead()}
      <div class="sheet-title"><h1>ملصق دليل جنائي</h1><div class="en">FORENSIC EVIDENCE LABEL</div></div>
      <div class="label-no">${esc(ev.no || '—')}</div>
      <div class="label-barcode">${barcodeHTML(ev.no || ev.title)}</div>
      <table class="sheet-table">
        <tr><th>القضية</th><td>${esc(c.code)} — ${esc(c.title)}</td></tr>
        <tr><th>نوع الدليل</th><td>${esc(t.label)}</td></tr>
        <tr><th>العنوان</th><td>${esc(ev.title)}</td></tr>
        <tr><th>المكان</th><td>${esc(ev.location || '—')}</td></tr>
        <tr><th>تاريخ الجمع</th><td>${esc(ev.collectedAt ? fmtDateTime(ev.collectedAt) : '—')}</td></tr>
        <tr><th>جامع الدليل</th><td>${esc(ev.collectedBy || '—')}</td></tr>
        <tr><th>المختبر / الخبير</th><td>${esc(ev.lab || '—')} · ${esc(ev.examiner || '—')}</td></tr>
        <tr><th>المواصفات</th><td>${esc([ev.weaponType, ev.caliber, ev.serial, ev.weight, ev.amount].filter(Boolean).join(' · ') || '—')}</td></tr>
        <tr><th>الحالة</th><td>${esc(ev.status || '—')}</td></tr>
      </table>
      <div class="label-sign"><div><div class="sig-line"></div><span>توقيع جامع الدليل</span></div>
        <div><div class="sig-line"></div><span>توقيع المستلم</span></div></div>
      <div class="sheet-foot"><span>سري — سلسلة حفظ</span><span>${esc(c.code)}</span></div>
    </div>
  </div>`;
}

action('ev:label', (id) => {
  const p = parseEvId(id); const c = caseById(p.caseId); if (!c) return;
  const ev = (c.evidence || []).find(e => e.id === p.evId); if (!ev) return;
  printHTML(evidenceLabelSheet(c, ev), 'اختر «حفظ كـ PDF» أو اطبع الملصق على ورق لاصق');
});

let evFilters = { q: '', type: '', status: '' };

function allEvidence() {
  const out = [];
  DB.cases.forEach(c => (c.evidence || []).forEach(e => out.push(Object.assign({}, e, { caseId: c.id, caseCode: c.code, caseTitle: c.title }))));
  return out;
}

function pageEvidence() {
  const list = allEvidence();
  const byStatus = EVIDENCE_STATUS.map(s => [s, list.filter(e => (e.status || 'مُجمّع') === s).length]);
  return `
  <div class="page-head">
    <div><h2><i class="fa-solid fa-box-archive"></i> سجل الأدلة الجنائية</h2>
      <p>كل دليل في النظام: الأسلحة والمقذوفات والبصمات والحمض النووي والمخدرات والمستندات — برقم دليل ومختبر وخبير وحالة تحليل وسلسلة حفظ.</p></div>
    <div class="head-actions"><button class="btn btn-ghost" data-act="go" data-id="cases"><i class="fa-solid fa-folder-open"></i> ملفات القضايا</button></div>
  </div>
  <div class="chips" style="margin-bottom:12px">
    <span class="chip chip-cyan">الإجمالي: ${list.length}</span>
    ${byStatus.map(([s, n]) => `<span class="chip">${esc(s)}: ${n}</span>`).join('')}
  </div>
  <div class="card" style="padding:14px;margin-bottom:14px">
    <div class="filter-row" style="display:grid;grid-template-columns:2fr 1fr 1fr;gap:10px">
      <input class="inp" id="evSearch" placeholder="بحث برقم الدليل أو العنوان أو المختبر..." value="${esc(evFilters.q)}">
      <select class="inp" id="evTypeFilter"><option value="">كل الأنواع</option>${Object.entries(EVIDENCE_TYPES).map(([k, t]) => `<option value="${k}" ${evFilters.type === k ? 'selected' : ''}>${t.label}</option>`).join('')}</select>
      <select class="inp" id="evStatusFilter"><option value="">كل الحالات</option>${EVIDENCE_STATUS.map(s => `<option ${evFilters.status === s ? 'selected' : ''}>${s}</option>`).join('')}</select>
    </div>
    <div class="tiny muted" style="margin-top:9px">النتائج: <b id="evCount" style="color:var(--cyan)">${list.length}</b></div>
  </div>
  <div class="card" style="padding:0;overflow-x:auto">
    ${list.length ? `<table class="tbl"><thead><tr><th>رقم الدليل</th><th>النوع</th><th>العنوان</th><th>القضية</th><th>الحالة</th><th>المختبر</th><th></th></tr></thead><tbody id="evRows">
    ${list.map(e => `<tr class="ev-row" data-type="${esc(e.type)}" data-status="${esc(e.status || 'مُجمّع')}" data-text="${esc(((e.no || '') + ' ' + e.title + ' ' + (e.lab || '') + ' ' + (e.result || '')).toLowerCase())}">
      <td class="mono" style="font-size:.66rem;white-space:nowrap">${esc(e.no || '—')}</td>
      <td style="font-size:.72rem"><i class="fa-solid ${evType(e.type).icon}" style="color:#67e8f9;margin-left:5px"></i>${esc(evType(e.type).label)}</td>
      <td><b>${esc(e.title)}</b><div class="tiny muted">${esc((e.desc || '').slice(0, 60))}</div></td>
      <td class="mono tiny">${esc(e.caseCode)}</td>
      <td>${evStatusChip(e.status)}</td>
      <td class="tiny">${esc(e.lab || '—')}</td>
      <td class="actions" style="white-space:nowrap">
        <button class="btn btn-ghost btn-sm" data-act="ev:view" data-id="${e.caseId}|${e.id}" title="تفاصيل"><i class="fa-solid fa-magnifying-glass"></i></button>
        <button class="btn btn-ghost btn-sm" data-act="ev:label" data-id="${e.caseId}|${e.id}" title="ملصق الدليل"><i class="fa-solid fa-print"></i></button>
      </td></tr>`).join('')}</tbody></table>`
      : `<div class="empty" style="padding:26px"><i class="fa-solid fa-box-archive"></i><p>لا أدلة مسجلة بعد. افتح قضية وأضف أول دليل جنائي.</p><button class="btn btn-ghost btn-sm" data-act="go" data-id="cases">فتح القضايا</button></div>`}
  </div>`;
}

function mountEvidence() {
  const apply = () => {
    const q = ($('#evSearch')?.value || '').trim().toLowerCase();
    const type = $('#evTypeFilter')?.value || '';
    const status = $('#evStatusFilter')?.value || '';
    let n = 0;
    $$('#evRows .ev-row').forEach(r => {
      const ok = (!q || r.dataset.text.includes(q)) && (!type || r.dataset.type === type) && (!status || r.dataset.status === status);
      r.style.display = ok ? '' : 'none';
      if (ok) n++;
    });
    const c = $('#evCount'); if (c) c.textContent = n;
  };
  ['#evSearch', '#evTypeFilter', '#evStatusFilter'].forEach(sel => {
    const el = $(sel);
    if (el) { el.addEventListener('input', apply); el.addEventListener('change', apply); }
  });
}

/* ============================================================
   MEDIA / ASSETS LIBRARY
   ============================================================ */
function mediaTile(src, title, sub, actions = '') {
  return `<article class="media-card">
    <div class="media-thumb"><img src="${src}" alt="${esc(title)}"></div>
    <div class="media-body">
      <div class="media-title">${esc(title)}</div>
      <div class="media-sub">${esc(sub)}</div>
      <div class="media-actions">${actions}</div>
    </div>
  </article>`;
}

function pageMedia() {
  const fileTile = (fileId, title, sub) => mediaTile(
    FileStore.url(fileId) || avatar(title, '#3d7fb8'), title, sub,
    `<button class="btn btn-ghost btn-sm" data-act="file:open" data-id="${fileId}" title="فتح"><i class="fa-solid fa-up-right-from-square"></i></button>
     <button class="btn btn-ghost btn-sm" data-act="file:download" data-id="${fileId}" title="تنزيل"><i class="fa-solid fa-download"></i></button>`
  );

  const sigs = [];
  Auth.list().forEach(u => {
    if (u.signature && FileStore.get(u.signature)) {
      sigs.push({ fileId: u.signature, title: 'توقيع ' + u.user, sub: (u.rank || 'محقق') + ' · توقيع الحساب' });
    }
  });
  if (DB.settings.signature && FileStore.get(DB.settings.signature)) {
    sigs.push({ fileId: DB.settings.signature, title: DB.settings.agentName || 'توقيع العميل', sub: 'التوقيع المعتمد · ' + (DB.settings.rank || 'محقق') });
  }
  DB.docs.forEach(d => {
    const f = d.signature && d.signature.fileId;
    if (f && FileStore.get(f) && f !== DB.settings.signature) {
      sigs.push({ fileId: f, title: (d.signature && d.signature.name) || 'توقيع مذكرة', sub: 'مذكرة · ' + (d.ref || '') });
    }
  });
  const logos = DB.networks.filter(n => n.logo && FileStore.get(n.logo));
  const bytes = FileStore.usage();

  return `
  <div class="page-head">
    <div><h2><i class="fa-solid fa-photo-film"></i> ملف الصور والشعارات</h2>
      <p>مكتبة مرئية لكل الأصول الرسمية: ختم FBI، خرائط النظام، تواقيع المحققين والمذكرات، وشعارات الشبكات — معاينة وتنزيل مباشر.</p></div>
    <div class="head-actions">
      <span class="chip"><i class="fa-solid fa-database"></i><span dir="ltr">${bytes > 1048576 ? (bytes / 1048576).toFixed(1) + ' MB' : Math.max(0, Math.round(bytes / 1024)) + ' KB'}</span></span>
      <button class="btn btn-ghost" data-act="go" data-id="settings"><i class="fa-solid fa-signature"></i> تحديث التوقيع</button>
    </div>
  </div>

  <div class="chips" style="margin-bottom:14px">
    <span class="chip chip-cyan">الختم والأصول: 3</span>
    <span class="chip">التواقيع: ${sigs.length}</span>
    <span class="chip">شعارات الشبكات: ${logos.length}</span>
    <span class="chip">ملفات الأرشيف: ${FileStore.cache.size}</span>
  </div>

  <div class="card">
    <div class="card-head"><div class="card-title"><i class="fa-solid fa-stamp"></i> الختم وأصول النظام</div></div>
    <div class="media-grid">
      ${mediaTile('assets/fbi-seal.svg', 'ختم FBI الرسمي', 'SVG متجهي · 699×720',
        `<a class="btn btn-ghost btn-sm" href="assets/fbi-seal.svg" download="fbi-seal.svg"><i class="fa-solid fa-download"></i> تنزيل</a>`)}
      ${mediaTile('assets/los-santos-map.jpg', 'خريطة لوس سانتوس', 'JPG · 1800×1800 · 519KB',
        `<a class="btn btn-ghost btn-sm" href="assets/los-santos-map.jpg" download="los-santos-map.jpg"><i class="fa-solid fa-download"></i> تنزيل</a>`)}
      ${mediaTile('assets/san-andreas-map.jpg', 'خريطة سان أندرياس', 'JPG · 1600×1600 · 266KB',
        `<a class="btn btn-ghost btn-sm" href="assets/san-andreas-map.jpg" download="san-andreas-map.jpg"><i class="fa-solid fa-download"></i> تنزيل</a>`)}
    </div>
  </div>

  <div class="card mt">
    <div class="card-head"><div class="card-title"><i class="fa-solid fa-signature"></i> التواقيع (${sigs.length})</div>
      <button class="btn btn-ghost btn-sm" data-act="go" data-id="settings"><i class="fa-solid fa-pen"></i> تغيير توقيع العميل</button></div>
    ${sigs.length ? `<div class="media-grid">${sigs.map(s => fileTile(s.fileId, s.title, s.sub)).join('')}</div>`
      : `<div class="empty" style="padding:22px"><i class="fa-solid fa-signature"></i><p>لا توجد تواقيع محفوظة بعد.</p>
        <button class="btn btn-ghost btn-sm" data-act="go" data-id="settings">رفع التوقيع من الإعدادات</button></div>`}
  </div>

  <div class="card mt">
    <div class="card-head"><div class="card-title"><i class="fa-solid fa-sitemap"></i> شعارات الشبكات (${logos.length})</div>
      <button class="btn btn-ghost btn-sm" data-act="go" data-id="networks"><i class="fa-solid fa-plus"></i> إدارة الشبكات</button></div>
    ${logos.length ? `<div class="media-grid">${logos.map(n => fileTile(n.logo, n.name, 'شعار الشبكة · ' + (n.type || ''))).join('')}</div>`
      : `<div class="empty" style="padding:22px"><i class="fa-solid fa-image"></i><p>لا شعارات شبكات مرفوعة بعد. يُرفع الشعار من نموذج الشبكة.</p>
        <button class="btn btn-ghost btn-sm" data-act="net:new">إنشاء شبكة</button></div>`}
  </div>`;
}

/* ============================================================
   REGISTRATION
   ============================================================ */
registerPage('map', pageMap);
registerMount('map', mountMap);
registerPage('documents', pageDocuments);
registerPage('bulletins', pageBulletins);
registerPage('cases', pageCases);
registerPage('settings', pageSettings);
registerMount('settings', mountSettings);
registerPage('reports', pageReports);
registerPage('evidence', pageEvidence);
registerMount('evidence', mountEvidence);
registerPage('media', pageMedia);
registerPage('audit', pageAudit);
registerMount('audit', mountAudit);
