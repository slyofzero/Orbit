// A "question pack" is what makes Practice and Mocks work: the topics, the practice questions, and separate mock tests that each own their questions.
// Nothing is built in. Upload a pack (JSON) on the Practice page and the app uses it. Pure functions, tested by scripts/check.ts.
import { Question, Topic, TopicStatus } from "./types";
import { repairBackslashes, texProblems } from "./tex";
import { DATA_IMG, IMG, MAX_IMAGE, MAX_IMAGES_TOTAL, MAX_IMAGE_COUNT, hashData } from "./images";

export interface MockPick { subject: string; one: number; two: number; topics?: string[] }
export interface MockSection { name: string; picks: MockPick[] }
export interface MockTemplate { id: string; name: string; minutes: number; note?: string; sections: MockSection[] }

/** A complete mock test with its own questions. Each question belongs to exactly one mock test and never shows up in Practice or in another mock. */
export interface FixedMock { id: string; name: string; minutes: number; note?: string; sections: { name: string; questions: Question[] }[] }

export interface PackData {
  name: string;
  subjects: Record<string, string>; // subject id -> display name, in display order
  topics: Topic[];
  questions: Question[];
  mocks: MockTemplate[]; // old-style recipes: they draw from the practice questions
  mockTests: FixedMock[]; // real mock tests, each with questions of its own
  useBuiltinGenerators: boolean; // only the GATE DA pack sets this: asks for endless fresh numeric questions made by code
}

export const EMPTY_PACK: PackData = { name: "No question pack yet", subjects: {}, topics: [], questions: [], mocks: [], mockTests: [], useBuiltinGenerators: false };

export interface PackResult { pack: PackData | null; errors: string[]; warnings: string[]; images: Record<string, string> } // images: picture name -> data URI, to be saved when the pack is installed
const MAX_ERRORS = 12;
const ID = /^[A-Za-z0-9_.-]{1,48}$/;
const STATUSES: TopicStatus[] = ["know", "shaky", "noidea"];

