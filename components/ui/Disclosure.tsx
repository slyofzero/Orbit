import type { ReactNode } from "react";
import { IconChevronRight } from "@/components/icons";
import { txt } from "@/components/utils/txt";
import { cx } from "@/components/utils/cx";

const BODY = "grid gap-2.5 pt-1 pr-3.5 pb-3.5 pl-[38px]";

/** Show / hide extra content (help, advanced options). Built on <details>, so it works without JS.
 *  Uncontrolled by default (`defaultOpen`). Pass `open` + `onOpenChange` to control it from outside, e.g.
 *  to force it open while a search is running. `bodyClassName` replaces the body's padding and layout
 *  (default: indented under the title, children stacked). */
export function Disclosure({
  title,
  defaultOpen = false,
  open,
  onOpenChange,
  className,
  bodyClassName,
  children,
}: {
  title: ReactNode;
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
}) {
  const controlled = open !== undefined;
  // `[[open]>&]` / `[[open]>summary>&]`: only THIS disclosure's open state counts, not an outer one's
  return (
    <details
      className={cx("disclosure-motion rounded-md border border-line bg-sheet", className)}
      open={controlled ? open : defaultOpen || undefined}
    >
      <summary
        className="flex cursor-pointer list-none items-center gap-2 rounded-md px-3.5 py-2.5 font-bold select-none hover:bg-sheet-2 [&::-webkit-details-marker]:hidden [[open]>&]:rounded-b-none"
        onClick={
          controlled
            ? (e) => {
                e.preventDefault(); // the parent decides; the browser must not flip it by itself
                onOpenChange?.(!open);
              }
            : undefined
        }
      >
        <IconChevronRight className="size-4 shrink-0 text-gray transition-transform duration-200 [[open]>summary>&]:rotate-90" />
        {txt(title)}
      </summary>
      <div className={bodyClassName ?? BODY}>{children}</div>
    </details>
  );
}
