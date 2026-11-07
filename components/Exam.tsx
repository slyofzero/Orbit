"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Answer, Attempt, Resp, Settings } from "@/lib/types";
import { DEFAULT_SETTINGS, KEYS, usePersisted } from "@/lib/store";
import { isAttempted, negLabel } from "@/lib/scoring";
import Rich from "./Rich";
import Calculator from "./Calculator";

type Status = "nv" | "na" | "an" | "mr" | "ma";
const LEGEND: [Status, string][] = [
  ["nv", "Not Visited"], ["na", "Not Answered"], ["an", "Answered"],
  ["mr", "Marked for Review"], ["ma", "Answered & Marked for Review (will be evaluated)"],
];
const TYPE_NAME = { mcq: "Multiple Choice Question (MCQ)", msq: "Multiple Select Question (MSQ)", nat: "Numerical Answer Type (NAT)" } as const;
const pad = (n: number) => String(n).padStart(2, "0");
const hms = (s: number) => `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;

export default function Exam({ id }: { id: string }) {
  const router = useRouter();
  const [attempts, setAttempts, ready] = usePersisted<Attempt[]>(KEYS.attempts, []);
  const [settings] = usePersisted<Settings>(KEYS.settings, DEFAULT_SETTINGS);
  const attempt = attempts.find((a) => a.id === id);

  const [cur, setCur] = useState(0);
  const [draft, setDraft] = useState<Answer | undefined>(undefined);
  const [now, setNow] = useState(() => Date.now());
  const [modal, setModal] = useState<null | "paper" | "instr" | "submit">(null);
  const [calc, setCalc] = useState(false);
  const [agree, setAgree] = useState(false);

  const patchAttempt = useCallback(
    (fn: (a: Attempt) => Attempt) => setAttempts((p) => p.map((a) => (a.id === id ? fn(a) : a))),
    [id, setAttempts]
  );

  const setResp = useCallback(
    (i: number, patch: Partial<Resp>) =>
      patchAttempt((a) => {
        const prev: Resp = a.responses[i] ?? { visited: true, marked: false };
        return { ...a, responses: { ...a.responses, [i]: { ...prev, ...patch, visited: true } } };
      }),
    [patchAttempt]
  );

  const submit = useCallback(() => {
    patchAttempt((a) => (a.submittedAt ? a : { ...a, submittedAt: Date.now() }));
    router.push(`/results/${id}`);
  }, [patchAttempt, router, id]);

  // wall-clock timer
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const running = !!attempt?.startedAt && !attempt.submittedAt;
  const remaining = running ? Math.max(0, Math.round((attempt!.startedAt! + attempt!.durationSec * 1000 - now) / 1000)) : attempt?.durationSec ?? 0;
  useEffect(() => {
    if (running && remaining <= 0) submit();
  }, [running, remaining, submit]);

  useEffect(() => {
    if (attempt?.submittedAt) router.replace(`/results/${id}`);
  }, [attempt?.submittedAt, router, id]);

  const sectionOf = useMemo(() => {
    if (!attempt) return 0;
    return Math.max(0, attempt.sections.findIndex((s) => cur >= s.from && cur <= s.to));
  }, [attempt, cur]);

  if (!ready) return <div className="instr">Loading…</div>;
  if (!attempt) return <div className="instr"><p>Attempt not found.</p><Link href="/mocks">Back to mock tests</Link></div>;

  const total = attempt.questions.length;
  const q = attempt.questions[cur];
  const sec = attempt.sections[sectionOf];

  const statusOf = (i: number): Status => {
    const r = attempt.responses[i];
    if (!r || !r.visited) return "nv";
    const a = isAttempted(r.ans);
    if (r.marked) return a ? "ma" : "mr";
    return a ? "an" : "na";
  };
  const count = (from: number, to: number) => {
    const c = { nv: 0, na: 0, an: 0, mr: 0, ma: 0 } as Record<Status, number>;
    for (let i = from; i <= to; i++) c[statusOf(i)]++;
    return c;
  };

  const go = (i: number) => {
    if (i < 0 || i >= total) return;
    setCur(i);
    setDraft(attempt.responses[i]?.ans);
    if (!attempt.responses[i]?.visited) setResp(i, { visited: true });
  };

  const normalized = (a: Answer | undefined): Answer | undefined => {
    if (a === undefined) return undefined;
    if (typeof a === "string") return a.trim() === "" ? undefined : a.trim();
    if (Array.isArray(a)) return a.length ? [...a].sort() : undefined;
    return a;
  };

  const saveNext = () => { setResp(cur, { ans: normalized(draft), marked: false }); go(Math.min(cur + 1, total - 1)); };
  const markNext = () => { setResp(cur, { ans: normalized(draft), marked: true }); go(Math.min(cur + 1, total - 1)); };
  const clear = () => { setDraft(undefined); setResp(cur, { ans: undefined }); };

  const begin = () => {
    patchAttempt((a) => ({ ...a, startedAt: Date.now(), responses: { 0: { visited: true, marked: false } } }));
    setNow(Date.now());
    setCur(0);
    setDraft(undefined);
  };

  const toggleOpt = (i: number) => {
    if (q.type === "mcq") setDraft(i);
    else {
      const c = (draft as number[] | undefined) ?? [];
      setDraft(c.includes(i) ? c.filter((x) => x !== i) : [...c, i]);
    }
  };
  const key = (k: string) => {
    const c = (draft as string | undefined) ?? "";
    if (k === "BS") setDraft(c.slice(0, -1));
    else if (k === "C") setDraft("");
    else if (k === "-") setDraft(c.startsWith("-") ? c.slice(1) : "-" + c);
    else if (k === "." && c.includes(".")) return;
    else setDraft(c + k);
  };

  // ---------- instructions screen ----------
  if (!attempt.startedAt) {
    return (
      <div className="arena">
        <div className="ex-top"><span className="title">{attempt.title}</span><span className="spacer" /><span>Candidate: {settings.name}</span></div>
        <div className="instr">
          <h2>General Instructions</h2>
          <ol>
            <li>The total duration of this test is <b>{Math.round(attempt.durationSec / 60)} minutes</b>. The countdown timer at the top right shows the remaining time. When it reaches zero the test is submitted automatically.</li>
            <li>The question palette on the right shows the status of each question:</li>
          </ol>
          <div style={{ display: "grid", gap: 8, margin: "6px 0 14px 30px" }}>
            {LEGEND.map(([s, l]) => <div key={s} className="row"><span className={`sw s-${s}`}>{s === "nv" ? "1" : ""}</span>{l}</div>)}
          </div>
          <ol start={3}>
            <li>Click a question number in the palette to jump to it. <b>This does NOT save your current answer.</b></li>
            <li>Click <b>Save &amp; Next</b> to save your answer and go to the next question. Click <b>Mark for Review &amp; Next</b> to save the answer (if any) and flag the question for review. Questions that are answered and marked are still evaluated.</li>
            <li>Click <b>Clear Response</b> to remove your answer to the current question.</li>
            <li><b>MCQ</b>: pick one option; wrong answers lose 1/3 mark (1-mark question) or 2/3 mark (2-mark question). <b>MSQ</b>: pick all correct options; there is no partial credit and no negative marking. <b>NAT</b>: type a number using the keypad; no negative marking.</li>
            <li>You can open the virtual <b>Calculator</b> from the top bar. Rough work on paper is allowed.</li>
            <li>You may move freely between the sections and change your saved answers until you submit.</li>
          </ol>
          {attempt.warnings.length > 0 && (
            <div className="callout warn">Note: this mock is shorter than the real paper because the question bank ran short. {attempt.warnings.join(" ")}</div>
          )}
          <div className="callout">🔴 CAUTION: Do NOT refresh or close this tab expecting the clock to pause. The timer keeps running once you press Start.</div>
          <label className="row"><input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} /> I have read and understood the instructions.</label>
          <div className="row" style={{ marginTop: 14 }}>
            <button className="xb blue" disabled={!agree} onClick={begin}>I am ready to begin</button>
            <Link href="/mocks">Cancel</Link>
          </div>
        </div>
      </div>
    );
  }

  // ---------- exam screen ----------
  const secCount = count(sec.from, sec.to);
  return (
    <div className="arena">
      <div className="ex-top">
        <span className="title">{attempt.title} · GATE 2027 Data Science &amp; AI (practice)</span>
        <span className="spacer" />
        <button onClick={() => setCalc((c) => !c)}>🖩 Calculator</button>
        <button onClick={() => setModal("paper")}>Question Paper</button>
        <button onClick={() => setModal("instr")}>Instructions</button>
        <button onClick={() => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.())}>Full screen</button>
      </div>
      <div className="ex-sub">
        {attempt.sections.map((s, i) => (
          <div key={s.name} className={`ex-sec ${i === sectionOf ? "on" : ""}`} onClick={() => go(s.from)}>{s.name}</div>
        ))}
        <div className={`ex-timer ${remaining < 600 ? "low" : ""}`}>Time Left: <b>{hms(remaining)}</b></div>
      </div>

      <div className="ex-body">
        <div className="ex-left">
          <div className="ex-qhead">
            <span className="qno">Question No. {cur + 1}</span>
            <span className="qinfo">
              Question Type: <b>{TYPE_NAME[q.type]}</b> &nbsp;|&nbsp; Marks for correct answer: <b>{q.marks}</b> &nbsp;|&nbsp; Negative Marks: <b>{negLabel(q)}</b>
            </span>
          </div>
          <div className="ex-qarea">
            <div className="qtext"><Rich text={q.text} /></div>
            {q.type !== "nat" && (
              <div style={{ marginTop: 10 }}>
                {q.options!.map((o, i) => {
                  const on = q.type === "mcq" ? draft === i : ((draft as number[] | undefined) ?? []).includes(i);
                  return (
                    <label key={i} className="ex-opt">
                      <input type={q.type === "mcq" ? "radio" : "checkbox"} name="opt" checked={on} onChange={() => toggleOpt(i)} />
                      <span>({String.fromCharCode(65 + i)}) <Rich text={o} /></span>
                    </label>
                  );
                })}
                {q.type === "msq" && <div className="small muted">Select ALL correct options.</div>}
              </div>
            )}
            {q.type === "nat" && (
              <div style={{ marginTop: 10 }}>
                <input className="natinput" type="text" value={(draft as string | undefined) ?? ""} onChange={(e) => setDraft(e.target.value)} placeholder="Answer" />
                <div className="keypad">
                  {["7", "8", "9", "4", "5", "6", "1", "2", "3", "0", ".", "-"].map((k) => <button key={k} onClick={() => key(k)}>{k === "-" ? "+/−" : k}</button>)}
                  <button onClick={() => key("BS")}>⌫</button>
                  <button onClick={() => key("C")} style={{ gridColumn: "span 2" }}>Clear</button>
                </div>
              </div>
            )}
            <div className="ex-hint">Your response is saved only when you click “Save &amp; Next” or “Mark for Review &amp; Next”.</div>
          </div>
          <div className="ex-actions">
            <button className="xb orange" onClick={markNext}>Mark for Review &amp; Next</button>
            <button className="xb" onClick={clear}>Clear Response</button>
            <span style={{ flex: 1 }} />
            <button className="xb" onClick={() => go(cur - 1)} disabled={cur === 0}>&lt;&lt; Back</button>
            <button className="xb" onClick={() => go(cur + 1)} disabled={cur === total - 1}>Next &gt;&gt;</button>
            <button className="xb green" onClick={saveNext}>Save &amp; Next</button>
          </div>
        </div>

        <div className="ex-right">
          <div className="ex-cand"><div className="avatar">👤</div><div><b>{settings.name}</b><div className="small muted">Candidate</div></div></div>
          <div className="legend">
            {LEGEND.map(([s, l]) => (
              <div key={s} style={s === "ma" ? { gridColumn: "span 2" } : undefined}>
                <span className={`sw s-${s}`}>{count(sec.from, sec.to)[s]}</span>{l}
              </div>
            ))}
          </div>
          <div className="pal-title">{sec.name}</div>
          <div className="pal">
            {Array.from({ length: sec.to - sec.from + 1 }, (_, k) => sec.from + k).map((i) => (
              <button key={i} className={`pb ${i === cur ? "cur" : ""}`} onClick={() => go(i)}>
                <span className={`shape s-${statusOf(i)}`}>{i + 1}</span>
              </button>
            ))}
          </div>
          <div className="ex-right-foot">
            <span className="small muted" style={{ flex: 1 }}>
              Answered {secCount.an + secCount.ma} · Not answered {secCount.na} · Review {secCount.mr + secCount.ma}
            </span>
            <button className="xb blue" onClick={() => setModal("submit")}>Submit</button>
          </div>
        </div>
      </div>

      {calc && <Calculator onClose={() => setCalc(false)} />}

      {modal === "paper" && (
        <div className="modal-bg" onClick={() => setModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="row"><h2>Question Paper: {sec.name}</h2><button className="xb right" onClick={() => setModal(null)}>Close</button></div>
            {attempt.questions.slice(sec.from, sec.to + 1).map((qq, k) => (
              <div key={qq.id} style={{ borderBottom: "1px solid #ddd", padding: "8px 0" }}>
                <b>Q{sec.from + k + 1}.</b> <Rich text={qq.text} />
              </div>
            ))}
          </div>
        </div>
      )}

      {modal === "instr" && (
        <div className="modal-bg" onClick={() => setModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="row"><h2>Instructions</h2><button className="xb right" onClick={() => setModal(null)}>Close</button></div>
            <ul>
              <li>Palette click, Back and Next do NOT save the answer; use Save &amp; Next or Mark for Review &amp; Next.</li>
              <li>MCQ: negative marking 1/3 (1-mark) or 2/3 (2-mark). MSQ and NAT: no negative marking, no partial credit.</li>
              <li>Answered &amp; Marked for Review questions are evaluated.</li>
            </ul>
          </div>
        </div>
      )}

      {modal === "submit" && (
        <div className="modal-bg">
          <div className="modal">
            <h2>Exam Summary</h2>
            <table className="t">
              <thead><tr><th>Section</th><th>Questions</th><th>Answered</th><th>Not Answered</th><th>Marked for Review</th><th>Answered &amp; Marked</th><th>Not Visited</th></tr></thead>
              <tbody>
                {attempt.sections.map((s) => {
                  const c = count(s.from, s.to);
                  return (
                    <tr key={s.name}><td>{s.name}</td><td>{s.to - s.from + 1}</td><td>{c.an}</td><td>{c.na}</td><td>{c.mr}</td><td>{c.ma}</td><td>{c.nv}</td></tr>
                  );
                })}
              </tbody>
            </table>
            <p><b>Are you sure you want to submit?</b> You will not be able to change your answers afterwards.</p>
            <div className="row">
              <button className="xb blue" onClick={submit}>Yes, submit</button>
              <button className="xb" onClick={() => setModal(null)}>No, go back</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
