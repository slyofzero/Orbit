import { activity, applyFilters, breakdown, buildEvents, insights, metrics, NO_FILTER, rank, tagStats } from "../lib/stats";
import { statsSheets } from "../lib/statsSheets";
import { buildXlsx } from "../lib/xlsx";
import { writeFileSync } from "node:fs";
import { BANK } from "../lib/gateBank";
import { GENERATORS, generate } from "../lib/generators";
import { buildMock } from "../lib/mock";
import { TOPICS } from "../lib/topics";
import { GATE_PLAN } from "../lib/gatePlan";
import { EMPTY_PACK, parsePack, packPrompt, packTemplateJson, packToJson } from "../lib/packs";
import { gatePackJson, gatePlanJson } from "./export-gate";
import { aiPrompt, parsePlan, templateJson } from "../lib/customPlan";

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
// ---- the exported GATE DA files must load back through the same parsers the app uses ----
const pk = parsePack(JSON.parse(JSON.stringify(gatePackJson())));
if (!pk.pack) err("exported pack does not parse: " + pk.errors.join("; "));
const pack = pk.pack!;
console.log("pack:", pack.topics.length, "topics,", pack.questions.length, "questions,", pack.mocks.length, "mock recipes");
if (pack.questions.length !== BANK.length) err("pack lost questions");
for (const tpl of pack.mocks) {
  const m = buildMock(pack, { kind: "template", template: tpl, seed: 42, seenIds: new Set() });
  const marks = m.questions.reduce((s, q) => s + q.marks, 0);
  console.log(tpl.id, "questions:", m.questions.length, "marks:", marks, "minutes:", m.durationSec / 60, "warnings:", m.warnings);
  if (new Set(m.questions.map((q) => q.id)).size !== m.questions.length) err("duplicate ids in mock");
  if (tpl.id === "full" && (m.questions.length !== 65 || marks !== 100 || m.durationSec !== 10800)) err("full mock should be 65 Q / 100 marks / 180 min");
}
const wk = buildMock(pack, { kind: "weak", seed: 1, seenIds: new Set() });
console.log("weak mock:", wk.questions.length, wk.questions.reduce((s, q) => s + q.marks, 0), wk.warnings);
const sb = buildMock(pack, { kind: "subject", subject: "ml", seed: 3, seenIds: new Set() });
if (sb.questions.length < 10) err("subject test too small");
const qk = buildMock(pack, { kind: "quick", seed: 5, seenIds: new Set() });
if (qk.questions.length < 8) err("quick test too small");
const noGen = buildMock({ ...pack, useBuiltinGenerators: false, mocks: [] }, { kind: "quick", seed: 5, seenIds: new Set() });
if (noGen.questions.some((q) => q.id.startsWith("g:"))) err("generators must stay off when the pack does not ask for them");
console.log("empty pack mock:", buildMock(EMPTY_PACK, { kind: "quick", seed: 1, seenIds: new Set() }).questions.length, "questions (should be 0)");

const pl = parsePlan(JSON.parse(JSON.stringify(gatePlanJson())));
if (!pl.plan) err("exported plan does not parse: " + pl.errors.join("; "));
const DAYS = pl.plan!.days;
console.log("plan days:", DAYS.length, DAYS[0].date, DAYS[DAYS.length - 1].date, "milestones:", pl.plan!.milestones.map((m) => m.name).join(", "));
for (const [i, d] of GATE_PLAN.days.entries()) {
  const x = DAYS[i];
  if (!x || x.date !== d.date || x.title !== d.title || x.kind !== d.kind || x.hours !== d.hours || x.phase !== d.phase || x.targetQs !== d.targetQs || JSON.stringify(x.tasks) !== JSON.stringify(d.tasks) || JSON.stringify(x.topics) !== JSON.stringify(d.topics)) err(`plan day ${d.date} changed in the export round trip`);
}
if (DAYS.length !== GATE_PLAN.days.length) err("plan lost days");
// every date in range covered exactly once
for (let i = 1; i < DAYS.length; i++) {
  const d = (Date.parse(DAYS[i].date) - Date.parse(DAYS[i - 1].date)) / 86400000;
  if (d !== 1) err(`gap between ${DAYS[i - 1].date} and ${DAYS[i].date}`);
}
// plan topics must exist in the pack
for (const d of DAYS) for (const t of d.topics) if (!pack.topics.some((x) => x.id === t)) err(`plan day ${d.date} uses unknown topic ${t}`);

