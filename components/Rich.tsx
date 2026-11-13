"use client";
import React from "react";
import { renderMath, parseFence, segments } from "@/lib/tex";
import { highlightCode } from "@/lib/highlight";
import { splitImages } from "@/lib/images";
import Img from "./Img";
import { parseRich, RNode, hasMarkup } from "@/lib/richText";

function renderSeg(s: { kind: string; value: string }, i: number | string): React.ReactNode {
  if (s.kind === "code") {
    const { lang, code } = parseFence(s.value);
    const html = highlightCode(code, lang);
    return html !== null
      ? <pre key={i} className="code" data-lang={lang}><code className="hljs" dangerouslySetInnerHTML={{ __html: html }} /></pre>
      : <pre key={i} className="code" data-lang={lang || undefined}><code>{code}</code></pre>;
  }
  if (s.kind === "icode") return <code key={i} className="icode">{s.value}</code>;
  if (s.kind === "display") return <span key={i} className="math-block" dangerouslySetInnerHTML={{ __html: renderMath(s.value, true) }} />;
  if (s.kind === "inline") return <span key={i} dangerouslySetInnerHTML={{ __html: renderMath(s.value, false) }} />;
  return (
    <React.Fragment key={i}>
      {splitImages(s.value).map((part, k) => "src" in part
        ? <Img key={k} src={part.src} alt={part.alt} />
        : part.text.replace(/&lt;/g, "<").split("\n").map((line, j, arr) => <React.Fragment key={`${k}-${j}`}>{line}{j < arr.length - 1 && <br />}</React.Fragment>))}
    </React.Fragment>
  );
}

function renderNode(n: RNode, i: number): React.ReactNode {
  if (n.t === "seg") return renderSeg(n.seg, i);
  const kids = n.kids.map(renderNode);
  switch (n.tag) {
    case "b": return <strong key={i}>{kids}</strong>;
    case "i": return <em key={i}>{kids}</em>;
    case "u": return <u key={i}>{kids}</u>;
    case "a": return n.href ? <a key={i} href={n.href} target="_blank" rel="noopener noreferrer" className="rich-a">{kids}</a> : <span key={i}>{kids}</span>;
    case "ul": return <ul key={i} className="rich-list">{kids}</ul>;
    case "ol": return <ol key={i} className="rich-list">{kids}</ol>;
    default: return <li key={i}>{kids}</li>;
  }
}

// Renders text with $inline math$, $$display math$$ and ```code blocks```. Maths is LaTeX (KaTeX). A literal dollar sign is written \$.
// Plus <b>, <i>, <u>, <a href> and <ul>/<ol>/<li> (see lib/richText.ts).
export default function Rich({ text, className }: { text: string; className?: string }) {
  if (!hasMarkup(text)) return <span className={className}>{segments(text).map((s, i) => renderSeg(s, i))}</span>;
  return <span className={className}>{parseRich(text).map(renderNode)}</span>;
}
