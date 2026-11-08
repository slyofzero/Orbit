// Combines several question-pack files into ONE pack before it is checked, so ids the system hands out are numbered once across all files.
// Rules: the first file wins for subject names and topics; a question, mock test or recipe with the same id in a later file replaces the earlier one.
type Obj = Record<string, unknown>;
const isObj = (x: unknown): x is Obj => typeof x === "object" && x !== null && !Array.isArray(x);

export interface MergedFiles { json?: string; errors: string[]; notes: string[]; name?: string }

/** The system-generated name for a merged pack, like "Merged pack · 3 files · 8 Nov 2026". */
export const mergedName = (files: number, today = new Date()) =>
  `Merged pack · ${files} files · ${today.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`;

export function mergeFiles(files: { name: string; text: string }[], today = new Date()): MergedFiles {
  const errors: string[] = [], notes: string[] = [];
  const parsed: { name: string; data: Obj }[] = [];
  for (const f of files) {
    try {
      const data = JSON.parse(f.text);
      if (!isObj(data)) errors.push(`${f.name}: the file must be one JSON object.`);
      else parsed.push({ name: f.name, data });
    } catch (e) { errors.push(`${f.name}: this is not valid JSON (${(e as Error).message}).`); }
  }
  if (errors.length) return { errors, notes };

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
  if (errors.length) return { errors, notes };

  const name = mergedName(files.length, today);
  notes.push(`Merged ${files.length} files: ${parsed.map((p) => p.name).join(", ")}.`);
  if (replaced) notes.push(`${replaced} question, mock test or recipe id${replaced === 1 ? " appears" : "s appear"} in more than one file. The later file's version was kept.`);
  if (topicClash) notes.push(`${topicClash} topic id${topicClash === 1 ? " is" : "s are"} in different subjects in different files. The first file's subject was kept.`);
  const out: Obj = { name, subjects, topics: [...topics.values()], questions };
  if (mockTests.size) out.mockTests = [...mockTests.values()];
  if (mocks.size) out.mocks = [...mocks.values()];
  if (Object.keys(images).length) out.images = images;
  if (builtin) out.useBuiltinGenerators = true;
  return { json: JSON.stringify(out), errors, notes, name };
}
