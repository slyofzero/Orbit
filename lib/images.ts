// Picture references. A picture is stored once, named by a hash of its bytes, and text refers to it
// as `img:<hash>` (e.g. ![graph](img:h3f9a…)). Never put base64 picture data inside text.

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB per picture

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
