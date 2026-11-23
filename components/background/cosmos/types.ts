export type CosmicEventKind =
  | "supernova"
  | "nebula"
  | "shooting"
  | "comet"
  | "cluster"
  | "aurora"
  | "saturn"
  | "asteroid";

export interface CosmicContext {
  layer: HTMLDivElement;
  dark: () => boolean;
  dim: () => number;
  W: () => number;
  H: () => number;
  rand: (a: number, b: number) => number;
  later: (fn: () => void, ms: number) => void;
  phase: (k: string) => void;
  add: (css: Partial<CSSStyleDeclaration>, anim: Keyframe[], opts: KeyframeAnimationOptions) => HTMLElement;
  flash: (peak: number, ms: number, color?: string) => HTMLElement;
  shake: (ms: number, amp: number) => void;
}
