// A "question pack" is what makes Practice and Mocks work: the topics, the questions, and the mock-test recipes.
// Nothing is built in. Upload a pack (JSON) on the Practice page and the app uses it. Pure functions, tested by scripts/check.ts.
import { Question, Topic, TopicStatus } from "./types";
import { repairBackslashes, texProblems } from "./tex";

export interface MockPick { subject: string; one: number; two: number; topics?: string[] }
export interface MockSection { name: string; picks: MockPick[] }
export interface MockTemplate { id: string; name: string; minutes: number; note?: string; sections: MockSection[] }

export interface PackData {
  name: string;
  subjects: Record<string, string>; // subject id -> display name, in display order
  topics: Topic[];
  questions: Question[];
  mocks: MockTemplate[];
  useBuiltinGenerators: boolean; // only the GATE DA pack sets this: asks for endless fresh numeric questions made by code
}

export const EMPTY_PACK: PackData = { name: "No question pack yet", subjects: {}, topics: [], questions: [], mocks: [], useBuiltinGenerators: false };

export interface PackResult { pack: PackData | null; errors: string[]; warnings: string[] }
const MAX_ERRORS = 12;
const ID = /^[A-Za-z0-9_.-]{1,48}$/;
const STATUSES: TopicStatus[] = ["know", "shaky", "noidea"];

