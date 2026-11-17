"use client";
// Pick files. A drop zone with a bobbing arrow; while a file is dragged over it the border turns into
// the flowing special gradient and it says "Let go to add it". Each chosen file slides in as a little
// card: a type tile (a real thumbnail for pictures), its name and size, a popping ✓, and remove.
// With `multiple`, the zone shrinks to a slim "add more" bar once something is chosen.
// Replaces the browser's own file field.

import { useEffect, useId, useMemo, useRef, useState, type DragEvent, type ReactNode } from "react";
import { Button, IconButton } from "./Button";
import { FieldLabel } from "./Field";
import { IconCheck, IconUpload, IconX } from "./icons";
import { txt } from "./txt";
import { cx } from "./cx";

const size = (n: number) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);

type Kind = "image" | "json" | "zip" | "pdf" | "text" | "file";
function kindOf(f: File): Kind {
  const ext = f.name.split(".").pop()?.toLowerCase() ?? "";
  if (f.type.startsWith("image/")) return "image";
  if (ext === "json" || f.type === "application/json") return "json";
  if (ext === "zip") return "zip";
  if (ext === "pdf") return "pdf";
  if (f.type.startsWith("text/") || ["txt", "md", "csv"].includes(ext)) return "text";
  return "file";
}
const extOf = (f: File) => (f.name.includes(".") ? f.name.split(".").pop()!.slice(0, 4).toUpperCase() : "FILE");

function FileCard({ file, onRemove }: { file: File; onRemove: () => void }) {
  const kind = kindOf(file);
  const url = useMemo(() => (kind === "image" ? URL.createObjectURL(file) : null), [file, kind]);
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
  return (
    <li className="ui-fc">
      <span className={cx("ui-fc-tile", `is-${kind}`)} aria-hidden="true">
        {url ? <img src={url} alt="" /> : extOf(file)}
      </span>
      <span className="ui-fc-text">
        <span className="ui-fc-name" title={file.name}>{file.name}</span>
        <span className="ui-fc-meta">{size(file.size)} · <span className="ui-fc-ok"><IconCheck /> Ready</span></span>
      </span>
      <IconButton label={`Remove ${file.name}`} size="sm" variant="ghost" onClick={onRemove}><IconX /></IconButton>
    </li>
  );
}

export function FileInput({ label, help, hint, error, accept, multiple = false, files, onChange,
  title, description, buttonLabel = "Browse" }: {
  label?: ReactNode; help?: ReactNode; hint?: ReactNode; error?: ReactNode;
  accept?: string;
  multiple?: boolean;
  files: File[];
  onChange: (files: File[]) => void;
  title?: ReactNode;          // big line in the zone; default "Drop a file here" / "Drop files here"
  description?: ReactNode;    // small line under it, e.g. "JSON · several files are merged into one pack"
  buttonLabel?: ReactNode;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const depth = useRef(0);                  // dragenter/leave fire for every child; count them
  const [over, setOver] = useState(false);

  const take = (list: FileList | null) => {
    const picked = [...(list ?? [])];
    if (!picked.length) return;
    onChange(multiple ? [...files, ...picked] : [picked[0]]);
  };
  const drag = {
    onDragEnter: (e: DragEvent) => { e.preventDefault(); depth.current++; setOver(true); },
    onDragOver: (e: DragEvent) => e.preventDefault(),
    onDragLeave: () => { if (--depth.current <= 0) { depth.current = 0; setOver(false); } },
    onDrop: (e: DragEvent) => { e.preventDefault(); depth.current = 0; setOver(false); take(e.dataTransfer.files); },
  };

  const compact = files.length > 0;
  const showZone = multiple || !compact;
  const big = title ?? (multiple ? "Drop files here" : "Drop a file here");

  return (
    <div className={cx("ui-field", error ? "has-error" : null)}>
      <FieldLabel htmlFor={id} label={label} help={help} />
      <input ref={input} id={id} type="file" accept={accept} multiple={multiple} className="ui-sr" tabIndex={-1}
        aria-describedby={hint || error ? `${id}-msg` : undefined}
        onChange={(e) => { take(e.target.files); e.target.value = ""; }} />

      {files.length > 0 && (
        <ul className="ui-fc-list" {...drag}>
          {files.map((f, i) => <FileCard key={`${f.name}-${f.size}-${i}`} file={f} onRemove={() => onChange(files.filter((_, j) => j !== i))} />)}
        </ul>
      )}

      {showZone ? (
        <div className={cx("ui-drop", over && "is-over", compact && "is-compact")} {...drag}>
          <span className="ui-drop-icon" aria-hidden="true"><IconUpload /></span>
          <span className="ui-drop-text">
            <span className="ui-drop-title">{over ? "Let go to add it" : compact ? "Add more" : txt(big)}</span>
            {!compact && description && <span className="ui-drop-desc">{txt(description)}</span>}
          </span>
          <Button variant="soft" size={compact ? "sm" : "md"} onClick={() => input.current?.click()}>{buttonLabel}</Button>
        </div>
      ) : (
        <div className="ui-drop-replace">
          <Button variant="ghost" size="sm" onClick={() => input.current?.click()}>Choose a different file</Button>
        </div>
      )}

      {error ? <span className="ui-error" id={`${id}-msg`}>{txt(error)}</span>
        : hint ? <span className="ui-hint" id={`${id}-msg`}>{txt(hint)}</span> : null}
    </div>
  );
}
