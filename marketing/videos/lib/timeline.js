/* Timeline determinista pentru video-urile HTML (fara dependinte).
 *
 * Principiu: TOT ce se misca pe ecran e o functie pura de timp t (ms).
 * Randarea (render.mjs) apeleaza window.__video.seek(t) pentru fiecare cadru,
 * deci nimic nu trebuie sa depinda de setTimeout / rAF / Date.now().
 *
 * Utilizare in pagina:
 *   <script src="../lib/timeline.js"></script>
 *   const tl = new Timeline({ durationMs: 40000 });
 *   tl.add(0, 3000, (p, t) => { ... p = progres 0..1 in [0,3000] ... });
 *   tl.scene('#s1', 0, 6000);              // arata elementul doar in interval (clasa .is-live)
 *   tl.tween('#h1', 200, 900, { y: [40, 0], o: [0, 1] }, ease.outCubic);
 *   tl.tween('#h1', 5000, 5800, { o: [1, 0] });   // se COMPUNE cu tween-ul de mai sus (per proprietate)
 *   tl.type('#spec', 300, 1500, 'Dulap 160 cm', { cursorTail: 0 }); // fara cursor dupa final
 *   tl.install();                          // expune window.__video + preview live in browser
 *
 * Animatiile CSS (@keyframes / transition) sunt si ele derulate la t prin
 * Web Animations API (document.getAnimations) — poti folosi CSS pentru detalii,
 * dar pentru orice depinde de scenariu prefera tl.add/tl.tween.
 */