export function parsePack(input: unknown): PackResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const err = (m: string) => { if (errors.length < MAX_ERRORS) errors.push(m); else if (errors.length === MAX_ERRORS) errors.push("…and more. Fix these first."); };
  const fail = (): PackResult => ({ pack: null, errors, warnings });
  const isObj = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);

  if (!isObj(input)) { err('The file must be one JSON object, like { "name": …, "topics": […], "questions": […] }.'); return fail(); }
  const name = typeof input.name === "string" && input.name.trim() ? input.name.trim().slice(0, 60) : "My question pack";

  // ----- topics -----
  if (!Array.isArray(input.topics) || input.topics.length === 0) { err('"topics" must be a list with at least one topic.'); return fail(); }
  const topics: Topic[] = [];
  const subjectNames: Record<string, string> = isObj(input.subjects) ? Object.fromEntries(Object.entries(input.subjects).filter(([, v]) => typeof v === "string").map(([k, v]) => [k, (v as string).slice(0, 60)])) : {};
  input.topics.forEach((t, i) => {
    const w = `topics[${i}]`;
    if (!isObj(t)) { err(`${w} must be an object.`); return; }
    if (typeof t.id !== "string" || !ID.test(t.id)) { err(`${w}.id must be a short id using letters, digits, - or _.`); return; }
    if (topics.some((x) => x.id === t.id)) { err(`${w}.id "${t.id}" is used twice.`); return; }
    if (typeof t.name !== "string" || !t.name.trim()) { err(`${w} needs a "name".`); return; }
    if (typeof t.subject !== "string" || !ID.test(t.subject)) { err(`${w}.subject must be a short id like "maths".`); return; }
    const status = (t.status ?? "know") as TopicStatus;
    if (!STATUSES.includes(status)) { err(`${w}.status must be one of: ${STATUSES.join(", ")}.`); return; }
    topics.push({ id: t.id, name: t.name.trim().slice(0, 120), subject: t.subject, status });
  });

  const subjects: Record<string, string> = {};
  for (const t of topics) subjects[t.subject] ??= subjectNames[t.subject] ?? t.subject.charAt(0).toUpperCase() + t.subject.slice(1);
  const topicIds = new Set(topics.map((t) => t.id));

  // ----- questions -----
  if (!Array.isArray(input.questions)) { err('"questions" must be a list.'); return fail(); }
  if (input.questions.length > 6000) { err("A pack can hold at most 6000 questions."); return fail(); }
  const questions: Question[] = [];
  const seen = new Set<string>();
  const counters: Record<string, number> = {};
  let fixedTotal = 0;
  input.questions.forEach((raw, i) => {
    const w = `questions[${i}]`;
    if (!isObj(raw)) { err(`${w} must be an object.`); return; }
    if (typeof raw.topic !== "string" || !topicIds.has(raw.topic)) { err(`${w}.topic "${String(raw.topic)}" is not one of your topic ids.`); return; }
    const type = raw.type;
    if (type !== "mcq" && type !== "msq" && type !== "nat") { err(`${w}.type must be "mcq", "msq" or "nat".`); return; }
    if (raw.marks !== 1 && raw.marks !== 2) { err(`${w}.marks must be 1 or 2.`); return; }
    if (typeof raw.text !== "string" || !raw.text.trim()) { err(`${w} needs the question "text".`); return; }
    let id: string;
    if (raw.id !== undefined) {
      if (typeof raw.id !== "string" || !ID.test(raw.id)) { err(`${w}.id must be a short id using letters, digits, - or _.`); return; }
      id = raw.id;
    } else { counters[raw.topic] = (counters[raw.topic] ?? 0) + 1; id = `${raw.topic}-${counters[raw.topic]}`; while (seen.has(id)) { counters[raw.topic]++; id = `${raw.topic}-${counters[raw.topic]}`; } }
    if (seen.has(id)) { err(`${w}.id "${id}" is used twice.`); return; }
    // maths: repair single backslashes that JSON turned into control characters, then make sure every formula draws
    let fixedBackslashes = 0;
    const tex = (v: string) => { const r = repairBackslashes(v); fixedBackslashes += r.fixed; return r.text; };
    const text = tex(raw.text);
    const options = Array.isArray(raw.options) ? raw.options.map((o) => (typeof o === "string" ? tex(o) : o)) : raw.options;
    const explanation = typeof raw.explanation === "string" ? tex(raw.explanation) : "";
    if (fixedBackslashes) fixedTotal += fixedBackslashes;
    const parts: [string, string][] = [["text", text], ["explanation", explanation], ...((Array.isArray(options) ? options : []) as string[]).map((o, k): [string, string] => [`options[${k}]`, o])];
    for (const [where, value] of parts) {
      const problem = typeof value === "string" ? texProblems(value)[0] : undefined;
      if (problem) { err(`${w}.${where} ${problem}`); return; }
    }
    // mandatory tags: the topic (checked above) and its subject; optional tags: anything the author or their AI adds
    const subject = topics.find((t) => t.id === raw.topic)!.subject;
    if (raw.subject !== undefined && raw.subject !== subject) { err(`${w}.subject "${String(raw.subject)}" does not match topic "${raw.topic}", which belongs to subject "${subject}". Leave "subject" out or fix it.`); return; }
    let tags: string[] | undefined;
    if (raw.tags !== undefined) {
      if (!Array.isArray(raw.tags) || raw.tags.some((t) => typeof t !== "string")) { err(`${w}.tags must be a list of short words, like ["formula", "hard"].`); return; }
      tags = [...new Set((raw.tags as string[]).map((t) => t.trim().toLowerCase().replace(/\s+/g, "-").slice(0, 28)).filter(Boolean))].slice(0, 8);
      if (!tags.length) tags = undefined;
    }
    const tagged = { subject, ...(tags ? { tags } : {}) };
    let q: Question;
    if (type === "nat") {
      let value: number, tol: number;
      if (typeof raw.answer === "number") { value = raw.answer; tol = typeof raw.tolerance === "number" ? raw.tolerance : 0.01; }
      else if (isObj(raw.answer) && typeof raw.answer.value === "number" && typeof raw.answer.tol === "number") { value = raw.answer.value; tol = raw.answer.tol; }
      else { err(`${w}.answer for a "nat" question must be a number (add "tolerance" for the allowed error).`); return; }
      if (!isFinite(value) || !isFinite(tol) || tol < 0) { err(`${w}: answer and tolerance must be finite numbers.`); return; }
      q = { id, topic: raw.topic, type, marks: raw.marks, text, answer: { value, tol }, explanation, ...tagged };
    } else {
      if (!Array.isArray(options) || options.length < 2 || options.length > 8 || options.some((o) => typeof o !== "string")) { err(`${w}.options must be a list of 2 to 8 texts.`); return; }
      const n = options.length;
      if (type === "mcq") {
        if (!Number.isInteger(raw.answer) || (raw.answer as number) < 0 || (raw.answer as number) >= n) { err(`${w}.answer for "mcq" must be the number of the right option, counting from 0 (0 to ${n - 1}).`); return; }
      } else if (!Array.isArray(raw.answer) || raw.answer.length === 0 || raw.answer.some((a) => !Number.isInteger(a) || a < 0 || a >= n) || new Set(raw.answer).size !== raw.answer.length) {
        err(`${w}.answer for "msq" must be a list of the right option numbers, counting from 0 (0 to ${n - 1}).`); return;
      }
      q = { id, topic: raw.topic, type, marks: raw.marks, text, options: options as string[], answer: raw.answer as number | number[], explanation, ...tagged };
    }
    seen.add(id);
    questions.push(q);
  });
  if (fixedTotal) warnings.push(`Fixed ${fixedTotal} LaTeX backslash${fixedTotal === 1 ? "" : "es"} that JSON had turned into tabs or other invisible characters. Next time write every LaTeX backslash twice (\\\\frac).`);

  // ----- mock recipes (optional) -----
  const mocks: MockTemplate[] = [];
  if (input.mocks !== undefined) {
    if (!Array.isArray(input.mocks)) err('"mocks" must be a list.');
    else input.mocks.forEach((m, i) => {
      const w = `mocks[${i}]`;
      if (!isObj(m)) { err(`${w} must be an object.`); return; }
      if (typeof m.id !== "string" || !ID.test(m.id) || mocks.some((x) => x.id === m.id)) { err(`${w}.id must be a short, unique id.`); return; }
      if (typeof m.name !== "string" || !m.name.trim()) { err(`${w} needs a "name".`); return; }
      if (typeof m.minutes !== "number" || !(m.minutes >= 5 && m.minutes <= 600)) { err(`${w}.minutes must be a number from 5 to 600.`); return; }
      if (!Array.isArray(m.sections) || m.sections.length === 0) { err(`${w}.sections must be a list with at least one section.`); return; }
      const sections: MockSection[] = [];
      for (const [j, s] of (m.sections as unknown[]).entries()) {
        const ws = `${w}.sections[${j}]`;
        if (!isObj(s) || typeof s.name !== "string" || !s.name.trim()) { err(`${ws} needs a "name".`); return; }
        if (!Array.isArray(s.picks) || s.picks.length === 0) { err(`${ws}.picks must be a list like [{ "subject": "maths", "one": 4, "two": 3 }].`); return; }
        const picks: MockPick[] = [];
        for (const [k, p] of (s.picks as unknown[]).entries()) {
          const wp = `${ws}.picks[${k}]`;
          if (!isObj(p) || typeof p.subject !== "string" || !subjects[p.subject]) { err(`${wp}.subject must be one of your subjects: ${Object.keys(subjects).join(", ")}.`); return; }
          const one = p.one ?? 0, two = p.two ?? 0;
          if (!Number.isInteger(one) || !Number.isInteger(two) || (one as number) < 0 || (two as number) < 0 || (one as number) + (two as number) > 80) { err(`${wp}: "one" and "two" must be whole numbers (how many 1-mark and 2-mark questions).`); return; }
          let only: string[] | undefined;
          if (p.topics !== undefined) {
            if (!Array.isArray(p.topics) || p.topics.some((t) => typeof t !== "string" || !topicIds.has(t))) { err(`${wp}.topics must list your topic ids.`); return; }
            only = p.topics as string[];
          }
          picks.push({ subject: p.subject, one: one as number, two: two as number, topics: only });
        }
        sections.push({ name: s.name.trim().slice(0, 60), picks });
      }
      mocks.push({ id: m.id, name: m.name.trim().slice(0, 60), minutes: Math.round(m.minutes), note: typeof m.note === "string" ? m.note.slice(0, 200) : undefined, sections });
    });
  }

  if (errors.length) return fail();
  if (questions.length === 0) warnings.push("The pack has no questions yet, so Practice and Mocks will be empty until you add some.");
  const noQ = topics.filter((t) => !questions.some((q) => q.topic === t.id)).length;
  if (noQ && questions.length) warnings.push(`${noQ} topic${noQ === 1 ? " has" : "s have"} no questions.`);
  if (!mocks.length && questions.length) warnings.push('No "mocks" recipes, so Mocks offers only a quick mixed test, subject tests and a weak-topics test.');

  return { pack: { name, subjects, topics, questions, mocks, useBuiltinGenerators: input.useBuiltinGenerators === true }, errors, warnings };
}

