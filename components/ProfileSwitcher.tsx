"use client";
import { useEffect, useRef, useState } from "react";
import { KEYS } from "@/lib/store";
import { Profile, activeProfileId, createProfile, deleteProfile, listProfiles, renameProfile, switchProfile } from "@/lib/profiles";

// Browser-style profile picker. Each profile keeps its own plan, question pack and progress.
export default function ProfileSwitcher() {
  const [list, setList] = useState<Profile[]>([]);
  const [active, setActive] = useState("main");
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"list" | "new" | "rename" | "delete">("list");
  const [text, setText] = useState("");
  const box = useRef<HTMLDivElement>(null);

  const refresh = () => { setList(listProfiles()); setActive(activeProfileId()); };
  useEffect(() => {
    refresh();
    window.addEventListener("gate-profiles", refresh);
    return () => window.removeEventListener("gate-profiles", refresh);
  }, []);
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) { setOpen(false); setMode("list"); } };
    document.addEventListener("mousedown", away);
    return () => document.removeEventListener("mousedown", away);
  }, [open]);

  const me = list.find((p) => p.id === active);
  if (!me) return null;
  const close = () => { setOpen(false); setMode("list"); setText(""); };

  return (
    <div className="profile" ref={box}>
      <button className="profile-btn" onClick={() => setOpen((o) => !o)} aria-expanded={open} title="Switch profile">
        <span className="pf-av">{me.admin ? "★" : me.name.slice(0, 1).toUpperCase()}</span>
        <span className="pf-name">{me.name}</span>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10l5 5 5-5" /></svg>
      </button>

      {open && (
        <div className="pf-menu" role="menu">
          {mode === "list" && (
            <>
              <p className="pf-hint">Each profile has its own plan, question pack and progress.</p>
              {list.filter((p) => !p.admin || p.id === active).map((p) => (
                <button key={p.id} role="menuitemradio" aria-checked={p.id === active} className={`pf-row ${p.id === active ? "on" : ""}`}
                  onClick={() => (p.id === active ? close() : switchProfile(p.id, "Switching profile"))}>
                  <span className="pf-av">{p.admin ? "★" : p.name.slice(0, 1).toUpperCase()}</span>{p.name}{p.id === active && <i>✓</i>}
                </button>
              ))}
              <div className="pf-sep" />
              {!me.admin && <button className="pf-act" onClick={() => { setMode("new"); setText(""); }}>+ New profile</button>}
              {!me.admin && <button className="pf-act" onClick={() => { setMode("rename"); setText(me.name); }}>Rename this profile</button>}
              {!me.admin && list.filter((p) => !p.admin).length > 1 && <button className="pf-act danger" onClick={() => setMode("delete")}>Delete this profile</button>}
              {me.admin && <button className="pf-act" onClick={() => { const first = list.find((p) => !p.admin); if (first) switchProfile(first.id, "Leaving admin"); }}>Leave admin</button>}
            </>
          )}

          {(mode === "new" || mode === "rename") && (
            <form onSubmit={(e) => {
              e.preventDefault();
              if (!text.trim()) return;
              if (mode === "new") switchProfile(createProfile(text), "New profile, starting empty");
              else { renameProfile(active, text); refresh(); close(); }
            }}>
              <label className="pf-hint" htmlFor="pf-in">{mode === "new" ? "Name the new profile (it starts empty):" : "New name:"}</label>
              <input id="pf-in" className="pf-in" autoFocus maxLength={24} value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. Maths revision" />
              <div className="row">
                <button className="btn primary" type="submit" disabled={!text.trim()}>{mode === "new" ? "Create and switch" : "Save"}</button>
                <button className="btn soft" type="button" onClick={() => setMode("list")}>Back</button>
              </div>
            </form>
          )}

          {mode === "delete" && (
            <div>
              <p className="pf-warn">🔴 CAUTION: this permanently deletes “{me.name}” with its plan, question pack, progress and mock history. It can’t be undone.</p>
              <div className="row">
                <button className="btn primary" onClick={() => deleteProfile(active, Object.values(KEYS))}>Yes, delete it</button>
                <button className="btn soft" onClick={() => setMode("list")}>Cancel</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
