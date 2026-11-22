"use client";
// Pick files. A drop zone with a bobbing arrow; while a file is dragged over it the border turns into
// the flowing special gradient and it says "Let go to add it". Each chosen file slides in as a little
// card: a type tile (a real thumbnail for pictures), its name and size, a popping ✓, and remove.
// With `multiple`, the zone shrinks to a slim "add more" bar once something is chosen.
// Replaces the browser's own file field.

import { useEffect, useId, useMemo, useRef, useState, type DragEvent, type ReactNode } from "react";
import { Button, IconButton } from "@/components/ui/Button";
import { FieldLabel, FieldMessage } from "@/components/ui/Field";
import { IconCheck, IconUpload, IconX } from "@/components/icons";
import { txt } from "@/components/utils/txt";
import { cx } from "@/components/utils/cx";

const size = (n: number) =>
  n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`;

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
const TILE: Record<Kind, string> = {
  image: "bg-sheet-2",
  json: "bg-linear-135 from-blue to-[color-mix(in_srgb,var(--blue)_60%,var(--accent))]",
  zip: "bg-linear-135 from-amber to-[color-mix(in_srgb,var(--amber)_60%,var(--red))]",
  pdf: "bg-linear-135 from-red to-[color-mix(in_srgb,var(--red)_60%,var(--amber))]",
  text: "bg-linear-135 from-accent to-[color-mix(in_srgb,var(--accent)_60%,var(--blue))]",
  file: "bg-gray",
};
const extOf = (f: File) => (f.name.includes(".") ? f.name.split(".").pop()!.slice(0, 4).toUpperCase() : "FILE");

function FileCard({ file, onRemove }: { file: File; onRemove: () => void }) {
  const kind = kindOf(file);
  const url = useMemo(() => (kind === "image" ? URL.createObjectURL(file) : null), [file, kind]);
  useEffect(
    () => () => {
      if (url) URL.revokeObjectURL(url);
    },
    [url],
  );
  return (
    <li className="flex animate-card-in items-center gap-3 rounded-md border border-line bg-sheet p-2 shadow-card">
      <span
        aria-hidden="true"
        className={cx(
          "grid size-[42px] shrink-0 place-items-center overflow-hidden rounded-[10px] font-body text-[0.66rem] font-extrabold tracking-[0.04em] text-white [&_img]:size-full [&_img]:object-cover",
          TILE[kind],
        )}
      >
        {url ? <img src={url} alt="" /> : extOf(file)}
      </span>
      <span className="grid min-w-0 flex-1">
        <span className="truncate font-bold" title={file.name}>
          {file.name}
        </span>
        <span className="text-[0.8rem] text-gray tabular-nums">
          {size(file.size)} ·{" "}
          <span className="inline-flex items-center gap-[3px] font-bold text-green [&_svg]:size-[13px] [&_svg]:animate-tick-pop [&_svg]:stroke-3">
            <IconCheck /> Ready
          </span>
        </span>
      </span>
      <IconButton label={`Remove ${file.name}`} size="sm" variant="ghost" onClick={onRemove}>
        <IconX />
      </IconButton>
    </li>
  );
}

export function FileInput({
  label,
  help,
  hint,
  error,
  accept,
  multiple = false,
  files,
  onChange,
  title,
  description,
  buttonLabel = "Browse",
}: {
  label?: ReactNode;
  help?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  accept?: string;
  multiple?: boolean;
  files: File[];
  onChange: (files: File[]) => void;
  title?: ReactNode; // big line in the zone; default "Drop a file here" / "Drop files here"
  description?: ReactNode; // small line under it, e.g. "JSON · several files are merged into one pack"
  buttonLabel?: ReactNode;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const depth = useRef(0); // dragenter/leave fire for every child; count them
  const [over, setOver] = useState(false);

  const take = (list: FileList | null) => {
    const picked = [...(list ?? [])];
    if (!picked.length) return;
    onChange(multiple ? [...files, ...picked] : [picked[0]]);
  };
  const drag = {
    onDragEnter: (e: DragEvent) => {
      e.preventDefault();
      depth.current++;
      setOver(true);
    },
    onDragOver: (e: DragEvent) => e.preventDefault(),
    onDragLeave: () => {
      if (--depth.current <= 0) {
        depth.current = 0;
        setOver(false);
      }
    },
    onDrop: (e: DragEvent) => {
      e.preventDefault();
      depth.current = 0;
      setOver(false);
      take(e.dataTransfer.files);
    },
  };

  const compact = files.length > 0;
  const showZone = multiple || !compact;
  const big = title ?? (multiple ? "Drop files here" : "Drop a file here");

  return (
    <div className="grid gap-1.5">
      <FieldLabel htmlFor={id} label={label} help={help} />
      <input
        ref={input}
        id={id}
        type="file"
        accept={accept}
        multiple={multiple}
        className="sr-only"
        tabIndex={-1}
        aria-describedby={hint || error ? `${id}-msg` : undefined}
        onChange={(e) => {
          take(e.target.files);
          e.target.value = "";
        }}
      />

      {files.length > 0 && (
        <ul className="m-0 grid list-none gap-2 p-0" {...drag}>
          {files.map((f, i) => (
            <FileCard
              key={`${f.name}-${f.size}-${i}`}
              file={f}
              onRemove={() => onChange(files.filter((_, j) => j !== i))}
            />
          ))}
        </ul>
      )}

      {showZone ? (
        <div
          {...drag}
          className={cx(
            "group relative flex items-center transition-[border-color,transform,box-shadow,background-color] duration-200 ease-[cubic-bezier(0.2,0.8,0.2,1)]",
            compact
              ? "gap-2.5 rounded-md px-2.5 py-2"
              : "gap-4 rounded-lg px-5 py-[18px] max-[520px]:flex-wrap max-[520px]:[&>button]:w-full",
            over
              ? "special-border animate-flow-border -translate-y-0.5 scale-[1.01] border-2 shadow-[0_14px_30px_-18px_var(--special-b)] [--sp-inner:color-mix(in_srgb,var(--accent-soft)_70%,var(--sheet))] [&_*]:pointer-events-none"
              : cx(
                  "dot-grid border-[1.5px] border-dashed",
                  error ? "border-red" : "border-gray/45 hover:border-accent",
                ),
          )}
        >
          <span
            aria-hidden="true"
            className={cx(
              "grid shrink-0 place-items-center transition-[transform,background-color] duration-200 [&_svg]:animate-bob",
              compact ? "size-8 rounded-[10px] [&_svg]:size-4" : "size-12 rounded-[14px] [&_svg]:size-[22px]",
              over
                ? "special-fill -translate-y-[3px] [&_svg]:[animation-duration:0.7s]"
                : "bg-accent-soft text-accent group-hover:-translate-y-0.5 group-hover:-rotate-4",
            )}
          >
            <IconUpload />
          </span>
          <span className="grid min-w-0 flex-1 gap-0.5">
            <span
              className={
                compact ? "font-body text-[0.9rem] font-bold text-gray" : "font-display text-[1.02rem] font-bold"
              }
            >
              {over ? "Let go to add it" : compact ? "Add more" : txt(big)}
            </span>
            {!compact && description && <span className="text-[0.85rem] text-gray">{txt(description)}</span>}
          </span>
          <Button variant="soft" size={compact ? "sm" : "md"} onClick={() => input.current?.click()}>
            {buttonLabel}
          </Button>
        </div>
      ) : (
        <div className="flex">
          <Button variant="ghost" size="sm" onClick={() => input.current?.click()}>
            Choose a different file
          </Button>
        </div>
      )}

      <FieldMessage id={id} hint={hint} error={error} />
    </div>
  );
}
