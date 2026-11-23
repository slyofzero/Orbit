"use client";

import { useRef, useMemo, useEffect, Suspense } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import gsap from "gsap";
import { useTheme } from "@/lib/global";

// ── Types & Configuration ──────────────────────────────────────────────────

interface PlanetDef {
  name: string;
  semiMajor: number; // a (spread wide across screen)
  flattening: number; // b / a (elliptical ratio)
  speed: number;
  radius: number;
  colorDark: string;
  colorLight: string;
  emissiveDark: string;
  emissiveLight: string;
  phase: number;
  tiltZ: number; // 2D planar tilt angle matching previous canvas
  tiltX: number; // 3D depth inclination
  hasMoon?: boolean;
  trailBeads: number;
}

// 5 planetary orbits spread out to span across the screen, sleekly angled
const PLANETS: PlanetDef[] = [
  {
    name: "Mercury",
    semiMajor: 3.8,
    flattening: 0.34,
    speed: 0.42,
    radius: 0.15,
    colorDark: "#38bdf8", // Sky blue
    colorLight: "#0284c7",
    emissiveDark: "#0284c7",
    emissiveLight: "#38bdf8",
    phase: 0.6,
    tiltZ: -0.22, // -12.6 deg
    tiltX: 0.05,
    trailBeads: 10,
  },
  {
    name: "Venus",
    semiMajor: 6.8,
    flattening: 0.28,
    speed: 0.27,
    radius: 0.24,
    colorDark: "#fbbf24", // Warm amber
    colorLight: "#d97706",
    emissiveDark: "#d97706",
    emissiveLight: "#fbbf24",
    phase: 2.2,
    tiltZ: -0.36, // -20.6 deg
    tiltX: -0.04,
    hasMoon: true,
    trailBeads: 14,
  },
  {
    name: "Earth",
    semiMajor: 10.6,
    flattening: 0.32,
    speed: 0.16,
    radius: 0.19,
    colorDark: "#2dd4bf", // Teal
    colorLight: "#0f766e",
    emissiveDark: "#0f766e",
    emissiveLight: "#2dd4bf",
    phase: 4.1,
    tiltZ: -0.16, // -9.2 deg
    tiltX: 0.06,
    trailBeads: 12,
  },
  {
    name: "Mars",
    semiMajor: 15.2,
    flattening: 0.26,
    speed: 0.1,
    radius: 0.22,
    colorDark: "#a78bfa", // Lavender
    colorLight: "#7c3aed",
    emissiveDark: "#7c3aed",
    emissiveLight: "#a78bfa",
    phase: 5.4,
    tiltZ: -0.42, // -24.1 deg (sweeps across entire screen)
    tiltX: -0.05,
    trailBeads: 14,
  },
  {
    name: "Jupiter",
    semiMajor: 20.0,
    flattening: 0.3,
    speed: 0.065,
    radius: 0.2,
    colorDark: "#f472b6", // Rose
    colorLight: "#db2777",
    emissiveDark: "#db2777",
    emissiveLight: "#f472b6",
    phase: 1.5,
    tiltZ: -0.28, // -16.0 deg (spans beyond viewport edges)
    tiltX: 0.04,
    trailBeads: 12,
  },
];

// ── Soft Circular Dot Sprite Texture ──────────────────────────────────────

let sharedDotTexture: THREE.CanvasTexture | null = null;

function getDotTexture(): THREE.CanvasTexture {
  if (sharedDotTexture) return sharedDotTexture;

  const canvas = document.createElement("canvas");
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    gradient.addColorStop(0, "rgba(255, 255, 255, 1)");
    gradient.addColorStop(0.35, "rgba(255, 255, 255, 0.85)");
    gradient.addColorStop(0.7, "rgba(255, 255, 255, 0.25)");
    gradient.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(16, 16, 16, 0, Math.PI * 2);
    ctx.fill();
  }
  sharedDotTexture = new THREE.CanvasTexture(canvas);
  return sharedDotTexture;
}

// ── Background Ambient Stars ──────────────────────────────────────────────

