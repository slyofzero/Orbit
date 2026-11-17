"use client";
// Renders text written in markdown + LaTeX (see lib/markdown.ts for the syntax).
// ALL user-visible text in Orbit renders through this. Shared components (components/ui,
// components/question) do it automatically for every string prop via `txt()`; in your own JSX,
// wrap text in <Rich text={…} /> (or call txt()).
//   block  (default false): full markdown: paragraphs, headings, lists, quotes, code blocks.
//   inline:                 one run of text (labels, cells, options): bold, maths, links… no lists or headings.
// Everything renders as React elements; raw HTML in the text is shown as text, never run.
//
// Cost: plain text skips parsing entirely; parsed text and rendered maths are cached, so the same
// label or formula is only ever processed once (measured: ~2 µs to parse a label, ~50 µs per new formula).

import { Fragment, type ReactNode } from "react";
import katex from "katex";
import { parseInline, parseMarkdown, type Block, type Inline } from "@/lib/markdown";
import { refToHash } from "@/lib/images";
import { useImageResolver, type ImageResolver } from "./images";
import { cx } from "./cx";
import { Divider } from "./Divider";
import { Link } from "./Link";

// Small caches. Cleared wholesale when full: cheap, and the hot entries come straight back.
const CAP = 3000;
const inlineCache = new Map<string, Inline[]>();
const blockCache = new Map<string, Block[]>();
const mathCache = new Map<string, string>();
function cached<V>(m: Map<string, V>, key: string, make: () => V): V {
  let v = m.get(key);
  if (v === undefined) {
    if (m.size >= CAP) m.clear();
    v = make();
    m.set(key, v);
  }
  return v;
}

export function Rich({ text, block = false, className }: { text: string; block?: boolean; className?: string }) {
  const resolve = useImageResolver();
  if (!block) {
    const nodes = cached(inlineCache, text, () => parseInline(text));
    if (!className && nodes.length <= 1 && (nodes.length === 0 || nodes[0].t === "text")) {
      return <>{nodes.length ? (nodes[0] as { v: string }).v : null}</>;   // plain text: no wrapper at all
    }
    return <span className={cx("ui-rich", className)}>{inlines(nodes, resolve)}</span>;
  }
  const blocks = cached(blockCache, text, () => parseMarkdown(text));
  return <div className={cx("ui-rich ui-md", className)}>{blocks.map((b, i) => <Fragment key={i}>{blockNode(b, resolve)}</Fragment>)}</div>;
}

function math(tex: string, display: boolean, key?: number) {
  const html = cached(mathCache, (display ? "D" : "I") + tex,
    () => katex.renderToString(tex, { displayMode: display, throwOnError: false, output: "htmlAndMathml" }));
  return <span key={key} className={display ? "ui-rich-display" : undefined} dangerouslySetInnerHTML={{ __html: html }} />;
}

function blockNode(b: Block, r: ImageResolver): ReactNode {
  switch (b.t) {
    case "p": return <p>{inlines(b.c, r)}</p>;
    case "h": {
      const H = (["h3", "h4", "h5"] as const)[b.level - 1];   // headings inside content stay below page headings
      return <H className="ui-md-h">{inlines(b.c, r)}</H>;
    }
    case "ul": return <ul>{b.items.map((it, i) => <li key={i}>{inlines(it, r)}</li>)}</ul>;
    case "ol": return <ol start={b.start}>{b.items.map((it, i) => <li key={i}>{inlines(it, r)}</li>)}</ol>;
    case "quote": return <blockquote>{b.c.map((x, i) => <Fragment key={i}>{blockNode(x, r)}</Fragment>)}</blockquote>;
    case "code": return <pre className="ui-md-pre" data-lang={b.lang || undefined}><code>{b.v}</code></pre>;
    case "math": return <div className="ui-md-math">{math(b.v, true)}</div>;
    case "hr": return <Divider />;
  }
}

function inlines(nodes: Inline[], r: ImageResolver): ReactNode[] {
  return nodes.map((n, i) => {
    switch (n.t) {
      case "text": return <Fragment key={i}>{n.v}</Fragment>;
      case "br": return <br key={i} />;
      case "strong": return <strong key={i}>{inlines(n.c, r)}</strong>;
      case "em": return <em key={i}>{inlines(n.c, r)}</em>;
      case "u": return <u key={i}>{inlines(n.c, r)}</u>;
      case "del": return <del key={i}>{inlines(n.c, r)}</del>;
      case "code": return <code key={i}>{n.v}</code>;
      case "math": return math(n.v, n.display, i);
      case "link": return <Link key={i} href={n.href}>{inlines(n.c, r)}</Link>;
      case "img": {
        const hash = refToHash(n.src);
        const url = hash ? r(hash) : n.src;
        if (!url) return <span key={i} className="ui-md-missing" role="img" aria-label={`Missing picture: ${n.alt}`}>🖼 Picture not found{n.alt ? `: ${n.alt}` : ""}</span>;
        // eslint-disable-next-line @next/next/no-img-element
        return <img key={i} className="ui-md-img" src={url} alt={n.alt} loading="lazy" decoding="async" />;
      }
    }
  });
}
