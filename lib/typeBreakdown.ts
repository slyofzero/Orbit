// How many questions of each type a pack holds, per topic: one table for the practice bank, one for the mock tests.
import type { PackData } from "./packs";
import type { Question, QType } from "./types";

export const TYPE_COLS: { type: QType; label: string }[] = [
  { type: "mcq", label: "MCQ" }, { type: "msq", label: "MSQ" }, { type: "nat", label: "NAT" }, { type: "str", label: "Text" }, { type: "code", label: "Programming" },
];
export interface BdRow { key: string; name: string; subject: string; counts: Record<QType, number>; total: number; marks: number }
export interface BdTable { rows: BdRow[]; totals: BdRow; topicsWithout: number }
export interface MockRow { id: string; name: string; minutes: number; sections: number; counts: Record<QType, number>; total: number; marks: number }

const zero = (): Record<QType, number> => ({ mcq: 0, msq: 0, nat: 0, str: 0, code: 0 });
const add = (r: { counts: Record<QType, number>; total: number; marks: number }, q: Question) => { r.counts[q.type]++; r.total++; r.marks += q.marks; };

function table(pack: PackData, qs: Question[]): BdTable {
  const by = new Map<string, BdRow>();
  for (const q of qs) {
    let r = by.get(q.topic);
    if (!r) {
      const t = pack.topics.find((x) => x.id === q.topic);
      const sid = q.subject ?? t?.subject ?? "";
      r = { key: q.topic, name: t?.name ?? q.topic, subject: pack.subjects[sid] ?? sid, counts: zero(), total: 0, marks: 0 };
      by.set(q.topic, r);
    }
    add(r, q);
  }
  const order = new Map(pack.topics.map((t, i) => [t.id, i]));
  const rows = [...by.values()].sort((a, b) => (order.get(a.key) ?? 1e9) - (order.get(b.key) ?? 1e9));
  const totals: BdRow = { key: "total", name: "Total", subject: "", counts: zero(), total: 0, marks: 0 };
  for (const r of rows) { for (const c of TYPE_COLS) totals.counts[c.type] += r.counts[c.type]; totals.total += r.total; totals.marks += r.marks; }
  return { rows, totals, topicsWithout: pack.topics.filter((t) => !by.has(t.id)).length };
}

export function typeBreakdown(pack: PackData): { practice: BdTable; mock: BdTable; mocks: MockRow[] } {
  const mockQs = (pack.mockTests ?? []).flatMap((m) => m.sections.flatMap((s) => s.questions));
  const mocks = (pack.mockTests ?? []).map((m): MockRow => {
    const r: MockRow = { id: m.id, name: m.name, minutes: m.minutes, sections: m.sections.length, counts: zero(), total: 0, marks: 0 };
    for (const s of m.sections) for (const q of s.questions) add(r, q);
    return r;
  });
  return { practice: table(pack, pack.questions), mock: table(pack, mockQs), mocks };
}
