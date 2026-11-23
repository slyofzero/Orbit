"use client";

import { useEffect, useRef } from "react";
import { cx } from "@/components/utils";
import { useTheme } from "@/lib/global";

interface Planet {
  orbitRatio: number;
  speed: number;
  size: number;
  colorDark: string;
  colorLight: string;
  phase: number;
  moon?: boolean;
  trailLength: number;
}

interface Star {
  x: number;
  y: number;
  r: number;
  phase: number;
  speed: number;
  alpha: number;
}

interface Comet {
  active: boolean;
  x: number;
  y: number;
  length: number;
  angle: number;
  speed: number;
  alpha: number;
}

export interface CosmicCanvasProps {
  className?: string;
  /** Sun center X position as fraction of canvas (0 to 1). Defaults to 0.68 on desktop, 0.5 on mobile. */
  sunX?: number;
  /** Sun center Y position as fraction of canvas (0 to 1). Defaults to 0.5 on desktop, 0.62 on mobile. */
  sunY?: number;
  /** Whether to render orbital tracks and planets. Defaults to true. */
  showOrbits?: boolean;
}

/**
 * Top full-screen background canvas:
 * - Sits above the ambient canvas, dedicated exclusively for Cosmic & Celestial animations.
 * - Renders continuous elliptical orbits spanning the entire screen with ZERO boundary cutoff.
 * - Orbits curve across the full viewport, passing seamlessly behind foreground text.
 * - Orbiting planets with stardust particle trails and orbiting moon.
 * - Twinkling ambient starry cosmos and occasional shooting stars/comets across the universe.
 * - Full light/dark theme adaptation and prefers-reduced-motion support.
 */
