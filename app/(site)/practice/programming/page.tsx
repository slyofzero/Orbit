"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import CodeLangPill from "@/components/CodeLangPill";

import PracticeTabs from "@/components/PracticeTabs";
import TagFilter from "@/components/TagFilter";
import { makeMatcher } from "@/lib/questionFilter";
import { KEYS, usePack, usePersisted } from "@/lib/store";
import { LANGUAGE_LABEL, type CodeLanguage } from "@/lib/codeLanguages";
import { PracticeRec } from "@/lib/types";
import PageLoading from "@/components/PageLoading";

const firstLine = (t: string) => t.replace(/!\[[^\]\n]*\]\([^)\s]+\)/g, "").replace(/```[\s\S]*?```/g, " ").replace(/[`$]/g, "").split("\n").map((l) => l.trim()).find(Boolean)?.slice(0, 110) ?? "Programming question";

export default function Programming() {
  const { pack, topicById, subjects, ready: packReady, custom } = usePack();
  const [practice, , ready] = usePersisted<Record<string, PracticeRec>>(KEYS.practice, {});
  const [lang, setLang] = useState("all");
  const [status, setStatus] = useState<"all" | "todo" | "solved">("all");
  const [picked, setPicked] = useState<string[]>([]);
  const [find, setFind] = useState("");

  const all = useMemo(() => pack.questions.filter((q) => q.type === "code"), [pack]);
  const langs = useMemo(() => [...new Set(all.map((q) => q.code!.language))], [all]);
  const passes = makeMatcher(pack, picked);
  const shown = all.filter((q) => {
    if (!passes(q)) return false;
    if (lang !== "all" && q.code!.language !== lang) return false;
    const done = !!practice[q.id]?.correct;
    if (status === "solved" && !done) return false;
    if (status === "todo" && done) return false;
    const n = find.trim().toLowerCase();
    return !n || q.text.toLowerCase().includes(n) || q.id.toLowerCase().includes(n) || (topicById[q.topic]?.name ?? "").toLowerCase().includes(n) || (q.tags ?? []).some((t) => t.includes(n));
  });
  const solved = all.filter((q) => practice[q.id]?.correct).length;

  if (!packReady || !ready) return <PageLoading />;

  return (
    <>
      <div className="row" style={{ alignItems: "center", marginBottom: 18 }}>
        <h1>Practice</h1>
        <PracticeTabs active="programming" />
        <Link href="/practice/manage" className="btn invert right">Manage pack</Link>
      </div>
      {!custom || all.length === 0 ? (
        <div className="panel">
          <h2 style={{ marginTop: 0 }}>No programming questions yet</h2>
          <p className="muted" style={{ margin: 0 }}>Programming questions are ones where you write code and Orbit runs it on your computer. Ask your AI for questions with <code>"type": "code"</code> using the prompt in Practice, Manage pack, then upload them. They appear here.</p>
        </div>
      ) : (
        <>
          <p className="muted">{solved} of {all.length} solved. Pick one to open it on its own page. Your code runs on this computer against the question's tests.</p>
          <div className="pr-bar">
            <input type="search" className="pr-search" placeholder="Find a question" value={find} onChange={(e) => setFind(e.target.value)} aria-label="Find a question" />
            <div className="tabs" style={{ margin: 0 }}>
              {([["all", "All"], ["todo", "To do"], ["solved", "Solved"]] as const).map(([k, l]) => <button key={k} className={status === k ? "on" : ""} onClick={() => setStatus(k)}>{l}</button>)}
            </div>
            {langs.length > 1 && (
              <div className="tabs" style={{ margin: 0 }}>
                <button className={lang === "all" ? "on" : ""} onClick={() => setLang("all")}>Any language</button>
                {langs.map((l) => <button key={l} className={lang === l ? "on" : ""} onClick={() => setLang(l)}>{LANGUAGE_LABEL[l as CodeLanguage] ?? l}</button>)}
              </div>
            )}
            <TagFilter pack={pack} qs={all} picked={picked} onChange={setPicked} />
          </div>
          <div className="pg-list">
            {shown.length === 0 && <p className="muted">No question matches. Clear the search or pick another filter.</p>}
            {shown.map((q) => {
              const rec = practice[q.id];
              return (
                <Link key={q.id} href={`/practice/programming/${encodeURIComponent(q.id)}`} className="pg-item pg-link">
                  <span className="pg-head">
                    <span className={`pg-state ${rec?.correct ? "ok" : rec ? "tried" : ""}`} title={rec?.correct ? "Solved" : rec ? "Tried, not solved" : "Not tried"}>{rec?.correct ? "✓" : rec ? "•" : ""}</span>
                    <span className="nm">{firstLine(q.text)}</span>
                    <CodeLangPill language={q.code!.language} />
                    {q.code!.setup && <span className="pill">needs setup</span>}
                    <span className="small muted pg-meta">{q.marks} mark{q.marks > 1 ? "s" : ""} · {(() => { const sid = q.subject ?? topicById[q.topic]?.subject ?? ""; return subjects[sid] ?? sid; })()}{topicById[q.topic] ? `: ${topicById[q.topic].name}` : ""}</span>
                  </span>
                </Link>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}
