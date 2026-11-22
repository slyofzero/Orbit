// Milestones on the dashboard: add, edit, remove, reset to the plan file's own, and the Undo of each
// (docs/PLANS.md §5d). Every write returns what it replaced, so the screen's Undo can put it back.
// Named queries (docs/STORAGE.md §2); how to write one: lib/db/queries/index.ts.

import { write } from "@/lib/db/queries/core";
import type { Sql } from "@/lib/db/sql";
import { decode } from "@/lib/db/codec";
import { LIMITS } from "@/lib/planFile";
import { checkMilestone, readOriginals, type MilestoneData, type MilestoneForm } from "@/lib/milestones";
import type { PlanRow } from "@/types/tables";

const activePlanId = (sql: Sql) => sql.get<{ id: string }>("SELECT id FROM plans WHERE is_active = 1")?.id ?? null;

const listOf = (sql: Sql, planId: string) =>
  sql.all<MilestoneData>(
    `SELECT id, name, short, on_date, note FROM milestones WHERE plan_id = ? ORDER BY on_date, id LIMIT ${LIMITS.milestones}`,
    [planId],
  );
const one = (sql: Sql, planId: string, id: number) =>
  sql.get<MilestoneData>("SELECT id, name, short, on_date, note FROM milestones WHERE plan_id = ? AND id = ?", [
    planId,
    id,
  ]) ?? null;

const NO_PLAN = { ok: false as const, errors: ["There is no plan yet, so there is nowhere to keep milestones."] };

/** Checks rows an Undo hands back; nothing is written unless every one passes. */
function checkRows(rows: readonly MilestoneData[]): string[] {
  if (rows.length > LIMITS.milestones) return [`A plan can have at most ${LIMITS.milestones} milestones.`];
  return rows.flatMap((r) => [
    ...(Number.isInteger(r.id) ? [] : ["A milestone to put back has no id."]),
    ...checkMilestone({ name: r.name, date: r.on_date, note: r.note ?? "" }).errors,
  ]);
}

/** Puts checked rows back exactly as they were (same ids). */
function putRows(sql: Sql, planId: string, rows: readonly MilestoneData[]) {
  for (const r of rows) {
    const c = checkMilestone({ name: r.name, date: r.on_date, note: r.note ?? "" });
    if (!c.milestone) continue; // checkRows ran first
    sql.run(
      `INSERT INTO milestones (id, plan_id, name, short, on_date, note) VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT (id) DO UPDATE SET plan_id = excluded.plan_id, name = excluded.name, short = excluded.short,
         on_date = excluded.on_date, note = excluded.note`,
      [r.id, planId, c.milestone.name, r.short, c.milestone.on_date, c.milestone.note],
    );
  }
}

export const milestoneQueries = {
  /** Adds a milestone to the active plan. Returns its id (Undo removes it). */
  "milestone.add": write(["milestones"], (sql, p: { form: MilestoneForm }) => {
    const planId = activePlanId(sql);
    if (!planId) return NO_PLAN;
    const c = checkMilestone(p.form);
    if (!c.milestone) return { ok: false as const, errors: c.errors };
    if (listOf(sql, planId).length >= LIMITS.milestones)
      return { ok: false as const, errors: [`A plan can have at most ${LIMITS.milestones} milestones.`] };
    const id = sql.get<{ id: number }>(
      "INSERT INTO milestones (plan_id, name, short, on_date, note) VALUES (?, ?, NULL, ?, ?) RETURNING id",
      [planId, c.milestone.name, c.milestone.on_date, c.milestone.note],
    )!.id;
    return { ok: true as const, id };
  }),

  /** Changes a milestone. Its short calendar label is kept while the name stays the same, and dropped (the
   *  calendar then uses the name) when the name changes. Returns the row as it was, for Undo. */
  "milestone.edit": write(["milestones"], (sql, p: { id: number; form: MilestoneForm }) => {
    const planId = activePlanId(sql);
    if (!planId) return NO_PLAN;
    const before = one(sql, planId, p.id);
    if (!before) return { ok: false as const, errors: ["That milestone is gone (removed in another tab?)."] };
    const c = checkMilestone(p.form);
    if (!c.milestone) return { ok: false as const, errors: c.errors };
    const short = c.milestone.name === before.name ? before.short : null;
    sql.run("UPDATE milestones SET name = ?, short = ?, on_date = ?, note = ? WHERE id = ?", [
      c.milestone.name,
      short,
      c.milestone.on_date,
      c.milestone.note,
      p.id,
    ]);
    return { ok: true as const, before };
  }),

  /** Removes a milestone. Returns the row as it was (Undo puts it back with the same id), or null. */
  "milestone.remove": write(["milestones"], (sql, p: { id: number }) => {
    const planId = activePlanId(sql);
    const before = planId ? one(sql, planId, p.id) : null;
    if (before) sql.run("DELETE FROM milestones WHERE id = ?", [p.id]);
    return before;
  }),

  /** Undo of add / edit / remove: removes `drop` (an added id) and puts `rows` back as they were. */
  "milestone.undo": write(["milestones"], (sql, p: { drop?: number; rows: MilestoneData[] }) => {
    const planId = activePlanId(sql);
    if (!planId) return NO_PLAN;
    const errors = checkRows(p.rows);
    if (errors.length) return { ok: false as const, errors };
    if (p.drop !== undefined) sql.run("DELETE FROM milestones WHERE plan_id = ? AND id = ?", [planId, p.drop]);
    putRows(sql, planId, p.rows);
    return { ok: true as const };
  }),

  /** Reset milestones: replaces the plan's milestones with the plan file's own. Returns the ones it replaced. */
  "milestone.reset": write(["milestones"], (sql) => {
    const planId = activePlanId(sql);
    if (!planId) return NO_PLAN;
    const raw = sql.get<{ original_milestones: string | null }>("SELECT original_milestones FROM plans WHERE id = ?", [
      planId,
    ])!;
    const originals = readOriginals(decode<PlanRow>("plans", raw).original_milestones);
    if (!originals)
      return {
        ok: false as const,
        errors: ["This plan was loaded before Orbit kept its milestones, so there is nothing to reset to."],
      };
    const before = listOf(sql, planId);
    sql.run("DELETE FROM milestones WHERE plan_id = ?", [planId]);
    for (const m of originals)
      sql.run("INSERT INTO milestones (plan_id, name, short, on_date, note) VALUES (?, ?, ?, ?, ?)", [
        planId,
        m.name,
        m.short,
        m.date,
        m.note,
      ]);
    return { ok: true as const, before, count: originals.length };
  }),

  /** Undo of reset: the plan's milestones become exactly `rows` again. */
  "milestone.restoreAll": write(["milestones"], (sql, p: { rows: MilestoneData[] }) => {
    const planId = activePlanId(sql);
    if (!planId) return NO_PLAN;
    const errors = checkRows(p.rows);
    if (errors.length) return { ok: false as const, errors };
    sql.run("DELETE FROM milestones WHERE plan_id = ?", [planId]);
    putRows(sql, planId, p.rows);
    return { ok: true as const };
  }),
};
