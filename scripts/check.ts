import { activity, applyFilters, breakdown, buildEvents, insights, metrics, NO_FILTER, rank, tagStats } from "../lib/stats";
import { statsSheets } from "../lib/statsSheets";
import { buildXlsx } from "../lib/xlsx";
import { writeFileSync } from "node:fs";
import { BANK } from "../lib/gateBank";
import { GENERATORS, generate } from "../lib/generators";
import { buildFixedMock, buildMock } from "../lib/mock";
import { TOPICS } from "../lib/topics";
import { GATE_PLAN } from "../lib/gatePlan";
import { EMPTY_PACK, parsePack, packPrompt, packTemplateJson, packToJson, mergePack, mergeChanges, allQuestions } from "../lib/packs";
import { gatePackJson, gatePlanJson } from "./export-gate";
import { aiPrompt, parsePlan, templateJson } from "../lib/customPlan";
import { hashData as hashDataCheck } from "../lib/images";
import { checkQuestion, deleteSection, freeId, moveQuestion, moveSection, removeQuestion, renameSection, searchIds, upsertQuestion } from "../lib/packEdit";
import type { Attempt } from "../lib/types";
import { setupPrompt } from "../lib/setupPrompt";
import { mkdtempSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { judge, commandFor } from "../lib/runner";
import { sameOutput } from "../lib/judge";
import { segments, texProblems, parseFence, mergeTickLines } from "../lib/tex";
import { highlightCode, languageOf } from "../lib/highlight";
import { linkPrompt, parseLinks, liveQuestionIds, readAnswer } from "../lib/links";

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
else if (tp.pack.questions.length !== 5 || tp.pack.mockTests.length !== 1) err("pack template shape changed");
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
{
  const mk = (extra: object) => parsePack({ name: "P", subjects: { m: "Maths" }, topics: [{ id: "alg", subject: "m", name: "Algebra" }], questions: [], ...extra });
  const q = (id: string, text: string) => ({ id, topic: "alg", type: "nat", marks: 1, text, answer: 1, explanation: "e" });
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
  const mq = (id: string, text: string) => ({ id, topic: "alg", type: "nat", marks: 1, text, answer: 1, explanation: "e" });
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
    const q = (id: string, t: string) => ({ id, topic: t, type: "mcq", marks: 1, text: `Q ${id}`, options: ["a", "b"], answer: 0 });
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
    const mq = (id: string, t: string) => ({ subject: "s", topic: t, type: "mcq", marks: 1, text: `Q ${id}`, options: ["a", "b"], answer: 0, explanation: "e" });
    const tp = parsePack({ name: "T", subjects: { s: "S" }, topics: [{ id: "a", name: "Topic A", subject: "s", status: "shaky" }, { id: "b", name: "Topic B", subject: "s", status: "know" }], questions: [mq("1", "a"), mq("2", "a"), mq("3", "b"), mq("4", "b")] });
    if (!tp.pack) err("topic fixture: " + tp.errors.join("; "));
    else {
      const m = buildMock(tp.pack, { kind: "topic", topic: "a", seed: 1, seenIds: new Set() });
      if (m.questions.length !== 2 || m.questions.some((q) => q.topic !== "a")) err("a topic test must hold only that topic's questions: " + JSON.stringify(m.questions.map((q) => q.topic)));
      if (!m.title.includes("Topic A")) err("topic test title");
    }
    console.log("topic test: ok");
  {
    const cq = (extra: Record<string, unknown>, ...rest: Record<string, unknown>[]) => ({ subject: "s", topic: "a", type: "code", marks: 2, text: "Print the sum.", explanation: "e", language: "python", tests: [{ input: "1 2", output: "3" }], ...extra, ...Object.assign({}, ...rest) });
    const base = { name: "C", subjects: { s: "S" }, topics: [{ id: "a", name: "A", subject: "s", status: "shaky" }] };
    const ok = parsePack({ ...base, questions: [cq({ language: "py", tests: [{ input: "1 2", output: 3 }, { input: "5 5", output: "10", hidden: true }], solution: "print(1)" })] });
    if (!ok.pack || ok.pack.questions[0].code?.language !== "python" || ok.pack.questions[0].code?.tests[0].output !== "3") err("code question must parse (alias py, numeric output): " + ok.errors.join("; "));
    const again = parsePack(packToJson(ok.pack!));
    if (!again.pack || JSON.stringify(again.pack.questions[0].code) !== JSON.stringify(ok.pack!.questions[0].code)) err("code question must survive export and import");
    for (const [name, bad] of [["no tests", { tests: [] }], ["bad language", { language: "cobol" }], ["only hidden", { tests: [{ input: "", output: "1", hidden: true }] }], ["test without output", { tests: [{ input: "1" }] }]] as const)
      if (parsePack({ ...base, questions: [cq({}, bad)] }).pack) err(`code question with ${name} must be refused`);
    if (parsePack({ ...base, questions: [], mockTests: [{ id: "m", name: "M", minutes: 30, sections: [{ name: "S", questions: [cq({})] }] }] }).pack) err("code questions must be refused inside mock tests");
    // programming questions never leak into generated tests
    const mixed = parsePack({ ...base, questions: [cq({ marks: 1 }), { subject: "s", topic: "a", type: "mcq", marks: 1, text: "q", options: ["a", "b"], answer: 0, explanation: "e" }] });
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
