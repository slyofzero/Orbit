// Turns picture files into a question pack that carries them.
//   bun scripts/embed-images.ts my-pack.json my-pictures-folder my-pack-with-pictures.json
// In my-pack.json a question writes ![alt](img:fig1). The folder holds fig1.png (or .jpg, .jpeg, .webp, .gif, .svg).
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { extname, join, basename } from "node:path";
const [, , packFile, folder, outFile] = process.argv;
if (!packFile || !folder || !outFile) { console.log("Usage: bun scripts/embed-images.ts <pack.json> <pictures folder> <out.json>"); process.exit(1); }
const MIME: Record<string, string> = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif", ".svg": "image/svg+xml" };
const pack = JSON.parse(readFileSync(packFile, "utf8"));
const text = JSON.stringify(pack);
const wanted = new Set([...text.matchAll(/img:([A-Za-z0-9_.-]{1,48})/g)].map((m) => m[1]));
const images: Record<string, string> = { ...(pack.images ?? {}) };
for (const f of readdirSync(folder)) {
  const name = basename(f, extname(f)), mime = MIME[extname(f).toLowerCase()];
  if (!mime || !wanted.has(name) || images[name]) continue;
  images[name] = `data:${mime};base64,${readFileSync(join(folder, f)).toString("base64")}`;
}
const missing = [...wanted].filter((n) => !images[n]);
if (missing.length) { console.log("Missing picture files for:", missing.join(", ")); process.exit(1); }
writeFileSync(outFile, JSON.stringify({ ...pack, images }, null, 2));
console.log(`Wrote ${outFile} with ${Object.keys(images).length} picture(s).`);
