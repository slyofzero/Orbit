// A prompt for any AI chat that explains how to get through one plan day. Pure function, tested by scripts/check.ts.
import type { PackData } from "./packs";
import type { Day } from "./types";
import { fmtLong, KIND_LABEL } from "./plan";
import { difficultyOf } from "./questionFilter";
import { liveQuestionIds, type DayLink } from "./links";
import { examPace } from "./statsMore";

const clip = (s: string, n: number) => { const t = s.replace(/!\[[^\]\n]*\]\([^)\s]+\)/g, "[picture]").replace(/```[\s\S]*?```/g, "[code]").replace(/\s+/g, " ").trim(); return t.length > n ? `${t.slice(0, n - 1)}…` : t; };
const MAX_LISTED = 25;

export function dayHelpPrompt(day: Day, pack: PackData, link?: DayLink, planName = "", milestones: { name: string; date: string }[] = [], description = ""): string {
  const topics = day.topics.map((id) => pack.topics.find((t) => t.id === id)).filter((t): t is NonNullable<typeof t> => !!t);
  const ids = liveQuestionIds(link, pack).ids;
  const byId = new Map(pack.questions.map((q) => [q.id, q]));
  const qs = ids.slice(0, MAX_LISTED).map((id) => byId.get(id)!).filter(Boolean);
  const mock = link?.mock ? pack.mockTests.find((m) => m.id === link.mock) : undefined;
  const pace = examPace(pack);
  const ahead = milestones.filter((m) => m.date >= day.date).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 4);
  const subjects = Object.values(pack.subjects);
  const feel = (s: string) => (s === "noidea" ? "no idea" : s);

  return `I am following a study plan${planName ? ` called "${planName}"` : ""} and I want help getting through ONE day of it.${subjects.length ? ` My question bank covers: ${subjects.join(", ")}.` : ""}${ahead.length ? `\nUpcoming milestones: ${ahead.map((m) => `${m.name} (${m.date})`).join("; ")}.` : ""}
${description ? `\nABOUT MY PLAN (in my own words): ${description}\n` : ""}
TODAY: ${fmtLong(day.date)} (${day.date}). Day type: ${KIND_LABEL[day.kind] ?? day.kind}. Time available: ${day.hours} hour${day.hours === 1 ? "" : "s"}.
Plan for the day: ${day.title}

TASKS
${day.tasks.map((t, i) => `${i + 1}. ${t}`).join("\n") || "(none)"}
${topics.length ? `\nTOPICS (how well I feel I know each)\n${topics.map((t) => `- ${t.name} (${pack.subjects[t.subject] ?? t.subject}): I feel ${feel(t.status)}`).join("\n")}\n` : ""}${day.targetQs > 0 ? `\nPRACTICE TARGET: ${day.targetQs} questions today.\n` : ""}${qs.length ? `\nPRACTICE QUESTIONS PLANNED FOR TODAY (${ids.length}${ids.length > qs.length ? `, first ${qs.length} shown` : ""})${link?.note ? `. Note: ${link.note}` : ""}\n${qs.map((q) => `- ${q.type.toUpperCase()}, ${q.marks} mark${q.marks > 1 ? "s" : ""}, ${difficultyOf(q) ?? "no difficulty"}: ${clip(q.text, 140)}`).join("\n")}\n` : ""}${mock ? `\nMOCK TEST PLANNED: ${mock.name} (${mock.minutes} minutes).\n` : ""}
WHAT I NEED FROM YOU
1. A time-boxed schedule that fits ${day.hours} hour${day.hours === 1 ? "" : "s"}, with a short break plan.
2. For each task: exactly how to do it. The concepts I must know, the key formulas or steps, and one worked example.
3. The mistakes students commonly make on these topics, and how to avoid them.
${qs.length ? `4. How to attack the practice questions above: the order to try them in, and a time limit per question${pace ? ` (my mock tests allow about ${pace} seconds per mark)` : ""}. Give hints first. Do NOT give final answers unless I ask.\n` : "4. A few practice problems on these topics at the level of my question bank, easiest first. Do NOT give final answers unless I ask.\n"}5. A 5-question quick self-test for the end of the day, and how I can tell that I am done.

Keep it concrete and practical. If you need something from me before you start, ask first.
`;
}
