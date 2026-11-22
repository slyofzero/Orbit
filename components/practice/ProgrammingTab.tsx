"use client";
// The Programming tab (v1's): every code question as a row with where you are with it (solved, tried, new),
// a search box, To do / Solved tabs and the Filter pop-up. Rules: lib/practice.ts; data: the
// `practice.programming` query. A row opens the question beside the editor (/practice/code?id=).

import { useMemo, useState } from "react";
import {
  ActionRow,
  EmptyState,
  FilterMenu,
  Pill,
  ProgressBar,
  SearchField,
  Tabs,
  type PillTone,
} from "@/components/ui";
import { useQuery } from "@/lib/db/client";
import {
  codeMatches,
  filterGroups,
  firstLine,
  makeMatcher,
  type CodeState,
  type CodeStatusFilter,
} from "@/lib/practice";
import type { Difficulty } from "@/types/tables";

const STATUS_TABS: { value: CodeStatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "todo", label: "To do" },
  { value: "solved", label: "Solved" },
];
const MARK: Record<CodeState, { big: string; small: string }> = {
  solved: { big: "✓", small: "solved" },
  tried: { big: "•", small: "tried" },
  todo: { big: "○", small: "new" },
};
const DIFFICULTY: Record<Difficulty, { label: string; tone: PillTone }> = {
  easy: { label: "Easy", tone: "green" },
  medium: { label: "Medium", tone: "amber" },
  hard: { label: "Hard", tone: "red" },
};

export function ProgrammingTab() {
  const { data } = useQuery("practice.programming");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<CodeStatusFilter>("all");
  const [picked, setPicked] = useState<string[]>([]);

  const facets = useMemo(
    () =>
      (data?.questions ?? []).map((q) => ({
        topic_id: q.topic_id,
        subject_id: q.subject_id,
        difficulty: q.difficulty,
        tags: q.tags,
        n: 1,
      })),
    [data],
  );
  const filters = useMemo(() => {
    if (!data) return [];
    const uniq = (items: { id: string; name: string }[]) => [...new Map(items.map((i) => [i.id, i])).values()];
    return filterGroups(facets, {
      subjects: uniq(data.questions.map((q) => ({ id: q.subject_id, name: q.subject_name }))),
      topics: uniq(data.questions.map((q) => ({ id: q.topic_id, name: q.topic_name }))),
      tags: data.tags,
    });
  }, [data, facets]);
  if (!data) return null;

  const tagName = new Map(data.tags.map((t) => [t.id, t.name]));
  const passes = makeMatcher(picked);
  const shown = data.questions.filter(
    (q, i) =>
      passes(facets[i]) && codeMatches({ ...q, tagNames: q.tags.map((t) => tagName.get(t) ?? "") }, status, search),
  );
  const solved = data.questions.filter((q) => q.state === "solved").length;

  return (
    <div className="grid gap-5">
      <div className="max-w-[420px]">
        <ProgressBar
          label={`${solved} of ${data.questions.length} solved`}
          value={solved}
          max={data.questions.length}
          tone="green"
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <SearchField label="Find a question" value={search} onChange={setSearch} placeholder="Find a question" />
        <Tabs label="Show" value={status} onChange={setStatus} tabs={STATUS_TABS} />
        <FilterMenu groups={filters} picked={picked} onChange={setPicked} />
      </div>

      {shown.length === 0 ? (
        <EmptyState icon="🔎" title="No question matches">
          Clear the search or pick another filter.
        </EmptyState>
      ) : (
        <div className="grid gap-1 rounded-lg border border-line bg-sheet p-2">
          {shown.map((q, i) => (
            // a short stagger, capped so a long list doesn't make the last rows wait
            <div
              key={q.id}
              className="animate-card-in [animation-fill-mode:both]"
              style={{ animationDelay: `${Math.min(i, 12) * 35}ms` }}
            >
              <ActionRow
                lead={MARK[q.state]}
                title={firstLine(q.stem)}
                sub={`${q.marks} mark${q.marks === 1 ? "" : "s"} · ${q.subject_name}: ${q.topic_name}`}
                end={<Pill tone={DIFFICULTY[q.difficulty].tone}>{DIFFICULTY[q.difficulty].label}</Pill>}
                href={`/practice/code?id=${encodeURIComponent(q.id)}`}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
