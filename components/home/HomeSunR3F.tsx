"use client";

import { useRef, Suspense } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useTheme } from "@/lib/global";

function AnimatedSunMesh({ isDark }: { isDark: boolean }) {
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
    <group>
      <ambientLight intensity={1.4} />
      <pointLight position={[0, 0, 0]} intensity={4.8} color={coreColor} distance={8} />
      <directionalLight position={[2, 3, 4]} intensity={1.5} />

      {/* 1. Perfect Rigid 3D Solar Core (20% smaller: radius 0.8) */}
      <mesh ref={coreRef}>
        <sphereGeometry args={[0.8, 64, 64]} />
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
        <sphereGeometry args={[0.98, 48, 48]} />
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
        <sphereGeometry args={[1.18, 48, 48]} />
        <meshBasicMaterial
          color={halo2Color}
          transparent
          opacity={isDark ? 0.18 : 0.14}
          side={THREE.BackSide}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* 4. Halo 3: Outer Atmospheric Aura (Generous frustum padding: never cut off) */}
      <mesh ref={halo3Ref}>
        <sphereGeometry args={[1.38, 48, 48]} />
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

/**
 * 3D Sun built with React Three Fiber:
 * - Perfect geometric sphere 20% smaller with emissive solar radiance
 * - Three concentric atmospheric halos with additive blending
 * - Generous camera frustum padding so halos never clip against viewport edges
 * - Continuous axial rotation and breathing pulses
 * - Seamless light / dark theme adaptation
 */
export function HomeSunR3F({ size = 220, className }: { size?: number | string; className?: string }) {
  const { isDark } = useTheme();

  return (
    <div
      className={`pointer-events-none select-none flex items-center justify-center ${className ?? ""}`}
      style={typeof size === "number" ? { width: `${size}px`, height: `${size}px` } : { width: size, height: size }}
      aria-hidden="true"
    >
      <Canvas
        camera={{ position: [0, 0, 5.2], fov: 45 }}
        gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }}
        dpr={[1, 2]}
      >
        <Suspense fallback={null}>
          <AnimatedSunMesh isDark={isDark} />
        </Suspense>
      </Canvas>
    </div>
  );
}
