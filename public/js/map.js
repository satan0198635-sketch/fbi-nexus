/* ============================================================
   TacticalMap — interactive stylized San Andreas (Los Santos /
   Blaine County) map. Pan, wheel-zoom, pick coordinates, pins.
   Coordinate space: 1000 x 1000 (stored with every record).
   ============================================================ */
const MAP_IMAGE_SRC = 'assets/san-andreas-map.jpg';
const MAP_CITY_SRC = 'assets/los-santos-map.jpg';
const MAP_SVG_SOURCE = `
<svg class="map-svg" viewBox="0 0 1000 1000" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <defs>
    <linearGradient id="m-water" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#071620"/><stop offset="55%" stop-color="#060f16"/><stop offset="100%" stop-color="#0a1016"/>
    </linearGradient>
    <linearGradient id="m-land" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#17222b"/><stop offset="55%" stop-color="#121a21"/><stop offset="100%" stop-color="#0d1419"/>
    </linearGradient>
    <pattern id="m-grid" width="40" height="40" patternUnits="userSpaceOnUse">
      <path d="M40 0H0V40" fill="none" stroke="rgba(148,163,184,.09)" stroke-width="1"/>
    </pattern>
    <filter id="m-glow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="5" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <radialGradient id="m-urban" cx="50%" cy="50%" r="60%">
      <stop offset="0%" stop-color="rgba(120,170,210,.16)"/><stop offset="100%" stop-color="rgba(34,211,238,0)"/>
    </radialGradient>
  </defs>

  <rect width="1000" height="1000" fill="url(#m-water)"/>
  <rect width="1000" height="1000" fill="url(#m-grid)"/>

  <!-- deep water contour rings -->
  <circle cx="500" cy="500" r="470" fill="none" stroke="rgba(120,170,210,.06)"/>
  <circle cx="500" cy="500" r="380" fill="none" stroke="rgba(120,170,210,.05)"/>

  <!-- main landmass -->
  <path d="M 330 40 L 520 56 L 640 34 L 762 70 L 852 140 L 874 250 L 838 330 L 902 420 L 878 520 L 908 612 L 856 700 L 886 800 L 800 902 L 660 952 L 510 930 L 380 962 L 262 900 L 176 806 L 208 690 L 148 600 L 186 500 L 128 396 L 168 300 L 128 186 L 196 106 Z"
        fill="url(#m-land)" stroke="rgba(120,170,210,.38)" stroke-width="2" filter="url(#m-glow)"/>

  <!-- coastline inner highlight -->
  <path d="M 330 40 L 520 56 L 640 34 L 762 70 L 852 140 L 874 250 L 838 330 L 902 420 L 878 520 L 908 612 L 856 700 L 886 800 L 800 902 L 660 952 L 510 930 L 380 962 L 262 900 L 176 806 L 208 690 L 148 600 L 186 500 L 128 396 L 168 300 L 128 186 L 196 106 Z"
        fill="none" stroke="rgba(120,170,210,.16)" stroke-width="9"/>

  <!-- mountains -->
  <path class="mount" d="M 240 268 L 330 120 L 424 272 Z"/>
  <path class="mount" d="M 330 120 L 356 176 L 330 196 L 302 172 Z" fill="#2b3b39"/>
  <text class="dlabel" x="268" y="290" font-size="10">MT. CHILIAD · 1,394m</text>

  <path class="mount" d="M 214 352 L 268 268 L 322 356 Z" opacity=".85"/>
  <text class="dlabel" x="200" y="374" font-size="9">MT. JOSIAH</text>

  <path class="mount" d="M 700 268 L 760 190 L 820 274 Z" opacity=".7"/>
  <text class="dlabel" x="712" y="292" font-size="9">MT. GORDO</text>

  <!-- Alamo Sea -->
  <path d="M 424 246 C 462 220, 526 238, 550 292 C 570 342, 512 384, 458 370 C 406 356, 390 286, 424 246 Z"
        fill="#0b2534" stroke="rgba(120,170,210,.22)" stroke-width="1.5"/>
  <text class="dlabel" x="438" y="312" font-size="10">ALAMO SEA</text>

  <!-- Sandy Shores flats -->
  <rect x="452" y="380" width="128" height="56" rx="10" fill="#2a2a22" opacity=".55" stroke="rgba(245,158,11,.12)"/>
  <text class="dlabel" x="470" y="414" font-size="10" fill="rgba(245,158,11,.5)">SANDY SHORES</text>

  <!-- desert / grand senora -->
  <path d="M 560 300 L 700 290 L 760 360 L 690 430 L 580 410 Z" fill="#232a20" opacity=".5"/>
  <text class="dlabel" x="600" y="368" font-size="9">GRAND SENORA DESERT</text>

  <!-- urban grid · Los Santos -->
  <g class="urban">
    <rect x="592" y="682" width="122" height="66" rx="5"/>
    <rect x="726" y="690" width="110" height="58" rx="5"/>
    <rect x="592" y="760" width="104" height="62" rx="5"/>
    <rect x="708" y="760" width="128" height="62" rx="5"/>
    <rect x="592" y="836" width="96" height="52" rx="5"/>
    <rect x="700" y="834" width="96" height="54" rx="5"/>
    <rect x="808" y="758" width="58" height="120" rx="5"/>
    <rect x="806" y="690" width="60" height="56" rx="5"/>
  </g>
  <ellipse cx="700" cy="790" rx="180" ry="130" fill="url(#m-urban)" pointer-events="none"/>

  <!-- roads -->
  <g class="roads">
    <path d="M 152 596 C 246 700, 340 828, 520 900 C 646 946, 772 902, 866 798"/>
    <path d="M 520 720 L 700 758 L 868 716"/>
    <path d="M 292 420 L 470 400 L 700 424 L 862 400"/>
    <path d="M 700 424 L 704 682"/>
    <path d="M 380 176 L 520 240 L 700 222 L 842 300"/>
    <path d="M 168 300 L 292 420"/>
    <path d="M 842 300 L 862 400"/>
    <path d="M 208 690 L 340 660 L 470 640"/>
    <path d="M 600 640 L 704 682"/>
  </g>
  <g class="roads">
    <path class="hi" d="M 152 596 C 246 700, 340 828, 520 900 C 646 946, 772 902, 866 798"/>
    <path class="hi" d="M 520 720 L 700 758 L 868 716"/>
    <path class="hi" d="M 292 420 L 470 400 L 700 424 L 862 400"/>
  </g>

  <!-- districts -->
  <text class="dlabel" x="232" y="128" font-size="10">PALETO BAY</text>
  <text class="dlabel" x="700" y="196" font-size="10">GRAPESEED</text>
  <text class="dlabel" x="300" y="470" font-size="10">HARMONY</text>
  <text class="dlabel" x="620" y="672" font-size="10">VINEWOOD</text>
  <text class="dlabel" x="744" y="682" font-size="9">ROCKFORD HILLS</text>
  <text class="dlabel" x="712" y="756" font-size="9">DOWNTOWN</text>
  <text class="dlabel" x="520" y="768" font-size="9">DEL PERRO</text>
  <text class="dlabel" x="524" y="858" font-size="9">VESPUCCI</text>
  <text class="dlabel" x="718" y="884" font-size="9">GROVE ST.</text>
  <text class="dlabel" x="806" y="822" font-size="8" transform="rotate(90 806 822)">LA MESA</text>
  <text class="dlabel" x="606" y="920" font-size="8">LS INTL AIRPORT</text>

  <!-- city watermark -->
  <text class="wlabel" x="640" y="640" text-anchor="middle">LOS SANTOS</text>
  <text class="dlabel" x="196" y="560" font-size="10" fill="rgba(120,170,210,.28)">PACIFIC OCEAN</text>
</svg>`;

