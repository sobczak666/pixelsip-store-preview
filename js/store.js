/* Pixel Sip — silnik sklepu (vanilla JS, bez zależności).
   Dane: data/products.json, data/designs.json. Koszyk: localStorage. */
(() => {
  'use strict';

  // ——— KONFIG (do uzupełnienia przed startem sprzedaży — patrz GO-LIVE.md) ———
  const CONFIG = {
    orderEndpoint: '',                 // np. 'https://formspree.io/f/xxxxxxx' — pusty => tryb demo (mailto + kopiuj)
    shopEmail: 'zamowienia@pixelsip.pl',
    currency: 'zł',
  };

  const PLN = (v) => `${Number(v).toFixed(2).replace('.', ',')} ${CONFIG.currency}`;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));

  const state = {
    products: [], designs: [], byId: {}, prodById: {},
    size: null, designId: null, strip: 'both',
    stripColorTop: 'glitch', bandColorTop: '#000000', stripColorBot: 'glitch', bandColorBot: '#000000',
    stripText: '',                       // '' = domyślny „PIXEL SIP"; inaczej własny napis (font Pixel Operator Bold)
    stripSize: 1,                        // mnożnik wysokości paska/fontu (Mały/Średni/Duży/Wielki)
    base: 'scene',
    geo: { pattern: 'paski-pion', c1: '#0B0A16', c2: '#22E0E6', n: 10 },
    tile: { emblem: 'water-drop', bg: '#0B0A16', n: 6 },
    emblems: [], embCat: 'all',
    cat: 'all', q: '',
    freeShip: 199, delivery: [], bundles: [], lastFocus: null,
  };
  // wzory tilują się na szwie (cell = szerokość / n, bez obrotów)
  const GEO_PATTERNS = [
    { id: 'paski-pion', label: 'Paski ▏▏' }, { id: 'paski-poziom', label: 'Paski ▭' },
    { id: 'szachownica', label: 'Szachownica' }, { id: 'romby', label: 'Romby' },
    { id: 'kropki', label: 'Kropki' }, { id: 'krata', label: 'Krata' }, { id: 'zygzak', label: 'Zygzak' },
  ];
  const GEO_SIZES = [{ label: 'Drobny', n: 16 }, { label: 'Średni', n: 10 }, { label: 'Duży', n: 6 }, { label: 'Wielki', n: 4 }];
  const TILE_SIZES = [{ label: 'Drobny', n: 10 }, { label: 'Średni', n: 7 }, { label: 'Duży', n: 5 }, { label: 'Wielki', n: 3 }];
  const STRIP_SIZES = [{ label: 'Mały', n: 0.8 }, { label: 'Średni', n: 1 }, { label: 'Duży', n: 1.25 }, { label: 'Wielki', n: 1.5 }];
  const STRIP_LABEL = { both: 'góra i dół', top: 'tylko góra', bot: 'tylko dół', none: 'bez paska' };
  const PALETTE = [
    { id: '#FFFFFF', label: 'Biały', css: '#FFFFFF' },
    { id: '#0B0A16', label: 'Granat', css: '#0B0A16' },
    { id: '#000000', label: 'Czarny', css: '#000000' },
    { id: '#8A8DA8', label: 'Szary', css: '#8A8DA8' },
    { id: '#22E0E6', label: 'Cyan', css: '#22E0E6' },
    { id: '#19C3C9', label: 'Turkus', css: '#19C3C9' },
    { id: '#3BA7FF', label: 'Błękit', css: '#3BA7FF' },
    { id: '#3B5BFF', label: 'Niebieski', css: '#3B5BFF' },
    { id: '#7C3BFF', label: 'Indygo', css: '#7C3BFF' },
    { id: '#9B5DE5', label: 'Fiolet', css: '#9B5DE5' },
    { id: '#C04BFF', label: 'Purpura', css: '#C04BFF' },
    { id: '#FF2E97', label: 'Magenta', css: '#FF2E97' },
    { id: '#FF5D8F', label: 'Róż', css: '#FF5D8F' },
    { id: '#FF4D4D', label: 'Czerwony', css: '#FF4D4D' },
    { id: '#FF6B35', label: 'Ceglasty', css: '#FF6B35' },
    { id: '#FF8A3D', label: 'Pomarańcz', css: '#FF8A3D' },
    { id: '#FFB23F', label: 'Bursztyn', css: '#FFB23F' },
    { id: '#FFD23F', label: 'Żółty', css: '#FFD23F' },
    { id: '#EAFF3F', label: 'Cytryna', css: '#EAFF3F' },
    { id: '#C6F542', label: 'Limonka', css: '#C6F542' },
    { id: '#5DF7A0', label: 'Zielony', css: '#5DF7A0' },
    { id: '#2EE6B0', label: 'Mięta', css: '#2EE6B0' },
  ];
  const STRIP_COLORS = [{ id: 'glitch', label: 'Glitch', css: 'linear-gradient(90deg,#22E0E6,#fff,#FF2E97)' }, ...PALETTE];
  const BAND_COLORS = PALETTE;
  const colorLabel = (id) => (STRIP_COLORS.find(c => c.id === id) || {}).label || id;
  const bandLabel = (id) => (BAND_COLORS.find(c => c.id === id) || {}).label || id;
  const sideLabel = (t, b) => `napis ${colorLabel(t)}, tło ${bandLabel(b)}`;
  const stripDesc = () => {
    if (state.strip === 'none') return 'Pasek: bez paska';
    if (state.strip === 'top') return `Pasek górny (${sideLabel(state.stripColorTop, state.bandColorTop)})`;
    if (state.strip === 'bot') return `Pasek dolny (${sideLabel(state.stripColorBot, state.bandColorBot)})`;
    return `Górny: ${sideLabel(state.stripColorTop, state.bandColorTop)} · Dolny: ${sideLabel(state.stripColorBot, state.bandColorBot)}`;
  };

  const CART_KEY = 'pixelsip_cart_v1';
  const loadCart = () => { try { return JSON.parse(localStorage.getItem(CART_KEY)) || []; } catch { return []; } };
  const saveCart = (c) => { try { localStorage.setItem(CART_KEY, JSON.stringify(c)); } catch {} };
  let cart = loadCart();
  let isSubmitting = false;

  // ——————————————————— INIT ———————————————————
  async function init() {
    try {
      const [p, d, em] = await Promise.all([
        fetch('data/products.json').then(r => r.json()),
        fetch('data/designs.json').then(r => r.json()),
        fetch('data/emblems.json').then(r => r.json()).catch(() => []),
      ]);
      state.emblems = em || [];
      state.products = p.products || [];
      state.freeShip = p.freeShippingThreshold ?? 199;
      state.delivery = p.delivery || [];
      state.bundles = p.bundles || [];
      state.designs = d || [];
      state.prodById = Object.fromEntries(state.products.map(x => [x.id, x]));
      state.byId = Object.fromEntries(state.designs.map(x => [x.id, x]));
      state.size = state.products[0]?.id || null;
      state.designId = state.designs[0]?.id || null;
    } catch (e) { console.error('Błąd ładowania danych', e); const g = $('#design-gallery'); if (g) g.innerHTML = '<p class="muted">Nie udało się załadować wzorów. Odśwież stronę.</p>'; return; }

    restoreBuild();                       // link #k=... albo autozapis -> ustawia state przed renderem
    renderGallery(); renderSizes(); renderPalettes(); applyStripVisibility();
    renderGeoControls(); renderEmblems(); applyBaseVisibility();
    renderDelivery(); updatePreview(); bindUI(); renderCart(); cookieBanner(); initHeroCarousel();
    if (window.__fromShareLink) toast('Wczytano udostępniony projekt ✨');
  }

  // ——————————————————— GALERIA ———————————————————
  function renderGallery() {
    const grid = $('#design-gallery'); if (!grid) return;
    const items = state.designs.filter(d =>
      (state.cat === 'all' || d.category === state.cat) &&
      (!state.q || (d.name + ' ' + (d.tags || []).join(' ') + ' ' + d.blurb).toLowerCase().includes(state.q))
    );
    const gc = $('#gallery-count'); if (gc) gc.textContent = String(items.length);
    grid.innerHTML = items.map(d => `
      <button class="design-card${d.id === state.designId ? ' is-active' : ''}" data-design="${esc(d.id)}" aria-pressed="${d.id === state.designId}" aria-label="Wybierz wzór: ${esc(d.name)}">
        <img class="design-card__img" src="${esc(d.file)}" alt="Wzór ${esc(d.name)}" loading="lazy" decoding="async" width="600" height="375">
        <span class="design-card__meta">
          <span class="design-card__name">${esc(d.name)}</span>
          <span class="design-card__cat">${esc(d.categoryLabel || '')}</span>
        </span>
      </button>`).join('') || `<p class="muted">Brak wzorów dla tego filtra.</p>`;
    grid.scrollLeft = 0; updateGalleryNav();
  }
  function updateGalleryNav() {                                   // chowaj strzałki na krańcach
    const g = $('#design-gallery'); if (!g) return;
    const max = g.scrollWidth - g.clientWidth;
    const prev = $('.gallery-nav--prev'), next = $('.gallery-nav--next');
    if (prev) prev.hidden = g.scrollLeft <= 2;
    if (next) next.hidden = g.scrollLeft >= max - 2;
  }
  function scrollGallery(dir) {
    const g = $('#design-gallery'); if (!g) return;
    g.style.scrollSnapType = 'none';                              // snap blokuje smooth scrollBy — wyłącz na czas animacji
    g.scrollBy({ left: dir * Math.max(220, g.clientWidth * 0.85), behavior: 'smooth' });
    clearTimeout(scrollGallery._t); scrollGallery._t = setTimeout(() => { g.style.scrollSnapType = ''; updateGalleryNav(); }, 500);
  }

  function renderSizes() {
    const wrap = $('#size-options'); if (!wrap) return;
    wrap.innerHTML = state.products.map(p => `
      <button class="size-opt${p.id === state.size ? ' is-active' : ''}" data-size="${esc(p.id)}" aria-pressed="${p.id === state.size}">
        <span class="size-opt__cap">${esc(p.sizeLabel)}</span>
        <span class="size-opt__price">${PLN(p.retailPrice)}</span>
      </button>`).join('');
  }

  function renderDelivery() {
    const el = $('#delivery-list'); if (!el || !state.delivery.length) return;
    el.innerHTML = state.delivery.map(d => `
      <li><span>${esc(d.method)} <em class="muted">${esc(d.eta)}</em></span><b>${d.price === 0 ? 'gratis' : PLN(d.price)}</b></li>`).join('');
  }
  function renderPalette(id, colors, current, pal, lbl) {
    const w = $('#' + id); if (!w) return;
    w.innerHTML = colors.map(c => `<button class="swatch${c.id === current ? ' is-active' : ''}" data-pal="${pal}" data-val="${esc(c.id)}" title="${esc(c.label)}" aria-label="${lbl}: ${esc(c.label)}" style="background:${c.css}"></button>`).join('');
  }
  function renderSizeBtns(id, sizes, current, kind) {
    const w = $('#' + id); if (!w) return;
    w.innerHTML = sizes.map(s => `<button class="strip-opt${s.n === current ? ' is-active' : ''}" data-size-${kind}="${s.n}">${esc(s.label)}</button>`).join('');
  }
  function renderPalettes() {
    renderPalette('strip-colors-top', STRIP_COLORS, state.stripColorTop, 'tt', 'Napis górny');
    renderPalette('band-colors-top', BAND_COLORS, state.bandColorTop, 'tb', 'Tło górne');
    renderPalette('strip-colors-bot', STRIP_COLORS, state.stripColorBot, 'bt', 'Napis dolny');
    renderPalette('band-colors-bot', BAND_COLORS, state.bandColorBot, 'bb', 'Tło dolne');
  }
  function applyStripVisibility() {
    const ti = $('#strip-text'); if (ti && ti.value !== state.stripText) ti.value = state.stripText;
    renderSizeBtns('strip-sizes', STRIP_SIZES, state.stripSize, 'strip');
    $$('[data-strip]').forEach(s => { const a = s.dataset.strip === state.strip; s.classList.toggle('is-active', a); s.setAttribute('aria-pressed', a); });
    $('#strip-top-group')?.classList.toggle('off', !(state.strip === 'both' || state.strip === 'top'));
    $('#strip-bot-group')?.classList.toggle('off', !(state.strip === 'both' || state.strip === 'bot'));
  }
  function renderGeoControls() {
    const pw = $('#geo-patterns');
    if (pw) pw.innerHTML = GEO_PATTERNS.map(p => `<button class="strip-opt${p.id === state.geo.pattern ? ' is-active' : ''}" data-geopat="${p.id}">${esc(p.label)}</button>`).join('');
    renderPalette('geo-c1', PALETTE, state.geo.c1, 'g1', 'Kolor tła');
    renderPalette('geo-c2', PALETTE, state.geo.c2, 'g2', 'Kolor wzoru');
    renderSizeBtns('geo-sizes', GEO_SIZES, state.geo.n, 'geo');
  }
  function renderEmblems() {
    const cats = ['all', ...new Set(state.emblems.map(e => e.category))];
    const catLbl = { all: 'Wszystkie' }; state.emblems.forEach(e => catLbl[e.category] = e.categoryLabel);
    const cw = $('#emblem-cats');
    if (cw) cw.innerHTML = cats.map(c => `<button class="chip${c === state.embCat ? ' is-active' : ''}" data-embcat="${esc(c)}">${esc(catLbl[c] || c)}</button>`).join('');
    const tray = $('#emblem-tray');
    if (tray) {
      const items = state.emblems.filter(e => state.embCat === 'all' || e.category === state.embCat);
      tray.innerHTML = items.map(e => `<button class="emb${e.id === state.tile.emblem ? ' is-active' : ''}" data-emblem="${esc(e.id)}" title="${esc(e.id)}" aria-label="Emblemat ${esc(e.id)}"><img src="${esc(e.file)}" alt="" loading="lazy" width="64" height="64"></button>`).join('');
    }
    renderPalette('tile-bg', PALETTE, state.tile.bg, 'tg', 'Kolor tła');
    renderSizeBtns('tile-sizes', TILE_SIZES, state.tile.n, 'tile');
  }
  function applyBaseVisibility() {
    ['scene', 'geo', 'tile'].forEach(b => $('#panel-' + b)?.classList.toggle('off', state.base !== b));
    $$('[data-base]').forEach(t => { const a = t.dataset.base === state.base; t.classList.toggle('is-active', a); t.setAttribute('aria-pressed', a); });
  }

  // ——————————————————— TEKSTURA (parametryczna: scena + paski) ———————————————————
  const TEX = document.createElement('canvas'); TEX.width = 1024; TEX.height = 916;
  const tctx = TEX.getContext('2d');
  const imgCache = {};
  const loadImg = (src) => imgCache[src] || (imgCache[src] = new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = src; }));
  let texSeq = 0, jerseyReady = null;
  const stripCache = {};
  // pasek „PIXEL SIP" (i własne napisy) renderowany fontem marki — Pixel Operator Bold (CC0), nie obrazkiem
  function ensureFont() {
    if (jerseyReady) return jerseyReady;
    if (window.FontFace) {
      const ff = new FontFace('PixelSipFont', "url('assets/fonts/PixelOperator-Bold.ttf')");
      jerseyReady = ff.load().then((f) => { document.fonts.add(f); return true; }).catch(() => false);
    } else jerseyReady = Promise.resolve(false);
    return jerseyReady;
  }
  function sanitizeText(s) { return String(s).replace(/[^\p{L}\p{N} !?#&.,'\-]/gu, '').replace(/\s+/g, ' ').slice(0, 14); }
  const b64urlEnc = (s) => { try { return btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); } catch { return ''; } };
  const b64urlDec = (s) => { try { return decodeURIComponent(escape(atob(String(s).replace(/-/g, '+').replace(/_/g, '/')))); } catch { return ''; } };
  function renderCustomStrip(text, color) {                // -> canvas z napisem (kolor lub glitch cyan/magenta)
    const key = color + '|' + text;
    if (stripCache[key]) return stripCache[key];
    const PX = 120;
    const mc = document.createElement('canvas').getContext('2d');
    mc.font = `${PX}px PixelSipFont, monospace`;
    const m = mc.measureText(text || ' ');
    const asc = Math.ceil(m.actualBoundingBoxAscent || PX * 0.72), desc = Math.ceil(m.actualBoundingBoxDescent || PX * 0.1);
    const tw = Math.max(1, Math.ceil(m.width));
    const d = color === 'glitch' ? Math.max(2, Math.round(PX * 0.045)) : 0;
    const padX = d + 2, padY = d + Math.round((asc + desc) * 0.07) + 2;   // ~7% luzu pionowo, by rozmiar pasował do wordmarku
    const c = document.createElement('canvas');
    c.width = tw + padX * 2; c.height = asc + desc + padY * 2;
    const x = c.getContext('2d');
    x.font = `${PX}px PixelSipFont, monospace`; x.textBaseline = 'alphabetic'; x.textAlign = 'left';
    const bx = padX, by = padY + asc;
    if (color === 'glitch') {
      x.fillStyle = '#FF2E97'; x.fillText(text, bx - d, by - d);
      x.fillStyle = '#22E0E6'; x.fillText(text, bx + d, by + d);
      x.fillStyle = '#F5F5FC'; x.fillText(text, bx, by);
    } else { x.fillStyle = color; x.fillText(text, bx, by); }
    stripCache[key] = c; return c;
  }
  function stripFor(textColor) {                            // zawsze font: domyślnie „PIXEL SIP", albo własny napis
    return renderCustomStrip(state.stripText || 'PIXEL SIP', textColor);
  }
  async function buildTexture() {
    const seq = ++texSeq;
    await ensureFont();
    let baseImg = null;
    if (state.base === 'scene') { const d = state.byId[state.designId]; if (!d) return; baseImg = await loadImg(d.file); }
    else if (state.base === 'tile') { if (!state.tile.emblem) return; baseImg = await loadImg('assets/emblems/' + state.tile.emblem + '.png'); }
    if (seq !== texSeq) return;
    if ((state.base === 'scene' || state.base === 'tile') && !baseImg) return;
    const TW = TEX.width, TH = TEX.height, BAND = Math.round(TH * 0.135 * state.stripSize);
    const top = state.strip === 'both' || state.strip === 'top';
    const bot = state.strip === 'both' || state.strip === 'bot';
    tctx.imageSmoothingEnabled = false;
    tctx.fillStyle = '#000'; tctx.fillRect(0, 0, TW, TH);
    const sy0 = top ? BAND : 0, sy1 = bot ? TH - BAND : TH;
    drawBase(0, sy0, TW, sy1 - sy0, baseImg);
    const sh = Math.round(BAND * 0.58), mg = Math.round(TW * 0.05);
    const band = (by, textColor, bandColorHex) => {
      tctx.fillStyle = bandColorHex; tctx.fillRect(0, by, TW, BAND);
      const strip = stripFor(textColor);
      const bw = Math.round(strip.width * sh / strip.height), yy = by + (BAND - sh) / 2;
      tctx.imageSmoothingEnabled = false;
      if (2 * bw + 2 * mg + 24 <= TW) {                 // mieści się dwa razy (jak PIXEL SIP) -> dwie kopie
        tctx.drawImage(strip, mg, yy, bw, sh); tctx.drawImage(strip, TW - mg - bw, yy, bw, sh);
      } else {                                          // dłuższy napis -> jedna kopia wyśrodkowana (zachowaj proporcje)
        let cw = bw, ch = sh; const maxw = TW - 2 * mg;
        if (cw > maxw) { cw = maxw; ch = Math.round(strip.height * cw / strip.width); }
        tctx.drawImage(strip, (TW - cw) / 2, by + (BAND - ch) / 2, cw, ch);
      }
    };
    if (top) band(0, state.stripColorTop, state.bandColorTop);
    if (bot) band(TH - BAND, state.stripColorBot, state.bandColorBot);
    window.__tumblerCanvas = TEX;
    window.Tumbler?.setTextureCanvas(TEX);
  }
  function drawCover(img, x, y, w, h) {
    tctx.imageSmoothingEnabled = false;
    const s = Math.max(w / img.width, h / img.height), iw = img.width * s, ih = img.height * s;
    tctx.drawImage(img, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih);
  }
  function drawBase(x, y, w, h, img) {
    if (state.base === 'geo') return drawGeo(x, y, w, h);
    if (state.base === 'tile') return drawTile(x, y, w, h, img);
    drawCover(img, x, y, w, h);
  }
  function drawGeo(x, y, w, h) {
    const g = state.geo, n = Math.max(2, g.n | 0), cell = w / n, P = g.pattern, rows = Math.ceil(h / cell) + 1;
    tctx.save(); tctx.beginPath(); tctx.rect(x, y, w, h); tctx.clip();
    tctx.fillStyle = g.c1; tctx.fillRect(x, y, w, h);
    tctx.fillStyle = g.c2; tctx.strokeStyle = g.c2;
    if (P === 'paski-pion') {
      for (let i = 0; i < n; i++) tctx.fillRect(x + i * cell, y, cell / 2, h);
    } else if (P === 'paski-poziom') {
      for (let j = 0; j < rows; j++) tctx.fillRect(x, y + j * cell, w, cell / 2);
    } else if (P === 'szachownica') {
      for (let j = 0; j < rows; j++) for (let i = 0; i < n; i++) if ((i + j) & 1) tctx.fillRect(x + i * cell, y + j * cell, cell + 0.6, cell + 0.6);
    } else if (P === 'romby') {
      // pojedyncza krata rombów (cyan romb / romb tła naprzemiennie — harlequin); domyka się na szwie dla każdego n
      const hw = cell / 2, dia = (cx, cy) => { tctx.beginPath(); tctx.moveTo(cx, cy - hw); tctx.lineTo(cx + hw, cy); tctx.lineTo(cx, cy + hw); tctx.lineTo(cx - hw, cy); tctx.closePath(); tctx.fill(); };
      for (let j = -1; j <= rows; j++) for (let i = -1; i <= n; i++) dia(x + i * cell, y + j * cell);
    } else if (P === 'kropki') {
      const r = cell * 0.3;
      for (let j = 0; j < rows; j++) for (let i = 0; i < n; i++) { tctx.beginPath(); tctx.arc(x + (i + 0.5) * cell, y + (j + 0.5) * cell, r, 0, 7); tctx.fill(); }
    } else if (P === 'krata') {
      tctx.lineWidth = Math.max(2, cell * 0.12);
      for (let i = 0; i <= n; i++) { tctx.beginPath(); tctx.moveTo(x + i * cell, y); tctx.lineTo(x + i * cell, y + h); tctx.stroke(); }
      for (let j = 0; j <= rows; j++) { tctx.beginPath(); tctx.moveTo(x, y + j * cell); tctx.lineTo(x + w, y + j * cell); tctx.stroke(); }
    } else if (P === 'zygzak') {
      tctx.lineWidth = Math.max(3, cell * 0.28); tctx.lineJoin = 'miter';
      for (let j = -1; j < rows + 1; j += 2) { tctx.beginPath(); for (let i = 0; i <= n; i++) tctx.lineTo(x + i * cell, y + j * cell + ((i & 1) ? cell : 0)); tctx.stroke(); }
    }
    tctx.restore();
  }
  function drawTile(x, y, w, h, img) {
    const t = state.tile, n = Math.max(2, t.n | 0), cell = w / n;
    tctx.save(); tctx.beginPath(); tctx.rect(x, y, w, h); tctx.clip();
    tctx.fillStyle = t.bg; tctx.fillRect(x, y, w, h);
    tctx.imageSmoothingEnabled = false;
    const ih = cell * (img.height / img.width); let row = 0;
    for (let cy = y; cy < y + h + cell; cy += cell) {
      const off = (row & 1) ? cell / 2 : 0;
      for (let i = -1; i <= n; i++) tctx.drawImage(img, x + i * cell + off, cy, cell, ih);
      row++;
    }
    tctx.restore();
  }

  // ——————————————————— PODGLĄD ———————————————————
  function updatePreview() {
    const d = state.byId[state.designId], p = state.prodById[state.size];
    if (!d || !p) return;
    const set = (id, t) => { const el = $(id); if (el) el.textContent = t; };
    const isScene = state.base === 'scene';
    const blurb = isScene ? (d.blurb || '')
      : state.base === 'geo' ? 'Wzór geometryczny • nadruk domyka się bezszwowo dookoła'
      : 'Emblemat kafelkowany • nadruk domyka się bezszwowo dookoła';
    set('#preview-name', isScene ? d.name : baseName()); set('#preview-blurb', blurb);
    set('#preview-size', p.sizeLabel); set('#preview-price', PLN(p.retailPrice));
    const cmp = $('#preview-compare');
    if (cmp) { if (p.compareAt && p.compareAt > p.retailPrice) { cmp.textContent = PLN(p.compareAt); cmp.hidden = false; } else cmp.hidden = true; }
    // podgląd 3D — rozmiar + tekstura składana parametrycznie
    window.__tumblerWant = { cap: p.capacityMl };
    window.Tumbler?.setSize(p.capacityMl);
    buildTexture();
    saveBuild();
  }

  // ——————————————————— KOSZYK ———————————————————
  function thumbURL() {
    const c = document.createElement('canvas'); c.width = 140; c.height = Math.round(140 * TEX.height / TEX.width);
    c.getContext('2d').drawImage(TEX, 0, 0, c.width, c.height);
    try { return c.toDataURL('image/jpeg', 0.7); } catch { return ''; }
  }
  function baseConfig() {
    const g = state.geo, t = state.tile;
    if (state.base === 'geo') return { base: 'geo', wzor: g.pattern, c1: g.c1, c2: g.c2, n: g.n };
    if (state.base === 'tile') return { base: 'tile', emblemat: t.emblem, tlo: t.bg, n: t.n };
    return { base: 'scene', design: state.designId };
  }
  function baseName() {
    if (state.base === 'geo') return `Wzór: ${(GEO_PATTERNS.find(p => p.id === state.geo.pattern) || {}).label || state.geo.pattern}`;
    if (state.base === 'tile') return `Emblemat: ${state.tile.emblem} (kafelek)`;
    return (state.byId[state.designId] || {}).name || '—';
  }

  // ——————————————————— PROJEKT: zapis / udostępnianie (config w URL) ———————————————————
  // applyConfig(cfg) = jedno źródło prawdy: bierze komplet ustawień i odtwarza kubek 1:1.
  // Te same pola co lecą do generate_order.py, więc podgląd = druk.
  const BUILD_KEY = 'pixelsip_build_v1';
  const isHex = (v) => /^#[0-9a-fA-F]{6}$/.test(v || '');
  const noHash = (s) => String(s).replace(/^#/, '');
  const addHashCol = (s) => (/^[0-9a-fA-F]{6}$/.test(s || '') ? '#' + s : s);
  const okN = (set, n) => set.some(s => s.n === n);
  function setStateFromConfig(cfg) {                 // tylko mutacja state + walidacja (bez renderów)
    if (!cfg) return;
    if (['scene', 'tile'].includes(cfg.base)) state.base = cfg.base;   // 'geo' wycofane — stare configi -> domyślnie scena
    if (cfg.design && state.byId[cfg.design]) state.designId = cfg.design;
    if (GEO_PATTERNS.some(p => p.id === cfg.wzor)) state.geo.pattern = cfg.wzor;
    if (isHex(cfg.c1)) state.geo.c1 = cfg.c1;
    if (isHex(cfg.c2)) state.geo.c2 = cfg.c2;
    if (cfg.emb && state.emblems.some(e => e.id === cfg.emb)) state.tile.emblem = cfg.emb;
    if (isHex(cfg.bg)) state.tile.bg = cfg.bg;
    const gn = parseInt(cfg.gn, 10); if (okN(GEO_SIZES, gn)) state.geo.n = gn;     // walidacja = szew zawsze się domyka
    const tn = parseInt(cfg.tn, 10); if (okN(TILE_SIZES, tn)) state.tile.n = tn;
    if (cfg.size && state.prodById[cfg.size]) state.size = cfg.size;
    if (['both', 'top', 'bot', 'none'].includes(cfg.strip)) state.strip = cfg.strip;
    if (cfg.gt === 'glitch' || isHex(cfg.gt)) state.stripColorTop = cfg.gt;
    if (isHex(cfg.gb)) state.bandColorTop = cfg.gb;
    if (cfg.dt === 'glitch' || isHex(cfg.dt)) state.stripColorBot = cfg.dt;
    if (isHex(cfg.db)) state.bandColorBot = cfg.db;
    if (cfg.txt !== undefined) state.stripText = cfg.txt ? sanitizeText(b64urlDec(cfg.txt)) : '';
    const ps = parseFloat(cfg.ps); if (STRIP_SIZES.some(s => s.n === ps)) state.stripSize = ps;
  }
  function applyConfig(cfg) {                          // mutacja + pełny re-render kreatora (dla linków/presetów w locie)
    setStateFromConfig(cfg);
    renderGallery(); renderSizes(); renderGeoControls(); renderEmblems();
    renderPalettes(); applyStripVisibility(); applyBaseVisibility(); updatePreview();
  }
  function serializeBuild() {                          // state -> zwarty token (np. base.geo~wzor.romby~c1.0B0A16~...)
    const p = [], add = (k, v) => { if (v != null && v !== '') p.push(k + '.' + v); };
    add('base', state.base);
    if (state.base === 'scene') add('design', state.designId);
    else if (state.base === 'geo') { add('wzor', state.geo.pattern); add('c1', noHash(state.geo.c1)); add('c2', noHash(state.geo.c2)); add('gn', state.geo.n); }
    else if (state.base === 'tile') { add('emb', state.tile.emblem); add('bg', noHash(state.tile.bg)); add('tn', state.tile.n); }
    add('size', state.size); add('strip', state.strip);
    add('gt', state.stripColorTop === 'glitch' ? 'glitch' : noHash(state.stripColorTop));
    add('gb', noHash(state.bandColorTop));
    add('dt', state.stripColorBot === 'glitch' ? 'glitch' : noHash(state.stripColorBot));
    add('db', noHash(state.bandColorBot));
    add('txt', state.stripText ? b64urlEnc(state.stripText) : '');
    if (state.stripSize !== 1) add('ps', state.stripSize);
    return p.join('~');
  }
  function parseBuild(str) {                            // token -> cfg (z przywróconym '#')
    const d = {}; String(str).split('~').forEach(t => { const i = t.indexOf('.'); if (i > 0) d[t.slice(0, i)] = t.slice(i + 1); });
    return {
      base: d.base, design: d.design, wzor: d.wzor, c1: addHashCol(d.c1), c2: addHashCol(d.c2),
      emb: d.emb, bg: addHashCol(d.bg), gn: d.gn, tn: d.tn, size: d.size, strip: d.strip,
      gt: d.gt === 'glitch' ? 'glitch' : addHashCol(d.gt), gb: addHashCol(d.gb),
      dt: d.dt === 'glitch' ? 'glitch' : addHashCol(d.dt), db: addHashCol(d.db), txt: d.txt, ps: d.ps,
    };
  }
  function saveBuild() { try { localStorage.setItem(BUILD_KEY, serializeBuild()); } catch {} }
  function restoreBuild() {                             // wołane w init PRZED renderami — ustawia tylko state
    let fromLink = false, src = null;
    const m = location.hash.match(/(?:^#|&)k=([^&]+)/);
    if (m) { try { src = decodeURIComponent(m[1]); } catch { src = m[1]; } fromLink = true; }
    else { try { src = localStorage.getItem(BUILD_KEY); } catch {} }
    if (src) setStateFromConfig(parseBuild(src));
    if (fromLink) {                                     // link zużyty — dalej rządzi normalny stan/autozapis
      try { history.replaceState(null, '', location.pathname + location.search); } catch {}
      window.__fromShareLink = true;
    }
  }
  async function shareBuild() {
    const url = location.origin + location.pathname + '#k=' + serializeBuild();
    const data = { title: 'Pixel Sip', text: 'Zobacz mój kubek Pixel Sip 🎮', url };
    try { if (navigator.share) { await navigator.share(data); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
    try { await navigator.clipboard.writeText(url); toast('Skopiowano link do projektu ✓'); }
    catch { window.prompt('Skopiuj link do swojego projektu:', url); }
  }

  function addToCart() {
    const p = state.prodById[state.size]; if (!p) return;
    if (state.base === 'scene' && !state.byId[state.designId]) return;
    if (state.base === 'tile' && !state.tile.emblem) return;
    const hasT = state.strip === 'both' || state.strip === 'top', hasB = state.strip === 'both' || state.strip === 'bot';
    const cfg = {
      gora_tekst: hasT ? state.stripColorTop : '-', gora_tlo: hasT ? state.bandColorTop : '-',
      dol_tekst: hasB ? state.stripColorBot : '-', dol_tlo: hasB ? state.bandColorBot : '-',
      napis: state.stripText ? b64urlEnc(state.stripText) : '',
      psize: state.stripSize,
    };
    const bc = baseConfig();
    const key = `${p.id}__${JSON.stringify(bc)}__${state.strip}__${cfg.gora_tekst}_${cfg.gora_tlo}_${cfg.dol_tekst}_${cfg.dol_tlo}__${cfg.napis}_${cfg.psize}`;
    const ex = cart.find(i => i.key === key);
    if (ex) ex.qty += 1;
    else cart.push({ key, size: p.id, sizeLabel: p.sizeLabel, designName: baseName(), baseCfg: bc, strip: state.strip, cfg, stripDesc: stripDesc(), file: thumbURL(), price: p.retailPrice, qty: 1 });
    saveCart(cart); renderCart(); openCart();
    toast(`Dodano: ${baseName()} · ${p.sizeLabel}`);
  }
  function setQty(key, delta) {
    const it = cart.find(i => i.key === key); if (!it) return;
    it.qty += delta; if (it.qty <= 0) cart = cart.filter(i => i.key !== key);
    saveCart(cart); renderCart();
  }
  function removeItem(key) { cart = cart.filter(i => i.key !== key); saveCart(cart); renderCart(); }
  const cartTotal = () => cart.reduce((s, i) => s + i.price * i.qty, 0);
  const cartCount = () => cart.reduce((s, i) => s + i.qty, 0);

  function renderCart() {
    const wrap = $('#cart-items'); const count = cartCount(); const total = cartTotal();
    $$('.cart-count').forEach(e => { e.textContent = String(count); e.hidden = count === 0; });
    const ct = $('#cart-total'); if (ct) ct.textContent = PLN(total);
    const remain = Math.max(0, state.freeShip - total);
    const fp = $('#free-progress');
    if (fp) {
      fp.style.setProperty('--p', Math.min(1, total / state.freeShip));
      $('#free-msg').innerHTML = remain > 0 ? `Do darmowej dostawy brakuje <b>${PLN(remain)}</b>` : `🎉 Masz <b>darmową dostawę!</b>`;
    }
    if (wrap) {
      wrap.innerHTML = cart.length ? cart.map(i => `
        <li class="cart-item">
          <span class="cart-item__img" style="background-image:url('${esc(i.file)}')"></span>
          <span class="cart-item__info"><b>${esc(i.designName)}</b><span class="muted">${esc(i.sizeLabel)} · ${esc(i.stripDesc || '')}</span><span class="cart-item__price">${PLN(i.price)}</span></span>
          <span class="qty"><button data-q="-1" data-key="${esc(i.key)}" aria-label="zmniejsz ilość">−</button><b>${i.qty}</b><button data-q="1" data-key="${esc(i.key)}" aria-label="zwiększ ilość">+</button></span>
          <button class="cart-item__rm" data-rm="${esc(i.key)}" aria-label="usuń z koszyka">✕</button>
        </li>`).join('') : `<li class="cart-empty">Twój koszyk jest pusty.<br><span class="muted">Czas zdobyć power-up. 🎮</span></li>`;
    }
    const cb = $('#cart-checkout'); if (cb) cb.disabled = cart.length === 0;
  }

  const trapFocus = (root, e) => {
    const f = $$('button,a,input,select,textarea,[tabindex]:not([tabindex="-1"])', root).filter(el => !el.disabled && el.offsetParent !== null);
    if (!f.length) return; const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };
  function openCart() { state.lastFocus = document.activeElement; $('#cart-drawer')?.classList.add('open'); $('#overlay')?.classList.add('show'); document.body.style.overflow = 'hidden'; setTimeout(() => $('#cart-close')?.focus(), 50); }
  function closeCart() { $('#cart-drawer')?.classList.remove('open'); if (!$('#checkout-modal')?.classList.contains('open')) { $('#overlay')?.classList.remove('show'); document.body.style.overflow = ''; } state.lastFocus?.focus?.(); }

  // ——————————————————— CHECKOUT ———————————————————
  function openCheckout() {
    if (!cart.length) return;
    const m = $('#checkout-modal'); if (!m) return;
    $('#checkout-form').hidden = false; $('#co-success').hidden = true;   // reset
    $('#co-summary').innerHTML = cart.map(i => `<li>${i.qty}× <b>${esc(i.designName)}</b> (${esc(i.sizeLabel)}, ${esc(i.stripDesc || '')}) — ${PLN(i.price * i.qty)}</li>`).join('');
    $('#co-total').textContent = PLN(cartTotal());
    const dsel = $('#co-delivery');
    if (dsel) dsel.innerHTML = state.delivery.map((d, idx) => `<option value="${idx}">${esc(d.method)} — ${d.price === 0 ? 'gratis' : PLN(d.price)} (${esc(d.eta)})</option>`).join('');
    updateGrand();
    m.classList.add('open'); $('#overlay')?.classList.add('show'); document.body.style.overflow = 'hidden';
    setTimeout(() => m.querySelector('input,select')?.focus(), 50);
  }
  function updateGrand() {
    const idx = Number($('#co-delivery')?.value || 0); const d = state.delivery[idx] || { price: 0 };
    const g = $('#co-grand'); if (g) g.textContent = PLN(cartTotal() + (d.price || 0));
  }
  function closeCheckout() { $('#checkout-modal')?.classList.remove('open'); if (!$('#cart-drawer')?.classList.contains('open')) { $('#overlay')?.classList.remove('show'); document.body.style.overflow = ''; } }

  async function submitOrder(e) {
    e.preventDefault();
    if (isSubmitting) return; isSubmitting = true;
    const f = e.target;
    const d = state.delivery[Number(f.delivery.value) || 0] || { method: '—', price: 0 };
    const adres = `${f.postal.value} ${f.city.value}, ${f.street.value}`;
    const order = {
      klient: { imie: f.name.value, email: f.email.value, telefon: f.phone.value, adres, uwagi: f.notes.value },
      dostawa: d.method, dostawa_koszt: d.price,
      pozycje: cart.map(i => `${i.qty}× ${i.designName} (${i.sizeLabel}, ${i.stripDesc || ''}) = ${(i.price * i.qty).toFixed(2)} zł\n   [config: ${Object.entries(i.baseCfg).map(([k, v]) => `${k}=${v}`).join(' ')} size=${i.size} strip=${i.strip} gora_tekst=${i.cfg.gora_tekst} gora_tlo=${i.cfg.gora_tlo} dol_tekst=${i.cfg.dol_tekst} dol_tlo=${i.cfg.dol_tlo}${i.cfg.napis ? ' napis=' + i.cfg.napis : ''}${i.cfg.psize && i.cfg.psize !== 1 ? ' psize=' + i.cfg.psize : ''}]`),
      suma_produkty: cartTotal().toFixed(2), suma_calosc: (cartTotal() + (d.price || 0)).toFixed(2),
    };
    const btn = $('#co-submit'); btn.disabled = true; btn.textContent = 'Wysyłanie…';
    const txt = `Zamówienie Pixel Sip\n\n${order.pozycje.join('\n')}\n\nDostawa: ${order.dostawa} (${PLN(order.dostawa_koszt)})\nRAZEM: ${PLN(order.suma_calosc)}\n\nKlient: ${order.klient.imie}\nEmail: ${order.klient.email}\nTel: ${order.klient.telefon}\nAdres: ${order.klient.adres}\nUwagi: ${order.klient.uwagi}`;
    try {
      if (CONFIG.orderEndpoint) {
        const res = await fetch(CONFIG.orderEndpoint, { method: 'POST', headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' }, body: JSON.stringify(order) });
        if (!res.ok) throw new Error('send failed');
      } else {
        try { await navigator.clipboard.writeText(txt); } catch {}
        window.location.href = `mailto:${CONFIG.shopEmail}?subject=${encodeURIComponent('Zamówienie Pixel Sip')}&body=${encodeURIComponent(txt)}`;
      }
      cart = []; saveCart(cart); renderCart();
      $('#checkout-form').hidden = true; $('#co-success').hidden = false;
      const ob = $('#co-order-text'); if (ob) ob.value = txt;
    } catch (err) {
      alert('Nie udało się wysłać automatycznie. Skopiuj treść zamówienia i wyślij na ' + CONFIG.shopEmail);
      $('#checkout-form').hidden = true; $('#co-success').hidden = false;
      const ob = $('#co-order-text'); if (ob) ob.value = txt;
    } finally { btn.disabled = false; btn.textContent = 'Zamawiam i płacę'; isSubmitting = false; }
  }

  // ——————————————————— COOKIES ———————————————————
  function cookieBanner() {
    const b = $('#cookie-banner'); if (!b) return;
    if (localStorage.getItem('pixelsip_cookie')) return;
    b.hidden = false;
    b.querySelector('[data-cookie]')?.addEventListener('click', () => { try { localStorage.setItem('pixelsip_cookie', '1'); } catch {} b.hidden = true; });
  }
  function initHeroCarousel() {
    const slides = $$('.hero__slide'), dots = $$('.hero__dot'), wrap = $('.hero__carousel');
    if (slides.length < 2) return;
    let i = 0, timer = null;
    const hero = $('.hero');
    const go = (n) => { i = (n + slides.length) % slides.length;
      slides.forEach((s, k) => s.classList.toggle('is-active', k === i));
      dots.forEach((d, k) => d.classList.toggle('is-active', k === i));
      if (hero) hero.style.setProperty('--hero-bg', slides[i].style.backgroundImage); };   // tło hero = aktywna scena
    go(0);
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const start = () => { if (reduce) return; clearInterval(timer); timer = setInterval(() => go(i + 1), 4200); };
    const stop = () => clearInterval(timer);
    dots.forEach((d, k) => d.addEventListener('click', () => { go(k); start(); }));
    wrap?.addEventListener('mouseenter', stop);
    wrap?.addEventListener('mouseleave', start);
    start();
  }

  // ——————————————————— UI BINDING ———————————————————
  function bindUI() {
    document.addEventListener('click', (e) => {
      const gnav = e.target.closest('[data-gallery-nav]');
      if (gnav) { scrollGallery(+gnav.dataset.galleryNav); return; }
      const card = e.target.closest('[data-design]');
      if (card) { state.designId = card.dataset.design; renderGallery(); updatePreview(); $('#configurator')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); return; }
      const sz = e.target.closest('[data-size]');
      if (sz) { state.size = sz.dataset.size; renderSizes(); updatePreview(); return; }
      const chip = e.target.closest('[data-cat]');
      if (chip) { state.cat = chip.dataset.cat; $$('[data-cat]').forEach(c => c.classList.toggle('is-active', c === chip)); renderGallery(); return; }
      const strip = e.target.closest('[data-strip]');
      if (strip) { state.strip = strip.dataset.strip; $$('[data-strip]').forEach(s => { const a = s === strip; s.classList.toggle('is-active', a); s.setAttribute('aria-pressed', a); }); applyStripVisibility(); updatePreview(); return; }
      const sw = e.target.closest('[data-pal]');
      if (sw) {
        const pal = sw.dataset.pal, val = sw.dataset.val;
        if (pal === 'tt') state.stripColorTop = val; else if (pal === 'tb') state.bandColorTop = val; else if (pal === 'bt') state.stripColorBot = val; else if (pal === 'bb') state.bandColorBot = val;
        else if (pal === 'g1') state.geo.c1 = val; else if (pal === 'g2') state.geo.c2 = val; else if (pal === 'tg') state.tile.bg = val;
        $$(`[data-pal="${pal}"]`).forEach(s => s.classList.toggle('is-active', s === sw));
        updatePreview(); return;
      }
      const ps = e.target.closest('[data-size-strip]');
      if (ps) { state.stripSize = +ps.dataset.sizeStrip; $$('[data-size-strip]').forEach(s => s.classList.toggle('is-active', s === ps)); updatePreview(); return; }
      const bt = e.target.closest('[data-base]');
      if (bt) { state.base = bt.dataset.base; applyBaseVisibility(); if (state.base === 'scene') updateGalleryNav(); updatePreview(); return; }
      const gp = e.target.closest('[data-geopat]');
      if (gp) { state.geo.pattern = gp.dataset.geopat; $$('[data-geopat]').forEach(s => s.classList.toggle('is-active', s === gp)); updatePreview(); return; }
      const gs = e.target.closest('[data-size-geo]');
      if (gs) { state.geo.n = +gs.dataset.sizeGeo; $$('[data-size-geo]').forEach(s => s.classList.toggle('is-active', s === gs)); updatePreview(); return; }
      const em = e.target.closest('[data-emblem]');
      if (em) { state.tile.emblem = em.dataset.emblem; $$('[data-emblem]').forEach(s => s.classList.toggle('is-active', s === em)); updatePreview(); return; }
      const ec = e.target.closest('[data-embcat]');
      if (ec) { state.embCat = ec.dataset.embcat; renderEmblems(); return; }
      const ts = e.target.closest('[data-size-tile]');
      if (ts) { state.tile.n = +ts.dataset.sizeTile; $$('[data-size-tile]').forEach(s => s.classList.toggle('is-active', s === ts)); updatePreview(); return; }
      if (e.target.closest('#share-build')) { shareBuild(); return; }
      if (e.target.closest('#add-to-cart, #sticky-add')) { addToCart(); return; }
      if (e.target.closest('#cart-toggle, #sticky-cart')) { openCart(); return; }
      if (e.target.closest('#cart-close')) { closeCart(); return; }
      if (e.target.closest('#overlay')) { closeCart(); closeCheckout(); return; }
      const q = e.target.closest('[data-q]'); if (q) { setQty(q.dataset.key, Number(q.dataset.q)); return; }
      const rm = e.target.closest('[data-rm]'); if (rm) { removeItem(rm.dataset.rm); return; }
      if (e.target.closest('#cart-checkout')) { closeCart(); openCheckout(); return; }
      if (e.target.closest('#co-close')) { closeCheckout(); return; }
      const fq = e.target.closest('.faq-q'); if (fq) { const it = fq.parentElement; it.classList.toggle('open'); fq.setAttribute('aria-expanded', it.classList.contains('open')); return; }
      if (e.target.closest('#nav-toggle')) { $('#nav')?.classList.toggle('open'); return; }
      if (e.target.closest('#nav a')) { $('#nav')?.classList.remove('open'); }
    });
    $('#design-search')?.addEventListener('input', (e) => { state.q = e.target.value.toLowerCase().trim(); renderGallery(); });
    $('#design-gallery')?.addEventListener('wheel', (e) => {       // myszka: pionowe kółko -> poziomy scroll karuzeli
      const el = e.currentTarget;
      if (el.scrollWidth <= el.clientWidth + 4) return;
      if (Math.abs(e.deltaX) >= Math.abs(e.deltaY)) return;       // gest już poziomy (touchpad) — zostaw
      el.scrollLeft += e.deltaY; e.preventDefault();
    }, { passive: false });
    $('#design-gallery')?.addEventListener('scroll', updateGalleryNav, { passive: true });
    window.addEventListener('resize', updateGalleryNav, { passive: true });
    $('#strip-text')?.addEventListener('input', (e) => {
      const clean = sanitizeText(e.target.value);
      if (clean !== e.target.value) e.target.value = clean;
      state.stripText = clean; updatePreview();
    });
    $('#checkout-form')?.addEventListener('submit', submitOrder);
    $('#co-delivery')?.addEventListener('change', updateGrand);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { closeCart(); closeCheckout(); }
      if (e.key === 'Tab') { const m = $('#checkout-modal'); const dr = $('#cart-drawer');
        if (m?.classList.contains('open')) trapFocus(m, e); else if (dr?.classList.contains('open')) trapFocus(dr, e); }
    });
    const hdr = $('#site-header');
    addEventListener('scroll', () => hdr?.classList.toggle('scrolled', scrollY > 20), { passive: true });
  }

  // ——————————————————— TOAST ———————————————————
  let toastT;
  function toast(msg) {
    let t = $('#toast'); if (!t) { t = document.createElement('div'); t.id = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
    t.textContent = msg; t.classList.add('show');
    clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2400);
  }

  if (document.readyState !== 'loading') init(); else document.addEventListener('DOMContentLoaded', init);
})();
