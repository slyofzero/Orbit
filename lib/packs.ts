// A "question pack" is what makes Practice and Mocks work: the topics, the practice questions, and separate mock tests that each own their questions.
// Nothing is built in. Upload a pack (JSON) on the Practice page and the app uses it. Pure functions, tested by scripts/check.ts.
import { CODE_LANGUAGES, languageName } from "./codeLanguages";
import { DIFFICULTIES, Difficulty, Question, Topic, TopicStatus } from "./types";
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

export interface PackResult { pack: PackData | null; errors: string[]; warnings: string[]; autoIds: number; images: Record<string, string> } // images: picture name -> data URI, to be saved when the pack is installed
const MAX_ERRORS = 12;
export const MAX_TAGS_PER_QUESTION = 3;
export const MAX_TAGS_IN_PACK = 40;
export const TAG_TARGET = 25; // what the AI prompt asks for; the hard limit is MAX_TAGS_IN_PACK
// Words that mark WHERE a question came from (a provider, batch, series, week or paper), not WHAT it is about. Tags are only for filtering by general skill or idea.
const SOURCE_WORDS = new Set(["pw", "mst", "swt", "twt", "dpp", "nptel", "weekly", "wt", "week", "assignment", "assign", "quiz", "batch", "lecture", "lec", "session", "gate", "pyq", "mock", "homework", "hw", "midterm", "endterm"]);
export const isSourceTag = (t: string): boolean => t.split("-").some((w) => SOURCE_WORDS.has(w) || /^(wt|w|week|set|q|no|day)\d+$/.test(w) || /^(19|20)\d\d$/.test(w));
const ID = /^[A-Za-z0-9_.-]{1,48}$/;
const STATUSES: TopicStatus[] = ["know", "shaky", "noidea"];

/**
 * Checks an uploaded pack and turns it into a PackData. A question without an "id" gets one from the system, never one that is already
 * taken (pass the pack you already have as `existing`). A question WITH an id keeps it, and if that id is in your pack it will replace that question.
 */
