/**
 * SvgTextEditor - Inline-Rich-Text-Editor, der direkt natives SVG-<text> erzeugt.
 * Keine Abhängigkeiten (weder Vue noch SVG.js).
 *
 * Prinzip: Das, was beim Editieren angezeigt wird, ist bereits das finale SVG
 * (<text> pro Zeile, <tspan> pro Style-Run). Cursor/Markierung werden aus
 * getExtentOfChar() desselben Elements berechnet. Beim Beenden wird nichts
 * konvertiert, daher gibt es keinen Ruckler.
 */
const SVG = 'http://www.w3.org/2000/svg';
const XML = 'http://www.w3.org/XML/1998/namespace';
const MIME = 'application/x-svg-text-editor';

const mk = (tag, attrs, parent) => {
  const n = document.createElementNS(SVG, tag);
  for (const k in attrs) n.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(n);
  return n;
};
const isSp = (c) => c === ' ' || c === '\t';
const isWord = (c) => c !== undefined && c !== '\n' && !isSp(c);

export class SvgTextEditor {
  /**
   * @param {SVGElement} parent  <svg> oder <g>, in das der Editor eine eigene <g> einhängt
   * @param {object} opts  x, y (oben links der Box), width (null = kein Umbruch), fontFamily, fontSize,
   *   fill, lineHeight, align ('left'|'center'|'right'), runs | text, editing,
   *   onChange(runs), onSelection({start,end,format}), onBlur(), onFocus(), onEscape()
   */
  constructor(parent, opts = {}) {
    this.o = {
      x: 0, y: 0, width: null, fontFamily: 'sans-serif', fontSize: 16, fill: '#000',
      lineHeight: 1.25, align: 'left', caretColor: '#1a73e8', selectionColor: 'rgba(26,115,232,.3)',
      text: '', runs: null, editing: false,
      onChange() {}, onSelection() {}, onBlur() {}, onFocus() {}, onEscape: null,
    };
    this._merge(opts);
    this._setBase();
    this._pool = new Map(); // Style-Interning
    this._mc = new Map(); // Messcache
    this.chars = []; this.st = []; this.lines = [];
    this.anchor = this.head = 0;
    this.goalX = null; this.affEnd = false; this.pend = null; this.comp = null;
    this.undo = []; this.redo = []; this.editing = false;

    this.g = mk('g', { class: 'svg-text-editor' }, parent);
    this.hit = mk('rect', { fill: 'transparent', 'pointer-events': 'none' }, this.g);
    this.gSel = mk('g', { 'pointer-events': 'none' }, this.g);
    this.gText = mk('g', {}, this.g);
    this.caret = mk('line', { stroke: this.o.caretColor, 'stroke-width': 1.5, visibility: 'hidden', 'pointer-events': 'none' }, this.g);
    this.meas = mk('text', { visibility: 'hidden', 'pointer-events': 'none', style: 'white-space:pre' }, this.g);
    this.meas.setAttributeNS(XML, 'xml:space', 'preserve');

    this._load(this.o.runs || [{ text: this.o.text }]);
    this._render();
    if (this.o.editing) this.startEditing();
    // Schriften nachgeladen -> Messwerte neu berechnen
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => { if (this.g.isConnected) this.refresh(); });
    }
  }

  /* ───────────── öffentliche API ───────────── */

  get textGroup() { return this.gText; } // enthält die fertigen nativen <text>-Elemente
  getText() { return this.chars.join(''); }

  getRuns(a = 0, b = this.chars.length) {
    const out = [];
    for (let i = a; i < b; i++) {
      const s = this.st[i], last = out[out.length - 1];
      if (last && last._s === s) last.text += this.chars[i];
      else out.push({ _s: s, text: this.chars[i] });
    }
    return out.map(({ _s, text }) => { const { key, ...p } = _s; return { text, ...p }; });
  }

  getLayoutSnapshot() {
    const round = (value) => Math.round(value * 1000) / 1000;
    const styles = [];
    const styleIds = new Map();
    const styleId = (value) => {
      let id = styleIds.get(value);
      if (id === undefined) {
        const { key, ...publicStyle } = value;
        id = styles.length;
        styles.push(publicStyle);
        styleIds.set(value, id);
      }
      return id;
    };
    const lines = this.lines.map((line) => {
      const xs = this._xs(line);
      const segments = [];
      let i = line.s;
      while (i < line.e) {
        const start = i;
        if (isSp(this.chars[i])) {
          while (i < line.e && isSp(this.chars[i])) i++;
        } else {
          while (i < line.e && !isSp(this.chars[i])) i++;
          while (i < line.e && isSp(this.chars[i])) i++;
        }

        const fragments = [];
        let k = start;
        while (k < i) {
          let end = k + 1;
          while (end < i && this.st[end] === this.st[k]) end++;
          const x1 = xs[k - line.s], x2 = xs[end - line.s];
          fragments.push({
            text: this.chars.slice(k, end).join(''),
            x: round(x1),
            width: round(Math.abs(x2 - x1)),
            styleId: styleId(this.st[k]),
          });
          k = end;
        }

        const x1 = xs[start - line.s], x2 = xs[i - line.s];
        segments.push({
          text: this.chars.slice(start, i).join(''),
          start,
          end: i,
          x: round(x1),
          width: round(Math.abs(x2 - x1)),
          fragments,
        });
      }
      return {
        start: line.s,
        end: line.e,
        top: round(line.y),
        baseline: round(line.base),
        height: round(line.h),
        paragraphEnd: line.hard,
        segments,
      };
    });

    return {
      version: 1,
      layout: {
        x: this.o.x,
        y: this.o.y,
        width: this.o.width,
        height: round(this.height),
        fontFamily: this.o.fontFamily,
        fontSize: this.o.fontSize,
        fill: this.o.fill,
        lineHeight: this.o.lineHeight,
        align: this.o.align,
      },
      styles,
      lines,
    };
  }

  setRuns(runs) { this._load(runs); this.refresh(); }
  setText(text) { this.setRuns([{ text }]); }
  refresh() { this._mc.clear(); this._render(); this._update(); }

  setOptions(patch) {
    const old = this.base;
    this._merge(patch);
    this._setBase();
    this.caret.setAttribute('stroke', this.o.caretColor);
    // Zeichen, die noch den alten Default hatten, folgen dem neuen Default
    for (let i = 0; i < this.st.length; i++) {
      const s = this.st[i], q = {};
      if (s.size === old.size) q.size = this.base.size;
      if (s.family === old.family) q.family = this.base.family;
      if (s.fill === old.fill) q.fill = this.base.fill;
      this.st[i] = this._style({ ...s, ...q });
    }
    this.refresh();
  }

  startEditing() {
    if (this.editing) return;
    this.editing = true;
    this.hit.setAttribute('pointer-events', 'all');
    const ta = (this.ta = document.createElement('textarea'));
    Object.assign(ta.style, {
      position: 'fixed', left: '0px', top: '0px', width: '1px', height: '1px', opacity: '0',
      padding: '0', border: '0', outline: 'none', resize: 'none', overflow: 'hidden',
      pointerEvents: 'none', font: '16px sans-serif', zIndex: '-1',
    });
    ta.setAttribute('autocapitalize', 'off'); ta.setAttribute('autocomplete', 'off');
    ta.setAttribute('autocorrect', 'off'); ta.spellcheck = false; ta.setAttribute('aria-label', 'Text');
    document.body.appendChild(ta);

    this._on = (t, ev, fn, opt) => { t.addEventListener(ev, fn, opt); (this._offs ||= []).push(() => t.removeEventListener(ev, fn, opt)); };
    this._on(ta, 'keydown', (e) => this._key(e));
    this._on(ta, 'input', () => this._input());
    this._on(ta, 'beforeinput', (e) => this._beforeInput(e));
    this._on(ta, 'compositionstart', () => this._compStart());
    this._on(ta, 'compositionend', (e) => this._compEnd(e));
    this._on(ta, 'copy', (e) => this._copy(e, false));
    this._on(ta, 'cut', (e) => this._copy(e, true));
    this._on(ta, 'paste', (e) => this._paste(e));
    this._on(ta, 'focus', () => this.o.onFocus(this));
    this._on(ta, 'blur', () => this.o.onBlur(this));
    this._on(this.g, 'pointerdown', (e) => this._down(e));
    this._on(this.g, 'mousedown', (e) => e.preventDefault()); // Fokus nicht verlieren

    this._blink = this.caret.animate
      ? this.caret.animate([{ opacity: 1 }, { opacity: 1, offset: 0.5 }, { opacity: 0, offset: 0.5001 }, { opacity: 0 }], { duration: 1060, iterations: Infinity })
      : null;
    ta.focus({ preventScroll: true });
    this._update();
  }

  stopEditing() {
    if (!this.editing) return;
    this.editing = false;
    (this._offs || []).forEach((f) => f()); this._offs = [];
    this._dragOff && this._dragOff();
    this.ta.remove(); this.ta = null;
    this._blink && this._blink.cancel();
    this.caret.setAttribute('visibility', 'hidden');
    this.gSel.textContent = '';
    this.hit.setAttribute('pointer-events', 'none');
    this.comp = null;
  }

  /** Beendet das Editieren. Das SVG bleibt unverändert stehen (kein Umbau nötig). */
  commit() {
    this.stopEditing();
    return { runs: this.getRuns(), group: this.gText, bbox: this._bbox() };
  }

  destroy() { this.stopEditing(); this.g.remove(); }
  focus() { this.ta && this.ta.focus({ preventScroll: true }); }
  selectAll() { this.anchor = 0; this.head = this.chars.length; this.pend = null; this._update(); }

  /** Formatierung auf Markierung (oder auf nachfolgend getippten Text), z. B. {bold:true}, {fill:'#f00'}, {size:24} */
  format(patch) {
    const [a, b] = this._rng();
    if (a === b) { this.pend = { ...this.pend, ...patch }; this._update(); return; }
    this._snap(false);
    for (let i = a; i < b; i++) this.st[i] = this._style({ ...this.st[i], ...patch });
    this._render(); this._update(); this.o.onChange(this.getRuns());
  }
  toggle(prop) { this.format({ [prop]: !this.getFormat()[prop] }); }
  getFormat() {
    const [a, b] = this._rng();
    if (a === b) return { ...this._ctxStyle(), mixed: {} };
    const f = { ...this.st[a] };
    const mixed = {};
    const keys = ['bold', 'italic', 'underline', 'strike', 'fill', 'size', 'family'];
    for (let i = a + 1; i < b; i++) {
      for (const k of keys) {
        if (this.st[i][k] !== this.st[a][k]) mixed[k] = true;
      }
    }
    for (const k of ['bold', 'italic', 'underline', 'strike']) {
      if (mixed[k]) f[k] = false;
    }
    return { ...f, mixed };
  }
  undoOp() { const s = this.undo.pop(); if (s) { this.redo.push(this._shot()); this._restore(s); } }
  redoOp() { const s = this.redo.pop(); if (s) { this.undo.push(this._shot()); this._restore(s); } }

  /* ───────────── Modell ───────────── */

  _merge(o) { for (const k in o) if (o[k] !== undefined) this.o[k] = o[k]; }
  _setBase() {
    const o = this.o;
    this.base = { bold: false, italic: false, underline: false, strike: false, fill: o.fill, size: o.fontSize, family: o.fontFamily };
  }
  _style(p) {
    const s = { ...this.base };
    for (const k in p) if (p[k] !== undefined && k !== 'key') s[k] = p[k];
    s.bold = !!s.bold; s.italic = !!s.italic; s.underline = !!s.underline; s.strike = !!s.strike;
    const key = [+s.bold, +s.italic, +s.underline, +s.strike, s.fill, s.size, s.family].join('|');
    let r = this._pool.get(key);
    if (!r) { r = Object.freeze({ ...s, key }); this._pool.set(key, r); }
    return r;
  }
  _load(runs) {
    this.chars = []; this.st = [];
    for (const r of runs) {
      const { text = '', ...p } = r, s = this._style(p);
      for (const c of Array.from(String(text).replace(/\r\n?/g, '\n'))) { this.chars.push(c); this.st.push(s); }
    }
    this.anchor = Math.min(this.anchor, this.chars.length);
    this.head = Math.min(this.head, this.chars.length);
  }
  _rng() { return this.anchor < this.head ? [this.anchor, this.head] : [this.head, this.anchor]; }
  _ctxStyle() {
    const [a, b] = this._rng();
    const base = a !== b ? this.st[a] : this.st[a - 1] || this.st[a] || this._style({});
    return this.pend ? this._style({ ...base, ...this.pend }) : base;
  }

  /* ───────────── Layout ───────────── */

  _applyStyle(n, s) {
    n.setAttribute('font-family', s.family); n.setAttribute('font-size', s.size);
    n.setAttribute('font-weight', s.bold ? 'bold' : 'normal'); n.setAttribute('font-style', s.italic ? 'italic' : 'normal');
    n.setAttribute('fill', s.fill);
    n.setAttribute('text-decoration', [s.underline && 'underline', s.strike && 'line-through'].filter(Boolean).join(' ') || 'none');
  }
  _measure(text, s) {
    const k = s.key + '\u0000' + text;
    let w = this._mc.get(k);
    if (w === undefined) {
      this._applyStyle(this.meas, s); this.meas.textContent = text;
      w = this.meas.getComputedTextLength(); this._mc.set(k, w);
    }
    return w;
  }
  _range(a, b) {
    let w = 0, i = a;
    while (i < b) {
      let j = i + 1;
      while (j < b && this.st[j] === this.st[i]) j++;
      w += this._measure(this.chars.slice(i, j).join(''), this.st[i]);
      i = j;
    }
    return w;
  }
  _wrap(s, e, W, push) {
    if (!W || s === e) { push(s, e, true); return; }
    const c = this.chars;
    let ls = s, lw = 0, i = s, hasWord = false;
    while (i < e) {
      let j = i; const sp = isSp(c[i]);
      while (j < e && isSp(c[j]) === sp) j++;
      const w = this._range(i, j);
      if (sp || lw + w <= W) { lw += w; i = j; if (!sp) hasWord = true; } // Leerzeichen hängen am Zeilenende
      else if (hasWord) { push(ls, i, false); ls = i; lw = 0; hasWord = false; }
      else { // Wort länger als die Zeile: zeichenweise trennen
        let k = i, cw = lw;
        while (k < j) { const cc = this._range(k, k + 1); if (cw + cc > W && k > i) break; cw += cc; k++; }
        push(ls, k, false); ls = k; lw = 0; i = k; hasWord = false;
      }
    }
    push(ls, e, true);
  }
  _layout() {
    const { chars, st, o } = this, n = chars.length, lines = [];
    let y = o.y;
    const push = (s, e, hard) => {
      let size = 0;
      for (let k = s; k < e; k++) size = Math.max(size, st[k].size);
      if (!size) size = (st[s] || st[s - 1] || this.base).size;
      const h = size * o.lineHeight;
      lines.push({ s, e, hard, y, h, size, base: y + h / 2 + size * 0.32 });
      y += h;
    };
    let ps = 0;
    for (let p = 0; p <= n; p++) if (p === n || chars[p] === '\n') { this._wrap(ps, p, o.width, push); ps = p + 1; }
    this.lines = lines; this.height = y - o.y;
  }
  _render() {
    this._layout();
    const { o } = this, W = o.width;
    const anchor = o.align === 'center' ? 'middle' : o.align === 'right' ? 'end' : 'start';
    const ax = W ? o.x + (o.align === 'center' ? W / 2 : o.align === 'right' ? W : 0) : o.x;
    this.gText.textContent = '';
    for (const l of this.lines) {
      const t = mk('text', { x: ax, y: l.base, 'text-anchor': anchor }, this.gText);
      t.setAttributeNS(XML, 'xml:space', 'preserve');
      Object.assign(l, { node: t, ax, xs: null, offs: [] });
      let off = 0, i = l.s;
      while (i < l.e) {
        let j = i + 1;
        while (j < l.e && this.st[j] === this.st[i]) j++;
        let str = '';
        for (let k = i; k < j; k++) { l.offs.push(off); off += this.chars[k].length; str += this.chars[k]; }
        const ts = mk('tspan', {}, t); this._applyStyle(ts, this.st[i]); ts.textContent = str;
        i = j;
      }
      // Manche Engines zählen Code Points statt UTF-16-Einheiten
      if (t.getNumberOfChars() !== off) l.offs = l.offs.map((_, k) => k);
    }
    const bb = this._bbox();
    this.hit.setAttribute('x', W ? o.x : bb.x - 4);
    this.hit.setAttribute('y', o.y);
    this.hit.setAttribute('width', Math.max(W || bb.width + 8, 8));
    this.hit.setAttribute('height', Math.max(this.height, 1));
  }
  _bbox() { try { return this.gText.getBBox(); } catch (e) { return { x: this.o.x, y: this.o.y, width: 0, height: this.height }; } }

  /** x-Positionen aller Zeichengrenzen einer Zeile, direkt aus der Render-Engine */
  _xs(l) {
    if (l.xs) return l.xs;
    const n = l.e - l.s, xs = [];
    if (!n) xs.push(l.ax);
    else {
      for (let k = 0; k < n; k++) xs.push(l.node.getExtentOfChar(l.offs[k]).x);
      const last = l.node.getExtentOfChar(l.offs[n - 1]);
      xs.push(last.x + last.width);
    }
    return (l.xs = xs);
  }
  _lineAt(idx) {
    const L = this.lines;
    for (let k = 0; k < L.length; k++) {
      const l = L[k];
      if (idx < l.e || (idx === l.e && (l.hard || this.affEnd || k === L.length - 1))) return k;
    }
    return L.length - 1;
  }
  _caret(idx) {
    const l = this.lines[this._lineAt(idx)];
    return { x: this._xs(l)[idx - l.s], y: l.y, h: l.h, l };
  }
  _idxAt(l, x) {
    const xs = this._xs(l);
    let best = 0, d = Infinity;
    for (let k = 0; k < xs.length; k++) { const dd = Math.abs(xs[k] - x); if (dd < d) { d = dd; best = k; } }
    return l.s + best;
  }
  _hit(e) {
    const m = this.g.getScreenCTM();
    if (!m) return { i: this.head, aff: false };
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    const L = this.lines;
    let li = L.findIndex((l) => p.y < l.y + l.h);
    if (li < 0) li = L.length - 1;
    const i = this._idxAt(L[li], p.x);
    return { i, aff: i === L[li].e && !L[li].hard };
  }

  /* ───────────── Cursor, Markierung, Anzeige ───────────── */

  _update() {
    if (!this.editing) return;
    const [a, b] = this._rng();
    this.gSel.textContent = '';
    if (a !== b) {
      for (const l of this.lines) {
        const s = Math.max(a, l.s), e = Math.min(b, l.e);
        const nl = l.hard && a <= l.e && b > l.e && l.e < this.chars.length; // Zeilenumbruch mitmarkiert
        if (s > e || (s === e && !nl)) continue;
        const xs = this._xs(l), x1 = xs[s - l.s], x2 = xs[e - l.s] + (nl ? l.size * 0.3 : 0);
        mk('rect', { x: Math.min(x1, x2), y: l.y, width: Math.abs(x2 - x1), height: l.h, fill: this.o.selectionColor }, this.gSel);
      }
    }
    const c = this._caret(this.head);
    this.caret.setAttribute('x1', c.x); this.caret.setAttribute('x2', c.x);
    this.caret.setAttribute('y1', c.y); this.caret.setAttribute('y2', c.y + c.h);
    this.caret.setAttribute('visibility', a === b ? 'visible' : 'hidden');
    if (this._blink) this._blink.currentTime = 0;
    const m = this.g.getScreenCTM();
    if (m && this.ta) { // Textarea an den Cursor (wichtig für IME-Fenster)
      const p = new DOMPoint(c.x, c.y + c.h).matrixTransform(m);
      this.ta.style.left = p.x + 'px'; this.ta.style.top = p.y + 'px';
    }
    this.o.onSelection({ start: a, end: b, format: this.getFormat() });
  }
  _moveTo(idx, o = {}) {
    this.affEnd = !!o.affEnd;
    this.head = idx;
    if (!o.extend) this.anchor = idx;
    if (!o.keepGoal) this.goalX = null;
    this.pend = null;
    this._update();
  }
  _vert(dir, extend) {
    const L = this.lines, li = this._lineAt(this.head);
    if (this.goalX == null) this.goalX = this._caret(this.head).x;
    const t = li + dir;
    if (t < 0) return this._moveTo(0, { extend, keepGoal: true });
    if (t >= L.length) return this._moveTo(this.chars.length, { extend, keepGoal: true });
    const idx = this._idxAt(L[t], this.goalX);
    this._moveTo(idx, { extend, keepGoal: true, affEnd: idx === L[t].e && !L[t].hard });
  }
  _wordL(i) {
    const c = this.chars;
    if (i > 0 && c[i - 1] === '\n') return i - 1;
    while (i > 0 && isSp(c[i - 1])) i--;
    while (i > 0 && isWord(c[i - 1])) i--;
    return i;
  }
  _wordR(i) {
    const c = this.chars, n = c.length;
    if (i < n && c[i] === '\n') return i + 1;
    while (i < n && isWord(c[i])) i++;
    while (i < n && isSp(c[i])) i++;
    return i;
  }

  /* ───────────── Editieren ───────────── */

  _splice(a, b, cs, ss) {
    this.chars.splice(a, b - a, ...cs); this.st.splice(a, b - a, ...ss);
    this.anchor = this.head = a + cs.length;
    this.affEnd = false; this.pend = null; this.goalX = null;
    this._render(); this._update(); this.o.onChange(this.getRuns());
  }
  _replace(a, b, cs, ss, merge) { this._snap(merge); this._splice(a, b, cs, ss); }
  _insertText(str, merge = true) {
    str = str.replace(/\r\n?/g, '\n');
    if (!str) return;
    const [a, b] = this._rng(), s = this._ctxStyle(), cs = Array.from(str);
    this._replace(a, b, cs, cs.map(() => s), merge);
  }
  _insertRuns(runs) {
    const cs = [], ss = [];
    for (const r of runs) {
      const { text = '', ...p } = r, s = this._style(p);
      for (const c of Array.from(text)) { cs.push(c); ss.push(s); }
    }
    const [a, b] = this._rng();
    this._replace(a, b, cs, ss, false);
  }
  _del(dir, word) {
    let [a, b] = this._rng();
    const n = this.chars.length;
    if (a === b) {
      if (dir < 0) { if (!a) return; a = word ? this._wordL(a) : a - 1; }
      else { if (b >= n) return; b = word ? this._wordR(b) : b + 1; }
    }
    this._replace(a, b, [], [], b - a === 1);
  }
  _shot() { return { chars: this.chars.slice(), st: this.st.slice(), a: this.anchor, f: this.head }; }
  _snap(merge) {
    const now = Date.now();
    if (merge && this._lastMerge && now - this._lastMerge < 700) { this._lastMerge = now; return; }
    this.undo.push(this._shot());
    if (this.undo.length > 200) this.undo.shift();
    this.redo = []; this._lastMerge = merge ? now : 0;
  }
  _restore(s) {
    this.chars = s.chars.slice(); this.st = s.st.slice(); this.anchor = s.a; this.head = s.f;
    this.pend = null; this._lastMerge = 0;
    this._render(); this._update(); this.o.onChange(this.getRuns());
  }
  _selectWord(i) {
    const c = this.chars, ref = i < c.length ? i : i - 1;
    if (ref < 0) return;
    const cls = (k) => (c[k] === '\n' ? 2 : isSp(c[k]) ? 1 : 0), t = cls(ref);
    let a = ref, b = ref + 1;
    if (t !== 2) { while (a > 0 && cls(a - 1) === t) a--; while (b < c.length && cls(b) === t) b++; }
    this.anchor = a; this.head = b; this.pend = null; this._update();
  }
  _selectPara(i) {
    const c = this.chars;
    let a = i, b = i;
    while (a > 0 && c[a - 1] !== '\n') a--;
    while (b < c.length && c[b] !== '\n') b++;
    this.anchor = a; this.head = b; this.pend = null; this._update();
  }

  /* ───────────── Eingabe-Events (verstecktes <textarea>) ───────────── */

  _key(e) {
    if (e.isComposing || e.keyCode === 229) return;
    const k = e.key, sh = e.shiftKey, word = e.ctrlKey || e.altKey, doc = e.ctrlKey || e.metaKey;
    const f = this.head, n = this.chars.length, [a, b] = this._rng(), col = a === b;
    const L = this.lines[this._lineAt(f)];
    let used = true;
    if (k === 'ArrowLeft') this._moveTo(!sh && !col ? a : word ? this._wordL(f) : Math.max(0, f - 1), { extend: sh });
    else if (k === 'ArrowRight') this._moveTo(!sh && !col ? b : word ? this._wordR(f) : Math.min(n, f + 1), { extend: sh });
    else if (k === 'ArrowUp') this._vert(-1, sh);
    else if (k === 'ArrowDown') this._vert(1, sh);
    else if (k === 'Home') this._moveTo(doc ? 0 : L.s, { extend: sh });
    else if (k === 'End') this._moveTo(doc ? n : L.e, { extend: sh, affEnd: !doc && !L.hard });
    else if (k === 'Backspace') this._del(-1, word);
    else if (k === 'Delete') this._del(1, word);
    else if (k === 'Enter') this._insertText('\n', false);
    else if (k === 'Escape') this.o.onEscape && this.o.onEscape(this);
    else if (doc && !e.altKey) {
      const kk = k.toLowerCase();
      if (kk === 'a') this.selectAll();
      else if (kk === 'b') this.toggle('bold');
      else if (kk === 'i') this.toggle('italic');
      else if (kk === 'u') this.toggle('underline');
      else if (kk === 'z') (sh ? this.redoOp() : this.undoOp());
      else if (kk === 'y') this.redoOp();
      else {
        used = false;
        if ((kk === 'c' || kk === 'x') && !col) { // Auswahl ins Textarea, damit das Copy-Event sicher feuert
          this.ta.value = this.chars.slice(a, b).join(''); this.ta.select();
          setTimeout(() => { if (this.ta) this.ta.value = ''; }, 0);
        }
      }
    } else used = false;
    if (used) e.preventDefault();
  }
  _beforeInput(e) { // Mobile Tastaturen schicken Backspace/Enter nur hierüber
    if (this.comp) return;
    const t = e.inputType;
    if (t === 'deleteContentBackward') { e.preventDefault(); this._del(-1, false); }
    else if (t === 'deleteContentForward') { e.preventDefault(); this._del(1, false); }
    else if (t === 'insertLineBreak' || t === 'insertParagraph') { e.preventDefault(); this._insertText('\n', false); }
  }
  _input() {
    if (this.comp) { this._compUpdate(this.ta.value); return; }
    const v = this.ta.value; this.ta.value = '';
    if (v) this._insertText(v);
  }
  _compStart() {
    const [a, b] = this._rng(), style = this._ctxStyle();
    this._snap(false);
    if (a !== b) this._splice(a, b, [], []);
    this.comp = { start: a, len: 0, style };
  }
  _compUpdate(v) {
    const c = this.comp, cs = Array.from(v);
    this._splice(c.start, c.start + c.len, cs, cs.map(() => c.style));
    c.len = cs.length;
  }
  _compEnd(e) {
    if (this.comp) { this._compUpdate(this.ta.value || e.data || ''); this.comp = null; }
    this.ta.value = '';
  }
  _copy(e, cut) {
    const [a, b] = this._rng();
    if (a === b) return;
    e.preventDefault();
    e.clipboardData.setData('text/plain', this.chars.slice(a, b).join(''));
    e.clipboardData.setData(MIME, JSON.stringify(this.getRuns(a, b)));
    this.ta.value = '';
    if (cut) this._replace(a, b, [], [], false);
  }
  _paste(e) {
    e.preventDefault();
    const rich = e.clipboardData.getData(MIME);
    if (rich) { try { this._insertRuns(JSON.parse(rich)); return; } catch (err) { /* Fallback: Plaintext */ } }
    this._insertText(e.clipboardData.getData('text/plain'), false);
  }
  _down(e) {
    if (e.button !== 0) return;
    e.preventDefault();
    this.ta.focus({ preventScroll: true });
    const now = performance.now();
    this.clicks = now - (this._ct || 0) < 400 ? (this.clicks || 1) + 1 : 1;
    this._ct = now;
    const h = this._hit(e);
    if (this.clicks === 2) return this._selectWord(h.i);
    if (this.clicks >= 3) return this._selectPara(h.i);
    this._moveTo(h.i, { extend: e.shiftKey, affEnd: h.aff });
    this._dragOff && this._dragOff();
    const mv = (ev) => {
      if (ev.buttons === 0) return up(); // Maustaste wurde unbemerkt losgelassen
      const p = this._hit(ev); this._moveTo(p.i, { extend: true, affEnd: p.aff });
    };
    const up = () => this._dragOff && this._dragOff();
    this._dragOff = () => {
      window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up); window.removeEventListener('blur', up);
      this._dragOff = null;
    };
    window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up); window.addEventListener('blur', up);
  }
}

export default SvgTextEditor;