// The text a learner pastes into an AI so it builds the files, folders or database a programming question needs.
import { LANGUAGE_LABEL, type CodeLanguage } from "./codeLanguages";
import type { Question } from "./types";

const plain = (s: string) => s.replace(/!\[[^\]\n]*\]\([^)\s]+\)/g, "[picture omitted]");
const fence = "```";

export function setupPrompt(q: Question): string {
  const c = q.code!;
  const lang = LANGUAGE_LABEL[c.language as CodeLanguage] ?? c.language;
  const tests = c.tests.map((t, i) => `Test ${i + 1}${t.hidden ? " (hidden)" : ""}\nINPUT:\n${t.input || "(no input)"}\nEXPECTED OUTPUT:\n${t.output}`).join("\n\n");
  return `I am practising a programming question and it needs some data to exist on my computer first. Please write the setup for me.

THE QUESTION (${lang}, id ${q.id})
${plain(q.text)}

WHAT MUST EXIST BEFORE THE PROGRAM RUNS
${c.setup ?? "(nothing was specified)"}

THE TESTS MY PROGRAM IS CHECKED AGAINST (it reads standard input and prints standard output; it runs INSIDE the practice folder, so it uses relative paths)
${tests}
${c.solution ? `\nA REFERENCE SOLUTION (${lang})\n${fence}${c.language}\n${c.solution}\n${fence}\n` : ""}
WHAT I NEED FROM YOU
1. ONE setup script in Python 3 using only the standard library (so it runs on Windows, macOS and Linux). Name it setup_${q.id.replace(/[^A-Za-z0-9_-]/g, "_")}.py.
2. When run, it creates a folder named orbit-practice-${q.id.replace(/[^A-Za-z0-9_-]/g, "_")} inside the folder where I run it, deletes and rebuilds that folder if it already exists, and fills it with EXACTLY the data described above: the same names, contents, tables and rows. No randomness, no current dates, no extra files. If the description is a rule, follow the rule literally.
3. At the end it prints the FULL path of the folder on one line, because I will paste that path into Orbit.
4. Check your work: go through each test above and confirm, by reasoning${c.solution ? " with the reference solution" : ""}, that a correct program run inside that folder prints the expected output. If the data and the expected outputs disagree, change the DATA (never the tests) until they agree, and tell me what you changed.
5. Reply with the script in one code block, then at most 4 short lines telling me how to run it on Windows (PowerShell or Git Bash).

Do not solve the question for me. Only build the environment.`;
}
