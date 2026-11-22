"use client";
import { useState } from "react";
import { IconRefresh } from "@/components/icons";
import { cx, txt } from "@/components/utils";

/**
 * v1's quote banner: a warm gradient bar with a quote and a button for the next one.
 * `size="sm"` is the slimmer version that sits next to the dashboard greeting.
 * Which quote to show is up to the caller (`quote`, `onNext`).
 */
export function QuoteBanner({
  quote,
  onNext,
  size = "md",
}: {
  quote: string;
  onNext?: () => void;
  size?: "md" | "sm";
}) {
  const [spin, setSpin] = useState(0);
  const sm = size === "sm";
  return (
    <aside
      aria-label="A thought for today"
      className={cx(
        "warm special-fill animate-flow relative flex items-center overflow-hidden text-white shadow-[0_18px_40px_-22px_var(--warm-b),inset_0_0_0_1px_rgb(255_255_255/0.14)] [text-shadow:0_1px_2px_rgb(0_0_0/0.25)]",
        sm
          ? "gap-3 rounded-[18px] py-2.5 pr-3 pl-[18px]"
          : "min-h-[92px] gap-[18px] rounded-[24px] py-[18px] pr-5 pl-[26px] max-[760px]:min-h-[120px] max-[760px]:gap-3 max-[760px]:p-4",
      )}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -top-[120px] right-[8%] size-[220px] animate-glow rounded-full bg-[radial-gradient(circle,color-mix(in_srgb,white_60%,transparent),transparent_68%)]"
      />
      <svg
        viewBox="0 0 48 36"
        aria-hidden="true"
        className={cx(
          "relative flex-none self-start fill-white/40",
          sm ? "mt-0.5 w-[22px]" : "mt-1 w-[34px] max-[760px]:w-[26px]",
        )}
      >
        <path d="M0 36V20C0 8 6 1 18 0v7c-6 1-9 5-9 11h9v18H0zm28 0V20C28 8 34 1 46 0v7c-6 1-9 5-9 11h9v18H28z" />
      </svg>
      <span
        key={quote}
        className={cx(
          "relative flex-1 animate-card-in font-display font-semibold tracking-[-0.01em] text-balance",
          sm ? "text-[clamp(0.95rem,1.25vw,1.2rem)] leading-[1.25]" : "text-[clamp(1.1rem,1.7vw,1.5rem)] leading-[1.3]",
        )}
      >
        {txt(quote)}
      </span>
      {onNext && (
        <button
          type="button"
          aria-label="Show another quote"
          title="Another quote"
          onClick={() => {
            setSpin((n) => n + 1);
            onNext();
          }}
          className={cx(
            "relative grid flex-none cursor-pointer place-items-center rounded-full bg-white/16 transition-colors duration-200 hover:bg-white/30",
            sm ? "size-8 [&_svg]:size-[17px]" : "size-10 [&_svg]:size-5",
          )}
        >
          <span
            className="grid transition-transform duration-500 ease-[cubic-bezier(0.3,1.4,0.5,1)]"
            style={{ transform: `rotate(${spin * 180}deg)` }}
          >
            <IconRefresh />
          </span>
        </button>
      )}
    </aside>
  );
}
