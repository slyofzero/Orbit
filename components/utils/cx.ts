/** Joins class names, skipping empty ones: cx("a", on && "b") → "a b". */
export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}