// The reverse of parsePack: the pack as a JSON object you can upload again (used to export a pack before replacing it).
export function packToJson(pack: PackData) {
  return {
    name: pack.name,
    ...(pack.useBuiltinGenerators ? { useBuiltinGenerators: true } : {}),
    subjects: pack.subjects,
    topics: pack.topics.map(({ id, subject, name, status }) => ({ id, subject, name, status })),
    questions: pack.questions.map((q) => ({ id: q.id, subject: q.subject ?? pack.topics.find((t) => t.id === q.topic)?.subject, topic: q.topic, ...(q.tags?.length ? { tags: q.tags } : {}), type: q.type, marks: q.marks, text: q.text, ...(q.options ? { options: q.options } : {}), answer: q.answer, explanation: q.explanation })),
    mocks: pack.mocks,
  };
}

// ---------- help for people writing a pack ----------
export const packTemplateJson = (): string => JSON.stringify({
  name: "My question pack",
  subjects: { maths: "Mathematics", sci: "Science" },
  topics: [
    { id: "algebra", subject: "maths", name: "Algebra", status: "shaky" },
    { id: "motion", subject: "sci", name: "Motion and forces", status: "know" },
  ],
  questions: [
    { subject: "maths", topic: "algebra", tags: ["linear-equation", "easy"], type: "mcq", marks: 1, text: "If $2x + 3 = 11$, what is $x$?", options: ["$2$", "$3$", "$4$", "$5$"], answer: 2, explanation: "Subtract 3, then divide by 2: $x = \\frac{8}{2} = 4$." },
    { subject: "maths", topic: "algebra", tags: ["factorising", "roots"], type: "msq", marks: 2, text: "Which of these are roots of $x^2 - 5x + 6 = 0$?", options: ["$1$", "$2$", "$3$", "$6$"], answer: [1, 2], explanation: "It factors as $(x-2)(x-3)$, so $x \\in \\{2, 3\\}$." },
    { subject: "maths", topic: "algebra", tags: ["series", "calculation"], type: "nat", marks: 2, text: "Evaluate the sum:\n$$\\sum_{k=1}^{4} k^2$$", answer: 30, tolerance: 0, explanation: "$1 + 4 + 9 + 16 = 30$." },
    { subject: "sci", topic: "motion", tags: ["units", "formula"], type: "nat", marks: 1, text: "A car moves at $20\\ \\text{m/s}$ for $5\\ \\text{s}$. How many metres does it cover?", answer: 100, tolerance: 0.5, explanation: "$d = v \\times t = 100\\ \\text{m}$." },
  ],
  mocks: [
    { id: "full", name: "Full test", minutes: 60, note: "Optional line shown on the card", sections: [{ name: "Mathematics", picks: [{ subject: "maths", one: 5, two: 3 }] }, { name: "Science", picks: [{ subject: "sci", one: 5, two: 3 }] }] },
  ],
}, null, 2);

