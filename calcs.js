/* CA Financial Toolkit — calculation engine (pure functions, no DOM) */
(function (G) {
  'use strict';

  /* ---------- formatting ---------- */
  const nf = d => new Intl.NumberFormat('en-IN', { minimumFractionDigits: d, maximumFractionDigits: d });
  const F0 = nf(0), F2 = nf(2), F4 = nf(4);
  const isNum = x => typeof x === 'number' && isFinite(x);
  const N = x => (isNum(x) ? x : 0);
  const div = (a, b) => (isNum(a) && isNum(b) && b !== 0 ? a / b : null);
  const z = x => (Object.is(x, -0) ? 0 : x);

  function fmtDate(s) {
    if (!s) return '—';
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    return m ? `${m[3]}-${m[2]}-${m[1]}` : String(s);
  }
  function fmt(v, t) {
    if (t === 'date') return fmtDate(v);
    if (t === 'text' || typeof v === 'string') return v == null || v === '' ? '—' : String(v);
    if (!isNum(v)) return '—';
    const dp = t === 'int' || t === 'days' ? 0 : t === 'pct4' || t === 'n4' ? 4 : 2;
    v = z(Number(v.toFixed(dp)));
    switch (t) {
      case 'int': return F0.format(z(Math.round(v)));
      case 'pct': return F2.format(z(v)) + '%';
      case 'pct4': return F4.format(z(v)) + '%';
      case 'x': return F2.format(z(v)) + 'x';
      case 'ratio': return F2.format(z(v));
      case 'days': return F0.format(z(Math.round(v))) + ' days';
      case 'yrs': return F2.format(z(v)) + ' yrs';
      case 'n4': return F4.format(z(v));
      default: return F2.format(z(v));
    }
  }
  const f2 = v => fmt(v, 'money');
  const compact = v => { const a = Math.abs(v); const t = (x, s) => (+x.toFixed(1)).toString() + s; return a >= 1e7 ? t(v / 1e7, 'Cr') : a >= 1e5 ? t(v / 1e5, 'L') : a >= 1e3 ? t(v / 1e3, 'K') : (+v.toFixed(2)).toString(); };
  const pc = v => fmt(v, 'pct');

  function UErr(msg) { const e = new Error(msg); e.user = true; return e; }
  const step = (t, f, c, r) => ({ t, f, c, r });

  /* ---------- financial maths ---------- */
  function bisect(f, a, b) {
    let fa = f(a);
    for (let i = 0; i < 200; i++) {
      const m = (a + b) / 2, fm = f(m);
      if (fm === 0) return m;
      if (fa * fm < 0) b = m; else { a = m; fa = fm; }
      if (Math.abs(b - a) < 1e-14) break;
    }
    return (a + b) / 2;
  }
  // all sign-change roots of f on (-0.99, 1000)
  function findRoots(f) {
    const g = [];
    for (let i = -99; i < 0; i++) g.push(i / 100);
    for (let i = 0; i < 400; i++) g.push(i / 400);           // 0 .. 1 step 0.0025
    for (let i = 0; i <= 180; i++) g.push(1 + i * 0.05);     // 1 .. 10
    for (let r = 10.5; r <= 1000; r *= 1.15) g.push(r);
    const roots = [];
    let pr = g[0], pf = f(pr);
    for (let i = 1; i < g.length; i++) {
      const r = g[i], fv = f(r);
      if (isFinite(fv) && isFinite(pf)) {
        if (fv === 0) roots.push(r);
        else if (pf * fv < 0) roots.push(bisect(f, pr, r));
      }
      pr = r; pf = fv;
    }
    return roots.filter((r, i) => i === 0 || Math.abs(r - roots[i - 1]) > 1e-9);
  }
  function pickRoot(roots) {
    if (!roots.length) return null;
    return roots.reduce((a, b) => (Math.abs(b - 0.1) < Math.abs(a - 0.1) ? b : a));
  }
  const npvAt = (r, flows) => flows.reduce((s, cf, t) => s + cf / Math.pow(1 + r, t), 0);
  function irr(flows) {
    const roots = findRoots(r => npvAt(r, flows));
    return { r: pickRoot(roots), roots };
  }
  const DAY = 86400000;
  const dParse = s => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ''); return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : NaN; };
  function xirr(items) { // [{t: years, cf}]
    const f = r => items.reduce((s, it) => s + it.cf / Math.pow(1 + r, it.t), 0);
    const roots = findRoots(f);
    return { r: pickRoot(roots), roots };
  }
  function signChanges(a) {
    let c = 0, p = 0;
    a.forEach(x => { if (x !== 0) { const s = Math.sign(x); if (p && s !== p) c++; p = s; } });
    return c;
  }
  function payback(flows) { // flows[0] negative outlay
    let cum = flows[0];
    if (cum >= 0) return 0;
    for (let t = 1; t < flows.length; t++) {
      const prev = cum; cum += flows[t];
      if (cum >= 0 && flows[t] > 0) return t - 1 + -prev / flows[t];
    }
    return null;
  }
  function emiOf(P, annualPct, n) {
    const i = annualPct / 1200;
    if (n <= 0) return null;
    return i === 0 ? P / n : (P * i * Math.pow(1 + i, n)) / (Math.pow(1 + i, n) - 1);
  }
  function pvAnnuity(pmt, annualPct, n) {
    const i = annualPct / 1200;
    return i === 0 ? pmt * n : (pmt * (1 - Math.pow(1 + i, -n))) / i;
  }
  const hasVal = (row, keys) => keys.some(k => isNum(row[k]));
  const trimRows = (rows, keys) => { const r = rows.slice(); while (r.length && !hasVal(r[r.length - 1], keys)) r.pop(); return r; };

  /* ---------- calculator registry ---------- */
  const CATS = [
    ['credit', 'Banking & Credit'],
    ['invest', 'Investment Appraisal'],
    ['loan', 'Loans & Interest'],
    ['analysis', 'Financial Analysis'],
    ['tax', 'Tax & Others']
  ];
  const CALCS = [];
  const def = c => CALCS.push(c);

  /* 1. DSCR */
  def({
    id: 'dscr', short: 'DSCR', title: 'Debt Service Coverage Ratio', cat: 'credit', icon: 'shield', unit: 'lakh',
    desc: 'Year-wise, average and minimum DSCR for term-loan appraisal.',
    fields: [
      { k: 'thr', l: 'Benchmark DSCR', t: 'num', d: 1.25, hint: 'Commonly 1.25 – 1.50 for term loans' },
      { k: 'yrs', l: 'Projected years', t: 'grid', add: 'Add year', newRow: i => ({ y: 'Year ' + (i + 1) }),
        cols: [
          { k: 'y', l: 'Year', t: 'text' },
          { k: 'pat', l: 'Profit after tax', t: 'money' },
          { k: 'dep', l: 'Depreciation', t: 'money' },
          { k: 'int', l: 'Interest on term loan', t: 'money' },
          { k: 'oth', l: 'Other non-cash add-backs', t: 'money' },
          { k: 'prin', l: 'Principal repayment', t: 'money' }
        ],
        d: [
          { y: 'Year 1', pat: 18, dep: 12, int: 9.5, oth: 0, prin: 15 },
          { y: 'Year 2', pat: 24, dep: 10.5, int: 8.2, oth: 0, prin: 15 },
          { y: 'Year 3', pat: 29, dep: 9.2, int: 6.8, oth: 0, prin: 15 },
          { y: 'Year 4', pat: 33, dep: 8.1, int: 5.3, oth: 0, prin: 15 },
          { y: 'Year 5', pat: 36, dep: 7.1, int: 3.8, oth: 0, prin: 15 }
        ] }
    ],
    compute(v) {
      const keys = ['pat', 'dep', 'int', 'oth', 'prin'];
      const rows = v.yrs.filter(r => hasVal(r, keys));
      if (!rows.length) throw UErr('Enter at least one year of projections.');
      let tn = 0, td = 0;
      const list = [];
      const trows = rows.map((r, i) => {
        const nu = N(r.pat) + N(r.dep) + N(r.int) + N(r.oth), de = N(r.int) + N(r.prin);
        const d = div(nu, de); tn += nu; td += de; list.push(d);
        return [r.y || 'Year ' + (i + 1), N(r.pat), N(r.dep), N(r.int), N(r.oth), nu, N(r.prin), de, d];
      });
      if (td <= 0) throw UErr('Debt service (interest + principal) must be greater than zero.');
      const avg = tn / td;
      const valid = list.map((d, i) => [d, i]).filter(p => p[0] != null);
      const mn = valid.reduce((a, b) => (b[0] < a[0] ? b : a));
      const mx = valid.reduce((a, b) => (b[0] > a[0] ? b : a));
      const simple = valid.reduce((s, p) => s + p[0], 0) / valid.length;
      const thr = N(v.thr) || 1.25;
      const tone = avg >= thr && mn[0] >= 1 ? 'good' : avg >= 1 ? 'warn' : 'bad';
      const label = i => trows[i][0];
      return {
        summary: [
          { l: 'Average DSCR', v: avg, f: 'x', main: true, tone: avg >= thr ? 'good' : 'bad' },
          { l: 'Minimum DSCR (' + label(mn[1]) + ')', v: mn[0], f: 'x', tone: mn[0] >= 1 ? 'good' : 'bad' },
          { l: 'Maximum DSCR (' + label(mx[1]) + ')', v: mx[0], f: 'x' },
          { l: 'Simple average of yearly DSCR', v: simple, f: 'x' },
          { l: 'Total cash accruals for debt service', v: tn, f: 'money' },
          { l: 'Total debt service', v: td, f: 'money' }
        ],
        verdict: { tone, text: tone === 'good' ? `Average DSCR ${fmt(avg, 'x')} meets the benchmark of ${fmt(thr, 'x')} and no year falls below 1.00x.` : tone === 'warn' ? `Average DSCR ${fmt(avg, 'x')} is ${avg < thr ? 'below the benchmark of ' + fmt(thr, 'x') : 'adequate'}${mn[0] < 1 ? `, and ${label(mn[1])} is below 1.00x (cash shortfall)` : ''}. Consider restructuring repayment.` : `Average DSCR ${fmt(avg, 'x')} is below 1.00x — projected accruals do not cover debt service.` },
        steps: [
          step('DSCR formula', 'DSCR = (PAT + Depreciation + Interest on TL + Other non-cash items) ÷ (Interest on TL + Principal repayment)', 'Computed year-wise in the table below.', ''),
          step('Average DSCR', 'Average DSCR = Σ Cash accruals ÷ Σ Debt service', `${f2(tn)} ÷ ${f2(td)}`, fmt(avg, 'x')),
          step('Minimum DSCR', 'Lowest yearly DSCR across the repayment period', `${label(mn[1])}: ${f2(trows[mn[1]][5])} ÷ ${f2(trows[mn[1]][7])}`, fmt(mn[0], 'x')),
          step('Simple average', 'Σ yearly DSCR ÷ number of years', `${fmt(valid.reduce((s, p) => s + p[0], 0), 'ratio')} ÷ ${valid.length}`, fmt(simple, 'x'))
        ],
        tables: [{
          title: 'Year-wise DSCR',
          cols: [['Year', 'text'], ['PAT', 'money'], ['Depreciation', 'money'], ['Interest', 'money'], ['Other', 'money'], ['Cash accruals (A)', 'money'], ['Principal', 'money'], ['Debt service (B)', 'money'], ['DSCR (A÷B)', 'x']],
          rows: trows,
          total: ['Total', ...[1, 2, 3, 4, 5, 6, 7].map(c => trows.reduce((s, r) => s + r[c], 0)), avg]
        }],
        chart: { type: 'bar', title: 'Year-wise DSCR', labels: trows.map(r => r[0]), series: [{ name: 'DSCR', data: list }], ref: { v: thr, l: 'Benchmark ' + fmt(thr, 'x') }, f: 'x' },
        notes: ['Interest on working-capital loans is a revenue expense already netted in PAT; only term-loan interest is added back and included in debt service.', 'Banks generally use the aggregate method (Σ accruals ÷ Σ debt service) for average DSCR.']
      };
    }
  });

  /* 2. IRR */
  def({
    id: 'irr', short: 'IRR', title: 'IRR & MIRR', cat: 'invest', icon: 'trend', unit: 'lakh',
    desc: 'Internal rate of return and modified IRR for periodic (yearly) cash flows.',
    fields: [
      { k: 'inv', l: 'Initial investment (Year 0 outflow)', t: 'money', d: 1000 },
      { k: 'k', l: 'Cost of capital / reinvestment rate (for MIRR & NPV)', t: 'pct', d: 12 },
      { k: 'cf', l: 'Cash flows', t: 'grid', add: 'Add year', rowLabel: i => 'Year ' + (i + 1),
        cols: [{ k: 'a', l: 'Net cash flow (– for outflow)', t: 'signed' }],
        d: [{ a: 220 }, { a: 260 }, { a: 300 }, { a: 320 }, { a: 350 }] }
    ],
    compute(v) {
      const rows = trimRows(v.cf, ['a']);
      const flows = [-N(v.inv), ...rows.map(r => N(r.a))];
      if (flows.length < 2) throw UErr('Enter at least one year of cash flow.');
      if (!flows.some(x => x < 0) || !flows.some(x => x > 0)) throw UErr('Cash flows need at least one outflow and one inflow.');
      const res = irr(flows);
      if (res.r == null) throw UErr('IRR could not be found for these cash flows (no sign change in NPV between –99% and 100,000%).');
      const r = res.r, n = flows.length - 1, k = N(v.k) / 100;
      if (k <= -1) throw UErr('Cost of capital must be greater than –100%.');
      const fvPos = flows.reduce((s, cf, t) => s + (cf > 0 ? cf * Math.pow(1 + k, n - t) : 0), 0);
      const pvNeg = flows.reduce((s, cf, t) => s + (cf < 0 ? -cf / Math.pow(1 + k, t) : 0), 0);
      const mirr = Math.pow(fvPos / pvNeg, 1 / n) - 1;
      const npv = npvAt(k, flows);
      const multi = signChanges(flows) > 1 && res.roots.length > 1;
      const trows = flows.map((cf, t) => [t === 0 ? 'Year 0' : 'Year ' + t, cf, 1 / Math.pow(1 + r, t), cf / Math.pow(1 + r, t)]);
      return {
        summary: [
          { l: 'IRR', v: r * 100, f: 'pct', main: true, tone: r >= k ? 'good' : 'bad' },
          { l: 'MIRR @ ' + pc(k * 100), v: mirr * 100, f: 'pct' },
          { l: 'NPV @ ' + pc(k * 100), v: npv, f: 'money', tone: npv >= 0 ? 'good' : 'bad' },
          { l: 'Total net inflows', v: flows.slice(1).reduce((s, x) => s + x, 0), f: 'money' }
        ],
        verdict: { tone: r >= k ? 'good' : 'bad', text: r >= k ? `IRR of ${pc(r * 100)} exceeds the cost of capital (${pc(k * 100)}) — the project adds value.` : `IRR of ${pc(r * 100)} is below the cost of capital (${pc(k * 100)}).` },
        steps: [
          step('IRR definition', 'IRR is the rate r at which Σ CFₜ ÷ (1 + r)ᵗ = 0', 'Solved numerically (bracketing + bisection to 1e-14 precision).', pc(r * 100)),
          step('Proof', 'Σ PV of all cash flows at IRR should be ≈ 0', `Σ PV = ${fmt(trows.reduce((s, x) => s + x[3], 0), 'n4')}`, '≈ 0'),
          step('MIRR', 'MIRR = (FV of inflows at k ÷ PV of outflows at k)^(1/n) – 1', `(${f2(fvPos)} ÷ ${f2(pvNeg)})^(1/${n}) – 1`, pc(mirr * 100)),
          step('NPV at cost of capital', 'NPV = Σ CFₜ ÷ (1 + k)ᵗ', `k = ${pc(k * 100)}`, f2(npv))
        ],
        tables: [{ title: 'Discounting at IRR', cols: [['Period', 'text'], ['Cash flow', 'money'], ['Discount factor', 'n4'], ['Present value', 'money']], rows: trows, total: ['Total', flows.reduce((s, x) => s + x, 0), null, trows.reduce((s, x) => s + x[3], 0)] }],
        notes: multi ? [`Cash flows change sign more than once; multiple IRRs exist (${res.roots.map(x => pc(x * 100)).join(', ')}). Rely on NPV/MIRR for the decision.`] : []
      };
    }
  });

  /* 3. XIRR */
  def({
    id: 'xirr', short: 'XIRR', title: 'XIRR (Dated cash flows)', cat: 'invest', icon: 'calendar', unit: 'rs',
    desc: 'Annualised return for irregular, dated cash flows — SIPs, investments, loans.',
    fields: [
      { k: 'cf', l: 'Transactions', t: 'grid', add: 'Add transaction', newRow: () => ({ ty: 'in' }),
        cols: [
          { k: 'dt', l: 'Date', t: 'date' },
          { k: 'ty', l: 'Type', t: 'select', opts: [['out', 'Investment / Outflow'], ['in', 'Return / Inflow']] },
          { k: 'a', l: 'Amount', t: 'money' }
        ],
        d: [
          { dt: '2023-04-10', ty: 'out', a: 100000 },
          { dt: '2023-10-15', ty: 'out', a: 50000 },
          { dt: '2024-06-20', ty: 'out', a: 75000 },
          { dt: '2025-03-31', ty: 'in', a: 20000 },
          { dt: '2026-10-31', ty: 'in', a: 290000 }
        ] }
    ],
    compute(v) {
      const rows = v.cf.filter(r => isNum(r.a) && r.a !== 0);
      if (rows.length < 2) throw UErr('Enter at least two dated transactions.');
      rows.forEach(r => { if (isNaN(dParse(r.dt))) throw UErr('Every transaction needs a valid date.'); });
      const items = rows.map(r => ({ d: dParse(r.dt), ds: r.dt, cf: r.ty === 'out' ? -Math.abs(r.a) : Math.abs(r.a) })).sort((a, b) => a.d - b.d);
      const d0 = items[0].d;
      items.forEach(it => { it.days = Math.round((it.d - d0) / DAY); it.t = it.days / 365; });
      if (!items.some(x => x.cf < 0) || !items.some(x => x.cf > 0)) throw UErr('Need at least one outflow and one inflow.');
      const res = xirr(items);
      if (res.r == null) throw UErr('XIRR could not be solved for these cash flows.');
      const r = res.r;
      const out = items.filter(x => x.cf < 0).reduce((s, x) => s - x.cf, 0);
      const inn = items.filter(x => x.cf > 0).reduce((s, x) => s + x.cf, 0);
      const span = items[items.length - 1].days;
      const trows = items.map(it => [it.ds, it.days, it.cf, 1 / Math.pow(1 + r, it.t), it.cf / Math.pow(1 + r, it.t)]);
      return {
        summary: [
          { l: 'XIRR (annualised)', v: r * 100, f: 'pct', main: true, tone: r >= 0 ? 'good' : 'bad' },
          { l: 'Total invested', v: out, f: 'money' },
          { l: 'Total received', v: inn, f: 'money' },
          { l: 'Net gain', v: inn - out, f: 'money', tone: inn >= out ? 'good' : 'bad' },
          { l: 'Absolute return', v: div(inn - out, out) * 100, f: 'pct' },
          { l: 'Period', v: span / 365, f: 'yrs' }
        ],
        steps: [
          step('XIRR definition', 'Σ CFᵢ ÷ (1 + r)^((dᵢ – d₀) ÷ 365) = 0', `d₀ = ${fmtDate(items[0].ds)}; solved numerically`, pc(r * 100)),
          step('Proof', 'Σ PV of all cash flows at XIRR ≈ 0', `Σ PV = ${fmt(trows.reduce((s, x) => s + x[4], 0), 'n4')}`, '≈ 0'),
          step('Absolute return', '(Total received – Total invested) ÷ Total invested', `(${f2(inn)} – ${f2(out)}) ÷ ${f2(out)}`, pc(div(inn - out, out) * 100))
        ],
        tables: [{ title: 'Discounting at XIRR', cols: [['Date', 'date'], ['Days from start', 'int'], ['Cash flow', 'money'], ['Discount factor', 'n4'], ['Present value', 'money']], rows: trows }],
        notes: ['Uses a 365-day year with the earliest date as the base — the same convention as Excel XIRR.']
      };
    }
  });

  /* 4. NPV */
  def({
    id: 'npv', short: 'NPV', title: 'NPV, PI & Payback', cat: 'invest', icon: 'scale', unit: 'lakh',
    desc: 'Net present value, profitability index, simple and discounted payback.',
    fields: [
      { k: 'k', l: 'Discount rate', t: 'pct', d: 12 },
      { k: 'inv', l: 'Initial investment (Year 0)', t: 'money', d: 1000 },
      { k: 'cf', l: 'Cash flows', t: 'grid', add: 'Add year', rowLabel: i => 'Year ' + (i + 1),
        cols: [{ k: 'a', l: 'Net cash flow (– for outflow)', t: 'signed' }],
        d: [{ a: 220 }, { a: 260 }, { a: 300 }, { a: 320 }, { a: 350 }, { a: 380 }] }
    ],
    compute(v) {
      const k = N(v.k) / 100;
      if (k <= -1) throw UErr('Discount rate must be greater than –100%.');
      const rows = trimRows(v.cf, ['a']);
      const flows = [-N(v.inv), ...rows.map(r => N(r.a))];
      if (flows.length < 2) throw UErr('Enter at least one year of cash flow.');
      const pv = flows.map((cf, t) => cf / Math.pow(1 + k, t));
      const npv = pv.reduce((s, x) => s + x, 0);
      const pvIn = pv.slice(1).reduce((s, x) => s + (x > 0 ? x : 0), 0);
      const pvOut = -pv.reduce((s, x) => s + (x < 0 ? x : 0), 0);
      const pi = div(pvIn, pvOut);
      const pb = payback(flows), dpb = payback(pv);
      const ir = flows.some(x => x < 0) && flows.some(x => x > 0) ? irr(flows).r : null;
      let c1 = 0, c2 = 0;
      const trows = flows.map((cf, t) => { c1 += cf; c2 += pv[t]; return ['Year ' + t, cf, 1 / Math.pow(1 + k, t), pv[t], c1, c2]; });
      return {
        summary: [
          { l: 'Net present value', v: npv, f: 'money', main: true, tone: npv >= 0 ? 'good' : 'bad' },
          { l: 'Profitability index', v: pi, f: 'ratio', tone: pi >= 1 ? 'good' : 'bad' },
          { l: 'PV of inflows', v: pvIn, f: 'money' },
          { l: 'PV of outflows', v: pvOut, f: 'money' },
          { l: 'Simple payback', v: pb, f: 'yrs' },
          { l: 'Discounted payback', v: dpb, f: 'yrs' },
          { l: 'IRR', v: ir == null ? null : ir * 100, f: 'pct' }
        ],
        verdict: { tone: npv >= 0 ? 'good' : 'bad', text: npv >= 0 ? `Positive NPV of ${f2(npv)} at ${pc(k * 100)} — accept on NPV criterion.` : `Negative NPV of ${f2(npv)} at ${pc(k * 100)} — the project does not recover its cost of capital.` },
        steps: [
          step('Discount factor', 'DFₜ = 1 ÷ (1 + k)ᵗ', `k = ${pc(k * 100)}`, ''),
          step('NPV', 'NPV = Σ CFₜ × DFₜ (including Year 0 outlay)', `${f2(pvIn)} – ${f2(pvOut)}`, f2(npv)),
          step('Profitability index', 'PI = PV of inflows ÷ PV of outflows', `${f2(pvIn)} ÷ ${f2(pvOut)}`, fmt(pi, 'ratio')),
          step('Simple payback', 'Years before recovery + (unrecovered amount ÷ cash flow of recovery year)', 'From cumulative cash flow column', pb == null ? 'Not recovered' : fmt(pb, 'yrs')),
          step('Discounted payback', 'Same method on cumulative discounted cash flow', 'From cumulative PV column', dpb == null ? 'Not recovered' : fmt(dpb, 'yrs'))
        ],
        tables: [{ title: 'Discounted cash flow', cols: [['Year', 'text'], ['Cash flow', 'money'], ['DF', 'n4'], ['Present value', 'money'], ['Cumulative CF', 'money'], ['Cumulative PV', 'money']], rows: trows }],
        chart: { type: 'bar', title: 'Cumulative present value', labels: trows.map(r => r[0].replace('Year ', 'Y')), series: [{ name: 'Cumulative PV', data: trows.map(r => r[5]) }], ref: { v: 0, l: '' }, f: 'money' }
      };
    }
  });

  /* 5. EMI */
  def({
    id: 'emi', short: 'EMI', title: 'EMI & Amortisation', cat: 'loan', icon: 'loan', unit: 'rs',
    desc: 'Monthly instalment, total interest and full repayment schedule.',
    fields: [
      { k: 'p', l: 'Loan amount', t: 'money', d: 2500000 },
      { k: 'rate', l: 'Interest rate (p.a.)', t: 'pct', d: 8.5 },
      { k: 'ten', l: 'Tenure', t: 'num', d: 20 },
      { k: 'tu', l: 'Tenure in', t: 'select', d: 'y', opts: [['y', 'Years'], ['m', 'Months']] }
    ],
    compute(v) {
      const P = N(v.p), R = N(v.rate);
      const n = v.tu === 'm' ? Math.round(N(v.ten)) : Math.round(N(v.ten) * 12);
      if (P <= 0) throw UErr('Enter a loan amount.');
      if (n <= 0) throw UErr('Enter a tenure.');
      if (R < 0) throw UErr('Interest rate cannot be negative.');
      if (n > 600) throw UErr('Tenure cannot exceed 50 years (600 months).');
      if (R > 100) throw UErr('Interest rate looks too high — enter the annual rate in %.');
      const i = R / 1200, emi = emiOf(P, R, n);
      let bal = P;
      const mrows = [], yrows = [];
      let y = null;
      for (let m = 1; m <= n; m++) {
        const open = bal, int = bal * i;
        let prin = emi - int, pay = emi;
        if (m === n) { prin = bal; pay = prin + int; }
        bal = open - prin; if (Math.abs(bal) < 1e-6) bal = 0;
        mrows.push([m, open, pay, int, prin, bal]);
        if ((m - 1) % 12 === 0) { y = ['Year ' + Math.ceil(m / 12), open, 0, 0, 0, 0]; yrows.push(y); }
        y[2] += pay; y[3] += int; y[4] += prin; y[5] = bal;
      }
      const totInt = mrows.reduce((s, r) => s + r[3], 0), totPay = P + totInt;
      return {
        summary: [
          { l: 'Monthly EMI', v: emi, f: 'money', main: true },
          { l: 'Total interest', v: totInt, f: 'money' },
          { l: 'Total payment', v: totPay, f: 'money' },
          { l: 'Interest as % of principal', v: totInt / P * 100, f: 'pct' },
          { l: 'Number of instalments', v: n, f: 'int' }
        ],
        steps: [
          step('Monthly rate', 'i = Annual rate ÷ 12 ÷ 100', `${fmt(R, 'pct')} ÷ 12`, fmt(i * 100, 'pct4')),
          step('EMI', 'EMI = P × i × (1 + i)ⁿ ÷ [(1 + i)ⁿ – 1]', `${f2(P)} × ${fmt(i, 'n4')}… × (1 + i)^${n} ÷ [(1 + i)^${n} – 1]`, f2(emi)),
          step('Total interest', 'EMI × n – P', `${f2(emi)} × ${n} – ${f2(P)}`, f2(totInt))
        ],
        tables: [
          { title: 'Year-wise summary', cols: [['Year', 'text'], ['Opening balance', 'money'], ['Paid', 'money'], ['Interest', 'money'], ['Principal', 'money'], ['Closing balance', 'money']], rows: yrows, total: ['Total', null, totPay, totInt, P, null] },
          { title: 'Monthly schedule', cols: [['Month', 'int'], ['Opening', 'money'], ['EMI', 'money'], ['Interest', 'money'], ['Principal', 'money'], ['Closing', 'money']], rows: mrows, limit: 24 }
        ],
        chart: { type: 'bar', stacked: true, title: 'Principal vs interest by year', labels: yrows.map(r => r[0].replace('Year ', 'Y')), series: [{ name: 'Principal', data: yrows.map(r => r[4]) }, { name: 'Interest', data: yrows.map(r => r[3]) }], f: 'money' },
        notes: ['Final instalment is adjusted for rounding so that the closing balance is exactly nil.']
      };
    }
  });

  /* 6. Working capital */
  def({
    id: 'wc', short: 'Working Capital', title: 'Working Capital Assessment', cat: 'credit', icon: 'cycle', unit: 'lakh',
    desc: 'Turnover method (Nayak Committee) or operating-cycle method of WC assessment.',
    fields: [
      { k: 'm', l: 'Method', t: 'select', d: 'to', opts: [['to', 'Turnover method (Nayak Committee)'], ['oc', 'Operating cycle / holding period']] },
      { k: 'T', l: 'Projected annual turnover', t: 'money', d: 500, show: v => v.m === 'to' },
      { k: 'nwc', l: 'Net working capital available (optional)', t: 'signed', d: 30, show: v => v.m === 'to', hint: 'Long-term funds invested in current assets' },
      { k: 'sl', l: 'Annual sales', t: 'money', d: 1200, show: v => v.m === 'oc' },
      { k: 'cos', l: 'Cost of sales', t: 'money', d: 950, show: v => v.m === 'oc' },
      { k: 'cop', l: 'Cost of production', t: 'money', d: 900, show: v => v.m === 'oc' },
      { k: 'rmc', l: 'Raw material consumed', t: 'money', d: 700, show: v => v.m === 'oc' },
      { k: 'pur', l: 'Credit purchases', t: 'money', d: 720, show: v => v.m === 'oc' },
      { k: 'h1', l: 'Holding periods (days)', t: 'head', show: v => v.m === 'oc' },
      { k: 'drm', l: 'Raw material', t: 'num', suf: 'days', d: 30, show: v => v.m === 'oc' },
      { k: 'dwip', l: 'Work-in-progress', t: 'num', suf: 'days', d: 10, show: v => v.m === 'oc' },
      { k: 'dfg', l: 'Finished goods', t: 'num', suf: 'days', d: 20, show: v => v.m === 'oc' },
      { k: 'ddr', l: 'Receivables', t: 'num', suf: 'days', d: 45, show: v => v.m === 'oc' },
      { k: 'dcr', l: 'Payables (credit received)', t: 'num', suf: 'days', d: 30, show: v => v.m === 'oc' },
      { k: 'h2', l: 'Other items', t: 'head', show: v => v.m === 'oc' },
      { k: 'oca', l: 'Other current assets', t: 'money', d: 25, show: v => v.m === 'oc' },
      { k: 'ocl', l: 'Other current liabilities (excl. bank)', t: 'money', d: 15, show: v => v.m === 'oc' },
      { k: 'mg', l: 'Margin on current assets', t: 'pct', d: 25, show: v => v.m === 'oc' }
    ],
    compute(v) {
      if (v.m === 'to') {
        const T = N(v.T);
        if (T <= 0) throw UErr('Enter projected turnover.');
        const req = 0.25 * T, mm = 0.05 * T, bf = 0.20 * T;
        const nwc = isNum(v.nwc) ? v.nwc : null;
        const alt = nwc != null ? req - nwc : null;
        const elig = alt != null ? Math.max(0, Math.min(bf, alt)) : bf;
        return {
          summary: [
            { l: 'Eligible bank finance', v: elig, f: 'money', main: true },
            { l: 'Working capital requirement (25%)', v: req, f: 'money' },
            { l: 'Minimum margin from promoter (5%)', v: mm, f: 'money' },
            { l: 'Bank finance @ 20% of turnover', v: bf, f: 'money' },
            { l: 'WC requirement less available NWC', v: alt, f: 'money' }
          ],
          steps: [
            step('WC requirement', '25% of projected annual turnover', `25% × ${f2(T)}`, f2(req)),
            step('Minimum margin', '5% of turnover (1/5th of requirement) from long-term sources', `5% × ${f2(T)}`, f2(mm)),
            step('Bank finance (norm)', '20% of turnover', `20% × ${f2(T)}`, f2(bf)),
            ...(nwc != null ? [step('Bank finance (actual NWC)', 'WC requirement – NWC available', `${f2(req)} – ${f2(nwc)}`, f2(alt))] : []),
            step('Eligible bank finance', nwc != null ? 'Lower of the two amounts above' : '20% of turnover', '', f2(elig))
          ],
          notes: ['RBI guidelines prescribe the turnover method for fund-based WC limits up to ₹5 crore for MSE borrowers; bank-specific policies may vary.']
        };
      }
      const rm = N(v.rmc) * N(v.drm) / 365, wip = N(v.cop) * N(v.dwip) / 365, fg = N(v.cos) * N(v.dfg) / 365;
      const dr = N(v.sl) * N(v.ddr) / 365, cr = N(v.pur) * N(v.dcr) / 365;
      const ca = rm + wip + fg + dr + N(v.oca), cl = cr + N(v.ocl);
      const gap = ca - cl, mgn = N(v.mg) / 100 * ca, bank = Math.max(0, gap - mgn);
      const cyc = N(v.drm) + N(v.dwip) + N(v.dfg) + N(v.ddr) - N(v.dcr);
      if (ca <= 0) throw UErr('Enter cost figures and holding periods.');
      return {
        summary: [
          { l: 'Permissible bank finance', v: bank, f: 'money', main: true },
          { l: 'Total current assets', v: ca, f: 'money' },
          { l: 'Working capital gap', v: gap, f: 'money' },
          { l: 'Margin @ ' + pc(N(v.mg)) + ' of CA', v: mgn, f: 'money' },
          { l: 'Net operating cycle', v: cyc, f: 'days' }
        ],
        steps: [
          step('Holding level', 'Annual base × holding days ÷ 365', 'See component table', ''),
          step('Working capital gap', 'Total current assets – current liabilities (excl. bank)', `${f2(ca)} – ${f2(cl)}`, f2(gap)),
          step('Margin', `${pc(N(v.mg))} × Total current assets`, `${pc(N(v.mg))} × ${f2(ca)}`, f2(mgn)),
          step('Bank finance', 'WC gap – Margin', `${f2(gap)} – ${f2(mgn)}`, f2(bank)),
          step('Operating cycle', 'RM + WIP + FG + Receivable days – Payable days', `${N(v.drm)} + ${N(v.dwip)} + ${N(v.dfg)} + ${N(v.ddr)} – ${N(v.dcr)}`, fmt(cyc, 'days'))
        ],
        tables: [{
          title: 'Assessment of current assets & liabilities',
          cols: [['Item', 'text'], ['Annual base', 'money'], ['Days', 'int'], ['Amount', 'money']],
          rows: [
            ['Raw material (on consumption)', N(v.rmc), N(v.drm), rm],
            ['Work-in-progress (on cost of production)', N(v.cop), N(v.dwip), wip],
            ['Finished goods (on cost of sales)', N(v.cos), N(v.dfg), fg],
            ['Receivables (on sales)', N(v.sl), N(v.ddr), dr],
            ['Other current assets', null, null, N(v.oca)],
            ['A. Total current assets', null, null, ca],
            ['Creditors (on purchases)', N(v.pur), N(v.dcr), cr],
            ['Other current liabilities', null, null, N(v.ocl)],
            ['B. Current liabilities (excl. bank)', null, null, cl],
            ['C. Working capital gap (A – B)', null, null, gap],
            ['D. Margin', null, null, mgn],
            ['E. Bank finance (C – D)', null, null, bank]
          ]
        }]
      };
    }
  });

  /* 7. MPBF */
  def({
    id: 'mpbf', short: 'MPBF', title: 'MPBF — Tandon Committee', cat: 'credit', icon: 'layers', unit: 'lakh',
    desc: 'Maximum permissible bank finance under Methods I, II and III.',
    fields: [
      { k: 'ca', l: 'Total current assets', t: 'money', d: 800 },
      { k: 'cca', l: 'Core current assets', t: 'money', d: 150, hint: 'Needed for Method III' },
      { k: 'ocl', l: 'Current liabilities other than bank borrowings', t: 'money', d: 250 },
      { k: 'bb', l: 'Existing working-capital bank borrowings', t: 'money', d: 400 }
    ],
    compute(v) {
      const CA = N(v.ca), CCA = N(v.cca), OCL = N(v.ocl), BB = N(v.bb);
      if (CA <= 0) throw UErr('Enter total current assets.');
      if (CCA > CA) throw UErr('Core current assets cannot exceed total current assets.');
      if (OCL > CA) throw UErr('Other current liabilities exceed current assets — there is no working-capital gap to finance.');
      const gap = CA - OCL;
      const m1 = 0.25 * gap, m2 = 0.25 * CA, m3 = CCA + 0.25 * (CA - CCA);
      const p1 = Math.max(0, gap - m1), p2 = Math.max(0, gap - m2), p3 = Math.max(0, gap - m3);
      const anwc = CA - OCL - BB;
      const ex = BB - p2;
      return {
        summary: [
          { l: 'MPBF — Method II', v: p2, f: 'money', main: true },
          { l: 'MPBF — Method I', v: p1, f: 'money' },
          { l: 'MPBF — Method III', v: p3, f: 'money' },
          { l: 'Working capital gap', v: gap, f: 'money' },
          { l: 'Actual net working capital', v: anwc, f: 'money' },
          { l: 'Current ratio (actual)', v: div(CA, OCL + BB), f: 'ratio' }
        ],
        verdict: BB > 0 ? { tone: ex > 0 ? 'warn' : 'good', text: ex > 0 ? `Existing bank borrowings exceed Method II MPBF by ${f2(ex)} (excess borrowing).` : `Existing bank borrowings are within Method II MPBF; unutilised headroom ${f2(-ex)}.` } : null,
        steps: [
          step('Working capital gap', 'Total CA – Other CL', `${f2(CA)} – ${f2(OCL)}`, f2(gap)),
          step('Method I', 'MPBF = 75% × WC gap', `75% × ${f2(gap)}`, f2(p1)),
          step('Method II', 'MPBF = WC gap – 25% of total CA', `${f2(gap)} – 25% × ${f2(CA)}`, f2(p2)),
          step('Method III', 'MPBF = WC gap – [Core CA + 25% of (CA – Core CA)]', `${f2(gap)} – [${f2(CCA)} + 25% × ${f2(CA - CCA)}]`, f2(p3)),
          step('Actual NWC', 'Total CA – Other CL – Bank borrowings', `${f2(CA)} – ${f2(OCL)} – ${f2(BB)}`, f2(anwc))
        ],
        tables: [{
          title: 'Comparison of methods',
          cols: [['Particulars', 'text'], ['Method I', 'money'], ['Method II', 'money'], ['Method III', 'money']],
          rows: [
            ['Total current assets', CA, CA, CA],
            ['Less: Other current liabilities', OCL, OCL, OCL],
            ['Working capital gap', gap, gap, gap],
            ['Borrower margin (minimum NWC)', m1, m2, m3],
            ['MPBF', p1, p2, p3],
            ['Actual NWC', anwc, anwc, anwc],
            ['Surplus / (shortfall) in NWC', anwc - m1, anwc - m2, anwc - m3],
            ['Projected current ratio at MPBF', div(CA, OCL + p1), div(CA, OCL + p2), div(CA, OCL + p3)]
          ]
        }],
        notes: ['Method II (current ratio of 1.33) is the norm most commonly applied by banks.']
      };
    }
  });

  /* 8. Drawing power */
  def({
    id: 'dp', short: 'Drawing Power', title: 'Drawing Power', cat: 'credit', icon: 'gauge', unit: 'lakh',
    desc: 'DP against stock and book debts from the stock statement.',
    fields: [
      { k: 'h1', l: 'Stock', t: 'head' },
      { k: 'rm', l: 'Raw material', t: 'money', d: 120 },
      { k: 'wip', l: 'Work-in-progress', t: 'money', d: 40 },
      { k: 'fg', l: 'Finished goods', t: 'money', d: 90 },
      { k: 'exs', l: 'Less: obsolete / slow-moving / ineligible stock', t: 'money', d: 10 },
      { k: 'cr', l: 'Less: trade creditors for goods', t: 'money', d: 60 },
      { k: 'dc', l: 'Deduct creditors (paid-stock basis)', t: 'check', d: true },
      { k: 'sm', l: 'Margin on stock', t: 'pct', d: 25 },
      { k: 'h2', l: 'Book debts', t: 'head' },
      { k: 'bd', l: 'Total receivables', t: 'money', d: 180 },
      { k: 'old', l: 'Less: receivables beyond eligible age', t: 'money', d: 30, hint: 'e.g. older than 90 days, related-party, disputed' },
      { k: 'bm', l: 'Margin on book debts', t: 'pct', d: 40 },
      { k: 'h3', l: 'Limit', t: 'head' },
      { k: 'lim', l: 'Sanctioned limit', t: 'money', d: 250 },
      { k: 'os', l: 'Outstanding balance', t: 'money', d: 210 }
    ],
    compute(v) {
      const gs = N(v.rm) + N(v.wip) + N(v.fg);
      const es = Math.max(0, gs - N(v.exs));
      const ps = Math.max(0, es - (v.dc ? N(v.cr) : 0));
      const sMar = ps * N(v.sm) / 100, dps = ps - sMar;
      const eb = Math.max(0, N(v.bd) - N(v.old));
      const bMar = eb * N(v.bm) / 100, dpb = eb - bMar;
      const dp = dps + dpb, lim = N(v.lim);
      const avail = lim > 0 ? Math.min(dp, lim) : dp;
      const head = avail - N(v.os);
      return {
        summary: [
          { l: 'Drawing power available', v: avail, f: 'money', main: true },
          { l: 'Computed DP (before limit cap)', v: dp, f: 'money' },
          { l: 'DP on stock', v: dps, f: 'money' },
          { l: 'DP on book debts', v: dpb, f: 'money' },
          { l: head >= 0 ? 'Headroom for drawing' : 'Irregular / overdrawn by', v: Math.abs(head), f: 'money', tone: head >= 0 ? 'good' : 'bad' }
        ],
        verdict: { tone: head >= 0 ? 'good' : 'bad', text: head >= 0 ? `Account is within drawing power; further drawing of ${f2(head)} is possible.` : `Outstanding exceeds drawing power by ${f2(-head)} — account is irregular to that extent.` },
        steps: [
          step('Eligible stock', 'RM + WIP + FG – ineligible stock', `${f2(gs)} – ${f2(N(v.exs))}`, f2(es)),
          step('Paid stock', v.dc ? 'Eligible stock – trade creditors' : 'Creditors not deducted', v.dc ? `${f2(es)} – ${f2(N(v.cr))}` : '', f2(ps)),
          step('DP on stock', `Paid stock × (1 – ${pc(N(v.sm))})`, `${f2(ps)} – ${f2(sMar)}`, f2(dps)),
          step('DP on book debts', `Eligible debtors × (1 – ${pc(N(v.bm))})`, `(${f2(N(v.bd))} – ${f2(N(v.old))}) – ${f2(bMar)}`, f2(dpb)),
          lim > 0 ? step('Available DP', 'Lower of computed DP and sanctioned limit', `min(${f2(dp)}, ${f2(lim)})`, f2(avail)) : step('Available DP', 'No sanctioned limit entered — computed DP used', '', f2(avail))
        ],
        tables: [{
          title: 'Drawing power statement',
          cols: [['Particulars', 'text'], ['Amount', 'money'], ['Margin', 'money'], ['DP', 'money']],
          rows: [['Stock (paid, eligible)', ps, sMar, dps], ['Book debts (eligible)', eb, bMar, dpb]],
          total: ['Total', ps + eb, sMar + bMar, dp]
        }]
      };
    }
  });

  /* 9. TOL / TNW */
  def({
    id: 'toltnw', short: 'TOL/TNW', title: 'TOL / TNW & Gearing', cat: 'credit', icon: 'balance', unit: 'lakh',
    desc: 'Total outside liabilities to tangible net worth, with quasi-equity option.',
    fields: [
      { k: 'thr', l: 'Acceptable TOL/TNW (benchmark)', t: 'num', d: 3, hint: 'Commonly 3 – 4 for manufacturing; varies by bank and sector' },
      { k: 'h1', l: 'Net worth', t: 'head' },
      { k: 'sc', l: 'Share capital / proprietor capital', t: 'money', d: 100 },
      { k: 'rs', l: 'Reserves & surplus (– if debit balance)', t: 'signed', d: 260 },
      { k: 'usl', l: 'Unsecured loans from promoters', t: 'money', d: 80 },
      { k: 'qe', l: 'Treat promoter loans as quasi-equity (subordinated)', t: 'check', d: true },
      { k: 'int', l: 'Less: intangible assets', t: 'money', d: 15 },
      { k: 'misc', l: 'Less: misc. expenditure / deferred revenue exp. not written off', t: 'money', d: 5 },
      { k: 'h2', l: 'Outside liabilities', t: 'head' },
      { k: 'ltb', l: 'Long-term borrowings (term loans)', t: 'money', d: 300 },
      { k: 'oul', l: 'Other unsecured loans', t: 'money', d: 20 },
      { k: 'stb', l: 'Short-term bank borrowings (CC/OD)', t: 'money', d: 250 },
      { k: 'tp', l: 'Trade payables', t: 'money', d: 180 },
      { k: 'ocl', l: 'Other current liabilities', t: 'money', d: 60 },
      { k: 'prov', l: 'Provisions', t: 'money', d: 25 },
      { k: 'dtl', l: 'Deferred tax liability & others', t: 'money', d: 15 }
    ],
    compute(v) {
      const usl = N(v.usl), qe = !!v.qe;
      const tnw = N(v.sc) + N(v.rs) + (qe ? usl : 0) - N(v.int) - N(v.misc);
      const parts = [['Long-term borrowings', N(v.ltb)], ['Promoter unsecured loans', qe ? 0 : usl], ['Other unsecured loans', N(v.oul)], ['Short-term bank borrowings', N(v.stb)], ['Trade payables', N(v.tp)], ['Other current liabilities', N(v.ocl)], ['Provisions', N(v.prov)], ['Deferred tax liability & others', N(v.dtl)]];
      const tol = parts.reduce((s, p) => s + p[1], 0);
      const r = div(tol, tnw);
      const ltd = N(v.ltb) + N(v.oul) + (qe ? 0 : usl);
      const de = div(ltd, tnw);
      const thr = N(v.thr) || 3;
      const ok = tnw > 0 && r <= thr;
      return {
        summary: [
          { l: 'TOL / TNW', v: tnw > 0 ? r : null, f: 'ratio', main: true, tone: ok ? 'good' : 'bad' },
          { l: 'Tangible net worth', v: tnw, f: 'money', tone: tnw > 0 ? null : 'bad' },
          { l: 'Total outside liabilities', v: tol, f: 'money' },
          { l: 'Long-term debt / TNW', v: tnw > 0 ? de : null, f: 'ratio' },
          { l: 'TNW as % of total liabilities', v: div(tnw, tnw + tol) * 100, f: 'pct' }
        ],
        verdict: { tone: ok ? 'good' : 'bad', text: tnw <= 0 ? 'Tangible net worth is negative or nil — the entity is technically insolvent on a tangible basis.' : ok ? `TOL/TNW of ${fmt(r, 'ratio')} is within the benchmark of ${fmt(thr, 'ratio')}.` : `TOL/TNW of ${fmt(r, 'ratio')} exceeds the benchmark of ${fmt(thr, 'ratio')} — high reliance on outside funds.` },
        steps: [
          step('Tangible net worth', 'Capital + Reserves' + (qe ? ' + Quasi-equity' : '') + ' – Intangibles – Misc. exp. not w/off', `${f2(N(v.sc))} + ${f2(N(v.rs))}${qe ? ' + ' + f2(usl) : ''} – ${f2(N(v.int))} – ${f2(N(v.misc))}`, f2(tnw)),
          step('Total outside liabilities', 'All liabilities except net worth' + (qe ? ' and quasi-equity' : ''), parts.filter(p => p[1]).map(p => f2(p[1])).join(' + '), f2(tol)),
          step('TOL / TNW', 'TOL ÷ TNW', `${f2(tol)} ÷ ${f2(tnw)}`, tnw > 0 ? fmt(r, 'ratio') : 'Not meaningful (TNW ≤ 0)'),
          step('Long-term debt / TNW', 'Long-term borrowings & unsecured loans ÷ TNW', `${f2(ltd)} ÷ ${f2(tnw)}`, tnw > 0 ? fmt(de, 'ratio') : 'Not meaningful (TNW ≤ 0)')
        ],
        tables: [{ title: 'Outside liabilities', cols: [['Liability', 'text'], ['Amount', 'money']], rows: parts, total: ['Total outside liabilities', tol] }],
        notes: ['Promoter loans are treated as quasi-equity only if subordinated to bank debt and retained in the business for the loan tenure (undertaking obtained).']
      };
    }
  });

  /* 10. Financial ratios */
  def({
    id: 'ratios', short: 'Ratios', title: 'Financial Ratio Analysis', cat: 'analysis', icon: 'grid', unit: 'lakh',
    desc: 'Liquidity, leverage, coverage, profitability and efficiency ratios from P&L and balance sheet.',
    fields: [
      { k: 'h1', l: 'Profit & loss', t: 'head' },
      { k: 'sales', l: 'Revenue from operations (net)', t: 'money', d: 2400 },
      { k: 'cogs', l: 'Cost of goods sold', t: 'money', d: 1850 },
      { k: 'pur', l: 'Purchases (blank = COGS)', t: 'money', d: null },
      { k: 'dep', l: 'Depreciation & amortisation', t: 'money', d: 45 },
      { k: 'fin', l: 'Finance cost (interest)', t: 'money', d: 70 },
      { k: 'pbt', l: 'Profit before tax', t: 'signed', d: 160 },
      { k: 'tax', l: 'Tax expense', t: 'signed', d: 42 },
      { k: 'prin', l: 'Principal repayment of term loans (year)', t: 'money', d: 60 },
      { k: 'h2', l: 'Equity & liabilities', t: 'head' },
      { k: 'eq', l: 'Net worth (share capital + reserves)', t: 'signed', d: 600 },
      { k: 'ltd', l: 'Long-term borrowings (non-current)', t: 'money', d: 350 },
      { k: 'cm', l: 'Current maturities of long-term debt', t: 'money', d: 60 },
      { k: 'ncl', l: 'Other non-current liabilities', t: 'money', d: 50 },
      { k: 'stb', l: 'Short-term borrowings', t: 'money', d: 300 },
      { k: 'tp', l: 'Trade payables', t: 'money', d: 220 },
      { k: 'ocl', l: 'Other current liabilities & provisions', t: 'money', d: 90 },
      { k: 'h3', l: 'Assets', t: 'head' },
      { k: 'fa', l: 'Net fixed assets (tangible)', t: 'money', d: 700 },
      { k: 'ia', l: 'Intangible assets', t: 'money', d: 10 },
      { k: 'nca', l: 'Investments & other non-current assets', t: 'money', d: 40 },
      { k: 'inv', l: 'Inventories', t: 'money', d: 380 },
      { k: 'tr', l: 'Trade receivables', t: 'money', d: 420 },
      { k: 'cash', l: 'Cash & bank balances', t: 'money', d: 35 },
      { k: 'oca', l: 'Other current assets', t: 'money', d: 85 }
    ],
    compute(v) {
      const S = N(v.sales);
      if (S <= 0) throw UErr('Enter revenue from operations.');
      const pbt = N(v.pbt), fin = N(v.fin), dep = N(v.dep), pat = pbt - N(v.tax);
      const ebit = pbt + fin, ebitda = ebit + dep;
      const ca = N(v.inv) + N(v.tr) + N(v.cash) + N(v.oca);
      const cl = N(v.stb) + N(v.tp) + N(v.ocl) + N(v.cm);
      const debt = N(v.ltd) + N(v.cm) + N(v.stb);
      const tnw = N(v.eq) - N(v.ia);
      const tol = N(v.ltd) + N(v.cm) + N(v.ncl) + N(v.stb) + N(v.tp) + N(v.ocl);
      const ta = N(v.fa) + N(v.ia) + N(v.nca) + ca;
      const tl = N(v.eq) + tol;
      const ce = N(v.eq) + N(v.ltd) + N(v.cm);
      const purch = isNum(v.pur) ? v.pur : N(v.cogs);
      const cogs = N(v.cogs);
      const R = [];
      const add = (grp, name, val, f, formula, calc, bench, good) => R.push({ grp, name, val, f, formula, calc, bench, tone: val == null || good == null ? null : good(val) ? 'good' : 'bad' });
      add('Liquidity', 'Current ratio', div(ca, cl), 'ratio', 'Current assets ÷ Current liabilities', `${f2(ca)} ÷ ${f2(cl)}`, '≥ 1.33', x => x >= 1.33);
      add('Liquidity', 'Quick ratio', div(ca - N(v.inv), cl), 'ratio', '(CA – Inventory) ÷ CL', `${f2(ca - N(v.inv))} ÷ ${f2(cl)}`, '≥ 1.00', x => x >= 1);
      add('Liquidity', 'Cash ratio', div(N(v.cash), cl), 'ratio', 'Cash & bank ÷ CL', `${f2(N(v.cash))} ÷ ${f2(cl)}`, '—', null);
      add('Liquidity', 'Net working capital', ca - cl, 'money', 'CA – CL', `${f2(ca)} – ${f2(cl)}`, '> 0', x => x > 0);
      add('Leverage', 'Debt / Equity', tnw > 0 ? div(debt, tnw) : null, 'ratio', 'Total borrowings ÷ TNW', `${f2(debt)} ÷ ${f2(tnw)}`, '≤ 2.00', x => x <= 2);
      add('Leverage', 'Long-term debt / Equity', tnw > 0 ? div(N(v.ltd) + N(v.cm), tnw) : null, 'ratio', 'Term borrowings (incl. current maturities) ÷ TNW', `${f2(N(v.ltd) + N(v.cm))} ÷ ${f2(tnw)}`, '≤ 2.00', x => x <= 2);
      add('Leverage', 'TOL / TNW', tnw > 0 ? div(tol, tnw) : null, 'ratio', 'Total outside liabilities ÷ TNW', `${f2(tol)} ÷ ${f2(tnw)}`, '≤ 3.00', x => x <= 3);
      add('Leverage', 'Debt / EBITDA', ebitda > 0 ? div(debt, ebitda) : null, 'x', 'Total borrowings ÷ EBITDA', `${f2(debt)} ÷ ${f2(ebitda)}`, '≤ 3.5x', x => x <= 3.5);
      add('Coverage', 'Interest coverage (ISCR)', div(ebitda, fin), 'x', 'EBITDA ÷ Finance cost', `${f2(ebitda)} ÷ ${f2(fin)}`, '≥ 2.0x', x => x >= 2);
      add('Coverage', 'DSCR', div(pat + dep + fin, fin + N(v.prin)), 'x', '(PAT + Dep. + Interest) ÷ (Interest + Principal)', `${f2(pat + dep + fin)} ÷ ${f2(fin + N(v.prin))}`, '≥ 1.25x', x => x >= 1.25);
      add('Profitability', 'Gross margin', div(S - cogs, S) * 100, 'pct', '(Revenue – COGS) ÷ Revenue', `${f2(S - cogs)} ÷ ${f2(S)}`, '—', null);
      add('Profitability', 'EBITDA margin', div(ebitda, S) * 100, 'pct', 'EBITDA ÷ Revenue', `${f2(ebitda)} ÷ ${f2(S)}`, '—', null);
      add('Profitability', 'Net profit margin', div(pat, S) * 100, 'pct', 'PAT ÷ Revenue', `${f2(pat)} ÷ ${f2(S)}`, '—', null);
      add('Profitability', 'Return on equity (ROE)', N(v.eq) > 0 ? div(pat, N(v.eq)) * 100 : null, 'pct', 'PAT ÷ Net worth', `${f2(pat)} ÷ ${f2(N(v.eq))}`, '—', null);
      add('Profitability', 'Return on capital employed', div(ebit, ce) * 100, 'pct', 'EBIT ÷ (Net worth + Long-term debt)', `${f2(ebit)} ÷ ${f2(ce)}`, '> cost of debt', null);
      add('Profitability', 'Return on assets (ROA)', div(pat, ta) * 100, 'pct', 'PAT ÷ Total assets', `${f2(pat)} ÷ ${f2(ta)}`, '—', null);
      add('Efficiency', 'Total asset turnover', div(S, ta), 'x', 'Revenue ÷ Total assets', `${f2(S)} ÷ ${f2(ta)}`, '—', null);
      add('Efficiency', 'Fixed asset turnover', div(S, N(v.fa)), 'x', 'Revenue ÷ Net fixed assets', `${f2(S)} ÷ ${f2(N(v.fa))}`, '—', null);
      const invD = div(N(v.inv), cogs) * 365, drD = div(N(v.tr), S) * 365, crD = div(N(v.tp), purch) * 365;
      add('Efficiency', 'Inventory holding', cogs ? invD : null, 'days', 'Inventory ÷ COGS × 365', `${f2(N(v.inv))} ÷ ${f2(cogs)} × 365`, '—', null);
      add('Efficiency', 'Receivable days', drD, 'days', 'Receivables ÷ Revenue × 365', `${f2(N(v.tr))} ÷ ${f2(S)} × 365`, '—', null);
      add('Efficiency', 'Payable days', purch ? crD : null, 'days', 'Payables ÷ Purchases × 365', `${f2(N(v.tp))} ÷ ${f2(purch)} × 365`, '—', null);
      add('Efficiency', 'Cash conversion cycle', cogs && purch ? invD + drD - crD : null, 'days', 'Inventory + Receivable – Payable days', '', '—', null);
      const diff = ta - tl;
      const find = n => R.find(x => x.name === n).val;
      return {
        summary: [
          { l: 'Current ratio', v: find('Current ratio'), f: 'ratio', main: true, tone: R[0].tone },
          { l: 'TOL / TNW', v: find('TOL / TNW'), f: 'ratio', tone: R.find(x => x.name === 'TOL / TNW').tone },
          { l: 'DSCR', v: find('DSCR'), f: 'x', tone: R.find(x => x.name === 'DSCR').tone },
          { l: 'Interest coverage', v: find('Interest coverage (ISCR)'), f: 'x' },
          { l: 'EBITDA', v: ebitda, f: 'money' },
          { l: 'PAT', v: pat, f: 'money', tone: pat >= 0 ? null : 'bad' }
        ],
        verdict: Math.abs(diff) > 0.005 ? { tone: 'warn', text: `Balance sheet does not tally: total assets ${f2(ta)} vs equity & liabilities ${f2(tl)} (difference ${f2(diff)}). Check inputs.` } : { tone: 'good', text: `Balance sheet tallies at ${f2(ta)}. ${R.filter(x => x.tone === 'bad').length} of ${R.filter(x => x.tone).length} benchmarked ratios are outside typical bank norms.` },
        steps: [
          step('Derived figures', 'EBIT = PBT + Finance cost; EBITDA = EBIT + Depreciation; PAT = PBT – Tax', `EBIT ${f2(ebit)}; EBITDA ${f2(ebitda)}; PAT ${f2(pat)}`, ''),
          step('Current assets / liabilities', 'CA = Inventory + Receivables + Cash + Other CA; CL = ST borrowings + Payables + Other CL + Current maturities', `CA ${f2(ca)}; CL ${f2(cl)}`, ''),
          step('Net worth & outside liabilities', 'TNW = Net worth – Intangibles; TOL = Total liabilities – Net worth', `TNW ${f2(tnw)}; TOL ${f2(tol)}`, ''),
          ...R.filter(x => x.calc).map(x => step(x.name, x.formula, x.calc, fmt(x.val, x.f)))
        ],
        tables: [{ title: 'Ratio summary', cols: [['Group', 'text'], ['Ratio', 'text'], ['Value', 'mixed'], ['Formula', 'text'], ['Typical norm', 'text']], rows: R.map(x => [x.grp, x.name, fmt(x.val, x.f), x.formula, x.bench]) }],
        notes: ['Benchmarks are indicative norms used in bank credit appraisal; sector-specific norms may differ.', 'Days ratios use closing balances and a 365-day year.']
      };
    }
  });

  /* 11. Break-even */
  def({
    id: 'bep', short: 'Break-Even', title: 'Break-Even Analysis', cat: 'analysis', icon: 'cross', unit: 'rs',
    desc: 'BEP in units and value, cash BEP, P/V ratio and margin of safety.',
    fields: [
      { k: 'm', l: 'Input basis', t: 'select', d: 'u', opts: [['u', 'Per-unit data'], ['v', 'Total sales & variable cost']] },
      { k: 'fc', l: 'Fixed costs (incl. depreciation & interest)', t: 'money', d: 1200000 },
      { k: 'dep', l: 'of which depreciation (non-cash)', t: 'money', d: 200000 },
      { k: 'sp', l: 'Selling price per unit', t: 'money', d: 500, show: v => v.m === 'u' },
      { k: 'vc', l: 'Variable cost per unit', t: 'money', d: 300, show: v => v.m === 'u' },
      { k: 'q', l: 'Expected sales volume (units)', t: 'num', d: 9000, show: v => v.m === 'u' },
      { k: 'cap', l: 'Installed capacity (units, optional)', t: 'num', d: 12000, show: v => v.m === 'u' },
      { k: 's', l: 'Total sales', t: 'money', d: 4500000, show: v => v.m === 'v' },
      { k: 'tvc', l: 'Total variable costs', t: 'money', d: 2700000, show: v => v.m === 'v' },
      { k: 'tp', l: 'Target profit (optional)', t: 'money', d: 600000 }
    ],
    compute(v) {
      const FC = N(v.fc), D = N(v.dep), TP = N(v.tp);
      if (D > FC) throw UErr('Depreciation cannot exceed total fixed costs (it is part of them).');
      let S, VC, pv;
      const units = v.m === 'u';
      if (units) {
        if (N(v.sp) <= 0) throw UErr('Enter selling price per unit.');
        if (N(v.vc) >= N(v.sp)) throw UErr('Variable cost per unit must be lower than selling price.');
        S = N(v.sp) * N(v.q); VC = N(v.vc) * N(v.q); pv = (N(v.sp) - N(v.vc)) / N(v.sp);
      } else {
        S = N(v.s); VC = N(v.tvc);
        if (S <= 0) throw UErr('Enter total sales.');
        if (VC >= S) throw UErr('Variable costs must be lower than sales.');
        pv = (S - VC) / S;
      }
      const hasS = S > 0;
      const bepV = FC / pv, cashV = (FC - D) / pv, tgtV = (FC + TP) / pv;
      const cont = S - VC, profit = cont - FC, mos = S - bepV;
      const cu = units ? N(v.sp) - N(v.vc) : null;
      const bepU = units ? FC / cu : null, tgtU = units ? (FC + TP) / cu : null;
      const sm = [
        { l: 'Break-even sales (value)', v: bepV, f: 'money', main: true },
        ...(units ? [{ l: 'Break-even volume (units)', v: bepU, f: 'num' }] : []),
        { l: 'P/V ratio', v: pv * 100, f: 'pct' },
        { l: 'Cash break-even sales', v: cashV, f: 'money' },
        ...(hasS ? [
          { l: 'Margin of safety', v: mos / S * 100, f: 'pct', tone: mos >= 0 ? 'good' : 'bad' },
          { l: 'Profit at expected sales', v: profit, f: 'money', tone: profit >= 0 ? 'good' : 'bad' }] : []),
        ...(TP ? [{ l: 'Sales for target profit', v: tgtV, f: 'money' }] : []),
        ...(units && N(v.cap) > 0 ? [{ l: 'BEP as % of capacity', v: bepU / N(v.cap) * 100, f: 'pct' }] : [])
      ];
      const steps = [
        ...(units ? [step('Contribution per unit', 'Selling price – Variable cost', `${f2(N(v.sp))} – ${f2(N(v.vc))}`, f2(cu))] : []),
        step('P/V ratio', 'Contribution ÷ Sales', units ? `${f2(cu)} ÷ ${f2(N(v.sp))}` : `${f2(cont)} ÷ ${f2(S)}`, pc(pv * 100)),
        ...(units ? [step('BEP (units)', 'Fixed costs ÷ Contribution per unit', `${f2(FC)} ÷ ${f2(cu)}`, fmt(bepU, 'num'))] : []),
        step('BEP (value)', 'Fixed costs ÷ P/V ratio', `${f2(FC)} ÷ ${fmt(pv, 'n4')}`, f2(bepV)),
        step('Cash BEP', '(Fixed costs – Depreciation) ÷ P/V ratio', `${f2(FC - D)} ÷ ${fmt(pv, 'n4')}`, f2(cashV)),
        ...(hasS ? [
          step('Margin of safety', '(Expected sales – BEP sales) ÷ Expected sales', `(${f2(S)} – ${f2(bepV)}) ÷ ${f2(S)}`, pc(mos / S * 100)),
          step('Profit', 'Contribution – Fixed costs', `${f2(cont)} – ${f2(FC)}`, f2(profit))] : []),
        ...(TP ? [step('Sales for target profit', '(Fixed costs + Target profit) ÷ P/V ratio', `${f2(FC + TP)} ÷ ${fmt(pv, 'n4')}`, f2(tgtV) + (units ? ` (${fmt(tgtU, 'num')} units)` : ''))] : [])
      ];
      const maxS = Math.max(S, bepV, tgtV) * 1.3, pts = 8;
      const labels = [], rev = [], tc = [];
      for (let i = 0; i <= pts; i++) { const s = maxS * i / pts; labels.push(compact(units ? s / N(v.sp) : s)); rev.push(s); tc.push(FC + s * (1 - pv)); }
      return {
        summary: sm, steps,
        verdict: hasS ? { tone: profit >= 0 ? 'good' : 'bad', text: profit >= 0 ? `Expected sales are ${pc(mos / S * 100)} above break-even.` : `Expected sales are below break-even by ${f2(-mos)}.` } : null,
        tables: hasS ? [{ title: 'Marginal cost statement', cols: [['Particulars', 'text'], ['Amount', 'money']], rows: [['Sales', S], ['Less: Variable costs', VC], ['Contribution', cont], ['Less: Fixed costs', FC], ['Profit / (Loss)', profit]] }] : [],
        chart: maxS > 0 ? { type: 'line', title: 'Break-even chart (x-axis: ' + (units ? 'units' : 'sales') + ')', labels, series: [{ name: 'Sales revenue', data: rev }, { name: 'Total cost', data: tc }], f: 'money' } : null,
        notes: ['Cash BEP excludes depreciation. Ensure interest and other period costs are included in fixed costs.', ...(units ? ['Break-even volume is shown unrounded; in practice round up to the next whole unit.'] : [])]
      };
    }
  });

  /* 12. Project cost & means of finance */
  def({
    id: 'project', short: 'Project Cost', title: 'Project Cost & Means of Finance', cat: 'credit', icon: 'building', unit: 'lakh',
    desc: 'Cost of project, means of finance, promoter contribution and debt-equity.',
    fields: [
      { k: 'cost', l: 'Cost of project', t: 'grid', add: 'Add cost item',
        cols: [{ k: 'n', l: 'Item', t: 'text' }, { k: 'a', l: 'Amount', t: 'money' }],
        d: [{ n: 'Land & site development', a: 50 }, { n: 'Building & civil works', a: 180 }, { n: 'Plant & machinery', a: 420 }, { n: 'Electrical installation', a: 35 }, { n: 'Misc. fixed assets', a: 25 }, { n: 'Preliminary & pre-operative expenses', a: 20 }] },
      { k: 'cont', l: 'Contingency (% of above items)', t: 'pct', d: 5 },
      { k: 'mm', l: 'Margin money for working capital', t: 'money', d: 60 },
      { k: 'means', l: 'Means of finance', t: 'grid', add: 'Add source', newRow: () => ({ ty: 'debt' }),
        cols: [{ k: 'n', l: 'Source', t: 'text' }, { k: 'ty', l: 'Nature', t: 'select', opts: [['eq', 'Promoter equity'], ['qe', 'Quasi-equity (USL)'], ['debt', 'Debt'], ['sub', 'Subsidy / grant']] }, { k: 'a', l: 'Amount', t: 'money' }],
        d: [{ n: 'Promoters’ capital', ty: 'eq', a: 180 }, { n: 'Unsecured loans from promoters', ty: 'qe', a: 46.5 }, { n: 'Term loan', ty: 'debt', a: 560 }, { n: 'Capital subsidy', ty: 'sub', a: 40 }] },
      { k: 'req', l: 'Minimum promoter contribution required', t: 'pct', d: 25 }
    ],
    compute(v) {
      const items = v.cost.filter(r => isNum(r.a) || r.n);
      const base = items.reduce((s, r) => s + N(r.a), 0);
      const cont = base * N(v.cont) / 100, mm = N(v.mm);
      const total = base + cont + mm;
      if (total <= 0) throw UErr('Enter the cost of project.');
      const means = v.means.filter(r => isNum(r.a));
      const by = t => means.filter(r => r.ty === t).reduce((s, r) => s + N(r.a), 0);
      const eq = by('eq'), qe = by('qe'), debt = by('debt'), sub = by('sub');
      const tm = eq + qe + debt + sub, gap = total - tm;
      const prom = eq + qe, pc1 = prom / total * 100;
      const de = div(debt, prom);
      const req = N(v.req);
      const rows = [...items.map(r => [r.n || 'Item', N(r.a), N(r.a) / total * 100]), ['Contingency @ ' + pc(N(v.cont)), cont, cont / total * 100], ['Margin money for WC', mm, mm / total * 100]];
      const label = { eq: 'Equity', qe: 'Quasi-equity', debt: 'Debt', sub: 'Subsidy' };
      const mrows = means.map(r => [r.n || 'Source', label[r.ty] || '', N(r.a), N(r.a) / total * 100]);
      const balanced = Math.abs(gap) < 0.005;
      return {
        summary: [
          { l: 'Total cost of project', v: total, f: 'money', main: true },
          { l: 'Total means of finance', v: tm, f: 'money' },
          { l: balanced ? 'Funding gap' : gap > 0 ? 'Funding gap (shortfall)' : 'Excess funding', v: Math.abs(gap), f: 'money', tone: balanced ? 'good' : 'bad' },
          { l: 'Promoter contribution', v: pc1, f: 'pct', tone: pc1 >= req ? 'good' : 'bad' },
          { l: 'Debt : Equity', v: de, f: 'ratio' },
          { l: 'Debt as % of project cost', v: debt / total * 100, f: 'pct' }
        ],
        verdict: { tone: balanced && pc1 >= req ? 'good' : 'warn', text: (balanced ? 'Means of finance match the cost of project. ' : `Means of finance ${gap > 0 ? 'fall short by ' : 'exceed cost by '}${f2(Math.abs(gap))}. `) + (pc1 >= req ? `Promoter contribution of ${pc(pc1)} meets the ${pc(req)} requirement.` : `Promoter contribution of ${pc(pc1)} is below the ${pc(req)} requirement (shortfall ${f2(req / 100 * total - prom)}).`) },
        steps: [
          step('Contingency', `${pc(N(v.cont))} × cost items`, `${pc(N(v.cont))} × ${f2(base)}`, f2(cont)),
          step('Total cost', 'Cost items + Contingency + Margin money', `${f2(base)} + ${f2(cont)} + ${f2(mm)}`, f2(total)),
          step('Promoter contribution', '(Equity + Quasi-equity) ÷ Total cost', `${f2(prom)} ÷ ${f2(total)}`, pc(pc1)),
          step('Debt : Equity', 'Debt ÷ (Equity + Quasi-equity)', `${f2(debt)} ÷ ${f2(prom)}`, fmt(de, 'ratio') + ' : 1'),
          step('Gap', 'Total cost – Total means', `${f2(total)} – ${f2(tm)}`, f2(gap))
        ],
        tables: [
          { title: 'Cost of project', cols: [['Particulars', 'text'], ['Amount', 'money'], ['% of total', 'pct']], rows, total: ['Total', total, 100] },
          { title: 'Means of finance', cols: [['Source', 'text'], ['Nature', 'text'], ['Amount', 'money'], ['% of cost', 'pct']], rows: mrows, total: ['Total', '', tm, tm / total * 100] }
        ],
        notes: ['Subsidy is excluded from promoter contribution here; some schemes permit back-ended subsidy to be counted — check the bank’s policy.']
      };
    }
  });

  /* 13. GST */
  def({
    id: 'gst', short: 'GST', title: 'GST Calculator', cat: 'tax', icon: 'percent', unit: 'rs',
    desc: 'Add or remove GST, with CGST/SGST or IGST split.',
    fields: [
      { k: 'a', l: 'Amount', t: 'money', d: 10000 },
      { k: 'r', l: 'GST rate', t: 'select', d: '18', opts: [['0.25', '0.25%'], ['3', '3%'], ['5', '5%'], ['12', '12%'], ['18', '18%'], ['28', '28%'], ['40', '40%'], ['c', 'Custom']] },
      { k: 'cr', l: 'Custom rate', t: 'pct', d: null, show: v => v.r === 'c' },
      { k: 'mode', l: 'Amount is', t: 'select', d: 'ex', opts: [['ex', 'Exclusive of GST (add GST)'], ['in', 'Inclusive of GST (remove GST)']] },
      { k: 'sup', l: 'Supply', t: 'select', d: 'intra', opts: [['intra', 'Intra-state (CGST + SGST)'], ['inter', 'Inter-state (IGST)']] }
    ],
    compute(v) {
      if (v.r === 'c' && !isNum(v.cr)) throw UErr('Enter the custom GST rate.');
      const A = N(v.a), r = v.r === 'c' ? v.cr : parseFloat(v.r);
      if (A <= 0) throw UErr('Enter an amount.');
      if (!(r >= 0) || r > 100) throw UErr('Enter a GST rate between 0% and 100%.');
      const base = v.mode === 'in' ? A * 100 / (100 + r) : A;
      const gst = base * r / 100, tot = base + gst;
      const intra = v.sup === 'intra';
      return {
        summary: [
          { l: 'Total (incl. GST)', v: tot, f: 'money', main: true },
          { l: 'Taxable value', v: base, f: 'money' },
          { l: 'Total GST @ ' + pc(r), v: gst, f: 'money' },
          ...(intra ? [{ l: 'CGST @ ' + pc(r / 2), v: gst / 2, f: 'money' }, { l: 'SGST/UTGST @ ' + pc(r / 2), v: gst / 2, f: 'money' }] : [{ l: 'IGST @ ' + pc(r), v: gst, f: 'money' }])
        ],
        steps: v.mode === 'in'
          ? [step('Taxable value', 'Inclusive amount × 100 ÷ (100 + rate)', `${f2(A)} × 100 ÷ ${fmt(100 + r, 'num')}`, f2(base)), step('GST', 'Inclusive amount – Taxable value', `${f2(A)} – ${f2(base)}`, f2(gst))]
          : [step('GST', 'Taxable value × rate', `${f2(A)} × ${pc(r)}`, f2(gst)), step('Total', 'Taxable value + GST', `${f2(A)} + ${f2(gst)}`, f2(tot))],
        notes: ['Rates shown are the common GST slabs; confirm the applicable rate for the specific HSN/SAC.']
      };
    }
  });

  /* 14. CAGR */
  def({
    id: 'cagr', short: 'CAGR', title: 'CAGR', cat: 'invest', icon: 'growth', unit: 'lakh',
    desc: 'Compound annual growth rate between two values.',
    fields: [
      { k: 'b', l: 'Beginning value', t: 'money', d: 100 },
      { k: 'e', l: 'Ending value', t: 'money', d: 180 },
      { k: 'n', l: 'Number of years', t: 'num', d: 5 }
    ],
    compute(v) {
      const B = N(v.b), E = N(v.e), n = N(v.n);
      if (B <= 0 || E <= 0) throw UErr('Beginning and ending values must be positive.');
      if (n <= 0) throw UErr('Enter the number of years.');
      const g = Math.pow(E / B, 1 / n) - 1;
      const rows = [];
      for (let y = 0; y <= Math.min(Math.ceil(n), 50); y++) { const t = Math.min(y, n); rows.push(['Year ' + fmt(t, t % 1 ? 'num' : 'int'), B * Math.pow(1 + g, t)]); if (t === n) break; }
      return {
        summary: [
          { l: 'CAGR', v: g * 100, f: 'pct', main: true, tone: g >= 0 ? 'good' : 'bad' },
          { l: 'Absolute growth', v: (E / B - 1) * 100, f: 'pct' },
          { l: 'Growth multiple', v: E / B, f: 'x' }
        ],
        steps: [step('CAGR', '(Ending ÷ Beginning)^(1/n) – 1', `(${f2(E)} ÷ ${f2(B)})^(1/${fmt(n, 'num')}) – 1`, pc(g * 100))],
        tables: [{ title: 'Growth path at CAGR', cols: [['Year', 'text'], ['Value', 'money']], rows }]
      };
    }
  });

  /* 15. Depreciation */
  def({
    id: 'dep', short: 'Depreciation', title: 'Depreciation Schedule', cat: 'tax', icon: 'down', unit: 'rs',
    desc: 'SLM or WDV schedule — Companies Act useful-life or Income-tax rate basis.',
    fields: [
      { k: 'c', l: 'Cost of asset', t: 'money', d: 1000000 },
      { k: 'm', l: 'Method', t: 'select', d: 'slm', opts: [['slm', 'Straight-line (SLM)'], ['wdv', 'Written-down value (WDV)']] },
      { k: 's', l: 'Residual value', t: 'money', d: 50000 },
      { k: 'n', l: 'Useful life (years)', t: 'num', d: 10 },
      { k: 'r', l: 'WDV rate (blank = derive from life & residual)', t: 'pct', d: null, show: v => v.m === 'wdv', hint: 'Enter IT Act block rate, e.g. 15% for plant & machinery' },
      { k: 'half', l: 'First year: half rate (put to use < 180 days)', t: 'check', d: false }
    ],
    compute(v) {
      const C = N(v.c), S = N(v.s), n = Math.round(N(v.n));
      if (C <= 0) throw UErr('Enter the cost of the asset.');
      if (S >= C) throw UErr('Residual value must be less than cost.');
      if (n > 100) throw UErr('Useful life cannot exceed 100 years.');
      let rate, steps = [];
      if (v.m === 'slm') {
        if (n <= 0) throw UErr('Enter useful life.');
        rate = (C - S) / C / n;
        steps.push(step('Annual depreciation', '(Cost – Residual value) ÷ Useful life', `(${f2(C)} – ${f2(S)}) ÷ ${n}`, f2((C - S) / n)));
        steps.push(step('SLM rate', 'Annual depreciation ÷ Cost', '', pc(rate * 100)));
      } else {
        if (isNum(v.r) && v.r > 0) { if (v.r > 100) throw UErr('WDV rate cannot exceed 100%.'); rate = v.r / 100; steps.push(step('WDV rate', 'As entered', '', pc(rate * 100))); }
        else {
          if (S <= 0) throw UErr('Enter a residual value (>0) or a WDV rate.');
          if (n <= 0) throw UErr('Enter useful life.');
          rate = 1 - Math.pow(S / C, 1 / n);
          steps.push(step('WDV rate', '1 – (Residual ÷ Cost)^(1/n)', `1 – (${f2(S)} ÷ ${f2(C)})^(1/${n})`, pc(rate * 100)));
        }
        steps.push(step('Annual depreciation', 'Opening WDV × rate', '', ''));
      }
      const yrs = n > 0 ? n : 10;
      const rows = [];
      let wdv = C, acc = 0;
      const slmAnnual = (C - S) / (n || 1);
      for (let y = 1; y <= Math.min(yrs + (v.half && v.m === 'slm' ? 1 : 0), 60); y++) {
        let d;
        const f = v.half && y === 1 ? 0.5 : 1;
        if (v.m === 'slm') d = Math.min(slmAnnual * f, wdv - S);
        else d = wdv * rate * f;
        if (d <= 1e-9) break;
        acc += d; rows.push(['Year ' + y, wdv, d, wdv - d, acc]); wdv -= d;
      }
      if (v.half) steps.push(step('First-year restriction', 'Depreciation for year 1 at 50% of normal (asset used < 180 days)', '', f2(rows[0][2])));
      if (v.m === 'wdv' && !(n > 0)) steps.push(step('Schedule length', 'No useful life entered — schedule shown for 10 years', '', ''));
      return {
        summary: [
          { l: v.m === 'slm' ? 'Annual depreciation' : 'Year 1 depreciation', v: v.m === 'slm' ? slmAnnual : rows[0][2], f: 'money', main: true },
          { l: 'Effective rate', v: rate * 100, f: 'pct' },
          { l: 'Book value at end of schedule', v: wdv, f: 'money' },
          { l: 'Total depreciation charged', v: acc, f: 'money' }
        ],
        steps,
        tables: [{ title: 'Depreciation schedule', cols: [['Year', 'text'], ['Opening value', 'money'], ['Depreciation', 'money'], ['Closing value', 'money'], ['Accumulated', 'money']], rows }],
        notes: ['Companies Act (Sch. II) depreciation is pro-rata by days in the year of addition; the half-rate option models the Income-tax Act rule.']
      };
    }
  });

  /* 16. Loan eligibility */
  def({
    id: 'elig', short: 'Loan Eligibility', title: 'Loan Eligibility (FOIR)', cat: 'loan', icon: 'user', unit: 'rs',
    desc: 'Maximum loan based on income, existing EMIs, FOIR and LTV.',
    fields: [
      { k: 'inc', l: 'Net monthly income', t: 'money', d: 120000 },
      { k: 'ex', l: 'Existing EMIs per month', t: 'money', d: 15000 },
      { k: 'foir', l: 'FOIR (fixed obligation to income ratio)', t: 'pct', d: 50, hint: 'Typically 40% – 60% depending on income' },
      { k: 'rate', l: 'Interest rate (p.a.)', t: 'pct', d: 8.5 },
      { k: 'n', l: 'Tenure (years)', t: 'num', d: 20 },
      { k: 'pv', l: 'Property / asset value (optional)', t: 'money', d: 7500000 },
      { k: 'ltv', l: 'Maximum LTV', t: 'pct', d: 80 }
    ],
    compute(v) {
      const inc = N(v.inc), n = Math.round(N(v.n) * 12);
      if (inc <= 0) throw UErr('Enter net monthly income.');
      if (n <= 0) throw UErr('Enter tenure.');
      const maxEmi = inc * N(v.foir) / 100 - N(v.ex);
      if (maxEmi <= 0) throw UErr('Existing EMIs already exhaust the FOIR limit — no further eligibility.');
      const byInc = pvAnnuity(maxEmi, N(v.rate), n);
      const byLtv = N(v.pv) > 0 && N(v.ltv) > 0 ? N(v.pv) * N(v.ltv) / 100 : null;
      if (N(v.rate) > 100) throw UErr('Interest rate looks too high — enter the annual rate in %.');
      if (n > 600) throw UErr('Tenure cannot exceed 50 years.');
      const elig = byLtv != null ? Math.min(byInc, byLtv) : byInc;
      const emi = emiOf(elig, N(v.rate), n);
      return {
        summary: [
          { l: 'Eligible loan amount', v: elig, f: 'money', main: true },
          { l: 'Maximum affordable EMI', v: maxEmi, f: 'money' },
          { l: 'Loan as per income', v: byInc, f: 'money' },
          { l: 'Loan as per LTV', v: byLtv, f: 'money' },
          { l: 'EMI on eligible loan', v: emi, f: 'money' }
        ],
        steps: [
          step('Maximum EMI', 'Income × FOIR – Existing EMIs', `${f2(inc)} × ${pc(N(v.foir))} – ${f2(N(v.ex))}`, f2(maxEmi)),
          step('Loan by income', 'EMI × [1 – (1 + i)^–n] ÷ i', `i = ${fmt(N(v.rate) / 12, 'pct4')}, n = ${n}`, f2(byInc)),
          ...(byLtv != null ? [step('Loan by LTV', 'Asset value × LTV', `${f2(N(v.pv))} × ${pc(N(v.ltv))}`, f2(byLtv))] : []),
          step('Eligible loan', byLtv != null ? 'Lower of income-based and LTV-based amounts' : 'Income-based amount', '', f2(elig))
        ]
      };
    }
  });

  /* 17. FACR */
  def({
    id: 'facr', short: 'FACR', title: 'Fixed Asset Coverage Ratio', cat: 'credit', icon: 'lock', unit: 'lakh',
    desc: 'Security cover of fixed assets for term loans.',
    fields: [
      { k: 'nfa', l: 'Net block of fixed assets', t: 'money', d: 900 },
      { k: 'ex', l: 'Less: assets not charged / revaluation reserve', t: 'money', d: 50 },
      { k: 'tl', l: 'Term loans outstanding (secured on these assets)', t: 'money', d: 520 },
      { k: 'thr', l: 'Benchmark FACR', t: 'num', d: 1.33 }
    ],
    compute(v) {
      const sec = N(v.nfa) - N(v.ex), tl = N(v.tl);
      if (tl <= 0) throw UErr('Enter term loans outstanding.');
      const r = sec / tl, mar = div(sec - tl, sec) * 100, thr = N(v.thr) || 1.33;
      return {
        summary: [
          { l: 'FACR', v: r, f: 'x', main: true, tone: r >= thr ? 'good' : 'bad' },
          { l: 'Net fixed assets available as security', v: sec, f: 'money' },
          { l: 'Security margin', v: mar, f: 'pct' },
          { l: 'Max term loan at benchmark', v: sec / thr, f: 'money' }
        ],
        verdict: { tone: r >= thr ? 'good' : 'bad', text: r >= thr ? `FACR of ${fmt(r, 'x')} meets the benchmark of ${fmt(thr, 'x')}.` : `FACR of ${fmt(r, 'x')} is below the benchmark of ${fmt(thr, 'x')} — additional security may be required.` },
        steps: [
          step('Security value', 'Net block – Assets not charged', `${f2(N(v.nfa))} – ${f2(N(v.ex))}`, f2(sec)),
          step('FACR', 'Net fixed assets ÷ Term loans outstanding', `${f2(sec)} ÷ ${f2(tl)}`, fmt(r, 'x')),
          step('Security margin', '(Security – Loan) ÷ Security', `${f2(sec - tl)} ÷ ${f2(sec)}`, pc(mar))
        ]
      };
    }
  });

  /* 18. FD / Compound interest */
  def({
    id: 'fd', short: 'FD / Interest', title: 'FD & Compound Interest', cat: 'loan', icon: 'coins', unit: 'rs',
    desc: 'Maturity value with chosen compounding, effective yield and year-wise growth.',
    fields: [
      { k: 'p', l: 'Principal', t: 'money', d: 500000 },
      { k: 'r', l: 'Interest rate (p.a.)', t: 'pct', d: 7.25 },
      { k: 'y', l: 'Tenure (years)', t: 'num', d: 3 },
      { k: 'c', l: 'Compounding', t: 'select', d: '4', opts: [['12', 'Monthly'], ['4', 'Quarterly'], ['2', 'Half-yearly'], ['1', 'Yearly'], ['0', 'Simple interest']] }
    ],
    compute(v) {
      const P = N(v.p), r = N(v.r) / 100, t = N(v.y), m = parseInt(v.c, 10);
      if (P <= 0 || t <= 0) throw UErr('Enter principal and tenure.');
      if (t > 60) throw UErr('Tenure cannot exceed 60 years.');
      const val = y => (m === 0 ? P * (1 + r * y) : P * Math.pow(1 + r / m, m * y));
      const A = val(t), ear = m === 0 ? r : Math.pow(1 + r / m, m) - 1;
      const rows = [];
      for (let y = 1; y <= Math.min(Math.ceil(t), 60); y++) { const yy = Math.min(y, t), a0 = val(Math.min(y - 1, t)), a1 = val(yy); rows.push(['Year ' + y, a0, a1 - a0, a1]); }
      return {
        summary: [
          { l: 'Maturity value', v: A, f: 'money', main: true },
          { l: 'Total interest', v: A - P, f: 'money' },
          { l: 'Effective annual yield', v: ear * 100, f: 'pct' }
        ],
        steps: [m === 0
          ? step('Simple interest', 'A = P × (1 + r × t)', `${f2(P)} × (1 + ${pc(r * 100)} × ${t})`, f2(A))
          : step('Compound interest', 'A = P × (1 + r/m)^(m × t)', `${f2(P)} × (1 + ${fmt(r * 100, 'num')}%/${m})^(${m} × ${t})`, f2(A)),
        step('Effective yield', m === 0 ? 'Equal to nominal rate' : '(1 + r/m)^m – 1', '', pc(ear * 100))],
        tables: [{ title: 'Year-wise growth', cols: [['Year', 'text'], ['Opening', 'money'], ['Interest', 'money'], ['Closing', 'money']], rows }],
        notes: ['Interest is shown before TDS.']
      };
    }
  });

  G.CAT = { CATS, CALCS, fmt, fmtDate, internals: { irr, xirr, npvAt, emiOf, pvAnnuity, payback, findRoots } };
})(typeof window !== 'undefined' ? window : globalThis);
