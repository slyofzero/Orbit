// "Copy prompt" in the question editor: a ready-to-paste prompt for any AI that cleans up ONE question (OCR artifacts, broken LaTeX, missing pieces)
// and hands back each field in its own copy-able box, ready to paste into the matching box of the editor.
import type { QType } from "./types";

const TICK = "`";
const FENCE = "```";
const OUT = "````"; // four backticks, so a code block INSIDE a field can never close the box early

export interface EditPromptInput {
  type: QType;
  text: string;
  options: string[];        // mcq and msq
  picked?: number[];        // mcq and msq: indexes of the right options
  explanation: string;
  nat?: { value: string; tol: string };
  str?: { answers: string; match: string; caseSensitive: boolean };
  code?: { language: string; starter: string; solution: string; setup: string; tests: string };
}

const PIC = /!\[([^\]\n]*)\]\((img:[^)\s]+|https?:\/\/[^)\s]+)\)/g;

/** Every picture the question uses, in reading order (question, options, explanation), each once. Stored pictures (img:...) can be attached to a chat; web links are just links. */
export function pictureList(q: EditPromptInput): { ref: string; alt: string; where: string; stored: boolean }[] {
  const seen = new Set<string>(), out: { ref: string; alt: string; where: string; stored: boolean }[] = [];
  const fields: [string, string][] = [["QUESTION", q.text], ...((q.type === "mcq" || q.type === "msq" ? q.options : []).map((o, i): [string, string] => [`OPTION ${String.fromCharCode(65 + i)}`, o])), ["EXPLANATION", q.explanation]];
  for (const [where, t] of fields) for (const m of t.matchAll(PIC)) if (!seen.has(m[2])) { seen.add(m[2]); out.push({ ref: m[2], alt: m[1], where, stored: m[2].startsWith("img:") }); }
  return out;
}

const letter = (i: number) => String.fromCharCode(65 + i);
const val = (s: string) => (s.trim() ? s.trim() : "(empty)");

/** The boxes the AI must send back, in order, with what goes in each. */
export function editBoxes(q: EditPromptInput): { name: string; what: string }[] {
  const boxes = [{ name: "QUESTION", what: "the question text only" }];
  if (q.type === "mcq" || q.type === "msq") q.options.forEach((_, i) => boxes.push({ name: `OPTION ${letter(i)}`, what: `the text of option ${letter(i)} only, without the letter "${letter(i)}" or "(${letter(i)})" in front` }));
  if (q.type === "code") {
    boxes.push({ name: "SETUP", what: "the setup description (write (empty) if there is none)" }, { name: "STARTER CODE", what: "the starter code only, no fences (write (empty) if there is none)" }, { name: "REFERENCE SOLUTION", what: "the working program only, no fences (write (empty) if there is none)" });
  }
  boxes.push({ name: "EXPLANATION", what: "the explanation only" });
  return boxes;
}

function mine(q: EditPromptInput): string {
  const out: string[] = [`QUESTION TYPE: ${q.type.toUpperCase()}`, "", "QUESTION", val(q.text)];
  if (q.type === "mcq" || q.type === "msq") {
    q.options.forEach((o, i) => out.push("", `OPTION ${letter(i)}`, val(o)));
    const right = (q.picked ?? []).map(letter).join(", ");
    out.push("", `MARKED AS RIGHT: ${right || "(nothing is marked yet)"}`);
  } else if (q.type === "nat") {
    out.push("", `MARKED ANSWER: ${q.nat?.value.trim() || "(none)"} (allowed error ±${q.nat?.tol.trim() || "0"})`);
  } else if (q.type === "str") {
    out.push("", `ACCEPTED ANSWER(S), one per line:\n${val(q.str?.answers ?? "")}`, `COMPARED AS: ${q.str?.match ?? "exact"}${q.str?.caseSensitive ? ", case matters" : ""}`);
  } else if (q.type === "code" && q.code) {
    out.push("", `LANGUAGE: ${q.code.language}`, "", "SETUP", val(q.code.setup), "", "STARTER CODE", val(q.code.starter), "", "REFERENCE SOLUTION", val(q.code.solution), "", "TESTS (JSON; do not change these)", val(q.code.tests));
  }
  out.push("", "EXPLANATION", val(q.explanation));
  return out.join("\n");
}

const TYPE_RULES: Record<QType, string> = {
  mcq: "MCQ: exactly ONE option is right. Make sure the marked option really is the only right one.",
  msq: "MSQ: one or more options are right. Make sure the marked options are exactly the right ones, no more and no fewer.",
  nat: "NAT: the answer is ONE number typed in. Work the question out and make sure the marked number is right (within the allowed error).",
  str: "TEXT ANSWER: the answer is short typed text. Make sure each accepted answer is right, and written in its plainest form (for example I,D,B, no extra spaces).",
  code: "CODE: the learner writes a program that reads standard input and prints to standard output. Make sure the question states the input format and the exact output format, and that the reference solution passes every test. Do NOT change the tests.",
};

function picturesPart(q: EditPromptInput): string {
  const pics = pictureList(q);
  if (!pics.length) return "";
  const att = pics.filter((p) => p.stored);
  const lines = pics.map((p) => `- ${p.stored ? `Picture ${att.indexOf(p) + 1}` : "Web picture"}: in ${p.where}, written as ![${p.alt}](${p.ref})${p.stored ? "" : " (open the link to see it)"}`);
  return `
PICTURES
This question uses ${pics.length} picture${pics.length === 1 ? "" : "s"}. ${att.length ? `I am attaching ${att.length === 1 ? "it" : `the ${att.length} stored pictures`} to this chat${att.length > 1 ? ", numbered in the order below" : ""}. LOOK at ${att.length === 1 ? "it" : "them"} before you answer: the picture usually holds information the text depends on (a figure, graph, table, circuit or diagram). Use it to check that the text, the options and the marked answer agree with what is drawn, and to repair OCR damage in the text that describes it. If a picture is missing from this chat, say so in NOTES and do not guess what it shows.` : ""}
${lines.join("\n")}
Keep every ![...](...) picture tag in your fixed text EXACTLY as written above, in the same field. Never change, move to another field, shorten or invent one. If the picture shows something the text should spell out (for example values in a table), do not add it: report it in NOTES.
`;
}

