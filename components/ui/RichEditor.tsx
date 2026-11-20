"use client";
// Text editor for markdown + LaTeX (the syntax Rich renders; see lib/markdown.ts).
// The toolbar edits the source text; Preview shows what it will look like.
// Every toolbar action is a single change, so Ctrl+Z undoes it.
// Pictures: pass `onAddImage` to allow uploads and pasting. It must store the file and return
// a reference like "img:<hash>" (never base64). Without it, only picture web addresses are allowed.

import { useId, useRef, useState, type ClipboardEvent, type KeyboardEvent, type ReactNode } from "react";
import {
  insertBlock,
  replaceSelection,
  replaceWithBlock,
  toggleLines,
  wrap,
  type Edit,
  type LineKind,
} from "@/lib/editing";
import { safeHref, safeImageSrc } from "@/lib/markdown";
import { imageProblem } from "@/lib/images";
import { Button, IconButton } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { FieldLabel, TextArea, TextField } from "@/components/ui/Field";
import { FileInput } from "@/components/ui/FileInput";
import { Rich } from "@/components/ui/Rich";
import { Segmented } from "@/components/ui/Segmented";
import { applyToTextarea } from "@/components/utils/textareaEdit";
import { Table } from "@/components/ui/Table";
import { Code, Text } from "@/components/ui/Text";
import { HelpDialog } from "@/components/ui/Tooltip";
import { cx } from "@/components/utils/cx";
import {
  IconBold,
  IconCode,
  IconCodeBlock,
  IconDivider,
  IconHeading,
  IconImage,
  IconItalic,
  IconLink,
  IconList,
  IconListNumbered,
  IconQuote,
  IconSigma,
  IconStrike,
  IconUnderline,
} from "@/components/icons";

/** Rows of the "Formatting help" dialog: what to type, and what it renders as (itself markdown). */
const FORMATTING: { code: string; result: string }[] = [
  { code: "**bold**", result: "**bold**" },
  { code: "*italic*", result: "*italic*" },
  { code: "++underline++", result: "++underline++" },
  { code: "~~strike~~", result: "~~strike~~" },
  { code: "`code`", result: "`code`" },
  { code: "$x^2$", result: "maths in a line: $x^2$" },
  { code: "$$ \\frac{a}{b} $$", result: "maths on its own line: $\\frac{a}{b}$" },
  { code: "[text](https://…)", result: "a link" },
  { code: "![description](img:…)", result: "a picture" },
  { code: "- item", result: "a bulleted list" },
  { code: "1. item", result: "a numbered list" },
  { code: "## Heading", result: "a heading" },
  { code: "> quote", result: "a quote" },
  { code: "---", result: "a divider line" },
  { code: "\\$", result: "a plain \\$ sign" },
];

type View = "write" | "preview" | "split";
type Sel = { start: number; end: number };

