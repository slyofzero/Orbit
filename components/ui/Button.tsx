import NextLink from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cx } from "@/components/utils/cx";
import { txt } from "@/components/utils/txt";

export type ButtonVariant = "primary" | "secondary" | "soft" | "ghost" | "danger" | "special";
export type ButtonSize = "sm" | "md" | "lg";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant; // primary = the one main action on a screen; special = animated gradient
  size?: ButtonSize;
  icon?: ReactNode; // shown before the label
  iconAfter?: ReactNode; // shown after the label
  loading?: boolean; // shows a spinner and blocks clicks
  block?: boolean; // full width
  href?: string; // makes it a link to another page that looks like this button
};

export const BUTTON_BASE =
  "inline-flex cursor-pointer items-center justify-center gap-2 rounded-full border-[1.5px] border-transparent font-body leading-none font-bold whitespace-nowrap no-underline transition-[background-color,color,border-color,transform,filter,box-shadow] duration-150 disabled:cursor-not-allowed disabled:opacity-45 [&_svg]:size-[1.1em] [&_svg]:shrink-0";
export const BUTTON_SIZE: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-[0.85rem]",
  md: "px-[18px] py-[9px] text-[0.92rem]",
  lg: "px-6 py-3 text-base",
};
export const BUTTON_VARIANT: Record<ButtonVariant, string> = {
  primary: "bg-accent text-on-accent not-disabled:hover:-translate-y-px not-disabled:hover:brightness-108",
  secondary: "border-ink bg-transparent text-ink not-disabled:hover:bg-ink not-disabled:hover:text-sheet",
  soft: "border-line bg-sheet/70 glass-blur text-ink not-disabled:hover:bg-sheet-2",
  ghost: "bg-transparent text-ink not-disabled:hover:bg-sheet-2",
  danger: "border-red bg-transparent text-red not-disabled:hover:bg-red not-disabled:hover:text-white",
  special:
    "special-fill animate-flow not-disabled:hover:-translate-y-px not-disabled:hover:shadow-[0_8px_22px_-10px_var(--special-c)] not-disabled:hover:brightness-108 not-disabled:hover:saturate-110",
};

export function Button({
  variant = "secondary",
  size = "md",
  icon,
  iconAfter,
  loading = false,
  block = false,
  className,
  children,
  disabled,
  type = "button",
  href,
  ...rest
}: ButtonProps) {
  if (href)
    return (
      <NextLink
        href={href}
        className={cx(BUTTON_BASE, BUTTON_SIZE[size], BUTTON_VARIANT[variant], block && "w-full", className)}
      >
        {icon}
        {txt(children)}
        {iconAfter}
      </NextLink>
    );
  return (
    <button
      {...rest}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cx(BUTTON_BASE, BUTTON_SIZE[size], BUTTON_VARIANT[variant], block && "w-full", className)}
    >
      {loading ? <Spinner /> : icon}
      {txt(children)}
      {iconAfter}
    </button>
  );
}

/** The round icon-only button's look (also used by CopyButton). Colour classes are left out when `colours` is false. */
export function iconButtonClass(
  size: "sm" | "md" = "md",
  variant: "outline" | "ghost" = "outline",
  colours = true,
): string {
  return cx(
    "inline-grid cursor-pointer place-items-center rounded-full border-[1.5px] transition-[border-color,background-color] duration-150 disabled:cursor-not-allowed",
    size === "sm" ? "size-[30px] [&_svg]:size-4" : "size-[38px] [&_svg]:size-[18px]",
    colours && "text-ink",
    colours &&
      (variant === "ghost"
        ? "border-transparent bg-transparent enabled:hover:bg-sheet-2 disabled:opacity-35"
        : "border-line bg-sheet/70 glass-blur enabled:hover:border-ink disabled:opacity-45"),
  );
}

/** Round button with only an icon. `label` is required: it is read out by screen readers and shown on hover.
 *  outline = bordered circle (default) · ghost = no border until hovered (toolbars, inside other components). */
export function IconButton({
  label,
  children,
  className,
  type = "button",
  size = "md",
  variant = "outline",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  children: ReactNode;
  size?: "sm" | "md";
  variant?: "outline" | "ghost";
}) {
  return (
    <button
      {...rest}
      type={type}
      aria-label={label}
      title={label}
      className={cx(iconButtonClass(size, variant), className)}
    >
      {children}
    </button>
  );
}

/** Loading indicator. `special` = gradient ring. */
export function Spinner({ label, special = false }: { label?: string; special?: boolean }) {
  return (
    <span
      className={cx(
        "inline-block rounded-full",
        special
          ? "special-ring size-[1.4em] animate-spin-slow"
          : "size-[1em] animate-spin border-2 border-current border-r-transparent",
      )}
      role={label ? "status" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    />
  );
}
