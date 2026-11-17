// A small, safe markdown + LaTeX parser. Produces a tree that components/ui/Rich.tsx renders
// as React elements: raw HTML in the text is never interpreted, so imported content can't inject markup.
//
// Inline:  **bold**  *italic* or _italic_  ++underline++  ~~strike~~  `code`
//          $inline maths$  $$display maths$$  [text](https://â¦)  ![alt](img:<hash> or https://â¦)
//          \x escapes a special character (e.g. \$ for a dollar sign, \* for an asterisk)
//          a single line break inside a paragraph is kept as a line break
// Blocks:  # / ## / ### headings Â· - or * bullet lists Â· 1. numbered lists Â· > quotes
//          ``` fenced code ``` Â· $$ display maths $$ (may span lines) Â· --- divider
// Links only allow https://, http://, mailto: and #anchors; pictures only img:<hash>, https:// and http://.

export type Inline =
  | { t: "text"; v: string }
  | { t: "br" }
  | { t: "strong" | "em" | "u" | "del"; c: Inline[] }
  | { t: "code"; v: string }
  | { t: "math"; v: string; display: boolean }
  | { t: "link"; href: string; c: Inline[] }
  | { t: "img"; src: string; alt: string };

export type Block =
  | { t: "p"; c: Inline[] }
  | { t: "h"; level: 1 | 2 | 3; c: Inline[] }
  | { t: "ul"; items: Inline[][] }
  | { t: "ol"; start: number; items: Inline[][] }
  | { t: "quote"; c: Block[] }
  | { t: "code"; lang: string; v: string }
  | { t: "math"; v: string }
  | { t: "hr" };

const ESCAPABLE = "\\`*_{}[]()#+-.!$~|<>";

/** A link address that is safe to open, or null. */
export function safeHref(url: string): string | null {
  const u = url.trim();
  return /^(https?:\/\/|mailto:)/i.test(u) || /^#[\w-]*$/.test(u) ? u : null;
}

/** A picture source that is allowed, or null. */
export function safeImageSrc(src: string): string | null {
  const s = src.trim();
  return /^img:[A-Za-z0-9_-]+$/.test(s) || /^https?:\/\/\S+$/i.test(s) ? s : null;
}

// ---------------------------------------------------------------------------
// inline

const isWordChar = (ch: string | undefined) => !!ch && /[\p{L}\p{N}]/u.test(ch);

/** Index of the closing `fence` for maths, skipping escaped characters; -1 if none. */
function findMathClose(src: string, from: number, fence: string): number {
  for (let j = from; j < src.length; j++) {
    if (src[j] === "\\") {
      j++;
      continue;
    }
    if (src.startsWith(fence, j)) return j;
  }
  return -1;
}

/** Index of the closing emphasis delimiter, skipping escapes and code spans; -1 if none.
 *  A single `*` never closes on a `**`. */
function findDelimClose(src: string, from: number, d: string): number {
  for (let j = from; j < src.length; j++) {
    const ch = src[j];
    if (ch === "\\") {
      j++;
      continue;
    }
    if (ch === "`") {
      const end = src.indexOf("`", j + 1);
      if (end > j) {
        j = end;
        continue;
      }
    }
    if (d === "*" && src.startsWith("**", j)) {
      j++;
      continue;
    }
    if (src.startsWith(d, j)) return j;
  }
  return -1;
}

/** Matches `[text](url)` starting at a `[`. Brackets in the text may nest. */
function matchBracketLink(src: string, open: number): { text: string; url: string; end: number } | null {
  let depth = 0;
  for (let j = open; j < src.length; j++) {
    const ch = src[j];
    if (ch === "\\") {
      j++;
      continue;
    }
    if (ch === "[") depth++;
    else if (ch === "]" && --depth === 0) {
      if (src[j + 1] !== "(") return null;
      const close = src.indexOf(")", j + 2);
      if (close === -1) return null;
      return { text: src.slice(open + 1, j), url: src.slice(j + 2, close), end: close + 1 };
    }
  }
  return null;
}

const EMPHASIS: [string, "strong" | "u" | "del" | "em"][] = [
  ["**", "strong"],
  ["++", "u"],
  ["~~", "del"],
  ["*", "em"],
  ["_", "em"],
];

