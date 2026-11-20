// Syntax highlighting for the code editor (highlight.js core + only the languages Orbit offers,
// so the bundle stays small). Output is HTML with every character of the code escaped.

import hljs from "highlight.js/lib/core";
import python from "highlight.js/lib/languages/python";
import c from "highlight.js/lib/languages/c";
import cpp from "highlight.js/lib/languages/cpp";
import java from "highlight.js/lib/languages/java";
import javascript from "highlight.js/lib/languages/javascript";
import sql from "highlight.js/lib/languages/sql";
import type { CodeLang } from "@/lib/codeIndent";

hljs.registerLanguage("python", python);
hljs.registerLanguage("c", c);
hljs.registerLanguage("cpp", cpp);
hljs.registerLanguage("java", java);
hljs.registerLanguage("javascript", javascript);
hljs.registerLanguage("sql", sql);

const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function highlight(code: string, lang: CodeLang): string {
  if (lang === "text") return escape(code);
  return hljs.highlight(code, { language: lang, ignoreIllegals: true }).value;
}