export function parsePack(input: unknown): PackResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const err = (m: string) => { if (errors.length < MAX_ERRORS) errors.push(m); else if (errors.length === MAX_ERRORS) errors.push("…and more. Fix these first."); };
  const fail = (): PackResult => ({ pack: null, errors, warnings, images: {} });
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

  // ----- pictures (optional): "images": { "fig1": "data:image/png;base64,…" }. Each gets a name made from its content. -----
  const images: Record<string, string> = {};
  const nameToHash: Record<string, string> = {};
  const usedImages = new Set<string>();
  if (input.images !== undefined) {
    if (!isObj(input.images)) err('"images" must be an object like { "fig1": "data:image/png;base64,…" }.');
    else {
      const entries = Object.entries(input.images);
      let total = 0;
      if (entries.length > MAX_IMAGE_COUNT) err(`A pack can hold at most ${MAX_IMAGE_COUNT} pictures.`);
      for (const [name, data] of entries) {
        if (!ID.test(name)) { err(`images["${name}"]: the picture name must be a short id using letters, digits, - or _.`); continue; }
        if (typeof data !== "string" || !DATA_IMG.test(data)) { err(`images["${name}"] must be a data URI like "data:image/png;base64,…" (png, jpeg, webp, gif or svg).`); continue; }
        if (data.length > MAX_IMAGE) { err(`images["${name}"] is too big (${(data.length / 1e6).toFixed(1)} MB). Keep each picture under ${(MAX_IMAGE / 1e6).toFixed(0)} MB; shrink or crop it.`); continue; }
        total += data.length;
        const h = hashData(data);
        images[h] = data; nameToHash[name] = h;
      }
      if (total > MAX_IMAGES_TOTAL) err(`The pictures add up to ${(total / 1e6).toFixed(0)} MB, more than the ${(MAX_IMAGES_TOTAL / 1e6).toFixed(0)} MB limit.`);
    }
  }
  // checks the pictures a piece of text uses and renames them to their content names
  const internImages = (value: string): { text: string; error?: string } => {
    let error: string | undefined;
    const text = value.replace(IMG, (m, alt: string, src: string) => {
      if (src.startsWith("img:")) {
        const h = nameToHash[src.slice(4)];
        if (!h) { error ??= `uses the picture "${src.slice(4)}", which is not in "images".`; return m; }
        usedImages.add(h);
        return `![${alt}](img:${h})`;
      }
      if (/^https:\/\/[^\s]+$/i.test(src)) return m;
      error ??= src.startsWith("data:") ? 'has a picture written inline. Put the data URI in "images" and write ![description](img:name) here.' : `has a picture source "${src.slice(0, 40)}" that is not img:name or an https:// link.`;
      return m;
    });
    return { text, error };
  };

  // ----- questions -----
  if (!Array.isArray(input.questions)) { err('"questions" must be a list.'); return fail(); }
  if (input.questions.length > 6000) { err("A pack can hold at most 6000 questions."); return fail(); }
  const questions: Question[] = [];
  const seen = new Set<string>();
  const counters: Record<string, number> = {};
  let fixedTotal = 0;
  // one question; used for the practice questions and for the questions inside each mock test
  const parseQuestion = (raw: unknown, w: string, autoPrefix?: string): Question | null => {
    if (!isObj(raw)) { err(`${w} must be an object.`); return null; }
    if (typeof raw.topic !== "string" || !topicIds.has(raw.topic)) { err(`${w}.topic "${String(raw.topic)}" is not one of your topic ids.`); return null; }
    const type = raw.type;
    if (type !== "mcq" && type !== "msq" && type !== "nat") { err(`${w}.type must be "mcq", "msq" or "nat".`); return null; }
    if (raw.marks !== 1 && raw.marks !== 2) { err(`${w}.marks must be 1 or 2.`); return null; }
    if (typeof raw.text !== "string" || !raw.text.trim()) { err(`${w} needs the question "text".`); return null; }
    const auto = autoPrefix ?? raw.topic;
    let id: string;
    if (raw.id !== undefined) {
      if (typeof raw.id !== "string" || !ID.test(raw.id)) { err(`${w}.id must be a short id using letters, digits, - or _.`); return null; }
      id = raw.id;
    } else { counters[auto] = (counters[auto] ?? 0) + 1; id = `${auto}-${counters[auto]}`; while (seen.has(id)) { counters[auto]++; id = `${auto}-${counters[auto]}`; } }
    if (seen.has(id)) { err(`${w}.id "${id}" is used twice${seen.has(id) && !autoPrefix ? "" : " (ids must be unique across the practice questions and every mock test)"}.`); return null; }
    // maths: repair single backslashes that JSON turned into control characters, then make sure every formula draws
    let fixedBackslashes = 0;
    const tex = (v: string) => { const r = repairBackslashes(v); fixedBackslashes += r.fixed; return r.text; };
    let imgFail = false;
    const im = (v: string, where: string) => { const r = internImages(v); if (r.error) { err(`${w}.${where} ${r.error}`); imgFail = true; } return r.text; };
    const text = im(tex(raw.text), "text");
    const options = Array.isArray(raw.options) ? raw.options.map((o, k) => (typeof o === "string" ? im(tex(o), `options[${k}]`) : o)) : raw.options;
    const explanation = typeof raw.explanation === "string" ? im(tex(raw.explanation), "explanation") : "";
    if (imgFail) return null;
    if (fixedBackslashes) fixedTotal += fixedBackslashes;
    const parts: [string, string][] = [["text", text], ["explanation", explanation], ...((Array.isArray(options) ? options : []) as string[]).map((o, k): [string, string] => [`options[${k}]`, o])];
    for (const [where, value] of parts) {
      const problem = typeof value === "string" ? texProblems(value)[0] : undefined;
      if (problem) { err(`${w}.${where} ${problem}`); return null; }
    }
    // mandatory tags: the topic (checked above) and its subject; optional tags: anything the author or their AI adds
    const subject = topics.find((t) => t.id === raw.topic)!.subject;
    if (raw.subject !== undefined && raw.subject !== subject) { err(`${w}.subject "${String(raw.subject)}" does not match topic "${raw.topic}", which belongs to subject "${subject}". Leave "subject" out or fix it.`); return null; }
    let tags: string[] | undefined;
    if (raw.tags !== undefined) {
      if (!Array.isArray(raw.tags) || raw.tags.some((t) => typeof t !== "string")) { err(`${w}.tags must be a list of short words, like ["formula", "hard"].`); return null; }
      tags = [...new Set((raw.tags as string[]).map((t) => t.trim().toLowerCase().replace(/\s+/g, "-").slice(0, 28)).filter(Boolean))].slice(0, 8);
      if (!tags.length) tags = undefined;
    }
    const tagged = { subject, ...(tags ? { tags } : {}) };
    let q: Question;
    if (type === "nat") {
      let value: number, tol: number;
      if (typeof raw.answer === "number") { value = raw.answer; tol = typeof raw.tolerance === "number" ? raw.tolerance : 0.01; }
      else if (isObj(raw.answer) && typeof raw.answer.value === "number" && typeof raw.answer.tol === "number") { value = raw.answer.value; tol = raw.answer.tol; }
      else { err(`${w}.answer for a "nat" question must be a number (add "tolerance" for the allowed error).`); return null; }
      if (!isFinite(value) || !isFinite(tol) || tol < 0) { err(`${w}: answer and tolerance must be finite numbers.`); return null; }
      q = { id, topic: raw.topic, type, marks: raw.marks, text, answer: { value, tol }, explanation, ...tagged };
    } else {
      if (!Array.isArray(options) || options.length < 2 || options.length > 8 || options.some((o) => typeof o !== "string")) { err(`${w}.options must be a list of 2 to 8 texts.`); return null; }
      const n = options.length;
      if (type === "mcq") {
        if (!Number.isInteger(raw.answer) || (raw.answer as number) < 0 || (raw.answer as number) >= n) { err(`${w}.answer for "mcq" must be the number of the right option, counting from 0 (0 to ${n - 1}).`); return null; }
      } else if (!Array.isArray(raw.answer) || raw.answer.length === 0 || raw.answer.some((a) => !Number.isInteger(a) || a < 0 || a >= n) || new Set(raw.answer).size !== raw.answer.length) {
        err(`${w}.answer for "msq" must be a list of the right option numbers, counting from 0 (0 to ${n - 1}).`); return null;
      }
      q = { id, topic: raw.topic, type, marks: raw.marks, text, options: options as string[], answer: raw.answer as number | number[], explanation, ...tagged };
    }
    seen.add(id);
    return q;
  };
  input.questions.forEach((raw, i) => { const q = parseQuestion(raw, `questions[${i}]`); if (q) questions.push(q); });
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

  // ----- mock tests with their own questions (optional) -----
  const mockTests: FixedMock[] = [];
  const mockKey = new Map<string, string>(); // question text -> mock id, to warn about the same question in two mocks
  if (input.mockTests !== undefined) {
    if (!Array.isArray(input.mockTests)) err('"mockTests" must be a list.');
    else input.mockTests.forEach((m, i) => {
      const w = `mockTests[${i}]`;
      if (!isObj(m)) { err(`${w} must be an object.`); return; }
      if (typeof m.id !== "string" || !ID.test(m.id) || mockTests.some((x) => x.id === m.id) || mocks.some((x) => x.id === m.id)) { err(`${w}.id must be a short, unique id.`); return; }
      if (typeof m.name !== "string" || !m.name.trim()) { err(`${w} needs a "name".`); return; }
      if (typeof m.minutes !== "number" || !(m.minutes >= 5 && m.minutes <= 600)) { err(`${w}.minutes must be a number from 5 to 600.`); return; }
      if (!Array.isArray(m.sections) || m.sections.length === 0) { err(`${w}.sections must be a list with at least one section, each with its "questions".`); return; }
      const sections: FixedMock["sections"] = [];
      for (const [j, sec] of (m.sections as unknown[]).entries()) {
        const ws = `${w}.sections[${j}]`;
        if (!isObj(sec) || typeof sec.name !== "string" || !sec.name.trim()) { err(`${ws} needs a "name".`); return; }
        if (!Array.isArray(sec.questions) || sec.questions.length === 0) { err(`${ws}.questions must be a list with at least one question.`); return; }
        const qs: Question[] = [];
        sec.questions.forEach((raw, k) => {
          const q = parseQuestion(raw, `${ws}.questions[${k}]`, m.id as string);
          if (!q) return;
          const key = `${q.type}|${q.text.trim()}`;
          const other = mockKey.get(key);
          if (other && other !== m.id) warnings.push(`A question in mock "${m.id}" has the same text as one in mock "${other}". Each mock should have its own questions.`);
          mockKey.set(key, m.id as string);
          qs.push(q);
        });
        sections.push({ name: sec.name.trim().slice(0, 60), questions: qs });
      }
      mockTests.push({ id: m.id, name: m.name.trim().slice(0, 60), minutes: Math.round(m.minutes), note: typeof m.note === "string" ? m.note.slice(0, 200) : undefined, sections });
    });
  }

  if (errors.length) return fail();
  const unused = Object.keys(images).filter((h) => !usedImages.has(h));
  if (unused.length) warnings.push(`${unused.length} picture${unused.length === 1 ? " is" : "s are"} in "images" but no question uses ${unused.length === 1 ? "it" : "them"}. ${unused.length === 1 ? "It was" : "They were"} left out.`);
  for (const h of unused) delete images[h];
  if (questions.length === 0) warnings.push("The pack has no questions yet, so Practice and Mocks will be empty until you add some.");
  const noQ = topics.filter((t) => !questions.some((q) => q.topic === t.id)).length;
  if (noQ && questions.length) warnings.push(`${noQ} topic${noQ === 1 ? " has" : "s have"} no questions.`);
  if (!mocks.length && !mockTests.length && questions.length) warnings.push('No "mockTests", so Mocks offers only a quick mixed test, subject tests and a weak-topics test (built from the practice questions).');
  if (mockTests.length && mockTests.every((m) => m.sections.every((x) => !x.questions.length))) warnings.push("Your mock tests have no questions.");

  return { pack: { name, subjects, topics, questions, mocks, mockTests, useBuiltinGenerators: input.useBuiltinGenerators === true }, errors, warnings, images };
}

