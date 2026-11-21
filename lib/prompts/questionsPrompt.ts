// The prompt the user pastes into any AI chat to get a question file Orbit can import. "pack" (used by every
// Practice tab's empty screen and first on Manage pack → Upload) asks for the whole pack: practice questions,
// programming questions and mock tests in one file, with an empty list for a part the user doesn't want. The
// per-tab kinds (Upload's other buttons) ask for one part only. It is a product feature (AGENTS.md rule 9): it must describe lib/questionFile.ts exactly,
// and scripts/checks/questionFile.ts checks that each example passes the importer. Change both together.
// Nothing here may assume a particular exam: Orbit works for any goal.

import { FILE_SCHEMA } from "@/lib/importFix";
import { DIFFICULTIES, LIMITS, PACK_FORMAT, PACK_VERSION } from "@/lib/questionFile";
import type { PracticeTab } from "@/lib/practice";

type Example = Record<string, unknown>;
/** Which prompt: the whole pack, or one Practice tab's part of it. */
export type PromptKind = PracticeTab | "pack";

const mcq: Example = {
  id: "la-1",
  subject: "Linear Algebra",
  topic: "Eigenvalues",
  type: "mcq",
  difficulty: "easy",
  marks: 1,
  negative_marks: 0.33,
  text: "The eigenvalues of $\\begin{pmatrix}2 & 0\\\\ 0 & 5\\end{pmatrix}$ are:",
  options: ["$2$ and $5$", "$0$ and $7$", "$10$ only", "$2$ only"],
  answer: "A",
  explanation: "A diagonal matrix has its diagonal entries as eigenvalues.",
  tags: ["conceptual"],
};
const msq: Example = {
  id: "la-2",
  subject: "Linear Algebra",
  topic: "Vectors",
  type: "msq",
  difficulty: "medium",
  marks: 2,
  text: "Which pairs of vectors are **orthogonal**?",
  options: ["$(1,0)$ and $(0,1)$", "$(1,1)$ and $(1,-1)$", "$(2,1)$ and $(1,2)$"],
  answer: ["A", "B"],
  explanation: "Orthogonal means the dot product is $0$.",
};
const nat: Example = {
  id: "pr-1",
  subject: "Probability",
  topic: "Counting",
  type: "nat",
  difficulty: "easy",
  marks: 1,
  text: "In how many ways can 3 people be chosen from 7?",
  answer: 35,
  tolerance: 0,
  explanation: "$\\binom{7}{3} = 35$.",
};
const str: Example = {
  id: "pr-2",
  subject: "Probability",
  topic: "Random variables",
  type: "str",
  difficulty: "medium",
  marks: 1,
  text: "List the possible values of a Bernoulli random variable (comma-separated).",
  answer: "0,1",
  match: "set",
  explanation: "It takes $0$ or $1$.",
};
const code: Example = {
  id: "cs-1",
  subject: "Programming",
  topic: "Loops",
  type: "code",
  difficulty: "easy",
  marks: 2,
  text: "Read $n$, then $n$ numbers on the next line. Print their sum. (Python)",
  starter: "n = int(input())\nnums = list(map(int, input().split()))\n# your code here\n",
  explanation: "```python\nprint(sum(nums))\n```",
};
const mockQ: Example = {
  id: "m1-1",
  subject: "Linear Algebra",
  topic: "Eigenvalues",
  type: "mcq",
  pool: "mock",
  difficulty: "medium",
  marks: 1,
  negative_marks: 0.33,
  text: "The trace of $\\begin{pmatrix}1&2\\\\3&4\\end{pmatrix}$ is:",
  options: ["$5$", "$4$", "$-2$", "$10$"],
  answer: "A",
  explanation: "$1 + 4 = 5$.",
};
const mockQ2: Example = {
  ...nat,
  id: "m1-2",
  pool: "mock",
  text: "A $5\\times5$ matrix has nullity 2. What is its rank?",
  answer: 3,
};

const mock: Example = {
  name: "Maths mock 1",
  minutes: 30,
  instructions: "Eight questions. **Negative marking** applies to multiple-choice questions.",
  full_screen: false,
  sections: [
    { name: "Linear algebra", minutes: null, questions: ["m1-1"] },
    { name: "Counting", minutes: 10, questions: ["m1-2"] },
  ],
};

/** A small, valid example file for a prompt, so the AI sees the exact shape. */
export function exampleQuestions(kind: PromptKind): Record<string, unknown> {
  const head = { format: PACK_FORMAT, version: PACK_VERSION };
  if (kind === "pack")
    return { ...head, name: "Maths pack", questions: [mcq, msq, nat, str, code, mockQ, mockQ2], mocks: [mock] };
  if (kind === "programming") return { ...head, name: "Programming practice", questions: [code] };
  if (kind === "mocks") return { ...head, name: "Maths mock 1", questions: [mockQ, mockQ2], mocks: [mock] };
  return { ...head, name: "Maths practice", questions: [mcq, msq, nat, str] };
}

