// check.ts section: importFix. Run: bun run check
import {
  EXAMPLE_PLAN,
  EXAMPLE_QUESTIONS,
  FILE_SCHEMA,
  fixInstructions,
  IMPORT_KIND,
  type ImportKind,
} from "@/lib/importFix";
import { planPrompt } from "@/lib/prompts/planPrompt";
import { questionsPrompt } from "@/lib/prompts/questionsPrompt";
import { parsePlanFile } from "@/lib/planFile";
import { parseQuestionFile } from "@/lib/questionFile";
import { parseBackup } from "@/lib/backup";
import { ok } from "@/scripts/checks/helpers";

console.log("import fix instructions (lib/importFix.ts)");
{
  const refused = {
    plan: parsePlanFile('{"format":"orbit-plan","days":[]}').errors,
    questions: parseQuestionFile('{"format":"orbit-questions","questions":[{"type":"mcq"}]}').errors,
    backup: parseBackup("not json").errors,
  } satisfies Record<ImportKind, string[]>;
  for (const kind of Object.keys(refused) as ImportKind[]) {
    const text = fixInstructions(kind, refused[kind]);
    ok(refused[kind].length > 0, `${kind}: a bad file gives errors`);
    ok(
      refused[kind].every((e) => text.includes(e)),
      `${kind}: every error is in the copied text`,
    );
    ok(text.includes(IMPORT_KIND[kind].format), `${kind}: the copied text names the format`);
    ok(text.includes("How to fix it:"), `${kind}: the copied text says how to fix it`);
  }
  ok(fixInstructions("plan", ["x"]).includes("ONLY the corrected JSON"), "plan / question fixes ask for only the JSON");

  // the schema and the example are in the copied text, and the examples really import
  for (const kind of ["plan", "questions", "backup"] as const) {
    const text = fixInstructions(kind, ["x"]);
    ok(text.includes("Schema of the") && text.includes("// "), `${kind}: the copied text has a schema with notes`);
  }
  ok(
    fixInstructions("plan", ["x"]).includes("R = required, O = optional") &&
      fixInstructions("questions", ["x"]).includes("R for mcq / msq"),
    "the schema marks required and optional fields",
  );
  const plan = parsePlanFile(JSON.stringify(EXAMPLE_PLAN));
  ok(plan.plan !== null && plan.errors.length === 0, "the plan example is accepted by the plan importer");
  const pack = parseQuestionFile(JSON.stringify(EXAMPLE_QUESTIONS));
  ok(
    pack.file !== null && pack.errors.length === 0 && pack.file.questions.length === 4 && pack.file.mocks.length === 1,
    "the question example is accepted by the question importer (4 questions, 1 mock)",
  );
  ok(
    planPrompt("2026-11-21").includes(FILE_SCHEMA.plan) &&
      (["topics", "programming", "mocks"] as const).every((t) => questionsPrompt(t).includes(FILE_SCHEMA.questions)),
    "every AI prompt carries the same typed schema as the fix text",
  );
  ok(
    fixInstructions("plan", ["x"]).includes(JSON.stringify(EXAMPLE_PLAN, null, 2)) &&
      fixInstructions("questions", ["x"]).includes(JSON.stringify(EXAMPLE_QUESTIONS, null, 2)),
    "the example is in the copied text",
  );
}