function Starfield({ isDark }: { isDark: boolean }) {
  const pointsRef = useRef<THREE.Points>(null);
  const dotTexture = useMemo(() => getDotTexture(), []);

  const positions = useMemo(() => {
    let seed = 42;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const count = 260;
    const pos = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      pos[i * 3] = (rnd() - 0.5) * 56;
      pos[i * 3 + 1] = (rnd() - 0.5) * 38;
      pos[i * 3 + 2] = -6 - rnd() * 14;
    }
    return pos;
  }, []);

  useFrame(({ clock }) => {
    if (!pointsRef.current) return;
    const elapsed = clock.getElapsedTime();
    pointsRef.current.rotation.z = elapsed * 0.002;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.18}
        map={dotTexture}
        color={isDark ? "#e8eef5" : "#e59b0c"}
        transparent
        opacity={isDark ? 0.55 : 0.45}
        sizeAttenuation
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
}

// ── Central 3D Sun ────────────────────────────────────────────────────────

function CentralSun({ isDark }: { isDark: boolean }) {
  const coreRef = useRef<THREE.Mesh>(null);
  const halo1Ref = useRef<THREE.Mesh>(null);
  const halo2Ref = useRef<THREE.Mesh>(null);
  const halo3Ref = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    const elapsed = clock.getElapsedTime();

    if (coreRef.current) {
      coreRef.current.rotation.y = elapsed * 0.12;
      coreRef.current.rotation.z = elapsed * 0.04;
    }

    if (halo1Ref.current) {
      halo1Ref.current.rotation.y = -elapsed * 0.08;
      const p1 = 1 + 0.02 * Math.sin(elapsed * 2.2);
      halo1Ref.current.scale.set(p1, p1, p1);
    }

    if (halo2Ref.current) {
      halo2Ref.current.rotation.z = elapsed * 0.05;
      const p2 = 1 + 0.03 * Math.sin(elapsed * 1.7);
      halo2Ref.current.scale.set(p2, p2, p2);
    }

    if (halo3Ref.current) {
      halo3Ref.current.rotation.y = elapsed * 0.04;
      const p3 = 1 + 0.04 * Math.sin(elapsed * 1.3);
      halo3Ref.current.scale.set(p3, p3, p3);
    }
  });

  const coreColor = isDark ? "#ffcf3f" : "#ffb703";
  const emissiveColor = isDark ? "#f97316" : "#fb8500";
  const halo1Color = isDark ? "#f59e0b" : "#fb923c";
  const halo2Color = isDark ? "#f97316" : "#f97316";
  const halo3Color = isDark ? "#ff9f1c" : "#fbbf24";

  return (
    <group position={[0, 0, 0]}>
      <pointLight position={[0, 0, 0]} intensity={5.5} color={coreColor} distance={45} />
      <ambientLight intensity={isDark ? 0.95 : 1.35} />
      <directionalLight position={[4, 5, 8]} intensity={1.2} />

      {/* 1. Rigid 3D Solar Core */}
      <mesh ref={coreRef}>
        <sphereGeometry args={[0.82, 64, 64]} />
        <meshStandardMaterial
          color={coreColor}
          emissive={emissiveColor}
          emissiveIntensity={isDark ? 0.95 : 0.75}
          roughness={0.2}
          metalness={0.05}
        />
      </mesh>

      {/* 2. Halo 1: Inner Atmospheric Corona */}
      <mesh ref={halo1Ref}>
        <sphereGeometry args={[1.02, 48, 48]} />
        <meshBasicMaterial
          color={halo1Color}
          transparent
          opacity={isDark ? 0.32 : 0.24}
          side={THREE.BackSide}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* 3. Halo 2: Middle Atmospheric Shell */}
      <mesh ref={halo2Ref}>
        <sphereGeometry args={[1.24, 48, 48]} />
        <meshBasicMaterial
          color={halo2Color}
          transparent
          opacity={isDark ? 0.18 : 0.14}
          side={THREE.BackSide}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* 4. Halo 3: Outer Atmospheric Aura */}
      <mesh ref={halo3Ref}>
        <sphereGeometry args={[1.46, 48, 48]} />
        <meshBasicMaterial
          color={halo3Color}
          transparent
          opacity={isDark ? 0.1 : 0.08}
          side={THREE.BackSide}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  );
}

// ── One Tilted Dotted Planetary Orbit ─────────────────────────────────────

