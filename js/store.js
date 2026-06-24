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
    size: null, designId: null, strip: 'both', stripColor: 'glitch', bandColor: '#000000', cat: 'all', q: '',
    freeShip: 199, delivery: [], bundles: [], lastFocus: null,
  };
  const STRIP_LABEL = { both: 'góra i dół', top: 'tylko góra', bot: 'tylko dół', none: 'bez paska' };
  const STRIP_COLORS = [
    { id: 'glitch', label: 'Glitch', css: 'linear-gradient(90deg,#22E0E6,#fff,#FF2E97)' },
    { id: '#FFFFFF', label: 'Biały', css: '#FFFFFF' },
    { id: '#22E0E6', label: 'Cyan', css: '#22E0E6' },
    { id: '#FF2E97', label: 'Magenta', css: '#FF2E97' },
    { id: '#9B5DE5', label: 'Fiolet', css: '#9B5DE5' },
    { id: '#FFD23F', label: 'Żółty', css: '#FFD23F' },
    { id: '#5DF7A0', label: 'Zielony', css: '#5DF7A0' },
  ];
  const BAND_COLORS = [
    { id: '#000000', label: 'Czarne', css: '#000000' },
    { id: '#0B0A16', label: 'Granat', css: '#0B0A16' },
    { id: '#FFFFFF', label: 'Białe', css: '#FFFFFF' },
    { id: '#22E0E6', label: 'Cyan', css: '#22E0E6' },
    { id: '#FF2E97', label: 'Magenta', css: '#FF2E97' },
    { id: '#9B5DE5', label: 'Fiolet', css: '#9B5DE5' },
    { id: '#FFD23F', label: 'Żółty', css: '#FFD23F' },
    { id: '#5DF7A0', label: 'Zielony', css: '#5DF7A0' },
  ];
  const colorLabel = (id) => (STRIP_COLORS.find(c => c.id === id) || {}).label || id;
  const bandLabel = (id) => (BAND_COLORS.find(c => c.id === id) || {}).label || id;
  const stripDesc = () => `Pasek: ${STRIP_LABEL[state.strip]}${state.strip === 'none' ? '' : ` · napis ${colorLabel(state.stripColor)}, tło ${bandLabel(state.bandColor)}`}`;

  const CART_KEY = 'pixelsip_cart_v1';
  const loadCart = () => { try { return JSON.parse(localStorage.getItem(CART_KEY)) || []; } catch { return []; } };
  const saveCart = (c) => { try { localStorage.setItem(CART_KEY, JSON.stringify(c)); } catch {} };
  let cart = loadCart();
  let isSubmitting = false;

  // ——————————————————— INIT ———————————————————
  async function init() {
    try {
      const [p, d] = await Promise.all([
        fetch('data/products.json').then(r => r.json()),
        fetch('data/designs.json').then(r => r.json()),
      ]);
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

    renderGallery(); renderSizes(); renderStripColors(); renderBandColors(); renderDelivery(); updatePreview(); bindUI(); renderCart(); cookieBanner();
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
  function renderStripColors() {
    const w = $('#strip-colors'); if (!w) return;
    w.innerHTML = STRIP_COLORS.map(c => `<button class="swatch${c.id === state.stripColor ? ' is-active' : ''}" data-color="${esc(c.id)}" title="${esc(c.label)}" aria-label="Kolor napisu: ${esc(c.label)}" style="background:${c.css}"></button>`).join('');
  }
  function renderBandColors() {
    const w = $('#band-colors'); if (!w) return;
    w.innerHTML = BAND_COLORS.map(c => `<button class="swatch${c.id === state.bandColor ? ' is-active' : ''}" data-bandcolor="${esc(c.id)}" title="${esc(c.label)}" aria-label="Kolor tła paska: ${esc(c.label)}" style="background:${c.css}"></button>`).join('');
  }

  // ——————————————————— TEKSTURA (parametryczna: scena + paski) ———————————————————
  const TEX = document.createElement('canvas'); TEX.width = 1024; TEX.height = 916;
  const tctx = TEX.getContext('2d');
  const imgCache = {};
  const loadImg = (src) => imgCache[src] || (imgCache[src] = new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = src; }));
  let wordmark = null, glitch = null, texSeq = 0;
  function tintStrip(hex) {
    const c = document.createElement('canvas'); c.width = wordmark.width; c.height = wordmark.height;
    const x = c.getContext('2d'); x.drawImage(wordmark, 0, 0);
    x.globalCompositeOperation = 'source-in'; x.fillStyle = hex; x.fillRect(0, 0, c.width, c.height);
    return c;
  }
  async function buildTexture() {
    const d = state.byId[state.designId]; if (!d) return;
    const seq = ++texSeq;
    if (!wordmark) wordmark = await loadImg('assets/brand/wordmark.png');
    if (!glitch) glitch = await loadImg('assets/brand/strip-glitch-t.png');
    const scene = await loadImg(d.file);
    if (seq !== texSeq || !scene || !wordmark) return;
    const TW = TEX.width, TH = TEX.height, BAND = Math.round(TH * 0.135);
    const top = state.strip === 'both' || state.strip === 'top';
    const bot = state.strip === 'both' || state.strip === 'bot';
    tctx.imageSmoothingEnabled = false;
    tctx.fillStyle = '#000'; tctx.fillRect(0, 0, TW, TH);
    const sy0 = top ? BAND : 0, sy1 = bot ? TH - BAND : TH, sw_ = TW;
    const s = Math.max(sw_ / scene.width, (sy1 - sy0) / scene.height), iw = scene.width * s, ih = scene.height * s;
    tctx.drawImage(scene, (sw_ - iw) / 2, sy0 + ((sy1 - sy0) - ih) / 2, iw, ih);
    const strip = state.stripColor === 'glitch' ? glitch : tintStrip(state.stripColor);
    const sh = Math.round(BAND * 0.58), bw = Math.round(strip.width * sh / strip.height), mg = Math.round(TW * 0.05);
    const band = (by) => { tctx.fillStyle = state.bandColor; tctx.fillRect(0, by, TW, BAND); tctx.imageSmoothingEnabled = false; const yy = by + (BAND - sh) / 2; tctx.drawImage(strip, mg, yy, bw, sh); tctx.drawImage(strip, TW - mg - bw, yy, bw, sh); };
    if (top) band(0);
    if (bot) band(TH - BAND);
    window.__tumblerCanvas = TEX;
    window.Tumbler?.setTextureCanvas(TEX);
  }

  // ——————————————————— PODGLĄD ———————————————————
  function updatePreview() {
    const d = state.byId[state.designId], p = state.prodById[state.size];
    if (!d || !p) return;
    const set = (id, t) => { const el = $(id); if (el) el.textContent = t; };
    set('#preview-name', d.name); set('#preview-blurb', d.blurb || '');
    set('#preview-size', p.sizeLabel); set('#preview-price', PLN(p.retailPrice));
    const cmp = $('#preview-compare');
    if (cmp) { if (p.compareAt && p.compareAt > p.retailPrice) { cmp.textContent = PLN(p.compareAt); cmp.hidden = false; } else cmp.hidden = true; }
    // podgląd 3D — rozmiar + tekstura składana parametrycznie
    window.__tumblerWant = { cap: p.capacityMl };
    window.Tumbler?.setSize(p.capacityMl);
    buildTexture();
  }

  // ——————————————————— KOSZYK ———————————————————
  const itemKey = (size, design, strip, color) => `${size}__${design}__${strip}__${color}`;
  function addToCart() {
    const p = state.prodById[state.size], d = state.byId[state.designId];
    if (!p || !d) return;
    const tColor = state.strip === 'none' ? '-' : state.stripColor;
    const bColor = state.strip === 'none' ? '-' : state.bandColor;
    const key = itemKey(p.id, d.id, state.strip, tColor + '_' + bColor);
    const ex = cart.find(i => i.key === key);
    if (ex) ex.qty += 1;
    else cart.push({ key, size: p.id, sizeLabel: p.sizeLabel, designId: d.id, designName: d.name, strip: state.strip, stripColor: tColor, bandColor: bColor, stripDesc: stripDesc(), file: d.file, price: p.retailPrice, qty: 1 });
    saveCart(cart); renderCart(); openCart();
    toast(`Dodano: ${d.name} · ${p.sizeLabel}`);
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
      pozycje: cart.map(i => `${i.qty}× ${i.designName} (${i.sizeLabel}, ${i.stripDesc || ''}) = ${(i.price * i.qty).toFixed(2)} zł\n   [config: design=${i.designId} size=${i.size} strip=${i.strip} tekst=${i.stripColor} tlo=${i.bandColor}]`),
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

  // ——————————————————— UI BINDING ———————————————————
  function bindUI() {
    document.addEventListener('click', (e) => {
      const card = e.target.closest('[data-design]');
      if (card) { state.designId = card.dataset.design; renderGallery(); updatePreview(); $('#configurator')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); return; }
      const sz = e.target.closest('[data-size]');
      if (sz) { state.size = sz.dataset.size; renderSizes(); updatePreview(); return; }
      const chip = e.target.closest('[data-cat]');
      if (chip) { state.cat = chip.dataset.cat; $$('[data-cat]').forEach(c => c.classList.toggle('is-active', c === chip)); renderGallery(); return; }
      const strip = e.target.closest('[data-strip]');
      if (strip) { state.strip = strip.dataset.strip; $$('[data-strip]').forEach(s => { const a = s === strip; s.classList.toggle('is-active', a); s.setAttribute('aria-pressed', a); }); $('#strip-colors')?.style.setProperty('opacity', state.strip === 'none' ? '.35' : '1'); updatePreview(); return; }
      const col = e.target.closest('[data-color]');
      if (col) { state.stripColor = col.dataset.color; $$('[data-color]').forEach(s => s.classList.toggle('is-active', s === col)); updatePreview(); return; }
      const bcol = e.target.closest('[data-bandcolor]');
      if (bcol) { state.bandColor = bcol.dataset.bandcolor; $$('[data-bandcolor]').forEach(s => s.classList.toggle('is-active', s === bcol)); updatePreview(); return; }
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
