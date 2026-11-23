import type { Scene } from "@/components/companion/types";
import { SkyScene } from "@/components/companion/scenes/sky/sky";
import { LabScene } from "@/components/companion/scenes/lab/lab";
import { RainScene } from "@/components/companion/scenes/rain/rain";
import { SpaceScene } from "@/components/companion/scenes/space/space";
import { SeaScene } from "@/components/companion/scenes/sea/sea";
import { LondonScene } from "@/components/companion/scenes/london/london";
import { ParisScene } from "@/components/companion/scenes/paris/paris";
import { CakeScene } from "@/components/companion/scenes/cake/cake";

export const SceneArt = ({ scene }: { scene: Scene }) => {
  switch (scene) {
    case "sky":
      return <SkyScene />;
    case "lab":
      return <LabScene />;
    case "rain":
      return <RainScene />;
    case "space":
      return <SpaceScene />;
    case "sea":
      return <SeaScene />;
    case "london":
      return <LondonScene />;
    case "paris":
      return <ParisScene />;
    case "cake":
      return <CakeScene />;
  }
};
