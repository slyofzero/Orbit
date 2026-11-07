// The built-in GATE DA 2027 plan. The app does NOT load this by default: it is only the source for
// `bun run export` (scripts/export-gate.ts), which writes the JSON you can upload on the Planner page.
import { Day, DayKind } from "./types";
import { TOPICS } from "./topics";
import { Milestone, PlanData, addDays, weekday } from "./plan";

const sub = (s: string) => TOPICS.filter((t) => t.subject === s).map((t) => t.id);
const SHAKY_IDS = TOPICS.filter((t) => t.status === "shaky").map((t) => t.id);
const ALL_TECH = TOPICS.filter((t) => t.subject !== "ga").map((t) => t.id);

// ---------- the one date everything counts back from ----------
// Not confirmed: GATE 2027 runs on 6, 7, 13, 14, 20, 21 Feb and the DA slot was not published when this was written.
export const GATE_DATE = "2027-02-07";

// ---------- build days ----------
const days = new Map<string, Day>();

function put(date: string, phase: Day["phase"], kind: DayKind, hours: number, title: string, topics: string[] = []) {
  let tasks: string[] = [];
  let targetQs = 0;
  switch (kind) {
    case "study":
      tasks = [
        `Main block: ${title} (about 1.5 h)`,
        "Solve problems on today's topic (about 1 h)",
        "Spaced revision of an earlier topic (30 min)",
        "Add anything you got wrong to your mistake log",
      ];
      targetQs = 10;
      break;
    case "crunch":
      tasks = title.startsWith("First pass")
        ? [`${title} (1 hr): read or watch, then write short notes. No problem sets yet.`, "Note anything unclear for later"]
        : [`1 hr: ${title}`, "Note down anything unclear in the mistake log"];
      targetQs = title.startsWith("First pass") ? 0 : 5;
      break;
    case "light":
      tasks = ["30-60 min of spaced revision of recent topics (TA session night)", "Answer 5 practice questions from older topics"];
      targetQs = 5;
      break;
    case "mock":
      tasks = title.includes("sectional")
        ? ["Take the 1-hour sectional mock in the Mocks tab", "Review every wrong or unattempted question", "Update the mistake log"]
        : ["Take the full 3-hour mock in the Mocks tab", "Review every wrong or unattempted question (about 1.5 h)", "Update the mistake log"];
      break;
    case "buffer":
      tasks = ["Catch up on anything skipped (viva slippage)", "Fix weak spots from the mistake log", "Answer 10 practice questions on your weakest topics"];
      targetQs = 10;
      break;
    case "exam":
      tasks = title.startsWith("GATE")
        ? ["Carry your admit card and a photo ID", "Reach the centre early. Nothing else today."]
        : ["Degree exam day. No GATE study today."];
      break;
    case "taper":
      tasks = ["Read your formula sheet and mistake log only. No new topics.", "Sleep early"];
      break;
  }
  days.set(date, { date, phase, kind, hours, title, topics, tasks, targetQs });
}

// Phase A: Nov 8-14, 1 hr/day first pass
put("2026-11-08", "A", "crunch", 1, "First pass: Logistic Regression", ["logreg"]);
put("2026-11-09", "A", "crunch", 1, "First pass: k-NN", ["knn"]);
put("2026-11-10", "A", "crunch", 1, "First pass: Decision Trees", ["dt"]);
put("2026-11-11", "A", "crunch", 1, "First pass: k-means", ["kmeans"]);
put("2026-11-12", "A", "light", 1, "Light revision (TA day)", ["logreg", "knn"]);
put("2026-11-13", "A", "crunch", 1, "First pass: LU decomposition", ["lu"]);
put("2026-11-14", "A", "crunch", 1, "First pass: SVD", ["svd"]);
put("2026-11-15", "A", "exam", 0, "DEGREE EXAM 1");

