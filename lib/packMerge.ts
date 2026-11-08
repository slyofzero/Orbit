// Combines several question-pack files into ONE pack before it is checked, so ids the system hands out are numbered once across all files.
// Rules: the first file wins for subject names and topics; a question, mock test or recipe with the same id in a later file replaces the earlier one.
import { parsePack, type PackData } from "./packs";
type Obj = Record<string, unknown>;
const isObj = (x: unknown): x is Obj => typeof x === "object" && x !== null && !Array.isArray(x);

/** Problems grouped by the file they belong to, so you know exactly which file to fix. */
export interface FileProblems { file: string; errors: string[] }
export interface MergedFiles { json?: string; errors: string[]; problems: FileProblems[]; notes: string[]; name?: string }

/** The system-generated name for a merged pack, like "Merged pack · 3 files · 8 Nov 2026". */
export const mergedName = (files: number, today = new Date()) =>
  `Merged pack · ${files} files · ${today.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`;

export function mergeFiles(files: { name: string; text: string }[], today = new Date(), existing?: PackData): MergedFiles {
  const errors: string[] = [], notes: string[] = [], problems: FileProblems[] = [];
  const parsed: { name: string; data: Obj }[] = [];
  for (const f of files) {
    try {
      const data = JSON.parse(f.text);
      if (!isObj(data)) errors.push(`${f.name}: the file must be one JSON object.`);
      else parsed.push({ name: f.name, data });
    } catch (e) { errors.push(`${f.name}: this is not valid JSON (${(e as Error).message}).`); }
  }
  if (errors.length) return { errors, problems: errors.map((e) => { const i = e.indexOf(": "); return { file: e.slice(0, i), errors: [e.slice(i + 2)] }; }), notes };

  // check every file on its own, so each problem is reported under the file it is in. Topics and subjects from the other files count as known,
  // because files that are meant to be merged may share them.
  const allTopics = new Map<string, unknown>(), allSubjects: Record<string, string> = {};
  for (const { data } of parsed) {
    if (Array.isArray(data.topics)) for (const t of data.topics) if (isObj(t) && typeof t.id === "string" && !allTopics.has(t.id)) allTopics.set(t.id, t);
    if (isObj(data.subjects)) for (const [k, v] of Object.entries(data.subjects)) if (typeof v === "string" && !(k in allSubjects)) allSubjects[k] = v;
  }
  for (const { name, data } of parsed) {
    const own = new Set(Array.isArray(data.topics) ? data.topics.map((t) => (isObj(t) ? t.id : null)) : []);
    const topics = [...(Array.isArray(data.topics) ? data.topics : []), ...[...allTopics.values()].filter((t) => !own.has((t as Obj).id))];
    const r = parsePack({ ...data, subjects: { ...allSubjects, ...(isObj(data.subjects) ? data.subjects : {}) }, topics }, existing);
    if (!r.pack) problems.push({ file: name, errors: r.errors });
  }
  if (problems.length) return { errors: problems.flatMap((p) => p.errors.map((e) => `${p.file}: ${e}`)), problems, notes };

  const subjects: Record<string, string> = {};
  const topics = new Map<string, Obj>();
  const questions: unknown[] = [];
  const mockTests = new Map<string, unknown>(), mocks = new Map<string, unknown>(), images: Record<string, string> = {};
  const qIndex = new Map<string, number>(); // explicit question id -> position in `questions`
  let builtin = false, replaced = 0, topicClash = 0;

  for (const { name, data } of parsed) {
    if (isObj(data.subjects)) for (const [k, v] of Object.entries(data.subjects)) if (!(k in subjects) && typeof v === "string") subjects[k] = v;
    if (Array.isArray(data.topics)) for (const t of data.topics) {
      if (!isObj(t) || typeof t.id !== "string") { topics.set(`?${topics.size}`, t as Obj); continue; } // left for the checker to report
      const have = topics.get(t.id);
      if (!have) topics.set(t.id, t);
      else if (have.subject !== t.subject) topicClash++;
    }
    if (Array.isArray(data.questions)) for (const q of data.questions) {
      const id = isObj(q) && typeof q.id === "string" ? q.id : null;
      if (id !== null && qIndex.has(id)) { questions[qIndex.get(id)!] = q; replaced++; }
      else { if (id !== null) qIndex.set(id, questions.length); questions.push(q); }
    }
    for (const [list, into] of [[data.mockTests, mockTests], [data.mocks, mocks]] as const) {
      if (!Array.isArray(list)) continue;
      for (const m of list) {
        const id = isObj(m) && typeof m.id === "string" ? m.id : `?${into.size}`;
        if (into.has(id) && id[0] !== "?") replaced++;
        into.set(id, m);
      }
    }
    if (isObj(data.images)) for (const [k, v] of Object.entries(data.images)) {
      if (typeof v === "string" && k in images && images[k] !== v) errors.push(`${name}: the picture name "${k}" is used for a different picture in another file. Rename it in one of the files.`);
      else if (typeof v === "string") images[k] = v;
    }
    if (data.useBuiltinGenerators === true) builtin = true;
  }
  if (errors.length) return { errors, problems: errors.map((e) => { const i = e.indexOf(": "); return { file: e.slice(0, i), errors: [e.slice(i + 2)] }; }), notes };

  const name = mergedName(files.length, today);
  notes.push(`Merged ${files.length} files: ${parsed.map((p) => p.name).join(", ")}.`);
  if (replaced) notes.push(`${replaced} question, mock test or recipe id${replaced === 1 ? " appears" : "s appear"} in more than one file. The later file's version was kept.`);
  if (topicClash) notes.push(`${topicClash} topic id${topicClash === 1 ? " is" : "s are"} in different subjects in different files. The first file's subject was kept.`);
  const out: Obj = { name, subjects, topics: [...topics.values()], questions };
  if (mockTests.size) out.mockTests = [...mockTests.values()];
  if (mocks.size) out.mocks = [...mocks.values()];
  if (Object.keys(images).length) out.images = images;
  if (builtin) out.useBuiltinGenerators = true;
  return { json: JSON.stringify(out), errors, problems, notes, name };
}