export function parsePack(input: unknown, existing?: PackData): PackResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const err = (m: string) => { if (errors.length < MAX_ERRORS) errors.push(m); else if (errors.length === MAX_ERRORS) errors.push("…and more. Fix these first."); };
  const fail = (): PackResult => ({ pack: null, errors, warnings, autoIds: 0, images: {} });
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
  // ids the system hands out must not clash with ids already in the pack, nor with ids this file writes explicitly (even further down)
  const taken = new Set<string>(existing ? allQuestions(existing).map((l) => l.q.id) : []);
  const explicit = (qs: unknown) => { if (Array.isArray(qs)) for (const q of qs) if (isObj(q) && typeof q.id === "string") taken.add(q.id); };
  explicit(input.questions);
  if (Array.isArray(input.mockTests)) for (const m of input.mockTests) if (isObj(m) && Array.isArray(m.sections)) for (const sec of m.sections) if (isObj(sec)) explicit(sec.questions);
  let autoIds = 0;
  let fixedTotal = 0;
  const missingDifficulty: string[] = [];
  const tagUse = new Map<string, number>(); // every tag in the file (and in the pack it is added to) -> how many questions use it
  if (existing) for (const l of allQuestions(existing)) for (const t of l.q.tags ?? []) tagUse.set(t, (tagUse.get(t) ?? 0) + 1);
  const sourceTags = new Set<string>(), tooManyTags: string[] = [];
  // one question; used for the practice questions and for the questions inside each mock test
  const parseQuestion = (raw: unknown, w: string, autoPrefix?: string): Question | null => {
    if (!isObj(raw)) { err(`${w} must be an object.`); return null; }
    if (typeof raw.topic !== "string" || !topicIds.has(raw.topic)) { err(`${w}.topic "${String(raw.topic)}" is not one of your topic ids.`); return null; }
    const type = raw.type;
    if (type !== "mcq" && type !== "msq" && type !== "nat" && type !== "str" && type !== "code") { err(`${w}.type must be "mcq", "msq", "nat", "str" or "code".`); return null; }
    if (type === "str" && autoPrefix) { err(`${w}: text-answer ("str") questions can only go in "questions" (the practice bank). GATE mock tests have no text-entry questions.`); return null; }
    if (type === "code" && autoPrefix) { err(`${w}: programming ("code") questions can only go in "questions" (the practice bank). The mock arena cannot run code.`); return null; }
    if (raw.marks !== 1 && raw.marks !== 2) { err(`${w}.marks must be 1 or 2.`); return null; }
    if (typeof raw.text !== "string" || !raw.text.trim()) { err(`${w} needs the question "text".`); return null; }
    const auto = autoPrefix ?? raw.topic;
    let id: string;
    if (raw.id !== undefined) {
      if (typeof raw.id !== "string" || !ID.test(raw.id)) { err(`${w}.id must be a short id using letters, digits, - or _.`); return null; }
      id = raw.id;
    } else { counters[auto] = (counters[auto] ?? 0) + 1; id = `${auto}-${counters[auto]}`; while (seen.has(id) || taken.has(id)) { counters[auto]++; id = `${auto}-${counters[auto]}`; } autoIds++; }
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
    // mandatory difficulty: the "difficulty" field, or (for older files) an "easy"/"medium"/"hard" tag, which then moves out of the tags
    let difficulty: Difficulty | undefined;
    if (raw.difficulty !== undefined) {
      const d = typeof raw.difficulty === "string" ? raw.difficulty.trim().toLowerCase() : "";
      if (!(DIFFICULTIES as string[]).includes(d)) { err(`${w}.difficulty must be "easy", "medium" or "hard".`); return null; }
      difficulty = d as Difficulty;
    } else difficulty = tags?.find((t): t is Difficulty => (DIFFICULTIES as string[]).includes(t));
    if (tags) { tags = tags.filter((t) => !(DIFFICULTIES as string[]).includes(t)); if (!tags.length) tags = undefined; }
    if (tags) {
      for (const t of tags) if (isSourceTag(t)) sourceTags.add(t);
      if (tags.length > MAX_TAGS_PER_QUESTION) { tooManyTags.push(typeof raw.id === "string" ? raw.id : w); tags = tags.slice(0, MAX_TAGS_PER_QUESTION); }
      for (const t of tags) tagUse.set(t, (tagUse.get(t) ?? 0) + 1);
    }
    if (!difficulty) missingDifficulty.push(typeof raw.id === "string" ? raw.id : w);
    const tagged = { subject, ...(difficulty ? { difficulty } : {}), ...(tags ? { tags } : {}) };
    let q: Question;
    if (type === "code") {
      const language = typeof raw.language === "string" ? languageName(raw.language) : null;
      if (!language) { err(`${w}.language must be one of: ${CODE_LANGUAGES.join(", ")}.`); return null; }
      if (!Array.isArray(raw.tests) || raw.tests.length === 0 || raw.tests.length > 40) { err(`${w}.tests must be a list of 1 to 40 tests like { "input": "3\\n1 2 3", "output": "6" }.`); return null; }
      const tests: { input: string; output: string; hidden?: boolean }[] = [];
      for (const [k, t] of raw.tests.entries()) {
        if (!isObj(t) || typeof t.input !== "string" || (typeof t.output !== "string" && typeof t.output !== "number")) { err(`${w}.tests[${k}] needs "input" and "output" as text.`); return null; }
        tests.push({ input: t.input, output: String(t.output), ...(t.hidden === true ? { hidden: true } : {}) });
      }
      if (tests.every((t) => t.hidden)) { err(`${w}: at least one test must be visible (leave out "hidden") so the learner can try the program.`); return null; }
      const lim = typeof raw.timeLimitMs === "number" && raw.timeLimitMs >= 200 && raw.timeLimitMs <= 15000 ? Math.round(raw.timeLimitMs) : undefined;
      const starter = typeof raw.starter === "string" ? raw.starter : undefined;
      const solution = typeof raw.solution === "string" ? raw.solution : undefined;
      let setup: string | undefined;
      if (raw.setup !== undefined) {
        if (typeof raw.setup !== "string" || raw.setup.length > 6000) { err(`${w}.setup must be text of at most 6000 characters describing what has to exist before the program can run.`); return null; }
        setup = raw.setup.trim() || undefined;
        const prob = setup ? texProblems(setup)[0] : undefined;
        if (prob) { err(`${w}.setup ${prob}`); return null; }
      }
      q = { id, topic: raw.topic, type, marks: raw.marks, text, answer: 0, explanation, ...tagged, code: { language, ...(starter ? { starter } : {}), ...(solution ? { solution } : {}), tests, ...(lim ? { timeLimitMs: lim } : {}), ...(setup ? { setup } : {}) } };
    } else if (type === "str") {
      if (raw.options !== undefined) { err(`${w}: a "str" question has no "options". The learner types the answer.`); return null; }
      const list = Array.isArray(raw.answer) ? raw.answer : [raw.answer];
      if (list.length === 0 || list.length > 20 || list.some((a) => typeof a !== "string" || !a.trim() || a.length > 200)) { err(`${w}.answer for a "str" question must be a text like "I,D,B" (write "NIL" for an empty list), or a list of accepted texts. Never use a number or a "nat" question for this.`); return null; }
      if (raw.match !== undefined && raw.match !== "exact" && raw.match !== "list" && raw.match !== "set") { err(`${w}.match must be "exact", "list" (ordered) or "set" (any order).`); return null; }
      if (raw.caseSensitive !== undefined && typeof raw.caseSensitive !== "boolean") { err(`${w}.caseSensitive must be true or false.`); return null; }
      const answer = Array.isArray(raw.answer) ? (raw.answer as string[]).map((a) => a.trim()) : (raw.answer as string).trim();
      q = { id, topic: raw.topic, type, marks: raw.marks, text, answer, explanation, ...(raw.match && raw.match !== "exact" ? { match: raw.match as "list" | "set" } : {}), ...(raw.caseSensitive === true ? { caseSensitive: true } : {}), ...tagged };
    } else if (type === "nat") {
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

  if (missingDifficulty.length) errors.unshift(`${missingDifficulty.length} question${missingDifficulty.length === 1 ? " has" : "s have"} no difficulty. Every question needs "difficulty": "easy", "medium" or "hard". First ones: ${missingDifficulty.slice(0, 5).join(", ")}${missingDifficulty.length > 5 ? ", …" : ""}.`);
  // tags are for filtering by general skill or idea, so they must stay few and general
  if (tagUse.size > MAX_TAGS_IN_PACK) {
    const rare = [...tagUse.entries()].sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0])).slice(0, 12).map(([t, n]) => `${t} (${n})`).join(", ");
    errors.unshift(`The pack uses ${tagUse.size} different tags${existing ? " (counting the pack you are adding to)" : ""}. At most ${MAX_TAGS_IN_PACK} are allowed, and about ${TAG_TARGET} is ideal. Merge near-duplicates into one general tag, drop tags that only a few questions use, and ask your AI to redo the tags from one fixed list. Least used: ${rare}.`);
  }
  if (tooManyTags.length) errors.unshift(`${tooManyTags.length} question${tooManyTags.length === 1 ? " has" : "s have"} more than ${MAX_TAGS_PER_QUESTION} tags. Give each question at most ${MAX_TAGS_PER_QUESTION}. First ones: ${tooManyTags.slice(0, 5).join(", ")}${tooManyTags.length > 5 ? ", …" : ""}.`);
  if (sourceTags.size) errors.unshift(`Tags must describe a general skill or idea, never where a question came from. These look like a provider, batch, week, paper or series label: ${[...sourceTags].slice(0, 12).join(", ")}${sourceTags.size > 12 ? ", …" : ""}. Remove them (use "subject", "topic" and "difficulty" for the rest).`);
  if (errors.length) return fail();
  const unused = Object.keys(images).filter((h) => !usedImages.has(h));
  if (unused.length) warnings.push(`${unused.length} picture${unused.length === 1 ? " is" : "s are"} in "images" but no question uses ${unused.length === 1 ? "it" : "them"}. ${unused.length === 1 ? "It was" : "They were"} left out.`);
  for (const h of unused) delete images[h];
  if (questions.length === 0) warnings.push("The pack has no questions yet, so Practice and Mocks will be empty until you add some.");
  const noQ = topics.filter((t) => !questions.some((q) => q.topic === t.id)).length;
  if (noQ && questions.length) warnings.push(`${noQ} topic${noQ === 1 ? " has" : "s have"} no questions.`);
  if (!mocks.length && !mockTests.length && questions.length) warnings.push('No "mockTests", so Mocks offers only a quick mixed test, subject tests and a weak-topics test (built from the practice questions).');
  if (mockTests.length && mockTests.every((m) => m.sections.every((x) => !x.questions.length))) warnings.push("Your mock tests have no questions.");

  return { pack: { name, subjects, topics, questions, mocks, mockTests, useBuiltinGenerators: input.useBuiltinGenerators === true }, errors, warnings, autoIds, images };
}