const WHAT: Record<PromptKind, { want: string; ask: string; extra: string }> = {
  pack: {
    want: "a whole question pack (practice questions by subject and topic, programming questions and mock tests, all in one file)",
    ask: `2. PRACTICE: which subject(s) and topics, how many questions per topic, and the mix of ${DIFFICULTIES.join(" / ")}. The kinds are "mcq" (one correct choice), "msq" (several correct choices), "nat" (a number) and "str" (a short text answer); mix them unless I say otherwise.
3. PROGRAMMING and MOCK TESTS: whether I want each. For programming: the language, the topics, how many problems and how hard, and whether I want starter code. For mock tests: how many papers, their sections, the marks per question, the negative marking and the time limit, and whether to copy a real paper's style.`,
    extra: `The pack has three parts. Write every part I asked for; a part I don't want stays empty:
- Practice: questions with "type" "mcq", "msq", "nat" or "str" and no "pool" (they appear in topic practice).
- Programming: questions with "type": "code". Put the language in the "text" (e.g. "(Python)"), and the model solution, in a fenced code block, with a short explanation in "explanation". There is no "answer" for code questions. If I want no programming questions, write none.
- Mock tests: every question of a paper goes in "questions" with "pool": "mock" (used only inside the mock, not in topic practice), and the paper goes in "mocks", listing its questions by "id" in its "sections". Each question is in exactly one section. If I want no mock tests, write "mocks": [] and no "pool": "mock" questions.`,
  },
  topics: {
    want: "practice questions, grouped by subject and topic",
    ask: `2. Which subject(s) and topics, how many questions per topic, and the mix of ${DIFFICULTIES.join(" / ")}.
3. Which kinds I want: "mcq" (one correct choice), "msq" (several correct choices), "nat" (a number) and "str" (a short text answer). Mix them unless I say otherwise.`,
    extra: `Don't write "code" questions here: they go in a separate file.`,
  },
  programming: {
    want: "programming questions where I write code in an editor and then mark my own answer",
    ask: `2. The language, the topics and how many problems I want, and how hard.
3. Whether I want starter code (the code the editor opens with).`,
    extra: `Every question has "type": "code". Put the language in the "text" (e.g. "(Python)"). Put the model solution, in a fenced code block, and a short explanation in "explanation". There is no "answer" for code questions.`,
  },
  mocks: {
    want: "a full mock test (a timed paper) with its sections and every question in it",
    ask: `2. The exam, its sections (with marks per question and the negative marking) and the total time.
3. Whether it should copy a real paper's style (number of questions, mix of "mcq", "msq" and "nat").`,
    extra: `Put every question of the paper in "questions" with "pool": "mock" (they are used only inside the mock, not in topic practice), then list them by "id" in the mock's "sections". Each question is in exactly one section.`,
  },
};

/** The full prompt text: the whole pack, or one Practice tab's part. */
export function questionsPrompt(kind: PromptKind): string {
  const w = WHAT[kind];
  return `You are helping me write ${w.want} for an app called Orbit. Orbit imports them from a JSON file you write.

STEP 1: ASK ME FIRST. Before writing anything, ask me (in one short list):
1. What I'm studying and what level or exam it is for.
${w.ask}
4. Anything else that matters (the syllabus, topics to skip, a source to follow).
Wait for my answers. If I want more questions than fit in one reply, write them in parts and ask me to say "continue"; each part is its own complete file.

STEP 2: WRITE THE FILE. Reply with ONLY the JSON (no explanation before or after), so I can save it as a .json file.

The schema (the // notes explain each field; leave them out of the JSON):
${FILE_SCHEMA.questions}

How to fill it in:
- Use the same spelling of "subject" and "topic" every time, so questions group together.
- "explanation": a worked explanation of the answer (strongly recommended).
- "answer": "A" is the first option, "B" the second… For "code" there is no "answer"; the "explanation" holds the model solution.
- "match" for "str": "exact" = the text as is; "list" = comma-separated items in order; "set" = the same items in any order.
- A section's "minutes" may be null to share the test's clock.
${w.extra}

Rules:
- At most ${LIMITS.questions} questions in one file.
- Text may use Markdown (**bold**, *italic*, \`code\`) and LaTeX between dollar signs ($x^2$). In JSON every backslash must be doubled: write "$\\\\frac{a}{b}$", not "$\\frac{a}{b}$".
- Make sure each answer is really correct, and that every "mcq" has exactly one right option.
- Valid JSON only: double quotes, no comments, no trailing commas.

A small example of a valid file:
${JSON.stringify(exampleQuestions(kind), null, 2)}
`;
}
