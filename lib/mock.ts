import { Attempt, Question, Section } from "./types";
import { GENERATORS, generate } from "./generators";
import { FixedMock, MockPick, MockTemplate, PackData } from "./packs";
import { makeRng, shuffle } from "./rng";

export interface MockOptions {
  kind: "template" | "subject" | "topic" | "weak" | "quick";
  template?: MockTemplate; // for kind=template
  subject?: string; // for kind=subject
  topic?: string; // for kind=topic
  seed: number;
  seenIds: Set<string>;
}

export interface BuiltMock { questions: Question[]; sections: Section[]; durationSec: number; warnings: string[]; title: string }

const minutesFor = (qs: Question[], min: number) => Math.max(min, Math.round(qs.reduce((s, q) => s + q.marks, 0) * 1.8));

export function buildMock(pack: PackData, opts: MockOptions): BuiltMock {
  const r = makeRng(opts.seed);
  const warnings: string[] = [];
  const used = new Set<string>();
  const topicSubject = new Map(pack.topics.map((t) => [t.id, t.subject]));

  // unseen questions first, then fresh generated ones (GATE DA pack only), then ones you have already seen
  const pool = (subject: string, marks: 1 | 2, onlyTopics?: string[]): Question[] => {
    const inSubject = (t: string) => topicSubject.get(t) === subject && (!onlyTopics || onlyTopics.includes(t));
    const stat = pack.questions.filter((q) => q.type !== "code" && q.marks === marks && inSubject(q.topic)); // programming questions cannot run in the exam screen
    const gens = pack.useBuiltinGenerators ? GENERATORS.filter((g) => g.marks === marks && inSubject(g.topic)) : [];
    const fresh: Question[] = [];
    for (let i = 0; i < 40 && gens.length; i++) fresh.push(generate(gens[i % gens.length], Math.floor(r() * 1e9)));
    const unseen = shuffle(r, stat.filter((q) => !opts.seenIds.has(q.id)));
    const old = shuffle(r, stat.filter((q) => opts.seenIds.has(q.id)));
    const f = shuffle(r, fresh);
    const out: Question[] = [];
    let ui = 0, fi = 0;
    while (ui < unseen.length || fi < f.length) {
      if (ui < unseen.length) out.push(unseen[ui++]);
      if (fi < f.length) out.push(f[fi++]);
    }
    return [...out, ...old];
  };

  const take = (subject: string, marks: 1 | 2, n: number, onlyTopics?: string[]): Question[] => {
    if (n <= 0) return [];
    const chosen: Question[] = [];
    for (const q of pool(subject, marks, onlyTopics)) {
      if (chosen.length >= n) break;
      if (used.has(q.id)) continue;
      used.add(q.id);
      chosen.push(q);
    }
    if (chosen.length < n) warnings.push(`Only ${chosen.length} of ${n} ${marks}-mark ${pack.subjects[subject] ?? subject} questions were available.`);
    return chosen;
  };

  const drawPicks = (picks: MockPick[]): Question[] => {
    const ones: Question[] = [], twos: Question[] = [];
    for (const p of picks) {
      ones.push(...take(p.subject, 1, p.one, p.topics));
      twos.push(...take(p.subject, 2, p.two, p.topics));
    }
    return [...shuffle(r, ones), ...shuffle(r, twos)];
  };

  const groups: { name: string; qs: Question[] }[] = [];
  let title = "Mock test";
  let minutes = 60;

  if (opts.kind === "template" && opts.template) {
    title = opts.template.name;
    minutes = opts.template.minutes;
    for (const s of opts.template.sections) groups.push({ name: s.name, qs: drawPicks(s.picks) });
  } else if (opts.kind === "subject" && opts.subject) {
    const qs = drawPicks([{ subject: opts.subject, one: 12, two: 8 }]);
    groups.push({ name: pack.subjects[opts.subject] ?? opts.subject, qs });
    title = `Subject test: ${pack.subjects[opts.subject] ?? opts.subject}`;
    minutes = minutesFor(qs, 20);
  } else if (opts.kind === "topic" && opts.topic) {
    const t = pack.topics.find((x) => x.id === opts.topic);
    const qs = t ? drawPicks([{ subject: t.subject, one: 12, two: 8, topics: [t.id] }]) : [];
    groups.push({ name: t?.name ?? opts.topic, qs });
    title = `Topic test: ${t?.name ?? opts.topic}`;
    minutes = minutesFor(qs, 15);
  } else if (opts.kind === "weak") {
    const weak = pack.topics.filter((t) => t.status !== "know");
    const subjects = [...new Set(weak.map((t) => t.subject))];
    const qs: Question[] = [];
    for (const s of subjects) qs.push(...drawPicks([{ subject: s, one: 5, two: 3, topics: weak.filter((t) => t.subject === s).map((t) => t.id) }]));
    groups.push({ name: "Your weak topics", qs });
    title = "Weak-topics test";
    minutes = minutesFor(qs, 30);
  } else {
    // quick mixed test: a few questions from every subject
    const subjects = Object.keys(pack.subjects);
    const per = Math.max(1, Math.ceil(15 / Math.max(1, subjects.length)));
    const qs: Question[] = [];
    for (const s of subjects) qs.push(...drawPicks([{ subject: s, one: Math.ceil(per * 0.7), two: Math.floor(per * 0.3) }]));
    groups.push({ name: "Mixed questions", qs });
    title = "Quick mixed test";
    minutes = minutesFor(qs, 15);
  }

  const questions: Question[] = [];
  const sections: Section[] = [];
  for (const g of groups) {
    if (!g.qs.length) continue;
    sections.push({ name: g.name, from: questions.length, to: questions.length + g.qs.length - 1 });
    questions.push(...g.qs);
  }
  return { questions, sections, durationSec: minutes * 60, warnings: [...new Set(warnings)].slice(0, 6), title };
}

/** A real mock test: exactly its own questions, in the order they were written. Nothing is drawn from Practice. */
export function buildFixedMock(m: FixedMock): BuiltMock {
  const questions: Question[] = [];
  const sections: Section[] = [];
  for (const sec of m.sections) {
    if (!sec.questions.length) continue;
    sections.push({ name: sec.name, from: questions.length, to: questions.length + sec.questions.length - 1 });
    questions.push(...sec.questions);
  }
  return { questions, sections, durationSec: m.minutes * 60, warnings: [], title: m.name };
}

/** Turns a built mock into an attempt you can open at /exam/<id>. */
export function attemptFrom(m: BuiltMock): Attempt {
  return { id: `m${Date.now().toString(36)}`, title: m.title, createdAt: Date.now(), durationSec: m.durationSec, questions: m.questions, sections: m.sections, responses: {}, warnings: m.warnings };
}
