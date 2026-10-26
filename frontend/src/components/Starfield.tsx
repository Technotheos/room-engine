import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';

/* -------------------------------------------------------------------------- */
/*  Starfield: parallax + constellations + shooting stars + hyperspace warp   */
/* -------------------------------------------------------------------------- */

export interface StarfieldHandle {
  /** Plays the hyperspace jump. Resolves when the jump has peaked. */
  warp: () => Promise<void>;
}

type Star = { x: number; y: number; z: number; r: number; a: number; tw: number; ph: number; c: number };
type Meteor = { x: number; y: number; vx: number; vy: number; life: number; max: number };

const STAR_COLORS = ['255,255,255', '186,230,253', '199,210,254', '254,240,200'];

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export const Starfield = forwardRef<StarfieldHandle>(function Starfield(_, ref) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const warpRef = useRef<{ active: boolean; t: number; resolve: (() => void) | null }>({
    active: false,
    t: 0,
    resolve: null,
  });

  useImperativeHandle(ref, () => ({
    warp: () =>
      new Promise<void>((resolve) => {
        if (prefersReducedMotion()) {
          resolve();
          return;
        }
        warpRef.current = { active: true, t: 0, resolve };
      }),
  }));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reduce = prefersReducedMotion();
    let w = 0;
    let h = 0;
    let raf = 0;
    let last = performance.now();
    let stars: Star[] = [];
    const meteors: Meteor[] = [];
    const mouse = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5, px: -9999, py: -9999 };

    const makeStars = () => {
      const count = Math.min(650, Math.floor((w * h) / 5500));
      stars = Array.from({ length: count }, () => {
        const z = 0.2 + Math.random() * 0.8; // depth: 1 = closest
        const roll = Math.random();
        return {
          x: Math.random(), // normalised, so resizing never breaks layout
          y: Math.random(),
          z,
          r: 0.4 + z * 1.3,
          a: 0.3 + z * 0.7,
          tw: 0.6 + Math.random() * 1.8,
          ph: Math.random() * Math.PI * 2,
          c: roll < 0.6 ? 0 : roll < 0.8 ? 1 : roll < 0.92 ? 2 : 3,
        };
      }).sort((a, b) => a.c - b.c); // group by colour to minimise style changes
    };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const target = Math.min(650, Math.floor((w * h) / 5500));
      if (stars.length === 0 || Math.abs(target - stars.length) > stars.length * 0.3) makeStars();
      if (reduce) draw(performance.now());
    };

    const draw = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      // ease the parallax target
      const ease = Math.min(1, dt * 3);
      mouse.x += (mouse.tx - mouse.x) * ease;
      mouse.y += (mouse.ty - mouse.y) * ease;

      // warp progress
      const wp = warpRef.current;
      let warpK = 0;
      if (wp.active) {
        wp.t += dt;
        warpK = Math.pow(Math.min(1, wp.t / 0.9), 2);
        if (wp.t >= 0.9 && wp.resolve) {
          const done = wp.resolve;
          wp.resolve = null;
          done();
        }
        if (wp.t > 1.6) wp.active = false;
      }

      ctx.globalAlpha = 1;
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, w, h);

      const cx = w / 2;
      const cy = h / 2;
      const offX = mouse.x - 0.5;
      const offY = mouse.y - 0.5;
      const near: { x: number; y: number }[] = [];
      let curColor = -1;

      for (const s of stars) {
        s.ph += s.tw * dt;
        const twinkle = reduce ? 1 : 0.65 + 0.35 * Math.sin(s.ph);
        const x = s.x * w - offX * s.z * 50; // nearer stars shift more
        const y = s.y * h - offY * s.z * 50;

        if (curColor !== s.c) {
          const col = `rgb(${STAR_COLORS[s.c]})`;
          ctx.fillStyle = col;
          ctx.strokeStyle = col;
          curColor = s.c;
        }

        if (warpK > 0.02) {
          const dx = x - cx;
          const dy = y - cy;
          ctx.globalAlpha = Math.min(1, s.a * twinkle + warpK);
          ctx.lineWidth = Math.max(0.6, s.r);
          ctx.beginPath();
          ctx.moveTo(x + dx * warpK * s.z * 0.2, y + dy * warpK * s.z * 0.2);
          ctx.lineTo(x + dx * warpK * s.z * 1.2, y + dy * warpK * s.z * 1.2);
          ctx.stroke();
        } else {
          ctx.globalAlpha = s.a * twinkle;
          ctx.beginPath();
          ctx.arc(x, y, s.r, 0, Math.PI * 2);
          ctx.fill();

          if (!reduce) {
            const mx = x - mouse.px;
            const my = y - mouse.py;
            if (mx * mx + my * my < 140 * 140 && near.length < 40) near.push({ x, y });
          }
        }
      }

      // constellation lines between stars near the cursor
      if (near.length > 1) {
        ctx.strokeStyle = 'rgb(125,211,252)';
        ctx.lineWidth = 0.6;
        for (let i = 0; i < near.length; i++) {
          for (let j = i + 1; j < near.length; j++) {
            const dx = near[i].x - near[j].x;
            const dy = near[i].y - near[j].y;
            const d = Math.sqrt(dx * dx + dy * dy);
            if (d < 90) {
              ctx.globalAlpha = (1 - d / 90) * 0.35;
              ctx.beginPath();
              ctx.moveTo(near[i].x, near[i].y);
              ctx.lineTo(near[j].x, near[j].y);
              ctx.stroke();
            }
          }
        }
      }

      // shooting stars
      if (!reduce && !wp.active && Math.random() < dt * 0.15) {
        meteors.push({
          x: w * 0.1 + Math.random() * w * 0.7,
          y: Math.random() * h * 0.4,
          vx: 500 + Math.random() * 300,
          vy: 250 + Math.random() * 150,
          life: 0,
          max: 0.9,
        });
      }
      for (let i = meteors.length - 1; i >= 0; i--) {
        const m = meteors[i];
        m.life += dt;
        m.x += m.vx * dt;
        m.y += m.vy * dt;
        if (m.life >= m.max) {
          meteors.splice(i, 1);
          continue;
        }
        const k = 1 - m.life / m.max;
        const sp = Math.hypot(m.vx, m.vy);
        const tx = m.x - (m.vx / sp) * 140;
        const ty = m.y - (m.vy / sp) * 140;
        const g = ctx.createLinearGradient(tx, ty, m.x, m.y);
        g.addColorStop(0, 'rgba(186,230,253,0)');
        g.addColorStop(1, `rgba(255,255,255,${k})`);
        ctx.globalAlpha = 1;
        ctx.strokeStyle = g;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(tx, ty);
        ctx.lineTo(m.x, m.y);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    };

    const onPointerMove = (e: PointerEvent) => {
      mouse.tx = e.clientX / w;
      mouse.ty = e.clientY / h;
      mouse.px = e.clientX;
      mouse.py = e.clientY;
    };
    const onLeave = () => {
      mouse.px = -9999;
      mouse.py = -9999;
    };
    const frame = (now: number) => {
      draw(now);
      raf = requestAnimationFrame(frame);
    };

    resize();
    window.addEventListener('resize', resize);
    if (!reduce) {
      window.addEventListener('pointermove', onPointerMove);
      document.addEventListener('mouseleave', onLeave);
      raf = requestAnimationFrame(frame);
    }

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('mouseleave', onLeave);
    };
  }, []);

  return <canvas ref={canvasRef} aria-hidden="true" className="fixed inset-0 pointer-events-none z-0" />;
});