// Pictures in questions. In the pack file a question writes ![what it shows](img:name) and the top-level "images" object holds the picture itself
// as a data URI. The app gives every picture a name made from its content (h…), so the same picture is stored once, and keeps the
// pictures outside the pack (they are big): see lib/imageStore.ts. Everything here is pure, so scripts/check.ts can test it.
import type { PackData } from "./packs";

export const IMG = /!\[([^\]\n]*)\]\(([^)\s]+)\)/g;
export const DATA_IMG = /^data:image\/(png|jpeg|webp|gif|svg\+xml);base64,[A-Za-z0-9+/=]+$/;
export const MAX_IMAGE = 3_000_000; // characters in one data URI (about 2.2 MB of picture)
export const MAX_IMAGES_TOTAL = 80_000_000;
export const MAX_IMAGE_COUNT = 2000;

/** A short name made from the picture itself: the same picture always gets the same name. */
export function hashData(s: string): string {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677); }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return `h${(h1 >>> 0).toString(36)}${(h2 >>> 0).toString(36)}-${s.length.toString(36)}`;
}

/** Splits text into plain pieces and picture pieces. */
export function splitImages(text: string): ({ text: string } | { alt: string; src: string })[] {
  const out: ({ text: string } | { alt: string; src: string })[] = [];
  let last = 0;
  for (const m of text.matchAll(IMG)) {
    if (m.index! > last) out.push({ text: text.slice(last, m.index) });
    out.push({ alt: m[1], src: m[2] });
    last = m.index! + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last) });
  return out;
}

/** The stored pictures (img:name) that a text uses. */
export const storedImageNames = (text: string): string[] => [...text.matchAll(IMG)].map((m) => m[2]).filter((s) => s.startsWith("img:")).map((s) => s.slice(4));

/** Every stored picture the pack's questions use, in the practice bank and in the mock tests. */
export function packImageNames(pack: PackData): string[] {
  const qs = [...pack.questions, ...(pack.mockTests ?? []).flatMap((m) => m.sections.flatMap((x) => x.questions))];
  return [...new Set(qs.flatMap((q) => [q.text, q.explanation, ...(q.options ?? [])]).flatMap((t) => storedImageNames(t ?? "")))];
}
