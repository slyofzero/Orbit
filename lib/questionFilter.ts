// Filtering questions by subject, topic and tag. A filter is a list of keys like "subject:cs", "topic:sql", "tag:trap".
// Rule: inside one group a question may match any picked value; across groups it must match every group that has a pick.
import type { PackData } from "./packs";
import { DIFFICULTIES, Difficulty, Question } from "./types";

export type Group = "subject" | "topic" | "difficulty" | "tag";
export const GROUP_LABEL: Record<Group, string> = { subject: "Subject", topic: "Topic", difficulty: "Difficulty", tag: "Misc" };
const isDiff = (t: string) => (DIFFICULTIES as string[]).includes(t);
/** A question's difficulty: its own field, or (in packs saved before the field existed) an easy/medium/hard tag. */
export const difficultyOf = (q: Question): Difficulty | undefined => q.difficulty ?? (q.tags ?? []).find((t): t is Difficulty => isDiff(t));
export const keyOf = (g: Group, v: string) => `${g}:${v}`;
export function parseKey(k: string): { group: Group; value: string } {
  const i = k.indexOf(":");
  return { group: k.slice(0, i) as Group, value: k.slice(i + 1) };
}

export function makeMatcher(pack: PackData, picked: string[]): (q: Question) => boolean {
  if (picked.length === 0) return () => true;
  const by: Record<Group, Set<string>> = { subject: new Set(), topic: new Set(), difficulty: new Set(), tag: new Set() };
  for (const k of picked) { const { group, value } = parseKey(k); by[group]?.add(value); }
  const topicSubject = new Map(pack.topics.map((t) => [t.id, t.subject]));
  return (q) =>
    (!by.subject.size || by.subject.has(q.subject ?? topicSubject.get(q.topic) ?? "")) &&
    (!by.topic.size || by.topic.has(q.topic)) &&
    (!by.difficulty.size || by.difficulty.has(difficultyOf(q) ?? "")) &&
    (!by.tag.size || (q.tags ?? []).some((t) => by.tag.has(t)));
}

export interface Facet { key: string; label: string; count: number }

/** What can be picked among these questions, with how many questions each choice has. Subjects and topics keep the pack's order; tags go most common first. */
export function facets(pack: PackData, qs: Question[]): Record<Group, Facet[]> {
  const subj = new Map<string, number>(), top = new Map<string, number>(), dif = new Map<string, number>(), tag = new Map<string, number>();
  const topicSubject = new Map(pack.topics.map((t) => [t.id, t.subject]));
  for (const q of qs) {
    const s = q.subject ?? topicSubject.get(q.topic) ?? "";
    if (s) subj.set(s, (subj.get(s) ?? 0) + 1);
    top.set(q.topic, (top.get(q.topic) ?? 0) + 1);
    const d = difficultyOf(q);
    if (d) dif.set(d, (dif.get(d) ?? 0) + 1);
    for (const t of new Set(q.tags ?? [])) if (!isDiff(t)) tag.set(t, (tag.get(t) ?? 0) + 1);
  }
  const subjects = [...subj.keys()].sort((a, b) => Object.keys(pack.subjects).indexOf(a) - Object.keys(pack.subjects).indexOf(b));
  const topicIds = pack.topics.map((t) => t.id).filter((id) => top.has(id));
  return {
    subject: subjects.map((id) => ({ key: keyOf("subject", id), label: pack.subjects[id] ?? id, count: subj.get(id)! })),
    topic: topicIds.map((id) => ({ key: keyOf("topic", id), label: pack.topics.find((t) => t.id === id)!.name, count: top.get(id)! })),
    difficulty: DIFFICULTIES.filter((d) => dif.has(d)).map((d) => ({ key: keyOf("difficulty", d), label: d[0].toUpperCase() + d.slice(1), count: dif.get(d)! })),
    tag: [...tag.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([t, c]) => ({ key: keyOf("tag", t), label: t, count: c })),
  };
}