const qJson = (pack: { topics: Topic[] }, q: Question) => ({ id: q.id, subject: q.subject ?? pack.topics.find((t) => t.id === q.topic)?.subject, topic: q.topic, ...(q.tags?.length ? { tags: q.tags } : {}), type: q.type, marks: q.marks, text: q.text, ...(q.options ? { options: q.options } : {}), answer: q.answer, explanation: q.explanation });

/** Every question in the pack: the practice bank plus all mock tests. */
export const bankSize = (p: PackData) => p.questions.length + (p.mockTests ?? []).reduce((n, m) => n + m.sections.reduce((k, x) => k + x.questions.length, 0), 0);

// The reverse of parsePack: the pack as a JSON object you can upload again (used to export a pack before replacing it).
export function packToJson(pack: PackData) {
  return {
    name: pack.name,
    ...(pack.useBuiltinGenerators ? { useBuiltinGenerators: true } : {}),
    subjects: pack.subjects,
    topics: pack.topics.map(({ id, subject, name, status }) => ({ id, subject, name, status })),
    questions: pack.questions.map((q) => qJson(pack, q)),
    mocks: pack.mocks,
    ...(pack.mockTests?.length ? { mockTests: pack.mockTests.map((m) => ({ ...m, sections: m.sections.map((x) => ({ name: x.name, questions: x.questions.map((q) => qJson(pack, q)) })) })) } : {}),
  };
}

