"use client";
// Code editor: syntax highlighting, line numbers, indent guides and smart indentation, with a
// language picker above it.
//   Enter       keeps the indent; one level more after ":" (Python) or { ( [
//   Tab         indent (every selected line, or to the next stop)
//   Shift+Tab   outdent
//   Backspace   in leading spaces removes a whole indent level
//   } ) ]       typed on an empty indented line outdents it
// Every one of these is a single native change, so Ctrl+Z undoes it.
// How it works: a transparent <textarea> (caret, selection, typing) sits exactly on top of a
// highlighted <pre> and an indent-guide layer that scroll with it. That overlay must line up to the pixel,
// so it is plain CSS (the ui-ce-* rules in styles/code-editor.css); the toolbar and frame are utilities.

import { useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { INDENT, backspace, indent, indentLevels, newline, typeCloser, type CodeLang } from "@/lib/codeIndent";
import { Dropdown } from "@/components/ui/Dropdown";
import { FieldLabel, FieldMessage } from "@/components/ui/Field";
import { highlight } from "@/components/utils/highlight";
import { applyToTextarea } from "@/components/utils/textareaEdit";
import { cx } from "@/components/utils/cx";

export const CODE_LANGS: { value: CodeLang; label: string }[] = [
  { value: "python", label: "Python" },
  { value: "c", label: "C" },
  { value: "cpp", label: "C++" },
  { value: "java", label: "Java" },
  { value: "javascript", label: "JavaScript" },
  { value: "sql", label: "SQL" },
  { value: "text", label: "Plain text" },
];

export function CodeEditor({
  label,
  help,
  hint,
  error,
  value,
  onChange,
  language,
  onLanguageChange,
  defaultLanguage = "python",
  showLanguage = true,
  rows = 10,
  readOnly = false,
  id,
}: {
  label?: ReactNode;
  help?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  value: string;
  onChange: (v: string) => void;
  language?: CodeLang;
  onLanguageChange?: (l: CodeLang) => void;
  defaultLanguage?: CodeLang;
  showLanguage?: boolean;
  rows?: number;
  readOnly?: boolean;
  id?: string;
}) {
  const auto = useId();
  const fid = id ?? auto;
  const [ownLang, setOwnLang] = useState<CodeLang>(defaultLanguage);
  const lang = language ?? ownLang;
  const setLang = (l: CodeLang) => {
    setOwnLang(l);
    onLanguageChange?.(l);
  };
  const size = INDENT[lang];

  const ta = useRef<HTMLTextAreaElement>(null);
  const layer = useRef<HTMLDivElement>(null);
  const gutter = useRef<HTMLDivElement>(null);

  const html = useMemo(() => highlight(value, lang), [value, lang]);
  const levels = useMemo(() => indentLevels(value, size), [value, size]);

  const sync = () => {
    const el = ta.current;
    if (!el) return;
    if (layer.current) layer.current.style.transform = `translate(${-el.scrollLeft}px, ${-el.scrollTop}px)`;
    if (gutter.current) gutter.current.style.transform = `translateY(${-el.scrollTop}px)`;
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (readOnly || e.ctrlKey || e.metaKey || e.altKey) return;
    const el = e.currentTarget;
    const { selectionStart: s, selectionEnd: en } = el;
    let edit = null;
    if (e.key === "Enter") edit = newline(value, s, en, lang);
    else if (e.key === "Tab") edit = indent(value, s, en, lang, e.shiftKey ? -1 : 1);
    else if (e.key === "Backspace") edit = backspace(value, s, en, lang);
    else if (e.key.length === 1) edit = typeCloser(value, s, en, e.key, lang);
    if (!edit) return;
    e.preventDefault();
    applyToTextarea(el, value, onChange, edit);
  };

  return (
    <div className="grid gap-1.5">
      <FieldLabel htmlFor={fid} label={label} help={help} />
      <div className={cx("ui-ce", !!error && "is-error")}>
        {showLanguage && (
          <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-t-[calc(var(--r-md)-2px)] border-b border-line bg-sheet-2 px-2.5 py-2">
            <div className="w-[170px]">
              <Dropdown size="sm" value={lang} onChange={(v) => setLang(v as CodeLang)} options={CODE_LANGS} />
            </div>
            <span className="text-[0.8rem] text-gray">Tab indents · Shift+Tab outdents · {size} spaces per level</span>
          </div>
        )}
        <div className="ui-ce-body" style={{ height: `calc(${rows} * var(--ce-lh) + 2 * var(--ce-pad))` }}>
          <div className="ui-ce-gutter" aria-hidden="true">
            <div ref={gutter} className="ui-ce-move">
              {levels.map((_, i) => (
                <div key={i}>{i + 1}</div>
              ))}
            </div>
          </div>
          <div className="ui-ce-code">
            <div className="ui-ce-layer" aria-hidden="true">
              <div ref={layer} className="ui-ce-move">
                <div className="ui-ce-guides">
                  {levels.map((n, i) => (
                    <div key={i} className="ui-ce-gline">
                      {Array.from({ length: n }, (_, k) => (
                        <span key={k} style={{ left: `${k * size}ch` }} />
                      ))}
                    </div>
                  ))}
                </div>
                <pre className="ui-ce-pre">
                  <code className="hljs" dangerouslySetInnerHTML={{ __html: html + "\n" }} />
                </pre>
              </div>
            </div>
            <textarea
              ref={ta}
              id={fid}
              className="ui-ce-input"
              value={value}
              readOnly={readOnly}
              wrap="off"
              spellCheck={false}
              autoCapitalize="off"
              autoComplete="off"
              autoCorrect="off"
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={onKeyDown}
              onScroll={sync}
              aria-describedby={hint || error ? `${fid}-msg` : undefined}
              aria-invalid={error ? true : undefined}
            />
          </div>
        </div>
      </div>
      <FieldMessage id={fid} hint={hint} error={error} />
    </div>
  );
}
