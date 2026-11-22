// Picture references. A picture is stored once, named by a hash of its bytes, and text refers to it
// as `img:<hash>` (e.g. ![graph](img:h3f9a…)). Never put base64 picture data inside text.

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB per picture
/** A stored picture no question uses is deleted (`image.sweep`) only once it is this old: a picture added in the
 *  editor is saved before its question is, so a fresh one is never swept away mid-edit. */
export const UNUSED_IMAGE_GRACE_MS = 24 * 60 * 60 * 1000;
/** The database worker sweeps unused pictures when it opens, then this often. */
export const IMAGE_SWEEP_EVERY_MS = 60 * 60 * 1000;

/** "h" + the first 32 hex characters of the SHA-256 of the bytes. Same picture → same name. */
export async function hashImage(bytes: ArrayBuffer | Uint8Array): Promise<string> {
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const digest = await crypto.subtle.digest("SHA-256", data as Uint8Array<ArrayBuffer>);
  const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return "h" + hex.slice(0, 32);
}

export const imageRef = (hash: string) => `img:${hash}`;

/** "img:h3f9a…" → "h3f9a…"; anything else → null. */
export const refToHash = (src: string) => (src.startsWith("img:") ? src.slice(4) : null);

/** Why a file can't be used as a picture, or null if it is fine. */
export function imageProblem(file: { type: string; size: number }): string | null {
  if (!file.type.startsWith("image/")) return "That file is not a picture. Use a PNG, JPG, GIF, WebP or SVG.";
  if (file.size > MAX_IMAGE_BYTES) return "That picture is larger than 5 MB. Make it smaller and try again.";
  return null;
}

/** The picture names (`img:<hash>`) used in these texts, each once, in order of appearance. */
export function imageHashes(texts: readonly (string | null | undefined)[]): string[] {
  const out = new Set<string>();
  for (const t of texts)
    for (const m of (t ?? "").matchAll(/\]\(img:([A-Za-z0-9_-]+)(?:\s+\d{1,3}%)?\)/g)) out.add(m[1]);
  return [...out];
}

/** A markdown picture `![alt](img:<hash> or https://…)` with its optional size (`50%`), as the parser reads it. */
const PICTURE = /!\[((?:\\.|[^\]\\])*)\]\(\s*(img:[A-Za-z0-9_-]+|https?:\/\/[^\s)]+)(?:\s+(\d{1,3})%)?\s*\)/g;

/** The size (percent of the line) of each picture in the text, in order; null = full width. */
export function pictureSizes(text: string): (number | null)[] {
  return [...text.matchAll(PICTURE)].map((m) => (m[3] ? Number(m[3]) : null));
}

/** The text with the `index`-th picture set to `percent` (100 or more = full width, which needs no tag). */
export function setPictureSize(text: string, index: number, percent: number): string {
  let i = -1;
  return text.replace(PICTURE, (all, alt: string, src: string) =>
    ++i === index ? `![${alt}](${src}${percent < 100 ? ` ${Math.max(10, Math.round(percent))}%` : ""})` : all,
  );
}
