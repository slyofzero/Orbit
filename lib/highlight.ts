// Colours code for questions: ```python ... ``` blocks. Only the languages a GATE paper uses are loaded, to keep the app small.
import hljs from "highlight.js/lib/core";
import python from "highlight.js/lib/languages/python";
import sql from "highlight.js/lib/languages/sql";
import c from "highlight.js/lib/languages/c";
import cpp from "highlight.js/lib/languages/cpp";
import java from "highlight.js/lib/languages/java";
import javascript from "highlight.js/lib/languages/javascript";
import typescript from "highlight.js/lib/languages/typescript";
import bash from "highlight.js/lib/languages/bash";
import json from "highlight.js/lib/languages/json";
import r from "highlight.js/lib/languages/r";
import xml from "highlight.js/lib/languages/xml";

hljs.registerLanguage("python", python);
hljs.registerLanguage("sql", sql);
hljs.registerLanguage("c", c);
hljs.registerLanguage("cpp", cpp);
hljs.registerLanguage("java", java);
hljs.registerLanguage("javascript", javascript);
hljs.registerLanguage("typescript", typescript);
hljs.registerLanguage("bash", bash);
hljs.registerLanguage("json", json);
hljs.registerLanguage("r", r);
hljs.registerLanguage("xml", xml);

const ALIAS: Record<string, string> = { py: "python", python3: "python", "c++": "cpp", js: "javascript", ts: "typescript", sh: "bash", shell: "bash", html: "xml", pseudocode: "python", pseudo: "python" };
export const LANGUAGES = ["python", "sql", "c", "cpp", "java", "javascript", "typescript", "bash", "json", "r", "html"] as const;

export const languageOf = (label: string): string | null => {
  const l = label.trim().toLowerCase();
  const name = ALIAS[l] ?? l;
  return hljs.getLanguage(name) ? name : null;
};

/** Safe HTML (highlight.js escapes the code) or null when the language is unknown or missing. */
export function highlightCode(code: string, label: string): string | null {
  const lang = languageOf(label);
  if (!lang) return null;
  try { return hljs.highlight(code, { language: lang, ignoreIllegals: true }).value; } catch { return null; }
}
