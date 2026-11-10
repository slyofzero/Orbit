"use client";
import ModalClose from "@/components/ModalClose";
import { useEffect } from "react";

// "Export the old one first?" Shown before a plan or question pack is replaced or removed.
export default function ExportFirstModal({ what, oldName, newName, action, onExport, onGo, onCancel }: {
  what: "plan" | "question pack";
  oldName: string;
  newName?: string;
  action: "replace" | "remove";
  onExport: () => void; // downloads the old one
  onGo: () => void;     // does the replace / remove
  onCancel: () => void;
}) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onCancel(); };
    document.addEventListener("keydown", k);
    return () => document.removeEventListener("keydown", k);
  }, [onCancel]);

  const verb = action === "replace" ? "replaced" : "removed";
  return (
    <div className="xf-veil" onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="xf-modal" role="dialog" aria-modal="true" aria-labelledby="xf-title">
        <ModalClose onClick={onCancel} />
        <h2 id="xf-title">Export your current {what} first?</h2>
        <p>
          Your {what} <b>{oldName}</b> is about to be {verb}{action === "replace" && newName ? <> by <b>{newName}</b></> : null}.
          Exporting saves it as a JSON file you can upload again any time.
        </p>
        <p className="small muted">🔴 CAUTION: if you skip the export, the old {what} is gone for good.</p>
        <div className="xf-actions">
          <button className="btn primary" autoFocus onClick={() => { onExport(); onGo(); }}>Export old {what}, then {action}</button>
          <button className="btn soft" onClick={onGo}>{action === "replace" ? "Replace" : "Remove"} without exporting</button>
          <button className="btn" onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
