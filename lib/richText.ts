import { segments, Seg } from "./tex";

// Question text can carry a small, safe set of formatting tags next to the usual $maths$ and ```code```:
//   <b>bold</b>  <i>italic</i>  <u>underline</u>  <a href="https://…">link</a>  <ul><li>bullets</li></ul>  <ol><li>numbered</li></ol>
// Nothing else is treated as markup, so a plain "x < y" or "a <b" in older questions stays exactly as written.

export type Tag = "b" | "i" | "u" | "a" | "ul" | "ol" | "li";
export type RNode = { t: "seg"; seg: Seg } | { t: "el"; tag: Tag; href?: string; kids: RNode[] };

const TAG = /<(\/?)(b|strong|i|em|u|a|ul|ol|li)(?:\s+href="([^"]*)")?\s*>/gi;
const NORMAL: Record<string, Tag> = { b: "b", strong: "b", i: "i", em: "i", u: "u", a: "a", ul: "ul", ol: "ol", li: "li" };
const BLOCK_TAGS = /\n?(<\/?(?:ul|ol|li)\b[^>]*>)\n?/gi;

/** Only web and mail links are kept. Anything else (javascript:, data:) is dropped. */
export const safeHref = (h: string | undefined): string | undefined => (h && /^(https?:\/\/|mailto:)/i.test(h.trim()) ? h.trim() : undefined);

/** Text → a tree of formatting elements and ordinary segments (text, maths, code). Unclosed tags close at the end; stray closing tags are ignored. */
export function parseRich(text: string): RNode[] {
  const root: RNode[] = [];
  const stack: { tag: Tag; kids: RNode[] }[] = [];
  const cur = () => (stack.length ? stack[stack.length - 1].kids : root);
  for (const seg of segments(text)) {
    if (seg.kind !== "text") { cur().push({ t: "seg", seg }); continue; }
    const v = seg.value.replace(BLOCK_TAGS, "$1");
    let last = 0;
    for (const m of v.matchAll(TAG)) {
      if (m.index! > last) cur().push({ t: "seg", seg: { kind: "text", value: v.slice(last, m.index) } });
      last = m.index! + m[0].length;
      const tag = NORMAL[m[2].toLowerCase()];
      if (m[1]) {
        const at = stack.map((s) => s.tag).lastIndexOf(tag);
        if (at >= 0) {
          while (stack.length > at + 1) closeTop(stack, root);
          closeTop(stack, root);
        }
      } else {
        const el: RNode = { t: "el", tag, href: tag === "a" ? safeHref(m[3]) : undefined, kids: [] };
        cur().push(el);
        stack.push({ tag, kids: el.kids });
      }
    }
    if (last < v.length) cur().push({ t: "seg", seg: { kind: "text", value: v.slice(last) } });
  }
  return root;
}
function closeTop(stack: { tag: Tag; kids: RNode[] }[], _root: RNode[]) { stack.pop(); }

/** Whether the text uses any formatting tag. */
export const hasMarkup = (text: string): boolean => new RegExp(TAG.source, "i").test(text);

/** Text without the formatting tags, for previews, search and plain copies. Lists become "• " and "1. " lines. */
export function plainText(text: string): string {
  if (!hasMarkup(text)) return text;
  let out = "";
  const lists: { ordered: boolean; n: number }[] = [];
  let last = 0;
  const t = text.replace(BLOCK_TAGS, "$1");
  for (const m of t.matchAll(TAG)) {
    out += t.slice(last, m.index);
    last = m.index! + m[0].length;
    const tag = NORMAL[m[2].toLowerCase()], close = !!m[1];
    if (tag === "ul" || tag === "ol") { if (close) { lists.pop(); out += "\n"; } else { lists.push({ ordered: tag === "ol", n: 0 }); if (out && !out.endsWith("\n")) out += "\n"; } }
    else if (tag === "li" && !close) {
      const l = lists[lists.length - 1];
      if (out && !out.endsWith("\n")) out += "\n";
      out += l?.ordered ? `${++l.n}. ` : "• ";
    }
  }
  return (out + t.slice(last)).replace(/&lt;/g, "<");
}

/* ---------- the editor side: text <-> the editor's HTML ---------- */

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Stored text → HTML for the contenteditable box. */
export function toEditorHtml(text: string): string {
  const t = text.replace(BLOCK_TAGS, "$1");
  let out = "", last = 0;
  const plain = (s: string) => esc(s.replace(/&lt;/g, "<")).replace(/\n/g, "<br>");
  for (const m of t.matchAll(TAG)) {
    out += plain(t.slice(last, m.index));
    last = m.index! + m[0].length;
    const tag = NORMAL[m[2].toLowerCase()];
    if (m[1]) out += `</${tag}>`;
    else { const h = tag === "a" ? safeHref(m[3]) : undefined; out += h ? `<a href="${esc(h).replace(/"/g, "&quot;")}">` : `<${tag}>`; }
  }
  return out + plain(t.slice(last));
}

/** The editor's DOM → stored text. */
export function fromEditorDom(root: HTMLElement): string {
  const lit = (s: string) => s.replace(/\u00a0/g, " ").replace(/<(\/?(?:b|strong|i|em|u|a|ul|ol|li)\b)/gi, "&lt;$1");
  const kids = (el: Node): string => {
    let out = "";
    const list = Array.from(el.childNodes);
    list.forEach((c, k) => {
      const isBlock = c.nodeType === 1 && /^(div|p)$/i.test((c as HTMLElement).tagName);
      const x = walk(c);
      if (isBlock) {
        if (out && !out.endsWith("\n")) out += "\n";
        out += x;
        if (k < list.length - 1 && !out.endsWith("\n")) out += "\n";
      } else out += x;
    });
    return out;
  };
  const walk = (n: Node): string => {
    if (n.nodeType === 3) return lit(n.nodeValue ?? "");
    if (n.nodeType !== 1) return "";
    const el = n as HTMLElement, name = el.tagName.toLowerCase();
    switch (name) {
      case "br": return "\n";
      case "b": case "strong": { const x = kids(el); return x ? `<b>${x}</b>` : ""; }
      case "i": case "em": { const x = kids(el); return x ? `<i>${x}</i>` : ""; }
      case "u": { const x = kids(el); return x ? `<u>${x}</u>` : ""; }
      case "a": { const h = safeHref(el.getAttribute("href") ?? undefined); const x = kids(el); return h ? `<a href="${h.replace(/"/g, "&quot;")}">${x}</a>` : x; }
      case "ul": case "ol": return `<${name}>${kids(el)}</${name}>`;
      case "li": return `<li>${kids(el).replace(/\n+$/, "")}</li>`;
      default: return kids(el);
    }
  };
  return kids(root).replace(/\n+$/, "");
}