export function RichEditor({
  label,
  help,
  value,
  onChange,
  placeholder,
  hint,
  onAddImage,
  rows = 8,
  id,
}: {
  label?: ReactNode;
  help?: ReactNode;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: ReactNode;
  onAddImage?: (file: File) => Promise<string>;
  rows?: number;
  id?: string;
}) {
  const auto = useId();
  const fid = id ?? auto;
  const ref = useRef<HTMLTextAreaElement>(null);
  const [view, setView] = useState<View>("write");
  const [dialog, setDialog] = useState<null | "link" | "image" | "math">(null);
  const [saved, setSaved] = useState<Sel>({ start: 0, end: 0 });
  const [pasteError, setPasteError] = useState<string | null>(null);

  const sel = (): Sel => {
    const el = ref.current;
    return el ? { start: el.selectionStart, end: el.selectionEnd } : { start: value.length, end: value.length };
  };

  /** Applies one edit as a native, undoable change; falls back to onChange if the browser refuses. */
  const apply = (e: Edit) => applyToTextarea(ref.current, value, onChange, e);
  const run = (f: (text: string, s: number, e: number) => Edit) => {
    const s = sel();
    apply(f(value, s.start, s.end));
  };

  const bold = () => run((t, s, e) => wrap(t, s, e, "**", "**", "bold text"));
  const italic = () => run((t, s, e) => wrap(t, s, e, "*", "*", "italic text"));
  const underline = () => run((t, s, e) => wrap(t, s, e, "++", "++", "underlined text"));
  const strike = () => run((t, s, e) => wrap(t, s, e, "~~", "~~", "struck text"));
  const code = () => run((t, s, e) => wrap(t, s, e, "`", "`", "code"));
  const lines = (k: LineKind) => run((t, s, e) => toggleLines(t, s, e, k));
  const codeBlock = () => run((t, s, e) => insertBlock(t, s, e, "```\n", "\n```", "code"));
  const divider = () => run((t, s, e) => replaceWithBlock(t, s, e, "---"));
  const open = (d: "link" | "image" | "math") => {
    setSaved(sel());
    setDialog(d);
  };

  const tools: ({ label: string; key?: string; icon: ReactNode; act: () => void } | "|")[] = [
    { label: "Bold", key: "Ctrl+B", icon: <IconBold />, act: bold },
    { label: "Italic", key: "Ctrl+I", icon: <IconItalic />, act: italic },
    { label: "Underline", key: "Ctrl+U", icon: <IconUnderline />, act: underline },
    { label: "Strikethrough", icon: <IconStrike />, act: strike },
    "|",
    { label: "Heading", icon: <IconHeading />, act: () => lines("heading") },
    { label: "Bulleted list", icon: <IconList />, act: () => lines("bullet") },
    { label: "Numbered list", icon: <IconListNumbered />, act: () => lines("numbered") },
    { label: "Quote", icon: <IconQuote />, act: () => lines("quote") },
    { label: "Divider", icon: <IconDivider />, act: divider },
    "|",
    { label: "Link", key: "Ctrl+K", icon: <IconLink />, act: () => open("link") },
    { label: "Picture", icon: <IconImage />, act: () => open("image") },
    { label: "Maths (LaTeX)", key: "Ctrl+M", icon: <IconSigma />, act: () => open("math") },
    { label: "Inline code", key: "Ctrl+E", icon: <IconCode />, act: code },
    { label: "Code block", icon: <IconCodeBlock />, act: codeBlock },
  ];

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
    const k = e.key.toLowerCase();
    const map: Record<string, () => void> = {
      b: bold,
      i: italic,
      u: underline,
      e: code,
      k: () => open("link"),
      m: () => open("math"),
    };
    if (map[k]) {
      e.preventDefault();
      map[k]();
    }
  };

  const onPaste = async (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const file = [...e.clipboardData.files].find((f) => f.type.startsWith("image/"));
    if (!file || !onAddImage) return;
    e.preventDefault();
    const problem = imageProblem(file);
    if (problem) {
      setPasteError(problem);
      return;
    }
    setPasteError(null);
    const at = sel();
    try {
      const src = await onAddImage(file);
      apply(replaceSelection(at.start, at.end, `![pasted picture](${src})`));
    } catch {
      setPasteError("Could not save that picture. Try again.");
    }
  };

  const insertAtSaved = (s: string) => apply(replaceSelection(saved.start, saved.end, s));
  const selectedText = value.slice(saved.start, saved.end);
  const writing = view !== "preview";

  return (
    <div className="grid gap-1.5">
      <FieldLabel htmlFor={fid} label={label} help={help} />
      <div className="overflow-hidden rounded-md border-[1.5px] border-line bg-sheet transition-[border-color,box-shadow] duration-150 focus-within:border-accent focus-within:shadow-[0_0_0_3px_var(--accent-soft)]">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line-2 bg-sheet-2 px-2 py-1.5">
          <div
            className="flex flex-wrap items-center gap-0.5"
            role="toolbar"
            aria-label="Formatting"
            aria-controls={fid}
          >
            {tools.map((t, i) =>
              t === "|" ? (
                <span key={i} className="mx-1 h-5 w-px bg-line" aria-hidden="true" />
              ) : (
                <IconButton
                  key={t.label}
                  size="sm"
                  variant="ghost"
                  disabled={!writing}
                  onClick={t.act}
                  label={t.key ? `${t.label} (${t.key})` : t.label}
                >
                  {t.icon}
                </IconButton>
              ),
            )}
          </div>
          <Segmented
            size="sm"
            label="Editor view"
            value={view}
            onChange={setView}
            segments={[
              { value: "write", label: "Write" },
              { value: "preview", label: "Preview" },
              { value: "split", label: "Both" },
            ]}
          />
        </div>

        <div className={cx("grid", view === "split" && "grid-cols-2 max-[720px]:grid-cols-1")}>
          <textarea
            ref={ref}
            id={fid}
            className="min-h-[170px] w-full resize-y border-0 bg-sheet px-3.5 py-3 font-mono text-[0.95rem] leading-[1.6] text-ink focus:outline-none"
            rows={rows}
            value={value}
            placeholder={placeholder}
            hidden={!writing}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={onKeyDown}
            onPaste={onPaste}
            aria-describedby={`${fid}-help`}
            spellCheck
          />
          {view !== "write" && (
            <div
              aria-label="Preview"
              className={cx(
                "min-h-[170px] overflow-auto px-3.5 py-3",
                view === "split" && "border-l border-line-2 max-[720px]:border-t max-[720px]:border-l-0",
              )}
            >
              {value.trim() ? <Rich text={value} block /> : <Text variant="hint">Nothing to preview yet.</Text>}
            </div>
          )}
        </div>

        <div
          className="flex flex-wrap items-start justify-between gap-3 border-t border-line-2 px-3 py-2 text-[0.82rem] text-gray"
          id={`${fid}-help`}
        >
          {pasteError ? (
            <Text variant="error" as="span">
              {pasteError}
            </Text>
          ) : (
            <Text variant="hint" as="span">
              {hint ?? "Markdown and $\\LaTeX$ are supported."}
            </Text>
          )}
          <HelpDialog title="Formatting help" label="Formatting help">
            <Text variant="muted">
              Type these into the editor, or use the toolbar buttons. Both give the same result.
            </Text>
            <Table
              caption="Formatting help"
              rowKey={(r) => r.code}
              columns={[
                { key: "type", header: "You type", cell: (r) => <Code>{r.code}</Code> },
                { key: "get", header: "You get", cell: (r) => r.result },
              ]}
              rows={FORMATTING}
            />
          </HelpDialog>
        </div>
      </div>

      <LinkDialog
        open={dialog === "link"}
        initialText={selectedText}
        onClose={() => setDialog(null)}
        onInsert={(md) => {
          setDialog(null);
          insertAtSaved(md);
        }}
      />
      <ImageDialog
        open={dialog === "image"}
        onAddImage={onAddImage}
        onClose={() => setDialog(null)}
        onInsert={(md) => {
          setDialog(null);
          insertAtSaved(md);
        }}
      />
      <MathDialog
        open={dialog === "math"}
        initialTex={selectedText}
        onClose={() => setDialog(null)}
        onInsert={(tex, display) => {
          setDialog(null);
          apply(
            display
              ? replaceWithBlock(value, saved.start, saved.end, `$$\n${tex}\n$$`)
              : replaceSelection(saved.start, saved.end, `$${tex}$`),
          );
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------

/** Escapes characters that would end the link text or picture description early. */
const escText = (s: string) => s.replace(/([\\[\]])/g, "\\$1");

function LinkDialog({
  open,
  initialText,
  onClose,
  onInsert,
}: {
  open: boolean;
  initialText: string;
  onClose: () => void;
  onInsert: (md: string) => void;
}) {
  return open ? <LinkForm initialText={initialText} onClose={onClose} onInsert={onInsert} /> : null;
}

function LinkForm({
  initialText,
  onClose,
  onInsert,
}: {
  initialText: string;
  onClose: () => void;
  onInsert: (md: string) => void;
}) {
  const [text, setText] = useState(initialText);
  const [url, setUrl] = useState("");
  const [tried, setTried] = useState(false);
  const href = safeHref(url);
  const submit = () => {
    setTried(true);
    if (!href) return;
    onInsert(`[${escText(text.trim() || url.trim())}](${href})`);
  };
  return (
    <Dialog
      open
      onClose={onClose}
      title="Add a link"
      footer={
        <>
          <Button variant="soft" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit}>
            Add link
          </Button>
        </>
      }
    >
      <TextField
        label="Text to show"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="e.g. Lecture notes"
      />
      <TextField
        label="Web address"
        value={url}
        autoFocus
        onChange={(e) => setUrl(e.target.value)}
        placeholder="https://…"
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
        }}
        error={tried && !href ? "Use a full address starting with https://" : undefined}
      />
    </Dialog>
  );
}

