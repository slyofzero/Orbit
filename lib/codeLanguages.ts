// The languages a programming question can use. Shared by the pack checker, the editor and the runner.
export const CODE_LANGUAGES = ["python", "c", "cpp", "java", "javascript"] as const;
export type CodeLanguage = (typeof CODE_LANGUAGES)[number];
const ALIAS: Record<string, CodeLanguage> = { py: "python", python3: "python", "c++": "cpp", js: "javascript", node: "javascript" };
export const languageName = (s: string): CodeLanguage | null => {
  const l = s.trim().toLowerCase();
  const n = ALIAS[l] ?? l;
  return (CODE_LANGUAGES as readonly string[]).includes(n) ? (n as CodeLanguage) : null;
};
export const LANGUAGE_LABEL: Record<CodeLanguage, string> = { python: "Python", c: "C", cpp: "C++", java: "Java", javascript: "JavaScript" };