// ---- imported plans ----
const t = parsePlan(JSON.parse(templateJson("2026-11-09")));
if (!t.plan) err("template does not parse: " + t.errors.join("; "));
else {
  console.log("template plan:", t.plan.days.length, "days,", Object.keys(t.plan.phaseNames).length, "phases,", t.plan.milestones.length, "milestones");
  if (t.plan.days.length !== 28) err("template should cover 28 days, got " + t.plan.days.length);
  if (t.plan.days[0].phase !== "A" || t.plan.days[27].phase !== "B") err("phase assignment by date failed");
  if (t.plan.days.find((d) => d.date === "2026-11-14")?.kind !== "mock") err("single date should be a mock");
  const wk = t.plan.days.filter((d) => d.title === "Problem sets"); // 5 weekdays only, range 16..20 Nov
  if (wk.length !== 5) err("weekday filter: expected 5 problem-set days, got " + wk.length);
}
if (!aiPrompt("2026-11-09").includes('"kind"')) err("ai prompt missing schema");
const bads: [string, unknown, string][] = [
  ["not object", [1], "one JSON object"],
  ["no days", { name: "x" }, '"days"'],
  ["bad date", { days: [{ date: "2026-02-30", title: "x" }] }, "not a real date"],
  ["bad kind", { days: [{ date: "2026-02-01", title: "x", kind: "party" }] }, "is not one of"],
  ["no title", { days: [{ date: "2026-02-01" }] }, '"title"'],
  ["dup date", { days: [{ date: "2026-02-01", title: "a" }, { date: "2026-02-01", title: "b" }] }, "already planned"],
  ["both forms", { days: [{ date: "2026-02-01", from: "2026-02-01", to: "2026-02-02", title: "a" }] }, "either"],
  ["range backwards", { days: [{ from: "2026-02-05", to: "2026-02-01", title: "a" }] }, "before"],
  ["hours", { days: [{ date: "2026-02-01", title: "a", hours: 40 }] }, "0 to 16"],
  ["tasks", { days: [{ date: "2026-02-01", title: "a", tasks: [] }] }, "tasks"],
  ["bad milestone", { days: [{ date: "2026-02-01", title: "a" }], milestones: [{ name: "m", date: "soon" }] }, "milestones[0]"],
];
for (const [label, input, needle] of bads) {
  const r = parsePlan(input);
  if (r.plan || !r.errors.some((e) => e.includes(needle))) err(`invalid case "${label}" should fail with "${needle}", got ${JSON.stringify(r.errors)}`);
}
const ov = parsePlan({ days: [{ from: "2026-02-01", to: "2026-02-03", title: "range" }, { date: "2026-02-02", title: "single", kind: "exam" }, { from: "2026-02-02", to: "2026-02-02", title: "late range" }] });
if (ov.plan?.days.find((d) => d.date === "2026-02-02")?.title !== "single") err("a single date must beat any range");
if (ov.plan?.milestones.length !== 1) err("exam days should become milestones when none are given");

