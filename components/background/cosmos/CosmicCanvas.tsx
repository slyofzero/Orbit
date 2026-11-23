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
  tilt: number; // Unique 3D orbital inclination angle
  flattening: number; // Elliptical eccentricity ratio (ry / rx)
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
 * - Dedicated exclusively for Cosmic & Celestial animations.
 * - Multi-planar tilted orbits: each planet travels along its own unique 3D inclination angle and eccentricity.
 * - Orbits span the entire screen with ZERO boundary cutoff, looping seamlessly behind foreground UI.
 * - Orbiting planets with stardust bead trails and orbiting moon.
 * - Ambient starry cosmos across the full viewport.
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

    // Multi-tilt planetary orbits: each with its own inclination angle, eccentricity, speed and bead trail
    const planets: Planet[] = [
      {
        orbitRatio: 0.22,
        speed: 0.44,
        size: 5.5,
        colorDark: "#38bdf8", // Sky blue
        colorLight: "#0284c7",
        phase: 0.6,
        tilt: -0.22, // -12.6 deg tilt
        flattening: 0.44,
        trailLength: 10,
      },
      {
        orbitRatio: 0.36,
        speed: 0.28,
        size: 8.5,
        colorDark: "#fbbf24", // Warm amber
        colorLight: "#d97706",
        phase: 2.2,
        tilt: -0.36, // -20.6 deg tilt
        flattening: 0.38,
        moon: true,
        trailLength: 14,
      },
      {
        orbitRatio: 0.52,
        speed: 0.17,
        size: 6.5,
        colorDark: "#2dd4bf", // Teal
        colorLight: "#0f766e",
        phase: 4.1,
        tilt: -0.16, // -9.2 deg tilt (crossing plane)
        flattening: 0.46,
        trailLength: 12,
      },
      {
        orbitRatio: 0.68,
        speed: 0.11,
        size: 7.5,
        colorDark: "#a78bfa", // Lavender
        colorLight: "#7c3aed",
        phase: 5.4,
        tilt: -0.42, // -24.1 deg tilt (steeper inclination)
        flattening: 0.34,
        trailLength: 14,
      },
      {
        orbitRatio: 0.84,
        speed: 0.07,
        size: 6.0,
        colorDark: "#f472b6", // Rose
        colorLight: "#db2777",
        phase: 1.5,
        tilt: -0.28, // -16.0 deg tilt
        flattening: 0.4,
        trailLength: 12,
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

      // 3. Multi-Planar Tilted Orbits and Planets spanning the full screen
      if (showOrbits) {
        for (const p of planets) {
          const rx = scale * p.orbitRatio;
          const ry = rx * p.flattening;

          ctx.save();
          ctx.translate(cx, cy);
          ctx.rotate(p.tilt); // Each orbit rotates at its own distinct 3D inclination angle

          // Dashed orbital track
          ctx.strokeStyle = dark ? "rgba(232, 238, 245, 0.13)" : "rgba(18, 38, 58, 0.09)";
          ctx.setLineDash([4, 8]);
          ctx.lineWidth = 1.1;
          ctx.beginPath();
          ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);

          // Current planet angle along its unique ellipse
          const angle = p.phase + t * p.speed;
          const planetX = rx * Math.cos(angle);
          const planetY = ry * Math.sin(angle);
          const planetColor = dark ? p.colorDark : p.colorLight;

          // Stardust bead trail behind the planet
          for (let k = p.trailLength; k > 0; k--) {
            const trailAngle = angle - k * 0.048;
            const tx = rx * Math.cos(trailAngle);
            const ty = ry * Math.sin(trailAngle);
            const ratio = (p.trailLength - k + 1) / p.trailLength;
            ctx.globalAlpha = 0.08 * ratio;
            ctx.fillStyle = planetColor;
            ctx.beginPath();
            ctx.arc(tx, ty, p.size * (1 - k * 0.05), 0, Math.PI * 2);
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

          // Specular highlight
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
