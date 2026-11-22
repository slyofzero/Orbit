// "Copy prompt" in Manage pack's question editor (v1's lib/editPrompt.ts): a ready-to-paste prompt for any AI
// that cleans up ONE question (OCR artifacts, broken LaTeX, missing pieces) and hands back each field in its own
// copy-able box, ready to paste into the matching box of the editor. A product feature (AGENTS.md rule 9):
// it describes the editor's boxes (lib/manage.ts QuestionForm); scripts/checks/manage.ts tests it.
// Nothing here may assume a particular exam.

import { letter, type QuestionForm } from "@/lib/manage";
import type { QuestionType } from "@/types/tables";

const TICK = "`";
const FENCE = "```";
const OUT = "````"; // four backticks, so a code block INSIDE a field can never close the box early

const val = (s: string) => (s.trim() ? s.trim() : "(empty)");
const hasOptions = (t: QuestionType) => t === "mcq" || t === "msq";

/** The boxes the AI must send back, in order, with what goes in each. */
export function editBoxes(q: QuestionForm): { name: string; what: string }[] {
  const boxes = [{ name: "QUESTION", what: "the question text only" }];
  if (hasOptions(q.type))
    q.options.forEach((_, i) =>
      boxes.push({
        name: `OPTION ${letter(i)}`,
        what: `the text of option ${letter(i)} only, without the letter "${letter(i)}" or "(${letter(i)})" in front`,
      }),
    );
  if (q.type === "code")
    boxes.push({ name: "STARTER CODE", what: "the starter code only, no fences (write (empty) if there is none)" });
  boxes.push({
    name: "EXPLANATION",
    what: q.type === "code" ? "the model solution and its explanation" : "the explanation only",
  });
  return boxes;
}

function mine(q: QuestionForm): string {
  const out: string[] = [`QUESTION TYPE: ${q.type.toUpperCase()}`, "", "QUESTION", val(q.text)];
  if (hasOptions(q.type)) {
    q.options.forEach((o, i) => out.push("", `OPTION ${letter(i)}`, val(o)));
    const right = q.picked.map(letter).join(", ");
    out.push("", `MARKED AS RIGHT: ${right || "(nothing is marked yet)"}`);
  } else if (q.type === "nat") {
    out.push("", `MARKED ANSWER: ${q.natValue.trim() || "(none)"} (allowed error ±${q.natTol.trim() || "0"})`);
  } else if (q.type === "str") {
    out.push(
      "",
      `ACCEPTED ANSWER(S), one per line:\n${val(q.strAnswers)}`,
      `COMPARED AS: ${q.strMatch}${q.strCase ? ", case matters" : ""}`,
    );
  } else out.push("", "STARTER CODE", val(q.starter));
  out.push("", "EXPLANATION", val(q.explanation));
  return out.join("\n");
}

const TYPE_RULES: Record<QuestionType, string> = {
  mcq: "MCQ: exactly ONE option is right. Make sure the marked option really is the only right one.",
  msq: "MSQ: one or more options are right. Make sure the marked options are exactly the right ones, no more and no fewer.",
  nat: "NAT: the answer is ONE number typed in. Work the question out and make sure the marked number is right (within the allowed error).",
  str: "TEXT ANSWER: the answer is short typed text. Make sure each accepted answer is right, and written in its plainest form (for example I,D,B, no extra spaces).",
  code: "CODE: the learner writes code in an editor and then marks their own answer right or wrong against the explanation. Make sure the question says exactly what to write (the input, the output, any limits), and that the explanation holds a working model solution with a short explanation of it.",
};

