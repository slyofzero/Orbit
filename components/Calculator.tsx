"use client";
import { useState } from "react";

// Small recursive-descent evaluator (no eval). Supports + - * / ^, parentheses, sin cos tan log ln sqrt exp, pi, e.
function evaluate(src: string, deg: boolean): number {
  const s = src.replace(/÷/g, "/").replace(/×/g, "*").replace(/−/g, "-").replace(/π/g, "pi").replace(/√/g, "sqrt");
  const tokens = s.match(/\d+\.?\d*|\.\d+|[a-z]+|[+\-*/^()]/g) ?? [];
  let pos = 0;
  const peek = () => tokens[pos];
  const next = () => tokens[pos++];
  const toRad = (x: number) => (deg ? (x * Math.PI) / 180 : x);

  function expr(): number {
    let v = term();
    while (peek() === "+" || peek() === "-") v = next() === "+" ? v + term() : v - term();
    return v;
  }
  function term(): number {
    let v = unary();
    while (peek() === "*" || peek() === "/") v = next() === "*" ? v * unary() : v / unary();
    return v;
  }
  function unary(): number {
    if (peek() === "-") { next(); return -unary(); }
    if (peek() === "+") { next(); return unary(); }
    return power();
  }
  function power(): number {
    const base = primary();
    if (peek() === "^") { next(); return Math.pow(base, unary()); }
    return base;
  }
  function primary(): number {
    const t = next();
    if (t === undefined) throw new Error("incomplete");
    if (t === "(") { const v = expr(); if (next() !== ")") throw new Error("missing )"); return v; }
    if (/^[\d.]/.test(t)) return parseFloat(t);
    if (t === "pi") return Math.PI;
    if (t === "e") return Math.E;
    const fns: Record<string, (x: number) => number> = {
      sin: (x) => Math.sin(toRad(x)), cos: (x) => Math.cos(toRad(x)), tan: (x) => Math.tan(toRad(x)),
      log: Math.log10, ln: Math.log, sqrt: Math.sqrt, exp: Math.exp,
    };
    if (fns[t]) {
      if (next() !== "(") throw new Error("expected (");
      const v = expr();
      if (next() !== ")") throw new Error("missing )");
      return fns[t](v);
    }
    throw new Error("bad token");
  }
  const v = expr();
  if (pos < tokens.length) throw new Error("extra input");
  return v;
}

const KEYS: [string, string][][] = [
  [["sin", "sin("], ["cos", "cos("], ["tan", "tan("], ["log", "log("], ["ln", "ln("]],
  [["√", "sqrt("], ["x²", "^2"], ["^", "^"], ["(", "("], [")", ")"]],
  [["7", "7"], ["8", "8"], ["9", "9"], ["÷", "/"], ["⌫", "BS"]],
  [["4", "4"], ["5", "5"], ["6", "6"], ["×", "*"], ["C", "C"]],
  [["1", "1"], ["2", "2"], ["3", "3"], ["−", "-"], ["π", "pi"]],
  [["0", "0"], [".", "."], ["e", "e"], ["+", "+"], ["=", "="]],
];

export default function Calculator({ onClose }: { onClose: () => void }) {
  const [expr, setExpr] = useState("");
  const [res, setRes] = useState("");
  const [deg, setDeg] = useState(true);

  const press = (k: string) => {
    if (k === "C") { setExpr(""); setRes(""); return; }
    if (k === "BS") { setExpr((e) => e.replace(/(sin\(|cos\(|tan\(|log\(|ln\(|sqrt\(|pi|.)$/, "")); return; }
    if (k === "=") {
      try {
        const v = evaluate(expr, deg);
        setRes(Number.isFinite(v) ? String(parseFloat(v.toPrecision(12))) : "Error");
      } catch { setRes("Error"); }
      return;
    }
    setExpr((e) => e + k);
  };

  return (
    <div className="calc">
      <div className="calc-head">
        <b>Scientific Calculator</b>
        <span>
          <label style={{ marginRight: 10 }}><input type="checkbox" checked={deg} onChange={(e) => setDeg(e.target.checked)} /> Deg</label>
          <span style={{ cursor: "pointer" }} onClick={onClose}>✕</span>
        </span>
      </div>
      <div className="calc-screen">
        <div className="small">{expr || "0"}</div>
        <div className="res">{res}</div>
      </div>
      <div className="calc-keys">
        {KEYS.flat().map(([label, val]) => (
          <button key={label} className={label === "=" ? "eq" : /[÷×−+^]/.test(label) ? "op" : ""} onClick={() => press(val)}>{label}</button>
        ))}
      </div>
    </div>
  );
}