// ---- imported packs ----
const tp = parsePack(JSON.parse(packTemplateJson()));
if (!tp.pack) err("pack template does not parse: " + tp.errors.join("; "));
else if (tp.pack.questions.length !== 4 || tp.pack.mocks.length !== 1) err("pack template shape changed");
if (!packPrompt().includes('"mcq"')) err("pack prompt missing schema");
// ---- export of the current pack / plan can be uploaded again ----
const rt = parsePack(JSON.parse(JSON.stringify(packToJson(pack))));
if (!rt.pack || rt.pack.questions.length !== pack.questions.length || rt.pack.mocks.length !== pack.mocks.length || rt.pack.useBuiltinGenerators !== pack.useBuiltinGenerators) err("packToJson must round-trip: " + rt.errors.join("; "));
// ---- LaTeX in packs ----
const pr = packPrompt();
if (!pr.includes("LaTeX") || !pr.includes("\\\\frac") || !pr.includes("TWICE")) err("pack prompt must teach LaTeX and the doubled backslash rule");
const texBase = { topics: [{ id: "a", subject: "s", name: "A", status: "know" }] };
const q1 = (text: string, extra: object = {}) => ({ topic: "a", type: "nat", marks: 1, text, answer: 1, ...extra });
const fixedTex = parsePack({ ...texBase, questions: [q1("Simplify $\x0crac{1}{2} \x09imes 2$")] });
if (!fixedTex.pack || fixedTex.pack.questions[0].text !== "Simplify $\\frac{1}{2} \\times 2$") err("control characters from single backslashes should be repaired: " + JSON.stringify(fixedTex.pack?.questions[0].text) + JSON.stringify(fixedTex.errors));
if (!fixedTex.warnings.some((w) => w.includes("Fixed 2"))) err("repair should warn");
const lone = parsePack({ ...texBase, questions: [q1("costs $5 today")] });
if (lone.pack || !lone.errors.some((e) => e.includes("without a partner"))) err("lone $ should fail");
const money = parsePack({ ...texBase, questions: [q1("costs \\$5 and $x^2$")] });
if (!money.pack) err("escaped dollar should pass: " + money.errors.join("; "));
const badMacro = parsePack({ ...texBase, questions: [q1("$\\notamacro{x}$")] });
if (badMacro.pack || !badMacro.errors.some((e) => e.includes("will not draw"))) err("unknown macro should fail with a plain message");
const badOpt = parsePack({ ...texBase, questions: [{ topic: "a", type: "mcq", marks: 1, text: "ok $x$", options: ["$\\frac{1}{$", "b"], answer: 0 }] });
if (badOpt.pack || !badOpt.errors.some((e) => e.includes("options[0]"))) err("bad maths in an option should point at the option");
const disp = parsePack({ ...texBase, questions: [q1("$$\\begin{aligned} a &= 1 \\\\ b &= 2 \\end{aligned}$$ and \\(y\\) and ```py\nx = '$'\n```")] });
if (!disp.pack) err("display/aligned/\\( \\)/code should pass: " + disp.errors.join("; "));
const base = { topics: [{ id: "a", subject: "s", name: "A" }] };
const badPacks: [string, unknown, string][] = [
  ["not object", 5, "one JSON object"],
  ["no topics", { questions: [] }, '"topics"'],
  ["unknown topic", { ...base, questions: [{ topic: "zzz", type: "mcq", marks: 1, text: "q", options: ["x", "y"], answer: 0 }] }, "not one of your topic ids"],
  ["bad type", { ...base, questions: [{ topic: "a", type: "essay", marks: 1, text: "q" }] }, "type"],
  ["bad marks", { ...base, questions: [{ topic: "a", type: "nat", marks: 3, text: "q", answer: 1 }] }, "marks"],
  ["mcq answer range", { ...base, questions: [{ topic: "a", type: "mcq", marks: 1, text: "q", options: ["x", "y"], answer: 2 }] }, "counting from 0"],
  ["msq dup", { ...base, questions: [{ topic: "a", type: "msq", marks: 2, text: "q", options: ["x", "y"], answer: [1, 1] }] }, "msq"],
  ["nat answer", { ...base, questions: [{ topic: "a", type: "nat", marks: 1, text: "q", answer: "four" }] }, "nat"],
  ["dup id", { ...base, questions: [{ id: "q1", topic: "a", type: "nat", marks: 1, text: "q", answer: 1 }, { id: "q1", topic: "a", type: "nat", marks: 1, text: "q2", answer: 2 }] }, "used twice"],
  ["mock subject", { ...base, questions: [], mocks: [{ id: "m", name: "M", minutes: 30, sections: [{ name: "S", picks: [{ subject: "nope", one: 1 }] }] }] }, "subject"],
];
for (const [label, input, needle] of badPacks) {
  const r = parsePack(input);
  if (r.pack || !r.errors.some((e) => e.includes(needle))) err(`invalid pack "${label}" should fail with "${needle}", got ${JSON.stringify(r.errors)}`);
}
const ok = parsePack({ ...base, questions: [{ topic: "a", type: "nat", marks: 1, text: "q", answer: 4 }, { topic: "a", type: "mcq", marks: 1, text: "q2", options: ["x", "y"], answer: 1 }] });
if (ok.pack?.questions.map((q) => q.id).join() !== "a-1,a-2") err("auto ids should be topic-n");
console.log(bad ? `${bad} PROBLEMS` : "ALL OK");

