"use client";
import React from "react";
import { renderMath, segments } from "@/lib/tex";
import { splitImages } from "@/lib/images";
import Img from "./Img";

// Renders text with $inline math$, $$display math$$ and ```code blocks```. Maths is LaTeX (KaTeX). A literal dollar sign is written \$.
export default function Rich({ text, className }: { text: string; className?: string }) {
  return (
    <span className={className}>
      {segments(text).map((s, i) => {
        if (s.kind === "code") {
          const code = s.value.replace(/^```\w*\n?/, "").replace(/```$/, "").replace(/\n$/, "");
          return <pre key={i} className="code"><code>{code}</code></pre>;
        }
        if (s.kind === "display") return <span key={i} className="math-block" dangerouslySetInnerHTML={{ __html: renderMath(s.value, true) }} />;
        if (s.kind === "inline") return <span key={i} dangerouslySetInnerHTML={{ __html: renderMath(s.value, false) }} />;
        return (
          <React.Fragment key={i}>
            {splitImages(s.value).map((part, k) => "src" in part
              ? <Img key={k} src={part.src} alt={part.alt} />
              : part.text.split("\n").map((line, j, arr) => <React.Fragment key={`${k}-${j}`}>{line}{j < arr.length - 1 && <br />}</React.Fragment>))}
          </React.Fragment>
        );
      })}
    </span>
  );
}
