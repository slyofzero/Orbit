// Editing a pack one piece at a time (used by the admin screens). Pure functions, tested by scripts/check.ts.
import { FixedMock, Loc, PackData, allQuestions, locate, parsePack } from "./packs";
import { Question } from "./types";

export type Target = { bank: "practice" } | { bank: "mock"; mockId: string; section: string };

/** Takes a question out of wherever it lives. A mock section left empty is removed. */
export function removeQuestion(pack: PackData, id: string): PackData {
  return {
    ...pack,
    questions: pack.questions.filter((q) => q.id !== id),
    mockTests: (pack.mockTests ?? []).map((m) => ({ ...m, sections: m.sections.map((x) => ({ ...x, questions: x.questions.filter((q) => q.id !== id) })).filter((x) => x.questions.length) })),
  };
}

/** Saves a question. An id that already exists is replaced in place; if the target is a different place, the question moves there. */
export function upsertQuestion(pack: PackData, q: Question, target: Target): PackData {
  const at = locate(pack, q.id);
  const sameSpot = !!at && (target.bank === "practice" ? at.bank === "practice" : at.bank === "mock" && at.mockId === target.mockId && at.section === target.section);
  if (sameSpot) {
    return {
      ...pack,
      questions: pack.questions.map((x) => (x.id === q.id ? q : x)),
      mockTests: pack.mockTests.map((m) => ({ ...m, sections: m.sections.map((s) => ({ ...s, questions: s.questions.map((x) => (x.id === q.id ? q : x)) })) })),
    };
  }
  const base = at ? removeQuestion(pack, q.id) : pack;
  if (target.bank === "practice") return { ...base, questions: [...base.questions, q] };
  if (!base.mockTests.some((m) => m.id === target.mockId)) throw new Error(`There is no mock test "${target.mockId}".`);
  return {
    ...base,
    mockTests: base.mockTests.map((m) => {
      if (m.id !== target.mockId) return m;
      const has = m.sections.some((s) => s.name === target.section);
      return { ...m, sections: has ? m.sections.map((s) => (s.name === target.section ? { ...s, questions: [...s.questions, q] } : s)) : [...m.sections, { name: target.section, questions: [q] }] };
    }),
  };
}

/** An id nobody uses yet, like "algebra-7" or "mock1-q4". */
export function freeId(pack: PackData, prefix: string): string {
  const used = new Set(allQuestions(pack).map((l) => l.q.id));
  const clean = prefix.replace(/[^A-Za-z0-9_.-]/g, "").slice(0, 40) || "q";
  for (let n = allQuestions(pack).filter((l) => l.q.id.startsWith(`${clean}-`)).length + 1; ; n++) if (!used.has(`${clean}-${n}`)) return `${clean}-${n}`;
}

/** Runs one question through the same checks an upload gets (LaTeX, answers, pictures, tags), so the editor can't save a broken question. */
export function checkQuestion(pack: PackData, raw: unknown, images: Record<string, string>): { question?: Question; errors: string[] } {
  const r = parsePack({ name: "check", subjects: pack.subjects, topics: pack.topics.map(({ id, subject, name, status }) => ({ id, subject, name, status })), questions: [raw], images });
  if (!r.pack || !r.pack.questions[0]) return { errors: r.errors.map((e) => e.replace(/^questions\[0\]\.?/, "")) };
  return { question: r.pack.questions[0], errors: [] };
}

export type { Loc, FixedMock };

/** Looks for ids that contain `needle` (any case). An exact match comes first. */
export function searchIds(pack: PackData, needle: string, limit = 30): Loc[] {
  const n = needle.trim().toLowerCase();
  if (!n) return [];
  const hits = allQuestions(pack).filter((l) => l.q.id.toLowerCase().includes(n));
  return hits.sort((a, b) => Number(b.q.id.toLowerCase() === n) - Number(a.q.id.toLowerCase() === n)).slice(0, limit);
}

// ---------- inside one mock test ----------
const withMock = (pack: PackData, mockId: string, f: (m: FixedMock) => FixedMock): PackData => ({ ...pack, mockTests: pack.mockTests.map((m) => (m.id === mockId ? f(m) : m)) });
const swap = <T,>(a: T[], i: number, j: number): T[] => { if (j < 0 || j >= a.length) return a; const c = [...a]; [c[i], c[j]] = [c[j], c[i]]; return c; };

/** Moves a question one place up (-1) or down (+1) inside its section, which is the order it appears in the exam. */
export function moveQuestion(pack: PackData, mockId: string, section: string, id: string, dir: -1 | 1): PackData {
  return withMock(pack, mockId, (m) => ({ ...m, sections: m.sections.map((s) => (s.name !== section ? s : { ...s, questions: swap(s.questions, s.questions.findIndex((q) => q.id === id), s.questions.findIndex((q) => q.id === id) + dir) })) }));
}
export const moveSection = (pack: PackData, mockId: string, section: string, dir: -1 | 1): PackData =>
  withMock(pack, mockId, (m) => { const i = m.sections.findIndex((s) => s.name === section); return { ...m, sections: swap(m.sections, i, i + dir) }; });

/** Renames a section. Returns an error text instead when the name is empty or already taken in that mock. */
export function renameSection(pack: PackData, mockId: string, from: string, to: string): PackData | string {
  const name = to.trim().slice(0, 60);
  if (!name) return "A section needs a name.";
  const m = pack.mockTests.find((x) => x.id === mockId);
  if (m?.sections.some((s) => s.name === name && s.name !== from)) return `This mock already has a section called "${name}".`;
  return withMock(pack, mockId, (mm) => ({ ...mm, sections: mm.sections.map((s) => (s.name === from ? { ...s, name } : s)) }));
}
export const deleteSection = (pack: PackData, mockId: string, section: string): PackData =>
  withMock(pack, mockId, (m) => ({ ...m, sections: m.sections.filter((s) => s.name !== section) }));