const qJson = (pack: { topics: Topic[] }, q: Question) => ({ id: q.id, subject: q.subject ?? pack.topics.find((t) => t.id === q.topic)?.subject, topic: q.topic, ...(q.difficulty ? { difficulty: q.difficulty } : {}), ...(q.tags?.length ? { tags: q.tags } : {}), type: q.type, marks: q.marks, text: q.text, ...(q.options ? { options: q.options } : {}), ...(q.match ? { match: q.match } : {}), ...(q.caseSensitive ? { caseSensitive: true } : {}), ...(q.code ? { language: q.code.language, ...(q.code.starter ? { starter: q.code.starter } : {}), ...(q.code.solution ? { solution: q.code.solution } : {}), tests: q.code.tests, ...(q.code.timeLimitMs ? { timeLimitMs: q.code.timeLimitMs } : {}), ...(q.code.setup ? { setup: q.code.setup } : {}) } : { answer: q.answer }), explanation: q.explanation });

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

// ---------- finding questions ----------
export interface Loc { bank: "practice" | "mock"; mockId?: string; mockName?: string; section?: string; q: Question }
/** Every question in the pack with where it lives: the practice bank or one section of one mock test. */
export function allQuestions(pack: PackData): Loc[] {
  return [
    ...pack.questions.map((q): Loc => ({ bank: "practice", q })),
    ...(pack.mockTests ?? []).flatMap((m) => m.sections.flatMap((x) => x.questions.map((q): Loc => ({ bank: "mock", mockId: m.id, mockName: m.name, section: x.name, q })))),
  ];
}
export const locate = (pack: PackData, id: string): Loc | undefined => allQuestions(pack).find((l) => l.q.id === id);

