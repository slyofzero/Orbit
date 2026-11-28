// check.ts section: milestones and settings. Run: bun run check
import { QUERIES, type QueryDef } from "@/lib/db/queries";
import { transaction } from "@/lib/db/sql";
import { checkMilestone, readOriginals, type MilestoneData } from "@/lib/milestones";
import { LIMITS } from "@/lib/planFile";
import { examplePlan } from "@/lib/prompts/planPrompt";
import { NAME_MAX, checkSetting, readSettings } from "@/lib/settings";
import { ok, freshDb, bunSql } from "@/scripts/checks/helpers";

console.log("milestones and settings (lib/milestones.ts, lib/settings.ts)");

{
  const good = checkMilestone({ name: "  Mid\nterm ", date: "2026-12-01", note: "  " });
  ok(
    good.milestone?.name === "Mid term" && good.milestone.note === null && good.milestone.on_date === "2026-12-01",
    "checkMilestone: trims, folds line breaks, empty note = null",
  );
  ok(checkMilestone({ name: "", date: null, note: "" }).errors.length === 2, "checkMilestone: needs a name and a date");
  ok(
    checkMilestone({ name: "x", date: "2026-02-30", note: "" }).milestone === null,
    "checkMilestone: refuses a date that doesn't exist",
  );
  ok(
    checkMilestone({ name: "x".repeat(LIMITS.milestoneName + 1), date: "2026-12-01", note: "" }).milestone === null &&
      checkMilestone({ name: "x", date: "2026-12-01", note: "n".repeat(LIMITS.milestoneNote + 1) }).milestone === null,
    "checkMilestone: the plan file's length limits",
  );
  ok(readOriginals(null) === null && readOriginals("x") === null, "readOriginals: nothing kept = null");
  const r = readOriginals([
    { name: "Exam", date: "2026-12-10", short: "", note: "n" },
    { name: "", date: "2026-12-11" },
    { name: "Bad", date: "soon" },
    7,
  ]);
  ok(
    r?.length === 1 && r[0].short === null && r[0].note === "n",
    "readOriginals: keeps well-formed ones, skips the rest",
  );

  ok(checkSetting("name", "  Asha   K ").value === "Asha K", "checkSetting: a name is tidied");
  ok(checkSetting("name", "x".repeat(NAME_MAX + 1)).value === null, "checkSetting: a name has a length limit");
  ok(checkSetting("colour", "red").value === null, "checkSetting: unknown keys are refused");
  ok(checkSetting("setup_skipped", "1").value === "1", 'checkSetting: setup_skipped takes "1"');
  ok(checkSetting("setup_skipped", "yes").value === null, "checkSetting: setup_skipped refuses anything else");
  ok(
    readSettings([{ key: "junk", value: "1" }]).name === "" && readSettings([{ key: "name", value: "A" }]).name === "A",
    "readSettings: defaults fill in, unknown keys are ignored",
  );
}

