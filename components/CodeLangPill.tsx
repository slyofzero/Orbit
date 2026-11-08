import { LANGUAGE_LABEL, type CodeLanguage } from "@/lib/codeLanguages";
export default function CodeLangPill({ language }: { language: string }) {
  return <span className="pill">{LANGUAGE_LABEL[language as CodeLanguage] ?? language}</span>;
}