// ---------- adding to a pack you already have ----------
export interface MergeReport {
  newQuestions: number; updatedQuestions: number; unchanged: number;
  newMockTests: number; newMockQuestions: number; updatedMockQuestions: number;
  newTopics: number; newSubjects: number; newMocks: number; updatedMocks: number;
  replacedIds: string[]; // ids that already existed and whose question was REPLACED by a different one
  warnings: string[];
}
export const mergeChanges = (r: MergeReport) => r.newQuestions + r.updatedQuestions + r.newMockTests + r.newMockQuestions + r.updatedMockQuestions + r.newTopics + r.newSubjects + r.newMocks + r.updatedMocks;

/**
 * Adds `add` to `base`. What you already have is kept, with one rule: a question whose id is already in the pack REPLACES that question
 * (in the same place), so uploading a corrected file is how you edit questions. New ids are added. Uploading the same file twice changes nothing.
 * New subjects and topics are added; an existing topic keeps its name and status. A mock test with a known id gets its details updated and its new questions added.
 */
export function mergePack(base: PackData, add: PackData): { pack: PackData; report: MergeReport } {
  const report: MergeReport = { newQuestions: 0, updatedQuestions: 0, unchanged: 0, newMockTests: 0, newMockQuestions: 0, updatedMockQuestions: 0, newTopics: 0, newSubjects: 0, newMocks: 0, updatedMocks: 0, replacedIds: [], warnings: [] };
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
  const mockTests: FixedMock[] = (base.mockTests ?? []).map((m) => ({ ...m, sections: m.sections.map((x) => ({ ...x, questions: [...x.questions] })) }));
  const fix = (q: Question): Question => ({ ...q, subject: topicById.get(q.topic)?.subject ?? q.subject });
  const same = (a: Question, b: Question) => JSON.stringify(a) === JSON.stringify(b);
  // finds an existing question by id (practice or any mock) and replaces it in place; returns where it was, or null when the id is new
  const override = (q: Question): "practice" | "mock" | "same" | null => {
    const i = questions.findIndex((x) => x.id === q.id);
    if (i >= 0) { if (same(questions[i], q)) return "same"; questions[i] = q; return "practice"; }
    for (const m of mockTests) for (const x of m.sections) { const j = x.questions.findIndex((y) => y.id === q.id); if (j >= 0) { if (same(x.questions[j], q)) return "same"; x.questions[j] = q; return "mock"; } }
    return null;
  };

  for (const raw of add.questions) {
    const q = fix(raw), r = override(q);
    if (r === "same") report.unchanged++;
    else if (r === "practice") { report.updatedQuestions++; report.replacedIds.push(q.id); }
    else if (r === "mock") { report.updatedMockQuestions++; report.replacedIds.push(q.id); report.warnings.push(`Question "${q.id}" already lives in a mock test, so it was updated there and not copied to the practice questions.`); }
    else { questions.push(q); report.newQuestions++; }
  }

  for (const m of add.mockTests ?? []) {
    let target = mockTests.find((x) => x.id === m.id);
    const isNew = !target;
    if (!target) target = { id: m.id, name: m.name, minutes: m.minutes, note: m.note, sections: [] };
    else if (target.name !== m.name || target.minutes !== m.minutes || (target.note ?? "") !== (m.note ?? "")) { target.name = m.name; target.minutes = m.minutes; target.note = m.note; report.updatedMocks++; }
    let added = 0;
    for (const sec of m.sections) {
      let into = target.sections.find((x) => x.name === sec.name);
      for (const raw of sec.questions) {
        const q = fix(raw), r = override(q);
        if (r === "same") { report.unchanged++; continue; }
        if (r) { report.updatedMockQuestions++; report.replacedIds.push(q.id); if (r === "practice") report.warnings.push(`Question "${q.id}" already lives in the practice questions, so it was updated there and not copied into mock "${m.name}".`); continue; }
        if (!into) { into = { name: sec.name, questions: [] }; target.sections.push(into); }
        into.questions.push(q); added++;
      }
    }
    report.newMockQuestions += added;
    if (isNew && added) { mockTests.push(target); report.newMockTests++; }
  }

  const mocks = [...base.mocks];
  for (const m of add.mocks) {
    const i = mocks.findIndex((x) => x.id === m.id);
    if (i < 0) { mocks.push(m); report.newMocks++; }
    else if (JSON.stringify(mocks[i]) !== JSON.stringify(m)) { mocks[i] = m; report.updatedMocks++; }
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
    { subject: "maths", topic: "algebra", tags: ["linear-equation"], difficulty: "easy", type: "mcq", marks: 1, text: "If $2x + 3 = 11$, what is $x$?", options: ["$2$", "$3$", "$4$", "$5$"], answer: 2, explanation: "Subtract 3, then divide by 2: $x = \\frac{8}{2} = 4$." },
    { subject: "maths", topic: "algebra", tags: ["factorising", "roots"], difficulty: "medium", type: "msq", marks: 2, text: "Which of these are roots of $x^2 - 5x + 6 = 0$?", options: ["$1$", "$2$", "$3$", "$6$"], answer: [1, 2], explanation: "It factors as $(x-2)(x-3)$, so $x \\in \\{2, 3\\}$." },
    { subject: "maths", topic: "algebra", tags: ["series", "calculation"], difficulty: "hard", type: "nat", marks: 2, text: "Evaluate the sum:\n$$\\sum_{k=1}^{4} k^2$$", answer: 30, tolerance: 0, explanation: "$1 + 4 + 9 + 16 = 30$." },
    { subject: "sci", topic: "motion", tags: ["units", "formula"], difficulty: "medium", type: "nat", marks: 1, text: "A car moves at $20\\ \\text{m/s}$ for $5\\ \\text{s}$. How many metres does it cover?", answer: 100, tolerance: 0.5, explanation: "$d = v \\times t = 100\\ \\text{m}$." },
    { subject: "maths", topic: "algebra", tags: ["programming"], difficulty: "easy", type: "code", marks: 2, text: "Read an integer $n$ and print the sum $1 + 2 + \\dots + n$.\nInput: one line with $n$. Output: one number.", language: "python", starter: "n = int(input())\n", solution: "n = int(input())\nprint(n * (n + 1) // 2)", tests: [{ input: "4", output: "10" }, { input: "100", output: "5050", hidden: true }], explanation: "The sum is $n(n+1)/2$." },
    { subject: "maths", topic: "algebra", tags: ["calculation"], difficulty: "easy", type: "str", match: "list", marks: 1, text: "List the roots of $x^2 - 5x + 6 = 0$ in increasing order, separated by commas.", answer: "2,3", explanation: "$(x-2)(x-3)=0$, so the roots are 2 and 3." },
  ],
  mockTests: [
    { id: "mock1", name: "Mock test 1", minutes: 30, note: "Optional line shown on the card", sections: [
      { name: "Mathematics", questions: [
        { subject: "maths", topic: "algebra", tags: ["quadratics"], difficulty: "medium", type: "nat", marks: 1, text: "What is the larger root of $x^2 - 7x + 12 = 0$?", answer: 4, tolerance: 0, explanation: "$(x-3)(x-4)=0$, so the larger root is $4$." },
      ] },
      { name: "Science", questions: [
        { subject: "sci", topic: "motion", tags: ["units"], difficulty: "easy", type: "mcq", marks: 1, text: "The SI unit of force is:", options: ["Joule", "Newton", "Watt", "Pascal"], answer: 1, explanation: "Force is measured in newtons." },
      ] },
    ] },
  ],
}, null, 2);