// ---------- adding to a pack you already have ----------
export interface MergeReport {
  newQuestions: number; duplicates: number; renamed: number;
  newTopics: number; newSubjects: number; newMocks: number; renamedMocks: number;
  newMockTests: number; newMockQuestions: number; mockDuplicates: number;
  warnings: string[];
}
const qKey = (q: Question) => `${q.type}|${q.text.trim()}|${(q.options ?? []).join("\u00a6")}`;

/**
 * Appends `add` to `base`: new subjects, topics, questions and mock recipes are added; what you already have is never changed.
 * A question you already have (same text and options) is skipped, so uploading a file twice is harmless.
 * A new question whose id is taken by a different question gets a fresh id. Your practice history keeps matching.
 */
export function mergePack(base: PackData, add: PackData): { pack: PackData; report: MergeReport } {
  const report: MergeReport = { newQuestions: 0, duplicates: 0, renamed: 0, newTopics: 0, newSubjects: 0, newMocks: 0, renamedMocks: 0, newMockTests: 0, newMockQuestions: 0, mockDuplicates: 0, warnings: [] };
  const subjects = { ...base.subjects };
  for (const [id, name] of Object.entries(add.subjects)) if (!(id in subjects)) { subjects[id] = name; report.newSubjects++; }

  const topics = [...base.topics];
  const topicById = new Map(topics.map((t) => [t.id, t]));
  for (const t of add.topics) {
    const have = topicById.get(t.id);
    if (!have) { topics.push(t); topicById.set(t.id, t); report.newTopics++; if (!(t.subject in subjects)) { subjects[t.subject] = t.subject; report.newSubjects++; } }
    else if (have.subject !== t.subject) report.warnings.push(`Topic "${t.id}" is in subject "${have.subject}" in your pack but "${t.subject}" in the new file. Your pack wins, and its new questions join "${have.subject}".`);
  }

  const questions = [...base.questions];
  const ids = new Set([...questions.map((q) => q.id), ...(base.mockTests ?? []).flatMap((m) => m.sections.flatMap((x) => x.questions.map((q) => q.id)))]);
  const keys = new Set(questions.map(qKey));
  for (const raw of add.questions) {
    const k = qKey(raw);
    if (keys.has(k)) { report.duplicates++; continue; }
    const topic = topicById.get(raw.topic);
    let q: Question = { ...raw, subject: topic?.subject ?? raw.subject };
    if (ids.has(q.id)) {
      const auto = new RegExp(`^${raw.topic.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}-\\d+$`).test(q.id);
      let n = questions.filter((x) => x.topic === raw.topic).length + 1, id = auto ? `${raw.topic}-${n}` : `${q.id}-2`;
      while (ids.has(id)) { n++; id = auto ? `${raw.topic}-${n}` : `${q.id}-${n}`; }
      q = { ...q, id };
      report.renamed++;
    }
    ids.add(q.id); keys.add(k); questions.push(q); report.newQuestions++;
  }

  const mocks = [...base.mocks];
  const mockIds = new Set(mocks.map((m) => m.id));
  for (const m of add.mocks) {
    if (JSON.stringify({ ...m, id: "" , name: ""}) === JSON.stringify({ ...(mocks.find((x) => x.id === m.id) ?? {}), id: "", name: "" }) && mockIds.has(m.id)) continue; // identical recipe already there
    let id = m.id, name = m.name;
    if (mockIds.has(id)) { let n = 2; while (mockIds.has(`${m.id}-${n}`)) n++; id = `${m.id}-${n}`; name = `${m.name} (new)`; report.renamedMocks++; } else report.newMocks++;
    mockIds.add(id); mocks.push({ ...m, id, name });
  }
  // mock tests with their own questions: same id + new questions = those questions are added to that mock; otherwise a new mock
  const allIds = new Set([...ids, ...(base.mockTests ?? []).flatMap((m) => m.sections.flatMap((x) => x.questions.map((q) => q.id)))]);
  const mockKeys = new Set((base.mockTests ?? []).flatMap((m) => m.sections.flatMap((x) => x.questions.map(qKey))));
  const mockTests: FixedMock[] = (base.mockTests ?? []).map((m) => ({ ...m, sections: m.sections.map((x) => ({ ...x, questions: [...x.questions] })) }));
  const fresh = (q: Question, mockId: string): Question => {
    if (!allIds.has(q.id)) { allIds.add(q.id); return q; }
    let n = 2, id = `${q.id}-${n}`;
    while (allIds.has(id)) id = `${q.id}-${++n}`;
    allIds.add(id); report.renamed++;
    return { ...q, id };
  };
  for (const m of add.mockTests ?? []) {
    const have = mockTests.find((x) => x.id === m.id);
    const target = have ?? { id: m.id, name: m.name, minutes: m.minutes, note: m.note, sections: [] as FixedMock["sections"] };
    let added = 0;
    for (const sec of m.sections) {
      let into = target.sections.find((x) => x.name === sec.name);
      for (const raw of sec.questions) {
        const k = qKey(raw);
        if (mockKeys.has(k)) { report.mockDuplicates++; continue; }
        if (!into) { into = { name: sec.name, questions: [] }; target.sections.push(into); }
        mockKeys.add(k);
        into.questions.push(fresh({ ...raw, subject: topicById.get(raw.topic)?.subject ?? raw.subject }, m.id));
        added++;
      }
    }
    report.newMockQuestions += added;
    if (!have && added) { mockTests.push(target); report.newMockTests++; }
  }

  return { pack: { ...base, subjects, topics, questions, mocks, mockTests, useBuiltinGenerators: base.useBuiltinGenerators || add.useBuiltinGenerators }, report };
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
  mockTests: [
    { id: "mock1", name: "Mock test 1", minutes: 30, note: "Optional line shown on the card", sections: [
      { name: "Mathematics", questions: [
        { id: "mock1-q1", subject: "maths", topic: "algebra", tags: ["quadratics"], type: "nat", marks: 1, text: "What is the larger root of $x^2 - 7x + 12 = 0$?", answer: 4, tolerance: 0, explanation: "$(x-3)(x-4)=0$, so the larger root is $4$." },
      ] },
      { name: "Science", questions: [
        { id: "mock1-q2", subject: "sci", topic: "motion", tags: ["units"], type: "mcq", marks: 1, text: "The SI unit of force is:", options: ["Joule", "Newton", "Watt", "Pascal"], answer: 1, explanation: "Force is measured in newtons." },
      ] },
    ] },
  ],
}, null, 2);

