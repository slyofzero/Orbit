// "Copy question": puts the question, its options and its pictures on the clipboard in one go.
// Three flavours are written together so the paste target takes what it understands:
//   text/plain  the question and options as text (pictures become "[picture: alt]")
//   text/html   the same, with the pictures inline
//   image/png   all pictures stacked into one image (what chat boxes and image editors take)
// The answer and explanation are NOT included.
import { splitImages } from "@/lib/images";
import { loadImage } from "@/lib/imageStore";
import type { Question } from "@/lib/types";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** img:name (saved with the pack) or a web link -> a data URI, or null when it cannot be loaded. */
async function pictureData(src: string, profile?: string): Promise<string | null> {
  try {
    if (src.startsWith("data:")) return src;
    if (src.startsWith("img:")) return (await loadImage(src.slice(4), profile)) ?? null;
    const blob = await (await fetch(src)).blob();
    return await new Promise((res) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = () => res(null); r.readAsDataURL(blob); });
  } catch { return null; }
}

const loadEl = (src: string) => new Promise<HTMLImageElement | null>((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });

/** All pictures stacked top to bottom on a white background, as one PNG. */
async function stackPng(datas: string[]): Promise<Blob | null> {
  const els = (await Promise.all(datas.map(loadEl))).filter((x): x is HTMLImageElement => !!x);
  if (!els.length) return null;
  const pad = 12, w = Math.max(...els.map((e) => e.naturalWidth)) + pad * 2;
  const h = els.reduce((s, e) => s + e.naturalHeight + pad, pad);
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const g = c.getContext("2d")!;
  g.fillStyle = "#fff"; g.fillRect(0, 0, w, h);
  let y = pad;
  for (const e of els) { g.drawImage(e, pad, y); y += e.naturalHeight + pad; }
  return new Promise((res) => c.toBlob((b) => res(b), "image/png"));
}

export async function questionClipboard(q: Question, profile?: string): Promise<{ text: string; html: string; png: Blob | null }> {
  const datas: string[] = [];
  const render = async (src: string): Promise<{ text: string; html: string }> => {
    const out: string[] = [], html: string[] = [];
    for (const p of splitImages(src)) {
      if ("text" in p) { out.push(p.text); html.push(esc(p.text).replace(/\n/g, "<br>")); continue; }
      const d = await pictureData(p.src, profile);
      if (d) { datas.push(d); out.push(`[picture: ${p.alt || "image"}]`); html.push(`<img src="${d}" alt="${esc(p.alt)}">`); }
      else { out.push(`[picture: ${p.alt || p.src}]`); html.push(esc(`[picture: ${p.alt || p.src}]`)); }
    }
    return { text: out.join(""), html: html.join("") };
  };
  const body = await render(q.text);
  const kind = q.type === "mcq" ? "MCQ" : q.type === "msq" ? "MSQ" : q.type === "nat" ? "NAT" : q.type === "code" ? "Code" : "Text answer";
  const head = `${q.id} · ${kind} · ${q.marks} mark${q.marks === 1 ? "" : "s"}`;
  let text = `${head}\n\n${body.text}`;
  let html = `<p><b>${esc(head)}</b></p><p>${body.html}</p>`;
  if (q.options?.length) {
    const opts = await Promise.all(q.options.map(render));
    text += "\n\n" + opts.map((o, i) => `${String.fromCharCode(65 + i)}. ${o.text}`).join("\n");
    html += "<ol type=\"A\">" + opts.map((o) => `<li>${o.html}</li>`).join("") + "</ol>";
  }
  return { text, html, png: await stackPng(datas) };
}

/** Copies a question. Returns true when something was put on the clipboard. */
export async function copyQuestion(q: Question, profile?: string): Promise<boolean> {
  const { text, html, png } = await questionClipboard(q, profile);
  try {
    if (typeof ClipboardItem !== "undefined" && navigator.clipboard.write) {
      const item: Record<string, Blob> = { "text/plain": new Blob([text], { type: "text/plain" }), "text/html": new Blob([html], { type: "text/html" }) };
      if (png) item["image/png"] = png;
      try { await navigator.clipboard.write([new ClipboardItem(item)]); return true; } catch { /* some browsers refuse a mix: fall back to text + html only */ }
      await navigator.clipboard.write([new ClipboardItem({ "text/plain": item["text/plain"], "text/html": item["text/html"] })]);
      return true;
    }
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
  }
}