const FENCE = "```";
const TICK = "`";
const topTags = (p: PackData): string => {
  const c = new Map<string, number>();
  for (const q of p.questions) for (const t of q.tags ?? []) c.set(t, (c.get(t) ?? 0) + 1);
  for (const m of p.mockTests ?? []) for (const x of m.sections) for (const q of x.questions) for (const t of q.tags ?? []) c.set(t, (c.get(t) ?? 0) + 1);
  const top = [...c.entries()].sort((a, b) => b[1] - a[1]).slice(0, 40).map(([t]) => t);
  return top.length ? top.join(", ") : "none yet";
};
const tagLine = (p: PackData): string => {
  const use = new Map<string, number>();
  for (const l of allQuestions(p)) for (const t of l.q.tags ?? []) use.set(t, (use.get(t) ?? 0) + 1);
  if (use.size === 0) return "- Tags: my pack has none yet. Follow the tag rules.";
  const top = [...use.entries()].sort((a, b) => b[1] - a[1]).slice(0, TAG_TARGET).map(([t]) => t);
  return use.size <= MAX_TAGS_IN_PACK
    ? `- Tags already in my pack (${use.size}): ${top.join(", ")}${use.size > top.length ? ", …" : ""}. Reuse ONLY these. Add a new tag only if none fits, and keep the pack under ${MAX_TAGS_IN_PACK} tags in total.`
    : `- My pack already has ${use.size} tags, which is too many. Do NOT invent new tags. Use only the most general of these, or none: ${top.join(", ")}.`;
};
const addingNote = (p: PackData) => `

I already have a pack called "${p.name}" and I am ADDING to it. Reuse these ids exactly so the new questions join the right places, and add new subjects or topics only when truly needed:
- Subjects: ${Object.entries(p.subjects).map(([id, n]) => `${id} (${n})`).join(", ") || "none"}
- Topics: ${p.topics.map((t) => `${t.id} [${t.subject}]`).join(", ") || "none"}
- Tags already in use (reuse these; add a new tag only if none of them fits and the tag rules below allow it): ${topTags(p)}
${tagLine(p)}
Write only NEW questions. Do not repeat the ones I already have, and leave out "mockTests" unless I ask for new mock tests. If I do, each mock test keeps its own questions and ids that do not clash with the ones I already have.`;
export const packPrompt = (existing?: PackData): string => String.raw`Write a question pack for me and reply with ONLY one JSON object (no explanation, no markdown fence).${existing ? addingNote(existing) : ""}

About me (fill this in before sending):
- Subject / exam: 
- Topics to cover (and which ones I find hard): 
- How many questions per topic: 
- Test format I want for mock tests (sections, number of questions, minutes): 

Use exactly this format. The reply is ONE JSON object with these top-level keys: "name", "subjects", "topics", "questions", and optionally "mockTests", "mocks" and "images". (Never write "useBuiltinGenerators".) If anything in the file is wrong, the app refuses the whole file and lists what to fix, so follow every rule below.
- Ids ("subject" ids, topic ids, mock ids, question ids) use only letters, digits, "-", "_" and ".", at most 48 characters, and no spaces. Prefer short lowercase ids.
- "name": short pack name (at most 60 characters).
- "subjects": { "subjectId": "Display name" }.
- "topics": list of { "id", "subject", "name", "status" }. "subject" is a subject id. "status" is "know", "shaky" or "noidea" (how well I know the topic now; "know" if left out). Every topic id must be unique.
- "questions": the PRACTICE bank, a list of questions. Every question has these mandatory fields:
  - "subject": a subject id, and it must be the subject the topic belongs to.
  - "topic": a topic id declared in "topics". "subject" and "topic" are mandatory tags: the app shows statistics and filters per subject and per topic.
  - "difficulty": exactly one of "easy", "medium" or "hard". Judge it for a typical learner preparing for this exam. The app groups, filters and badges by it. A question without it is rejected.
  - "type": "mcq", "msq", "nat", "str" or "code" (details below).
  - "marks": 1 or 2.
  - "text": the question itself.
  - "explanation": why the answer is right, with the working. Make the numbers add up.
  Optional fields:
  - "tags": optional, and STRICT. Tags exist only so I can filter questions by what KIND of question they are, so they must be few, general and reused across the whole pack. Rules:
    1. Before you write any question, silently decide ONE small tag vocabulary for the whole pack: 10 to 25 tags (the whole pack may have at most ${MAX_TAGS_IN_PACK} distinct tags, and a file over that is rejected). Every tag you use must come from that list.
    2. At most 3 tags per question. Use 0 if no tag fits: leaving "tags" out is better than inventing one.
    3. A tag describes the skill or style of the question, not where it came from. Good tags: "formula", "calculation", "conceptual", "definition", "derivation", "proof", "trap", "application", "approximation", "estimation", "code-tracing", "graph-reading", "elimination", "multi-step". Write them lowercase, one or two words, joined with "-".
    4. NEVER use these as tags (the file is not acceptable if it does): the name of a coaching provider, book, course, platform or source ("pw", "nptel", "gateoverflow", "made-easy"...); a test, series, batch, assignment, weekly or mock label ("mst", "swt", "twt", "dpp", "wt01", "weekly", "mock-3", "practice-set"...); the year, week, lecture, chapter, unit, question number or any other number that labels where a question sits; a subject name or topic name (those are already "subject" and "topic"); "easy", "medium" or "hard" (that is "difficulty"); a one-off idea that only 1 to 4 questions will ever share (such as a single theorem, formula or algorithm name).
    5. Every tag must be useful as a filter: if fewer than 5 questions in the pack would carry it, drop it. If two tags mean nearly the same thing, keep one and use it everywhere ("calculation" and "calculations" and "computation" become "calculation").
    6. If I give you questions that already have tags, do NOT copy them. Map each one to a tag from your vocabulary, or drop it.
    The app shows accuracy per tag, so consistent spelling matters.
  - "id": see the id rule below.
  Types:
  - "mcq": exactly one correct option. Add "options" (2 to 8 texts) and "answer" = the number of the right option, counting from 0.
  - "msq": one or more correct options. Add "options" (2 to 8 texts) and "answer" = a list of the right option numbers, counting from 0, with no repeats.
  - "nat": the answer is a number typed in. Add "answer" = the number and "tolerance" = the allowed error (an absolute amount; 0 means exact; 0.01 if left out). An answer of the form { "value": 4.5, "tol": 0.01 } is also accepted.
  - "str": a short TEXT answer that is typed in, such as a list of labels ("I,D,B"), a single label ("E"), a word, or "NIL" for an empty list. Practice bank only, NEVER inside a mock test (GATE has no text-entry questions). Do NOT add "options" or "tolerance".
      🛑 NEVER use "nat" for a text answer. A "nat" answer is ONE NUMBER. Turning "I,D,B" into a number grades wrong answers as right.
      "answer": the accepted text, or a list of texts where any one is accepted (for example "E" or ["I,D,B", "I,B,D"]).
      "match": optional. "exact" (default, the typed text must equal the answer), "list" (comma-separated items, order matters, like "I,D,B") or "set" (comma-separated items, order does not matter).
      "caseSensitive": optional, true or false (default false).
      Before comparing, the app trims the text, removes all spaces, ignores case (unless "caseSensitive"), and treats "NIL" or empty as the empty list. So write the answer in its plainest form, for example "I,D,B", not "I, D, B".
      Use "str" only when the question can be answered from its text alone. If it needs a figure, graph or state-space diagram that I have not given you as a picture, leave the question out.
  - "code": a programming question where I write my own program (practice bank only, never inside a mock test, and only if I ask for programming questions). The program reads standard input and prints to standard output, and the app runs it against your tests. Do NOT add "options" or "answer". Add:
      "language": one of python, c, cpp, java, javascript.
      "tests": 3 to 8 tests (at most 40), each { "input": "text given to the program", "output": "exact text it must print", "hidden": true (optional) }. At least one test must be visible. The first 1 or 2 tests are examples I can see; mark the tricky edge cases and larger cases "hidden": true. "input" is what would be typed in, with \n between lines; "output" is exactly what a correct program prints. Keep the output format unambiguous (one value per line, fixed decimal places for decimals).
      "starter": optional code to start from, for example the reading of the input.
      "solution": a correct, short reference program in the same language. Check it against every test by hand before you write the tests.
      "timeLimitMs": optional, from 200 to 15000, default 3000.
      "setup": optional (at most 6000 characters), ONLY for questions that need something to exist on my computer first (SQL tables, a folder tree, input files). Describe it EXACTLY and deterministically, because the tests depend on it: exact file and folder names, exact file contents (or an exact rule such as "file k contains the numbers 1..k"), exact table names, columns and rows. No randomness, no dates that change. The learner's program runs inside the folder that holds this data, so tell it which relative paths to use. Example: "A folder with data/a.txt (contents: 3 lines: 1, 2, 3) and data/sub/b.txt (contents: 10)." For SQL questions say the database file name and give the CREATE TABLE and INSERT statements. Questions without this need leave "setup" out.
    In "text" describe the task, the input format and the output format, and put the examples in prose or in a code block. Java solutions use ${TICK}public class Main${TICK}.
- Do NOT write an "id" on any question. The app gives every question its own unique id. Only add an "id" if I tell you to correct an existing question, and then use exactly the id I give you; that replaces the old question. Ids must be unique across the practice bank and every mock test.
- "mockTests": optional list of complete mock tests: { "id", "name", "minutes" (5 to 600), "note" (optional, one short line), "sections": [ { "name", "questions": [ ...questions written exactly like the ones above... ] } ] }. A mock test has at least one section, and every section has at least one question. Every question inside a mock test belongs to that one mock test only: never reuse a question in two mocks or in "questions", and never put a "code" question in a mock test. Each mock question still needs "subject", "topic" and "difficulty" (declare any topic it uses in "topics"). Mock tests are separate from the practice bank: never put a mock-test question in "questions".
- "mocks": optional and old-style, only if I ask for quick randomised mocks. Each is { "id", "name", "minutes" (5 to 600), "note" (optional), "sections": [ { "name", "picks": [ { "subject": a subject id, "one": how many 1-mark questions, "two": how many 2-mark questions, "topics": optional list of topic ids to draw from } ] } ] }. The app draws those questions at random from the practice bank. Prefer "mockTests" when I want real, fixed mock tests.
- "images": only if I give you pictures, otherwise never use pictures. In "text", in an option, or in "explanation", write ![what the picture shows](img:name) (a normal https:// link also works). Then add a top-level "images" object that holds each picture once: { "name": "data:image/png;base64,..." }. Use only the picture names I give you. Never make up picture data.
- Make sure every answer is actually correct and the numbers in each explanation add up.

PROGRAMMING QUESTIONS (only when I ask for them). Python and JavaScript programs run inside the app itself (nothing to install). Java, C and C++ programs run on my own computer and need Java or a compiler installed. Any question with a "setup" only works when the app runs on my own computer. It feeds each test's "input" to the program's standard input and compares what it prints with the test's "output" (spaces at the ends of lines and blank lines at the end are ignored, everything else must match exactly).
1. Write each task so ONE correct program prints ONE exact answer: say what the input looks like and the exact output format in "text". Prefer one value per line, and fix the number of decimals when you print decimals.
2. Give 3 to 8 tests: 1 or 2 visible examples, then "hidden": true for edge cases and bigger cases. Work every output out by hand and check it against your "solution".
3. Questions about SQL: use SQLite from Python ("language": "python", with the sqlite3 module), because it needs no installation. Put the database in "setup" as an exact file name plus the CREATE TABLE and INSERT statements, and tell the learner in "text" to open that file and print the query result, one row per line.
4. Questions about files and folders (walking a directory tree, reading files, sizes, counting): put the exact tree and the exact contents of every file in "setup". The learner's program runs INSIDE the folder that holds this data, so "text" must say which relative paths to use, for example "walk the folder data".
5. "setup" must be deterministic: exact names, exact contents or an exact rule, no randomness, no dates or times that change, no absolute paths. The app turns "setup" into a ready-made prompt that I give my own AI, which writes a script that builds the data, so the more exact it is the smoother my setup is. The tests' outputs must be right for exactly that data.
6. Leave "setup" out when the program needs nothing but its standard input.
7. Do not use libraries that need installing (pip or npm). Use the standard library only.
Example of a question with setup (a folder tree):
{ "subject": "cs", "topic": "files", "tags": ["filesystem"], "difficulty": "medium", "type": "code", "marks": 2, "text": "Print the total size in bytes of all .txt files under the folder data, including subfolders.\nOutput: one integer.", "language": "python", "setup": "A folder data containing: a.txt (the 5 characters hello), notes.md (the 3 characters abc), sub/b.txt (the 10 characters 0123456789) and sub/deep/c.txt (the 1 character x). No newline at the end of any file.", "tests": [ { "input": "", "output": "16" } ], "solution": "import os\nt = 0\nfor root, dirs, files in os.walk('data'):\n    for n in files:\n        if n.endswith('.txt'):\n            t += os.path.getsize(os.path.join(root, n))\nprint(t)", "explanation": "The .txt files hold 5 + 10 + 1 = 16 bytes; notes.md is skipped." }
Example of a question with setup (SQL):
{ "subject": "cs", "topic": "sql", "tags": ["sql"], "difficulty": "medium", "type": "code", "marks": 2, "text": "Open the SQLite database shop.db with Python's sqlite3 module and print each customer with the total of their orders, one line per customer in the form name total, sorted by name.", "language": "python", "setup": "A SQLite file shop.db with one table: CREATE TABLE orders(id INTEGER PRIMARY KEY, customer TEXT, amount INTEGER); and the rows (1,'asha',100), (2,'ravi',250), (3,'asha',50).", "tests": [ { "input": "", "output": "asha 150\nravi 250" } ], "solution": "import sqlite3\nc = sqlite3.connect('shop.db')\nfor n, t in c.execute('SELECT customer, SUM(amount) FROM orders GROUP BY customer ORDER BY customer'):\n    print(n, t)", "explanation": "asha has 100 + 50 and ravi has 250." }

HOW TO WRITE MATHS (LaTeX). The app draws every question, option and explanation with KaTeX, so write ALL maths as LaTeX:
1. Put inline maths between single dollar signs: $x^2 + 1$. Put big or important equations on their own line between double dollar signs: $$\int_0^1 x^2\,dx = \frac{1}{3}$$
2. Use LaTeX for every variable, number with a formula, symbol and unit expression: write $x$, not x. This applies to "text", every item in "options", and "explanation". The "answer" of a nat question stays a plain number.
3. JSON RULE (the most common mistake): inside the JSON every LaTeX backslash must be written TWICE.
   Right: "text": "Simplify $\\frac{a}{b} \\times \\sqrt{x}$"   Wrong: "text": "Simplify $\frac{a}{b} \times \sqrt{x}$"
   Single backslashes break: \n \t \f \b \r \v become new lines, tabs and invisible characters, which ruins \neq, \times, \frac, \beta, \rho, \vec and more.
4. A new line in the text is written \n (one backslash, a real JSON new line), not \\n. Use it between paragraphs or steps.
5. A real dollar sign (money) is written \\$, for example "costs \\$5". Never leave a lone $ in the text.
6. Do not use \( \) or \[ \], and do not use packages, \begin{align} or \begin{equation}. Use $$ ... $$ and, for several lines, \begin{aligned} ... \end{aligned} inside $$.
7. CODE: the app colours code by language. Never put code or program text between dollar signs.
   - A piece of code inside a sentence goes between single backticks: "What does ${TICK}len(xs)${TICK} return?" It is shown exactly as typed, so $ and _ inside it need no LaTeX.
   - A block of code goes between triple backticks, with the language right after the opening ones: "Output of:\n${FENCE}python\nprint(2 + 3)\n${FENCE}". Supported languages: python, sql, c, cpp, java, javascript, typescript, bash, json, r, html. Use "python" for pseudocode. Without a language the block is shown uncoloured.
   - Code works in "text", in every option and in "explanation". Put a block on its own lines with \n before and after it. Never wrap each line of a program in its own single backticks: a whole program is ONE block between triple backticks.
   - JSON RULE for code: inside the JSON string a new line in code is \n, a double quote is \", and a backslash is \\ (for example the C text printf("a\n") is written printf(\"a\\n\")). Never use a real tab: use spaces.
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