// ---- statistics ----
{
  const sp = parsePack(JSON.parse(packTemplateJson())).pack!;
  if (sp.questions.some((q) => !q.subject)) err("every parsed question must carry its subject");
  if (!sp.questions[0].tags?.includes("linear-equation")) err("optional tags must be kept");
  const clash = parsePack({ ...JSON.parse(packTemplateJson()), questions: [{ subject: "sci", topic: "algebra", type: "nat", marks: 1, text: "q", answer: 1 }] });
  if (clash.pack || !clash.errors.some((e) => e.includes("does not match topic"))) err("subject that disagrees with the topic must fail");
  const T0 = Date.UTC(2026, 10, 1, 8, 0, 0), DAY = 86_400_000;
  const L = (q: string, topic: string, subject: string, out: "right" | "wrong" | "skip", at: number, tags: string[] = [], ms = 20_000): import("../lib/types").LogEntry => ({ q, topic, subject, tags, type: "mcq", marks: 1, out, at, ms });
  const log = [
    ...Array.from({ length: 8 }, (_, i) => L("algebra-1", "algebra", "maths", i < 6 ? "right" : "wrong", T0 + i * 1000, ["easy"])),
    ...Array.from({ length: 6 }, (_, i) => L("algebra-2", "algebra", "maths", i < 1 ? "right" : "wrong", T0 + DAY + i * 1000, ["hard"])),
    ...Array.from({ length: 6 }, (_, i) => L("motion-1", "motion", "sci", i < 5 ? "right" : "skip", T0 + 2 * DAY + i * 1000, ["formula"])),
  ];
  const evs = buildEvents({ log, practice: { "legacy-1": { correct: false, at: T0, topic: "motion" } }, attempts: [], pack: sp, find: () => undefined });
  if (evs.length !== 21) err("events should be 20 logged + 1 legacy, got " + evs.length);
  const now = T0 + 3 * DAY;
  const bd = breakdown(evs, sp, now);
  const alg = bd.topics.find((t) => t.id === "algebra")!, sci = bd.subjects.find((s) => s.id === "sci")!;
  if (alg.m.n !== 14 || alg.m.right !== 7 || alg.m.acc !== 0.5) err("algebra numbers wrong: " + JSON.stringify(alg.m));
  if (sci.m.skip !== 1 || sci.m.wrong !== 1) err("legacy record or skips miscounted: " + JSON.stringify(sci.m));
  const rk = rank(bd.subjects, 5);
  if (rk.best?.id !== "sci" || rk.worst?.id !== "maths") err("strongest/weakest subject wrong: " + rk.best?.id + "/" + rk.worst?.id);
  const hardest = bd.questions.filter((q) => q.m.answered >= 2).sort((a, b) => (a.m.acc ?? 1) - (b.m.acc ?? 1))[0];
  if (hardest?.id !== "algebra-2") err("hardest question wrong");
  const tg = tagStats(evs, sp, now);
  if (tg.find((t) => t.tag === "hard")?.m.acc !== 1 / 6) err("tag stats wrong");
  const a = activity(evs, now);
  if (a.current !== 3 || a.best !== 3) err("streak wrong: " + a.current + "/" + a.best);
  if (applyFilters(evs, { ...NO_FILTER, tag: "hard" }, now).length !== 6) err("tag filter wrong");
  if (applyFilters(evs, { ...NO_FILTER, days: 1 }, now).length !== 6) err("period filter wrong");
  if (!insights(evs, bd, now).some((t) => t.includes("Weakest topic"))) err("insights should name the weakest topic");
  if (metrics([], 3).strength !== 0.5) err("no data should rank neutral");
  const sheets = statsSheets({ evs, pack: sp, attempts: [], profile: "Main", now });
  const bytes = buildXlsx(sheets);
  if (bytes[0] !== 0x50 || bytes[1] !== 0x4b) err("xlsx must be a zip");
  writeFileSync("/tmp/orbit-test.xlsx", bytes);
  console.log("stats: ok,", sheets.length, "sheets,", bytes.length, "bytes xlsx");
}
