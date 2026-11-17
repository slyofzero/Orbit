import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cx } from "./cx";
import { txt } from "./txt";

export type ButtonVariant = "primary" | "secondary" | "soft" | "ghost" | "danger" | "special";
export type ButtonSize = "sm" | "md" | "lg";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;   // primary = the one main action on a screen; special = animated gradient
  size?: ButtonSize;
  icon?: ReactNode;          // shown before the label
  iconAfter?: ReactNode;     // shown after the label
  loading?: boolean;         // shows a spinner and blocks clicks
  block?: boolean;           // full width
};

export function Button({
  variant = "secondary", size = "md", icon, iconAfter, loading = false, block = false,
  className, children, disabled, type = "button", ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cx("ui-btn", `ui-btn-${variant}`, `ui-btn-${size}`, block && "ui-btn-block", className)}
    >
      {loading ? <Spinner /> : icon}
      {txt(children)}
      {iconAfter}
    </button>
  );
}

/** Round button with only an icon. `label` is required: it is read out by screen readers and shown on hover.
 *  outline = bordered circle (default) · ghost = no border until hovered (toolbars, inside other components). */
export function IconButton({ label, children, className, type = "button", size = "md", variant = "outline", ...rest }:
  ButtonHTMLAttributes<HTMLButtonElement> & { label: string; children: ReactNode; size?: "sm" | "md"; variant?: "outline" | "ghost" }) {
  return (
    <button {...rest} type={type} aria-label={label} title={label}
      className={cx("ui-iconbtn", size === "sm" && "ui-iconbtn-sm", variant === "ghost" && "ui-iconbtn-ghost", className)}>
      {children}
    </button>
  );
}

/** Loading indicator. `special` = gradient ring. */
export function Spinner({ label, special = false }: { label?: string; special?: boolean }) {
  return <span className={cx("ui-spinner", special && "is-special")} role={label ? "status" : undefined} aria-label={label} aria-hidden={label ? undefined : true} />;
}
