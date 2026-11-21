// The "how to fix this file" text that the import screens copy when a plan, question or progress file is
// refused (components/ui/ImportProblems.tsx). It names the errors Orbit found, then gives the file's schema
// (every field with its type, required or optional, and limits) and a small example that passes the importer
// (scripts/checks/importFix.ts proves it). It works pasted into any AI chat, or read by the user.
// The formats themselves are lib/planFile.ts, lib/questionFile.ts and lib/backup.ts: change them together
// (AGENTS.md rule 9).

import { BACKUP_FORMAT, BACKUP_VERSION } from "@/lib/backup";
import { DAY_KINDS, LIMITS as PLAN, PLAN_FORMAT, PLAN_VERSION, WEEKDAY_NAMES } from "@/lib/planFile";
import { DIFFICULTIES, LIMITS as Q, PACK_FORMAT, PACK_VERSION, POOLS, QUESTION_TYPES } from "@/lib/questionFile";

export type ImportKind = "plan" | "questions" | "backup";

export const IMPORT_KIND: Record<ImportKind, { noun: string; format: string }> = {
  plan: { noun: "plan file", format: PLAN_FORMAT },
  questions: { noun: "question file", format: PACK_FORMAT },
  backup: { noun: "progress (backup) file", format: BACKUP_FORMAT },
};

const COMMON = [
  "Send back ONLY the corrected JSON (one JSON object, nothing before or after it).",
  "Keep everything that was already correct; change only what the problems above point at.",
  "Every backslash in maths must be doubled in JSON (write \\\\frac, not \\frac).",
  'Dates are real calendar dates written YYYY-MM-DD. Numbers are JSON numbers (3.5), never text ("3.5").',
];

const list = (a: readonly string[]) => a.map((x) => `"${x}"`).join(" | ");

// R = required, O = optional. "text" = a JSON string, "number" = a JSON number, "list<T>" = a JSON array.
/** The typed schema of each file: also used by the AI prompts (lib/prompts/), so there is one description. */
export const FILE_SCHEMA: Record<ImportKind, string> = {
  plan: `R = required, O = optional
{
  "format": "${PLAN_FORMAT}",          // O (a warning if missing). text, exactly this
  "version": ${PLAN_VERSION},                       // O. number, must be ${PLAN_VERSION}
  "name": text,                        // R. up to ${PLAN.name} characters
  "description": text,                 // O. up to ${PLAN.description}
  "starts_on": "YYYY-MM-DD",           // O. default: the first day. a real date
  "ends_on": "YYYY-MM-DD",             // O. default: the last day. not before starts_on
  "milestones": [                      // O. list, at most ${PLAN.milestones}
    {
      "name": text,                    // R. up to ${PLAN.milestoneName}
      "date": "YYYY-MM-DD",            // R. a real date
      "short": text,                   // O. up to ${PLAN.milestoneShort}
      "note": text                     // O. up to ${PLAN.milestoneNote}
    }
  ],
  "days": [                            // R. list with at least 1 item (${PLAN.days} planned days at most)
    {
      "date": "YYYY-MM-DD",            // R*, one day. *Give EITHER "date" OR both "from" and "to"
      "from": "YYYY-MM-DD",            // R*, a range start
      "to": "YYYY-MM-DD",              // R*, a range end, not before "from"
      "weekdays": [text],              // O, only with from/to. each of: ${list(WEEKDAY_NAMES)}
      "title": text,                   // R. up to ${PLAN.title}
      "kind": text,                    // O. default "study". one of: ${list(DAY_KINDS)}
      "hours": number,                 // O. 0 to 24
      "tasks": [text],                 // O. at most ${PLAN.tasks} per day, each non-empty, up to ${PLAN.task}
      "note": text,                    // O. up to ${PLAN.note}
      "questions": [text]              // O. question ids, at most ${PLAN.questions} per day
    }
  ]
}
Every day must fall between "starts_on" and "ends_on". A single "date" beats a range.`,

  questions: `R = required, O = optional
{
  "format": "${PACK_FORMAT}",    // O (a warning if missing). text, exactly this
  "version": ${PACK_VERSION},                       // O. number, must be ${PACK_VERSION}
  "name": text,                        // R. up to ${Q.name} characters
  "questions": [                       // O*, at most ${Q.questions}. *The file needs "questions" and/or "mocks"
    {
      "id": text,                      // O. your own label; mocks refer to it. unique in the file
      "type": text,                    // R. one of: ${list(QUESTION_TYPES)}
      "subject": text,                 // R. up to ${Q.subject}
      "topic": text,                   // R. up to ${Q.topic}
      "text": text,                    // R. the question, up to ${Q.text}. markdown + LaTeX
      "difficulty": text,              // O. default "medium". one of: ${list(DIFFICULTIES)}
      "marks": number,                 // O. default 1. above 0, at most 100
      "negative_marks": number,        // O. default 0. 0 or more
      "pool": text,                    // O. default "practice". one of: ${list(POOLS)}
      "explanation": text,             // O. up to ${Q.explanation}
      "tags": [text],                  // O. at most ${Q.tags}, each up to ${Q.tag} characters
      // by "type":
      "options": [text],               // R for mcq / msq. ${Q.minOptions} to ${Q.maxOptions} items, each up to ${Q.option}
      "answer": ...,                   // R for mcq / msq / nat / str (not code):
                                       //   mcq: ONE letter, "B"   msq: list of letters, ["A", "C"]
                                       //   nat: a number, 3.5 (NOT text)   str: text or list of texts
      "tolerance": number,             // O, nat only. 0 or more. default 0 (exact)
      "match": text,                   // O, str only. default "exact". "exact" | "list" | "set"
      "case_sensitive": true | false,  // O, str only. default false
      "starter": text                  // O, code only. starter code, up to ${Q.starter}
    }
  ],
  "mocks": [                           // O*, at most ${Q.mocks}
    {
      "name": text,                    // R. up to ${Q.mockName}
      "minutes": number,               // R. whole number, 1 to ${Q.minutes}: the whole test's time limit
      "instructions": text,            // O. up to ${Q.instructions}
      "full_screen": true | false,     // O. default false
      "sections": [                    // R. 1 to ${Q.sections} sections
        {
          "name": text,                // R
          "minutes": number,           // O. whole number, at most the mock's minutes
          "questions": [text]          // R. at least 1 "id" from this file's "questions"; once per mock
        }
      ]
    }
  ]
}`,

  backup: `R = required (all of them). Orbit writes this file itself; never write or edit it by hand.
{
  "format": "${BACKUP_FORMAT}",     // text, exactly this
  "version": ${BACKUP_VERSION},                       // number, must be ${BACKUP_VERSION}
  "schema_version": number,            // the database version of the Orbit that saved it; must match this Orbit
  "exported_at": number,               // milliseconds since 1970 (a JSON number)
  "tables": {                          // object: table name -> list of rows
    "<table name>": [ { "<column>": text | number | null } ]
  }
}`,
};