(function (global) {
  const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
  const lerp = (a, b, p) => a + (b - a) * p;

  const ease = {
    linear: (p) => p,
    inQuad: (p) => p * p,
    outQuad: (p) => 1 - (1 - p) * (1 - p),
    inOutQuad: (p) => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2),
    outCubic: (p) => 1 - Math.pow(1 - p, 3),
    inCubic: (p) => p * p * p,
    inOutCubic: (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2),
    outQuart: (p) => 1 - Math.pow(1 - p, 4),
    inOutQuart: (p) => (p < 0.5 ? 8 * p * p * p * p : 1 - Math.pow(-2 * p + 2, 4) / 2),
    outExpo: (p) => (p === 1 ? 1 : 1 - Math.pow(2, -10 * p)),
    inOutExpo: (p) => (p === 0 ? 0 : p === 1 ? 1 : p < 0.5 ? Math.pow(2, 20 * p - 10) / 2 : (2 - Math.pow(2, -20 * p + 10)) / 2),
    outBack: (p) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2); },
    outElastic: (p) => { const c4 = (2 * Math.PI) / 3; return p === 0 ? 0 : p === 1 ? 1 : Math.pow(2, -10 * p) * Math.sin((p * 10 - 0.75) * c4) + 1; },
    // "spring" moale, fara overshoot mare — bun pentru carduri UI
    outSoft: (p) => 1 - Math.pow(1 - p, 2.5),
  };

  // Interpolare intre doua momente: intoarce progresul 0..1 (eased) in [t0, t1]
  function progress(t, t0, t1, fn) {
    const p = clamp01((t - t0) / Math.max(1, t1 - t0));
    return fn ? fn(p) : p;
  }

  class Timeline {
    constructor({ durationMs, root } = {}) {
      this.durationMs = durationMs || 30000;
      this.root = root || document;
      this.tracks = [];
      this.scenes = [];
      this.readyFns = [];
      this._svgs = null;
    }

    // callback generic: fn(p, t) cu p = progres 0..1 in interval (clamp), apelat la fiecare seek
    add(t0, t1, fn, easing) {
      this.tracks.push({ t0, t1, fn, easing: easing || ease.linear });
      return this;
    }

    // ruleaza fn(t) la fiecare cadru pe toata durata (ex. contoare, cursor)
    always(fn) {
      this.tracks.push({ t0: -Infinity, t1: Infinity, fn: (_, t) => fn(t), easing: null });
      return this;
    }

    // vizibilitate: elementul primeste clasa .is-live in [t0, t1) si atributul data-scene-p (0..1)
    scene(sel, t0, t1) {
      const els = typeof sel === 'string' ? Array.from(this.root.querySelectorAll(sel)) : [sel];
      this.scenes.push({ els, t0, t1 });
      return this;
    }

    // tween de proprietati vizuale: props = { x:[from,to], y, s (scale), r (rotate deg), o (opacity), blur }
    tween(sel, t0, t1, props, easing) {
      const els = typeof sel === 'string' ? Array.from(this.root.querySelectorAll(sel)) : [sel];
      const e = easing || ease.outCubic;
      this.tracks.push({
        t0: -Infinity, t1: Infinity, easing: null,
        fn: (_, t) => {
          const p = progress(t, t0, t1, e);
          for (const el of els) applyProps(el, props, p);
        },
      });
      return this;
    }

    // scriere "la masina": textul apare caracter cu caracter in [t0, t1]
    type(sel, t0, t1, text, { cursor = true, cursorTail = 600 } = {}) {
      const els = typeof sel === 'string' ? Array.from(this.root.querySelectorAll(sel)) : [sel];
      this.tracks.push({
        t0: -Infinity, t1: Infinity, easing: null,
        fn: (_, t) => {
          const p = progress(t, t0, t1);
          const n = Math.round(p * text.length);
          const shown = text.slice(0, n);
          const blink = cursor && t >= t0 && t < t1 + cursorTail && Math.floor(t / 400) % 2 === 0;
          for (const el of els) el.textContent = shown + (blink ? '|' : '');
        },
      });
      return this;
    }

    // contor numeric: de la a la b in [t0, t1], format(n) optional
    count(sel, t0, t1, a, b, format, easing) {
      const els = typeof sel === 'string' ? Array.from(this.root.querySelectorAll(sel)) : [sel];
      const e = easing || ease.outCubic;
      const f = format || ((n) => String(Math.round(n)));
      this.tracks.push({
        t0: -Infinity, t1: Infinity, easing: null,
        fn: (_, t) => { const v = lerp(a, b, progress(t, t0, t1, e)); for (const el of els) el.textContent = f(v); },
      });
      return this;
    }

    // apelat o data inainte de primul cadru (dupa fonturi); poate fi async
    onReady(fn) { this.readyFns.push(fn); return this; }

    async ready() { for (const fn of this.readyFns) await fn(); }

    seek(t) {
      // 1) scene on/off
      for (const s of this.scenes) {
        const live = t >= s.t0 && t < s.t1;
        for (const el of s.els) {
          el.classList.toggle('is-live', live);
          el.style.setProperty('--scene-p', String(clamp01((t - s.t0) / Math.max(1, s.t1 - s.t0))));
          el.style.setProperty('--scene-t', String(Math.max(0, t - s.t0)));
        }
      }
      // 2) tracks
      for (const tr of this.tracks) {
        if (tr.easing === null) { tr.fn(null, t); continue; }
        if (t < tr.t0 - 1 || t > tr.t1 + 1) {
          // in afara intervalului aplicam capetele ca starea sa fie corecta la orice seek
          tr.fn(t < tr.t0 ? 0 : 1, t);
          continue;
        }
        tr.fn(tr.easing(clamp01((t - tr.t0) / Math.max(1, tr.t1 - tr.t0))), t);
      }
      // 3) animatii CSS (WAAPI) derulate determinist la t
      for (const a of document.getAnimations()) {
        try {
          a.pause();
          const tgt = a.effect && a.effect.target;
          const offset = tgt && tgt.dataset && tgt.dataset.animStart ? Number(tgt.dataset.animStart) : 0;
          a.currentTime = Math.max(0, t - offset);
        } catch (_) { /* animatii finite deja terminate */ }
      }
      // 4) SVG SMIL
      if (!this._svgs) this._svgs = Array.from(document.querySelectorAll('svg'));
      for (const svg of this._svgs) {
        if (typeof svg.pauseAnimations === 'function') { try { svg.pauseAnimations(); svg.setCurrentTime(t / 1000); } catch (_) {} }
      }
      this.currentTime = t;
    }

    // expune API-ul pentru render.mjs si porneste un preview live cand pagina e deschisa in browser normal
    install({ preview = true } = {}) {
      const self = this;
      global.__video = {
        durationMs: this.durationMs,
        seek: (t) => self.seek(t),
        ready: () => self.ready(),
        timeline: this,
      };
      this.seek(0);
      const isRenderer = navigator.webdriver === true;
      if (preview && !isRenderer) {
        // preview: ruleaza in bucla, cu scrubber la tasta [spatiu] pauza, [<-]/[->] +-1s, [0] restart
        let t0 = performance.now(), paused = false, offset = 0;
        const loop = () => {
          if (!paused) { const t = (performance.now() - t0 + offset) % self.durationMs; self.seek(t); }
          requestAnimationFrame(loop);
        };
        addEventListener('keydown', (e) => {
          if (e.code === 'Space') { e.preventDefault(); if (paused) { t0 = performance.now(); offset = self.currentTime; } paused = !paused; }
          if (e.code === 'ArrowRight') { offset = self.currentTime + 1000; t0 = performance.now(); if (paused) self.seek(offset); }
          if (e.code === 'ArrowLeft') { offset = Math.max(0, self.currentTime - 1000); t0 = performance.now(); if (paused) self.seek(offset); }
          if (e.key === '0') { offset = 0; t0 = performance.now(); if (paused) self.seek(0); }
        });
        requestAnimationFrame(loop);
      }
      return this;
    }
  }

  // Stare per element: fiecare tween scrie DOAR proprietatile lui, iar transform-ul
  // se recompune din toate proprietatile cunoscute (x, y, s, r). Astfel doua tween-uri
  // pe acelasi element (ex. intrare pe y + iesire pe o) se compun in loc sa se suprascrie.
  const stateMap = new WeakMap();
  function applyProps(el, props, p) {
    let st = stateMap.get(el);
    if (!st) { st = {}; stateMap.set(el, st); }
    for (const k of ['x', 'y', 's', 'r', 'o', 'blur', 'w', 'h', 'clip', 'dash']) {
      if (props[k]) st[k] = lerp(props[k][0], props[k][1], p);
    }
    const parts = [];
    if (st.x !== undefined) parts.push(`translateX(${st.x}px)`);
    if (st.y !== undefined) parts.push(`translateY(${st.y}px)`);
    if (st.s !== undefined) parts.push(`scale(${st.s})`);
    if (st.r !== undefined) parts.push(`rotate(${st.r}deg)`);
    if (parts.length) el.style.transform = parts.join(' ');
    if (st.o !== undefined) el.style.opacity = String(st.o);
    if (st.blur !== undefined) el.style.filter = `blur(${st.blur}px)`;
    if (st.w !== undefined) el.style.width = `${st.w}px`;
    if (st.h !== undefined) el.style.height = `${st.h}px`;
    if (st.clip !== undefined) el.style.clipPath = `inset(0 ${100 - st.clip}% 0 0)`;
    if (st.dash !== undefined) el.style.strokeDashoffset = String(st.dash);
  }

  global.Timeline = Timeline;
  global.ease = ease;
  global.tlUtil = { clamp01, lerp, progress };
})(window);
