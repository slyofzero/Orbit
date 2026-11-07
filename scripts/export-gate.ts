// Writes the two files you can upload in the app:
//   exports/gate-da-2027-plan.json   -> Planner > Change plan
//   exports/gate-da-2027-pack.json   -> Practice > Question pack
// Run with: bun run export
import { writeFileSync } from "node:fs";
import { BANK } from "../lib/gateBank";
import { GATE_PLAN } from "../lib/gatePlan";
import { SUBJECTS, TOPICS } from "../lib/topics";
import type { MockTemplate } from "../lib/packs";
import { planToJson } from "../lib/customPlan";

export const gatePlanJson = () => planToJson(GATE_PLAN);

// The real paper: 10 General Aptitude questions (15 marks) + 55 technical (85 marks). [subject, 1-mark count, 2-mark count]
const TECH: [string, number, number][] = [["ps", 4, 5], ["la", 3, 3], ["calc", 1, 1], ["dsa", 4, 5], ["dbms", 3, 4], ["ml", 6, 8], ["ai", 4, 4]];
const scaled = (n: number, k: number) => (k === 1 ? n : Math.max(0, Math.round(n * k)));
const mockFor = (id: string, name: string, minutes: number, k: number, note: string): MockTemplate => ({
  id, name, minutes, note,
  sections: [
    { name: "General Aptitude", picks: [{ subject: "ga", one: scaled(5, k), two: scaled(5, k) }] },
    { name: "Data Science and Artificial Intelligence", picks: TECH.map(([subject, one, two]) => ({ subject, one: scaled(one, k), two: scaled(two, k) })) },
  ],
});

export function gatePackJson() {
  return {
    name: "GATE DA 2027 question pack",
    useBuiltinGenerators: true,
    subjects: SUBJECTS,
    topics: TOPICS.map(({ id, subject, name, status }) => ({ id, subject, name, status })),
    questions: BANK.map((q) => ({ id: q.id, subject: TOPICS.find((t) => t.id === q.topic)?.subject, topic: q.topic, type: q.type, marks: q.marks, text: q.text, ...(q.options ? { options: q.options } : {}), answer: q.answer, explanation: q.explanation })),
    mocks: [
      mockFor("full", "Full mock (GATE DA pattern)", 180, 1, "10 General Aptitude + 55 technical questions, like the real paper."),
      mockFor("sectional", "1-hour sectional mock", 60, 1 / 3, "About a third of the paper. Use it in busy weeks."),
    ],
  };
}

if (import.meta.main) {
  writeFileSync("exports/gate-da-2027-plan.json", JSON.stringify(gatePlanJson(), null, 2));
  writeFileSync("exports/gate-da-2027-pack.json", JSON.stringify(gatePackJson(), null, 2));
  console.log("wrote exports/gate-da-2027-plan.json and exports/gate-da-2027-pack.json");
}
