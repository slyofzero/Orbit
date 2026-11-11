"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { ImageProfile } from "@/components/Img";
import PackImport from "@/components/PackImport";
import PageLoading from "@/components/PageLoading";
import QuestionsPanel from "@/components/admin/QuestionsPanel";
import MocksPanel from "@/components/admin/MocksPanel";
import TopicsPanel from "@/components/admin/TopicsPanel";
import PlanPanel from "@/components/admin/PlanPanel";
import { PackData } from "@/lib/packs";
import { activeProfileId } from "@/lib/profiles";
import { KEYS, usePersisted } from "@/lib/store";
import { exportPack } from "@/lib/imageStore";
import { toast } from "@/lib/toast";
import { downloadJson, fileSafe } from "@/lib/download";

export const MANAGE_TABS = [["questions", "Questions"], ["mock-tests", "Mock tests"], ["topics", "Topics"], ["plan", "Plan"], ["upload", "Upload"]] as const;
type Tab = (typeof MANAGE_TABS)[number][0];
const isTab = (t: string | null): t is Tab => MANAGE_TABS.some(([k]) => k === t);

/** Manage pack (/practice/manage). The section is the ?tab= query; ?q=<id> opens one question. Edits this profile's own pack. */
export default function PackManager() {
  const router = useRouter();
  const params = useSearchParams();
  const [stored, setStored, ready] = usePersisted<PackData | null>(KEYS.pack, null);
  const raw = params.get("tab");
  const tab: Tab = isTab(raw) ? raw : "questions";
  const focusId = params.get("q");
  if (!ready) return <PageLoading />;
  const pack = stored ? { ...stored, mockTests: stored.mockTests ?? [], mocks: stored.mocks ?? [] } : null;
  const profile = activeProfileId();
  const needsPack = tab === "questions" || tab === "mock-tests" || tab === "topics";
  const go = (t: Tab) => router.push(`/practice/manage?tab=${t}`);
  return (
    <ImageProfile.Provider value={profile}>
      <div className="row" style={{ alignItems: "center", marginBottom: 18 }}>
        <h1>Manage pack</h1>
        <div className="right row" style={{ gap: 8 }}>
          {pack && <button className="btn soft" onClick={async () => { downloadJson(`${fileSafe(pack.name)}.json`, await exportPack(pack)); toast(`Exported ${pack.questions.length} practice questions and ${pack.mockTests.length} mock test${pack.mockTests.length === 1 ? "" : "s"} to ${fileSafe(pack.name)}.json.`); }}>Export pack</button>}
          <Link href="/practice" className="btn invert back-btn">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 14 4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" /></svg>
            Back to practice
          </Link>
        </div>
      </div>
      <p className="muted">{pack ? `${pack.name}: ${pack.questions.length} practice questions, ${pack.mockTests.length} mock test${pack.mockTests.length === 1 ? "" : "s"}, ${pack.topics.length} topics.` : "No question pack yet."}</p>
      <div className="pk-tabs" role="tablist">
        {MANAGE_TABS.map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? "on" : ""} onClick={() => go(k)}>{l}</button>)}
      </div>
      {needsPack && !pack && <div className="panel"><p>There is no question pack yet.</p><button className="btn primary" onClick={() => go("upload")}>Upload one</button></div>}
      {tab === "questions" && pack && <QuestionsPanel profile={profile} pack={pack} save={setStored} focusId={focusId} />}
      {tab === "mock-tests" && pack && <MocksPanel profile={profile} pack={pack} save={setStored} />}
      {tab === "topics" && pack && <TopicsPanel pack={pack} save={setStored} />}
      {tab === "plan" && <PlanPanel profile={profile} />}
      {tab === "upload" && <PackImport onDone={(m) => toast(m)} />}
    </ImageProfile.Provider>
  );
}