export function editPrompt(q: QuestionForm): string {
  const boxes = editBoxes(q);
  const list = boxes.map((b, i) => `${i + 1}. ${b.name}: ${b.what}`).join("\n");
  const optional = hasOptions(q.type) ? " The number of options must stay the same, in the same order." : "";

  return String.raw`I have a study question that was typed in or copied from a scanned or OCR'd source. It may contain OCR artifacts or other mistakes, and it does not render properly in my practice app. Go through it carefully and fix it, so that a learner can read it, understand it and answer it.

YOUR JOB, IN THIS ORDER
1. Read the whole question, ${hasOptions(q.type) ? "every option, the marked right answer(s)" : "the marked answer"} and the explanation. Work the question out yourself.
2. Fix OCR artifacts and typing slips: broken or glued words, letters and digits mixed up (l / 1 / I, O / 0, rn / m, S / 5), stray line breaks in the middle of a sentence, hyphenation left over from a line break, page numbers, headers, footers or question numbers that crept in, duplicated words, garbled symbols (a wrong summation, integral, Greek letter, minus sign, inequality or subscript), lost superscripts and subscripts, and spaces that fell out of formulas or code.
3. Make sure it can be answered: nothing needed is missing, the numbers and symbols agree between the question, the options and the explanation, and the question says clearly what is asked.
4. ${TYPE_RULES[q.type]}
5. If you are CERTAIN a piece was damaged (for example a lost minus sign that the explanation proves), repair it. If you are NOT certain, do not guess: leave it as it is and report it in NOTES.
6. Never change what the question is about, how hard it is, the order of the options, or which answer is right. If the marked answer looks wrong to you, do NOT change it silently: report it in NOTES, with your working.

HOW TO WRITE IT (so it renders)
The app draws every question, option and explanation as markdown, with KaTeX for maths and a code highlighter.
1. Put inline maths between single dollar signs: $x^2 + 1$. Put big or important equations on their own line between double dollar signs: $$\int_0^1 x^2\,dx = \frac{1}{3}$$
2. Write ALL maths as LaTeX, even a single variable: $x$, not x. A plain number with no formula around it stays plain.
3. Backslashes: I will paste your text straight into a text box, NOT into JSON. So write each LaTeX backslash ONCE: $\frac{a}{b} \times \sqrt{x}$. Never double them.
4. A real dollar sign (money) is written \$, for example costs \$5. Never leave a lone $ in the text.
5. Do not use \( \) or \[ \], and do not use packages, \begin{align} or \begin{equation}. Use $$ ... $$ and, for several lines, \begin{aligned} ... \end{aligned} inside $$.
6. Keep each formula short enough to read on a phone. Break a long derivation into several $ $ pieces or an aligned block.
7. Keep formatting light: **bold** only for a word that really matters, no headings, no tables. Put a blank line between paragraphs or steps.
8. CODE: never put code or program text between dollar signs.
   - A piece of code inside a sentence goes between single backticks, for example What does ${TICK}len(xs)${TICK} return? It is shown exactly as typed.
   - A block of code goes between triple backticks on their own lines, with the language right after the opening ones:
${FENCE}python
print(2 + 3)
${FENCE}
     Use python for pseudocode. A whole program is ONE block: never wrap each line in its own backticks.${q.type === "code" ? " The STARTER CODE box is the exception: it holds bare code, with no backticks around it." : ""}
9. Pictures like ![caption](img:abc123) or ![caption](https://...) must be copied exactly as they are, in the same field. Never change, shorten or invent a picture link.
10. Useful LaTeX: \frac{a}{b}, \sqrt{x}, x^{2}, x_{i}, \sum_{i=1}^{n}, \int_a^b f(x)\,dx, \lim_{x \to 0}, \alpha \beta \theta \lambda \mu \pi \sigma, \leq \geq \neq \approx \times \cdot \pm \infty, \in \subseteq \cup \cap \emptyset \forall \exists \Rightarrow, \text{words inside maths}, \vec{v}, A^{T}, A^{-1}, \begin{bmatrix} a & b \\ c & d \end{bmatrix}, P(A \mid B), \mathbb{E}[X], \mathcal{N}(\mu, \sigma^2).

HOW TO REPLY (strict)
I will copy each part into its own box in my editor, so give me EACH part in its OWN separate code block, with nothing else inside that block. Send exactly ${boxes.length} code block${boxes.length === 1 ? "" : "s"}, in this order:
${list}
Format of every block: a line with the name in capitals (exactly as above), then a code block that starts and ends with FOUR backticks (${OUT}), because the text inside may itself contain triple-backtick code. Put only the fixed text inside, exactly as it should be saved, with single backslashes. Do not repeat the name or the letter inside the block.${optional} If a part was empty, put (empty) inside its block.
After the code blocks, add one last section called NOTES in plain text: a short list of what you fixed, and anything you were unsure about, or any answer that looks wrong. Write "NOTES: nothing to report" if there is nothing. Write nothing before the first block.

MY QUESTION (exactly as it is stored now)
${mine(q)}
`;
}
