"use client";
// /dev/db: try the database worker live. Open it in two tabs: one leads (holds the database),
// the other follows; a change in either shows up in both. Close the leader and the other tab
// takes over.

import { useState } from "react";
import {
  Button,
  Callout,
  Card,
  Dialog,
  Heading,
  Pill,
  Rich,
  Stat,
  Table,
  Text,
  type Column,
  type PillTone,
} from "@/components/ui";
import { useDbStatus, useMutation, useQuery, type DbRole } from "@/lib/db/client";

const ROLE: Record<DbRole, { tone: PillTone; label: string }> = {
  connecting: { tone: "amber", label: "Connecting…" },
  leader: { tone: "green", label: "Leader: this tab holds the database" },
  follower: { tone: "blue", label: "Follower: using another tab's database" },
  failed: { tone: "red", label: "Failed" },
};

type CountRow = { table: string; rows: number };
const COLUMNS: Column<CountRow>[] = [
  { key: "table", header: "Table", cell: (r) => `\`${r.table}\``, sortValue: (r) => r.table },
  { key: "rows", header: "Rows", cell: (r) => r.rows, align: "right", sortValue: (r) => r.rows },
];

export default function DevDb() {
  const status = useDbStatus();
  const counts = useQuery("db.counts");
  const latest = useQuery("dev.latestQuestion");
  const add = useMutation("dev.addSampleQuestion");
  const answer = useMutation("dev.answerRandom");
  const clear = useMutation("dev.clearAll");
  const [confirmClear, setConfirmClear] = useState(false);
  const [lastAnswer, setLastAnswer] = useState<string | null>(null);
  const role = ROLE[status.role];
  const info = status.info;

  return (
    <>
      <Heading level={1}>Database</Heading>
      <Callout tone="info" title="Open this page in a second tab.">
        One tab **leads** (its worker holds the database); the others **follow** through it. Click a button in either
        tab and both update. Close the leader: the other tab takes over within a second.
      </Callout>

      <Card
        title="Connection"
        subtitle={`This tab: \`${status.tabId || "…"}\` · leader: \`${status.leaderTab ?? "none yet"}\``}
        actions={<Pill tone={role.tone}>{role.label}</Pill>}
      >
        {status.error && (
          <Callout tone="caution" title="The database couldn't open">
            {status.error}
          </Callout>
        )}
        {info && (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3">
            <Stat value={info.schemaVersion} label="Schema version" hint={`was ${info.migratedFrom} when opened`} />
            <Stat value={info.sqliteVersion} label="SQLite" />
            <Stat value={`${info.openMs} ms`} label="Time to open" />
            <Stat value={`\`${info.file}\``} label="File (OPFS pool)" />
          </div>
        )}
      </Card>

      <Card
        title="Try it"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" loading={add.pending} onClick={() => add.run()}>
              Add a sample question
            </Button>
            <Button
              loading={answer.pending}
              onClick={async () => {
                const r = await answer.run();
                setLastAnswer(r ? `Answered \`${r.question_id}\`: **${r.outcome}**` : "No questions yet.");
              }}
            >
              Answer a random question
            </Button>
            <Button variant="danger" onClick={() => setConfirmClear(true)}>
              Delete all data
            </Button>
          </div>
        }
      >
        {lastAnswer && <Text>{lastAnswer}</Text>}
        {latest.data ? (
          <div className="grid gap-2">
            <Text variant="muted">Newest question (decoded: `options` is an array, not JSON text)</Text>
            <Rich block text={latest.data.question.stem} />
            <Text>
              {latest.data.mcq ? latest.data.mcq.options.map((o, i) => `${"ABCD"[i]}. ${o}`).join("   ") : ""}
            </Text>
            <Text variant="muted">
              {latest.data.stats
                ? `Seen ${latest.data.stats.visited}× · correct ${latest.data.stats.correct} · incorrect ${latest.data.stats.incorrect}`
                : "Not answered yet."}
            </Text>
          </div>
        ) : (
          <Text variant="muted">{latest.loading ? "Loading…" : "No questions yet. Add a sample one."}</Text>
        )}
      </Card>

      <Card title="Tables" subtitle="Row counts. Live: re-runs whenever any tab changes a table.">
        {counts.error && <Callout tone="caution">{counts.error}</Callout>}
        <Table columns={COLUMNS} rows={counts.data ?? []} rowKey={(r) => r.table} empty="Loading…" />
      </Card>

      <Dialog
        open={confirmClear}
        onClose={() => setConfirmClear(false)}
        title="Delete all data?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmClear(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={clear.pending}
              onClick={async () => {
                await clear.run();
                setLastAnswer(null);
                setConfirmClear(false);
              }}
            >
              Delete everything
            </Button>
          </>
        }
      >
        <Text>Every table in this browser's Orbit database is emptied. This can't be undone.</Text>
      </Dialog>
    </>
  );
}
