import { Attempt, Question, Section } from "./types";
import { BANK } from "./bank";
import { GENERATORS, generate } from "./generators";
import { TOPIC_BY_ID } from "./topics";
import { makeRng, shuffle } from "./rng";

// Blueprint of a full GATE DA paper: 10 GA questions (15 marks) + 55 technical (85 marks).
// [subject, number of 1-mark questions, number of 2-mark questions]
const TECH_BLUEPRINT: [string, number, number][] = [
  ["ps", 4, 5], ["la", 3, 3], ["calc", 1, 1], ["dsa", 4, 5], ["dbms", 3, 4], ["ml", 6, 8], ["ai", 4, 4],
];
const GA_BLUEPRINT = { one: 5, two: 5 };

export interface MockOptions {
  kind: "full" | "sectional" | "subject" | "weak";
  subject?: string; // for kind=subject
  seed: number;
  seenIds: Set<string>;
  weakTopics?: string[]; // for kind=weak
}

function pool(subject: string, marks: 1 | 2, r: () => number, seen: Set<string>, onlyTopics?: string[]): Question[] {
  const inSubject = (t: string) => TOPIC_BY_ID[t]?.subject === subject && (!onlyTopics || onlyTopics.includes(t));
  const stat = BANK.filter((q) => q.marks === marks && inSubject(q.topic));
  const gens = GENERATORS.filter((g) => g.marks === marks && inSubject(g.topic));
  // fresh generated questions are always unseen
  const fresh: Question[] = [];
  for (let i = 0; i < 40 && gens.length; i++) {
    const g = gens[i % gens.length];
    fresh.push(generate(g, Math.floor(r() * 1e9)));
  }
  const unseen = shuffle(r, stat.filter((q) => !seen.has(q.id)));
  const old = shuffle(r, stat.filter((q) => seen.has(q.id)));
  // interleave: prefer unseen static, then fresh generated, then already-seen static
  const out: Question[] = [];
  const f = shuffle(r, fresh);
  let ui = 0, fi = 0;
  while (ui < unseen.length || fi < f.length) {
    if (ui < unseen.length) out.push(unseen[ui++]);
    if (fi < f.length) out.push(f[fi++]);
  }
  return [...out, ...old];
}

export function buildMock(opts: MockOptions): { questions: Question[]; sections: Section[]; durationSec: number; warnings: string[]; title: string } {
  const r = makeRng(opts.seed);
  const warnings: string[] = [];
  const used = new Set<string>();

  const take = (subject: string, marks: 1 | 2, n: number, onlyTopics?: string[]): Question[] => {
    const chosen: Question[] = [];
    for (const q of pool(subject, marks, r, opts.seenIds, onlyTopics)) {
      if (chosen.length >= n) break;
      if (used.has(q.id)) continue;
      used.add(q.id);
      chosen.push(q);
    }
    if (chosen.length < n) warnings.push(`Only ${chosen.length} of ${n} ${marks}-mark ${subject.toUpperCase()} questions were available.`);
    return chosen;
  };

  const scale = opts.kind === "full" ? 1 : opts.kind === "sectional" ? 1 / 3 : 1;
  const scaled = (n: number) => (scale === 1 ? n : Math.max(0, Math.round(n * scale)));

  let ga: Question[] = [], tech: Question[] = [];
  let title = "Full Mock (GATE DA pattern)";
  let durationSec = 180 * 60;

  if (opts.kind === "full" || opts.kind === "sectional") {
    ga = [...take("ga", 1, scaled(GA_BLUEPRINT.one)), ...take("ga", 2, scaled(GA_BLUEPRINT.two))];
    const ones: Question[] = [], twos: Question[] = [];
    for (const [s, n1, n2] of TECH_BLUEPRINT) {
      ones.push(...take(s, 1, scaled(n1)));
      twos.push(...take(s, 2, scaled(n2)));
    }
    tech = [...shuffle(r, ones), ...shuffle(r, twos)];
    if (opts.kind === "sectional") {
      title = "1-Hour Sectional Mock";
      durationSec = 60 * 60;
    }
  } else if (opts.kind === "subject" && opts.subject) {
    const ones = take(opts.subject, 1, 12), twos = take(opts.subject, 2, 8);
    tech = [...shuffle(r, ones), ...shuffle(r, twos)];
    title = `Subject Test: ${opts.subject.toUpperCase()}`;
    durationSec = Math.max(20, Math.round((tech.reduce((s, q) => s + q.marks, 0) * 1.8))) * 60;
  } else if (opts.kind === "weak") {
    const topics = opts.weakTopics ?? [];
    const subjects = [...new Set(topics.map((t) => TOPIC_BY_ID[t]?.subject).filter((s) => s && s !== "ga"))] as string[];
    const ones: Question[] = [], twos: Question[] = [];
    for (const s of subjects) {
      const only = topics.filter((t) => TOPIC_BY_ID[t].subject === s);
      ones.push(...take(s, 1, 5, only));
      twos.push(...take(s, 2, 3, only));
    }
    tech = [...shuffle(r, ones), ...shuffle(r, twos)];
    title = "Weak-Topics Mock";
    durationSec = Math.max(30, Math.round(tech.reduce((s, q) => s + q.marks, 0) * 1.8)) * 60;
  }

  const questions = [...ga, ...tech];
  const sections: Section[] = [];
  if (ga.length) sections.push({ name: "General Aptitude", from: 0, to: ga.length - 1 });
  if (tech.length) sections.push({ name: "Data Science and Artificial Intelligence", from: ga.length, to: questions.length - 1 });
  // keep warnings short
  const uniq = [...new Set(warnings)].slice(0, 6);
  return { questions, sections, durationSec, warnings: uniq, title };
}
