import { BANK } from "../lib/bank";
import { GENERATORS, generate } from "../lib/generators";
import { buildMock } from "../lib/mock";
import { TOPICS } from "../lib/topics";
import { DAYS } from "../lib/plan";

let bad = 0;
const err = (m: string) => { bad++; console.log("BAD:", m); };
const checkQ = (q: any) => {
  if (!q.text || !q.explanation) err(`${q.id} missing text/explanation`);
  if (q.type === "mcq") {
    if (!q.options || q.options.length < 2) err(`${q.id} options`);
    else if (!(Number.isInteger(q.answer) && q.answer >= 0 && q.answer < q.options.length)) err(`${q.id} mcq answer`);
  } else if (q.type === "msq") {
    if (!Array.isArray(q.answer) || !q.answer.length || q.answer.some((i: number) => i < 0 || i >= q.options.length)) err(`${q.id} msq answer`);
  } else {
    if (typeof q.answer?.value !== "number" || Number.isNaN(q.answer.value) || !Number.isFinite(q.answer.value)) err(`${q.id} nat value ${JSON.stringify(q.answer)}`);
  }
  if (/NaN|undefined|Infinity/.test(q.text + q.explanation)) err(`${q.id} text has NaN/undefined: ${q.text.slice(0, 80)}`);
};
BANK.forEach(checkQ);
console.log("static questions:", BANK.length);
const perTopic: Record<string, number> = {};
BANK.forEach((q) => (perTopic[q.topic] = (perTopic[q.topic] ?? 0) + 1));
console.log("topics with 0 static & no generator:", TOPICS.filter((t) => !perTopic[t.id] && !GENERATORS.some((g) => g.topic === t.id)).map((t) => t.id).join(", "));
for (const g of GENERATORS) for (let s = 1; s <= 300; s++) checkQ(generate(g, s * 7919));
console.log("generators:", GENERATORS.length);
for (const kind of ["full", "sectional"] as const) {
  const m = buildMock({ kind, seed: 42, seenIds: new Set() });
  const marks = m.questions.reduce((s, q) => s + q.marks, 0);
  console.log(kind, "questions:", m.questions.length, "marks:", marks, "minutes:", m.durationSec / 60, "warnings:", m.warnings);
  const ids = new Set(m.questions.map((q) => q.id));
  if (ids.size !== m.questions.length) err("duplicate ids in mock");
}
const w = buildMock({ kind: "weak", seed: 1, seenIds: new Set(), weakTopics: TOPICS.filter((t) => t.status !== "know").map((t) => t.id) });
console.log("weak mock:", w.questions.length, w.questions.reduce((s, q) => s + q.marks, 0), w.warnings);
console.log("plan days:", DAYS.length, DAYS[0].date, DAYS[DAYS.length - 1].date);
// every date in range covered exactly once
for (let i = 1; i < DAYS.length; i++) {
  const d = (Date.parse(DAYS[i].date) - Date.parse(DAYS[i - 1].date)) / 86400000;
  if (d !== 1) err(`gap between ${DAYS[i - 1].date} and ${DAYS[i].date}`);
}
console.log(bad ? `${bad} PROBLEMS` : "ALL OK");