console.log("milestones and settings: queries");
{
  const d = freshDb();
  const s = bunSql(d);
  const run = <R>(name: keyof typeof QUERIES, params?: unknown) =>
    transaction(s, () => (QUERIES[name] as unknown as QueryDef<unknown, R>).run(s, params));
  const n = (q: string) => (d.query(q).get() as { n: number }).n;
  type Res = { ok: boolean; errors?: string[] };
  const list = () => run<MilestoneData[]>("dashboard.milestones");

  ok(!run<Res>("milestone.add", { form: { name: "A", date: "2026-12-01", note: "" } }).ok, "add: no plan, refused");

  // a plan from a file keeps its own milestones
  const imp = run<{ ok: boolean; milestones: number }>("plan.import", {
    text: JSON.stringify(examplePlan("2026-11-20")),
  });
  const fileCount = imp.milestones;
  ok(
    imp.ok && fileCount > 0 && n("SELECT json_array_length(original_milestones) AS n FROM plans") === fileCount,
    "plan.import keeps the file's milestones in plans.original_milestones",
  );

  const added = run<Res & { id: number }>("milestone.add", { form: { name: "Viva", date: "2030-01-05", note: "Lab" } });
  ok(added.ok && list().some((m) => m.id === added.id && m.name === "Viva"), "milestone.add saves to the active plan");
  ok(
    !run<Res>("milestone.add", { form: { name: "", date: "2030-01-05", note: "" } }).ok &&
      list().length === fileCount + 1,
    "milestone.add: a bad form saves nothing",
  );
  run("milestone.undo", { drop: added.id, rows: [] });
  ok(list().length === fileCount, "Undo of add removes it");

  const first = list()[0];
  d.exec(`UPDATE milestones SET short = 'S' WHERE id = ${first.id}`);
  const ed = run<Res & { before: MilestoneData }>("milestone.edit", {
    id: first.id,
    form: { name: first.name, date: "2031-03-03", note: "moved" },
  });
  const after = list().find((m) => m.id === first.id)!;
  ok(ed.ok && after.on_date === "2031-03-03" && after.short === "S", "milestone.edit: same name keeps the short label");
  run("milestone.edit", { id: first.id, form: { name: "Renamed", date: "2031-03-03", note: "" } });
  ok(list().find((m) => m.id === first.id)!.short === null, "milestone.edit: a new name drops the short label");
  run("milestone.undo", { rows: [ed.before] });
  const undone = list().find((m) => m.id === first.id)!;
  ok(
    undone.name === first.name && undone.on_date === first.on_date && undone.note === first.note,
    "Undo of edit puts the old values back",
  );

  const gone = run<MilestoneData | null>("milestone.remove", { id: first.id });
  ok(gone?.id === first.id && !list().some((m) => m.id === first.id), "milestone.remove returns what it removed");
  ok(run<MilestoneData | null>("milestone.remove", { id: 999_999 }) === null, "milestone.remove: unknown id = null");
  run("milestone.undo", { rows: [gone] });
  ok(
    list().some((m) => m.id === first.id && m.short === "S"),
    "Undo of remove puts it back with the same id",
  );
  ok(
    !run<Res>("milestone.undo", { rows: [{ ...gone!, on_date: "nope" }] }).ok,
    "milestone.undo checks the rows it puts back",
  );

  // reset to the plan file's own, and its Undo
  run("milestone.remove", { id: first.id });
  run("milestone.add", { form: { name: "Extra", date: "2030-02-02", note: "" } });
  const before = list();
  const rs = run<Res & { before: MilestoneData[]; count: number }>("milestone.reset");
  ok(
    rs.ok &&
      rs.count === fileCount &&
      list().length === fileCount &&
      !list().some((m) => m.name === "Extra") &&
      rs.before.length === before.length,
    "milestone.reset: back to the file's milestones",
  );
  run("milestone.restoreAll", { rows: rs.before });
  ok(JSON.stringify(list()) === JSON.stringify(before), "Undo of reset restores the list exactly");
  d.exec("UPDATE plans SET original_milestones = NULL");
  ok(
    !run<Res>("milestone.reset").ok && list().length === before.length,
    "milestone.reset: a plan with none kept refuses and changes nothing",
  );

  // settings
  ok(run<{ name: string }>("settings.all").name === "", "settings.all: defaults before anything is saved");
  ok(run<Res & { value: string }>("settings.set", { key: "name", value: " Asha " }).ok, "settings.set saves");
  ok(run<{ name: string }>("settings.all").name === "Asha", "settings.all reads it back");
  ok(!run<Res>("settings.set", { key: "theme", value: "x" }).ok, "settings.set refuses unknown keys");
  run("settings.set", { key: "name", value: "  " });
  ok(n("SELECT count(*) AS n FROM settings") === 0, "settings.set: empty = the row is removed (default)");
}
