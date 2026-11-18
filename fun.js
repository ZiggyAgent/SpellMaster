// SpellMaster "juice": synthesized sound effects (Web Audio — no asset files)
// and a tiny canvas confetti. Exposes window.SFX and window.confetti.
// Everything is best-effort and wrapped so a missing/blocked AudioContext can
// never break gameplay.

(function () {
  const AC = window.AudioContext || window.webkitAudioContext;
  let ctx = null;
  let enabled = (localStorage.getItem("spellmaster_sound") || "on") !== "off";

  function ac() {
    try {
      if (!ctx && AC) ctx = new AC();
      if (ctx && ctx.state === "suspended") ctx.resume().catch(() => {});
    } catch { /* ignore */ }
    return ctx;
  }

  // One note. start/dur in seconds (start is an offset from "now").
  function tone(freq, start, dur, type, gain) {
    const c = ac();
    if (!c) return;
    try {
      const o = c.createOscillator(), g = c.createGain();
      o.type = type || "sine";
      o.frequency.value = freq;
      const t0 = c.currentTime + start;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(gain || 0.15, t0 + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g).connect(c.destination);
      o.start(t0);
      o.stop(t0 + dur + 0.03);
    } catch { /* ignore */ }
  }

  const SFX = {
    isOn: () => enabled,
    toggle() {
      enabled = !enabled;
      try { localStorage.setItem("spellmaster_sound", enabled ? "on" : "off"); } catch {}
      if (enabled) tone(880, 0, 0.1, "triangle", 0.12); // confirmation blip
      return enabled;
    },
    correct() {
      if (!enabled) return;
      tone(660, 0, 0.12, "triangle", 0.16);
      tone(990, 0.08, 0.14, "triangle", 0.14);
    },
    wrong() {
      if (!enabled) return;
      tone(220, 0, 0.18, "sine", 0.12);
      tone(165, 0.1, 0.22, "sine", 0.1);
    },
    streak(n) {
      if (!enabled) return;
      const bump = 1 + Math.min(n, 12) * 0.03; // rises as the streak grows
      [0, 1, 2].forEach((i) => tone([880, 1175, 1568][i] * bump, i * 0.06, 0.12, "triangle", 0.13));
    },
    complete() {
      if (!enabled) return;
      [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.1, 0.16, "triangle", 0.14));
    },
    fanfare() {
      if (!enabled) return;
      [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, i * 0.09, 0.22, "triangle", 0.16));
      tone(1047, 0.5, 0.4, "triangle", 0.14);
      tone(1568, 0.5, 0.4, "triangle", 0.12);
    },
  };

  function confetti(opts) {
    opts = opts || {};
    const n = opts.count || 130;
    let canvas = document.getElementById("confetti-canvas");
    if (!canvas) {
      canvas = document.createElement("canvas");
      canvas.id = "confetti-canvas";
      Object.assign(canvas.style, {
        position: "fixed", inset: "0", width: "100%", height: "100%",
        pointerEvents: "none", zIndex: "9999",
      });
      document.body.appendChild(canvas);
    }
    const c2 = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    c2.setTransform(dpr, 0, 0, dpr, 0, 0);
    const W = window.innerWidth, H = window.innerHeight;
    const colors = ["#4f46e5", "#f59e0b", "#10b981", "#ef4444", "#ec4899", "#8b5cf6", "#fbbf24"];
    const parts = [];
    for (let i = 0; i < n; i++) {
      parts.push({
        x: W / 2 + (Math.random() - 0.5) * 140, y: H / 3,
        vx: (Math.random() - 0.5) * 9, vy: Math.random() * -11 - 4,
        g: 0.28 + Math.random() * 0.22, size: 6 + Math.random() * 7,
        color: colors[i % colors.length], rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4, life: 0,
      });
    }
    let last = performance.now();
    function frame(t) {
      const dt = Math.min(34, t - last) / 16; last = t;
      c2.clearRect(0, 0, W, H);
      let alive = 0;
      for (const p of parts) {
        p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt; p.life += dt;
        if (p.y < H + 24 && p.life < 170) {
          alive++;
          c2.save();
          c2.translate(p.x, p.y);
          c2.rotate(p.rot);
          c2.globalAlpha = Math.max(0, 1 - p.life / 170);
          c2.fillStyle = p.color;
          c2.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
          c2.restore();
        }
      }
      if (alive > 0) requestAnimationFrame(frame);
      else canvas.remove();
    }
    requestAnimationFrame(frame);
  }

  window.SFX = SFX;
  window.confetti = confetti;
})();