// Phase B: Nov 16 - Dec 5
put("2026-11-16", "B", "study", 3, "Problems: Logistic Regression + k-NN", ["logreg", "knn"]);
put("2026-11-17", "B", "study", 3, "Problems: Decision Trees + k-means", ["dt", "kmeans"]);
put("2026-11-18", "B", "study", 3, "Problems: LU + SVD", ["lu", "svd"]);
put("2026-11-19", "B", "light", 1, "Light revision (TA day)", ["logreg", "dt", "lu"]);
put("2026-11-20", "B", "study", 3, "Hashing + Trees", ["hashing", "trees"]);
put("2026-11-21", "B", "study", 4.5, "SQL + UCS", ["sql", "uninformed"]);
put("2026-11-22", "B", "mock", 4.5, "FULL MOCK 1");
put("2026-11-23", "B", "study", 3, "A* + optimality, shaky-topic PYQ catch-up", ["informed", ...SHAKY_IDS.slice(0, 3)]);
put("2026-11-24", "B", "study", 3, "t and chi-squared distributions", ["tchi"]);
put("2026-11-25", "B", "study", 3, "Confidence intervals", ["ci"]);
put("2026-11-26", "B", "light", 1, "Light revision (TA day)", ["tchi", "informed"]);
put("2026-11-27", "B", "study", 3, "Hypothesis tests (z, t)", ["htest"]);
put("2026-11-28", "B", "crunch", 1, "Hypothesis tests (chi-squared)", ["htest"]);
put("2026-11-29", "B", "mock", 1, "1-hr sectional mock");
put("2026-11-30", "B", "crunch", 1, "Stats PYQs", ["bayes", "tchi", "ci", "htest"]);
put("2026-12-01", "B", "crunch", 1, "First pass: SVM", ["svm"]);
put("2026-12-02", "B", "crunch", 1, "First pass: SVM kernels", ["svm"]);
put("2026-12-03", "B", "light", 1, "Light revision (TA day)", ["svm", "htest"]);
put("2026-12-04", "B", "crunch", 1, "First pass: LDA", ["lda"]);
put("2026-12-05", "B", "exam", 0, "DEGREE EXAM 2");

// Phase C: Dec 6 - Jan 10
put("2026-12-06", "C", "mock", 4.5, "FULL MOCK 2");
put("2026-12-07", "C", "study", 3, "SVM + LDA problems", ["svm", "lda"]);
put("2026-12-08", "C", "study", 3, "Bayes net conditional independence", ["bncond"]);
put("2026-12-09", "C", "study", 3, "Variable elimination", ["ve"]);
put("2026-12-10", "C", "light", 1, "Light revision (TA day)", ["bncond", "ve"]);
put("2026-12-11", "C", "study", 3, "Sampling inference + AI PYQs", ["sampling", "bncond", "ve"]);
put("2026-12-12", "C", "study", 4.5, "File organization + indexing", ["index"]);
put("2026-12-13", "C", "mock", 4.5, "FULL MOCK 3");
put("2026-12-14", "C", "study", 3, "B/B+ numericals + DBMS PYQs", ["index", "sql", "fd"]);
put("2026-12-15", "C", "study", 3, "Data transformation", ["transform"]);
put("2026-12-16", "C", "study", 3, "Warehouse modelling", ["dw"]);
put("2026-12-17", "C", "light", 1, "Light revision (TA day)", ["index", "transform", "dw"]);
put("2026-12-18", "C", "study", 3, "ML PYQs", sub("ml"));
put("2026-12-19", "C", "study", 4.5, "Stats + Linear Algebra PYQs", [...sub("ps"), ...sub("la")]);
put("2026-12-20", "C", "mock", 4.5, "FULL MOCK 4");
put("2026-12-21", "C", "study", 3, "Weak spots from mocks", SHAKY_IDS);
put("2026-12-22", "C", "study", 3, "DSA PYQs", sub("dsa"));
put("2026-12-23", "C", "study", 3, "Calculus + Python PYQs", [...sub("calc"), "python"]);
put("2026-12-24", "C", "light", 1, "Light revision (TA day)", ["svm", "lda", "bncond"]);
put("2026-12-25", "C", "study", 3, "Weak spots", SHAKY_IDS);
put("2026-12-26", "C", "study", 4.5, "Mixed PYQs", ALL_TECH);
put("2026-12-27", "C", "mock", 4.5, "FULL MOCK 5");
for (const d of ["2026-12-28", "2026-12-29", "2026-12-30"]) put(d, "C", "buffer", 3, "BUFFER: viva slippage + weak spots", SHAKY_IDS);
put("2026-12-31", "C", "light", 1, "Light revision (TA day)", ["htest", "svm"]);

const CRUNCH_ROT: [string, string[]][] = [
  ["Prob & Stat PYQs", sub("ps")],
  ["ML PYQs", sub("ml")],
  ["DSA PYQs", sub("dsa")],
  ["Linear Algebra PYQs", sub("la")],
  ["AI PYQs", sub("ai")],
  ["DBMS PYQs", sub("dbms")],
  ["Mistake log review", SHAKY_IDS],
  ["ML PYQs", sub("ml")],
  ["Calculus + Python PYQs", [...sub("calc"), "python"]],
];
for (let i = 0; i < 9; i++) {
  const d = addDays("2027-01-01", i);
  if (d === "2027-01-03") put(d, "C", "mock", 1, "1-hr sectional mock");
  else if (weekday(d) === 4) put(d, "C", "light", 1, "Light revision (TA day)", SHAKY_IDS);
  else put(d, "C", "crunch", 1, CRUNCH_ROT[i][0], CRUNCH_ROT[i][1]);
}
put("2027-01-10", "C", "exam", 0, "DEGREE EXAM 3");