function ImageDialog({
  open,
  onAddImage,
  onClose,
  onInsert,
}: {
  open: boolean;
  onAddImage?: (file: File) => Promise<string>;
  onClose: () => void;
  onInsert: (md: string) => void;
}) {
  return open ? <ImageForm onAddImage={onAddImage} onClose={onClose} onInsert={onInsert} /> : null;
}

function ImageForm({
  onAddImage,
  onClose,
  onInsert,
}: {
  onAddImage?: (file: File) => Promise<string>;
  onClose: () => void;
  onInsert: (md: string) => void;
}) {
  const [mode, setMode] = useState<"upload" | "web">(onAddImage ? "upload" : "web");
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState("");
  const [alt, setAlt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError(null);
    const desc = escText(alt.trim() || "picture");
    if (mode === "web") {
      const src = safeImageSrc(url);
      if (!src) {
        setError("Use a full picture address starting with https://");
        return;
      }
      onInsert(`![${desc}](${src})`);
      return;
    }
    if (!file || !onAddImage) {
      setError("Choose a picture first.");
      return;
    }
    const problem = imageProblem(file);
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    try {
      onInsert(`![${desc}](${await onAddImage(file)})`);
    } catch {
      setError("Could not save that picture. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title="Add a picture"
      footer={
        <>
          <Button variant="soft" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" loading={busy} onClick={submit}>
            Add picture
          </Button>
        </>
      }
    >
      {onAddImage && (
        <Segmented
          label="Picture source"
          value={mode}
          onChange={setMode}
          segments={[
            { value: "upload", label: "From this device" },
            { value: "web", label: "From a web address" },
          ]}
        />
      )}
      {mode === "upload" ? (
        <FileInput
          label="Picture file"
          accept="image/*"
          files={file ? [file] : []}
          title="Drop a picture here"
          description="PNG, JPG, GIF, WebP or SVG · up to 5 MB"
          onChange={(fs) => {
            setFile(fs[0] ?? null);
            setError(null);
          }}
          hint="You can also paste a picture straight into the editor."
        />
      ) : (
        <TextField
          label="Picture address"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://…/graph.png"
        />
      )}
      <TextField
        label="Short description"
        value={alt}
        onChange={(e) => setAlt(e.target.value)}
        placeholder="e.g. Graph of y = x²"
        hint="Read out by screen readers, and shown if the picture can't load."
      />
      {error && <Text variant="error">{error}</Text>}
    </Dialog>
  );
}

function MathDialog({
  open,
  initialTex,
  onClose,
  onInsert,
}: {
  open: boolean;
  initialTex: string;
  onClose: () => void;
  onInsert: (tex: string, display: boolean) => void;
}) {
  return open ? <MathForm initialTex={initialTex} onClose={onClose} onInsert={onInsert} /> : null;
}

function MathForm({
  initialTex,
  onClose,
  onInsert,
}: {
  initialTex: string;
  onClose: () => void;
  onInsert: (tex: string, display: boolean) => void;
}) {
  const [tex, setTex] = useState(initialTex.replace(/^\$+|\$+$/g, ""));
  const [display, setDisplay] = useState<"inline" | "display">("inline");
  const t = tex.trim();
  return (
    <Dialog
      open
      onClose={onClose}
      title="Add maths"
      footer={
        <>
          <Button variant="soft" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" disabled={!t} onClick={() => onInsert(t, display === "display")}>
            Add maths
          </Button>
        </>
      }
    >
      <Segmented
        label="Where the maths goes"
        value={display}
        onChange={setDisplay}
        segments={[
          { value: "inline", label: "In the line" },
          { value: "display", label: "On its own line" },
        ]}
      />
      <TextArea
        label="LaTeX"
        value={tex}
        autoFocus
        rows={3}
        onChange={(e) => setTex(e.target.value)}
        placeholder="\frac{a}{b} + \sqrt{x}"
        className="[&_textarea]:min-h-20 [&_textarea]:font-mono"
        hint="Type LaTeX without the $ signs."
      />
      <div
        className="grid min-h-[70px] gap-1.5 rounded-md border-[1.5px] border-dashed border-line px-3.5 py-3"
        aria-live="polite"
      >
        <Text variant="caption" as="span">
          Preview
        </Text>
        {t ? (
          <Rich text={display === "display" ? `$$${t}$$` : `$${t}$`} block />
        ) : (
          <Text variant="hint" as="span">
            Your maths will appear here.
          </Text>
        )}
      </div>
    </Dialog>
  );
}
