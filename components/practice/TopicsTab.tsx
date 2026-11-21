"use client";
// The Topics tab (v1's Practice home): "next on your plan" topics, a search box, status tabs (your own rating
// of each topic) and the Filter pop-up, then the subjects as sections that open to their topics. Each topic
// row is its own progress bar (green: answered right, red: answered wrong). Rules: lib/practice.ts; data:
// the `practice.topics` query. Opening a topic (the practice screen) isn't built yet, so it says so (useSoon).

import { useMemo, useState } from "react";
import { useSoon } from "@/components/dashboard/kit";
import {
  Button,
  Disclosure,
  EmptyState,
  FilterMenu,
  ProgressRow,
  SearchField,
  StatusDot,
  Tabs,
  Text,
  type StatusTone,
} from "@/components/ui";
import { useQuery } from "@/lib/db/client";
import { formatShort, todayIST } from "@/lib/dates";
import {
  STATUS_FILTERS,
  STATUS_LABEL,
  countMatching,
  filterGroups,
  groupBySubject,
  isSubjectOpen,
  makeMatcher,
  ratingOf,
  topicBar,
  topicBarHint,
  topicMatches,
  type StatusFilter,
} from "@/lib/practice";
import type { TopicRating } from "@/types/tables";

const TONE: Record<TopicRating, StatusTone> = { no_idea: "red", shaky: "amber", know: "green" };
const STATUS_TAB_LABEL: Record<StatusFilter, string> = { all: "All", ...STATUS_LABEL };
/** "Probability (and statistics)" → "Probability": the short name for a button. */
const shortName = (name: string) => name.split("(")[0].trim() || name;

export function TopicsTab() {
  const soon = useSoon();
  const today = useMemo(() => todayIST(), []);
  const { data } = useQuery("practice.topics", { today });
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [picked, setPicked] = useState<string[]>([]);
  const [chosen, setChosen] = useState<Record<string, boolean> | null>(null); // the reader's own open / shut choices

  const groups = useMemo(() => groupBySubject(data?.topics ?? []), [data]);
  const matches = useMemo(() => makeMatcher(picked), [picked]);
  const filters = useMemo(
    () =>
      data
        ? filterGroups(data.facets, {
            subjects: groups.map((g) => ({ id: g.id, name: g.name })),
            topics: data.topics,
            tags: data.tags,
          })
        : [],
    [data, groups],
  );
  if (!data) return null;

  const filtering = picked.length > 0;
  const searching = search.trim().length > 0 || status !== "all" || filtering;
  // with a filter picked, a topic only counts if some of its questions pass it
  const shownTopics = (topics: typeof data.topics) =>
    topics.filter(
      (t) => topicMatches(t, status, search) && (!filtering || countMatching(data.facets, matches, t.id) > 0),
    );
  const anyShown = groups.some((g) => shownTopics(g.topics).length > 0);

  const planSubject = data.next?.topics[0]?.subject_id ?? null;
  const isOpen = (id: string) =>
    isSubjectOpen({
      subjectId: id,
      searching,
      chosen,
      planSubjectId: planSubject,
      firstSubjectId: groups[0]?.id ?? null,
    });
  const toggle = (id: string) =>
    setChosen((c) => ({ ...(c ?? Object.fromEntries(groups.map((g) => [g.id, isOpen(g.id)]))), [id]: !isOpen(id) }));

  return (
    <div className="grid gap-5">
      {data.next && (
        <section className="flex flex-wrap items-center gap-x-5 gap-y-3 rounded-lg border border-line bg-sheet px-[22px] py-4">
          <div className="grid min-w-[200px] flex-1 gap-0.5">
            <Text as="span" className="font-bold">
              {data.next.on_date === today ? "On today's plan" : `Next on your plan, ${formatShort(data.next.on_date)}`}
            </Text>
            {data.next.title && (
              <Text as="span" variant="small">
                {data.next.title}
              </Text>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {data.next.topics.slice(0, 3).map((t) => (
              <Button key={t.id} variant="primary" onClick={soon(`Practising ${shortName(t.name)}`)}>
                {shortName(t.name)}
              </Button>
            ))}
          </div>
        </section>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <SearchField label="Find a topic" value={search} onChange={setSearch} placeholder="Find a topic" />
        <Tabs
          label="Topic rating"
          value={status}
          onChange={setStatus}
          tabs={STATUS_FILTERS.map((s) => ({ value: s, label: STATUS_TAB_LABEL[s] }))}
        />
        <FilterMenu groups={filters} picked={picked} onChange={setPicked} />
      </div>

      {!anyShown ? (
        <EmptyState icon="🔎" title="No topic matches">
          {filtering ? "No topic has questions that match this filter." : "Clear the search or pick another rating."}
        </EmptyState>
      ) : (
        <div className="grid gap-3">
          {groups.map((g, gi) => {
            const rows = shownTopics(g.topics);
            if (!rows.length) return null;
            const started = g.topics.filter((t) => t.tried > 0).length;
            return (
              // each subject pops in a beat after the one above it
              <div
                key={g.id}
                className="animate-card-in [animation-fill-mode:both]"
                style={{ animationDelay: `${gi * 70}ms` }}
              >
                <Disclosure
                  open={isOpen(g.id)}
                  onOpenChange={() => toggle(g.id)}
                  bodyClassName="grid gap-0.5 px-2 pt-0.5 pb-2.5"
                  title={
                    <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="font-display text-[1.05rem]">{g.name}</span>
                      <Text as="span" variant="small">
                        {`${started}/${g.topics.length} started`}
                      </Text>
                      <span className="ml-auto flex flex-wrap gap-1" aria-hidden="true">
                        {g.topics.map((t) => (
                          <StatusDot
                            key={t.id}
                            tone={TONE[ratingOf(t.rating)]}
                            label={STATUS_LABEL[ratingOf(t.rating)]}
                          />
                        ))}
                      </span>
                    </span>
                  }
                >
                  {rows.map((t) => {
                    const bar = filtering ? { good: 0, bad: 0 } : topicBar(t);
                    const r = ratingOf(t.rating);
                    return (
                      <ProgressRow
                        key={t.id}
                        lead={<StatusDot tone={TONE[r]} label={STATUS_LABEL[r]} />}
                        title={t.name}
                        end={
                          filtering
                            ? `${countMatching(data.facets, matches, t.id)} matching q`
                            : t.tried > 0
                              ? `**${t.tried}** / ${t.total} q`
                              : `${t.total} q`
                        }
                        good={bar.good}
                        bad={bar.bad}
                        hint={t.tried > 0 && !filtering ? topicBarHint(t) : undefined}
                        onClick={soon(`Practising ${shortName(t.name)}`)}
                      />
                    );
                  })}
                </Disclosure>
              </div>
            );
          })}
        </div>
      )}

      <Text variant="hint">
        The dot is your own rating of the topic: red is new to you, amber is shaky, green is solid. A row fills green
        for questions you got right and red for ones you got wrong.
      </Text>
    </div>
  );
}
