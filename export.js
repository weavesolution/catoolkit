/* CA Financial Toolkit — dependency-free PDF and XLSX writers (work offline) */
(function (G) {
  'use strict';

  /* ================= PDF ================= */
  const HW = [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584];
  const HB = [278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,389,280,389,584];

  function ascii(s) {
    return String(s == null ? '' : s)
      .replace(/₹\s?/g, 'Rs. ').replace(/[×✕]/g, 'x').replace(/÷/g, '/').replace(/[−–—]/g, '-')
      .replace(/≥/g, '>=').replace(/≤/g, '<=').replace(/≈/g, '~').replace(/Σ/g, 'Sum ').replace(/[‘’]/g, "'").replace(/[“”]/g, '"')
      .replace(/…/g, '...').replace(/•/g, '-').replace(/ᵗ/g, '^t').replace(/ⁿ/g, '^n').replace(/ᵢ/g, 'i').replace(/₀/g, '0').replace(/ₜ/g, 't')
      .replace(/ /g, ' ').replace(/[^\x20-\x7e]/g, '');
  }
  const esc = s => s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  function tw(s, size, bold) {
    const w = bold ? HB : HW;
    let t = 0;
    for (const ch of s) { const c = ch.charCodeAt(0); t += w[c - 32] || 556; }
    return (t * size) / 1000;
  }
  function wrap(s, size, bold, width) {
    s = ascii(s);
    if (tw(s, size, bold) <= width) return [s];
    const words = s.split(' '), lines = [];
    let cur = '';
    for (const w of words) {
      const t = cur ? cur + ' ' + w : w;
      if (tw(t, size, bold) <= width) cur = t;
      else {
        if (cur) lines.push(cur);
        if (tw(w, size, bold) > width) { // hard-break long word
          let part = '';
          for (const ch of w) { if (tw(part + ch, size, bold) > width) { lines.push(part); part = ch; } else part += ch; }
          cur = part;
        } else cur = w;
      }
    }
    if (cur) lines.push(cur);
    return lines;
  }
  function fit(s, size, bold, width) { // truncate with ellipsis to fit width
    s = ascii(s);
    if (tw(s, size, bold) <= width) return s;
    while (s.length > 1 && tw(s + '...', size, bold) > width) s = s.slice(0, -1);
    return s + '...';
  }
  const hex = h => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(x => (x / 255).toFixed(3)).join(' '); };

  function PDFDoc() {
    const W = 595.28, H = 841.89;
    const pages = [];
    let cur;
    const api = {
      W, H,
      add() { cur = []; pages.push(cur); },
      text(x, y, s, o = {}) {
        const size = o.size || 9, bold = !!o.bold;
        s = ascii(s);
        let xx = x;
        if (o.align === 'right') xx = x - tw(s, size, bold);
        else if (o.align === 'center') xx = x - tw(s, size, bold) / 2;
        cur.push(`BT /${bold ? 'F2' : 'F1'} ${size} Tf ${hex(o.color || '#1b2433')} rg ${xx.toFixed(2)} ${(H - y).toFixed(2)} Td (${esc(s)}) Tj ET`);
      },
      rect(x, y, w, h, fill) { cur.push(`${hex(fill)} rg ${x.toFixed(2)} ${(H - y - h).toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re f`); },
      line(x1, y1, x2, y2, color = '#c9cfd8', w = 0.5) { cur.push(`${hex(color)} RG ${w} w ${x1.toFixed(2)} ${(H - y1).toFixed(2)} m ${x2.toFixed(2)} ${(H - y2).toFixed(2)} l S`); },
      pageCount: () => pages.length,
      setPage(i) { cur = pages[i]; },
      output() {
        const objs = [];
        objs[1] = '<< /Type /Catalog /Pages 2 0 R >>';
        objs[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
        objs[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';
        const kids = [];
        pages.forEach((p, i) => {
          const po = 5 + i * 2, co = po + 1, stream = p.join('\n');
          kids.push(po + ' 0 R');
          objs[po] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${co} 0 R >>`;
          objs[co] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
        });
        objs[2] = `<< /Type /Pages /Kids [${kids.join(' ')}] /Count ${pages.length} >>`;
        let out = '%PDF-1.4\n';
        const off = [];
        for (let i = 1; i < objs.length; i++) { off[i] = out.length; out += `${i} 0 obj\n${objs[i]}\nendobj\n`; }
        const x = out.length;
        out += `xref\n0 ${objs.length}\n0000000000 65535 f \n`;
        for (let i = 1; i < objs.length; i++) out += String(off[i]).padStart(10, '0') + ' 00000 n \n';
        out += `trailer\n<< /Size ${objs.length} /Root 1 0 R >>\nstartxref\n${x}\n%%EOF`;
        const bytes = new Uint8Array(out.length);
        for (let i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i) & 255;
        return new Blob([bytes], { type: 'application/pdf' });
      }
    };
    return api;
  }

  const INK = '#13233a', ACC = '#0b6e63', MUTED = '#5b6676', ZEBRA = '#f3f5f8', HEAD = '#13233a';
  const NUMF = ['money', 'int', 'pct', 'pct4', 'x', 'ratio', 'days', 'yrs', 'n4', 'num'];

  function buildPDF(rep) {
    const d = PDFDoc(), M = 40, CW = d.W - 2 * M, BOTTOM = d.H - 50;
    let y;
    const newPage = () => { d.add(); y = 44; };
    const ensure = h => { if (y + h > BOTTOM) { newPage(); return true; } return false; };
    newPage();
    // header
    d.rect(0, 0, d.W, 6, ACC);
    d.text(M, y + 4, fit(rep.firm || 'CA Financial Toolkit', 13, true, CW - 110), { size: 13, bold: true, color: INK });
    d.text(d.W - M, y + 4, 'Date: ' + rep.date, { size: 9, align: 'right', color: MUTED });
    y += 18;
    if (rep.preparedBy) { d.text(M, y, fit('Prepared by: ' + rep.preparedBy, 8.5, false, CW), { size: 8.5, color: MUTED }); y += 12; }
    d.line(M, y, d.W - M, y, '#d5dae1', 0.8); y += 22;
    d.text(M, y, fit(rep.title, 17, true, CW), { size: 17, bold: true, color: INK }); y += 16;
    const meta = [rep.ref ? 'Reference: ' + rep.ref : '', 'Amounts in ' + rep.unitLabel].filter(Boolean).join('   |   ');
    wrap(meta, 9, false, CW).forEach(ln => { d.text(M, y, ln, { size: 9, color: MUTED }); y += 12; }); y += 6;

    const section = t => { ensure(90); y += 8; d.text(M, y, t.toUpperCase(), { size: 9.5, bold: true, color: ACC }); y += 5; d.line(M, y, d.W - M, y, ACC, 0.8); y += 12; };

    function table(cols, rows, opts = {}) {
      // cols: [{l, f}] ; rows: arrays of display strings ; totalRow index set
      let size = opts.size || 8.5;
      const pad = 5;
      const isNumCol = cols.map(c => NUMF.includes(c.f));
      const nat = cols.map((c, i) => Math.max(tw(ascii(c.l), size, true), ...rows.map(r => tw(ascii(r[i]), size, false))) + pad * 2);
      let widths;
      const tot = nat.reduce((a, b) => a + b, 0);
      if (tot <= CW) widths = nat.map(w => w + (CW - tot) * (w / tot));
      else {
        const numW = nat.reduce((s, w, i) => s + (isNumCol[i] ? w : 0), 0);
        const txtN = nat.filter((w, i) => !isNumCol[i]);
        const avail = CW - numW;
        if (txtN.length && avail >= txtN.length * 60) {
          const txtTot = txtN.reduce((a, b) => a + b, 0);
          widths = nat.map((w, i) => (isNumCol[i] ? w : Math.max(60, (w / txtTot) * avail)));
          const s = widths.reduce((a, b) => a + b, 0); widths = widths.map(w => (w * CW) / s);
        } else { const k = CW / tot; widths = nat.map(w => w * k); size = Math.max(6.5, size * Math.max(k, 0.78)); }
      }
      const lh = size * 1.3;
      const header = () => {
        const hl = cols.map((c, i) => wrap(c.l, size, true, widths[i] - pad * 2));
        const hh = Math.max(...hl.map(l => l.length)) * lh + 6;
        ensure(hh + lh + 6);
        d.rect(M, y, CW, hh, HEAD);
        let x = M;
        cols.forEach((c, i) => {
          hl[i].forEach((ln, j) => d.text(isNumCol[i] ? x + widths[i] - pad : x + pad, y + 3 + size + j * lh, ln, { size, bold: true, color: '#ffffff', align: isNumCol[i] ? 'right' : 'left' }));
          x += widths[i];
        });
        y += hh;
      };
      header();
      rows.forEach((r, ri) => {
        const bold = opts.bold && opts.bold.includes(ri);
        const cl = r.map((c, i) => (isNumCol[i] ? [ascii(c)] : wrap(c, size, bold, widths[i] - pad * 2)));
        const rh = Math.max(...cl.map(l => l.length)) * lh + 5;
        if (ensure(rh)) header();
        if (bold) d.rect(M, y, CW, rh, '#e3ece9'); else if (ri % 2) d.rect(M, y, CW, rh, ZEBRA);
        let x = M;
        r.forEach((c, i) => {
          cl[i].forEach((ln, j) => d.text(isNumCol[i] ? x + widths[i] - pad : x + pad, y + 2.5 + size + j * lh, ln, { size, bold, align: isNumCol[i] ? 'right' : 'left' }));
          x += widths[i];
        });
        y += rh;
      });
      d.line(M, y, d.W - M, y, '#b8c0cb', 0.6);
      y += 10;
    }

    if (rep.verdict) {
      const col = { good: '#0b6e63', warn: '#a86200', bad: '#b3261e' }[rep.verdict.tone] || INK;
      const lines = wrap(rep.verdict.text, 9.5, false, CW - 20);
      const h = lines.length * 12.5 + 12;
      ensure(h);
      d.rect(M, y, CW, h, '#f2f4f7'); d.rect(M, y, 3, h, col);
      lines.forEach((ln, i) => d.text(M + 12, y + 15 + i * 12.5, ln, { size: 9.5, color: col }));
      y += h + 8;
    }
    section('Key results');
    table([{ l: 'Particulars', f: 'text' }, { l: 'Result', f: 'num' }], rep.summary.map(s => [s[0], s[1]]), { bold: [0] });

    section('Inputs');
    table([{ l: 'Particulars', f: 'text' }, { l: 'Value', f: 'num' }], rep.inputs);
    rep.inputTables.forEach(t => {
      ensure(30); d.text(M, y + 2, t.title, { size: 9, bold: true, color: INK }); y += 10;
      table(t.cols.map(c => ({ l: c[0], f: c[1] })), t.rows);
    });

    if (rep.steps.length) {
      section('Workings');
      rep.steps.forEach((s, i) => {
        const fl = wrap('Formula: ' + s.f, 8.5, false, CW - 120);
        const cl = s.c ? wrap(s.c, 8.5, false, CW - 120) : [];
        const h = 13 + (fl.length + cl.length) * 11 + 6;
        ensure(h);
        const rw = s.r ? tw(ascii(s.r), 9.5, true) + 12 : 0;
        d.text(M, y + 9, fit(`${i + 1}. ${s.t}`, 9.5, true, CW - rw), { size: 9.5, bold: true, color: INK });
        if (s.r) d.text(d.W - M, y + 9, fit(s.r, 9.5, true, CW * 0.6), { size: 9.5, bold: true, color: ACC, align: 'right' });
        let yy = y + 22;
        fl.forEach(ln => { d.text(M + 12, yy, ln, { size: 8.5, color: MUTED }); yy += 11; });
        cl.forEach(ln => { d.text(M + 12, yy, ln, { size: 8.5 }); yy += 11; });
        y = yy + 2;
        d.line(M, y, d.W - M, y, '#e3e7ec', 0.4); y += 4;
      });
    }
    rep.tables.forEach(t => {
      section(t.title);
      const rows = t.frows.slice();
      const bold = [];
      if (t.ftotal) { rows.push(t.ftotal); bold.push(rows.length - 1); }
      table(t.cols.map(c => ({ l: c[0], f: c[1] === 'mixed' ? 'num' : c[1] })), rows, { bold });
    });
    if (rep.notes.length) {
      section('Notes');
      rep.notes.forEach(n => { const l = wrap('- ' + n, 8.5, false, CW); ensure(l.length * 11 + 4); l.forEach(ln => { d.text(M, y + 8, ln, { size: 8.5, color: MUTED }); y += 11; }); y += 3; });
    }
    // footers
    const n = d.pageCount();
    for (let i = 0; i < n; i++) {
      d.setPage(i);
      d.line(M, d.H - 34, d.W - M, d.H - 34, '#d5dae1', 0.5);
      d.text(M, d.H - 22, fit((rep.firm || 'CA Financial Toolkit') + '  -  ' + rep.title, 7.5, false, CW - 70), { size: 7.5, color: MUTED });
      d.text(d.W - M, d.H - 22, `Page ${i + 1} of ${n}`, { size: 7.5, color: MUTED, align: 'right' });
    }
    return d.output();
  }

  /* ================= XLSX ================= */
  const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  const crc32 = b => { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  function zip(files) { // [{name, data:Uint8Array}]
    const enc = new TextEncoder(), parts = [], cd = [];
    let off = 0;
    const now = new Date();
    const dt = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
    const tm = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
    files.forEach(f => {
      const name = enc.encode(f.name), data = f.data, crc = crc32(data);
      const h = new DataView(new ArrayBuffer(30));
      h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0, true); h.setUint16(8, 0, true);
      h.setUint16(10, tm, true); h.setUint16(12, dt, true); h.setUint32(14, crc, true);
      h.setUint32(18, data.length, true); h.setUint32(22, data.length, true); h.setUint16(26, name.length, true); h.setUint16(28, 0, true);
      parts.push(new Uint8Array(h.buffer), name, data);
      const c = new DataView(new ArrayBuffer(46));
      c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0, true); c.setUint16(10, 0, true);
      c.setUint16(12, tm, true); c.setUint16(14, dt, true); c.setUint32(16, crc, true); c.setUint32(20, data.length, true); c.setUint32(24, data.length, true);
      c.setUint16(28, name.length, true); c.setUint16(30, 0, true); c.setUint16(32, 0, true); c.setUint16(34, 0, true); c.setUint16(36, 0, true);
      c.setUint32(38, 0, true); c.setUint32(42, off, true);
      cd.push(new Uint8Array(c.buffer), name);
      off += 30 + name.length + data.length;
    });
    const cdSize = cd.reduce((s, p) => s + p.length, 0);
    const e = new DataView(new ArrayBuffer(22));
    e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true);
    e.setUint32(12, cdSize, true); e.setUint32(16, off, true);
    return new Blob([...parts, ...cd, new Uint8Array(e.buffer)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  }
  const xesc = s => String(s).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const colL = i => { let s = ''; i++; while (i) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; };
  // style ids
  const ST = { text: 0, bold: 1, money: 2, bmoney: 3, head: 4, title: 5, pct: 6, ratio: 7, bpct: 8, bratio: 9, muted: 10, int: 11, x: 12, days: 13, n4: 14, bx: 15, wrap: 16 };
  const styleFor = (f, bold) => {
    switch (f) {
      case 'money': case 'num': case 'yrs': return bold ? ST.bmoney : ST.money;
      case 'pct': case 'pct4': return bold ? ST.bpct : ST.pct;
      case 'ratio': return bold ? ST.bratio : ST.ratio;
      case 'x': return bold ? ST.bx : ST.x;
      case 'int': return ST.int;
      case 'days': return ST.days;
      case 'n4': return ST.n4;
      default: return bold ? ST.bold : ST.text;
    }
  };
  const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="4"><numFmt numFmtId="164" formatCode="0.00&quot;%&quot;"/><numFmt numFmtId="165" formatCode="0.00&quot;x&quot;"/><numFmt numFmtId="166" formatCode="#,##0&quot; days&quot;"/><numFmt numFmtId="167" formatCode="0.0000"/></numFmts>
<fonts count="5"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="15"/><color rgb="FF13233A"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font><font><i/><sz val="10"/><color rgb="FF5B6676"/><name val="Calibri"/></font></fonts>
<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF13233A"/><bgColor indexed="64"/></patternFill></fill></fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="17">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="4" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="4" fontId="1" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/>
<xf numFmtId="0" fontId="3" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment wrapText="1" vertical="center"/></xf>
<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="2" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="164" fontId="1" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/>
<xf numFmtId="2" fontId="1" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/>
<xf numFmtId="0" fontId="4" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="3" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="166" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="167" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="165" fontId="1" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/>
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment wrapText="1" vertical="top"/></xf>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

  function sheetXML(rows, widths) {
    const cols = widths && widths.length ? '<cols>' + widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('') + '</cols>' : '';
    const body = rows.map((r, ri) => {
      if (!r) return '';
      const cells = r.map((c, ci) => {
        if (c == null) return '';
        const cell = typeof c === 'object' ? c : { v: c };
        if (cell.v == null || cell.v === '') return '';
        const ref = colL(ci) + (ri + 1), s = cell.s || 0;
        if (typeof cell.v === 'number' && isFinite(cell.v)) return `<c r="${ref}" s="${s}"><v>${cell.v}</v></c>`;
        return `<c r="${ref}" s="${s}" t="inlineStr"><is><t xml:space="preserve">${xesc(cell.v)}</t></is></c>`;
      }).join('');
      return `<row r="${ri + 1}">${cells}</row>`;
    }).join('');
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"/></sheetViews>${cols}<sheetData>${body}</sheetData></worksheet>`;
  }
  const sheetName = (s, used) => { let n = s.replace(/[\[\]:*?\/\\]/g, ' ').slice(0, 31).trim() || 'Sheet'; let b = n, k = 2; while (used.has(n)) n = b.slice(0, 28) + ' ' + k++; used.add(n); return n; };

  function buildXLSX(rep) {
    const sheets = [], used = new Set();
    const cellNum = (v, f, bold) => (typeof v === 'number' && isFinite(v) ? { v, s: styleFor(f, bold) } : { v: v == null ? '' : v, s: bold ? ST.bold : ST.text });
    // Report sheet
    const R = [];
    R.push([{ v: rep.title, s: ST.title }]);
    R.push([{ v: rep.firm || '', s: ST.bold }]);
    R.push([{ v: 'Date: ' + rep.date + (rep.ref ? '   |   Reference: ' + rep.ref : '') + '   |   Amounts in ' + rep.unitLabel, s: ST.muted }]);
    if (rep.verdict) R.push([{ v: rep.verdict.text, s: ST.muted }]);
    R.push(null);
    R.push([{ v: 'Key results', s: ST.head }, { v: '', s: ST.head }]);
    rep.summaryRaw.forEach((s, i) => R.push([{ v: s.l, s: i === 0 ? ST.bold : ST.text }, cellNum(s.v, s.f, i === 0)]));
    R.push(null);
    R.push([{ v: 'Inputs', s: ST.head }, { v: '', s: ST.head }]);
    rep.inputsRaw.forEach(r => R.push([r[0], cellNum(r[1], r[2])]));
    rep.inputTables.forEach(t => {
      R.push(null);
      R.push([{ v: t.title, s: ST.bold }]);
      R.push(t.cols.map(c => ({ v: c[0], s: ST.head })));
      t.raw.forEach(r => R.push(r.map((v, i) => cellNum(v, t.cols[i][1]))));
    });
    sheets.push({ name: sheetName('Report', used), xml: sheetXML(R, [46, 22, 18, 18, 18, 18]) });
    // Workings
    if (rep.steps.length) {
      const Wk = [[{ v: 'Workings — ' + rep.title, s: ST.title }], null, ['#', 'Step', 'Formula', 'Computation', 'Result'].map(h => ({ v: h, s: ST.head }))];
      rep.steps.forEach((s, i) => Wk.push([i + 1, { v: s.t, s: ST.bold }, { v: s.f, s: ST.wrap }, { v: s.c, s: ST.wrap }, { v: s.r, s: ST.bold }]));
      sheets.push({ name: sheetName('Workings', used), xml: sheetXML(Wk, [5, 26, 50, 50, 18]) });
    }
    rep.tables.forEach(t => {
      const T = [[{ v: t.title, s: ST.title }], null, t.cols.map(c => ({ v: c[0], s: ST.head }))];
      t.rows.forEach(r => T.push(r.map((v, i) => cellNum(v, t.cols[i][1]))));
      if (t.total) T.push(t.total.map((v, i) => cellNum(v, t.cols[i][1], true)));
      const widths = t.cols.map((c, i) => Math.min(60, Math.max(12, c[0].length + 2, ...t.rows.slice(0, 200).map(r => (typeof r[i] === 'string' ? r[i].length + 2 : 14)))));
      sheets.push({ name: sheetName(t.title, used), xml: sheetXML(T, widths) });
    });
    if (rep.notes.length) sheets.push({ name: sheetName('Notes', used), xml: sheetXML([[{ v: 'Notes', s: ST.title }], null, ...rep.notes.map(n => [{ v: n, s: ST.wrap }])], [110]) });

    const enc = new TextEncoder();
    const files = [];
    files.push({ name: '[Content_Types].xml', data: enc.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((s, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`) });
    files.push({ name: '_rels/.rels', data: enc.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`) });
    files.push({ name: 'xl/workbook.xml', data: enc.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map((s, i) => `<sheet name="${xesc(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`) });
    files.push({ name: 'xl/_rels/workbook.xml.rels', data: enc.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((s, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`) });
    files.push({ name: 'xl/styles.xml', data: enc.encode(STYLES) });
    sheets.forEach((s, i) => files.push({ name: `xl/worksheets/sheet${i + 1}.xml`, data: enc.encode(s.xml) }));
    return zip(files);
  }

  G.CAExport = { buildPDF, buildXLSX };
})(typeof window !== 'undefined' ? window : globalThis);
