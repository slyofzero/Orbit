"use client";
// The Topics tab (v1's Practice home): "next on your plan" topics, a search box, status tabs (your own rating
// of each topic) and the Filter pop-up, then the subjects as sections that open to their topics. Each topic
// row is its own progress bar (green: answered right, red: answered wrong). Rules: lib/practice.ts; data:
// the `practice.topics` query. Opening a topic goes to its practice screen (PracticeSession.tsx).

import { useMemo, useState } from "react";
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

/** The practice screen of a topic (components/practice/PracticeSession.tsx). */
const sessionHref = (topicId: string) => `/practice/session?topic=${encodeURIComponent(topicId)}`;

export function TopicsTab() {
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
        <section className="flex flex-wrap items-center gap-x-5 gap-y-3 rounded-lg border border-line glass-card px-[22px] py-4">
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
              <Button key={t.id} variant="primary" href={sessionHref(t.id)}>
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
        <Legend />
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
                  // v1's topic grid: one column on phones, two, then three side by side
                  bodyClassName="grid gap-x-2 gap-y-0.5 px-2 pt-0.5 pb-2.5 min-[640px]:grid-cols-2 min-[1000px]:grid-cols-3"
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
                        href={sessionHref(t.id)}
                      />
                    );
                  })}
                </Disclosure>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** What the dots (your rating of a topic) and the row fill (right / wrong answers) mean. */
function Legend() {
  const ratings: TopicRating[] = ["no_idea", "shaky", "know"];
  return (
    <div className="ml-auto flex flex-wrap items-center gap-x-3.5 gap-y-1.5" aria-label="Legend">
      {ratings.map((r) => (
        <span key={r} className="inline-flex items-center gap-1.5">
          <StatusDot tone={TONE[r]} label={STATUS_LABEL[r]} />
          <Text as="span" variant="small">
            {STATUS_LABEL[r]}
          </Text>
        </span>
      ))}
      <span className="inline-flex items-center gap-1.5">
        <span aria-hidden="true" className="h-2.5 w-4 rounded-[3px] bg-green/30" />
        <Text as="span" variant="small">
          Right
        </Text>
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span aria-hidden="true" className="h-2.5 w-4 rounded-[3px] bg-red/30" />
        <Text as="span" variant="small">
          Wrong
        </Text>
      </span>
    </div>
  );
}
