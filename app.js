/* CA Financial Toolkit — UI, routing, history, exports */
(function () {
  'use strict';
  const { CATS, CALCS, fmt, fmtDate } = window.CAT;
  const VERSION = '1.1.0';
  // Running inside the Play Store app (Trusted Web Activity) or an installed PWA
  const IN_TWA = (() => { try { if (document.referrer.startsWith('android-app://')) sessionStorage.setItem('catk.twa', '1'); return sessionStorage.getItem('catk.twa') === '1'; } catch (e) { return false; } })();
  const isInstalled = () => IN_TWA || matchMedia('(display-mode: standalone)').matches;
  const $ = (s, r = document) => r.querySelector(s);
  const h = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { toast('Storage is full or unavailable'); return false; } }
  };
  const settings = Object.assign({ firm: '', prepared: '', theme: 'system' }, store.get('catk.settings', {}));
  let history = store.get('catk.history', []);
  const UNITS = { rs: '₹', th: '₹ thousand', lakh: '₹ lakh', cr: '₹ crore' };

  /* ---------- icons ---------- */
  const P = {
    shield: 'M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6l8-3z|M8.5 12l2.5 2.5 4.5-5',
    trend: 'M3 17l6-6 4 4 8-8|M15 7h6v6',
    calendar: 'M4 6h16v14H4z|M4 10h16|M8 3v5|M16 3v5|M8 14h3v3H8z',
    scale: 'M12 4v16|M5 20h14|M4 9l3-5 3 5a3 3 0 0 1-6 0z|M14 9l3-5 3 5a3 3 0 0 1-6 0z|M7 4h10',
    loan: 'M3 10l9-6 9 6|M5 10v8|M10 10v8|M14 10v8|M19 10v8|M3 20h18',
    cycle: 'M20 12a8 8 0 0 1-14 5.3|M4 12a8 8 0 0 1 14-5.3|M18 3v4h-4|M6 21v-4h4',
    layers: 'M12 3l9 5-9 5-9-5 9-5z|M3 13l9 5 9-5|M3 17l9 5 9-5',
    gauge: 'M4 18a8 8 0 1 1 16 0|M12 18l4-6|M4 18h16',
    balance: 'M4 7h16|M7 7v12|M17 7v12|M4 19h16|M10 11h4|M10 15h4',
    grid: 'M4 4h7v7H4z|M13 4h7v7h-7z|M4 13h7v7H4z|M13 13h7v7h-7z',
    cross: 'M3 20L21 5|M3 9l18 9|M3 4v16h18',
    building: 'M4 21V5l8-3v19|M12 8l8 3v10|M2 21h20|M7 8h2|M7 12h2|M7 16h2|M15 14h2|M15 18h2',
    percent: 'M19 5L5 19|M7 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4z|M17 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
    growth: 'M4 20h16|M6 16v4|M10 12v8|M14 9v11|M18 5v15',
    down: 'M4 4l6 7 4-3 6 8|M20 11v5h-5',
    user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z|M4 21a8 8 0 0 1 16 0',
    lock: 'M5 11h14v10H5z|M8 11V7a4 4 0 0 1 8 0v4|M12 15v2',
    coins: 'M12 8c4.4 0 8-1.3 8-3s-3.6-3-8-3-8 1.3-8 3 3.6 3 8 3z|M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5|M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6',
    home: 'M3 11l9-7 9 7|M5 10v10h14V10|M10 20v-6h4v6',
    history: 'M3 12a9 9 0 1 0 3-6.7|M3 4v5h5|M12 7v5l3 3',
    settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z|M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
    back: 'M15 18l-6-6 6-6',
    save: 'M5 3h11l3 3v15H5z|M8 3v5h7V3|M8 21v-7h8v7',
    pdf: 'M6 2h9l5 5v15H6z|M14 2v6h6|M9 13h6|M9 17h6',
    excel: 'M4 4h16v16H4z|M4 9h16|M4 14h16|M10 4v16',
    share: 'M18 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6z|M6 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z|M18 22a3 3 0 1 0 0-6 3 3 0 0 0 0 6z|M8.6 13.5l6.8 4|M15.4 6.5l-6.8 4',
    plus: 'M12 5v14|M5 12h14',
    trash: 'M4 7h16|M10 11v6|M14 11v6|M6 7l1 13h10l1-13|M9 7V4h6v3',
    search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14z|M21 21l-5-5',
    download: 'M12 4v11|M7 10l5 5 5-5|M5 20h14',
    upload: 'M12 20V9|M7 14l5-5 5 5|M5 4h14',
    reset: 'M4 12a8 8 0 1 0 2.3-5.7|M4 4v4h4',
    sample: 'M9 3h6|M10 3v6l-5 9a2 2 0 0 0 1.8 3h10.4a2 2 0 0 0 1.8-3l-5-9V3',
    install: 'M12 3v12|M7 10l5 5 5-5|M4 21h16',
    clear: 'M18 6L6 18|M6 6l12 12'
  };
  const icon = (n, cls = '') => `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true">${(P[n] || '').split('|').map(d => `<path d="${d}"/>`).join('')}</svg>`;

  /* ---------- toast ---------- */
  let toastT;
  function toast(msg, action) {
    const t = $('#toast');
    t.innerHTML = `<span>${h(msg)}</span>` + (action ? `<button>${h(action.label)}</button>` : '');
    if (action) t.querySelector('button').onclick = () => { action.fn(); t.classList.remove('show'); };
    t.classList.add('show');
    clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), action ? 8000 : 2600);
  }

  /* ---------- theme ---------- */
  function applyTheme() {
    const r = document.documentElement;
    if (settings.theme === 'system') r.removeAttribute('data-theme'); else r.setAttribute('data-theme', settings.theme);
    const dark = settings.theme === 'dark' || (settings.theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
    $('meta[name=theme-color]').setAttribute('content', dark ? '#0d1520' : '#13233a');
  }

  /* ---------- raw <-> values ---------- */
  const NUMT = ['money', 'pct', 'num', 'signed'];
  const toRaw = (t, v) => (t === 'check' ? !!v : v == null ? '' : String(v));
  function defaults(calc) {
    const raw = {};
    calc.fields.forEach(f => {
      if (f.t === 'head') return;
      if (f.t === 'grid') raw[f.k] = f.d.map(r => { const o = {}; f.cols.forEach(c => (o[c.k] = toRaw(c.t, r[c.k] ?? (c.t === 'select' ? c.opts[0][0] : '')))); return o; });
      else raw[f.k] = toRaw(f.t, f.d ?? (f.t === 'select' ? f.opts[0][0] : ''));
    });
    return raw;
  }
  function blank(calc) {
    const raw = defaults(calc);
    calc.fields.forEach(f => {
      if (NUMT.includes(f.t) || f.t === 'text' || f.t === 'date') raw[f.k] = '';
      if (f.t === 'grid') raw[f.k] = raw[f.k].map(r => { const o = {}; f.cols.forEach(c => (o[c.k] = c.t === 'select' ? r[c.k] : '')); return o; });
    });
    return raw;
  }
  function parseNum(s) {
    if (s == null) return null;
    s = String(s).replace(/[,\s₹%]/g, '').replace(/[−–]/g, '-');
    if (s === '' || s === '-' || s === '.') return null;
    if (/^\(.*\)$/.test(s)) s = '-' + s.slice(1, -1);
    const n = Number(s);
    return isFinite(n) ? n : NaN;
  }
  function parseVal(t, s) { if (NUMT.includes(t)) return parseNum(s); if (t === 'check') return !!s; return s; }
  // Parses raw strings. Returns problems for visible fields only: non-numbers, and negatives in non-signed fields.
  function values(calc, raw) {
    const v = {}, bad = [], neg = [];
    const chk = (t, val, label, vis) => {
      if (Number.isNaN(val)) { if (vis) bad.push(label); return null; }
      if (vis && val < 0 && (t === 'money' || t === 'pct' || t === 'num')) neg.push(label);
      return val;
    };
    calc.fields.forEach(f => {
      if (f.t === 'head') return;
      const vis = visible(f, raw);
      if (f.t === 'grid') v[f.k] = (raw[f.k] || []).map(r => { const o = {}; f.cols.forEach(c => { o[c.k] = chk(c.t, parseVal(c.t, r[c.k]), c.l, vis); }); return o; });
      else v[f.k] = chk(f.t, parseVal(f.t, raw[f.k]), f.l, vis);
    });
    return { v, bad: [...new Set(bad)], neg: [...new Set(neg)] };
  }
  const visible = (f, raw) => !f.show || f.show(raw);

  /* ---------- views ---------- */
  const view = () => $('#view');
  function setTop(title, back) {
    $('#topTitle').textContent = title;
    $('#backBtn').hidden = !back;
    $('#brandMark').hidden = !!back;
  }
  function setTab(name) {
    document.querySelectorAll('.tabbar a').forEach(a => a.classList.toggle('on', a.dataset.tab === name));
    document.body.dataset.view = name;
  }

  /* Home */
  let homeCat = 'all', homeQ = '';
  function renderHome() {
    setTop('CA Financial Toolkit', false); setTab('home');
    const recent = [];
    history.forEach(x => { if (!recent.includes(x.calc) && recent.length < 4 && CALCS.find(c => c.id === x.calc)) recent.push(x.calc); });
    view().innerHTML = `
      <section class="hero">
        <p class="eyebrow">${h(settings.firm || 'Financial toolkit')}</p>
        <h1>Credit, appraisal &amp; analysis calculators</h1>
        <label class="search">${icon('search')}<input id="q" type="search" placeholder="Search DSCR, MPBF, EMI…" value="${h(homeQ)}" autocomplete="off"></label>
      </section>
      ${recent.length ? `<section class="recent"><h2 class="sec-h">Recently used</h2><div class="chips-row">${recent.map(id => { const c = CALCS.find(x => x.id === id); return `<a class="rchip" href="#/c/${id}">${icon(c.icon)}${h(c.short)}</a>`; }).join('')}</div></section>` : ''}
      <nav class="cats" role="tablist">${[['all', 'All'], ...CATS].map(([k, l]) => `<button role="tab" data-cat="${k}" class="${homeCat === k ? 'on' : ''}">${h(l)}</button>`).join('')}</nav>
      <div id="cards"></div>
      <p class="foot-note">Results are calculation aids, not financial advice. Data stays on this device. <a href="#/settings">Disclaimer &amp; privacy</a></p>`;
    const draw = () => {
      const q = homeQ.trim().toLowerCase();
      const list = CALCS.filter(c => (homeCat === 'all' || c.cat === homeCat) && (!q || (c.title + ' ' + c.short + ' ' + c.desc).toLowerCase().includes(q)));
      const groups = CATS.filter(([k]) => list.some(c => c.cat === k));
      $('#cards').innerHTML = list.length ? groups.map(([k, l]) => `<h2 class="sec-h">${h(l)}</h2><div class="cards">${list.filter(c => c.cat === k).map(c => `
        <a class="card-link cat-${c.cat}" href="#/c/${c.id}"><span class="tile">${icon(c.icon)}</span><span class="ct"><b>${h(c.short)}</b><small>${h(c.desc)}</small></span></a>`).join('')}</div>`).join('') : `<p class="empty">No calculator matches “${h(homeQ)}”.</p>`;
    };
    draw();
    $('#q').addEventListener('input', e => { homeQ = e.target.value; draw(); });
    view().querySelector('.cats').addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      homeCat = b.dataset.cat; view().querySelectorAll('.cats button').forEach(x => x.classList.toggle('on', x === b)); draw();
    });
  }

  /* Calculator */
  let cur = null, calcT, peekObs = null;
  function fieldHTML(f, raw, path) {
    const id = 'f_' + path.replace(/\W/g, '_');
    const val = path.includes('|') ? raw : raw[f.k];
    const attrs = `id="${id}" data-p="${h(path)}"`;
    let input;
    switch (f.t) {
      case 'select': input = `<select ${attrs}>${f.opts.map(o => `<option value="${h(o[0])}" ${String(val) === String(o[0]) ? 'selected' : ''}>${h(o[1])}</option>`).join('')}</select>`; break;
      case 'check': return `<label class="switch" for="${id}"><input type="checkbox" ${attrs} ${val ? 'checked' : ''}><span class="sw"></span><span class="sw-l">${h(f.l)}</span></label>`;
      case 'date': input = `<input type="date" ${attrs} value="${h(val)}">`; break;
      case 'text': input = `<input type="text" ${attrs} value="${h(val)}" autocomplete="off">`; break;
      default: {
        const suf = f.t === 'pct' ? '%' : f.suf || '';
        input = `<div class="inp">${f.t === 'signed' ? `<button type="button" class="pm" data-pm="${h(path)}" aria-label="Toggle sign">±</button>` : ''}<input type="text" inputmode="decimal" ${attrs}${f.al ? ` aria-label="${h(f.al)}"` : ''} value="${h(val)}" autocomplete="off">${suf ? `<span class="suf">${h(suf)}</span>` : ''}</div>`;
        if (f.t === 'money' || f.t === 'signed') input += `<small class="vh" data-vh="${h(path)}">${h(amtHint(val))}</small>`;
      }
    }
    return `${f.l ? `<label class="lbl" for="${id}">${h(f.l)}</label>` : ''}${input}${f.hint ? `<small class="hint">${h(f.hint)}</small>` : ''}`;
  }
  // Indian-grouped echo of a typed amount (e.g. 2500000 -> 25,00,000), shown only for large numbers
  function amtHint(s) {
    const n = parseNum(s);
    if (n == null || Number.isNaN(n) || Math.abs(n) < 1000) return '';
    return fmt(n, 'money').replace(/\.00$/, '') + (Math.abs(n) >= 1e5 ? ` (${Math.abs(n) >= 1e7 ? (n / 1e7).toFixed(2) + ' Cr' : (n / 1e5).toFixed(2) + ' L'})` : '');
  }
  function gridRowsHTML(f, rows) {
    const single = f.cols.length === 1;
    return rows.map((r, i) => {
      const title = f.rowLabel ? f.rowLabel(i) : '#' + (i + 1);
      const del = `<button type="button" class="icon-btn del" data-del="${f.k}|${i}" aria-label="Remove row">${icon('trash')}</button>`;
      if (single) { const c = f.cols[0]; return `<div class="gr single"><span class="gr-t">${h(title)}</span><div class="gr-in">${fieldHTML({ ...c, l: '', al: `${title} – ${c.l}` }, r[c.k], `${f.k}|${i}|${c.k}`)}</div>${del}</div>`; }
      return `<div class="gr"><div class="gr-h"><span class="gr-t">${h(title)}</span>${del}</div><div class="gr-cells">${f.cols.map(c => `<div class="fld ${c.t === 'text' ? 'wide' : ''}">${fieldHTML(c, r[c.k], `${f.k}|${i}|${c.k}`)}</div>`).join('')}</div></div>`;
    }).join('');
  }
  function formHTML(calc, raw) {
    return calc.fields.map(f => {
      const hid = visible(f, raw) ? '' : ' hidden';
      if (f.t === 'head') return `<h3 class="fhead" data-f="${f.k}"${hid}>${h(f.l)}</h3>`;
      if (f.t === 'grid') return `<div class="fld grid-f" data-f="${f.k}"${hid}><div class="gf-h"><span class="lbl">${h(f.l)}</span><span class="gf-n">${raw[f.k].length} rows</span></div><div class="gf-rows" id="g_${f.k}">${gridRowsHTML(f, raw[f.k])}</div><button type="button" class="btn ghost add" data-add="${f.k}">${icon('plus')}${h(f.add || 'Add row')}</button></div>`;
      return `<div class="fld${f.t === 'check' ? ' chk' : ''}" data-f="${f.k}"${hid}>${fieldHTML(f, raw, f.k)}</div>`;
    }).join('');
  }

  function renderCalc(id, preset) {
    const calc = CALCS.find(c => c.id === id);
    if (!calc) { location.hash = '#/'; return; }
    const draft = preset || store.get('catk.draft.' + id, null);
    const def = defaults(calc);
    let raw = def;
    if (draft && draft.raw && typeof draft.raw === 'object') {
      raw = Object.assign({}, def);
      calc.fields.forEach(f => {
        if (f.t === 'head' || !(f.k in draft.raw)) return;
        const d = draft.raw[f.k];
        if (f.t === 'grid') { if (Array.isArray(d) && d.length) raw[f.k] = d.map(r => { const o = {}; f.cols.forEach(c => (o[c.k] = r && r[c.k] != null ? r[c.k] : def[f.k][0] && c.t === 'select' ? c.opts[0][0] : '')); return o; }); }
        else if (f.t === 'check') raw[f.k] = !!d;
        else if (f.t === 'select') raw[f.k] = f.opts.some(o => String(o[0]) === String(d)) ? String(d) : def[f.k];
        else raw[f.k] = d == null ? '' : String(d);
      });
    }
    cur = { calc, raw, unit: (draft && draft.unit) || calc.unit, ref: (draft && draft.ref) || '', result: null };
    setTop(calc.short, true); setTab('calc');
    view().innerHTML = `
      <div class="calc-wrap">
        <section class="pane form-pane">
          <header class="calc-h"><span class="tile big cat-${calc.cat}">${icon(calc.icon)}</span><div><h1>${h(calc.title)}</h1><p>${h(calc.desc)}</p></div></header>
          <div class="meta-row">
            <label class="ref">${icon('user')}<input id="ref" type="text" placeholder="Client / reference" value="${h(cur.ref)}" autocomplete="off"></label>
            <select id="unit" aria-label="Amount unit">${Object.entries(UNITS).map(([k, l]) => `<option value="${k}" ${cur.unit === k ? 'selected' : ''}>${l}</option>`).join('')}</select>
          </div>
          <div class="mini-actions"><button type="button" class="btn ghost sm" id="sampleBtn">${icon('sample')}Sample data</button><button type="button" class="btn ghost sm" id="clearBtn">${icon('clear')}Clear</button></div>
          <form id="form" class="form" autocomplete="off" onsubmit="return false">${formHTML(calc, raw)}</form>
        </section>
        <section class="pane res-pane"><div class="actbar-d">${[['save', 'Save'], ['pdf', 'PDF'], ['excel', 'Excel'], ['share', 'Share']].map(([i, l]) => `<button type="button" class="btn ${i === 'pdf' ? '' : 'ghost'} sm" data-need="1" data-act="${i}">${icon(i)}${l}</button>`).join('')}</div><div id="results" aria-live="polite"></div></section>
      </div>`;
    const form = $('#form');
    form.addEventListener('input', onInput);
    form.addEventListener('change', onInput);
    form.addEventListener('click', onFormClick);
    $('#ref').addEventListener('input', e => { cur.ref = e.target.value; saveDraft(); });
    $('#unit').addEventListener('change', e => { cur.unit = e.target.value; saveDraft(); run(); });
    const replaceAll = (next, msg) => {
      const prev = JSON.parse(JSON.stringify(cur.raw));
      cur.raw = next; form.innerHTML = formHTML(calc, cur.raw); saveDraft(); run();
      toast(msg, { label: 'Undo', fn: () => { cur.raw = prev; form.innerHTML = formHTML(calc, cur.raw); saveDraft(); run(); } });
    };
    $('#sampleBtn').onclick = () => replaceAll(defaults(calc), 'Sample data loaded');
    view().querySelector('.actbar-d').addEventListener('click', e => { const b = e.target.closest('button'); if (b) ({ save: doSave, pdf: doPDF, excel: doXLSX, share: doShare })[b.dataset.act](); });
    $('#clearBtn').onclick = () => replaceAll(blank(calc), 'All inputs cleared');
    run();
    window.scrollTo(0, 0);
    if (peekObs) peekObs.disconnect();
    if ('IntersectionObserver' in window) { peekObs = new IntersectionObserver(en => document.body.classList.toggle('res-vis', en[0].isIntersecting)); peekObs.observe($('#results')); }
  }
  function setPath(path, val) {
    const p = path.split('|');
    if (p.length === 1) cur.raw[p[0]] = val; else cur.raw[p[0]][+p[1]][p[2]] = val;
  }
  function onInput(e) {
    const el = e.target; if (!el.dataset.p) return;
    setPath(el.dataset.p, el.type === 'checkbox' ? el.checked : el.value);
    const vh = el.closest('.fld, .gr-in') && el.closest('.fld, .gr-in').querySelector(`[data-vh="${CSS.escape(el.dataset.p)}"]`);
    if (vh) vh.textContent = amtHint(el.value);
    if (el.tagName === 'SELECT' || el.type === 'checkbox') refreshVisibility();
    saveDraft();
    clearTimeout(calcT); calcT = setTimeout(run, e.type === 'change' ? 0 : 220);
  }
  function onFormClick(e) {
    const add = e.target.closest('[data-add]'), del = e.target.closest('[data-del]'), pm = e.target.closest('[data-pm]');
    if (pm) {
      const inp = pm.parentElement.querySelector('input');
      const v = inp.value.trim();
      inp.value = v.startsWith('-') ? v.slice(1) : '-' + v;
      setPath(inp.dataset.p, inp.value);
      const vh = pm.closest('.fld, .gr-in').querySelector('.vh'); if (vh) vh.textContent = amtHint(inp.value);
      saveDraft(); run(); return;
    }
    if (add) {
      const f = cur.calc.fields.find(x => x.k === add.dataset.add);
      const rows = cur.raw[f.k], i = rows.length;
      const base = f.newRow ? f.newRow(i) : {};
      const o = {}; f.cols.forEach(c => (o[c.k] = toRaw(c.t, base[c.k] ?? (c.t === 'select' ? c.opts[0][0] : ''))));
      rows.push(o); redrawGrid(f); saveDraft(); run();
      const last = $('#g_' + f.k).lastElementChild; const inp = last && last.querySelector('input:not([type=checkbox]),select'); if (inp) inp.focus();
    }
    if (del) {
      const [k, i] = del.dataset.del.split('|');
      const f = cur.calc.fields.find(x => x.k === k);
      if (cur.raw[k].length <= 1) { toast('At least one row is needed'); return; }
      cur.raw[k].splice(+i, 1); redrawGrid(f); saveDraft(); run();
    }
  }
  function redrawGrid(f) {
    $('#g_' + f.k).innerHTML = gridRowsHTML(f, cur.raw[f.k]);
    $(`[data-f="${f.k}"] .gf-n`).textContent = cur.raw[f.k].length + ' rows';
  }
  function refreshVisibility() {
    cur.calc.fields.forEach(f => { const el = $(`[data-f="${f.k}"]`); if (el) el.hidden = !visible(f, cur.raw); });
  }
  function saveDraft() { store.set('catk.draft.' + cur.calc.id, { raw: cur.raw, unit: cur.unit, ref: cur.ref }); }

  function run() {
    if (!cur) return;
    const out = $('#results');
    const { v, bad, neg } = values(cur.calc, cur.raw);
    try {
      if (bad.length) throw Object.assign(new Error('Check the number entered in: ' + bad.join(', ')), { user: true });
      if (neg.length) throw Object.assign(new Error('These cannot be negative: ' + neg.join(', ')), { user: true });
      cur.result = cur.calc.compute(v);
      cur.values = v;
      out.innerHTML = resultsHTML(cur.result);
      bindResults(out);
      const mk = cur.result.summary.find(x => x.main) || cur.result.summary[0];
      $('#peek').innerHTML = `<span>${h(mk.l)}</span><b>${h(fmt(mk.v, mk.f))}</b><em>View ↓</em>`;
      $('#peek').classList.add('has');
    } catch (err) {
      cur.result = null;
      $('#peek').classList.remove('has');
      if (!err.user) console.error(err);
      out.innerHTML = `<div class="res-empty">${icon('sample')}<p>${h(err.user ? err.message : 'Something went wrong with these inputs. Please review them.')}</p></div>`;
    }
    document.querySelectorAll('[data-need]').forEach(b => (b.disabled = !cur.result));
  }

  function resultsHTML(r) {
    const main = r.summary.find(s => s.main) || r.summary[0];
    const rest = r.summary.filter(s => s !== main);
    let html = `<div class="res-head"><span class="eyebrow">Result · ${h(UNITS[cur.unit])}</span></div>
      <div class="kpi-main ${main.tone || ''}"><span>${h(main.l)}</span><b>${h(fmt(main.v, main.f))}</b></div>`;
    if (r.verdict) html += `<div class="verdict ${r.verdict.tone}">${h(r.verdict.text)}</div>`;
    if (rest.length) html += `<div class="kpis">${rest.map(s => `<div class="kpi ${s.tone || ''}"><span>${h(s.l)}</span><b>${h(fmt(s.v, s.f))}</b></div>`).join('')}</div>`;
    if (r.chart) html += `<figure class="chart card">${chartSVG(r.chart)}<figcaption>${h(r.chart.title)}</figcaption></figure>`;
    if (r.steps && r.steps.length) html += `<details class="card acc" open><summary>Workings <span class="cnt">${r.steps.length}</span></summary><ol class="steps">${r.steps.map(s => `
      <li><div class="st-h"><b>${h(s.t)}</b>${s.r ? `<em>${h(s.r)}</em>` : ''}</div><code>${h(s.f)}</code>${s.c ? `<p>${h(s.c)}</p>` : ''}</li>`).join('')}</ol></details>`;
    (r.tables || []).forEach((t, ti) => {
      const lim = t.limit && t.rows.length > t.limit ? t.limit : 0;
      html += `<details class="card acc" ${t.rows.length > 40 ? '' : 'open'}><summary>${h(t.title)} <span class="cnt">${t.rows.length}</span></summary><div class="tbl-wrap"><table class="tbl"><thead><tr>${t.cols.map(c => `<th class="${isNumF(c[1]) ? 'n' : ''}">${h(c[0])}</th>`).join('')}</tr></thead><tbody>${t.rows.map((row, ri) => `<tr${lim && ri >= lim ? ' class="more" hidden' : ''}>${row.map((x, i) => `<td class="${isNumF(t.cols[i][1]) ? 'n' : ''}">${h(cell(x, t.cols[i][1]))}</td>`).join('')}</tr>`).join('')}</tbody>${t.total ? `<tfoot><tr>${t.total.map((x, i) => `<td class="${isNumF(t.cols[i][1]) ? 'n' : ''}">${h(cell(x, t.cols[i][1]))}</td>`).join('')}</tr></tfoot>` : ''}</table></div>${lim ? `<button type="button" class="btn ghost sm showall" data-t="${ti}">Show all ${t.rows.length} rows</button>` : ''}</details>`;
    });
    if (r.notes && r.notes.length) html += `<ul class="notes">${r.notes.map(n => `<li>${h(n)}</li>`).join('')}</ul>`;
    return html;
  }
  const isNumF = f => ['money', 'int', 'pct', 'pct4', 'x', 'ratio', 'days', 'yrs', 'n4', 'num', 'mixed'].includes(f);
  const cell = (x, f) => (x == null || x === '' ? '' : f === 'mixed' ? x : fmt(x, f));
  function bindResults(out) {
    out.querySelectorAll('.showall').forEach(b => b.addEventListener('click', () => { b.previousElementSibling.querySelectorAll('tr.more').forEach(tr => (tr.hidden = false)); b.remove(); }));
  }

  /* ---------- charts (SVG) ---------- */
  function niceMax(v) { if (v <= 0) return 1; const p = Math.pow(10, Math.floor(Math.log10(v))); const m = v / p; return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p; }
  const short = v => { const a = Math.abs(v), t = (x, u) => (+x.toFixed(2)).toString() + u; if (a >= 1e7) return t(v / 1e7, 'Cr'); if (a >= 1e5) return t(v / 1e5, 'L'); if (a >= 1e3) return t(v / 1e3, 'K'); return t(v, ''); };
  function chartSVG(c) {
    const W = 600, H = 250, L = 52, R = 14, T = 14, B = 34, iw = W - L - R, ih = H - T - B;
    const n = c.labels.length;
    let vals = [];
    if (c.type === 'bar' && c.stacked) vals = c.labels.map((_, i) => c.series.reduce((s, se) => s + (se.data[i] || 0), 0));
    else c.series.forEach(s => s.data.forEach(x => x != null && vals.push(x)));
    if (c.ref) vals.push(c.ref.v);
    let mx = Math.max(0, ...vals), mn = Math.min(0, ...vals);
    mx = niceMax(mx); mn = mn < 0 ? -niceMax(-mn) : 0;
    const Y = v => T + ih - ((v - mn) / (mx - mn)) * ih;
    let g = '';
    for (let i = 0; i <= 4; i++) { const v = mn + ((mx - mn) * i) / 4, y = Y(v); g += `<line x1="${L}" x2="${W - R}" y1="${y}" y2="${y}" class="gl"/><text x="${L - 6}" y="${y + 4}" class="ax" text-anchor="end">${h(c.f === 'x' ? v.toFixed(1) : short(v))}</text>`; }
    const step = Math.max(1, Math.ceil(n / 10));
    const bw = iw / n;
    c.labels.forEach((l, i) => { if (i % step === 0) g += `<text x="${L + bw * i + bw / 2}" y="${H - 12}" class="ax" text-anchor="middle">${h(l)}</text>`; });
    if (c.type === 'bar') {
      const inner = Math.min(46, bw * 0.62);
      c.labels.forEach((_, i) => {
        const x = L + bw * i + (bw - inner) / 2;
        let base = 0;
        c.series.forEach((s, si) => {
          const v = s.data[i]; if (v == null) return;
          const y0 = c.stacked ? base : 0, y1 = y0 + v;
          const top = Y(Math.max(y0, y1)), bot = Y(Math.min(y0, y1));
          g += `<rect x="${x}" y="${top}" width="${inner}" height="${Math.max(0.5, bot - top)}" rx="3" class="s${si}${!c.stacked && c.ref && v < c.ref.v && c.f === 'x' ? ' low' : ''}"><title>${h(c.labels[i])}: ${h(fmt(v, c.f))}</title></rect>`;
          if (c.stacked) base = y1;
        });
      });
    } else {
      const X = i => L + (iw * i) / Math.max(1, n - 1);
      c.series.forEach((s, si) => { g += `<polyline fill="none" class="ln s${si}" points="${s.data.map((v, i) => X(i) + ',' + Y(v)).join(' ')}"/>`; });
    }
    if (c.ref) { const y = Y(c.ref.v); g += `<line x1="${L}" x2="${W - R}" y1="${y}" y2="${y}" class="ref"/>${c.ref.l ? `<text x="${W - R}" y="${y - 5}" class="ax refl" text-anchor="end">${h(c.ref.l)}</text>` : ''}`; }
    const leg = c.series.length > 1 ? `<div class="legend">${c.series.map((s, i) => `<span><i class="s${i}"></i>${h(s.name)}</span>`).join('')}</div>` : '';
    return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${h(c.title)}">${g}</svg>${leg}`;
  }

  /* ---------- report / exports ---------- */
  function today() { const d = new Date(); return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`; }
  function inputFmt(f, rawVal, val) {
    if (f.t === 'select') { const o = f.opts.find(x => String(x[0]) === String(rawVal)); return o ? o[1] : rawVal; }
    if (f.t === 'check') return val ? 'Yes' : 'No';
    if (f.t === 'date') return fmtDate(rawVal);
    if (f.t === 'text') return rawVal || '—';
    if (val == null) return '—';
    if (f.t === 'pct') return fmt(val, 'pct');
    if (f.t === 'num') return fmt(val, 'num') + (f.suf ? ' ' + f.suf : '');
    return fmt(val, 'money');
  }
  const xlF = t => (t === 'pct' ? 'pct' : t === 'num' ? 'num' : NUMT.includes(t) ? 'money' : 'text');
  function buildReport() {
    const { calc, raw, values: v, result: r } = cur;
    const inputs = [], inputsRaw = [], inputTables = [];
    calc.fields.forEach(f => {
      if (f.t === 'head' || !visible(f, raw)) return;
      if (f.t === 'grid') {
        const label = f.rowLabel ? [['Period', 'text']] : [];
        const cols = [...label, ...f.cols.map(c => [c.l, xlF(c.t)])];
        const rowsV = v[f.k], rowsR = raw[f.k];
        inputTables.push({
          title: f.l, cols,
          rows: rowsV.map((row, i) => [...(f.rowLabel ? [f.rowLabel(i)] : []), ...f.cols.map(c => inputFmt(c, rowsR[i][c.k], row[c.k]))]),
          raw: rowsV.map((row, i) => [...(f.rowLabel ? [f.rowLabel(i)] : []), ...f.cols.map(c => (c.t === 'select' ? inputFmt(c, rowsR[i][c.k]) : c.t === 'date' ? fmtDate(row[c.k]) : row[c.k]))])
        });
        return;
      }
      inputs.push([f.l, inputFmt(f, raw[f.k], v[f.k])]);
      inputsRaw.push([f.l, f.t === 'select' || f.t === 'check' ? inputFmt(f, raw[f.k], v[f.k]) : v[f.k], xlF(f.t)]);
    });
    return {
      title: calc.title, firm: settings.firm || 'CA Financial Toolkit', preparedBy: settings.prepared, date: today(), ref: cur.ref, unitLabel: UNITS[cur.unit],
      verdict: r.verdict || null,
      summary: r.summary.map(s => [s.l, fmt(s.v, s.f)]), summaryRaw: r.summary,
      inputs, inputsRaw, inputTables,
      steps: r.steps || [],
      tables: (r.tables || []).map(t => ({ ...t, frows: t.rows.map(row => row.map((x, i) => cell(x, t.cols[i][1]))), ftotal: t.total ? t.total.map((x, i) => cell(x, t.cols[i][1])) : null })),
      notes: [...(r.notes || []), 'Computed with CA Financial Toolkit from the inputs shown. This is a calculation aid, not financial, tax or credit advice; verify before reliance.']
    };
  }
  function fileBase() {
    const d = new Date();
    const ref = cur.ref ? '_' + cur.ref.replace(/[^\w-]+/g, '_').slice(0, 30) : '';
    return `${cur.calc.short.replace(/[^\w]+/g, '_')}${ref}_${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  }
  function download(blob, name) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name; a.rel = 'noopener';
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 5000);
  }
  function doPDF() { if (!cur.result) return; try { download(CAExport.buildPDF(buildReport()), fileBase() + '.pdf'); toast('PDF downloaded'); } catch (e) { console.error(e); toast('Could not create PDF'); } }
  function doXLSX() { if (!cur.result) return; try { download(CAExport.buildXLSX(buildReport()), fileBase() + '.xlsx'); toast('Excel file downloaded'); } catch (e) { console.error(e); toast('Could not create Excel file'); } }
  async function doShare() {
    if (!cur.result) return;
    const rep = buildReport();
    const text = `${rep.title}${rep.ref ? ' — ' + rep.ref : ''}\n(Amounts in ${rep.unitLabel})\n\n` + rep.summary.map(s => `${s[0]}: ${s[1]}`).join('\n') + (rep.verdict ? `\n\n${rep.verdict.text}` : '');
    try {
      const file = new File([CAExport.buildPDF(rep)], fileBase() + '.pdf', { type: 'application/pdf' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: rep.title, text }); return; }
      if (navigator.share) { await navigator.share({ title: rep.title, text }); return; }
      await navigator.clipboard.writeText(text); toast('Summary copied to clipboard');
    } catch (e) { if (e.name !== 'AbortError') { try { await navigator.clipboard.writeText(text); toast('Summary copied to clipboard'); } catch (_) { toast('Sharing not supported on this device'); } } }
  }
  function doSave() {
    if (!cur.result) return;
    const main = cur.result.summary.find(s => s.main) || cur.result.summary[0];
    history.unshift({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), calc: cur.calc.id, ref: cur.ref, unit: cur.unit, raw: JSON.parse(JSON.stringify(cur.raw)), head: { l: main.l, v: fmt(main.v, main.f) }, ts: Date.now() });
    if (history.length > 300) history.length = 300;
    store.set('catk.history', history);
    toast('Saved to history', { label: 'View', fn: () => (location.hash = '#/history') });
  }

  /* History */
  let histQ = '';
  function renderHistory() {
    setTop('Saved history', false); setTab('history');
    view().innerHTML = `
      <section class="page">
        <div class="page-h"><h1>Saved calculations</h1><p>${history.length} saved · stored on this device</p></div>
        <label class="search">${icon('search')}<input id="hq" type="search" placeholder="Search client, calculator…" value="${h(histQ)}"></label>
        <div id="hlist"></div>
        <div class="row-actions">
          <button class="btn ghost" id="bkExp">${icon('download')}Backup</button>
          <label class="btn ghost">${icon('upload')}Restore<input type="file" id="bkImp" accept="application/json,.json" hidden></label>
          <button class="btn ghost danger" id="hClear" ${history.length ? '' : 'disabled'}>${icon('trash')}Clear all</button>
        </div>
      </section>`;
    const draw = () => {
      const q = histQ.trim().toLowerCase();
      const list = history.filter(x => { const c = CALCS.find(k => k.id === x.calc); return c && (!q || (c.title + ' ' + c.short + ' ' + (x.ref || '')).toLowerCase().includes(q)); });
      if (!list.length) { $('#hlist').innerHTML = `<div class="res-empty">${icon('history')}<p>${history.length ? 'Nothing matches your search.' : 'No saved calculations yet. Use “Save” on any calculator to keep it here.'}</p></div>`; return; }
      let last = '', html = '';
      list.forEach(x => {
        const c = CALCS.find(k => k.id === x.calc), d = new Date(x.ts);
        const day = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
        if (day !== last) { html += `<h2 class="sec-h">${day}</h2>`; last = day; }
        html += `<div class="hitem"><a href="#/h/${x.id}" class="hmain"><span class="tile cat-${c.cat}">${icon(c.icon)}</span><span class="ht"><b>${h(x.ref || c.short)}</b><small>${h(c.title)} · ${d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</small></span><span class="hv"><small>${h(x.head.l)}</small><b>${h(x.head.v)}</b></span></a><button class="icon-btn" data-hdel="${x.id}" aria-label="Delete">${icon('trash')}</button></div>`;
      });
      $('#hlist').innerHTML = html;
    };
    draw();
    $('#hq').addEventListener('input', e => { histQ = e.target.value; draw(); });
    $('#hlist').addEventListener('click', e => {
      const b = e.target.closest('[data-hdel]'); if (!b) return;
      const idx = history.findIndex(x => x.id === b.dataset.hdel); if (idx < 0) return;
      const [rm] = history.splice(idx, 1); store.set('catk.history', history); draw();
      toast('Deleted', { label: 'Undo', fn: () => { history.splice(idx, 0, rm); store.set('catk.history', history); renderHistory(); } });
    });
    $('#hClear').onclick = () => { if (confirm('Delete all saved calculations? This cannot be undone.')) { history = []; store.set('catk.history', history); renderHistory(); } };
    $('#bkExp').onclick = () => download(new Blob([JSON.stringify({ app: 'ca-toolkit', v: 1, history }, null, 1)], { type: 'application/json' }), `CA_Toolkit_backup_${today()}.json`);
    $('#bkImp').onchange = e => {
      const f = e.target.files[0]; if (!f) return;
      f.text().then(t => {
        const d = JSON.parse(t); if (!d || !Array.isArray(d.history)) throw 0;
        const ids = new Set(history.map(x => x.id)); let n = 0;
        d.history.forEach(x => { if (x && x.id && x.calc && !ids.has(x.id)) { history.push(x); n++; } });
        history.sort((a, b) => b.ts - a.ts); store.set('catk.history', history); renderHistory(); toast(`Restored ${n} item(s)`);
      }).catch(() => toast('That file is not a valid backup'));
    };
  }
  function openHistory(id) {
    const x = history.find(k => k.id === id);
    if (!x) { location.hash = '#/history'; return; }
    store.set('catk.draft.' + x.calc, { raw: x.raw, unit: x.unit, ref: x.ref });
    location.replace('#/c/' + x.calc);
  }

  /* Settings */
  let deferredPrompt = null, navs = 0;
  function renderSettings() {
    setTop('Settings', false); setTab('settings');
    const installed = isInstalled();
    view().innerHTML = `
      <section class="page">
        <div class="page-h"><h1>Settings</h1><p>Report header and app preferences</p></div>
        <div class="card form">
          <div class="fld"><label class="lbl" for="sFirm">Firm name (report header)</label><input id="sFirm" type="text" value="${h(settings.firm)}" placeholder="Your firm name"></div>
          <div class="fld"><label class="lbl" for="sPrep">Prepared by (optional)</label><input id="sPrep" type="text" value="${h(settings.prepared)}" placeholder="e.g. CA A. Sharma, Partner"></div>
          <div class="fld"><label class="lbl" for="sTheme">Appearance</label><select id="sTheme">${[['system', 'Match device'], ['light', 'Light'], ['dark', 'Dark']].map(o => `<option value="${o[0]}" ${settings.theme === o[0] ? 'selected' : ''}>${o[1]}</option>`).join('')}</select></div>
        </div>
        <div class="card about">
          <div class="ab-row"><span>Version</span><b>${VERSION}</b></div>
          <div class="ab-row"><span>Offline ready</span><b id="offState">${'serviceWorker' in navigator && navigator.serviceWorker.controller ? 'Yes' : 'After first reload'}</b></div>
          <div class="ab-row"><span>Saved calculations</span><b>${history.length}</b></div>
          <div class="row-actions">
            ${installed ? '' : `<button class="btn" id="sInstall" ${deferredPrompt ? '' : 'hidden'}>${icon('install')}Install app</button>`}
            <button class="btn ghost" id="sUpd">${icon('reset')}Check for updates</button>
          </div>
          ${installed || deferredPrompt ? '' : '<p class="hint">To install: open the browser menu (⋮) and tap “Install app” / “Add to Home screen”.</p>'}
        </div>
        <div class="card about">
          <a class="ab-row link" href="privacy.html"><span>Privacy policy</span><b>›</b></a>
          <div class="disclaimer"><b>Disclaimer.</b> Results are computational aids based solely on the figures you enter. They are not financial, tax, legal or credit advice, and bank or regulatory norms shown are indicative only. Verify all outputs before relying on them. Not affiliated with ICAI, RBI or any bank.</div>
        </div>
        <p class="credit">All calculations run on this device; no data is collected or uploaded.<br>CA Financial Toolkit</p>
      </section>`;
    const save = () => { store.set('catk.settings', settings); };
    $('#sFirm').oninput = e => { settings.firm = e.target.value; save(); };
    $('#sPrep').oninput = e => { settings.prepared = e.target.value; save(); };
    $('#sTheme').onchange = e => { settings.theme = e.target.value; save(); applyTheme(); };
    const ib = $('#sInstall'); if (ib) ib.onclick = promptInstall;
    $('#sUpd').onclick = async () => {
      if (!('serviceWorker' in navigator)) return toast('Not supported in this browser');
      const reg = await navigator.serviceWorker.getRegistration();
      if (!reg) return toast('Offline support not active yet');
      try { await reg.update(); toast(reg.installing || reg.waiting ? 'Update found — downloading' : 'You have the latest version'); } catch (e) { toast('Could not check — are you offline?'); }
    };
  }
  async function promptInstall() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    $('#installBtn').hidden = true;
  }

  /* ---------- router ---------- */
  function route() {
    const hsh = location.hash || '#/';
    const m = hsh.match(/^#\/(c|h)\/([\w-]+)/);
    document.body.classList.remove('kb');
    if (m && m[1] === 'c') renderCalc(m[2]);
    else if (m && m[1] === 'h') openHistory(m[2]);
    else if (hsh.startsWith('#/history')) renderHistory();
    else if (hsh.startsWith('#/settings')) renderSettings();
    else renderHome();
  }

  /* ---------- boot ---------- */
  function boot() {
    applyTheme();
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);
    $('#backBtn').innerHTML = icon('back');
    $('#backBtn').onclick = () => { if (navs > 0) window.history.back(); else location.hash = '#/'; };
    $('#installBtn').innerHTML = icon('install') + '<span>Install</span>';
    $('#installBtn').onclick = promptInstall;
    document.querySelectorAll('.tabbar a').forEach(a => { a.innerHTML = icon(a.dataset.icon) + `<span>${a.textContent}</span>`; });
    const ab = $('#actbar');
    ab.innerHTML = [['save', 'Save', doSave], ['pdf', 'PDF', doPDF], ['excel', 'Excel', doXLSX], ['share', 'Share', doShare]].map(([i, l]) => `<button type="button" data-need="1" data-act="${i}">${icon(i)}<span>${l}</span></button>`).join('');
    ab.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; ({ save: doSave, pdf: doPDF, excel: doXLSX, share: doShare })[b.dataset.act](); });
    window.addEventListener('hashchange', () => { navs++; route(); });
    $('#peek').onclick = () => $('#results').scrollIntoView({ behavior: 'smooth', block: 'start' });
    route();

    window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); if (isInstalled()) return; deferredPrompt = e; $('#installBtn').hidden = false; const s = $('#sInstall'); if (s) s.hidden = false; });
    window.addEventListener('appinstalled', () => { deferredPrompt = null; $('#installBtn').hidden = true; toast('App installed'); });

    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js', { scope: './' }).then(reg => {
          const notify = w => toast('A new version is ready', { label: 'Update', fn: () => w.postMessage('skip') });
          if (reg.waiting && navigator.serviceWorker.controller) notify(reg.waiting);
          reg.addEventListener('updatefound', () => {
            const w = reg.installing;
            w && w.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) notify(w); });
          });
        }).catch(err => console.warn('SW registration failed', err));
        let reloaded = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => { if (!reloaded) { reloaded = true; location.reload(); } });
      });
    }
    window.addEventListener('online', () => document.body.classList.remove('offline'));
    window.addEventListener('offline', () => { document.body.classList.add('offline'); toast('You are offline — calculators keep working'); });
  }
  boot();
})();
