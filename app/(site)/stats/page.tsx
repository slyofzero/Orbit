"use client";
import { useEffect, useState } from "react";
import Explorer from "@/components/stats/Explorer";
import MistakesPanel from "@/components/stats/MistakesPanel";
import Overview from "@/components/stats/Overview";
import ResetStats from "@/components/stats/ResetStats";
import Progress from "@/components/stats/Progress";
import QuestionsTab from "@/components/stats/QuestionsTab";
import { useStats } from "@/components/stats/useStats";
import { activeProfileId, listProfiles } from "@/lib/profiles";
import { statsSheets } from "@/lib/statsSheets";
import { downloadXlsx } from "@/lib/xlsx";

type Tab = "overview" | "progress" | "explore" | "questions" | "mistakes";
const TABS: [Tab, string][] = [["overview", "Overview"], ["progress", "Progress"], ["explore", "Explore"], ["questions", "Questions"], ["mistakes", "Mistakes"]];

export default function Stats() {
  const { ready, pack, evs, attempts, views, plan, done, links } = useStats();
  const [tab, setTab] = useState<Tab>("overview");
  const [path, setPath] = useState<string[]>([]);
  const [note, setNote] = useState("");
  useEffect(() => { const t = new URLSearchParams(window.location.search).get("tab"); if (TABS.some(([k]) => k === t)) setTab(t as Tab); }, []);

  if (!ready) return <p className="muted">Loading…</p>;

  const exportXlsx = () => {
    const profile = listProfiles().find((p) => p.id === activeProfileId())?.name ?? "Main";
    downloadXlsx(`orbit-stats-${new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" })}.xlsx`, statsSheets({ evs, pack, attempts, profile, views, plan, done, links }));
    setNote("Excel file downloaded with every statistic: summary, subjects, topics, questions, question detail, mastery, revision queue, tags, difficulty and type, daily and weekly activity, time of day, mocks and plan adherence.");
  };
  const explore = (p: string[]) => { setPath(p); setTab("explore"); };

  return (
    <>
      <div className="row" style={{ alignItems: "baseline" }}>
        <h1>Stats</h1>
        <span className="right row" style={{ gap: 8 }}>
          <ResetStats onExport={exportXlsx} onDone={setNote} />
          <button className="btn primary" onClick={exportXlsx} disabled={!evs.length && !pack.questions.length}>Export to Excel</button>
        </span>
      </div>
      <p className="muted small" style={{ marginTop: -6 }}>Every answer is tagged with its subject, topic and optional tags, so you can see exactly where you stand.</p>
      {note && <p className="small" role="status">{note}</p>}
      <div className="tabs">{TABS.map(([k, l]) => <button key={k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{l}</button>)}</div>

      {tab === "overview" && <Overview evs={evs} pack={pack} attempts={attempts} onExplore={explore} />}
      {tab === "progress" && <Progress evs={evs} pack={pack} views={views} plan={plan} done={done} links={links} />}
      {tab === "explore" && <Explorer key={path.join("/")} evs={evs} pack={pack} initialPath={path} />}
      {tab === "questions" && <QuestionsTab evs={evs} pack={pack} />}
      {tab === "mistakes" && <MistakesPanel />}
    </>
  );
}
