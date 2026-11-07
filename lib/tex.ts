// Maths in questions is written as LaTeX and drawn with KaTeX (see components/Rich.tsx).
// Shared by the renderer and by the pack checker, so what passes upload is exactly what renders.
import katex from "katex";

export type Seg = { kind: "text" | "inline" | "display" | "code" | "icode"; value: string };

/** Splits a ```fenced block into its language label and its code. */
export function parseFence(value: string): { lang: string; code: string } {
  const m = /^```([^\n`]*)\n?([\s\S]*?)\n?```$/.exec(value);
  return m ? { lang: m[1].trim(), code: m[2] } : { lang: "", code: value.replace(/^```|```$/g, "") };
}

const ICODE = /(`[^`\n]+`)/g; // `inline code`: shown as typed, never read as maths

const DOLLAR = ""; // stands in for an escaped \$ while we look for math
const MATH = /(\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\\\([\s\S]+?\\\)|\$[^$\n]+?\$)/g;

const TICK_LINE = /^(\s*)`([^`]+)`\s*$/;
/** Program text written as one `backtick` line after another is a code block that lost its fence: join it into one plain block (no colours, no boxes per line). */
export function mergeTickLines(text: string): string {
  const lines = text.split("\n");
  const out: string[] = [];
  for (let i = 0; i < lines.length; ) {
    let j = i;
    while (j < lines.length && TICK_LINE.test(lines[j])) j++;
    if (j - i >= 2) {
      out.push("```", ...lines.slice(i, j).map((l) => { const m = TICK_LINE.exec(l)!; return m[1] + m[2]; }), "```");
      i = j;
    } else { out.push(lines[i]); i++; }
  }
  return out.join("\n");
}

/** Splits text into plain text, $inline$, $$display$$ and ```code``` pieces. A literal dollar sign is written \$. */
export function segments(text: string, keepEscapes = false): Seg[] {
  const out: Seg[] = [];
  for (const chunk of mergeTickLines(text).replace(/\\\$/g, DOLLAR).split(/(```[\s\S]*?```)/g)) {
    if (!chunk) continue;
    if (chunk.startsWith("```")) { out.push({ kind: "code", value: chunk.replaceAll(DOLLAR, "$") }); continue; }
    for (const piece of chunk.split(ICODE)) {
      if (!piece) continue;
      if (piece.length > 2 && piece.startsWith("`") && piece.endsWith("`")) { out.push({ kind: "icode", value: piece.slice(1, -1).replaceAll(DOLLAR, "$") }); continue; }
    for (const p of piece.split(MATH)) {
      if (!p) continue;
      if (p.startsWith("$$")) out.push({ kind: "display", value: p.slice(2, -2).replaceAll(DOLLAR, "\\$") });
      else if (p.startsWith("\\[")) out.push({ kind: "display", value: p.slice(2, -2).replaceAll(DOLLAR, "\\$") });
      else if (p.startsWith("\\(")) out.push({ kind: "inline", value: p.slice(2, -2).replaceAll(DOLLAR, "\\$") });
      else if (p.startsWith("$")) out.push({ kind: "inline", value: p.slice(1, -1).replaceAll(DOLLAR, "\\$") });
      else out.push({ kind: "text", value: keepEscapes ? p : p.replaceAll(DOLLAR, "$") });
    }
    }
  }
  return out;
}

export function renderMath(src: string, display: boolean): string {
  return katex.renderToString(src, { displayMode: display, throwOnError: false });
}

// JSON turns "\frac" into a form feed and "\times" into a tab. Put the backslash back when a control character sits right before a letter.
const CONTROL: [RegExp, string][] = [[/\x07(?=[a-zA-Z])/g, "\\a"], [/\x08(?=[a-zA-Z])/g, "\\b"], [/\t(?=[a-zA-Z])/g, "\\t"], [/\x0b(?=[a-zA-Z])/g, "\\v"], [/\x0c(?=[a-zA-Z])/g, "\\f"], [/\r(?=[a-zA-Z])/g, "\\r"]];
export function repairBackslashes(s: string): { text: string; fixed: number } {
  let fixed = 0;
  for (const [re, rep] of CONTROL) s = s.replace(re, () => { fixed++; return rep; });
  return { text: s, fixed };
}

const HINT = "In JSON every LaTeX backslash must be written twice, e.g. \"$\\\\frac{1}{2}$\".";

/** Plain-language problems with the maths in one piece of text (empty list = fine). */
export function texProblems(text: string): string[] {
  const bad: string[] = [];
  if ((text.match(/```/g) ?? []).length % 2 === 1) bad.push("has a code block that is never closed. A block starts with ``` and ends with ``` (three backticks each).");
  for (const s of segments(text, true)) {
    if (s.kind === "text" && s.value.includes("$")) { bad.push(`has a "$" without a partner. Maths goes between two dollar signs; write a real dollar sign as \\$. ${HINT}`); break; }
    if (s.kind === "inline" || s.kind === "display") {
      try { katex.renderToString(s.value, { displayMode: s.kind === "display", throwOnError: true, strict: "ignore" }); }
      catch (e) { bad.push(`has maths that will not draw: ${(e as Error).message.replace(/^KaTeX parse error: /, "").split("\n")[0]}. ${HINT}`); break; }
    }
  }
  return bad;
}