// Phase D: Jan 11 - GATE day (Feb 7)
put("2027-01-11", "D", "study", 3, "Prob/Stat PYQs", sub("ps"));
put("2027-01-12", "D", "study", 3, "Linear Algebra PYQs", sub("la"));
put("2027-01-13", "D", "study", 3, "Calculus + Python", [...sub("calc"), "python"]);
put("2027-01-14", "D", "light", 1, "Light revision (TA day)", SHAKY_IDS);
put("2027-01-15", "D", "study", 3, "DSA PYQs", sub("dsa"));
put("2027-01-16", "D", "study", 4.5, "DBMS PYQs", sub("dbms"));
put("2027-01-17", "D", "mock", 4.5, "FULL MOCK 6");
put("2027-01-18", "D", "study", 3, "ML PYQs: regression & classification", ["linreg", "ridge", "logreg", "knn", "nb", "lda"]);
put("2027-01-19", "D", "study", 3, "ML PYQs: SVM, trees, neural nets", ["svm", "dt", "biasvar", "cv", "mlp"]);
put("2027-01-20", "D", "study", 3, "ML PYQs: clustering & PCA", ["kmeans", "hier", "pca"]);
put("2027-01-21", "D", "light", 1, "Light revision (TA day)", SHAKY_IDS);
put("2027-01-22", "D", "study", 3, "AI PYQs", sub("ai"));
put("2027-01-23", "D", "study", 4.5, "Weak-spot day (include GA mistakes)", [...SHAKY_IDS, ...sub("ga")]);
put("2027-01-24", "D", "mock", 4.5, "FULL MOCK 7");
for (let i = 0; i < 6; i++) {
  const d = addDays("2027-01-25", i);
  if (weekday(d) === 4) put(d, "D", "light", 1, "Light revision (TA day)", SHAKY_IDS);
  else put(d, "D", "study", 3, i === 5 ? "Formula sheet + weak spots" : "Weak-spot cleanup from mistake log", ALL_TECH);
}
put("2027-01-31", "D", "mock", 4.5, "FULL MOCK 8");
put("2027-02-01", "D", "study", 3, "Review FULL MOCK 8 + fix weak spots", ALL_TECH);
put("2027-02-02", "D", "study", 3, "Formula sheet + last weak spots", ALL_TECH);
put("2027-02-03", "D", "mock", 1, "1-hr sectional mock");
put("2027-02-04", "D", "light", 1, "Light revision (TA day)", SHAKY_IDS);
put("2027-02-05", "D", "taper", 1, "TAPER: formula sheet + mistake log");
put("2027-02-06", "D", "taper", 1, "TAPER: formula sheet + mistake log");
put(GATE_DATE, "D", "exam", 0, "GATE 2027: DA paper");

export const DAYS: Day[] = [...days.values()].sort((a, b) => a.date.localeCompare(b.date));

export const PHASE_NAMES: Record<string, string> = {
  A: "Phase A: Degree exam 1 (first pass, 1 hr/day)",
  B: "Phase B: Shaky topics + stats (degree exam 2 on Dec 5)",
  C: "Phase C: No-idea topics + PYQs (degree exam 3 on Jan 10)",
  D: "Phase D: GATE only",
};


export const milestonesFor = (gateDate: string = GATE_DATE): Milestone[] => [
  { id: "q1", name: "Quiz 1", short: "Quiz 1", date: "2026-11-15", note: "One hour a day of GATE until then" },
  { id: "q2", name: "Quiz 2", short: "Quiz 2", date: "2026-12-05", note: "Shaky topics, then stats and SVM" },
  { id: "et", name: "End Term", short: "End Term", date: "2027-01-10", note: "Your no-idea topics, then past papers" },
  { id: "gate", name: "GATE", short: "GATE", date: gateDate, note: "Date unconfirmed. Edit it once the DA slot is published" },
];


export const GATE_PLAN: PlanData = { name: "GATE DA 2027 plan", days: DAYS, phaseNames: PHASE_NAMES, milestones: milestonesFor() };
