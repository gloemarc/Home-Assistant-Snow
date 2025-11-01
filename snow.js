// /local/snow.js – Fallender Schnee (ohne liegenbleiben) + Switch
(() => {
  const ENTITY_ID = 'input_boolean.schneefall'; // ggf. anpassen
  const DENSITY = 3.0; // 0.6 = leicht, 1.0 = normal, usw.

  let running = false, raf = 0, c, ctx, w = 0, h = 0, DPR = 1, resizeFn;
  let flakes = [];

  function setupCanvas() {
    if (!c) {
      c = document.createElement('canvas');
      c.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:99999';
      document.documentElement.appendChild(c);
      ctx = c.getContext('2d', { alpha: true });
    }
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    w = innerWidth; h = innerHeight;
    c.width = Math.round(w * DPR);
    c.height = Math.round(h * DPR);
    c.style.width = w + 'px';
    c.style.height = h + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }

  function initFlakes() {
    const lowPower = matchMedia('(prefers-reduced-motion: reduce)').matches ||
                     (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2);
    const base = lowPower ? 100 : 180;                 // Grunddichte
    const areaScale = Math.min((w * h) / (1920 * 1080), 2);
    const N = Math.max(40, Math.round(base * areaScale * DENSITY));

    const rand = (a,b)=>a + Math.random()*(b-a);
    flakes = Array.from({ length: N }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      r: rand(1, 2.6),           // Radius
      vy: rand(0.25, 0.9),       // Fallgeschwindigkeit
      vx: rand(-0.35, 0.35),     // leichter Drift
      wobble: rand(0, Math.PI*2),
      wobbleSpeed: rand(0.002, 0.01),
    }));
  }

  function loop() {
    if (!running) return;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(255,255,255,0.9)';

    for (const f of flakes) {
      f.wobble += f.wobbleSpeed;
      const sway = Math.sin(f.wobble) * 0.6;

      f.y += f.vy;
      f.x += f.vx + sway * 0.2;

      // Wrap
      if (f.y > h + 5) { f.y = -5; f.x = Math.random() * w; }
      if (f.x > w) f.x = 0; else if (f.x < 0) f.x = w;

      ctx.beginPath();
      ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
      ctx.fill();
    }
    raf = requestAnimationFrame(loop);
  }

  function start() {
    if (running) return;
    running = true;
    setupCanvas();
    initFlakes();
    resizeFn = () => { setupCanvas(); initFlakes(); };
    addEventListener('resize', resizeFn, { passive: true });
    loop();
  }

  function stop() {
    if (!running) return;
    running = false;
    cancelAnimationFrame(raf);
    removeEventListener('resize', resizeFn);
    c?.remove(); c = null; ctx = null;
    flakes = [];
  }

  // Optional für Konsole
  window.__startSnow = start;
  window.__stopSnow = stop;

  function apply(on) { if (on && !running) start(); if (!on && running) stop(); }

  // ---- HA-Switch überwachen -------------------------------------------------
  const getHass = () => document.querySelector('home-assistant')?.hass;
  async function waitForHass(maxMs=10000){
    const t0 = Date.now();
    while (Date.now() - t0 < maxMs) {
      const h = getHass();
      if (h && h.states) return h;
      await new Promise(r => setTimeout(r, 100));
    }
    return null;
  }

  (async () => {
    const hass = await waitForHass();
    let last = hass?.states?.[ENTITY_ID]?.state === 'on';
    apply(last); // initial

    setInterval(() => {
      const h = getHass();
      const now = h?.states?.[ENTITY_ID]?.state === 'on';
      if (now !== last) { last = now; apply(now); }
    }, 300);
  })();
})();