export function editPrompt(q: EditPromptInput): string {
  const boxes = editBoxes(q);
  const list = boxes.map((b, i) => `${i + 1}. ${b.name}: ${b.what}`).join("\n");
  const optional = q.type === "mcq" || q.type === "msq" ? " The number of options must stay the same, in the same order." : "";

  return String.raw`I have a study question that was typed in or copied from a scanned or OCR'd source. It may contain OCR artifacts or other mistakes, and it does not render properly in my practice app. Go through it carefully and fix it, so that a learner can read it, understand it and answer it.

YOUR JOB, IN THIS ORDER
1. Read the whole question, ${q.type === "mcq" || q.type === "msq" ? "every option, the marked right answer(s)" : "the marked answer"} and the explanation. Work the question out yourself.
2. Fix OCR artifacts and typing slips: broken or glued words, letters and digits mixed up (l / 1 / I, O / 0, rn / m, S / 5), stray line breaks in the middle of a sentence, hyphenation left over from a line break, page numbers, headers, footers or question numbers that crept in, duplicated words, garbled symbols (a wrong summation, integral, Greek letter, minus sign, inequality or subscript), lost superscripts and subscripts, and spaces that fell out of formulas or code.
3. Make sure it can be answered: nothing needed is missing, the numbers and symbols agree between the question, the options and the explanation, and the question says clearly what is asked.
4. ${TYPE_RULES[q.type]}
5. If you are CERTAIN a piece was damaged (for example a lost minus sign that the explanation proves), repair it. If you are NOT certain, do not guess: leave it as it is and report it in NOTES.
6. Never change what the question is about, how hard it is, the order of the options, or which answer is right. If the marked answer looks wrong to you, do NOT change it silently: report it in NOTES, with your working.

HOW TO WRITE IT (so it renders)
The app draws every question, option and explanation with KaTeX (maths) and a code highlighter.
1. Put inline maths between single dollar signs: $x^2 + 1$. Put big or important equations on their own line between double dollar signs: $$\int_0^1 x^2\,dx = \frac{1}{3}$$
2. Write ALL maths as LaTeX, even a single variable: $x$, not x. A plain number with no formula around it stays plain.
3. Backslashes: I will paste your text straight into a text box, NOT into JSON. So write each LaTeX backslash ONCE: $\frac{a}{b} \times \sqrt{x}$. Never double them.
4. A real dollar sign (money) is written \$, for example costs \$5. Never leave a lone $ in the text.
5. Do not use \( \) or \[ \], and do not use packages, \begin{align} or \begin{equation}. Use $$ ... $$ and, for several lines, \begin{aligned} ... \end{aligned} inside $$.
6. Keep each formula short enough to read on a phone. Break a long derivation into several $ $ pieces or an aligned block.
7. Plain text is plain text: no markdown headings, no bold (**), no bullet symbols made of *, no tables. Put a blank line between paragraphs or steps.
8. CODE: never put code or program text between dollar signs.
   - A piece of code inside a sentence goes between single backticks, for example What does ${TICK}len(xs)${TICK} return? It is shown exactly as typed.
   - A block of code goes between triple backticks on their own lines, with the language right after the opening ones:
${FENCE}python
print(2 + 3)
${FENCE}
     Supported languages: python, sql, c, cpp, java, javascript, typescript, bash, json, r, html. Use python for pseudocode. A whole program is ONE block: never wrap each line in its own backticks.
9. Pictures like ![caption](img:abc123) or ![caption](https://...) must be copied exactly as they are. Never change, shorten or invent a picture link.
10. Useful LaTeX: \frac{a}{b}, \sqrt{x}, x^{2}, x_{i}, \sum_{i=1}^{n}, \int_a^b f(x)\,dx, \lim_{x \to 0}, \alpha \beta \theta \lambda \mu \pi \sigma, \leq \geq \neq \approx \times \cdot \pm \infty, \in \subseteq \cup \cap \emptyset \forall \exists \Rightarrow, \text{words inside maths}, \vec{v}, A^{T}, A^{-1}, \begin{bmatrix} a & b \\ c & d \end{bmatrix}, P(A \mid B), \mathbb{E}[X], \mathcal{N}(\mu, \sigma^2).

HOW TO REPLY (strict)
I will copy each part into its own box in my editor, so give me EACH part in its OWN separate code block, with nothing else inside that block. Send exactly ${boxes.length} code block${boxes.length === 1 ? "" : "s"}, in this order:
${list}
Format of every block: a line with the name in capitals (exactly as above), then a code block that starts and ends with FOUR backticks (${OUT}), because the text inside may itself contain triple-backtick code. Put only the fixed text inside, exactly as it should be saved, with single backslashes. Do not repeat the name or the letter inside the block.${optional} If a part was empty, put (empty) inside its block.
After the code blocks, add one last section called NOTES in plain text: a short list of what you fixed, and anything you were unsure about, or any answer that looks wrong. Write "NOTES: nothing to report" if there is nothing. Write nothing before the first block.

${picturesPart(q)}
MY QUESTION (exactly as it is stored now)
${mine(q)}
`;
}