export function parseInline(src: string): Inline[] {
  // fast path: no character that could start formatting, maths, a link or a line break → plain text
  if (!/[\\`*_$[!~+\n]/.test(src)) return src ? [{ t: "text", v: src }] : [];
  const out: Inline[] = [];
  let buf = "";
  const push = (n: Inline) => {
    if (buf) out.push({ t: "text", v: buf });
    buf = "";
    out.push(n);
  };

  let i = 0;
  outer: while (i < src.length) {
    const c = src[i];

    if (c === "\\" && i + 1 < src.length && ESCAPABLE.includes(src[i + 1])) {
      buf += src[i + 1];
      i += 2;
      continue;
    }
    if (c === "\n") {
      push({ t: "br" });
      i++;
      continue;
    }

    if (c === "`") {
      const end = src.indexOf("`", i + 1);
      if (end > i + 1) {
        push({ t: "code", v: src.slice(i + 1, end) });
        i = end + 1;
        continue;
      }
    }

    if (c === "$") {
      const display = src[i + 1] === "$";
      const fence = display ? "$$" : "$";
      const start = i + fence.length;
      const end = findMathClose(src, start, fence);
      if (end > start) {
        push({ t: "math", v: src.slice(start, end), display });
        i = end + fence.length;
        continue;
      }
      buf += fence;
      i = start;
      continue;
    }

    if (c === "!" && src[i + 1] === "[") {
      const m = matchBracketLink(src, i + 1);
      const s = m && safeImageSrc(m.url);
      if (m && s) {
        push({ t: "img", src: s, alt: m.text });
        i = m.end;
        continue;
      }
    }

    if (c === "[") {
      const m = matchBracketLink(src, i);
      const h = m && safeHref(m.url);
      if (m && h) {
        push({ t: "link", href: h, c: parseInline(m.text) });
        i = m.end;
        continue;
      }
    }

    for (const [d, t] of EMPHASIS) {
      if (!src.startsWith(d, i)) continue;
      if (d === "_" && isWordChar(src[i - 1])) break; // snake_case stays text
      const start = i + d.length;
      const end = findDelimClose(src, start, d);
      if (end <= start) break;
      const inner = src.slice(start, end);
      if (/^\s|\s$/.test(inner)) break; // "2 * 3 * 4" stays text
      if (d === "_" && isWordChar(src[end + 1])) break;
      push({ t, c: parseInline(inner) });
      i = end + d.length;
      continue outer;
    }

    buf += c;
    i++;
  }
  if (buf) out.push({ t: "text", v: buf });
  return out;
}

// ---------------------------------------------------------------------------
// blocks

const RE = {
  fence: /^```\s*([\w+#.-]*)\s*$/,
  heading: /^(#{1,3})\s+(.+)$/,
  hr: /^(-{3,}|\*{3,}|_{3,})$/,
  ul: /^\s*[-*+]\s+(.*)$/,
  ol: /^\s*(\d{1,9})[.)]\s+(.*)$/,
};

function startsBlock(line: string): boolean {
  const t = line.trim();
  return (
    RE.fence.test(t) ||
    t.startsWith("$$") ||
    RE.heading.test(t) ||
    RE.hr.test(t) ||
    t.startsWith(">") ||
    RE.ul.test(line) ||
    RE.ol.test(line)
  );
}

function parseBlocks(lines: string[]): Block[] {
  const out: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const t = line.trim();
    if (t === "") {
      i++;
      continue;
    }

    const fence = RE.fence.exec(t);
    if (fence) {
      const body: string[] = [];
      i++;
      while (i < lines.length && lines[i].trim() !== "```") body.push(lines[i++]);
      i++; // closing ``` (or end of text)
      out.push({ t: "code", lang: fence[1], v: body.join("\n") });
      continue;
    }

    if (t.startsWith("$$")) {
      const after = t.slice(2);
      const close = after.indexOf("$$");
      if (close >= 0) {
        if (after.slice(close + 2).trim() === "" && after.slice(0, close).trim()) {
          out.push({ t: "math", v: after.slice(0, close).trim() });
          i++;
          continue;
        }
      } else {
        const body = [after];
        let j = i + 1;
        let closed = false;
        while (j < lines.length) {
          const k = lines[j].indexOf("$$");
          if (k >= 0) {
            body.push(lines[j].slice(0, k));
            closed = lines[j].slice(k + 2).trim() === "";
            j++;
            break;
          }
          body.push(lines[j++]);
        }
        const v = body.join("\n").trim();
        if (closed && v) {
          out.push({ t: "math", v });
          i = j;
          continue;
        }
      }
      // not a clean maths block: falls through to a paragraph
    }

    const h = RE.heading.exec(t);
    if (h) {
      out.push({ t: "h", level: h[1].length as 1 | 2 | 3, c: parseInline(h[2]) });
      i++;
      continue;
    }

    if (RE.hr.test(t)) {
      out.push({ t: "hr" });
      i++;
      continue;
    }

    if (t.startsWith(">")) {
      const inner: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith(">")) inner.push(lines[i++].replace(/^\s*>\s?/, ""));
      out.push({ t: "quote", c: parseBlocks(inner) });
      continue;
    }

    if (RE.ul.test(line)) {
      const items: Inline[][] = [];
      let m: RegExpExecArray | null;
      while (i < lines.length && (m = RE.ul.exec(lines[i]))) {
        items.push(parseInline(m[1]));
        i++;
      }
      out.push({ t: "ul", items });
      continue;
    }

    const ol = RE.ol.exec(line);
    if (ol) {
      const items: Inline[][] = [];
      let m: RegExpExecArray | null;
      while (i < lines.length && (m = RE.ol.exec(lines[i]))) {
        items.push(parseInline(m[2]));
        i++;
      }
      out.push({ t: "ol", start: Number(ol[1]), items });
      continue;
    }

    // paragraph: this line, plus following lines until a blank line or another block starts
    const para = [line];
    i++;
    while (i < lines.length && lines[i].trim() !== "" && !startsBlock(lines[i])) para.push(lines[i++]);
    out.push({ t: "p", c: parseInline(para.map((l) => l.trim()).join("\n")) });
  }
  return out;
}

export function parseMarkdown(src: string): Block[] {
  return parseBlocks(src.replace(/\r\n?/g, "\n").split("\n"));
}
