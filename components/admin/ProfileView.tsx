"use client";
import { useEffect, useState } from "react";
import { ImageProfile } from "@/components/Img";
import { ProfileSummary, readPack, writePack } from "@/lib/adminData";
import { PackData } from "@/lib/packs";
import QuestionsPanel from "./QuestionsPanel";
import TopicsPanel from "./TopicsPanel";
import MocksPanel from "./MocksPanel";
import PlanPanel from "./PlanPanel";
import UploadPanel from "./UploadPanel";

const TABS = ["Questions", "Mock tests", "Topics", "Plan", "Upload"] as const;
type Tab = (typeof TABS)[number];

export default function ProfileView({ row, focusId, onBack }: { row: ProfileSummary; focusId: string | null; onBack: () => void }) {
  const id = row.profile.id;
  const [pack, setPack] = useState<PackData | null | undefined>(undefined);
  const [tab, setTab] = useState<Tab>("Questions");
  useEffect(() => { setPack(readPack(id)); }, [id]);
  const save = (next: PackData | null) => { writePack(id, next); setPack(next); };
  if (pack === undefined) return <p className="muted">Loading…</p>;

  const needsPack = tab === "Questions" || tab === "Mock tests" || tab === "Topics";
  return (
    <ImageProfile.Provider value={id}>
      <p className="small"><a href="#" onClick={(e) => { e.preventDefault(); onBack(); }}>← All profiles</a></p>
      <h1 style={{ display: "flex", alignItems: "center", gap: 12 }}><span className="pf-av">{row.profile.name.slice(0, 1).toUpperCase()}</span>{row.profile.name}</h1>
      <p className="muted">{pack ? `${pack.name}: ${pack.questions.length} practice questions, ${pack.mockTests.length} mock test${pack.mockTests.length === 1 ? "" : "s"}, ${pack.topics.length} topics.` : "This profile has no question pack."}</p>
      <div className="pk-tabs" role="tablist">
        {TABS.map((t) => <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? "on" : ""} onClick={() => setTab(t)}>{t}</button>)}
      </div>
      {needsPack && !pack && <div className="panel"><p>There is no question pack in this profile yet.</p><button className="btn primary" onClick={() => setTab("Upload")}>Upload one</button></div>}
      {tab === "Questions" && pack && <QuestionsPanel profile={id} pack={pack} save={save} focusId={focusId} />}
      {tab === "Mock tests" && pack && <MocksPanel profile={id} pack={pack} save={save} />}
      {tab === "Topics" && pack && <TopicsPanel pack={pack} save={save} />}
      {tab === "Plan" && <PlanPanel profile={id} />}
      {tab === "Upload" && <UploadPanel profile={id} pack={pack} save={save} />}
    </ImageProfile.Provider>
  );
}