const FENCE = "```";
export const packPrompt = (): string => String.raw`Write a question pack for me and reply with ONLY one JSON object (no explanation, no markdown fence).

About me (fill this in before sending):
- Subject / exam: 
- Topics to cover (and which ones I find hard): 
- How many questions per topic: 
- Test format I want for mock tests (sections, number of questions, minutes): 

Use exactly this format:
- "name": short pack name.
- "subjects": { "subjectId": "Display name" } (ids are short, lowercase, no spaces).
- "topics": list of { "id", "subject", "name", "status" } where status is "know", "shaky" or "noidea".
- "questions": list of questions. Every question has "subject" (a subject id), "topic" (a topic id that belongs to that subject), "type", "marks" (1 or 2), "text", and "explanation". "subject" and "topic" are mandatory tags: the app uses them to show statistics per subject and per topic.
  - "tags": optional list of 1 to 5 short lowercase words that describe the question beyond its topic. Choose useful ones, for example the skill ("formula", "calculation", "conceptual", "trap", "proof"), the difficulty ("easy", "medium", "hard"), or the specific idea ("eigenvalues", "bayes-rule"). The app shows accuracy per tag, so reuse the same tag spelling across questions.
  - "mcq": exactly one correct option. Add "options" (2 to 8 texts) and "answer" = number of the right option, counting from 0.
  - "msq": one or more correct options. Add "options" and "answer" = list of right option numbers, counting from 0.
  - "nat": the answer is a number typed in. Add "answer" = the number and "tolerance" = allowed error.
- "mocks": optional list of mock-test recipes: { "id", "name", "minutes", "sections": [ { "name", "picks": [ { "subject": "subjectId", "one": 5, "two": 3 } ] } ] } where "one" and "two" are how many 1-mark and 2-mark questions to draw from that subject.
- Make sure every answer is actually correct and the numbers in each explanation add up.

HOW TO WRITE MATHS (LaTeX). The app draws every question, option and explanation with KaTeX, so write ALL maths as LaTeX:
1. Put inline maths between single dollar signs: $x^2 + 1$. Put big or important equations on their own line between double dollar signs: $$\int_0^1 x^2\,dx = \frac{1}{3}$$
2. Use LaTeX for every variable, number with a formula, symbol and unit expression: write $x$, not x. This applies to "text", every item in "options", and "explanation". The "answer" of a nat question stays a plain number.
3. JSON RULE (the most common mistake): inside the JSON every LaTeX backslash must be written TWICE.
   Right: "text": "Simplify $\\frac{a}{b} \\times \\sqrt{x}$"   Wrong: "text": "Simplify $\frac{a}{b} \times \sqrt{x}$"
   Single backslashes break: \n \t \f \b \r \v become new lines, tabs and invisible characters, which ruins \neq, \times, \frac, \beta, \rho, \vec and more.
4. A new line in the text is written \n (one backslash, a real JSON new line), not \\n. Use it between paragraphs or steps.
5. A real dollar sign (money) is written \\$, for example "costs \\$5". Never leave a lone $ in the text.
6. Do not use \( \) or \[ \], and do not use packages, \begin{align} or \begin{equation}. Use $$ ... $$ and, for several lines, \begin{aligned} ... \end{aligned} inside $$.
7. Code goes in a fenced block inside the text: "Output of:\n${FENCE}python\nprint(2 + 3)\n${FENCE}"
8. Keep each formula short enough to read on a phone. Break long derivations into several $ $ pieces or an aligned block.

Common LaTeX (write each backslash twice in the JSON):
- Fractions and roots: \\frac{a}{b}, \\dfrac{a}{b}, \\sqrt{x}, \\sqrt[3]{x}, \\binom{n}{k}
- Powers and indices: x^{2}, x_{i}, x_{i}^{2}, e^{-x}
- Sums, limits, calculus: \\sum_{i=1}^{n}, \\prod, \\int_a^b f(x)\\,dx, \\lim_{x \\to 0}, \\frac{d}{dx}, \\frac{\\partial f}{\\partial x}, \\nabla
- Greek: \\alpha \\beta \\gamma \\delta \\epsilon \\theta \\lambda \\mu \\pi \\rho \\sigma \\phi \\omega \\Delta \\Sigma \\Omega
- Relations and operators: \\leq \\geq \\neq \\approx \\equiv \\times \\cdot \\div \\pm \\infty \\propto
- Logic and sets: \\in \\notin \\subseteq \\cup \\cap \\emptyset \\forall \\exists \\land \\lor \\neg \\Rightarrow \\iff \\mathbb{R} \\mathbb{N} \\mathbb{Z}
- Functions and text: \\sin \\cos \\tan \\log \\ln \\exp \\max \\min \\arg\\max, \\text{words inside maths}, \\mathrm{d}
- Vectors and matrices: \\vec{v}, \\mathbf{A}, \\hat{x}, \\bar{x}, A^{T}, A^{-1}, \\begin{bmatrix} a & b \\\\ c & d \\end{bmatrix}, \\left( \\frac{a}{b} \\right)
- Probability and statistics: P(A \\mid B), \\mathbb{E}[X], \\mathrm{Var}(X), \\sim, \\mathcal{N}(\\mu, \\sigma^2)
- Spacing and dots: \\, (thin space), \\ (space), \\quad, \\ldots, \\cdots

Here is a valid example to copy the shape from (note the doubled backslashes):
${packTemplateJson()}`;
