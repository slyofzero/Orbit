"use client";
import katex from "katex";
import React from "react";

function math(src: string, display: boolean) {
  return katex.renderToString(src, { displayMode: display, throwOnError: false });
}

function inline(text: string, keyBase: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const parts = text.split(/(\$\$[\s\S]+?\$\$|\$[^$\n]+?\$)/g);
  parts.forEach((p, i) => {
    if (!p) return;
    if (p.startsWith("$$")) out.push(<span key={keyBase + i} className="math-block" dangerouslySetInnerHTML={{ __html: math(p.slice(2, -2), true) }} />);
    else if (p.startsWith("$")) out.push(<span key={keyBase + i} dangerouslySetInnerHTML={{ __html: math(p.slice(1, -1), false) }} />);
    else
      p.split("\n").forEach((line, j, arr) => {
        out.push(<React.Fragment key={`${keyBase}${i}-${j}`}>{line}{j < arr.length - 1 && <br />}</React.Fragment>);
      });
  });
  return out;
}

// Renders text with $inline math$, $$display math$$ and ```code blocks```.
export default function Rich({ text, className }: { text: string; className?: string }) {
  const chunks = text.split(/(```[\s\S]*?```)/g);
  return (
    <span className={className}>
      {chunks.map((c, i) => {
        if (c.startsWith("```")) {
          const code = c.replace(/^```\w*\n?/, "").replace(/```$/, "").replace(/\n$/, "");
          return (
            <pre key={i} className="code">
              <code>{code}</code>
            </pre>
          );
        }
        return <React.Fragment key={i}>{inline(c, `c${i}-`)}</React.Fragment>;
      })}
    </span>
  );
}
