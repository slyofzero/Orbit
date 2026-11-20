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
import { useImageResolver, type ImageResolver } from "@/components/utils/images";
import { cx } from "@/components/utils/cx";
import { Divider } from "@/components/ui/Divider";
import { Link } from "@/components/ui/Link";

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

const INLINE = "wrap-anywhere [&_u]:decoration-[1.5px] [&_u]:underline-offset-[3px]";
const HEADING = ["text-[1.2rem]", "text-[1.05rem]", "text-[0.95rem]"];
const IMG = "h-auto max-w-full rounded-sm my-1";

export function Rich({ text, block = false, className }: { text: string; block?: boolean; className?: string }) {
  const resolve = useImageResolver();
  if (!block) {
    const nodes = cached(inlineCache, text, () => parseInline(text));
    if (!className && nodes.length <= 1 && (nodes.length === 0 || nodes[0].t === "text")) {
      return <>{nodes.length ? (nodes[0] as { v: string }).v : null}</>; // plain text: no wrapper at all
    }
    return <span className={cx(INLINE, className)}>{inlines(nodes, resolve, false)}</span>;
  }
  const blocks = cached(blockCache, text, () => parseMarkdown(text));
  return (
    <div className={cx(INLINE, "grid gap-2.5", className)}>
      {blocks.map((b, i) => (
        <Fragment key={i}>{blockNode(b, resolve)}</Fragment>
      ))}
    </div>
  );
}

function math(tex: string, display: boolean, key?: number, inBlock = false) {
  const html = cached(mathCache, (display ? "D" : "I") + tex, () =>
    katex.renderToString(tex, { displayMode: display, throwOnError: false, output: "htmlAndMathml" }),
  );
  return (
    <span
      key={key}
      dangerouslySetInnerHTML={{ __html: html }}
      className={
        display
          ? cx("block overflow-x-auto overflow-y-hidden text-center whitespace-normal", inBlock ? "m-0" : "my-2.5")
          : undefined
      }
    />
  );
}

function blockNode(b: Block, r: ImageResolver): ReactNode {
  switch (b.t) {
    case "p":
      return <p>{inlines(b.c, r, true)}</p>;
    case "h": {
      const H = (["h3", "h4", "h5"] as const)[b.level - 1]; // headings inside content stay below page headings
      return (
        <H className={cx("mt-1 font-display leading-[1.2] font-bold", HEADING[b.level - 1])}>{inlines(b.c, r, true)}</H>
      );
    }
    case "ul":
      return (
        <ul className="grid list-disc gap-1 pl-[1.4em]">
          {b.items.map((it, i) => (
            <li key={i}>{inlines(it, r, true)}</li>
          ))}
        </ul>
      );
    case "ol":
      return (
        <ol className="grid list-decimal gap-1 pl-[1.4em]" start={b.start}>
          {b.items.map((it, i) => (
            <li key={i}>{inlines(it, r, true)}</li>
          ))}
        </ol>
      );
    case "quote":
      return (
        <blockquote className="grid gap-2 rounded-r-sm border-l-[3px] border-accent bg-sheet-2 px-3.5 py-2 text-ink-2">
          {b.c.map((x, i) => (
            <Fragment key={i}>{blockNode(x, r)}</Fragment>
          ))}
        </blockquote>
      );
    case "code":
      return (
        <pre
          data-lang={b.lang || undefined}
          className="overflow-x-auto rounded-md bg-code-bg px-3.5 py-3 font-mono text-[0.9rem] leading-[1.55] text-code-fg [&_code]:bg-transparent [&_code]:p-0 [&_code]:[font-size:inherit] [&_code]:text-inherit"
        >
          <code>{b.v}</code>
        </pre>
      );
    case "math":
      return <div className="overflow-x-auto overflow-y-hidden">{math(b.v, true, undefined, true)}</div>;
    case "hr":
      return <Divider />;
  }
}

/** `blk` = inside block markdown (pictures then sit on their own line). */
function inlines(nodes: Inline[], r: ImageResolver, blk: boolean): ReactNode[] {
  return nodes.map((n, i) => {
    switch (n.t) {
      case "text":
        return <Fragment key={i}>{n.v}</Fragment>;
      case "br":
        return <br key={i} />;
      case "strong":
        return <strong key={i}>{inlines(n.c, r, blk)}</strong>;
      case "em":
        return <em key={i}>{inlines(n.c, r, blk)}</em>;
      case "u":
        return <u key={i}>{inlines(n.c, r, blk)}</u>;
      case "del":
        return <del key={i}>{inlines(n.c, r, blk)}</del>;
      case "code":
        return <code key={i}>{n.v}</code>;
      case "math":
        return math(n.v, n.display, i);
      case "link":
        return (
          <Link key={i} href={n.href}>
            {inlines(n.c, r, blk)}
          </Link>
        );
      case "img": {
        const hash = refToHash(n.src);
        const url = hash ? r(hash) : n.src;
        if (!url)
          return (
            <span
              key={i}
              className="inline-flex rounded-sm border-[1.5px] border-dashed border-line px-2.5 py-1 text-[0.85rem] text-gray"
              role="img"
              aria-label={`Missing picture: ${n.alt}`}
            >
              🖼 Picture not found{n.alt ? `: ${n.alt}` : ""}
            </span>
          );
        // eslint-disable-next-line @next/next/no-img-element
        return (
          <img
            key={i}
            className={cx(IMG, blk ? "block" : "inline-block align-middle")}
            src={url}
            alt={n.alt}
            loading="lazy"
            decoding="async"
          />
        );
      }
    }
  });
}
