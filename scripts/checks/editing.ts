// check.ts section: editing. Run: bun run check
import { applyEdit, insertBlock, replaceWithBlock, toggleLines, wrap, type Edit } from "@/lib/editing";
import * as cIndent from "@/lib/codeIndent";
import { ok } from "@/scripts/checks/helpers";

console.log("editing");
{
  const run = (text: string, e: Edit) => ({
    out: applyEdit(text, e),
    sel: applyEdit(text, e).slice(e.selStart, e.selEnd),
  });
  let r = run("make this bold", wrap("make this bold", 5, 9, "**", "**", "bold text"));
  ok(r.out === "make **this** bold" && r.sel === "this", "wrap selection");
  r = run("make **this** bold", wrap("make **this** bold", 7, 11, "**", "**", "bold text"));
  ok(r.out === "make this bold" && r.sel === "this", "wrap again unwraps");
  r = run("ab", wrap("ab", 1, 1, "*", "*", "italic"));
  ok(r.out === "a*italic*b" && r.sel === "italic", "empty selection inserts a selected placeholder");
  r = run("one\ntwo", toggleLines("one\ntwo", 0, 7, "bullet"));
  ok(r.out === "- one\n- two", "bullet every selected line");
  r = run("- one\n- two", toggleLines("- one\n- two", 0, 11, "bullet"));
  ok(r.out === "one\ntwo", "bullet again removes");
  r = run("a\nb\nc", toggleLines("a\nb\nc", 0, 5, "numbered"));
  ok(r.out === "1. a\n2. b\n3. c", "numbered lines");
  r = run("x", toggleLines("x", 1, 1, "heading"));
  ok(r.out === "## x", "heading on the current line");
  r = run("text", insertBlock("text", 4, 4, "$$\n", "\n$$", "x^2"));
  ok(r.out === "text\n$$\nx^2\n$$" && r.sel === "x^2", "display maths goes on its own lines");
  ok(
    applyEdit("ab", replaceWithBlock("ab", 1, 1, "$$\nx\n$$")) === "a\n$$\nx\n$$\nb",
    "finished block lands on its own lines",
  );
  ok(
    applyEdit("a\nb", replaceWithBlock("a\nb", 2, 2, "---")) === "a\n---\nb",
    "no extra blank lines when already on a new line",
  );
}

console.log("code indentation");
{
  const run = (t: string, e: Edit | null) =>
    e ? { out: applyEdit(t, e), cur: e.selStart, sel: applyEdit(t, e).slice(e.selStart, e.selEnd) } : null;
  let t = "def f(x):";
  let r = run(t, cIndent.newline(t, t.length, t.length, "python"))!;
  ok(r.out === "def f(x):\n    " && r.cur === r.out.length, "python: Enter after : indents 4");
  t = "    x = 1";
  r = run(t, cIndent.newline(t, t.length, t.length, "python"))!;
  ok(r.out === "    x = 1\n    ", "Enter keeps the current indent");
  t = "if (a) {}";
  r = run(t, cIndent.newline(t, 8, 8, "c"))!;
  ok(r.out === "if (a) {\n    \n}" && r.cur === 13, "Enter between {} puts } on its own line");
  t = "a";
  r = run(t, cIndent.indent(t, 1, 1, "python", 1))!;
  ok(r.out === "a   " && r.cur === 4, "Tab goes to the next indent stop");
  t = "a\nb\n";
  r = run(t, cIndent.indent(t, 0, 4, "javascript", 1))!;
  ok(r.out === "  a\n  b\n", "Tab indents every selected line (not the line after a trailing newline)");
  t = "    a\n  b";
  r = run(t, cIndent.indent(t, 0, t.length, "python", -1))!;
  ok(r.out === "a\nb", "Shift+Tab outdents, never past the margin");
  t = "      ";
  r = run(t, cIndent.backspace(t, 6, 6, "python"))!;
  ok(r.out === "    ", "Backspace in leading spaces goes back to the previous stop");
  ok(cIndent.backspace("ab", 2, 2, "python") === null, "Backspace after text is normal");
  t = "{\n    ";
  r = run(t, cIndent.typeCloser(t, t.length, t.length, "}", "c"))!;
  ok(r.out === "{\n}", "typing } on a blank indented line outdents it");
  ok(
    JSON.stringify(cIndent.indentLevels("a:\n    b\n\n    c\nd", 4)) === "[0,1,1,1,0]",
    "indent levels, blank line inside a block keeps the guide",
  );
  ok(cIndent.leadingWidth("\t  x", 4) === 6, "a tab counts as one level");
}
