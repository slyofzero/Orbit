// check.ts section: markdown. Run: bun run check
import { parseInline, parseMarkdown } from "@/lib/markdown";
import { ok } from "@/scripts/checks/helpers";

console.log("markdown: inline");
{
  const j = (s: string) => JSON.stringify(parseInline(s));
  const J = (v: unknown) => JSON.stringify(v);
  ok(j("plain") === J([{ t: "text", v: "plain" }]), "plain text");
  ok(
    j("a $x^2$ b") ===
      J([
        { t: "text", v: "a " },
        { t: "math", v: "x^2", display: false },
        { t: "text", v: " b" },
      ]),
    "inline maths",
  );
  ok(j("$$\\int_0^1 x$$") === J([{ t: "math", v: "\\int_0^1 x", display: true }]), "display maths inline");
  ok(j("costs \\$5") === J([{ t: "text", v: "costs $5" }]), "escaped dollar");
  ok(j("one $ alone") === J([{ t: "text", v: "one $ alone" }]), "unclosed $ stays text");
  ok(j("$\\$x$") === J([{ t: "math", v: "\\$x", display: false }]), "escaped $ inside maths");
  ok(
    j("**b** *i* ++u++ ~~s~~") ===
      J([
        { t: "strong", c: [{ t: "text", v: "b" }] },
        { t: "text", v: " " },
        { t: "em", c: [{ t: "text", v: "i" }] },
        { t: "text", v: " " },
        { t: "u", c: [{ t: "text", v: "u" }] },
        { t: "text", v: " " },
        { t: "del", c: [{ t: "text", v: "s" }] },
      ]),
    "bold, italic, underline, strike",
  );
  ok(
    j("*a **b** c*") ===
      J([
        {
          t: "em",
          c: [
            { t: "text", v: "a " },
            { t: "strong", c: [{ t: "text", v: "b" }] },
            { t: "text", v: " c" },
          ],
        },
      ]),
    "bold nested in italic",
  );
  ok(j("2 * 3 * 4") === J([{ t: "text", v: "2 * 3 * 4" }]), "spaced asterisks stay text");
  ok(j("snake_case_name") === J([{ t: "text", v: "snake_case_name" }]), "underscores inside words stay text");
  ok(j("`a*b*c`") === J([{ t: "code", v: "a*b*c" }]), "code span is literal");
  ok(
    j("[site](https://x.org)") === J([{ t: "link", href: "https://x.org", c: [{ t: "text", v: "site" }] }]),
    "safe link",
  );
  ok(
    j("[bad](javascript:alert(1))").includes('"t":"text"') && !j("[bad](javascript:alert(1))").includes('"link"'),
    "unsafe link stays text",
  );
  ok(j("![g](img:h12ab)") === J([{ t: "img", src: "img:h12ab", alt: "g" }]), "image reference");
  ok(!j("![x](data:image/png;base64,AAA)").includes('"img"'), "base64 image refused");
  ok(j("<b>hi</b>") === J([{ t: "text", v: "<b>hi</b>" }]), "raw HTML stays text");
  ok(j("a\nb") === J([{ t: "text", v: "a" }, { t: "br" }, { t: "text", v: "b" }]), "line break");
  ok(
    j("Linear algebra (2026)") === J([{ t: "text", v: "Linear algebra (2026)" }]) && j("") === "[]",
    "plain text fast path",
  );
  ok(
    j("a\\*b") === J([{ t: "text", v: "a*b" }]) && j("x+y") === J([{ t: "text", v: "x+y" }]),
    "fast path still sees \\ and +",
  );
}

console.log("markdown: blocks");
{
  const kinds = (s: string) =>
    parseMarkdown(s)
      .map((b) => b.t)
      .join(",");
  ok(kinds("# Title\n\nText") === "h,p", "heading + paragraph");
  ok(kinds("- a\n- b\n\n1. x\n2. y") === "ul,ol", "bullet and numbered lists");
  ok(kinds("> quoted\n> more") === "quote", "quote");
  ok(kinds("```py\nx = 1\n```") === "code", "fenced code");
  ok(kinds("Evaluate:\n$$\n\\int x\\,dx\n$$\nDone") === "p,math,p", "multi-line display maths");
  ok(kinds("$$x^2$$") === "math", "one-line display maths");
  ok(kinds("---") === "hr", "divider");
  const ol = parseMarkdown("3. c\n4. d")[0];
  ok(ol.t === "ol" && ol.start === 3 && ol.items.length === 2, "numbered list keeps its start");
  const code = parseMarkdown("```\n**not bold**\n```")[0];
  ok(code.t === "code" && code.v === "**not bold**", "code block is literal");
}
