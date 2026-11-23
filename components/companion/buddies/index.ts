import type { Buddy } from "@/components/companion/types";
import { OWL_BUDDY } from "@/components/companion/buddies/owl/owl";
import { ROBOT_BUDDY } from "@/components/companion/buddies/robot/robot";
import { CAT_BUDDY } from "@/components/companion/buddies/cat/cat";
import { ASTRONAUT_BUDDY } from "@/components/companion/buddies/astronaut/astronaut";
import { JELLY_BUDDY } from "@/components/companion/buddies/jelly/jelly";
import { TEACUP_BUDDY } from "@/components/companion/buddies/teacup/teacup";
import { REX_BUDDY } from "@/components/companion/buddies/rex/rex";
import { GHOST_BUDDY } from "@/components/companion/buddies/ghost/ghost";

export const BUDDIES: Buddy[] = [
  OWL_BUDDY,
  ROBOT_BUDDY,
  CAT_BUDDY,
  ASTRONAUT_BUDDY,
  JELLY_BUDDY,
  TEACUP_BUDDY,
  REX_BUDDY,
  GHOST_BUDDY,
];

export const getBuddyById = (id: string): Buddy => BUDDIES.find((b) => b.id === id) ?? BUDDIES[0];