// Small examples that pass the importer (the test runs them through the real parsers).
export const EXAMPLE_PLAN = {
  format: PLAN_FORMAT,
  version: PLAN_VERSION,
  name: "Linear algebra in two weeks",
  starts_on: "2026-12-01",
  ends_on: "2026-12-14",
  milestones: [{ name: "Final exam", short: "Final", date: "2026-12-14" }],
  days: [
    {
      from: "2026-12-01",
      to: "2026-12-12",
      weekdays: ["mon", "tue", "wed", "thu", "fri"],
      title: "Vectors and matrices",
      kind: "study",
      hours: 2,
      tasks: ["Read one section", "Solve 5 problems"],
    },
    { date: "2026-12-14", title: "Final exam", kind: "exam", hours: 3 },
  ],
};

export const EXAMPLE_QUESTIONS = {
  format: PACK_FORMAT,
  version: PACK_VERSION,
  name: "Linear algebra starter",
  questions: [
    {
      id: "la-1",
      type: "mcq",
      subject: "Linear Algebra",
      topic: "Eigenvalues",
      difficulty: "easy",
      text: "The eigenvalues of $\\begin{pmatrix}2&0\\\\0&3\\end{pmatrix}$ are:",
      options: ["2 and 3", "0 and 5", "1 and 6"],
      answer: "A",
      explanation: "A diagonal matrix has its diagonal entries as eigenvalues.",
    },
    {
      id: "la-2",
      type: "msq",
      subject: "Linear Algebra",
      topic: "Eigenvalues",
      text: "Select every true statement.",
      options: [
        "$\\det(A)$ is the product of the eigenvalues",
        "Every matrix is diagonalisable",
        "$\\mathrm{tr}(A)$ is their sum",
      ],
      answer: ["A", "C"],
    },
    {
      id: "la-3",
      type: "nat",
      subject: "Linear Algebra",
      topic: "Determinants",
      text: "Find $\\det\\begin{pmatrix}1&2\\\\3&4\\end{pmatrix}$.",
      answer: -2,
      tolerance: 0,
    },
    {
      id: "la-4",
      type: "str",
      subject: "Linear Algebra",
      topic: "Vectors",
      text: "What is the name of a vector of length 1?",
      answer: ["unit vector", "unit"],
      match: "list",
    },
  ],
  mocks: [
    {
      name: "Quick mock",
      minutes: 30,
      sections: [{ name: "Section A", minutes: 30, questions: ["la-1", "la-2", "la-3"] }],
    },
  ],
};

const EXAMPLE: Record<ImportKind, unknown> = { plan: EXAMPLE_PLAN, questions: EXAMPLE_QUESTIONS, backup: null };

/** The text behind the "Copy how to fix this" button. */
export function fixInstructions(kind: ImportKind, errors: string[]): string {
  const { noun } = IMPORT_KIND[kind];
  const lines: string[] = [`Orbit refused my ${noun}. Nothing was imported. Here is exactly what is wrong:`, ""];
  errors.forEach((e, i) => lines.push(`${i + 1}. ${e}`));
  lines.push("", "How to fix it:");
  if (kind === "backup") {
    lines.push(
      "- Don't edit a progress file by hand: use the file exactly as Orbit's \"Export progress\" saved it.",
      "- If it was changed, cut off or saved by a different version of Orbit, export a fresh one from the Orbit that holds your data.",
      "- A plan file or a question file doesn't belong here: import those from the New plan step and the Practice tabs.",
    );
  } else {
    COMMON.forEach((c) => lines.push(`- ${c}`));
  }
  lines.push(
    "",
    `Schema of the ${noun} (// comments explain each field; leave them out of the JSON):`,
    FILE_SCHEMA[kind],
  );
  const example = EXAMPLE[kind];
  if (example) lines.push("", "A small example that Orbit accepts:", JSON.stringify(example, null, 2));
  return lines.join("\n");
}
