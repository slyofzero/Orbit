// Text edits behind the editor toolbar. Each function takes the text and the current selection
// and returns ONE replacement (from..to → insert) plus where the selection should land afterwards.
// The editor applies it as a single undoable change.

export type Edit = { from: number; to: number; insert: string; selStart: number; selEnd: number };

/** Wraps the selection in `before`…`after` (e.g. ** for bold). If it is already wrapped, unwraps it.
 *  With nothing selected, inserts `placeholder` wrapped and selects it so typing replaces it. */
export function wrap(
  text: string,
  start: number,
  end: number,
  before: string,
  after: string,
  placeholder: string,
): Edit {
  const selected = text.slice(start, end);
  const isWrapped =
    start !== end &&
    text.slice(start - before.length, start) === before &&
    text.slice(end, end + after.length) === after;
  if (isWrapped) {
    const from = start - before.length;
    return { from, to: end + after.length, insert: selected, selStart: from, selEnd: from + selected.length };
  }
  const inner = selected || placeholder;
  return {
    from: start,
    to: end,
    insert: before + inner + after,
    selStart: start + before.length,
    selEnd: start + before.length + inner.length,
  };
}

const LINE_PREFIX = {
  bullet: { pattern: /^[-*+] /, make: () => "- " },
  numbered: { pattern: /^\d+[.)] /, make: (i: number) => `${i + 1}. ` },
  quote: { pattern: /^> ?/, make: () => "> " },
  heading: { pattern: /^#{1,3} /, make: () => "## " },
} as const;

export type LineKind = keyof typeof LINE_PREFIX;

/** Adds a line prefix (bullet, number, quote, heading) to every selected line,
 *  or removes it if every selected line already has it. */
export function toggleLines(text: string, start: number, end: number, kind: LineKind): Edit {
  const { pattern, make } = LINE_PREFIX[kind];
  const lineStart = text.lastIndexOf("\n", start - 1) + 1;
  const stop = end > start && text[end - 1] === "\n" ? end - 1 : end;
  const nl = text.indexOf("\n", stop);
  const lineEnd = nl === -1 ? text.length : nl;
  const lines = text.slice(lineStart, lineEnd).split("\n");
  const all = lines.every((l) => pattern.test(l));
  const next = lines.map((l, i) => (all ? l.replace(pattern, "") : make(i) + l.replace(pattern, ""))).join("\n");
  return { from: lineStart, to: lineEnd, insert: next, selStart: lineStart, selEnd: lineStart + next.length };
}

/** Inserts a multi-line block (code block, display maths) on its own lines around the selection. */
export function insertBlock(
  text: string,
  start: number,
  end: number,
  before: string,
  after: string,
  placeholder: string,
): Edit {
  const inner = text.slice(start, end) || placeholder;
  const pre = start > 0 && text[start - 1] !== "\n" ? "\n" : "";
  const post = end < text.length && text[end] !== "\n" ? "\n" : "";
  const insert = pre + before + inner + after + post;
  const selStart = start + pre.length + before.length;
  return { from: start, to: end, insert, selStart, selEnd: selStart + inner.length };
}

/** Replaces the selection with a finished block (e.g. "$$\nx^2\n$$") on its own lines; cursor goes after it. */
export function replaceWithBlock(text: string, start: number, end: number, block: string): Edit {
  const pre = start > 0 && text[start - 1] !== "\n" ? "\n" : "";
  const post = end < text.length && text[end] !== "\n" ? "\n" : "";
  const insert = pre + block + post;
  return { from: start, to: end, insert, selStart: start + insert.length, selEnd: start + insert.length };
}

/** Replaces the selection with `s` and puts the cursor after it. */
export function replaceSelection(start: number, end: number, s: string): Edit {
  return { from: start, to: end, insert: s, selStart: start + s.length, selEnd: start + s.length };
}

/** Applies an edit to a string (used when the browser can't apply it natively, and in tests). */
export function applyEdit(text: string, e: Edit): string {
  return text.slice(0, e.from) + e.insert + text.slice(e.to);
}
