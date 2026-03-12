/* ═══════════════════════════════════════════════
   Data flow background — smooth flowing lines
   with glowing particles, binary rain
   ═══════════════════════════════════════════════ */
(() => {
  const canvas = document.getElementById("bg-canvas");
  const ctx = canvas.getContext("2d");
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  let W, H;

  function resize() {
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    initLines();
  }

  /* ─── Colors ─── */
  const ACCENT_RGB = "212,148,60";
  const DIM_RGB = "110,110,136";

  /* ─── Flow lines ─── */
  const LINE_COUNT = 24;
  let lines = [];

  function initLines() {
    lines = [];
    for (let i = 0; i < LINE_COUNT; i++) {
      const t = i / (LINE_COUNT - 1);
      const fromEdge = Math.abs(t - 0.5) * 2;

      lines.push({
        baseY: H * (0.15 + t * 0.7),
        a1: 20 + fromEdge * 40,
        f1: 0.002 + (i % 5) * 0.0004,
        p1: i * 0.9,
        a2: 8 + fromEdge * 15,
        f2: 0.005 + (i % 3) * 0.0003,
        p2: i * 2.1 + 1,
        alpha: 0.08 + (1 - fromEdge) * 0.12,
        width: 0.6 + (1 - fromEdge) * 0.6,
        px: Math.random(),
        speed: 0.15 + Math.random() * 0.25,
        hasParticle: Math.random() < 0.6,
        glowSize: 10 + Math.random() * 10,
      });
    }
  }

  const FUNNEL_CENTER_Y = 0.5;
  const FUNNEL_STRENGTH = 0.88;
  const FUNNEL_WIDTH = 0.16;

  function lineY(line, x, time) {
    const naturalY = line.baseY
      + Math.sin(x * line.f1 + time * 0.3 + line.p1) * line.a1
      + Math.sin(x * line.f2 - time * 0.15 + line.p2) * line.a2;

    const dx = (x / W) - 0.5;
    const pull = Math.exp(-(dx * dx) / (2 * FUNNEL_WIDTH * FUNNEL_WIDTH));
    const centerY = H * FUNNEL_CENTER_Y;

    return naturalY + (centerY - naturalY) * pull * FUNNEL_STRENGTH;
  }

  function drawParticle(line, time) {
    line.px += line.speed / W;
    if (line.px > 1.05) line.px = -0.05;

    const px = line.px * W;
    const py = lineY(line, px, time);

    if (px < -20 || px > W + 20) return;

    // glow halo
    const g = ctx.createRadialGradient(px, py, 0, px, py, line.glowSize);
    g.addColorStop(0, `rgba(${ACCENT_RGB},0.5)`);
    g.addColorStop(0.4, `rgba(${ACCENT_RGB},0.1)`);
    g.addColorStop(1, `rgba(${ACCENT_RGB},0)`);
    ctx.beginPath();
    ctx.arc(px, py, line.glowSize, 0, Math.PI * 2);
    ctx.fillStyle = g;
    ctx.fill();

    // bright core
    ctx.beginPath();
    ctx.arc(px, py, 1.8, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,200,120,0.9)";
    ctx.fill();

    // fading trail
    const trailLen = 60;
    const trailGrad = ctx.createLinearGradient(px - trailLen, py, px, py);
    trailGrad.addColorStop(0, `rgba(${ACCENT_RGB},0)`);
    trailGrad.addColorStop(1, `rgba(${ACCENT_RGB},0.25)`);
    ctx.beginPath();
    ctx.moveTo(px, py);
    for (let tx = px; tx > px - trailLen && tx > 0; tx -= 8) {
      ctx.lineTo(tx, lineY(line, tx, time));
    }
    ctx.strokeStyle = trailGrad;
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }

  function drawLines(time) {
    for (const line of lines) {
      ctx.beginPath();
      ctx.moveTo(0, lineY(line, 0, time));

      for (let x = 0; x < W; x += 16) {
        const x2 = Math.min(x + 16, W);
        const y1 = lineY(line, x, time);
        const y2 = lineY(line, x2, time);
        ctx.quadraticCurveTo(x, y1, (x + x2) / 2, (y1 + y2) / 2);
      }
      ctx.lineTo(W, lineY(line, W, time));

      ctx.strokeStyle = `rgba(${ACCENT_RGB},${line.alpha})`;
      ctx.lineWidth = line.width;
      ctx.stroke();

      if (line.hasParticle) drawParticle(line, time);
    }
  }

  /* ─── Binary digits floating ─── */
  const DIGIT_COUNT = 80;
  let digits = [];

  function initDigits() {
    digits = [];
    for (let i = 0; i < DIGIT_COUNT; i++) {
      digits.push({
        x: Math.random() * W,
        y: Math.random() * H,
        char: Math.random() < 0.5 ? "0" : "1",
        vy: 0.1 + Math.random() * 0.3,
        alpha: 0.03 + Math.random() * 0.06,
        size: 10 + Math.random() * 3,
        blink: Math.random() * Math.PI * 2,
      });
    }
  }

  function drawDigits(time) {
    for (const d of digits) {
      d.y += d.vy;
      if (d.y > H + 20) {
        d.y = -15;
        d.x = Math.random() * W;
      }

      const flicker = Math.sin(time * 1.5 + d.blink) * 0.5 + 0.5;
      ctx.font = `${d.size}px monospace`;
      ctx.fillStyle = `rgba(${DIM_RGB},${d.alpha * flicker})`;
      ctx.fillText(d.char, d.x, d.y);
    }
  }

  /* ─── Dot grid (subtle) ─── */
  function drawGrid(time) {
    const sp = 65;
    for (let x = sp / 2; x < W; x += sp) {
      for (let y = sp / 2; y < H; y += sp) {
        const wave = Math.sin(time * 0.4 + x * 0.006 + y * 0.004) * 0.4 + 0.6;
        ctx.beginPath();
        ctx.arc(x, y, 0.7, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${DIM_RGB},${0.04 * wave})`;
        ctx.fill();
      }
    }
  }

  /* ─── Animation loop ─── */
  let startTime = 0;

  function animate(ts) {
    if (!startTime) startTime = ts;
    const time = (ts - startTime) / 1000;

    ctx.clearRect(0, 0, W, H);
    drawGrid(time);
    drawDigits(time);
    drawLines(time);
    requestAnimationFrame(animate);
  }

  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      resize();
      initDigits();
    }, 150);
  });

  resize();
  initDigits();
  requestAnimationFrame(animate);
})();

/* ═══════════════════════════════════════════════
   Scroll-triggered reveal
   ═══════════════════════════════════════════════ */
(() => {
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          observer.unobserve(entry.target);
        }
      }
    },
    { threshold: 0.15 }
  );

  document.querySelectorAll(".feature-card, .flow-step").forEach((el, i) => {
    el.style.transition = `opacity 0.5s ease ${i * 0.07}s, transform 0.5s ease ${i * 0.07}s`;
    observer.observe(el);
  });
})();
