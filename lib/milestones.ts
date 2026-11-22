// Milestones the user adds or edits on the dashboard (docs/PLANS.md §5d): the form's checks, and reading the
// plan file's own milestones back from plans.original_milestones for "Reset milestones". The limits are the plan
// file's (lib/planFile.ts LIMITS), so a milestone typed here exports and imports back unchanged.

import { isIsoDate, type IsoDate } from "@/lib/dates";
import { LIMITS, type PlanFileMilestone } from "@/lib/planFile";

export interface MilestoneForm {
  name: string;
  date: IsoDate | null;
  note: string;
}
export interface MilestoneValues {
  name: string;
  on_date: IsoDate;
  note: string | null;
}
/** A milestone row as the dashboard and Undo pass it around. */
export interface MilestoneData extends MilestoneValues {
  id: number;
  short: string | null;
}

const oneLine = (s: string) => s.replace(/\s+/g, " ").trim();

/** Checks the dashboard's milestone form. Trims, folds line breaks; errors are plain English. */
export function checkMilestone(f: MilestoneForm): { milestone: MilestoneValues | null; errors: string[] } {
  const errors: string[] = [];
  const name = oneLine(f.name);
  const note = oneLine(f.note);
  if (!name) errors.push("Give the milestone a name.");
  else if (name.length > LIMITS.milestoneName)
    errors.push(`The name is ${name.length} characters; the most is ${LIMITS.milestoneName}.`);
  if (!f.date) errors.push("Pick a date.");
  else if (!isIsoDate(f.date)) errors.push("The date isn't a real date.");
  if (note.length > LIMITS.milestoneNote)
    errors.push(`The note is ${note.length} characters; the most is ${LIMITS.milestoneNote}.`);
  if (errors.length) return { milestone: null, errors };
  return { milestone: { name, on_date: f.date!, note: note || null }, errors };
}

/** plans.original_milestones (already decoded) → the plan file's milestones, skipping anything malformed.
 *  null = the plan kept none (made before this was stored). */
export function readOriginals(v: unknown): PlanFileMilestone[] | null {
  if (!Array.isArray(v)) return null;
  const out: PlanFileMilestone[] = [];
  for (const m of v.slice(0, LIMITS.milestones)) {
    if (!m || typeof m !== "object") continue;
    const o = m as Record<string, unknown>;
    if (typeof o.name !== "string" || !o.name.trim() || typeof o.date !== "string" || !isIsoDate(o.date)) continue;
    out.push({
      name: o.name,
      short: typeof o.short === "string" && o.short ? o.short : null,
      date: o.date,
      note: typeof o.note === "string" && o.note ? o.note : null,
    });
  }
  return out;
}
