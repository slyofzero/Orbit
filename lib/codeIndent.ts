// Indentation rules for the code editor. Each function returns ONE Edit (see lib/editing.ts) that the
// editor applies as a single undoable change, or null when it should not act.

import type { Edit } from "./editing";

export type CodeLang = "python" | "c" | "cpp" | "java" | "javascript" | "sql" | "text";

/** Spaces per indent level. */
export const INDENT: Record<CodeLang, number> = { python: 4, c: 4, cpp: 4, java: 4, javascript: 2, sql: 2, text: 2 };

/** Does a line ending like this open a new block (so the next line gets one more level)? */
export function opensBlock(lang: CodeLang, lineBeforeCursor: string): boolean {
  const t = lineBeforeCursor.trimEnd();
  if (lang === "python") return t.endsWith(":");
  if (lang === "text") return false;
  if (lang === "sql") return t.endsWith("(");
  return /[{([]$/.test(t);
}

const lineStartOf = (text: string, pos: number) => text.lastIndexOf("\n", pos - 1) + 1;
const lineEndOf = (text: string, pos: number) => { const n = text.indexOf("\n", pos); return n === -1 ? text.length : n; };

/** Width of a line's leading whitespace, a tab counting as one indent level. */
export function leadingWidth(line: string, size: number): number {
  let w = 0;
  for (const ch of line) {
    if (ch === " ") w++;
    else if (ch === "\t") w += size - (w % size);
    else break;
  }
  return w;
}

/** Indent level of every line, for drawing guides. A blank line takes the smaller level of the
 *  non-blank lines around it, so guides run through gaps inside a block but not past its end. */
export function indentLevels(text: string, size: number): number[] {
  const lines = text.split("\n");
  const raw = lines.map((l) => (l.trim() === "" ? -1 : Math.floor(leadingWidth(l, size) / size)));
  return raw.map((lv, i) => {
    if (lv >= 0) return lv;
    let prev = -1, next = -1;
    for (let j = i - 1; j >= 0; j--) if (raw[j] >= 0) { prev = raw[j]; break; }
    for (let j = i + 1; j < raw.length; j++) if (raw[j] >= 0) { next = raw[j]; break; }
    return prev < 0 || next < 0 ? 0 : Math.min(prev, next);
  });
}

/** Enter: new line with the same indent, one level more after a block opener.
 *  Between a pair like {|} the closer moves to its own line, back at the outer indent. */
export function newline(text: string, start: number, end: number, lang: CodeLang): Edit {
  const size = INDENT[lang];
  const before = text.slice(lineStartOf(text, start), start);
  const indent = /^[ \t]*/.exec(before)![0];
  const deeper = opensBlock(lang, before) ? " ".repeat(size) : "";
  const closer = text[end];
  const pairs: Record<string, string> = { "{": "}", "(": ")", "[": "]" };
  const opener = before.trimEnd().slice(-1);
  if (deeper && pairs[opener] && closer === pairs[opener]) {
    const insert = "\n" + indent + deeper + "\n" + indent;
    const cursor = start + 1 + indent.length + deeper.length;
    return { from: start, to: end, insert, selStart: cursor, selEnd: cursor };
  }
  const insert = "\n" + indent + deeper;
  return { from: start, to: end, insert, selStart: start + insert.length, selEnd: start + insert.length };
}

/** Tab / Shift+Tab. With no selection, Tab inserts spaces to the next indent stop and Shift+Tab
 *  outdents the line. With a selection, every selected line moves one level. */
export function indent(text: string, start: number, end: number, lang: CodeLang, dir: 1 | -1): Edit {
  const size = INDENT[lang];
  const ls = lineStartOf(text, start);
  if (dir === 1 && start === end) {
    const n = size - ((start - ls) % size);
    const pad = " ".repeat(n);
    return { from: start, to: end, insert: pad, selStart: start + n, selEnd: start + n };
  }
  const stop = end > start && text[end - 1] === "\n" ? end - 1 : end;   // a selection ending at a line start excludes that line
  const le = lineEndOf(text, stop);
  const lines = text.slice(ls, le).split("\n");
  let firstShift = 0;
  const out = lines.map((l, i) => {
    let next: string;
    if (dir === 1) next = l.trim() === "" ? l : " ".repeat(size) + l;
    else if (l.startsWith("\t")) next = l.slice(1);
    else next = l.slice(Math.min(size, /^ */.exec(l)![0].length));
    if (i === 0) firstShift = next.length - l.length;
    return next;
  }).join("\n");
  if (start === end) {
    const cursor = Math.max(ls, start + firstShift);
    return { from: ls, to: le, insert: out, selStart: cursor, selEnd: cursor };
  }
  return { from: ls, to: le, insert: out, selStart: ls, selEnd: ls + out.length };
}

/** Backspace inside leading spaces removes back to the previous indent stop; otherwise null. */
export function backspace(text: string, start: number, end: number, lang: CodeLang): Edit | null {
  if (start !== end) return null;
  const ls = lineStartOf(text, start);
  const before = text.slice(ls, start);
  if (before.length === 0 || !/^ +$/.test(before)) return null;
  const n = ((before.length - 1) % INDENT[lang]) + 1;
  return { from: start - n, to: start, insert: "", selStart: start - n, selEnd: start - n };
}

/** Typing a closer (} ) ]) on a line that is only spaces so far outdents it one level; otherwise null. */
export function typeCloser(text: string, start: number, end: number, ch: string, lang: CodeLang): Edit | null {
  if (start !== end || !"})]".includes(ch) || lang === "python" || lang === "text") return null;
  const size = INDENT[lang];
  const ls = lineStartOf(text, start);
  const before = text.slice(ls, start);
  if (!/^ +$/.test(before) || before.length < size) return null;
  const insert = " ".repeat(before.length - size) + ch;
  return { from: ls, to: start, insert, selStart: ls + insert.length, selEnd: ls + insert.length };
}
