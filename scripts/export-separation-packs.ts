import { writeFileSync } from "node:fs";
import { parsePack, packToJson } from "../lib/packs";
const subjects = { m: "Maths" };
const topics = [{ id: "alg", subject: "m", name: "Algebra" }, { id: "geo", subject: "m", name: "Geometry" }];
// every question has its own wording and answer, plus a label for which bank it belongs to, so any mix-up is obvious
const mk = (id: string, topic: string, label: string, text: string, answer: number) => ({ id, subject: "m", topic, difficulty: "easy", type: "nat", marks: 1, text: `[${label}] ${text}`, answer, tolerance: 0, explanation: `The answer is ${answer}.`, tags: [label.toLowerCase().replace(" ", "-")] });
const practice = [
  mk("p-1", "alg", "PRACTICE", "Solve $x + 7 = 12$.", 5),
  mk("p-2", "geo", "PRACTICE", "A square has side $4$. What is its area?", 16),
  mk("p-3", "alg", "PRACTICE", "What is $3 \\times 9$?", 27),
  mk("p-4", "geo", "PRACTICE", "How many degrees are in a right angle?", 90),
  mk("p-5", "alg", "PRACTICE", "Solve $2x = 18$.", 9),
  mk("p-6", "geo", "PRACTICE", "A triangle has angles $60$ and $70$. What is the third angle?", 50),
];
const mockA = [
  mk("mockA-q1", "alg", "MOCK A", "Solve $x - 15 = 20$.", 35),
  mk("mockA-q2", "geo", "MOCK A", "A rectangle is $6$ by $7$. What is its area?", 42),
  mk("mockA-q3", "alg", "MOCK A", "What is $11 \\times 11$?", 121),
  mk("mockA-q4", "geo", "MOCK A", "How many sides does a hexagon have?", 6),
];
const mockB = [
  mk("mockB-q1", "alg", "MOCK B", "Solve $5x = 85$.", 17),
  mk("mockB-q2", "geo", "MOCK B", "A circle has diameter $10$. What is its radius?", 5),
  mk("mockB-q3", "alg", "MOCK B", "What is $2^{10}$?", 1024),
  mk("mockB-q4", "geo", "MOCK B", "The angles of a triangle are $x$, $x$ and $90$. Find $x$.", 45),
];
const mock = (id: string, name: string, questions: object[]) => ({ id, name, minutes: 10, sections: [{ name: "Maths", questions }] });
const good = { name: "Separation test", subjects, topics, questions: practice, mockTests: [mock("mockA", "Mock A", mockA), mock("mockB", "Mock B", mockB)] };
// BAD: Mock B reuses a question id from Mock A, and Mock A reuses a practice id. Uploading this must be refused.
const bad = JSON.parse(JSON.stringify(good)); bad.name = "Separation test (should be refused)";
bad.mockTests[0].sections[0].questions[0].id = "p-1";
bad.mockTests[1].sections[0].questions[0].id = "mockA-q2";
const r = parsePack(good); if (!r.pack) throw new Error(r.errors.join("; "));
writeFileSync("exports/separation-test-pack.json", JSON.stringify(packToJson(r.pack), null, 2));
writeFileSync("exports/separation-test-BAD-pack.json", JSON.stringify(bad, null, 2));
const rb = parsePack(bad);
console.log("good ok:", !!r.pack, "| bad refused:", !rb.pack, rb.errors);