class TacticalMap {
  constructor(root, opts = {}) {
    this.root = root;
    this.opts = opts;
    this.area = opts.area || null;
    this.scale = 1;
    this.tx = 0;
    this.ty = 0;
    this.minScale = 0.3;
    this.maxScale = 5;
    this.markers = [];
    this.pickCoords = opts.initial || null;
    this.dragging = false;

    root.classList.add('map-shell');
    root.innerHTML = `
      <div class="map-viewport${opts.onPick ? ' picking' : ''}" tabindex="0">
        <div class="map-world">
          <div class="map-fallback">${MAP_SVG_SOURCE}</div>
          <img class="map-base" src="${this.area ? MAP_CITY_SRC : MAP_IMAGE_SRC}" alt="${this.area ? 'خريطة لوس سانتوس' : 'خريطة سان أندرياس'}" draggable="false">
          <div class="map-tint"></div>
          <div class="map-pins"></div>
        </div>
        <div class="map-tools">
          <button type="button" class="map-btn" data-zoom="in" title="تكبير"><i class="fa-solid fa-plus"></i></button>
          <button type="button" class="map-btn" data-zoom="out" title="تصغير"><i class="fa-solid fa-minus"></i></button>
          <button type="button" class="map-btn" data-zoom="fit" title="ملاءمة الشاشة"><i class="fa-solid fa-expand"></i></button>
        </div>
        <div class="map-compass">N</div>
        <div class="map-readout"><span>X <b class="rx">--</b></span><span>Y <b class="ry">--</b></span></div>
      </div>`;

    this.viewport = root.querySelector('.map-viewport');
    this.world = root.querySelector('.map-world');
    const baseImg = root.querySelector('.map-base');
    if (baseImg) {
      const useFallback = () => root.classList.add('map-fallback-on');
      baseImg.addEventListener('error', useFallback);
      if (baseImg.complete && !baseImg.naturalWidth) useFallback();
    }
    this.pinLayer = root.querySelector('.map-pins');
    this.readout = { x: root.querySelector('.rx'), y: root.querySelector('.ry') };

    this._bind();
    const init = () => {
      this.fit();
      if (this.opts.initial) this.focus(this.opts.initial, this.opts.initialZoom || 1.9);
      if (this.opts.onPick && this.opts.initial) this._drawPick(this.opts.initial);
    };
    init();
    if (!this.viewport.clientWidth) setTimeout(init, 80);
  }

