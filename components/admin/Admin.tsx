"use client";
import { useEffect, useState } from "react";
import { ProfileSummary, findAcross, summaries } from "@/lib/adminData";
import ProfileView from "./ProfileView";

// Admin: first a list of profiles to pick from, then everything that profile has (plan, questions, mock tests).
export default function Admin() {
  const [rows, setRows] = useState<ProfileSummary[] | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [focus, setFocus] = useState<string | null>(null);
  const [needle, setNeedle] = useState("");
  const refresh = () => setRows(summaries());
  useEffect(() => {
    refresh();
    // deep link from a question's Edit button: /admin?profile=<id>&q=<question id>
    const sp = new URLSearchParams(window.location.search);
    const pf = sp.get("profile"), q = sp.get("q");
    if (pf) { setPicked(pf); setFocus(q); }
  }, []);

  if (!rows) return <p className="muted">Loading…</p>;
  const me = rows.find((r) => r.profile.id === picked);
  if (me) return <ProfileView row={me} focusId={focus} onBack={() => { setPicked(null); setFocus(null); refresh(); }} />;

  const hits = needle.trim() ? findAcross(needle) : [];
  return (
    <>
      <h1>Admin</h1>
      <p className="muted">Pick a profile to see its plan and question banks and change them. Everything stays in this browser.</p>
      <div className="callout">🔴 CAUTION: Changes here are saved straight away in that profile. Export its pack first if you want a copy of the old version.</div>

      <h2>Profiles</h2>
      <div className="ad-grid">
        {rows.map((r) => (
          <button key={r.profile.id} className="ad-card" onClick={() => setPicked(r.profile.id)}>
            <span className="pf-av">{r.profile.name.slice(0, 1).toUpperCase()}</span>
            <b>{r.profile.name}</b>
            <span className="small muted">{r.planName ? `Plan: ${r.planName} (${r.planDays} days)` : "No plan"}</span>
            <span className="small muted">{r.packName ? `${r.practice} practice questions · ${r.mockTests} mock test${r.mockTests === 1 ? "" : "s"} (${r.mockQuestions} questions) · ${r.topics} topics` : "No question pack"}</span>
          </button>
        ))}
      </div>

      <h2>Find a question by ID</h2>
      <p className="small muted">Looks in every profile. Part of an id works too.</p>
      <input className="ad-in" value={needle} onChange={(e) => setNeedle(e.target.value)} placeholder="e.g. alg-3 or mock1-q2" spellCheck={false} />
      {needle.trim() && hits.length === 0 && <p className="small muted">No question has an id containing “{needle.trim()}”.</p>}
      {hits.length > 0 && (
        <table className="t ad-table">
          <thead><tr><th>Id</th><th>Profile</th><th>Where</th><th /></tr></thead>
          <tbody>
            {hits.map((h, i) => (
              <tr key={i}>
                <td><code>{h.loc.q.id}</code></td>
                <td>{h.profile.name}</td>
                <td className="muted">{h.loc.bank === "practice" ? "Practice" : `Mock: ${h.loc.mockName}`}</td>
                <td><button className="btn soft" onClick={() => { setFocus(h.loc.q.id); setPicked(h.profile.id); }}>Open</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
