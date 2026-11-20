import type { ReactNode } from "react";
import { IconChevronRight } from "@/components/icons";
import { txt } from "@/components/utils/txt";
import { cx } from "@/components/utils/cx";

/** Show / hide extra content (help, advanced options). Built on <details>, so it works without JS. */
export function Disclosure({
  title,
  defaultOpen = false,
  className,
  children,
}: {
  title: ReactNode;
  defaultOpen?: boolean;
  className?: string;
  children: ReactNode;
}) {
  // `[[open]>&]` / `[[open]>summary>&]`: only THIS disclosure's open state counts, not an outer one's
  return (
    <details className={cx("rounded-md border border-line bg-sheet", className)} open={defaultOpen || undefined}>
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-md px-3.5 py-2.5 font-bold select-none hover:bg-sheet-2 [&::-webkit-details-marker]:hidden [[open]>&]:rounded-b-none">
        <IconChevronRight className="size-4 shrink-0 text-gray transition-transform duration-200 [[open]>summary>&]:rotate-90" />
        {txt(title)}
      </summary>
      <div className="grid gap-2.5 pt-1 pr-3.5 pb-3.5 pl-[38px]">{children}</div>
    </details>
  );
}
