import { writeFileSync } from "node:fs";
import { parsePack, mergePack, packToJson } from "../lib/packs";
const subjects = { m: "Maths", p: "Probability" };
const q = (id: string, topic: string, text: string, answer: number, extra: object = {}) =>
  ({ id, subject: topic === "alg" || topic === "calc" ? "m" : "p", topic, difficulty: "easy", type: "nat", marks: 1, text, answer, explanation: "Worked out in one step.", tags: ["test"], ...extra });
const mcq = (id: string, topic: string, text: string, options: string[], answer: number) =>
  ({ id, subject: topic === "alg" || topic === "calc" ? "m" : "p", topic, difficulty: "easy", type: "mcq", marks: 1, text, options, answer, explanation: "Option " + "ABCD"[answer] + " is right.", tags: ["test"] });
const A = { name: "Test pack A", subjects: { m: "Maths" }, topics: [{ id: "alg", subject: "m", name: "Algebra" }, { id: "calc", subject: "m", name: "Calculus" }],
  questions: [q("alg-1", "alg", "If $2x + 3 = 11$, what is $x$?", 4), q("alg-2", "alg", "What is $3^2 + 4^2$?", 25), mcq("calc-1", "calc", "What is $\\frac{d}{dx} x^2$?", ["$x$", "$2x$", "$x^2$", "$2$"], 1)],
  mockTests: [{ id: "mock1", name: "Test mock 1", minutes: 20, sections: [{ name: "Maths", questions: [q("mock1-q1", "alg", "Solve $x - 9 = 1$.", 10), q("mock1-q2", "calc", "What is $\\int_0^1 2x\\,dx$?", 1)] }] }] };
const B = { name: "Test pack B", subjects, topics: [{ id: "alg", subject: "m", name: "Algebra" }, { id: "calc", subject: "m", name: "Calculus" }, { id: "prob", subject: "p", name: "Basic probability" }],
  questions: [
    q("alg-1", "alg", "If $2x + 3 = 11$, what is $x$?", 4),                 // duplicate of A → skipped
    q("alg-2", "alg", "What is $5 \\times 6$?", 30),                          // same id, different question → renamed
    q("prob-1", "prob", "A fair coin is tossed once. What is $P(\\text{heads})$?", 0.5, { tolerance: 0.01 }), // new topic + subject
    mcq("prob-2", "prob", "How many outcomes does one die roll have?", ["2", "4", "6", "12"], 2)],
  mockTests: [
    { id: "mock1", name: "Test mock 1", minutes: 20, sections: [{ name: "Maths", questions: [q("mock1-q1", "alg", "Solve $x - 9 = 1$.", 10), q("mock1-q3", "alg", "Solve $3x = 18$.", 6)] }] }, // q1 is already in A (skipped), q3 joins mock 1
    { id: "mock2", name: "Test mock 2", minutes: 20, sections: [{ name: "Maths", questions: [q("mock1-q2", "calc", "What is $\\lim_{x\\to 0} \\frac{\\sin x}{x}$?", 1), q("mock2-q1", "prob", "$P(\\text{tails})$ for a fair coin?", 0.5, { tolerance: 0.01 })] }] }, // brand-new mock; its mock1-q2 id clashes, so it is renamed
  ] };
for (const [file, p] of [["test-pack-A", A], ["test-pack-B", B]] as const) {
  const r = parsePack(p); if (!r.pack) throw new Error(file + ": " + r.errors.join("; "));
  writeFileSync(`exports/${file}.json`, JSON.stringify(packToJson(r.pack), null, 2));
}
const a = parsePack(A).pack!, b = parsePack(B).pack!;
const m = mergePack(a, b);
console.log("mocks after merge:", m.pack.mockTests.map((x) => x.name + "=" + x.sections.flatMap((y) => y.questions.map((z) => z.id)).join("/")).join(" | "));
console.log("A:", a.questions.length, "B:", b.questions.length, "merged:", m.pack.questions.length, JSON.stringify(m.report));
