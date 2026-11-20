// The padding around an app page (v1's): the app frame has none, so full-bleed screens like the welcome
// can run edge to edge. Every other page wraps its content in this.

import type { ReactNode } from "react";

export function Page({ children }: { children: ReactNode }) {
  return <div className="px-[clamp(18px,3.5vw,44px)] pt-[34px] pb-20 max-[760px]:pb-[100px]">{children}</div>;
}
