import Rich from "@/components/Rich";
import { plainText } from "@/lib/richText";

/** A one-line preview of question text for lists and tables: LaTeX is rendered, pictures and code become short labels, and it is cut at `max` characters without splitting a formula. */
export function previewText(text: string, max = 90): string {
  let t = plainText(text ?? "")
    .replace(/!\[[^\]\n]*\]\([^)\s]+\)/g, " [picture] ")
    .replace(/```[\s\S]*?```/g, " [code] ")
    .replace(/\s+/g, " ")
    .trim();
  if (t.length <= max) return t;
  t = t.slice(0, max);
  const dollars = [...t.matchAll(/(?<!\\)\$/g)];
  if (dollars.length % 2 === 1) t = t.slice(0, dollars[dollars.length - 1].index); // never leave a formula half open
  if ((t.match(/(?<!\\)`/g) ?? []).length % 2 === 1) t = t.slice(0, t.lastIndexOf("`"));
  return t.trimEnd() + "…";
}

export default function QPreview({ text, max = 90 }: { text: string; max?: number }) {
  return <Rich text={previewText(text, max)} className="qprev" />;
}