const FENCE = "```";
const addingNote = (p: PackData) => `

I already have a pack called "${p.name}" and I am ADDING to it. Reuse these ids exactly so the new questions join the right places, and add new subjects or topics only when truly needed:
- Subjects: ${Object.entries(p.subjects).map(([id, n]) => `${id} (${n})`).join(", ") || "none"}
- Topics: ${p.topics.map((t) => `${t.id} [${t.subject}]`).join(", ") || "none"}
Write only NEW questions. Do not repeat the ones I already have, and leave out "mockTests" unless I ask for new mock tests. If I do, each mock test keeps its own questions and ids that do not clash with the ones I already have.`;
export const packPrompt = (existing?: PackData): string => String.raw`Write a question pack for me and reply with ONLY one JSON object (no explanation, no markdown fence).${existing ? addingNote(existing) : ""}

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
- "questions" is the PRACTICE bank. Mock tests have their own separate questions, so never put a mock-test question in "questions".
- "mockTests": optional list of complete mock tests: { "id", "name", "minutes", "sections": [ { "name", "questions": [ ...questions written exactly like the ones above... ] } ] }. Every question inside a mock test belongs to that one mock test only: never reuse a question in two mocks or in "questions". Give every question an "id" that is unique across the whole file, for example "mock1-q1". Each question still needs "subject" and "topic" (declare any topic it uses in "topics").
- Pictures (only if I give you pictures, otherwise never use them): in "text", in an option, or in "explanation", write ![what the picture shows](img:name). Then add a top-level "images" object that holds each picture once: { "name": "data:image/png;base64,..." }. Use only the picture names I give you. Never make up picture data.
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