function TiltedOrbit({ def, isDark }: { def: PlanetDef; isDark: boolean }) {
  const planetRef = useRef<THREE.Mesh>(null);
  const moonRef = useRef<THREE.Mesh>(null);
  const beadsRef = useRef<THREE.Group>(null);
  const dotTexture = useMemo(() => getDotTexture(), []);

  const rx = def.semiMajor;
  const ry = def.semiMajor * def.flattening;

  // 1. Dotted Orbit Track geometry: evenly spaced points around the ellipse
  const dottedGeometry = useMemo(() => {
    // Approximate ellipse perimeter to space dots evenly
    const perimeter = 2 * Math.PI * Math.sqrt((rx * rx + ry * ry) / 2);
    const dotCount = Math.max(64, Math.round(perimeter / 0.42));
    const pos = new Float32Array(dotCount * 3);

    for (let i = 0; i < dotCount; i++) {
      const theta = (i / dotCount) * Math.PI * 2;
      pos[i * 3] = rx * Math.cos(theta);
      pos[i * 3 + 1] = ry * Math.sin(theta);
      pos[i * 3 + 2] = 0;
    }

    const geom = new THREE.BufferGeometry();
    geom.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    return geom;
  }, [rx, ry]);

  // Subtle continuous guide line under the dots
  const lineGeometry = useMemo(() => {
    const points: THREE.Vector3[] = [];
    const segments = 128;
    for (let i = 0; i < segments; i++) {
      const theta = (i / segments) * Math.PI * 2;
      points.push(new THREE.Vector3(rx * Math.cos(theta), ry * Math.sin(theta), 0));
    }
    return new THREE.BufferGeometry().setFromPoints(points);
  }, [rx, ry]);

  const planetColor = isDark ? def.colorDark : def.colorLight;
  const emissiveColor = isDark ? def.emissiveDark : def.emissiveLight;
  const dotTrackColor = isDark ? "#e8eef5" : "#64748b";

  // Stardust bead trail along the orbit behind the planet
  const beads = useMemo(() => {
    return Array.from({ length: def.trailBeads }, (_, i) => ({
      index: i + 1,
      factor: 1 - (i + 1) / (def.trailBeads + 1),
    }));
  }, [def.trailBeads]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime() * def.speed + def.phase;

    // Position of the planet along its ellipse
    const px = rx * Math.cos(t);
    const py = ry * Math.sin(t);

    if (planetRef.current) {
      planetRef.current.position.set(px, py, 0);
      planetRef.current.rotation.y = t * 2.5;
    }

    // Position of the orbiting satellite moon
    if (moonRef.current && def.hasMoon) {
      const moonDist = 0.52;
      const moonSpeed = t * 5.5;
      moonRef.current.position.set(
        px + moonDist * Math.cos(moonSpeed),
        py + moonDist * Math.sin(moonSpeed) * 0.65,
        0.1 * Math.sin(moonSpeed),
      );
    }

    // Update bead trail positions along the elliptical path
    if (beadsRef.current) {
      const children = beadsRef.current.children as THREE.Mesh[];
      beads.forEach((bead, i) => {
        const beadMesh = children[i];
        if (beadMesh) {
          const beadTheta = t - bead.index * 0.046;
          beadMesh.position.set(rx * Math.cos(beadTheta), ry * Math.sin(beadTheta), 0);
        }
      });
    }
  });

  return (
    <group rotation={[def.tiltX, 0, def.tiltZ]}>
      {/* 1. Dotted Orbit Track */}
      <points geometry={dottedGeometry}>
        <pointsMaterial
          size={0.13}
          map={dotTexture}
          color={dotTrackColor}
          transparent
          opacity={isDark ? 0.32 : 0.22}
          sizeAttenuation
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </points>

      {/* 2. Whisper-soft continuous underlying orbit line */}
      <lineLoop geometry={lineGeometry}>
        <lineBasicMaterial
          color={dotTrackColor}
          transparent
          opacity={isDark ? 0.06 : 0.04}
          blending={THREE.AdditiveBlending}
        />
      </lineLoop>

      {/* 3. Stardust Bead Trail */}
      <group ref={beadsRef}>
        {beads.map((b) => (
          <mesh key={b.index}>
            <sphereGeometry args={[def.radius * (0.65 * b.factor + 0.15), 12, 12]} />
            <meshBasicMaterial
              color={planetColor}
              transparent
              opacity={b.factor * (isDark ? 0.38 : 0.28)}
              blending={THREE.AdditiveBlending}
            />
          </mesh>
        ))}
      </group>

      {/* 4. Orbiting Planet Sphere */}
      <mesh ref={planetRef}>
        <sphereGeometry args={[def.radius, 32, 32]} />
        <meshStandardMaterial
          color={planetColor}
          emissive={emissiveColor}
          emissiveIntensity={isDark ? 0.4 : 0.22}
          roughness={0.25}
          metalness={0.15}
        />
      </mesh>

      {/* 5. Optional Satellite Moon */}
      {def.hasMoon && (
        <mesh ref={moonRef}>
          <sphereGeometry args={[0.065, 16, 16]} />
          <meshStandardMaterial
            color="#cbd5e1"
            emissive="#94a3b8"
            emissiveIntensity={0.2}
            roughness={0.4}
            metalness={0.1}
          />
        </mesh>
      )}
    </group>
  );
}

