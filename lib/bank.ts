import { Question } from "./types";
import { TOPIC_BY_ID } from "./topics";
import { GENERATORS, generate, generatorsForTopic } from "./generators";
import { PS } from "./questions/ps";
import { LA } from "./questions/la";
import { CALC } from "./questions/calc";
import { DSA } from "./questions/dsa";
import { DBMS } from "./questions/dbms";
import { ML } from "./questions/ml";
import { AI } from "./questions/ai";
import { GA } from "./questions/ga";
import { QBody } from "./questions/helpers";

// IDs are "<topic>-<n>" in definition order. Append new questions at the END of a file so ids stay stable.
const counters: Record<string, number> = {};
function assign(list: QBody[]): Question[] {
  return list.map((q) => {
    counters[q.topic] = (counters[q.topic] ?? 0) + 1;
    if (!TOPIC_BY_ID[q.topic]) throw new Error(`Unknown topic id: ${q.topic}`);
    return { ...q, id: `${q.topic}-${counters[q.topic]}` };
  });
}

export const BANK: Question[] = [PS, LA, CALC, DSA, DBMS, ML, AI, GA].flatMap(assign);
const BY_ID = new Map(BANK.map((q) => [q.id, q]));

export function findQuestion(id: string): Question | undefined {
  if (id.startsWith("g:")) {
    const [, gid, seed] = id.split(":");
    const gen = GENERATORS.find((g) => g.id === gid);
    return gen ? generate(gen, Number(seed)) : undefined;
  }
  return BY_ID.get(id);
}

export const staticForTopic = (topic: string) => BANK.filter((q) => q.topic === topic);
export const hasGenerator = (topic: string) => generatorsForTopic(topic).length > 0;

export function newGenerated(topic: string, seed: number): Question | undefined {
  const gens = generatorsForTopic(topic);
  if (!gens.length) return undefined;
  return generate(gens[seed % gens.length], seed);
}

export const subjectOfQuestion = (q: Question) => TOPIC_BY_ID[q.topic]?.subject ?? "ga";
