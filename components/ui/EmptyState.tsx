import type { ReactNode } from "react";
import { txt } from "@/components/utils/txt";
import { Heading } from "@/components/ui/Heading";

/** What a list or page shows when it has nothing yet: say why, and offer the next step. */
export function EmptyState({
  icon = "🪐",
  title,
  children,
  action,
}: {
  icon?: ReactNode;
  title: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="grid justify-items-center gap-2 rounded-lg border-[1.5px] border-dashed border-line px-5 py-9 text-center">
      <span className="text-[2rem]" aria-hidden="true">
        {icon}
      </span>
      <Heading level={3}>{title}</Heading>
      {children && <p className="max-w-[46ch] text-gray">{txt(children)}</p>}
      {action && <div className="mt-1.5">{action}</div>}
    </div>
  );
}