// ── Complete Solar System Group with True 3D Transforms ───────────────────

function SolarSystemScene({ view, isDark }: { view: "home" | "onboarding"; isDark: boolean }) {
  const solarGroupRef = useRef<THREE.Group>(null);

  // Sleek angled perspective and wide orbital layout
  const transform = useRef({
    posX: 4.2,
    posY: 0,
    posZ: 0,
    rotX: 0.22, // Viewed at a sleek angle (not flat overhead)
    rotY: -0.18,
    rotZ: 0.04,
    scale: 1.0,
  });

  // Target values for each view based on viewport width
  useEffect(() => {
    const isDesktop = typeof window !== "undefined" && window.innerWidth >= 1024;
    const prefersReduced =
      typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const targets =
      view === "onboarding"
        ? {
            // Zoom in on sun, shift towards top-right, and rotate more towards the right
            posX: isDesktop ? 6.8 : 1.4,
            posY: isDesktop ? 2.2 : 1.8,
            posZ: isDesktop ? 2.5 : 0.8,
            rotX: 0.28, // Sleek side-view pitch
            rotY: 1.05, // Rotated more towards the right (~60° yaw)
            rotZ: 0.08, // Clockwise roll rotation towards the right (no longer leaning left into cards)
            scale: isDesktop ? 1.28 : 0.85,
          }
        : {
            // Default Home state: Sleek angled perspective
            posX: isDesktop ? 4.2 : 0,
            posY: isDesktop ? 0 : -2.2,
            posZ: isDesktop ? 0 : -1.6,
            rotX: 0.22, // Sleek angle
            rotY: -0.18,
            rotZ: 0.04,
            scale: isDesktop ? 1.0 : 0.68,
          };

    if (prefersReduced) {
      Object.assign(transform.current, targets);
    } else {
      gsap.to(transform.current, {
        ...targets,
        duration: 1.15,
        ease: "power2.inOut",
        overwrite: "auto",
      });
    }
  }, [view]);

  useFrame(({ clock }) => {
    if (!solarGroupRef.current) return;
    const elapsed = clock.getElapsedTime();
    const t = transform.current;

    // Apply interpolated position
    solarGroupRef.current.position.set(t.posX, t.posY, t.posZ);

    // Apply rotation = GSAP target angle + smooth to-and-fro yaw oscillation bounded to ±0.09 rad (~5°)
    const yawOscillation = Math.sin(elapsed * 0.16) * 0.09;
    solarGroupRef.current.rotation.x = t.rotX;
    solarGroupRef.current.rotation.y = t.rotY + yawOscillation;
    solarGroupRef.current.rotation.z = t.rotZ;

    // Apply scale
    solarGroupRef.current.scale.setScalar(t.scale);
  });

  return (
    <>
      <Starfield isDark={isDark} />

      <group ref={solarGroupRef}>
        <CentralSun isDark={isDark} />

        {PLANETS.map((def) => (
          <TiltedOrbit key={def.name} def={def} isDark={isDark} />
        ))}
      </group>
    </>
  );
}

// ── Exported Full-Screen 3D Solar System Component ────────────────────────

export interface HomeSolarSystemR3FProps {
  view?: "home" | "onboarding";
  className?: string;
}

export function HomeSolarSystemR3F({ view = "home", className }: HomeSolarSystemR3FProps) {
  const { isDark } = useTheme();

  return (
    <div
      className={`pointer-events-none select-none fixed inset-0 z-0 size-full overflow-hidden ${className ?? ""}`}
      aria-hidden="true"
    >
      <Canvas
        camera={{ position: [0, 0, 18], fov: 45, near: 0.1, far: 100 }}
        gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }}
        dpr={[1, 2]}
      >
        <Suspense fallback={null}>
          <SolarSystemScene view={view} isDark={isDark} />
        </Suspense>
      </Canvas>
    </div>
  );
}