export function CosmicCanvas({ className, sunX, sunY, showOrbits = true }: CosmicCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { isDark } = useTheme();
  const isDarkRef = useRef(isDark);
  isDarkRef.current = isDark;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let width = 0;
    let height = 0;
    let animId = 0;

    // Fixed planets with smooth continuous speeds and proportional orbit radii
    const planets: Planet[] = [
      {
        orbitRatio: 0.22,
        speed: 0.42,
        size: 5.5,
        colorDark: "#38bdf8", // Sky blue
        colorLight: "#0284c7",
        phase: 0.8,
        trailLength: 10,
      },
      {
        orbitRatio: 0.36,
        speed: 0.26,
        size: 8.5,
        colorDark: "#fbbf24", // Warm amber
        colorLight: "#d97706",
        phase: 2.4,
        moon: true,
        trailLength: 14,
      },
      {
        orbitRatio: 0.52,
        speed: 0.16,
        size: 6.5,
        colorDark: "#2dd4bf", // Teal
        colorLight: "#0f766e",
        phase: 4.1,
        trailLength: 12,
      },
      {
        orbitRatio: 0.68,
        speed: 0.1,
        size: 7.5,
        colorDark: "#a78bfa", // Lavender
        colorLight: "#7c3aed",
        phase: 5.5,
        trailLength: 14,
      },
    ];

    // Background starlight across the full viewport
    let seed = 23;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const stars: Star[] = Array.from({ length: 130 }, () => ({
      x: rnd(),
      y: rnd(),
      r: 0.6 + rnd() * 1.4,
      phase: rnd() * Math.PI * 2,
      speed: 0.6 + rnd() * 1.4,
      alpha: 0.2 + rnd() * 0.6,
    }));

    // Occasional cosmic comet
    let comet: Comet = { active: false, x: 0, y: 0, length: 0, angle: 0, speed: 0, alpha: 0 };
    let lastCometTime = 0;

    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      if (reducedMotion) {
        draw(0);
      }
    };

    resize();
    window.addEventListener("resize", resize);

    const draw = (ms: number) => {
      const t = ms / 1000;
      ctx.clearRect(0, 0, width, height);

      const dark = isDarkRef.current;
      const isDesktop = width >= 1024;

      // Position center: user override or responsive right-aligned default
      const defaultSunX = isDesktop ? 0.68 : 0.5;
      const defaultSunY = isDesktop ? 0.5 : 0.62;
      const cx = width * (sunX ?? defaultSunX);
      const cy = height * (sunY ?? defaultSunY);
      const scale = Math.min(width, height * 1.3);

      // 1. Ambient Twinkling Stars spanning the whole viewport
      for (const s of stars) {
        const pulse = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(t * s.speed + s.phase));
        ctx.fillStyle = dark ? "#e8eef5" : "#e59b0c";
        ctx.globalAlpha = s.alpha * pulse * (dark ? 0.75 : 0.55);
        ctx.beginPath();
        ctx.arc(s.x * width, s.y * height, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // 2. Wide Atmospheric Starlight Glow around the Sun's position
      const pulse = 1 + 0.04 * Math.sin(t * 1.5);
      const glowR = scale * 0.22 * pulse;

      const glowGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, glowR);
      if (dark) {
        glowGrad.addColorStop(0, "rgba(255, 207, 63, 0.45)");
        glowGrad.addColorStop(0.25, "rgba(249, 115, 22, 0.24)");
        glowGrad.addColorStop(0.55, "rgba(249, 115, 22, 0.10)");
        glowGrad.addColorStop(0.85, "rgba(249, 115, 22, 0.03)");
        glowGrad.addColorStop(1, "rgba(249, 115, 22, 0)");
      } else {
        glowGrad.addColorStop(0, "rgba(255, 207, 63, 0.35)");
        glowGrad.addColorStop(0.25, "rgba(249, 115, 22, 0.18)");
        glowGrad.addColorStop(0.55, "rgba(249, 115, 22, 0.07)");
        glowGrad.addColorStop(0.85, "rgba(249, 115, 22, 0.02)");
        glowGrad.addColorStop(1, "rgba(249, 115, 22, 0)");
      }

      ctx.fillStyle = glowGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, glowR, 0, Math.PI * 2);
      ctx.fill();

      // 3. Tilted Elliptical Orbits and Orbiting Planets spanning the full screen
      if (showOrbits) {
        const tilt = -0.32; // Fixed smooth aesthetic tilt

        for (const p of planets) {
          const rx = scale * p.orbitRatio;
          const ry = rx * 0.42;

          ctx.save();
          ctx.translate(cx, cy);
          ctx.rotate(tilt);

          // Full dashed orbital track spanning across the entire screen
          ctx.strokeStyle = dark ? "rgba(232, 238, 245, 0.14)" : "rgba(18, 38, 58, 0.10)";
          ctx.setLineDash([4, 8]);
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);

          // Current planet angle along ellipse
          const angle = p.phase + t * p.speed;
          const planetX = rx * Math.cos(angle);
          const planetY = ry * Math.sin(angle);
          const planetColor = dark ? p.colorDark : p.colorLight;

          // Fading stardust trail
          for (let k = p.trailLength; k > 0; k--) {
            const trailAngle = angle - k * 0.045;
            const tx = rx * Math.cos(trailAngle);
            const ty = ry * Math.sin(trailAngle);
            ctx.globalAlpha = 0.04 * (p.trailLength - k + 1);
            ctx.fillStyle = planetColor;
            ctx.beginPath();
            ctx.arc(tx, ty, p.size * (1 - k * 0.06), 0, Math.PI * 2);
            ctx.fill();
          }

          // Planet body with soft shadow glow
          ctx.globalAlpha = 1;
          ctx.shadowColor = planetColor;
          ctx.shadowBlur = 12;
          ctx.fillStyle = planetColor;
          ctx.beginPath();
          ctx.arc(planetX, planetY, p.size, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;

          // Subtle specular highlight
          ctx.fillStyle = "#ffffff";
          ctx.globalAlpha = 0.85;
          ctx.beginPath();
          ctx.arc(planetX - p.size * 0.28, planetY - p.size * 0.28, p.size * 0.28, 0, Math.PI * 2);
          ctx.fill();

          // Optional Orbiting Moon
          if (p.moon) {
            const moonAngle = t * 2.4;
            const moonDist = p.size + 9;
            const mx = planetX + moonDist * Math.cos(moonAngle);
            const my = planetY + moonDist * Math.sin(moonAngle) * 0.6;

            ctx.fillStyle = dark ? "#e8eef5" : "#566676";
            ctx.globalAlpha = 0.8;
            ctx.beginPath();
            ctx.arc(mx, my, 2.2, 0, Math.PI * 2);
            ctx.fill();
          }

          ctx.restore();
        }
      }

      // 4. Occasional Shooting Star / Cosmic Comet
      if (!reducedMotion) {
        if (!comet.active && ms - lastCometTime > 7000 && Math.random() < 0.03) {
          comet = {
            active: true,
            x: width * (0.1 + Math.random() * 0.4),
            y: height * (0.05 + Math.random() * 0.2),
            length: 120 + Math.random() * 80,
            angle: Math.PI / 4 + (Math.random() - 0.5) * 0.2,
            speed: 550 + Math.random() * 250,
            alpha: 1,
          };
          lastCometTime = ms;
        }

        if (comet.active) {
          const dx = Math.cos(comet.angle);
          const dy = Math.sin(comet.angle);
          comet.x += dx * (comet.speed / 60);
          comet.y += dy * (comet.speed / 60);
          comet.alpha -= 0.016;

          if (comet.alpha > 0) {
            const grad = ctx.createLinearGradient(
              comet.x,
              comet.y,
              comet.x - dx * comet.length,
              comet.y - dy * comet.length,
            );
            grad.addColorStop(0, dark ? "rgba(255, 255, 255, 0.9)" : "rgba(249, 115, 22, 0.9)");
            grad.addColorStop(1, "rgba(255, 255, 255, 0)");

            ctx.strokeStyle = grad;
            ctx.lineWidth = 1.8;
            ctx.beginPath();
            ctx.moveTo(comet.x, comet.y);
            ctx.lineTo(comet.x - dx * comet.length, comet.y - dy * comet.length);
            ctx.stroke();
          } else {
            comet.active = false;
          }
        }
      }
    };

    const loop = (ms: number) => {
      draw(ms);
      animId = requestAnimationFrame(loop);
    };

    if (!reducedMotion) {
      animId = requestAnimationFrame(loop);
    } else {
      draw(0);
    }

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, [sunX, sunY, showOrbits]);

  return (
    <canvas
      ref={canvasRef}
      data-layer="cosmos"
      aria-hidden="true"
      className={cx("pointer-events-none fixed inset-0 z-0 size-full block", className)}
    />
  );
}
