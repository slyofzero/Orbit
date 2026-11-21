// The prompt the user pastes into any AI chat to get a question file Orbit can import (Practice → Topics,
// Programming, Mocks). It is a product feature (AGENTS.md rule 9): it must describe lib/questionFile.ts exactly,
// and scripts/checks/questionFile.ts checks that each example passes the importer. Change both together.
// Nothing here may assume a particular exam: Orbit works for any goal.

import { DIFFICULTIES, LIMITS, PACK_FORMAT, PACK_VERSION, QUESTION_TYPES, STR_MATCHES } from "@/lib/questionFile";
import type { PracticeTab } from "@/lib/practice";

type Example = Record<string, unknown>;

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

/** A small, valid example file for a tab, so the AI sees the exact shape. */
export function exampleQuestions(kind: PracticeTab): Record<string, unknown> {
  const head = { format: PACK_FORMAT, version: PACK_VERSION };
  if (kind === "programming") return { ...head, name: "Programming practice", questions: [code] };
  if (kind === "mocks")
    return {
      ...head,
      name: "Maths mock 1",
      questions: [mockQ, mockQ2],
      mocks: [
        {
          name: "Maths mock 1",
          minutes: 30,
          instructions: "Eight questions. **Negative marking** applies to multiple-choice questions.",
          full_screen: false,
          sections: [
            { name: "Linear algebra", minutes: null, questions: ["m1-1"] },
            { name: "Counting", minutes: 10, questions: ["m1-2"] },
          ],
        },
      ],
    };
  return { ...head, name: "Maths practice", questions: [mcq, msq, nat, str] };
}

const WHAT: Record<PracticeTab, { want: string; ask: string; extra: string }> = {
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

/** The full prompt text for one Practice tab. */
export function questionsPrompt(kind: PracticeTab): string {
  const w = WHAT[kind];
  return `You are helping me write ${w.want} for an app called Orbit. Orbit imports them from a JSON file you write.

STEP 1: ASK ME FIRST. Before writing anything, ask me (in one short list):
1. What I'm studying and what level or exam it is for.
${w.ask}
4. Anything else that matters (the syllabus, topics to skip, a source to follow).
Wait for my answers. If I want more questions than fit in one reply, write them in parts and ask me to say "continue"; each part is its own complete file.

STEP 2: WRITE THE FILE. Reply with ONLY the JSON (no explanation before or after), so I can save it as a .json file.

The format:
{
  "format": "${PACK_FORMAT}",
  "version": ${PACK_VERSION},
  "name": "short name for this set (at most ${LIMITS.name} characters)",
  "questions": [ … ],
  "mocks": [ … ]   (only for a full mock test; leave it out otherwise)
}

Each question has these fields:
- "id" (optional): a short label, like "la-1". Only needed when a mock lists the question. Each id is used once.
- "subject" and "topic" (required): e.g. "Linear Algebra" and "Eigenvalues". Use the same spelling every time, so questions group together.
- "type" (required): ${QUESTION_TYPES.map((t) => `"${t}"`).join(", ")}.
- "text" (required): the question, at most ${LIMITS.text} characters.
- "difficulty": ${DIFFICULTIES.map((d) => `"${d}"`).join(", ")} (default "medium").
- "marks": a number above 0 (default 1). "negative_marks": 0 or more, the marks lost for a wrong answer (default 0).
- "explanation": a worked explanation of the answer (strongly recommended).
- "tags": up to ${LIMITS.tags} short labels, e.g. ["conceptual", "formula"] (optional).
- "pool": "practice" (default) or "mock" (only used inside a mock test).

The answer depends on the type:
- "mcq": "options": ${LIMITS.minOptions} to ${LIMITS.maxOptions} texts, and "answer": ONE letter, "A" for the first option, "B" for the second…
- "msq": the same "options", and "answer": a list of letters, e.g. ["A", "C"] (at least one).
- "nat": "answer": a number (not text), and "tolerance": how far off a right answer may be (default 0 = exact).
- "str": "answer": the accepted text, or a list of accepted texts (any one is right). "match": ${STR_MATCHES.map((m) => `"${m}"`).join(", ")} (default "exact"; "list" = comma-separated items in order; "set" = the same items in any order). "case_sensitive": true or false (default false).
- "code": no "answer". Optional "starter": the code the editor opens with. The "explanation" holds the model solution.
${w.extra}

Mocks (only if I asked for a mock test): "mocks": [ { "name": "…", "minutes": the whole test's time limit as a whole number, "instructions": "shown before the test (optional)", "full_screen": false, "sections": [ { "name": "…", "minutes": a time limit for this section only, or null to share the test's clock, "questions": ["id", …] } ] } ]. Every id must be a question in "questions"; a question is in at most one section of a mock.

Rules:
- At most ${LIMITS.questions} questions in one file.
- Text may use Markdown (**bold**, *italic*, \`code\`) and LaTeX between dollar signs ($x^2$). In JSON every backslash must be doubled: write "$\\\\frac{a}{b}$", not "$\\frac{a}{b}$".
- Make sure each answer is really correct, and that every "mcq" has exactly one right option.
- Valid JSON only: double quotes, no comments, no trailing commas.

A small example of a valid file:
${JSON.stringify(exampleQuestions(kind), null, 2)}
`;
}