  _bind() {
    const vp = this.viewport;
    let startX = 0, startY = 0, origTx = 0, origTy = 0, moved = 0, active = false;

    vp.addEventListener('pointerdown', (e) => {
      if (e.target.closest('.map-btn') || e.target.closest('.map-pin')) return;
      active = true; moved = 0;
      startX = e.clientX; startY = e.clientY;
      origTx = this.tx; origTy = this.ty;
      try { vp.setPointerCapture(e.pointerId); } catch (err) { }
    });

    vp.addEventListener('pointermove', (e) => {
      const c = this.toWorld(e.clientX, e.clientY);
      this.readout.x.textContent = c.x.toFixed(0);
      this.readout.y.textContent = c.y.toFixed(0);
      if (!active) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (Math.abs(dx) + Math.abs(dy) > 5) { moved = 1; this.dragging = true; }
      if (this.dragging) {
        this.tx = origTx + dx;
        this.ty = origTy + dy;
        this.apply();
      }
    });

    const end = (e) => {
      if (!active) return;
      active = false;
      const wasDrag = this.dragging;
      this.dragging = false;
      try { vp.releasePointerCapture?.(e.pointerId); } catch (err) { }
      if (wasDrag) return;
      const c = this.toWorld(e.clientX, e.clientY);
      if (c.x < 0 || c.y < 0 || c.x > 1000 || c.y > 1000) return;
      if (this.opts.onPick) {
        this.pickCoords = c;
        this._drawPick(c);
        this.opts.onPick(c);
      }
    };
    vp.addEventListener('pointerup', end);
    vp.addEventListener('pointercancel', () => { active = false; this.dragging = false; });

    vp.addEventListener('wheel', (e) => {
      e.preventDefault();
      const rect = vp.getBoundingClientRect();
      this.zoomBy(e.deltaY < 0 ? 1.14 : 1 / 1.14, e.clientX - rect.left, e.clientY - rect.top);
    }, { passive: false });

    vp.addEventListener('dblclick', (e) => {
      const rect = vp.getBoundingClientRect();
      this.zoomBy(1.5, e.clientX - rect.left, e.clientY - rect.top);
    });

    this.root.querySelectorAll('.map-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const z = btn.dataset.zoom;
        const rect = vp.getBoundingClientRect();
        if (z === 'in') this.zoomBy(1.3, rect.width / 2, rect.height / 2);
        else if (z === 'out') this.zoomBy(1 / 1.3, rect.width / 2, rect.height / 2);
        else this.fit();
      });
    });

    this.pinLayer.addEventListener('click', (e) => {
      const pin = e.target.closest('.map-pin');
      if (!pin) return;
      e.stopPropagation();
      const m = this.markers.find(x => x.id === pin.dataset.pin);
      if (m && this.opts.onPin) this.opts.onPin(m);
    });
  }

  toWorld(clientX, clientY) {
    const rect = this.world.getBoundingClientRect();
    const s = rect.width / 1000;
    const lx = Math.max(0, Math.min(1000, (clientX - rect.left) / s));
    const ly = Math.max(0, Math.min(1000, (clientY - rect.top) / s));
    return this._toState(lx, ly);
  }

  _toLocal(x, y) {
    if (!this.area) return { x, y };
    return { x: (x - this.area.x) / this.area.w * 1000, y: (y - this.area.y) / this.area.h * 1000 };
  }

  _toState(x, y) {
    if (!this.area) return { x, y };
    return { x: this.area.x + x / 1000 * this.area.w, y: this.area.y + y / 1000 * this.area.h };
  }

  apply() {
    this.world.style.transform = `translate(${this.tx}px, ${this.ty}px) scale(${this.scale})`;
  }

  fit() {
    const w = this.viewport.clientWidth || 600;
    const h = this.viewport.clientHeight || 500;
    this.scale = Math.min(w, h) / 1000 * 0.96;
    this.tx = (w - 1000 * this.scale) / 2;
    this.ty = (h - 1000 * this.scale) / 2;
    this.apply();
  }

  zoomBy(factor, cx, cy) {
    const w = this.viewport.clientWidth, h = this.viewport.clientHeight;
    cx = cx == null ? w / 2 : cx;
    cy = cy == null ? h / 2 : cy;
    const ns = Math.max(this.minScale, Math.min(this.maxScale, this.scale * factor));
    const wx = (cx - this.tx) / this.scale;
    const wy = (cy - this.ty) / this.scale;
    this.scale = ns;
    this.tx = cx - wx * ns;
    this.ty = cy - wy * ns;
    this.apply();
  }

  focus(coords, zoom) {
    if (!coords) return;
    if (zoom) this.scale = Math.max(this.minScale, Math.min(this.maxScale, zoom));
    const p = this._toLocal(coords.x, coords.y);
    const w = this.viewport.clientWidth, h = this.viewport.clientHeight;
    this.tx = w / 2 - p.x * this.scale;
    this.ty = h / 2 - p.y * this.scale;
    this.apply();
  }

  _drawPick(c) {
    const old = this.pinLayer.querySelector('.pick-marker');
    if (old) old.remove();
    const el = document.createElement('div');
    el.className = 'map-pin raid pick-marker';
    const p = this._toLocal(c.x, c.y);
    el.style.left = p.x + 'px';
    el.style.top = p.y + 'px';
    el.innerHTML = '<i class="fa-solid fa-crosshairs"></i>';
    this.pinLayer.appendChild(el);
  }

  setMarkers(list) {
    this.markers = list || [];
    this.pinLayer.innerHTML = '';
    if (this.pickCoords) this._drawPick(this.pickCoords);
    this.markers.forEach(m => {
      const p = this._toLocal(m.x, m.y);
      if (p.x < -10 || p.y < -10 || p.x > 1010 || p.y > 1010) return;
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'map-pin ' + (m.type || 'custom');
      el.style.left = p.x + 'px';
      el.style.top = p.y + 'px';
      el.dataset.pin = m.id;
      el.title = m.label || '';
      const icon = { person: 'fa-user-secret', network: 'fa-sitemap', raid: 'fa-bullseye', evidence: 'fa-box-archive', custom: 'fa-location-dot' }[m.type] || 'fa-location-dot';
      el.innerHTML = `<i class="fa-solid ${icon}"></i><span class="lbl">${m.label || ''}</span>`;
      this.pinLayer.appendChild(el);
    });
  }
}

window.TacticalMap = TacticalMap;
