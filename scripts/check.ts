import { activity, applyFilters, breakdown, buildEvents, insights, metrics, NO_FILTER, rank, tagStats } from "../lib/stats";
import { statsSheets } from "../lib/statsSheets";
import { buildXlsx } from "../lib/xlsx";
import { writeFileSync } from "node:fs";
import { BANK } from "../lib/gateBank";
import { GENERATORS, generate } from "../lib/generators";
import { formatAnswer, isCorrect } from "../lib/scoring";
import { buildFixedMock, buildMock } from "../lib/mock";
import { TOPICS } from "../lib/topics";
import { GATE_PLAN } from "../lib/gatePlan";
import { EMPTY_PACK, parsePack, packPrompt, packTemplateJson, packToJson, mergePack, mergeChanges, allQuestions } from "../lib/packs";
import { gatePackJson, gatePlanJson } from "./export-gate";
import { aiPrompt, parsePlan, templateJson } from "../lib/customPlan";
import { hashData as hashDataCheck } from "../lib/images";
import { checkQuestion, deleteSection, freeId, moveQuestion, moveSection, removeQuestion, renameSection, searchIds, upsertQuestion } from "../lib/packEdit";
import type { Attempt } from "../lib/types";
import { mergeFiles } from "../lib/packMerge";
import { facets, makeMatcher } from "../lib/questionFilter";
import { typeBreakdown } from "../lib/typeBreakdown";
import { setupPrompt } from "../lib/setupPrompt";
import { mkdtempSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { judge, commandFor } from "../lib/runner";
import { sameOutput } from "../lib/judge";
import { segments, texProblems, parseFence, mergeTickLines } from "../lib/tex";
import { highlightCode, languageOf } from "../lib/highlight";
import { bankFile, filesPrompt, isTooLong, planFile, PROMPT_LIMIT, linkPrompt, parseLinks, liveQuestionIds, readAnswer } from "../lib/links";

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
else if (tp.pack.questions.length !== 6 || tp.pack.mockTests.length !== 1) err("pack template shape changed");
if (!packPrompt().includes('"mcq"')) err("pack prompt missing schema");
// ---- export of the current pack / plan can be uploaded again ----
const rt = parsePack(JSON.parse(JSON.stringify(packToJson(pack))));
if (!rt.pack || rt.pack.questions.length !== pack.questions.length || rt.pack.mocks.length !== pack.mocks.length || rt.pack.useBuiltinGenerators !== pack.useBuiltinGenerators) err("packToJson must round-trip: " + rt.errors.join("; "));
// ---- LaTeX in packs ----
const pr = packPrompt();
if (!pr.includes("LaTeX") || !pr.includes("\\\\frac") || !pr.includes("TWICE")) err("pack prompt must teach LaTeX and the doubled backslash rule");
const texBase = { topics: [{ id: "a", subject: "s", name: "A", status: "know" }] };
const q1 = (text: string, extra: object = {}) => ({ topic: "a", difficulty: "easy", type: "nat", marks: 1, text, answer: 1, ...extra });
const fixedTex = parsePack({ ...texBase, questions: [q1("Simplify $\x0crac{1}{2} \x09imes 2$")] });
if (!fixedTex.pack || fixedTex.pack.questions[0].text !== "Simplify $\\frac{1}{2} \\times 2$") err("control characters from single backslashes should be repaired: " + JSON.stringify(fixedTex.pack?.questions[0].text) + JSON.stringify(fixedTex.errors));
if (!fixedTex.warnings.some((w) => w.includes("Fixed 2"))) err("repair should warn");
const lone = parsePack({ ...texBase, questions: [q1("costs $5 today")] });
if (lone.pack || !lone.errors.some((e) => e.includes("without a partner"))) err("lone $ should fail");
const money = parsePack({ ...texBase, questions: [q1("costs \\$5 and $x^2$")] });
if (!money.pack) err("escaped dollar should pass: " + money.errors.join("; "));
const badMacro = parsePack({ ...texBase, questions: [q1("$\\notamacro{x}$")] });
if (badMacro.pack || !badMacro.errors.some((e) => e.includes("will not draw"))) err("unknown macro should fail with a plain message");
const badOpt = parsePack({ ...texBase, questions: [{ topic: "a", difficulty: "easy", type: "mcq", marks: 1, text: "ok $x$", options: ["$\\frac{1}{$", "b"], answer: 0 }] });
if (badOpt.pack || !badOpt.errors.some((e) => e.includes("options[0]"))) err("bad maths in an option should point at the option");
const disp = parsePack({ ...texBase, questions: [q1("$$\\begin{aligned} a &= 1 \\\\ b &= 2 \\end{aligned}$$ and \\(y\\) and ```py\nx = '$'\n```")] });
if (!disp.pack) err("display/aligned/\\( \\)/code should pass: " + disp.errors.join("; "));
const base = { topics: [{ id: "a", subject: "s", name: "A" }] };
const badPacks: [string, unknown, string][] = [
  ["not object", 5, "one JSON object"],
  ["no topics", { questions: [] }, '"topics"'],
  ["unknown topic", { ...base, questions: [{ topic: "zzz", difficulty: "easy", type: "mcq", marks: 1, text: "q", options: ["x", "y"], answer: 0 }] }, "not one of your topic ids"],
  ["bad type", { ...base, questions: [{ topic: "a", type: "essay", marks: 1, text: "q" }] }, "type"],
  ["bad marks", { ...base, questions: [{ topic: "a", difficulty: "easy", type: "nat", marks: 3, text: "q", answer: 1 }] }, "marks"],
  ["mcq answer range", { ...base, questions: [{ topic: "a", difficulty: "easy", type: "mcq", marks: 1, text: "q", options: ["x", "y"], answer: 2 }] }, "counting from 0"],
  ["msq dup", { ...base, questions: [{ topic: "a", difficulty: "easy", type: "msq", marks: 2, text: "q", options: ["x", "y"], answer: [1, 1] }] }, "msq"],
  ["nat answer", { ...base, questions: [{ topic: "a", difficulty: "easy", type: "nat", marks: 1, text: "q", answer: "four" }] }, "nat"],
  ["dup id", { ...base, questions: [{ id: "q1", topic: "a", difficulty: "easy", type: "nat", marks: 1, text: "q", answer: 1 }, { id: "q1", topic: "a", difficulty: "easy", type: "nat", marks: 1, text: "q2", answer: 2 }] }, "used twice"],
  ["mock subject", { ...base, questions: [], mocks: [{ id: "m", name: "M", minutes: 30, sections: [{ name: "S", picks: [{ subject: "nope", one: 1 }] }] }] }, "subject"],
];
for (const [label, input, needle] of badPacks) {
  const r = parsePack(input);
  if (r.pack || !r.errors.some((e) => e.includes(needle))) err(`invalid pack "${label}" should fail with "${needle}", got ${JSON.stringify(r.errors)}`);
}
const ok = parsePack({ ...base, questions: [{ topic: "a", difficulty: "easy", type: "nat", marks: 1, text: "q", answer: 4 }, { topic: "a", difficulty: "easy", type: "mcq", marks: 1, text: "q2", options: ["x", "y"], answer: 1 }] });
if (ok.pack?.questions.map((q) => q.id).join() !== "a-1,a-2") err("auto ids should be topic-n");
{
  const mk = (extra: object) => parsePack({ name: "P", subjects: { m: "Maths" }, topics: [{ id: "alg", subject: "m", name: "Algebra" }], questions: [], ...extra });
  const q = (id: string, text: string) => ({ id, topic: "alg", difficulty: "easy", type: "nat", marks: 1, text, answer: 1, explanation: "e" });
  const a = mk({ questions: [q("alg-1", "one"), q("alg-2", "two")] }).pack!;
  const b = mk({ topics: [{ id: "alg", subject: "m", name: "Algebra" }, { id: "geo", subject: "m", name: "Geometry" }], questions: [q("alg-1", "one"), q("alg-2", "brand new"), q("geo-1", "g")] }).pack!;
  const r = mergePack(a, b);
  if (r.report.unchanged !== 1 || r.report.updatedQuestions !== 1 || r.report.newQuestions !== 1 || r.report.newTopics !== 1) err("merge report wrong " + JSON.stringify(r.report));
  const ids = r.pack.questions.map((x) => x.id);
  if (new Set(ids).size !== ids.length || r.pack.questions.length !== 3) err("merge ids not unique " + ids);
  if (r.pack.questions.find((x) => x.id === "alg-2")?.text !== "brand new") err("a question with a known id must be replaced by the uploaded one");
  if (r.pack.questions[1].id !== "alg-2") err("a replaced question keeps its place");
  const again = mergePack(r.pack, b);
  if (mergeChanges(again.report) !== 0 || again.pack.questions.length !== 3) err("merging twice should change nothing");
  if (a.questions.length !== 2) err("merge must not change the original");
  if (!packPrompt(a).includes("alg [m]")) err("adding prompt should list topic ids");
  if (!parsePack(packToJson(r.pack)).pack) err("merged pack should round trip");
  console.log("merge: ok");
}
{
  const base = { name: "P", subjects: { m: "Maths" }, topics: [{ id: "alg", subject: "m", name: "Algebra" }] };
  const mq = (id: string, text: string) => ({ id, topic: "alg", difficulty: "easy", type: "nat", marks: 1, text, answer: 1, explanation: "e" });
  const mk = (mockTests: unknown, questions: unknown[] = [mq("alg-1", "practice one")]) => parsePack({ ...base, questions, mockTests });
  const okm = mk([{ id: "t1", name: "T1", minutes: 30, sections: [{ name: "S", questions: [mq("t1-1", "a"), mq("t1-2", "b")] }] }]);
  if (!okm.pack || okm.pack.mockTests[0].sections[0].questions.length !== 2) err("mockTests should parse: " + okm.errors.join("; "));
  else {
    const f = buildFixedMock(okm.pack.mockTests[0]);
    if (f.questions.length !== 2 || f.sections.length !== 1 || f.durationSec !== 1800) err("fixed mock build wrong");
    if (!parsePack(packToJson(okm.pack)).pack?.mockTests.length) err("mockTests must round trip");
  }
  if (mk([{ id: "t1", name: "T1", minutes: 30, sections: [{ name: "S", questions: [mq("alg-1", "x")] }] }]).pack) err("a mock question may not reuse a practice id");
  if (mk([{ id: "t1", name: "T1", minutes: 30, sections: [{ name: "S", questions: [mq("z", "x")] }] }, { id: "t2", name: "T2", minutes: 30, sections: [{ name: "S", questions: [mq("z", "y")] }] }]).pack) err("a question id may not be shared by two mocks");
  const dupText = mk([{ id: "t1", name: "T1", minutes: 30, sections: [{ name: "S", questions: [mq("a", "same")] }] }, { id: "t2", name: "T2", minutes: 30, sections: [{ name: "S", questions: [mq("b", "same")] }] }]);
  if (!dupText.warnings.some((w) => w.includes("same text"))) err("same text in two mocks should warn");
  // merging: a mock with the same id gets only its new questions; a new mock arrives whole; ids never clash with practice
  const A = mk([{ id: "t1", name: "T1", minutes: 30, sections: [{ name: "S", questions: [mq("t1-1", "a"), mq("t1-2", "b")] }] }]).pack!;
  const B = mk([{ id: "t1", name: "T1", minutes: 30, sections: [{ name: "S", questions: [mq("t1-1", "a"), mq("t1-3", "c")] }] }, { id: "t2", name: "T2", minutes: 30, sections: [{ name: "S", questions: [mq("t1-2", "d")] }] }]).pack!;
  const mm = mergePack(A, B);
  const all = [...mm.pack.questions, ...mm.pack.mockTests.flatMap((m) => m.sections.flatMap((x) => x.questions))].map((q) => q.id);
  if (mm.report.newMockTests !== 0 || mm.report.newMockQuestions !== 1 || mm.report.unchanged !== 2 || mm.report.updatedMockQuestions !== 1) err("mock merge report wrong " + JSON.stringify(mm.report));
  if (mm.pack.mockTests.length !== 1 || mm.pack.mockTests[0].sections[0].questions.find((x) => x.id === "t1-2")?.text !== "d") err("an id already in a mock is replaced in place, not copied into another mock");
  if (new Set(all).size !== all.length) err("ids must be unique across banks after merge: " + all);
  if (mm.pack.mockTests[0].sections[0].questions.length !== 3) err("new question should join the existing mock");
  if (mergeChanges(mergePack(mm.pack, B).report) !== 0) err("merging mocks twice should change nothing");
  // statistics cover mock questions too, with their subject, topic and tags
  const tagged = (id: string, tags: string[]) => ({ ...mq(id, "t " + id), tags });
  const sp2 = mk([{ id: "t1", name: "T1", minutes: 30, sections: [{ name: "S", questions: [tagged("m1", ["trap"]), tagged("m2", ["trap", "hard"])] }] }]).pack!;
  const att: Attempt = { id: "a1", title: "T1", createdAt: 1, startedAt: 1, submittedAt: 5000, durationSec: 60, questions: sp2.mockTests[0].sections[0].questions, sections: [], responses: { 0: { ans: 1 }, 1: { ans: 9 } } as never, warnings: [] };
  const evm = buildEvents({ log: [], practice: {}, attempts: [att], pack: sp2, find: () => undefined });
  const bdm = breakdown(evm, sp2, 10_000);
  const mq1 = bdm.questions.find((x) => x.id === "m1");
  if (evm.length !== 2 || evm[0].subject !== "m" || !evm[0].tags.includes("trap")) err("mock answers should become events with subject and tags");
  if (!mq1 || mq1.mock !== "T1") err("mock questions should be listed in the breakdown with their mock name");
  if (bdm.subjects.find((x) => x.id === "m")?.m.total !== 3 || bdm.topics.find((x) => x.id === "alg")?.m.total !== 3) err("totals should count practice and mock questions");
  const trap = tagStats(evm, sp2, 10_000).find((t) => t.tag === "trap");
  if (!trap || trap.m.total !== 2 || trap.m.n !== 2) err("tag stats should include mock questions");
  // pictures
  const png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
  const png2 = png.replace("iVBOR", "iVBOS");
  const withImg = (text: string, images: unknown = { a: png, b: png }) => parsePack({ ...base, questions: [{ ...mq("i1", text), explanation: "![x](img:b) done" }], images });
  const pi = withImg("see ![fig](img:a)");
  if (!pi.pack) err("pictures should parse: " + pi.errors.join("; "));
  else {
    const hs = Object.keys(pi.images);
    if (hs.length !== 1 || !/^h[0-9a-z]+-[0-9a-z]+$/.test(hs[0])) err("identical pictures should share one content name: " + hs);
    if (!pi.pack.questions[0].text.includes(`img:${hs[0]}`) || !pi.pack.questions[0].explanation.includes(`img:${hs[0]}`)) err("references should use content names");
    const again = parsePack({ ...packToJson(pi.pack), images: pi.images });
    if (!again.pack || again.pack.questions[0].text !== pi.pack.questions[0].text) err("a pack with pictures must round trip: " + again.errors.join("; "));
    if (hashDataCheck(png) === hashDataCheck(png2)) err("different pictures need different names");
  }
  if (withImg("see ![fig](img:nope)").pack) err("a missing picture must be refused");
  if (withImg("see ![fig](data:image/png;base64,AAAA)").pack) err("inline data pictures must be refused");
  if (withImg("see ![fig](http://example.com/a.png)").pack) err("plain http pictures must be refused");
  if (!withImg("see ![fig](https://example.com/a.png)", { b: png }).pack) err("https pictures should be allowed");
  if (withImg("x ![f](img:a)", { a: "not a picture", b: png }).pack) err("bad picture data must be refused");
  if (!withImg("x ![f](img:a)", { a: png, b: png, c: png2 }).warnings.some((w) => w.includes("no question uses"))) err("unused pictures should warn");
  const mixed = mergePack(pi.pack!, parsePack({ ...base, questions: [{ ...mq("i2", "other ![fig](img:a)"), explanation: "e" }], images: { a: png } }).pack!);
  if (mixed.pack.questions.length !== 2) err("merge with pictures");
  console.log("pictures: ok");
  // editing one question at a time (admin)
  const E = mk([{ id: "t1", name: "T1", minutes: 30, sections: [{ name: "S", questions: [mq("t1-1", "a"), mq("t1-2", "b")] }] }]).pack!;
  const eq = (id: string, text: string) => checkQuestion(E, { ...mq(id, text), subject: "m" }, {}).question!;
  const up = upsertQuestion(E, eq("t1-2", "B edited"), { bank: "mock", mockId: "t1", section: "S" });
  if (up.mockTests[0].sections[0].questions[1].text !== "B edited" || up.mockTests[0].sections[0].questions.length !== 2) err("editing in place should keep the place");
  const mv = upsertQuestion(E, eq("t1-2", "B moved"), { bank: "practice" });
  if (mv.questions.at(-1)?.id !== "t1-2" || mv.mockTests[0].sections[0].questions.some((x) => x.id === "t1-2")) err("a moved question leaves its old bank");
  const rm = removeQuestion(removeQuestion(E, "t1-1"), "t1-2");
  if (rm.mockTests[0].sections.length !== 0) err("an emptied mock section should go away");
  const nw = upsertQuestion(E, eq("brand-1", "x"), { bank: "mock", mockId: "t1", section: "Second" });
  if (nw.mockTests[0].sections.length !== 2) err("a new section should be created");
  const fid = freeId(E, "alg");
  if (allQuestions(E).some((l) => l.q.id === fid)) err("freeId must be unused: " + fid);
  if (checkQuestion(E, { ...mq("zz", "x"), topic: "nope" }, {}).errors.length === 0) err("a question with an unknown topic must be refused");
  if (checkQuestion(E, { ...mq("zz", "price $5"), subject: "m" }, {}).errors.length === 0) err("a broken formula must be refused by the editor too");
  if (searchIds(E, "T1-2")[0]?.q.id !== "t1-2" || searchIds(E, "t1").length !== 2) err("id search should find by part of an id");
  const mv1 = moveQuestion(E, "t1", "S", "t1-1", 1);
  if (mv1.mockTests[0].sections[0].questions.map((x) => x.id).join() !== "t1-2,t1-1") err("moving a question down swaps it with the next");
  if (moveQuestion(E, "t1", "S", "t1-1", -1).mockTests[0].sections[0].questions[0].id !== "t1-1") err("the first question can't move up");
  const sec2 = upsertQuestion(E, eq("brand-2", "y"), { bank: "mock", mockId: "t1", section: "Second" });
  if (moveSection(sec2, "t1", "Second", -1).mockTests[0].sections[0].name !== "Second") err("sections should move");
  const rn = renameSection(sec2, "t1", "Second", "Renamed");
  if (typeof rn === "string" || rn.mockTests[0].sections[1].name !== "Renamed") err("a section should rename");
  if (typeof renameSection(sec2, "t1", "Second", "S") !== "string" || typeof renameSection(sec2, "t1", "Second", "  ") !== "string") err("a duplicate or empty section name must be refused");
  if (deleteSection(sec2, "t1", "Second").mockTests[0].sections.length !== 1) err("a section should delete");
  // ids come from the system unless the file writes them; a system id never overrides an existing question
  const noId = (text: string) => { const { id: _id, ...rest } = mq("x", text); void _id; return rest; };
  const have = mk([{ id: "t1", name: "T1", minutes: 30, sections: [{ name: "S", questions: [mq("t1-1", "a")] }] }]).pack!;
  const up1 = parsePack({ ...base, questions: [noId("p"), noId("q")], mockTests: [{ id: "t1", name: "T1", minutes: 30, sections: [{ name: "S", questions: [noId("m")] }] }] }, have);
  if (!up1.pack || up1.autoIds !== 3) err("questions without ids get system ids: " + up1.errors.join("; "));
  else {
    const ids = [...up1.pack.questions.map((x) => x.id), ...up1.pack.mockTests[0].sections[0].questions.map((x) => x.id)];
    if (ids.some((i) => allQuestions(have).some((l) => l.q.id === i))) err("a system id must never equal an existing id: " + ids);
    const mm2 = mergePack(have, up1.pack);
    if (mm2.report.replacedIds.length !== 0 || mm2.report.newQuestions !== 2 || mm2.report.newMockQuestions !== 1) err("id-less questions must be added, never override: " + JSON.stringify(mm2.report));
  }
  // explicit id elsewhere in the file is respected, and auto ids step around it
  const mixed2 = parsePack({ ...base, questions: [noId("p"), { ...mq("alg-1", "explicit"), text: "explicit" }] });
  if (!mixed2.pack || mixed2.pack.questions.map((x) => x.id).sort().join() !== "alg-1,alg-2") err("auto ids step around explicit ids in the same file: " + (mixed2.pack?.questions.map((x) => x.id) ?? mixed2.errors));
  // an explicit id that exists is reported as an override
  const over = mergePack(have, parsePack({ ...base, questions: [], mockTests: [{ id: "t1", name: "T1", minutes: 30, sections: [{ name: "S", questions: [mq("t1-1", "changed")] }] }] }, have).pack!);
  if (over.report.replacedIds.join() !== "t1-1") err("an existing id must be listed as overridden: " + JSON.stringify(over.report));
  if (mergePack(have, have).report.replacedIds.length !== 0) err("an identical question is not an override");
  if (!packPrompt().includes("Do NOT write an \"id\"")) err("the AI prompt should tell the AI not to write ids");
  console.log("admin edit: ok");
  console.log("mock tests: ok");
  {
    const q = (id: string, t: string) => ({ id, topic: t, difficulty: "easy", type: "mcq", marks: 1, text: `Q ${id}`, options: ["a", "b"], answer: 0 });
    const lp = parsePack({ name: "L", subjects: { s: "S" }, topics: [{ id: "t1", name: "T1", subject: "s", status: "shaky" }], questions: [q("t1-1", "t1"), q("t1-2", "t1")], mockTests: [{ id: "m1", name: "M1", minutes: 60, sections: [{ name: "A", questions: [q("m1-1", "t1")] }] }] });
    if (!lp.pack) err("links fixture: " + lp.errors.join("; "));
    else {
      const plan = parsePlan({ name: "P", phaseNames: { a: "A" }, days: [{ date: "2026-11-08", phase: "a", kind: "study", hours: 2, title: "T1 day", topics: ["t1"], tasks: ["x"], targetQs: 2 }, { date: "2026-11-09", phase: "a", kind: "mock", hours: 3, title: "Mock", topics: [], tasks: ["y"], targetQs: 0 }] }).plan!;
      if (!linkPrompt(plan, lp.pack).includes("t1-2 | t1")) err("prompt must list question ids");
      if (linkPrompt(plan, lp.pack).includes("MY CURRENT LINKS")) err("no links, so no current-links section");
      const withCur = linkPrompt(plan, lp.pack, { withText: true }, { "2026-11-08": { q: ["t1-1", "gone"], note: "n" } });
      if (!withCur.includes("MY CURRENT LINKS") || !withCur.includes('"practice":["t1-1"]') || withCur.includes("gone")) err("current links must be included, minus ids that no longer exist");
      if (linkPrompt(plan, lp.pack, { withText: false }).includes("Q t1-2")) err("prompt without text must omit question text");
      const r = parseLinks({ days: [{ date: "2026-11-08", practice: ["t1-1", "nope", "m1-1", "t1-1"], note: "go" }, { date: "2026-11-09", mock: "m1" }, { date: "2030-01-01", practice: ["t1-2"] }, { date: "2026-11-09", practice: ["t1-1"] }] }, plan, lp.pack);
      if (!r.links || r.questions !== 1 || r.mocks !== 1 || r.days !== 2) err("parseLinks counts wrong: " + JSON.stringify(r));
      if (r.links?.["2026-11-08"]?.q.join() !== "t1-1" || r.links?.["2026-11-09"]?.q.join() !== "t1-1") err("a question may repeat across days but not within a day");
      if (r.warnings.length !== 3) err("expected warnings for unknown id, mock id, bad date only (repeats across days are allowed): " + r.warnings.join(" | "));
      if (parseLinks({ days: [{ date: "2030-01-01", practice: ["x"] }] }, plan, lp.pack).links) err("nothing valid must be an error");
      if (parseLinks("nope", plan, lp.pack).links) err("non-object must fail");
      const cut = readAnswer('```json\n{ "days": [ { "date": "2026-11-08", "practice": ["t1-1"] }, { "date": "2026-11-09", "mock": "m1" }\n]');
      if (cut.errors.length || cut.warnings.length !== 1 || !parseLinks(cut.value, plan, lp.pack).links) err("a cut-off answer should be repaired with a warning: " + JSON.stringify(cut));
      if (readAnswer("hello {").errors.length !== 1) err("garbage must give one friendly error");
      if (liveQuestionIds({ q: ["t1-1", "gone"] }, lp.pack).missing !== 1) err("missing ids must be counted");
    }
    console.log("plan links: ok");
  }
}
{
  const sg = segments("Use `x = $5` here, then $a+b$ and\n```python\nprint(\"$\")\n```");
  if (sg.find((x) => x.kind === "icode")?.value !== "x = $5") err("inline code must keep its text as typed");
  if (sg.filter((x) => x.kind === "inline").length !== 1) err("maths next to inline code must still be maths");
  const f = parseFence(sg.find((x) => x.kind === "code")!.value);
  if (f.lang !== "python" || f.code !== 'print("$")') err("fence parse wrong: " + JSON.stringify(f));
  if (texProblems("Use `$` and `\\frac` in code").length) err("dollar signs inside inline code are not maths problems");
  if (!texProblems("```python\nx=1").length) err("an unclosed code block must be reported");
  if (languageOf("py") !== "python" || languageOf("C++") !== "cpp" || languageOf("klingon") !== null) err("language names/aliases");
  const h = highlightCode("def f(x):\n  return x < 2", "python");
  if (!h || !h.includes("hljs-keyword") || !h.includes("&lt;")) err("python code must be coloured and escaped: " + h);
  if (highlightCode("<b>x</b>", "") !== null) err("no language means no colouring");
  if (!packPrompt().includes("single backticks")) err("the pack prompt must explain code");
  const lines = segments("Program:\n`Count(x, y) {`\n`    if (y != 1) {`\n`    }`\n`}`\nend");
  if (lines.some((x) => x.kind === "icode") || lines.filter((x) => x.kind === "code").length !== 1) err("backtick lines must become one plain block: " + JSON.stringify(lines));
  if (parseFence(lines.find((x) => x.kind === "code")!.value).code !== "Count(x, y) {\n    if (y != 1) {\n    }\n}") err("indentation inside the merged block must be kept");
  if (mergeTickLines("a `x` b\n`y`") !== "a `x` b\n`y`") err("one lone inline line must stay inline");
  console.log("code: ok");
  {
    const mq = (id: string, t: string) => ({ subject: "s", topic: t, difficulty: "easy", type: "mcq", marks: 1, text: `Q ${id}`, options: ["a", "b"], answer: 0, explanation: "e" });
    const tp = parsePack({ name: "T", subjects: { s: "S" }, topics: [{ id: "a", name: "Topic A", subject: "s", status: "shaky" }, { id: "b", name: "Topic B", subject: "s", status: "know" }], questions: [mq("1", "a"), mq("2", "a"), mq("3", "b"), mq("4", "b")] });
    if (!tp.pack) err("topic fixture: " + tp.errors.join("; "));
    else {
      const m = buildMock(tp.pack, { kind: "topic", topic: "a", seed: 1, seenIds: new Set() });
      if (m.questions.length !== 2 || m.questions.some((q) => q.topic !== "a")) err("a topic test must hold only that topic's questions: " + JSON.stringify(m.questions.map((q) => q.topic)));
      if (!m.title.includes("Topic A")) err("topic test title");
    }
    console.log("topic test: ok");
  {
    const cq = (extra: Record<string, unknown>, ...rest: Record<string, unknown>[]) => ({ subject: "s", topic: "a", difficulty: "easy", type: "code", marks: 2, text: "Print the sum.", explanation: "e", language: "python", tests: [{ input: "1 2", output: "3" }], ...extra, ...Object.assign({}, ...rest) });
    const base = { name: "C", subjects: { s: "S" }, topics: [{ id: "a", name: "A", subject: "s", status: "shaky" }] };
    const ok = parsePack({ ...base, questions: [cq({ language: "py", tests: [{ input: "1 2", output: 3 }, { input: "5 5", output: "10", hidden: true }], solution: "print(1)" })] });
    if (!ok.pack || ok.pack.questions[0].code?.language !== "python" || ok.pack.questions[0].code?.tests[0].output !== "3") err("code question must parse (alias py, numeric output): " + ok.errors.join("; "));
    const again = parsePack(packToJson(ok.pack!));
    if (!again.pack || JSON.stringify(again.pack.questions[0].code) !== JSON.stringify(ok.pack!.questions[0].code)) err("code question must survive export and import");
    for (const [name, bad] of [["no tests", { tests: [] }], ["bad language", { language: "cobol" }], ["only hidden", { tests: [{ input: "", output: "1", hidden: true }] }], ["test without output", { tests: [{ input: "1" }] }]] as const)
      if (parsePack({ ...base, questions: [cq({}, bad)] }).pack) err(`code question with ${name} must be refused`);
    if (parsePack({ ...base, questions: [], mockTests: [{ id: "m", name: "M", minutes: 30, sections: [{ name: "S", questions: [cq({})] }] }] }).pack) err("code questions must be refused inside mock tests");
    // programming questions never leak into generated tests
    const mixed = parsePack({ ...base, questions: [cq({ marks: 1 }), { subject: "s", topic: "a", difficulty: "easy", type: "mcq", marks: 1, text: "q", options: ["a", "b"], answer: 0, explanation: "e" }] });
    if (buildMock(mixed.pack!, { kind: "topic", topic: "a", seed: 3, seenIds: new Set() }).questions.some((q) => q.type === "code")) err("programming questions must not enter generated tests");
    if (!sameOutput("1 2\r\n3  \n\n", "1 2\n3") || sameOutput("1", "2") || sameOutput("a b", "a  b")) err("output comparison rules");
    // real runs on this computer, for every language that is installed here
    const progs: Record<string, string> = {
      python: "print(sum(map(int, input().split())))",
      javascript: "const [a,b]=require('fs').readFileSync(0,'utf8').trim().split(' ').map(Number); console.log(a+b)",
      c: '#include <stdio.h>\nint main(){int a,b;scanf("%d %d",&a,&b);printf("%d\\n",a+b);return 0;}',
      cpp: "#include <iostream>\nint main(){int a,b;std::cin>>a>>b;std::cout<<a+b<<std::endl;}",
      java: "import java.util.*;\npublic class Main{public static void main(String[] x){Scanner s=new Scanner(System.in);System.out.println(s.nextInt()+s.nextInt());}}",
    };
    for (const [lang, code] of Object.entries(progs)) {
      if (!commandFor(lang as never)) { console.log(`  (skipped ${lang}: not installed here)`); continue; }
      const r = await judge(lang as never, code, ["1 2", "40 2"], 5000);
      if (r.compileError || r.results.map((x) => x.stdout.trim()).join() !== "3,42") err(`${lang} run failed: ` + JSON.stringify(r).slice(0, 300));
    }
    if (commandFor("python")) {
      const loop = await judge("python", "while True: pass", [""], 700);
      if (loop.results[0]?.status !== "timeout") err("an endless loop must time out: " + JSON.stringify(loop));
      const crash = await judge("python", "print(1/0)", [""], 3000);
      if (crash.results[0]?.status !== "runtime_error" || !crash.results[0].stderr.includes("ZeroDivision")) err("a crash must report the error");
      const bad = await judge("c", "int main( {", [""], 3000);
      if (commandFor("c") && !bad.compileError) err("a compile error must be reported");
    }
    {
      // the two examples in the pack prompt must parse, and their solutions must pass on the data their "setup" describes
      const pr = packPrompt();
      const ex = [...pr.matchAll(/^\{ "subject": "cs".*$/gm)].map((m) => JSON.parse(m[0]));
      if (ex.length !== 2) err("the prompt should hold two setup examples, found " + ex.length);
      const parsed = parsePack({ name: "E", subjects: { cs: "CS" }, topics: [{ id: "files", name: "F", subject: "cs", status: "shaky" }, { id: "sql", name: "S", subject: "cs", status: "shaky" }], questions: ex });
      if (!parsed.pack) err("prompt examples must parse: " + parsed.errors.join("; "));
      else if (commandFor("python")) {
        const root = mkdtempSync(join(tmpdir(), "orbit-ex-"));
        mkdirSync(join(root, "data/sub/deep"), { recursive: true });
        writeFileSync(join(root, "data/a.txt"), "hello"); writeFileSync(join(root, "data/notes.md"), "abc");
        writeFileSync(join(root, "data/sub/b.txt"), "0123456789"); writeFileSync(join(root, "data/sub/deep/c.txt"), "x");
        const fsq = parsed.pack.questions[0].code!;
        const a = await judge("python", fsq.solution!, [""], 5000, root);
        if (!sameOutput(fsq.tests[0].output, a.results[0]?.stdout ?? "")) err("files example: " + JSON.stringify(a));
        const sqlRoot = mkdtempSync(join(tmpdir(), "orbit-ex-"));
        const mk = await judge("python", "import sqlite3\nc = sqlite3.connect('shop.db')\nc.execute('CREATE TABLE orders(id INTEGER PRIMARY KEY, customer TEXT, amount INTEGER)')\nc.executemany('INSERT INTO orders VALUES (?,?,?)', [(1,'asha',100),(2,'ravi',250),(3,'asha',50)])\nc.commit()", [""], 5000, sqlRoot);
        if (mk.results[0]?.status !== "ok") err("could not build the sql example data: " + JSON.stringify(mk));
        const sq = parsed.pack.questions[1].code!;
        const b = await judge("python", sq.solution!, [""], 5000, sqlRoot);
        if (!sameOutput(sq.tests[0].output, b.results[0]?.stdout ?? "")) err("sql example: " + JSON.stringify(b));
        const sp = setupPrompt(parsed.pack.questions[0]);
        if (!sp.includes("EXACTLY") || !sp.includes("EXPECTED OUTPUT") || !sp.includes("a.txt") || !sp.includes("FULL path")) err("setup prompt is missing parts");
        const lost = await judge("python", "print(open('data/a.txt').read())", [""], 3000);
        if (lost.results[0]?.status === "ok") err("without a practice folder the data must not exist");
      }
    }
    console.log("code questions: ok");
  }
  }
}

{
  const mk = (id: string, topic: string, type: "mcq" | "msq" | "nat" | "code", marks = 1) => ({ id, topic, type, marks, text: "t", answer: type === "nat" ? 1 : "A", explanation: "e" }) as any;
  const pk: any = {
    name: "T", subjects: { s1: "Subj" }, topics: [{ id: "a", name: "Alpha", subject: "s1" }, { id: "b", name: "Beta", subject: "s1" }, { id: "c", name: "Gamma", subject: "s1" }],
    questions: [mk("1", "a", "mcq"), mk("2", "a", "mcq", 2), mk("3", "a", "nat"), mk("4", "b", "code", 5)], mocks: [], useBuiltinGenerators: false,
    mockTests: [{ id: "m1", name: "Mock 1", minutes: 60, sections: [{ name: "S", questions: [mk("5", "b", "msq", 2), mk("6", "a", "mcq")] }] }],
  };
  const bd = typeBreakdown(pk);
  const a = bd.practice.rows.find((r) => r.key === "a")!;
  if (a.counts.mcq !== 2 || a.counts.nat !== 1 || a.total !== 3 || a.marks !== 4) err("practice row wrong");
  if (bd.practice.totals.total !== 4 || bd.practice.totals.counts.code !== 1 || bd.practice.totals.marks !== 9) err("practice totals wrong");
  if (bd.practice.topicsWithout !== 1) err("topicsWithout wrong");
  if (bd.mock.totals.total !== 2 || bd.mock.totals.counts.msq !== 1 || bd.mocks[0].marks !== 3 || bd.mocks[0].minutes !== 60) err("mock breakdown wrong");
  if (bd.practice.rows[0].name !== "Alpha" || bd.practice.rows[0].subject !== "Subj") err("row naming wrong");
  console.log("typeBreakdown: ok");
}

{
  const mk = (id: string, topic: string, tags: string[] = [], subject?: string) => ({ id, topic, difficulty: "easy", type: "mcq", marks: 1, text: "t", answer: 0, explanation: "e", tags, subject }) as any;
  const pk: any = { name: "T", subjects: { s1: "Maths", s2: "CS" }, topics: [{ id: "a", name: "Alpha", subject: "s1" }, { id: "b", name: "Beta", subject: "s2" }, { id: "c", name: "Gamma", subject: "s2" }], questions: [], mocks: [], mockTests: [], useBuiltinGenerators: false };
  const qs = [mk("1", "a", ["trap"]), mk("2", "b", ["trap", "deep"]), mk("3", "c", ["deep"]), mk("4", "c", [], "s1")];
  const f = facets(pk, qs);
  if (f.subject.map((x) => x.label + x.count).join() !== "Maths2,CS2") err("subject facets wrong: " + f.subject.map((x) => x.label + x.count));
  if (f.topic.length !== 3 || f.tag[0].label !== "deep" && f.tag[0].label !== "trap") err("topic/tag facets wrong");
  const ids = (picked: string[]) => qs.filter(makeMatcher(pk, picked)).map((q) => q.id).join();
  if (ids([]) !== "1,2,3,4") err("empty filter should keep all");
  if (ids(["subject:s2"]) !== "2,3") err("subject filter wrong: " + ids(["subject:s2"]));
  if (ids(["subject:s2", "tag:trap"]) !== "2") err("groups should AND: " + ids(["subject:s2", "tag:trap"]));
  if (ids(["tag:trap", "tag:deep"]) !== "1,2,3") err("same group should OR");
  if (ids(["topic:a", "topic:b"]) !== "1,2") err("topic filter wrong");
  console.log("questionFilter: ok");
}

{
  const base = { name: "D", subjects: { m: "Maths" }, topics: [{ id: "alg", subject: "m", name: "Algebra" }] };
  const mq = (extra: object) => ({ id: "q1", topic: "alg", type: "nat", marks: 1, text: "t", answer: 1, explanation: "e", ...extra });
  const none = parsePack({ ...base, questions: [mq({}), mq({ id: "q2" })] });
  if (none.pack || !none.errors[0]?.includes("2 questions have no difficulty")) err("missing difficulty should fail with one summary: " + none.errors[0]);
  const bad = parsePack({ ...base, questions: [mq({ difficulty: "brutal" })] });
  if (bad.pack || !bad.errors.join().includes('"easy", "medium" or "hard"')) err("bad difficulty should fail");
  const ok = parsePack({ ...base, questions: [mq({ difficulty: "Hard" })] });
  if (ok.pack?.questions[0].difficulty !== "hard") err("difficulty should be accepted in any case");
  const legacy = parsePack({ ...base, questions: [mq({ tags: ["easy", "trap"] })] });
  if (legacy.pack?.questions[0].difficulty !== "easy" || legacy.pack?.questions[0].tags?.join() !== "trap") err("an easy/medium/hard tag should become the difficulty and leave the tags");
  const inMock = parsePack({ ...base, questions: [], mockTests: [{ id: "m1", name: "M", minutes: 30, sections: [{ name: "S", questions: [mq({})] }] }] });
  if (inMock.pack) err("mock-test questions need a difficulty too");
  const f = facets(ok.pack!, ok.pack!.questions);
  if (f.difficulty.map((x) => x.label).join() !== "Hard") err("difficulty facet wrong");
  const old: any = { ...ok.pack!.questions[0], difficulty: undefined, tags: ["medium", "x"] };
  if (!makeMatcher(ok.pack!, ["difficulty:medium"])(old) || facets(ok.pack!, [old]).tag.some((x) => x.label === "medium")) err("saved packs with a difficulty tag should still filter by difficulty");
  const round = parsePack(JSON.parse(JSON.stringify(packToJson(ok.pack!))));
  if (round.pack?.questions[0].difficulty !== "hard") err("difficulty should survive export and import");
  console.log("difficulty: ok");
}

{
  const pr = packPrompt();
  for (const need of ['"difficulty"', '"tolerance"', '"mockTests"', '"mocks"', '"images"', '"status"', '"timeLimitMs"', '"setup"', '"hidden"', "at most 48", "5 to 600", "Python and JavaScript programs run inside the app"])
    if (!pr.includes(need)) err("pack prompt should mention " + need);
  const ex = pr.slice(pr.lastIndexOf("Here is a valid example"));
  const json = ex.slice(ex.indexOf("{"));
  const r = parsePack(JSON.parse(json));
  if (!r.pack) err("the example inside the AI prompt must itself be a valid pack: " + r.errors.join(" | "));
  console.log("prompt: ok");
}

{
  const f = (name: string, data: object) => ({ name, text: JSON.stringify(data) });
  const q = (extra: object) => ({ topic: "alg", difficulty: "easy", type: "nat", marks: 1, text: "t", answer: 1, explanation: "e", ...extra });
  const a = f("a.json", { name: "A", subjects: { m: "Maths" }, topics: [{ id: "alg", subject: "m", name: "Algebra" }], questions: [q({}), q({ id: "keep", text: "old" })] });
  const b = f("b.json", { name: "B", subjects: { c: "CS" }, topics: [{ id: "alg", subject: "m", name: "Algebra" }, { id: "sql", subject: "c", name: "SQL" }], questions: [q({}), q({ topic: "sql" }), q({ id: "keep", text: "new" })] });
  const m = mergeFiles([a, b], new Date("2026-11-08T10:00:00Z"));
  if (!m.json || !m.name?.startsWith("Merged pack · 2 files · ")) err("merged name wrong: " + m.name);
  const r = parsePack(JSON.parse(m.json!));
  if (!r.pack) err("merged pack should be valid: " + r.errors.join("|"));
  else {
    if (r.pack.questions.length !== 4) err("expected 4 questions after merging, got " + r.pack.questions.length);
    if (new Set(r.pack.questions.map((x) => x.id)).size !== 4) err("merged ids should be unique (auto ids numbered once)");
    if (r.pack.questions.find((x) => x.id === "keep")?.text !== "new") err("later file should win for a repeated id");
    if (r.pack.topics.length !== 2 || Object.keys(r.pack.subjects).length !== 2) err("topics and subjects should be combined");
  }
  if (!m.notes.some((n) => n.includes("1 question, mock test or recipe id appears"))) err("should note the repeated id: " + m.notes.join("|"));
  const bad = mergeFiles([a, { name: "broken.json", text: "{nope" }]);
  if (bad.json || !bad.errors[0]?.startsWith("broken.json")) err("an unreadable file should name itself in the error");
  const tp = { subjects: { m: "Maths" }, topics: [{ id: "alg", subject: "m", name: "Algebra" }], questions: [] };
  const pic = mergeFiles([f("p1", { ...tp, images: { x: "data:image/png;base64,AAAA" } }), f("p2", { ...tp, images: { x: "data:image/png;base64,BBBB" } })]);
  if (pic.json || !pic.errors[0]?.includes('"x"')) err("same picture name with different pictures should be refused");
  // errors come grouped by the file they are in
  const noDiff = f("no-difficulty.json", { ...tp, questions: [{ topic: "alg", type: "nat", marks: 1, text: "t", answer: 1, explanation: "e" }] });
  const srcTag = f("source-tags.json", { ...tp, questions: [q({ tags: ["pw-dpp"] })] });
  const fine = f("fine.json", { ...tp, questions: [q({ tags: ["formula"] })] });
  const g = mergeFiles([noDiff, fine, srcTag]);
  if (g.json || g.problems.map((x) => x.file).join() !== "no-difficulty.json,source-tags.json") err("problems should name exactly the broken files: " + g.problems.map((x) => x.file));
  if (!g.problems[0].errors[0].includes("no difficulty") || !g.problems[1].errors[0].includes("pw-dpp")) err("each file should carry its own error");
  // a file may rely on topics declared in another file
  const lean = f("lean.json", { questions: [q({})] });
  const ok2 = mergeFiles([fine, lean]);
  if (!ok2.json) err("a file that uses topics declared in another file should still merge: " + ok2.errors.join("|"));
  console.log("mergeFiles: ok");
}

{
  const base = { name: "T", subjects: { m: "Maths" }, topics: [{ id: "alg", subject: "m", name: "Algebra" }] };
  const mk = (tags: string[], extra: object = {}) => ({ topic: "alg", difficulty: "easy", type: "nat", marks: 1, text: "t", answer: 1, explanation: "e", tags, ...extra });
  const r1 = parsePack({ ...base, questions: [mk(["pw-swt-3"]), mk(["mst"]), mk(["formula"]), mk(["nptel-practice"]), mk(["week-4"]), mk(["wt01"])] });
  if (r1.pack || !r1.errors[0]?.includes("pw-swt-3") || !r1.errors[0]?.includes("mst") || !r1.errors[0]?.includes("nptel-practice")) err("source tags should be refused in one summary: " + r1.errors[0]);
  if (r1.errors[0]?.includes("formula")) err("a general tag must not be flagged");
  const ok = parsePack({ ...base, questions: [mk(["formula", "calculation", "trap"]), mk(["hypothesis-test", "series", "set-theory"]), mk(["2nf"])] });
  if (!ok.pack) err("general tags (even with digits like 2nf, or the words series/test/set) should pass: " + ok.errors.join("|"));
  const many = parsePack({ ...base, questions: [mk(["a", "b", "c", "d"])] });
  if (many.pack || !many.errors[0]?.includes("more than 3 tags")) err("more than 3 tags per question should be refused");
  const wide = parsePack({ ...base, questions: Array.from({ length: 41 }, (_, i) => mk(["t" + "x".repeat(i % 5) + String.fromCharCode(97 + (i % 26)) + String.fromCharCode(97 + Math.floor(i / 26))])) });
  if (wide.pack || !wide.errors.join().includes("41 different tags")) err("more than 40 distinct tags should be refused: " + wide.errors[0]);
  const have = parsePack({ ...base, questions: Array.from({ length: 30 }, (_, i) => mk(["g" + String.fromCharCode(97 + i)])) });
  const adding = parsePack({ ...base, questions: Array.from({ length: 15 }, (_, i) => mk(["n" + String.fromCharCode(97 + i)])) }, have.pack!);
  if (!have.pack || adding.pack || !adding.errors.join().includes("counting the pack you are adding to")) err("tags should be counted together with the pack you are adding to");
  const pr = packPrompt(have.pack!);
  if (!pr.includes("Tags already in my pack (30)")) err("the adding prompt should list the pack's tags");
  if (!packPrompt().includes("TAG") && !packPrompt().includes("tag vocabulary")) err("prompt should carry the tag rules");
  console.log("tag rules: ok");
}

{
  const base = { name: "S", subjects: { cs: "CS" }, topics: [{ id: "ai", subject: "cs", name: "Search" }] };
  const mk = (extra: object) => ({ topic: "ai", difficulty: "easy", type: "str", marks: 1, text: "List OPEN.", explanation: "e", ...extra });
  const ok = parsePack({ ...base, questions: [mk({ match: "list", answer: "I,D,B" }), mk({ answer: ["E", "e2"] }), mk({ match: "set", answer: "NIL", caseSensitive: true })] });
  if (!ok.pack) err("str questions should parse: " + ok.errors.join("|"));
  const qs = ok.pack?.questions ?? [];
  const okc = (i: number, given: string) => isCorrect(qs[i], given);
  if (!okc(0, " i , d,b ") || okc(0, "I,B,D") || okc(0, "I,D") || okc(0, "")) err("ordered list grading wrong");
  if (!okc(1, "E") || !okc(1, " e2 ") || okc(1, "F")) err("a list of accepted answers: any one should pass");
  if (!okc(2, "nil") || !okc(2, "NIL") || okc(2, "A")) err("NIL should mean the empty list");
  const setQ = parsePack({ ...base, questions: [mk({ match: "set", answer: "I,D,B" })] }).pack!.questions[0];
  if (!isCorrect(setQ, "B, I,D") || !isCorrect(setQ, "d,b,i,i") || isCorrect(setQ, "I,D")) err("set grading wrong");
  const caseQ = parsePack({ ...base, questions: [mk({ answer: "Ab", caseSensitive: true })] }).pack!.questions[0];
  if (isCorrect(caseQ, "ab") || !isCorrect(caseQ, " A b ")) err("caseSensitive grading wrong");
  if (formatAnswer(setQ) !== "I,D,B (any order)" || formatAnswer(qs[1]) !== "E  or  e2") err("formatAnswer for str wrong: " + formatAnswer(setQ));
  // the scraper bug: a text list must never be accepted as a nat number
  const asNat = parsePack({ ...base, questions: [mk({ type: "nat", answer: "I,D,B" })] });
  if (asNat.pack) err("a text answer on a nat question must be refused");
  for (const bad of [{ options: ["a", "b"] }, { answer: 5 }, { answer: [] }, { answer: "" }, { match: "fuzzy" }, { caseSensitive: "yes" }]) {
    if (parsePack({ ...base, questions: [mk({ answer: "x", ...bad })] }).pack) err("bad str question accepted: " + JSON.stringify(bad));
  }
  const inMock = parsePack({ ...base, questions: [], mockTests: [{ id: "m", name: "M", minutes: 30, sections: [{ name: "S", questions: [mk({ answer: "x" })] }] }] });
  if (inMock.pack || !inMock.errors.join().includes("str")) err("str questions must be refused in mock tests");
  const back = parsePack(JSON.parse(JSON.stringify(packToJson(ok.pack!))));
  if (JSON.stringify(back.pack?.questions.map((q) => [q.match, q.caseSensitive, q.answer])) !== JSON.stringify(qs.map((q) => [q.match, q.caseSensitive, q.answer]))) err("str should survive export and import");
  const drawn = buildMock({ ...ok.pack!, questions: [...qs, ...qs.map((q, i) => ({ ...q, id: "z" + i }))] }, { kind: "subject", subject: "cs", seed: 5, seenIds: new Set() });
  if (drawn.questions.some((q) => q.type === "str")) err("generated mocks must never contain str questions");
  if (!packPrompt().includes('"str"') || !packPrompt().includes("NEVER use \"nat\" for a text answer")) err("prompt should describe str and warn against nat");
  if (typeBreakdown(ok.pack!).practice.totals.counts.str !== 3) err("breakdown should count str");
  console.log("str type: ok");
}

{
  // a huge question bank must never produce a prompt longer than the budget
  const topics = Array.from({ length: 40 }, (_, i) => ({ id: "tp" + i, name: "Topic " + i, subject: "s", status: "shaky" }));
  const qs = Array.from({ length: 5000 }, (_, i) => ({ id: `tp${i % 40}-${Math.floor(i / 40) + 1}`, topic: "tp" + (i % 40), difficulty: "easy", type: i % 3 ? "mcq" : "nat", marks: 1 + (i % 2), tags: ["conceptual", "formula"], text: "A fairly long question text number " + i + " that goes on for a while so that each line is heavy.", options: ["a", "b"], answer: 0 }));
  const big = parsePack({ name: "Big", subjects: { s: "S" }, topics, questions: qs });
  if (!big.pack) err("big fixture: " + big.errors.slice(0, 2).join("; "));
  else {
    const plan = parsePlan({ name: "P", phaseNames: { a: "A" }, days: [{ date: "2026-11-09", phase: "a", kind: "study", hours: 2, title: "Topic 3 day", topics: ["tp3"], tasks: ["x"], targetQs: 6 }] }).plan!;
    const full = linkPrompt(plan, big.pack, { withText: true });
    if (!isTooLong(full) || full.length <= PROMPT_LIMIT) err("5000 questions should be too long to paste");
    if (!full.includes("tp39-125 |") || !full.includes("| easy |") || !full.includes("MY MOCK TESTS")) err("the long prompt must stay complete (every id, difficulty, mocks)");
    const small = linkPrompt(plan, { ...big.pack, questions: big.pack.questions.slice(0, 20) }, { withText: true });
    if (isTooLong(small) || !small.includes("start of the question")) err("a small bank should paste normally");
    const bf = bankFile(big.pack), pf = planFile(plan, {}, big.pack);
    if (bf.questions.length !== 5000 || bf.questions[0].difficulty !== "easy" || !bf.questions[0].text || "answer" in bf.questions[0]) err("bank file must hold every question with text, no answers");
    if (bf.questionCount !== 5000) err("bank file must state its question count");
    if (pf.days.length !== 1 || pf.days[0].date !== "2026-11-09") err("plan file must hold the plan days");
    const fp = filesPrompt(false);
    if (fp.length > 6000 || !fp.includes("RULES") || !fp.includes("question-bank.json") || fp.includes("tp3-")) err("files prompt should be short, with the rules");
    if (!filesPrompt(true).includes("currentLinks")) err("files prompt should mention current links when improving");
    console.log("prompt size: ok", full.length, fp.length);
  }
}
console.log(bad ? `${bad} PROBLEMS` : "ALL OK");

// ---- statistics ----
{
  const sp = parsePack(JSON.parse(packTemplateJson())).pack!;
  if (sp.questions.some((q) => !q.subject)) err("every parsed question must carry its subject");
  if (!sp.questions[0].tags?.includes("linear-equation")) err("optional tags must be kept");
  const clash = parsePack({ ...JSON.parse(packTemplateJson()), questions: [{ subject: "sci", topic: "algebra", difficulty: "easy", type: "nat", marks: 1, text: "q", answer: 1 }] });
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
