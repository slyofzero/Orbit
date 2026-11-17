// txt(): renders text as markdown + LaTeX (inline). Shared components call it on every piece of
// text they display.
//
// Deliberately NOT a "use client" module: server components (Heading, Text, Link, Card…) call it
// while rendering. It only RETURNS <Rich> elements, and rendering a client component from the
// server is allowed; calling a function that lives in a client module is not.
//
//   - a string → rendered
//   - an array of strings/numbers (JSX like `Score: {n}%` arrives as ["Score: ", 7, "%"]) → joined, then rendered
//   - a mixed array (text + elements) → each string part rendered, elements kept
//   - anything else (an element, a number) → unchanged

import { Fragment, type ReactNode } from "react";
import { Rich } from "./Rich";

export function txt(node: ReactNode): ReactNode {
  if (typeof node === "string") return <Rich text={node} />;
  if (Array.isArray(node)) {
    if (node.every((c) => typeof c === "string" || typeof c === "number")) return <Rich text={node.join("")} />;
    return node.map((c, i) => <Fragment key={i}>{typeof c === "string" ? <Rich text={c} /> : c}</Fragment>);
  }
  return node;
}
