export { Cosmos } from "@/components/background/cosmos/Cosmos";
export { COSMIC_KINDS, COSMIC_EVENTS } from "@/components/background/cosmos/events";
export type { CosmicEventKind } from "@/components/background/cosmos/types";

export function triggerCosmicEvent(kind?: string) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("gate-cosmos-now", { detail: kind }));
  }
}
