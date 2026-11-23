import type { CosmicContext, CosmicEventKind } from "@/components/background/cosmos/types";
import { supernova } from "@/components/background/cosmos/events/supernova";
import { nebula } from "@/components/background/cosmos/events/nebula";
import { shooting } from "@/components/background/cosmos/events/shooting";
import { comet } from "@/components/background/cosmos/events/comet";
import { cluster } from "@/components/background/cosmos/events/cluster";
import { aurora } from "@/components/background/cosmos/events/aurora";
import { saturn } from "@/components/background/cosmos/events/saturn";
import { asteroid } from "@/components/background/cosmos/events/asteroid";

export const COSMIC_EVENTS: Record<CosmicEventKind, (ctx: CosmicContext) => void> = {
  supernova,
  nebula,
  shooting,
  comet,
  cluster,
  aurora,
  saturn,
  asteroid,
};

export const COSMIC_KINDS: CosmicEventKind[] = [
  "supernova",
  "nebula",
  "shooting",
  "comet",
  "cluster",
  "aurora",
  "saturn",
  "asteroid",
];
