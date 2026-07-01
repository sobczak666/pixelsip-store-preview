/* Pixel Sip — silnik sklepu (vanilla JS, bez zależności).
   Dane: data/products.json, data/designs.json. Koszyk: localStorage. */
(() => {
  'use strict';

  // ——— KONFIG (do uzupełnienia przed startem sprzedaży — patrz GO-LIVE.md) ———
  const CONFIG = {
    orderEndpoint: 'https://api.pixelsip.pl/api/orders',   // backend Pixel Sip (OVH Warszawa) — zamówienia wpadają do panelu /admin. Pusty => fallback mailto+kopiuj
    waitlistEndpoint: 'https://api.pixelsip.pl/api/waitlist',  // zapisy na niedostępne rozmiary (np. 900 ml)
    shopEmail: 'kontakt@pixelsip.pl',
    currency: 'zł',
    metaPixelId: '',                   // Meta (FB/IG) Pixel ID — puste => piksel nieaktywny
    tiktokPixelId: '',                 // TikTok Pixel ID — puste => nieaktywny
    inpostGeoToken: 'eyJhbGciOiJSUzI1NiIsInR5cCIgOiAiSldUIiwia2lkIiA6ICJzQlpXVzFNZzVlQnpDYU1XU3JvTlBjRWFveFpXcW9Ua2FuZVB3X291LWxvIn0.eyJleHAiOjIwOTgyMDA4MjgsImlhdCI6MTc4Mjg0MDgyOCwianRpIjoiMmE0ZTgzMzQtNjViNS00MDQyLTkwMDctZDU3NDhiMDQzZjNiIiwiaXNzIjoiaHR0cHM6Ly9sb2dpbi5pbnBvc3QucGwvYXV0aC9yZWFsbXMvZXh0ZXJuYWwiLCJzdWIiOiJmOjEyNDc1MDUxLTFjMDMtNGU1OS1iYTBjLTJiNDU2OTVlZjUzNTpJMWs4bzIyeGNtN29EbWJhUHEyS0JtaDJ5ZU90bXZUUGdjSXRoaXR3eUhnIiwidHlwIjoiQmVhcmVyIiwiYXpwIjoic2hpcHgiLCJzZXNzaW9uX3N0YXRlIjoiZWFmYjMxZDYtYTk5OS00ZTA2LWE1MTQtMTU4YzdiNWQwMGYwIiwic2NvcGUiOiJvcGVuaWQgYXBpOmFwaXBvaW50cyIsInNpZCI6ImVhZmIzMWQ2LWE5OTktNGUwNi1hNTE0LTE1OGM3YjVkMDBmMCIsImFsbG93ZWRfcmVmZXJyZXJzIjoicGl4ZWxzaXAucGwsd3d3LnBpeGVsc2lwLnBsLHNrbGVwLnBpeGVsc2lwLnBsIiwidXVpZCI6ImQ3MDUwZjJhLWQ3NTMtNDg1Zi1hZWRmLWY5ZjdlYjhhMGZjZCJ9.oXOjIkILU2b7sWeI1W1SBQWwtl7CMfSpkmVobkaRXJcAIDIv2tPg43TQWNfgXdeHLEc-D_-tOeNEExpgLd8jImb6Z40NGluFFCtnyAlnzZgtPo5qZtan3vU90j9OJF4eTPlORoclKh3F_pxr4vcWlqrk9kRHIdAERBscXH-VEDYA7pr-4YMsziGE2aNGFEXPRwPjUsvQCLDaGk-mFEGYd80PX5-lFPTPuf8eKiK7OXFDfzYIWFUIUSDeNAIVhmi_4F6CgmSwKI9EVaHt8-j36PiXJ6AdRn8eWEzHitvtt7cne5goaFMCyqgi-71wtwDSsXn-EeD1ZGGDxGAi_k3rXw',   // PUBLIC token Geowidgetu (allowed_referrers: pixelsip.pl,www,sklep)
    inpostGeoSandbox: false,           // true => geowidget z sandboxa InPost
  };

  const PLN = (v) => `${Number(v).toFixed(2).replace('.', ',')} ${CONFIG.currency}`;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));

  const state = {
    products: [], designs: [], byId: {}, prodById: {},
    size: null, designId: null, strip: 'both',
    stripColorTop: 'glitch', bandColorTop: '#000000', stripColorBot: 'glitch', bandColorBot: '#000000',
    stripTextTop: '', stripTextBot: '',  // '' = domyślny „PIXEL SIP"; inaczej własny napis (góra/dół osobno)
    stripSizeTop: 1, stripSizeBot: 1,    // mnożnik wysokości paska/fontu góra/dół osobno
    base: 'scene',
    // ——— stan UI kreatora (zakładki + progressive disclosure); NIE idzie do serializeBuild ———
    tab: 'design',          // 'design' | 'strip' | 'colors' | 'size'
    colorSide: 'top',       // 'top' | 'bot' — którą stronę paska edytuje zakładka Kolory
    colorKind: 'text',      // 'text' | 'bg'
    syncStrip: true,        // dół taki sam jak góra (kolory + rozmiar)
    splitText: false,       // osobny napis na dole
    palExpanded: false,     // pełna paleta („Więcej kolorów")
    editingKey: null,       // klucz pozycji koszyka w trybie edycji (null = dodawanie nowej)
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
  const GLITCH = { id: 'glitch', label: 'Glitch', css: 'linear-gradient(90deg,#22E0E6,#fff,#FF2E97)' };
  const UNIVERSAL = PALETTE.map(c => ({ ...c, group: 'Uniwersalne' }));
  // 8 kolorów marki do „trybu prostego" palety (reszta pod „Więcej kolorów")
  const QUICK_IDS = ['#22E0E6', '#FF2E97', '#9B5DE5', '#C6F542', '#FFFFFF', '#000000', '#FF8A3D', '#0B0A16'];
  const quickSwatches = () => QUICK_IDS.map(id => UNIVERSAL.find(c => c.id === id)).filter(Boolean);
  // kolory wyciągnięte z wybranej sceny + kontrasty (z designs.json)
  function designSwatches() {
    let d = null, grp = 'Z wzoru';
    if (state.base === 'scene') d = state.byId[state.designId];
    else if (state.base === 'tile') { d = state.emblems.find(e => e.id === state.tile.emblem); grp = 'Z emblematu'; }
    if (!d) return [];
    return (d.palette || []).map(h => ({ id: h.toUpperCase(), label: grp, css: h, group: grp }));
  }
  const dedupColors = arr => { const s = new Set(), o = []; for (const c of arr) { const k = String(c.id).toLowerCase(); if (s.has(k)) continue; s.add(k); o.push(c); } return o; };
  const stripColors = () => dedupColors([GLITCH, ...designSwatches(), ...UNIVERSAL]);
  const bandColors = () => dedupColors([...designSwatches(), ...UNIVERSAL]);
  // ——— gradienty (format „grad:HEX:HEX" bez #) ———
  const isGrad = v => typeof v === 'string' && v.startsWith('grad:');
  const gradHexes = v => v.split(':').slice(1, 3).map(h => '#' + h);                 // -> ['#..','#..']
  const gradCss = v => { const [a, b] = gradHexes(v); return `linear-gradient(90deg,${a},${b})`; };
  const mkGrad = (a, b) => `grad:${String(a).replace('#', '').toUpperCase()}:${String(b).replace('#', '').toUpperCase()}`;
  const canvasFill = (ctx, value, x0, x1) => {                                        // kolor lub poziomy gradient na canvasie
    if (!isGrad(value)) return value;
    const [a, b] = gradHexes(value); const g = ctx.createLinearGradient(x0, 0, x1, 0);
    g.addColorStop(0, a); g.addColorStop(1, b); return g;
  };
  const GRADIENTS = [
    { id: 'grad:22E0E6:FF2E97', label: 'Cyan → Magenta' },
    { id: 'grad:7C3BFF:22E0E6', label: 'Indygo → Cyan' },
    { id: 'grad:FF8A3D:FF2E97', label: 'Sunset' },
    { id: 'grad:5DF7A0:3BA7FF', label: 'Mięta → Błękit' },
    { id: 'grad:C04BFF:FF5D8F', label: 'Vapor' },
    { id: 'grad:FFD23F:FF6B35', label: 'Bursztyn → Ceglasty' },
  ].map(g => ({ ...g, css: gradCss(g.id), group: 'Gradienty' }));
  const colorLabel = (id) => id === 'glitch' ? 'Glitch' : (UNIVERSAL.find(c => c.id === id)?.label || id);
  const bandLabel = (id) => UNIVERSAL.find(c => c.id === id)?.label || id;
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
      const _dv = '?v=' + (window.__DV || '');   // cache-busting danych (ustawiane w index.html)
      const [p, d, em] = await Promise.all([
        fetch('data/products.json' + _dv).then(r => r.json()),
        fetch('data/designs.json' + _dv).then(r => r.json()),
        fetch('data/emblems.json' + _dv).then(r => r.json()).catch(() => []),
      ]);
      state.emblems = em || [];
      state.products = p.products || [];
      state.freeShip = p.freeShippingThreshold ?? 199;
      state.delivery = p.delivery || [];
      state.bundles = p.bundles || [];
      state.designs = d || [];
      state.prodById = Object.fromEntries(state.products.map(x => [x.id, x]));
      state.byId = Object.fromEntries(state.designs.map(x => [x.id, x]));
      state.size = (state.products.find(p => !p.waitlist) || state.products[0])?.id || null;
      state.designId = state.designs[0]?.id || null;
    } catch (e) { console.error('Błąd ładowania danych', e); const g = $('#design-gallery'); if (g) g.innerHTML = '<p class="muted">Nie udało się załadować wzorów. Odśwież stronę.</p>'; return; }

    restoreBuild();                       // link #k=... albo autozapis -> ustawia state przed renderem
    deriveStripModes();                   // dół=góra / osobny-napis z wczytanego stanu
    renderGallery(); renderSizes(); renderPresets(); renderPalettes(); applyStripVisibility();
    renderGeoControls(); renderEmblems(); applyBaseVisibility(); applyTabVisibility();
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
    wrap.innerHTML = state.products.map(p => p.waitlist ? `
      <button class="size-opt size-opt--soon" data-waitlist="${esc(p.id)}" title="${esc(p.waitlistNote || 'Wkrótce')}">
        <span class="size-opt__cap">${esc(p.sizeLabel)}</span>
        <span class="size-opt__soon">Wkrótce · zapisz się</span>
      </button>` : `
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
  function renderPalette(id, colors, current, pal, lbl, mode = 'full') {
    const w = $('#' + id); if (!w) return;
    if (mode === 'quick') {                                   // tryb prosty: glitch (napis) + PALETA Z KUBKA (wzór/emblemat) + „Więcej"
      const isText = ['tt', 'bt'].includes(pal);
      const fromMug = colors.filter(c => c.group === 'Z wzoru' || c.group === 'Z emblematu');
      const base = fromMug.length ? fromMug : quickSwatches();   // fallback: kolory marki, gdy wzór nie ma palety
      const list = isText ? [GLITCH, ...base] : base;
      const eq = (a, b) => String(a).toLowerCase() === String(b).toLowerCase();
      let h = list.map(c => `<button class="swatch${eq(c.id, current) ? ' is-active' : ''}" data-pal="${pal}" data-val="${esc(c.id)}" title="${esc(c.label)}" aria-label="${esc(lbl)}: ${esc(c.label)}" style="background:${c.css}"></button>`).join('');
      h += `<button class="swatch swatch--more" data-morecolors="1" title="Więcej kolorów" aria-label="Więcej kolorów">⋯</button>`;
      w.innerHTML = h; return;
    }
    let html = '', lastGroup = null;
    for (const c of colors) {
      const grp = c.group || '';
      if (grp !== lastGroup) { lastGroup = grp; if (grp) html += `<span class="swatch-group">${esc(grp)}</span>`; }
      html += `<button class="swatch${c.id === current ? ' is-active' : ''}" data-pal="${pal}" data-val="${esc(c.id)}" title="${esc(c.label)}" aria-label="${esc(lbl)}: ${esc(c.label)}" style="background:${c.css}"></button>`;
    }
    // własny kolor (tryb zaawansowany) — dowolny hex spoza palety
    const isHex = /^#[0-9a-f]{6}$/i.test(current || '');
    const customActive = isHex && !colors.some(c => String(c.id).toLowerCase() === String(current).toLowerCase());
    html += `<span class="swatch-group">Własny</span>`;
    html += `<label class="swatch swatch--custom${customActive ? ' is-active' : ''}" title="Wybierz własny kolor"><input type="color" data-palcustom="${pal}" value="${isHex ? current : '#22E0E6'}" aria-label="${esc(lbl)}: własny kolor"></label>`;
    // gradienty (tylko paski: napis + tło) — presety + własny (2 kolory)
    if (['tt', 'tb', 'bt', 'bb'].includes(pal)) {
      const isG = isGrad(current);
      const [gc1, gc2] = isG ? gradHexes(current) : ['#22E0E6', '#FF2E97'];
      html += `<span class="swatch-group">Gradienty</span>`;
      for (const g of GRADIENTS) html += `<button class="swatch swatch--grad${g.id === current ? ' is-active' : ''}" data-pal="${pal}" data-val="${g.id}" title="${esc(g.label)}" aria-label="${esc(lbl)}: ${esc(g.label)}" style="background:${g.css}"></button>`;
      const customGradActive = isG && !GRADIENTS.some(g => g.id === current);
      html += `<span class="swatch-group">Własny gradient</span>`;
      html += `<label class="swatch swatch--custom" title="Kolor początkowy gradientu"><input type="color" data-gradpart="${pal}:0" value="${gc1}"></label>`;
      html += `<label class="swatch swatch--custom" title="Kolor końcowy gradientu"><input type="color" data-gradpart="${pal}:1" value="${gc2}"></label>`;
      html += `<button class="swatch swatch--grad${customGradActive ? ' is-active' : ''}" data-pal="${pal}" data-val="${mkGrad(gc1, gc2)}" title="Zastosuj własny gradient" style="background:linear-gradient(90deg,${gc1},${gc2})"></button>`;
    }
    w.innerHTML = html;
  }
  function setPalColor(pal, val) {
    if (pal === 'tt') { state.stripColorTop = val; if (state.syncStrip) state.stripColorBot = val; }
    else if (pal === 'tb') { state.bandColorTop = val; if (state.syncStrip) state.bandColorBot = val; }
    else if (pal === 'bt') state.stripColorBot = val; else if (pal === 'bb') state.bandColorBot = val;
    else if (pal === 'g1') state.geo.c1 = val; else if (pal === 'g2') state.geo.c2 = val; else if (pal === 'tg') state.tile.bg = val;
  }
  function renderSizeBtns(id, sizes, current, kind) {
    const w = $('#' + id); if (!w) return;
    w.innerHTML = sizes.map(s => `<button class="strip-opt${s.n === current ? ' is-active' : ''}" data-size-${kind}="${s.n}">${esc(s.label)}</button>`).join('');
  }
  function renderPalettes() {
    renderActivePalette();                                              // jedna aktywna paleta (zakładka Kolory)
    renderPalette('tile-bg', bandColors(), state.tile.bg, 'tg', 'Kolor tła');   // tło kafelka emblematu (zakładka Wzór)
  }
  // ——— zakładka KOLORY: jedna paleta dla wybranej strony+celu (tt/tb/bt/bb) ———
  function activePal() {
    return state.colorSide === 'top' ? (state.colorKind === 'text' ? 'tt' : 'tb')
                                     : (state.colorKind === 'text' ? 'bt' : 'bb');
  }
  function activeColor() {
    const p = activePal();
    return p === 'tt' ? state.stripColorTop : p === 'tb' ? state.bandColorTop
         : p === 'bt' ? state.stripColorBot : state.bandColorBot;
  }
  const isSplit = () => state.splitText && state.strip === 'both';   // osobny dół (napis + rozmiar) — tylko gdy oba paski
  function renderActivePalette() {
    const pal = activePal(), isText = state.colorKind === 'text';
    const colors = isText ? stripColors() : bandColors();
    renderPalette('active-palette', colors, activeColor(), pal, isText ? 'Napis' : 'Tło', state.palExpanded ? 'full' : 'quick');
    const more = $('#toggle-more-colors'); if (more) more.textContent = state.palExpanded ? 'Mniej kolorów ⌃' : 'Więcej kolorów ⌄';
    $$('[data-colside]').forEach(b => b.classList.toggle('is-active', b.dataset.colside === state.colorSide));
    $$('[data-colkind]').forEach(b => b.classList.toggle('is-active', b.dataset.colkind === state.colorKind));
  }
  function applyColorsVisibility() {
    const none = state.strip === 'none';
    if (state.strip === 'top') state.colorSide = 'top';
    else if (state.strip === 'bot') state.colorSide = 'bot';
    $('#colors-none')?.classList.toggle('off', !none);
    $('#colors-panel')?.classList.toggle('off', none);   // palety od razu widoczne; tylko „bez paska" je chowa
    const showSide = state.strip === 'both' && !state.syncStrip;        // wybór strony tylko gdy góra+dół i bez synchronizacji
    $('#color-side')?.classList.toggle('off', !showSide);
    const ts = $('#toggle-sync');
    if (ts) { ts.classList.toggle('off', state.strip !== 'both'); ts.classList.toggle('is-active', state.syncStrip); ts.setAttribute('aria-pressed', state.syncStrip); }
  }
  function renderColorsSummary() {
    const el = $('#colors-summary'); if (!el) return;
    if (state.strip === 'none') { el.textContent = 'wyłączony'; return; }
    const side = (t, b) => `${colorLabel(t)} na ${bandLabel(b)}`;
    let s = state.strip === 'bot' ? side(state.stripColorBot, state.bandColorBot) : side(state.stripColorTop, state.bandColorTop);
    if (state.strip === 'both' && !state.syncStrip) s += ' · dół osobno';
    el.textContent = s;
  }
  function applyStripVisibility() {
    const tiT = $('#strip-text-top'); if (tiT && tiT.value !== state.stripTextTop) tiT.value = state.stripTextTop;
    const tiB = $('#strip-text-bot'); if (tiB && tiB.value !== state.stripTextBot) tiB.value = state.stripTextBot;
    renderSizeBtns('strip-sizes-top', STRIP_SIZES, state.stripSizeTop, 'striptop');
    renderSizeBtns('strip-sizes-bot', STRIP_SIZES, state.stripSizeBot, 'stripbot');
    $$('[data-strip]').forEach(s => { const a = s.dataset.strip === state.strip; s.classList.toggle('is-active', a); s.setAttribute('aria-pressed', a); });
    const splittable = state.strip === 'both', split = splittable && state.splitText;
    const tsx = $('#toggle-split-text');
    if (tsx) { tsx.classList.toggle('off', !splittable); tsx.classList.toggle('is-active', split); tsx.setAttribute('aria-pressed', split); }
    $('#strip-bot-block')?.classList.toggle('off', !split);
    $('#strip-top-header')?.classList.toggle('off', !split);
    $('#strip-text-fields')?.classList.toggle('off', state.strip === 'none');
    applyColorsVisibility();
    renderActivePalette();
  }
  // ——— zakładki kreatora ———
  const TAB_ORDER = ['design', 'strip', 'colors', 'size'];
  const NEXT_LBL = { design: 'Dalej: Napis →', strip: 'Dalej: Kolory →', colors: 'Dalej: Rozmiar →' };
  function applyTabVisibility() {
    $$('[data-tabpanel]').forEach(p => p.classList.toggle('is-active', p.dataset.tabpanel === state.tab));
    $$('[data-tab]').forEach(t => { const a = t.dataset.tab === state.tab; t.classList.toggle('is-active', a); t.setAttribute('aria-selected', a); });
    const last = state.tab === 'size';
    $('#sticky-next')?.classList.toggle('off', last);
    $('#sticky-add')?.classList.toggle('off', !last);
    const nx = $('#sticky-next'); if (nx) nx.textContent = NEXT_LBL[state.tab] || 'Dalej →';
  }
  function goTab(tab) { state.tab = tab; applyTabVisibility(); }
  function renderBuildSummary() {
    const el = $('#build-summary'); if (!el) return;
    const p = state.prodById[state.size];
    el.innerHTML = `<b>${esc(baseName())}</b> · ${esc(STRIP_LABEL[state.strip] || '')} · ${esc(p ? p.sizeLabel : '')}`;
  }
  // dół=góra i osobny-napis wynikają ze stanu (np. po wczytaniu share-linku z różną górą/dołem)
  function deriveStripModes() {
    state.syncStrip = state.stripColorTop === state.stripColorBot && state.bandColorTop === state.bandColorBot;
    state.splitText = state.stripTextTop !== state.stripTextBot || state.stripSizeTop !== state.stripSizeBot;
  }
  // ——— presety + losuj (oba przez applyConfig — jedno źródło prawdy) ———
  function defaultSizeId() { return (state.products.find(p => !p.waitlist) || state.products[0])?.id || null; }
  function presetList() {
    const ds = state.designs; if (!ds.length) return [];
    const at = f => ds[Math.min(ds.length - 1, Math.max(0, Math.round(f)))].id;
    const combos = [
      { label: 'Twój start', start: true },
      { label: 'Neon', gt: 'glitch', gb: '#0B0A16', n: 1, design: at(ds.length * 0.12) },
      { label: 'Vapor', gt: '#FFFFFF', gb: '#7C3BFF', n: 1, design: at(ds.length * 0.25) },
      { label: 'Mono', gt: '#FFFFFF', gb: '#000000', n: 0.8, design: at(ds.length * 0.45) },
      { label: 'Sunset', gt: '#0B0A16', gb: '#FF8A3D', n: 1.25, design: at(ds.length * 0.65) },
      { label: 'Mięta', gt: '#0B0A16', gb: '#5DF7A0', n: 1, design: at(ds.length * 0.85) },
    ];
    return combos;
  }
  function renderPresets() {
    const w = $('#presets'); if (!w) return;
    const isStartActive = state.base === 'scene' && state.designId === (state.designs[0]?.id);
    w.innerHTML = presetList().map((p, i) => `
      <button class="preset${p.start && isStartActive ? ' is-active' : ''}" data-preset="${i}" type="button">
        ${p.start ? '<span class="preset__star">★ start</span>' : ''}${esc(p.label)}
      </button>`).join('');
  }
  function applyPreset(i) {
    const p = presetList()[i]; if (!p) return;
    if (p.start) {
      applyConfig({ base: 'scene', design: state.designs[0]?.id, size: defaultSizeId(), strip: 'both',
        gt: 'glitch', gb: '#000000', dt: 'glitch', db: '#000000', txt: '', txb: '', pst: 1, psb: 1 });
      toast('Wczytano zestaw startowy ✨');
    } else {
      applyConfig({ base: 'scene', design: p.design, strip: 'both',
        gt: p.gt, gb: p.gb, dt: p.gt, db: p.gb, pst: p.n, psb: p.n });
      toast(`Zestaw: ${p.label} ✨`);
    }
  }
  function randomBuild() {
    const ds = state.designs; if (!ds.length) return;
    const rnd = a => a[Math.floor(Math.random() * a.length)];
    const rndText = () => Math.random() < 0.4 ? 'glitch' : rnd(['#FFFFFF', '#FFD23F', '#22E0E6', '#FF2E97', '#5DF7A0', '#C6F542', '#FF8A3D']);
    const strip = rnd(['both', 'both', 'both', 'top', 'bot']);   // najczęściej oba, czasem jeden
    applyConfig({
      base: 'scene', design: rnd(ds).id, strip,
      gt: rndText(), gb: rnd(PALETTE).id, pst: rnd(STRIP_SIZES).n,   // góra i dół losowane NIEZALEŻNIE
      dt: rndText(), db: rnd(PALETTE).id, psb: rnd(STRIP_SIZES).n,
    });
    toast('Wylosowano świeży setup ✨');
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
    renderPalette('tile-bg', bandColors(), state.tile.bg, 'tg', 'Kolor tła');
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
    } else if (isGrad(color)) {
      x.fillStyle = canvasFill(x, color, bx, bx + tw); x.fillText(text, bx, by);
    } else { x.fillStyle = color; x.fillText(text, bx, by); }
    stripCache[key] = c; return c;
  }
  function stripFor(text, textColor) {                      // zawsze font: domyślnie „PIXEL SIP", albo własny napis
    return renderCustomStrip(text || 'PIXEL SIP', textColor);
  }
  async function buildTexture() {
    const seq = ++texSeq;
    await ensureFont();
    let baseImg = null;
    if (state.base === 'scene') { const d = state.byId[state.designId]; if (!d) return; baseImg = await loadImg(d.file); }
    else if (state.base === 'tile') { if (!state.tile.emblem) return; baseImg = await loadImg('assets/emblems/' + state.tile.emblem + '.png'); }
    if (seq !== texSeq) return;
    if ((state.base === 'scene' || state.base === 'tile') && !baseImg) return;
    const TW = TEX.width, TH = TEX.height;
    const BAND_T = Math.round(TH * 0.135 * state.stripSizeTop);   // wysokość paska góra
    const BAND_B = Math.round(TH * 0.135 * state.stripSizeBot);   // wysokość paska dół
    const top = state.strip === 'both' || state.strip === 'top';
    const bot = state.strip === 'both' || state.strip === 'bot';
    tctx.imageSmoothingEnabled = false;
    tctx.fillStyle = '#000'; tctx.fillRect(0, 0, TW, TH);
    const sy0 = top ? BAND_T : 0, sy1 = bot ? TH - BAND_B : TH;
    drawBase(0, sy0, TW, sy1 - sy0, baseImg);
    const mg = Math.round(TW * 0.05);
    const shRef = Math.round(Math.round(TH * 0.135) * 0.58);   // sh przy rozmiarze paska = 1 (referencja, identyczna jak w printgen.py)
    const band = (by, BAND, text, textColor, bandColorHex) => {
      const sh = Math.round(BAND * 0.58);
      tctx.fillStyle = canvasFill(tctx, bandColorHex, 0, TW); tctx.fillRect(0, by, TW, BAND);
      const strip = stripFor(text, textColor);
      const ratio = strip.width / strip.height;
      // liczba kopii zależy TYLKO od długości napisu (rozmiar referencyjny), NIE od bieżącego rozmiaru paska
      const twoCopies = (2 * Math.round(shRef * ratio) + 2 * mg + 24) <= TW;
      tctx.imageSmoothingEnabled = false;
      if (twoCopies) {                                  // krótki napis (np. PIXEL SIP) -> zawsze dwie kopie
        let bw = Math.round(sh * ratio), ch = sh;
        const maxBw = Math.floor((TW - 2 * mg - 24) / 2);   // duży pasek: przytnij, by 2 kopie wciąż się mieściły
        if (bw > maxBw) { bw = maxBw; ch = Math.round(bw / ratio); }
        const yy = by + (BAND - ch) / 2;
        tctx.drawImage(strip, mg, yy, bw, ch); tctx.drawImage(strip, TW - mg - bw, yy, bw, ch);
      } else {                                          // dłuższy napis -> zawsze jedna kopia wyśrodkowana
        let cw = Math.round(sh * ratio), ch = sh; const maxw = TW - 2 * mg;
        if (cw > maxw) { cw = maxw; ch = Math.round(strip.height * cw / strip.width); }
        tctx.drawImage(strip, (TW - cw) / 2, by + (BAND - ch) / 2, cw, ch);
      }
    };
    if (top) band(0, BAND_T, state.stripTextTop, state.stripColorTop, state.bandColorTop);
    if (bot) band(TH - BAND_B, BAND_B, state.stripTextBot, state.stripColorBot, state.bandColorBot);
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
    renderColorsSummary(); renderBuildSummary(); refreshCta();
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
    if (cfg.gt === 'glitch' || isHex(cfg.gt) || isGrad(cfg.gt)) state.stripColorTop = cfg.gt;
    if (isHex(cfg.gb) || isGrad(cfg.gb)) state.bandColorTop = cfg.gb;
    if (cfg.dt === 'glitch' || isHex(cfg.dt) || isGrad(cfg.dt)) state.stripColorBot = cfg.dt;
    if (isHex(cfg.db) || isGrad(cfg.db)) state.bandColorBot = cfg.db;
    if (cfg.txt !== undefined) state.stripTextTop = cfg.txt ? sanitizeText(b64urlDec(cfg.txt)) : '';
    if (cfg.txb !== undefined) state.stripTextBot = cfg.txb ? sanitizeText(b64urlDec(cfg.txb)) : '';
    const pst = parseFloat(cfg.pst); if (STRIP_SIZES.some(s => s.n === pst)) state.stripSizeTop = pst;
    const psb = parseFloat(cfg.psb); if (STRIP_SIZES.some(s => s.n === psb)) state.stripSizeBot = psb;
  }
  function applyConfig(cfg) {                          // mutacja + pełny re-render kreatora (dla linków/presetów w locie)
    setStateFromConfig(cfg);
    deriveStripModes();
    renderGallery(); renderSizes(); renderGeoControls(); renderEmblems(); renderPresets();
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
    add('txt', state.stripTextTop ? b64urlEnc(state.stripTextTop) : '');
    add('txb', state.stripTextBot ? b64urlEnc(state.stripTextBot) : '');
    if (state.stripSizeTop !== 1) add('pst', state.stripSizeTop);
    if (state.stripSizeBot !== 1) add('psb', state.stripSizeBot);
    return p.join('~');
  }
  function parseBuild(str) {                            // token -> cfg (z przywróconym '#')
    const d = {}; String(str).split('~').forEach(t => { const i = t.indexOf('.'); if (i > 0) d[t.slice(0, i)] = t.slice(i + 1); });
    return {
      base: d.base, design: d.design, wzor: d.wzor, c1: addHashCol(d.c1), c2: addHashCol(d.c2),
      emb: d.emb, bg: addHashCol(d.bg), gn: d.gn, tn: d.tn, size: d.size, strip: d.strip,
      gt: d.gt === 'glitch' ? 'glitch' : addHashCol(d.gt), gb: addHashCol(d.gb),
      dt: d.dt === 'glitch' ? 'glitch' : addHashCol(d.dt), db: addHashCol(d.db),
      txt: d.txt, txb: d.txb, pst: d.pst, psb: d.psb,    // FIX: wcześniej gubione (dolny napis + rozmiary obu pasków)
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
      napis_top: state.stripTextTop ? b64urlEnc(state.stripTextTop) : '',
      napis_bot: state.stripTextBot ? b64urlEnc(state.stripTextBot) : '',
      psize_top: state.stripSizeTop,
      psize_bot: state.stripSizeBot,
    };
    const bc = baseConfig();
    const key = `${p.id}__${JSON.stringify(bc)}__${state.strip}__${cfg.gora_tekst}_${cfg.gora_tlo}_${cfg.dol_tekst}_${cfg.dol_tlo}__${cfg.napis_top}_${cfg.napis_bot}_${cfg.psize_top}_${cfg.psize_bot}`;
    const editingKey = state.editingKey;
    let addQty = 1;
    if (editingKey) {                                    // tryb edycji: usuń starą pozycję, zachowaj ilość
      const old = cart.find(i => i.key === editingKey);
      if (old) addQty = old.qty;
      cart = cart.filter(i => i.key !== editingKey);
      setEditing(null);
    }
    const ex = cart.find(i => i.key === key);
    if (ex) ex.qty += addQty;
    else cart.push({ key, size: p.id, sizeLabel: p.sizeLabel, designName: baseName(), baseCfg: bc, strip: state.strip, cfg, stripDesc: stripDesc(), file: thumbURL(), build: serializeBuild(), price: p.retailPrice, qty: addQty });
    saveCart(cart); renderCart(); openCart();
    track('AddToCart', { content_ids: [baseName()], content_type: 'product', value: p.retailPrice, currency: 'PLN' });
    toast(editingKey ? 'Zapisano zmiany w koszyku ✓' : `Dodano: ${baseName()} · ${p.sizeLabel}`);
  }
  // ——— edycja pozycji koszyka: wczytaj projekt z powrotem do kreatora ———
  function cartItemCfg(it) {                             // stare pozycje bez tokenu builda -> odtwórz cfg z pól
    const b = it.baseCfg || {}, c = it.cfg || {};
    return { base: b.base, design: b.design, wzor: b.wzor, c1: b.c1, c2: b.c2, gn: b.n,
      emb: b.emblemat, bg: b.tlo, tn: b.n, size: it.size, strip: it.strip,
      gt: c.gora_tekst, gb: c.gora_tlo, dt: c.dol_tekst, db: c.dol_tlo,
      txt: c.napis_top, txb: c.napis_bot, pst: c.psize_top, psb: c.psize_bot };
  }
  function editCartItem(key) {
    const it = cart.find(i => i.key === key); if (!it) return;
    applyConfig(it.build ? parseBuild(it.build) : cartItemCfg(it));   // 1:1 z tokenu, fallback z pól
    setEditing(key);
    goTab('design');
    closeCart();
    $('#configurator')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    toast('Edytujesz kubek — zmień, co chcesz, i zapisz ✏️');
  }
  function setEditing(key) {
    state.editingKey = key;
    $('#edit-banner')?.classList.toggle('off', !key);
    refreshCta();
  }
  function refreshCta() {                                // etykieta CTA: „Dodaj…" vs „Zapisz zmiany…"
    const p = state.prodById[state.size]; if (!p) return;
    const verb = state.editingKey ? 'Zapisz zmiany' : 'Dodaj do koszyka';
    const txt = `${verb} · ${PLN(p.retailPrice)} 🛒`;
    ['#preview-add', '#sticky-add', '#add-to-cart'].forEach(s => { const el = $(s); if (el) el.textContent = txt; });
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
          <span class="cart-item__info"><b>${esc(i.designName)}</b><span class="muted">${esc(i.sizeLabel)} · ${esc(i.stripDesc || '')}</span><span class="cart-item__price">${PLN(i.price)}</span><button class="cart-item__edit" data-edit="${esc(i.key)}" type="button">✏️ Edytuj projekt</button></span>
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
    track('InitiateCheckout', { value: cartTotal(), currency: 'PLN', num_items: cart.reduce((s, i) => s + i.qty, 0), content_ids: cart.map(i => i.designName) });
    $('#checkout-form').hidden = false; $('#co-success').hidden = true;   // reset
    $('#co-summary').innerHTML = cart.map(i => `<li>${i.qty}× <b>${esc(i.designName)}</b> (${esc(i.sizeLabel)}, ${esc(i.stripDesc || '')}) — ${PLN(i.price * i.qty)}</li>`).join('');
    $('#co-total').textContent = PLN(cartTotal());
    const dsel = $('#co-delivery');
    if (dsel) dsel.innerHTML = state.delivery.map((d, idx) => `<option value="${idx}">${esc(d.method)} — ${d.price === 0 ? 'gratis' : PLN(d.price)} (${esc(d.eta)})</option>`).join('');
    updateGrand(); toggleLockerPicker();
    m.classList.add('open'); $('#overlay')?.classList.add('show'); document.body.style.overflow = 'hidden';
    setTimeout(() => m.querySelector('input,select')?.focus(), 50);
  }
  function updateGrand() {
    const idx = Number($('#co-delivery')?.value || 0); const d = state.delivery[idx] || { price: 0 };
    const g = $('#co-grand'); if (g) g.textContent = PLN(cartTotal() + (d.price || 0));
  }
  function closeCheckout() { $('#checkout-modal')?.classList.remove('open'); if (!$('#cart-drawer')?.classList.contains('open')) { $('#overlay')?.classList.remove('show'); document.body.style.overflow = ''; } }

  // ——————————————————— INPOST GEOWIDGET (wybór paczkomatu) ———————————————————
  let geoLoaded = false;
  function deliveryIsLocker() {
    const d = state.delivery[Number($('#co-delivery')?.value || 0)];
    return !!(d && /paczkomat/i.test(d.method));
  }
  function toggleLockerPicker() {
    const box = $('#co-locker'); if (!box) return;
    const show = deliveryIsLocker();
    box.hidden = !show;
    if (!show) {                          // zmiana na nie-paczkomat => kasuj wybór
      const tp = $('#co-target-point'); if (tp) tp.value = '';
      const ch = $('#co-locker-chosen'); if (ch) ch.hidden = true;
    }
  }
  function loadGeo() {
    if (geoLoaded) return Promise.resolve();
    const base = CONFIG.inpostGeoSandbox ? 'https://sandbox-easy-geowidget-sdk.easypack24.net' : 'https://geowidget.inpost.pl';
    const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = base + '/inpost-geowidget.css'; document.head.appendChild(css);
    return new Promise((res) => {
      const s = document.createElement('script'); s.src = base + '/inpost-geowidget.js'; s.defer = true;
      s.onload = () => { geoLoaded = true; res(); }; s.onerror = () => res();
      document.head.appendChild(s);
    });
  }
  // mobile: dopasuj wysokość okna widżetu do WIDOCZNEGO obszaru (gdy wyskoczy klawiatura) — inaczej lista paczkomatów chowa się pod klawiaturą
  function fitGeoToViewport() {
    const modal = $('#geo-modal'), box = modal && modal.querySelector('.geo-box');
    if (!box) return;
    const vv = window.visualViewport, mobile = window.matchMedia('(max-width:640px)').matches;
    box.style.height = (mobile && !modal.hidden && vv) ? Math.round(vv.height) + 'px' : '';
  }
  window.visualViewport?.addEventListener('resize', fitGeoToViewport);
  window.visualViewport?.addEventListener('scroll', fitGeoToViewport);
  async function openGeoModal() {
    if (!CONFIG.inpostGeoToken) { toast('Wybór paczkomatu chwilowo niedostępny'); return; }
    const modal = $('#geo-modal'), mount = $('#geo-mount'); if (!modal || !mount) return;
    modal.hidden = false; document.body.style.overflow = 'hidden'; fitGeoToViewport();
    await loadGeo();
    mount.innerHTML = '';
    const w = document.createElement('inpost-geowidget');
    w.setAttribute('token', CONFIG.inpostGeoToken);
    w.setAttribute('language', 'pl');
    w.setAttribute('config', 'parcelCollect');
    w.setAttribute('onpoint', 'pixelsipOnPoint');   // globalny callback poniżej
    mount.appendChild(w);
  }
  function closeGeoModal() {
    const modal = $('#geo-modal');
    if (modal) { modal.hidden = true; const box = modal.querySelector('.geo-box'); if (box) box.style.height = ''; }
    document.body.style.overflow = $('#checkout-modal')?.classList.contains('open') ? 'hidden' : '';
  }
  function applyPoint(point) {
    const p = point || {}, code = p.name || '';
    if (!code) return;
    const tp = $('#co-target-point'); if (tp) tp.value = code;
    const ch = $('#co-locker-chosen');
    if (ch) { ch.textContent = '✅ Paczkomat: ' + code + (p.address && p.address.line1 ? ' — ' + p.address.line1 : ''); ch.hidden = false; }
    closeGeoModal();
  }
  window.pixelsipOnPoint = applyPoint;                                   // wskazany w atrybucie onpoint
  document.addEventListener('onpointselect', (e) => applyPoint((e.detail || e.details)));  // fallback (event)

  async function submitOrder(e) {
    e.preventDefault();
    if (isSubmitting) return; isSubmitting = true;
    const f = e.target;
    const d = state.delivery[Number(f.delivery.value) || 0] || { method: '—', price: 0 };
    const targetPoint = f.target_point ? f.target_point.value : '';
    if (/paczkomat/i.test(d.method) && !targetPoint) {                   // paczkomat bez wyboru -> blokuj
      isSubmitting = false; toast('Najpierw wybierz paczkomat'); $('#co-locker-btn')?.focus(); return;
    }
    const adres = `${f.postal.value} ${f.city.value}, ${f.street.value}`;
    // jeden ciąg configu na pozycję — używany i w mailu, i przez backend do odtworzenia pliku do druku
    const cfgStr = i => `${Object.entries(i.baseCfg).map(([k, v]) => `${k}=${v}`).join(' ')} size=${i.size} strip=${i.strip} gora_tekst=${i.cfg.gora_tekst} gora_tlo=${i.cfg.gora_tlo} dol_tekst=${i.cfg.dol_tekst} dol_tlo=${i.cfg.dol_tlo}${i.cfg.napis_top ? ' napis_top=' + i.cfg.napis_top : ''}${i.cfg.napis_bot ? ' napis_bot=' + i.cfg.napis_bot : ''}${i.cfg.psize_top && i.cfg.psize_top !== 1 ? ' psize_top=' + i.cfg.psize_top : ''}${i.cfg.psize_bot && i.cfg.psize_bot !== 1 ? ' psize_bot=' + i.cfg.psize_bot : ''}`;
    const order = {
      klient: { imie: f.name.value, email: f.email.value, telefon: f.phone.value, adres, uwagi: f.notes.value },
      dostawa: d.method, dostawa_koszt: d.price,
      pozycje: cart.map(i => `${i.qty}× ${i.designName} (${i.sizeLabel}, ${i.stripDesc || ''}) = ${(i.price * i.qty).toFixed(2)} zł\n   [config: ${cfgStr(i)}]`),
      suma_produkty: cartTotal().toFixed(2), suma_calosc: (cartTotal() + (d.price || 0)).toFixed(2),
      // pola, które czyta backend Pixel Sip (panel + druk); generyczne endpointy je zignorują
      name: f.name.value, email: f.email.value, phone: f.phone.value, address: adres, notes: f.notes.value,
      currency: 'zł', total: Number((cartTotal() + (d.price || 0)).toFixed(2)),
      fbp: getCookie('_fbp'), fbc: getCookie('_fbc'),   // do Meta CAPI (lepsze dopasowanie)
      delivery: d.method, delivery_price: d.price, target_point: targetPoint,   // kod paczkomatu InPost
      items: cart.map(i => ({ title: i.designName, size: i.size, qty: i.qty, price: i.price, config: cfgStr(i) })),
      zgody: { regulamin: !!f.terms?.checked, personalizacja: !!f.personalizacja?.checked },
    };
    const btn = $('#co-submit'); btn.disabled = true; btn.textContent = 'Wysyłanie…';
    const txt = `Zamówienie Pixel Sip\n\n${order.pozycje.join('\n')}\n\nDostawa: ${order.dostawa} (${PLN(order.dostawa_koszt)})\nRAZEM: ${PLN(order.suma_calosc)}\n\nKlient: ${order.klient.imie}\nEmail: ${order.klient.email}\nTel: ${order.klient.telefon}\nAdres: ${order.klient.adres}\nUwagi: ${order.klient.uwagi}\n\nZgody: regulamin+polityka [${order.zgody.regulamin ? 'TAK' : 'NIE'}] · personalizacja+utrata prawa odstąpienia [${order.zgody.personalizacja ? 'TAK' : 'NIE'}]`;
    try {
      if (CONFIG.orderEndpoint) {
        const res = await fetch(CONFIG.orderEndpoint, { method: 'POST', headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' }, body: JSON.stringify(order) });
        if (!res.ok) throw new Error('send failed');
        let resp = {}; try { resp = await res.json(); } catch {}
        if (resp.redirect) {                       // płatność online -> przekieruj do bramki (PayU)
          cart = []; saveCart(cart);
          window.location.href = resp.redirect;
          return;
        }
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

  // ——————————————————— ZGODY (cookies) + ŚLEDZENIE ———————————————————
  // RODO: piksele marketingowe ładują się DOPIERO po zgodzie. Odrzucenie = równie łatwe.
  let _pixelsReady = false;
  function consentState() { try { return localStorage.getItem('pixelsip_consent'); } catch { return null; } }
  function getCookie(name) { return (document.cookie.match('(^|;)\\s*' + name + '\\s*=\\s*([^;]+)') || [])[2] || ''; }

  function cookieBanner() {
    const b = $('#cookie-banner'); if (!b) return;
    b.querySelector('[data-consent="accept"]')?.addEventListener('click', () => setConsent('granted'));
    b.querySelector('[data-consent="reject"]')?.addEventListener('click', () => setConsent('denied'));
    document.querySelector('[data-cookie-settings]')?.addEventListener('click', (e) => { e.preventDefault(); b.hidden = false; });  // wycofanie/zmiana zgody
    const c = consentState();
    if (c === 'granted') loadPixels();
    if (!c) b.hidden = false;                            // brak decyzji -> pokaż baner
  }
  function setConsent(v) {
    try { localStorage.setItem('pixelsip_consent', v); } catch {}
    const b = $('#cookie-banner'); if (b) b.hidden = true;
    if (v === 'granted') { loadPixels(); track('ViewContent', viewContentData()); }
  }

  function loadPixels() {
    if (_pixelsReady) return;
    if (CONFIG.metaPixelId) {                            // Meta Pixel (standardowy loader)
      !function (f, b, e, v, n, t, s) {
        if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments) };
        if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0'; n.queue = [];
        t = b.createElement(e); t.async = !0; t.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
      }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
      window.fbq('init', CONFIG.metaPixelId); window.fbq('track', 'PageView');
    }
    if (CONFIG.tiktokPixelId) {                          // TikTok Pixel
      !function (w, d, t) {
        w.TiktokAnalyticsObject = t; var ttq = w[t] = w[t] || []; ttq.methods = ['page', 'track', 'identify', 'instances', 'debug', 'on', 'off', 'once', 'ready', 'alias', 'group', 'enableCookie', 'disableCookie'];
        ttq.setAndDefer = function (e, n) { e[n] = function () { e.push([n].concat(Array.prototype.slice.call(arguments, 0))) } };
        for (var i = 0; i < ttq.methods.length; i++) ttq.setAndDefer(ttq, ttq.methods[i]);
        ttq.load = function (e) { var n = 'https://analytics.tiktok.com/i18n/pixel/events.js'; ttq._i = ttq._i || {}; ttq._i[e] = []; ttq._i[e]._u = n; ttq._t = ttq._t || {}; ttq._t[e] = +new Date; var o = d.createElement('script'); o.type = 'text/javascript'; o.async = !0; o.src = n + '?sdkid=' + e + '&lib=' + t; var a = d.getElementsByTagName('script')[0]; a.parentNode.insertBefore(o, a) };
        ttq.load(CONFIG.tiktokPixelId); ttq.page();
      }(window, document, 'ttq');
    }
    _pixelsReady = true;
  }

  // wyślij zdarzenie e-commerce do aktywnych pikseli (no-op bez zgody / bez ID)
  function track(event, data) {
    if (consentState() !== 'granted' || !_pixelsReady) return;
    try { if (window.fbq) window.fbq('track', event, data); } catch {}
    try {
      if (window.ttq) {
        const map = { ViewContent: 'ViewContent', AddToCart: 'AddToCart', InitiateCheckout: 'InitiateCheckout', Purchase: 'CompletePayment' };
        window.ttq.track(map[event] || event, { value: data.value, currency: data.currency, content_id: (data.content_ids || [])[0] });
      }
    } catch {}
  }
  function viewContentData() {
    const p = state.prodById?.[state.size] || {};
    return { content_ids: [baseName()], content_type: 'product', value: p.retailPrice || 0, currency: 'PLN' };
  }

  // ——————————————————— WAITLIST (rozmiary „wkrótce", np. 900 ml) ———————————————————
  function openWaitlist(productId) {
    const p = state.prodById[productId] || {}; const lbl = p.sizeLabel || '900 ml';
    let m = $('#waitlist-modal');
    if (!m) {
      m = document.createElement('div'); m.id = 'waitlist-modal'; m.className = 'wl-modal';
      m.innerHTML = `<div class="wl-box" role="dialog" aria-modal="true" aria-label="Zapisz się na powiadomienie">
        <button class="wl-close" aria-label="Zamknij">×</button>
        <h3 class="wl-title"></h3><p class="wl-lead"></p>
        <form class="wl-form">
          <input type="email" name="email" required placeholder="Twój e-mail" autocomplete="email">
          <label class="wl-consent"><input type="checkbox" name="ok" required> Chcę dostać powiadomienie mailem o dostępności tego rozmiaru.</label>
          <button class="btn btn--primary btn--block" type="submit">Powiadom mnie</button>
        </form>
        <p class="wl-msg" hidden></p></div>`;
      document.body.appendChild(m);
      m.addEventListener('click', e => { if (e.target === m || e.target.closest('.wl-close')) m.classList.remove('open'); });
      m.querySelector('.wl-form').addEventListener('submit', async e => {
        e.preventDefault();
        const email = e.target.email.value.trim(), msg = m.querySelector('.wl-msg'), btn = e.target.querySelector('button[type=submit]');
        btn.disabled = true; btn.textContent = 'Zapisuję…';
        try {
          if (CONFIG.waitlistEndpoint) {
            const r = await fetch(CONFIG.waitlistEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, product: m.dataset.product }) });
            if (!r.ok) throw 0;
          }
          e.target.hidden = true; msg.hidden = false; msg.className = 'wl-msg ok'; msg.textContent = '✅ Dzięki! Damy znać, gdy ten rozmiar ruszy.';
        } catch { msg.hidden = false; msg.className = 'wl-msg err'; msg.textContent = 'Coś poszło nie tak — spróbuj później.'; btn.disabled = false; btn.textContent = 'Powiadom mnie'; }
      });
    }
    m.dataset.product = productId;
    m.querySelector('.wl-title').textContent = `${lbl} — wkrótce`;
    m.querySelector('.wl-lead').textContent = p.waitlistNote || 'Pracujemy nad tym rozmiarem. Zostaw maila — damy znać, gdy ruszy.';
    const f = m.querySelector('.wl-form'), msg = m.querySelector('.wl-msg');
    f.hidden = false; f.reset(); const b = f.querySelector('button[type=submit]'); b.disabled = false; b.textContent = 'Powiadom mnie';
    msg.hidden = true;
    m.classList.add('open');
  }
  function initHeroCarousel() {
    const slides = $$('.hero__slide'), dots = $$('.hero__dot'), wrap = $('.hero__carousel');
    if (slides.length < 2) return;
    let i = 0, timer = null;
    const hero = $('.hero');
    const go = (n) => { i = (n + slides.length) % slides.length;
      slides.forEach((s, k) => s.classList.toggle('is-active', k === i));
      dots.forEach((d, k) => d.classList.toggle('is-active', k === i));
      if (hero) hero.style.setProperty('--hero-bg', `url('${slides[i].dataset.amb}')`); };   // ambientowe tło = wzór pixel-art dopasowany do zdjęcia (data-amb, ustawiane w build_index.py)
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
      // ——— zakładki / skróty / panel kolorów (nowy flow) ———
      const tab = e.target.closest('[data-tab]');
      if (tab) { goTab(tab.dataset.tab); $('#config-tabs')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); return; }
      if (e.target.closest('#sticky-next')) { const i = TAB_ORDER.indexOf(state.tab); goTab(TAB_ORDER[Math.min(TAB_ORDER.length - 1, i + 1)]); $('#configurator')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
      const preset = e.target.closest('[data-preset]');
      if (preset) { applyPreset(+preset.dataset.preset); return; }
      if (e.target.closest('#btn-random')) { randomBuild(); return; }
      const cside = e.target.closest('[data-colside]');
      if (cside) { state.colorSide = cside.dataset.colside; state.palExpanded = false; renderActivePalette(); return; }
      const ckind = e.target.closest('[data-colkind]');
      if (ckind) { state.colorKind = ckind.dataset.colkind; state.palExpanded = false; renderActivePalette(); return; }
      if (e.target.closest('#toggle-sync')) {
        state.syncStrip = !state.syncStrip;
        if (state.syncStrip) { state.stripColorBot = state.stripColorTop; state.bandColorBot = state.bandColorTop; state.colorSide = 'top'; }
        applyColorsVisibility(); renderActivePalette(); renderColorsSummary(); updatePreview(); return;
      }
      if (e.target.closest('#toggle-more-colors') || e.target.closest('[data-morecolors]')) { state.palExpanded = !state.palExpanded; renderActivePalette(); return; }
      if (e.target.closest('#toggle-split-text')) {
        state.splitText = !state.splitText;
        if (!state.splitText) { state.stripTextBot = state.stripTextTop; state.stripSizeBot = state.stripSizeTop; const b = $('#strip-text-bot'); if (b) b.value = state.stripTextBot; }
        applyStripVisibility(); updatePreview(); return;
      }
      const gnav = e.target.closest('[data-gallery-nav]');
      if (gnav) { scrollGallery(+gnav.dataset.galleryNav); return; }
      const card = e.target.closest('[data-design]');
      if (card) { state.designId = card.dataset.design; renderGallery(); renderPalettes(); updatePreview(); $('#configurator')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); return; }
      const sz = e.target.closest('[data-size]');
      if (sz) { state.size = sz.dataset.size; renderSizes(); updatePreview(); return; }
      const wl = e.target.closest('[data-waitlist]');
      if (wl) { openWaitlist(wl.dataset.waitlist); return; }
      const chip = e.target.closest('[data-cat]');
      if (chip) { state.cat = chip.dataset.cat; $$('[data-cat]').forEach(c => c.classList.toggle('is-active', c === chip)); renderGallery(); return; }
      const strip = e.target.closest('[data-strip]');
      if (strip) { state.strip = strip.dataset.strip; $$('[data-strip]').forEach(s => { const a = s === strip; s.classList.toggle('is-active', a); s.setAttribute('aria-pressed', a); }); applyStripVisibility(); updatePreview(); return; }
      const sw = e.target.closest('[data-pal]');
      if (sw) {
        const pal = sw.dataset.pal;
        setPalColor(pal, sw.dataset.val);
        $$(`[data-pal="${pal}"]`).forEach(s => s.classList.toggle('is-active', s === sw));
        document.querySelector(`.swatch--custom input[data-palcustom="${pal}"]`)?.closest('.swatch--custom')?.classList.remove('is-active');
        updatePreview(); return;
      }
      const psT = e.target.closest('[data-size-striptop]');
      if (psT) { state.stripSizeTop = +psT.dataset.sizeStriptop; if (!isSplit()) state.stripSizeBot = state.stripSizeTop; $$('[data-size-striptop]').forEach(s => s.classList.toggle('is-active', s === psT)); updatePreview(); return; }
      const psB = e.target.closest('[data-size-stripbot]');
      if (psB) { state.stripSizeBot = +psB.dataset.sizeStripbot; $$('[data-size-stripbot]').forEach(s => s.classList.toggle('is-active', s === psB)); updatePreview(); return; }
      const bt = e.target.closest('[data-base]');
      if (bt) { state.base = bt.dataset.base; applyBaseVisibility(); renderPalettes(); if (state.base === 'scene') updateGalleryNav(); updatePreview(); return; }
      const gp = e.target.closest('[data-geopat]');
      if (gp) { state.geo.pattern = gp.dataset.geopat; $$('[data-geopat]').forEach(s => s.classList.toggle('is-active', s === gp)); updatePreview(); return; }
      const gs = e.target.closest('[data-size-geo]');
      if (gs) { state.geo.n = +gs.dataset.sizeGeo; $$('[data-size-geo]').forEach(s => s.classList.toggle('is-active', s === gs)); updatePreview(); return; }
      const em = e.target.closest('[data-emblem]');
      if (em) { state.tile.emblem = em.dataset.emblem; $$('[data-emblem]').forEach(s => s.classList.toggle('is-active', s === em)); renderPalettes(); updatePreview(); return; }
      const ec = e.target.closest('[data-embcat]');
      if (ec) { state.embCat = ec.dataset.embcat; renderEmblems(); return; }
      const ts = e.target.closest('[data-size-tile]');
      if (ts) { state.tile.n = +ts.dataset.sizeTile; $$('[data-size-tile]').forEach(s => s.classList.toggle('is-active', s === ts)); updatePreview(); return; }
      if (e.target.closest('#share-build, #preview-share')) { shareBuild(); return; }
      if (e.target.closest('#add-to-cart, #sticky-add, #preview-add')) { addToCart(); return; }
      if (e.target.closest('#cart-toggle, #sticky-cart')) { openCart(); return; }
      if (e.target.closest('#cart-close')) { closeCart(); return; }
      if (e.target.closest('#overlay')) { closeCart(); closeCheckout(); return; }
      const q = e.target.closest('[data-q]'); if (q) { setQty(q.dataset.key, Number(q.dataset.q)); return; }
      const ed = e.target.closest('[data-edit]'); if (ed) { editCartItem(ed.dataset.edit); return; }
      if (e.target.closest('#edit-cancel')) { setEditing(null); toast('Anulowano edycję'); return; }
      const rm = e.target.closest('[data-rm]'); if (rm) { removeItem(rm.dataset.rm); return; }
      if (e.target.closest('#cart-checkout')) { closeCart(); openCheckout(); return; }
      if (e.target.closest('#co-close')) { closeCheckout(); return; }
      const fq = e.target.closest('.faq-q'); if (fq) { const it = fq.parentElement; it.classList.toggle('open'); fq.setAttribute('aria-expanded', it.classList.contains('open')); return; }
      if (e.target.closest('#nav-toggle')) { $('#nav')?.classList.toggle('open'); return; }
      if (e.target.closest('#nav a')) { $('#nav')?.classList.remove('open'); }
    });
    $('#design-search')?.addEventListener('input', (e) => { state.q = e.target.value.toLowerCase().trim(); renderGallery(); });
    document.addEventListener('input', (e) => {                    // własny kolor (picker) — live, bez re-renderu
      const ci = e.target.closest('[data-palcustom]'); if (!ci) return;
      const pal = ci.dataset.palcustom;
      setPalColor(pal, ci.value.toUpperCase());
      $$(`[data-pal="${pal}"]`).forEach(s => s.classList.remove('is-active'));
      ci.closest('.swatch--custom')?.classList.add('is-active');
      updatePreview();
    });
    document.addEventListener('input', (e) => {                    // własny gradient (2 kolory) — live
      const gp = e.target.closest('[data-gradpart]'); if (!gp) return;
      const pal = gp.dataset.gradpart.split(':')[0];
      const ins = $$(`[data-gradpart^="${pal}:"]`);
      const c0 = ins.find(i => i.dataset.gradpart === pal + ':0')?.value || '#22E0E6';
      const c1 = ins.find(i => i.dataset.gradpart === pal + ':1')?.value || '#FF2E97';
      setPalColor(pal, mkGrad(c0, c1));
      $$(`[data-pal="${pal}"]`).forEach(s => s.classList.remove('is-active'));
      const grads = [...(gp.closest('.strip-colors')?.querySelectorAll('.swatch--grad') || [])];
      const pv = grads[grads.length - 1];
      if (pv) { pv.style.background = `linear-gradient(90deg,${c0},${c1})`; pv.dataset.val = mkGrad(c0, c1); pv.classList.add('is-active'); }
      updatePreview();
    });
    $('#design-gallery')?.addEventListener('wheel', (e) => {       // myszka: pionowe kółko -> poziomy scroll karuzeli
      const el = e.currentTarget;
      if (el.scrollWidth <= el.clientWidth + 4) return;
      if (Math.abs(e.deltaX) >= Math.abs(e.deltaY)) return;       // gest już poziomy (touchpad) — zostaw
      el.scrollLeft += e.deltaY; e.preventDefault();
    }, { passive: false });
    $('#design-gallery')?.addEventListener('scroll', updateGalleryNav, { passive: true });
    window.addEventListener('resize', updateGalleryNav, { passive: true });
    $('#strip-text-top')?.addEventListener('input', (e) => {
      const clean = sanitizeText(e.target.value);
      if (clean !== e.target.value) e.target.value = clean;
      state.stripTextTop = clean;
      if (!isSplit()) { state.stripTextBot = clean; const b = $('#strip-text-bot'); if (b) b.value = clean; }   // tryb prosty: jeden napis na obie strony
      updatePreview();
    });
    $('#strip-text-bot')?.addEventListener('input', (e) => {
      const clean = sanitizeText(e.target.value);
      if (clean !== e.target.value) e.target.value = clean;
      state.stripTextBot = clean; updatePreview();
    });
    $('#checkout-form')?.addEventListener('submit', submitOrder);
    $('#co-delivery')?.addEventListener('change', () => { updateGrand(); toggleLockerPicker(); });
    $('#co-locker-btn')?.addEventListener('click', openGeoModal);
    $('#geo-close')?.addEventListener('click', closeGeoModal);
    $('#geo-modal')?.addEventListener('click', (e) => { if (e.target.id === 'geo-modal') closeGeoModal(); });
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

/* ——————————————————— RUCH: scroll-reveal (perf-safe, reduced-motion-aware) ——————————————————— */
(function () {
  var root = document.documentElement;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce || !('IntersectionObserver' in window)) return;   // brak JS-reveal -> treść widoczna od razu
  root.classList.add('anim-ready');

  function run() {
    // [selektor, krok-staggeru ms] — tylko statyczne, strukturalne elementy
    var groups = [
      ['.summer-card', 90], ['.spec-card', 90], ['.life-card', 70],
      ['.faq-item', 50], ['.step', 90], ['.section .center', 0]
    ];
    var io = new IntersectionObserver(function (entries, obs) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('is-in'); obs.unobserve(en.target); }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

    groups.forEach(function (g) {
      document.querySelectorAll(g[0]).forEach(function (el, i) {
        if (el.closest('.hero')) return;                 // hero zostawiamy bez reveal
        el.classList.add('reveal');
        if (g[1]) el.style.setProperty('--rd', Math.min(i * g[1], 360) + 'ms');
        io.observe(el);
      });
    });
  }
  if (document.readyState !== 'loading') run(); else document.addEventListener('DOMContentLoaded', run);
})();
