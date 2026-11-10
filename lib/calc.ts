// Calculator maths (no eval). Used by the floating scientific calculator.
// Supports + - * / ^ mod, !, parentheses, implicit multiplication (2pi, 3(4)), constants pi e,
// sin cos tan asin acos atan sinh cosh tanh asinh acosh atanh log ln sqrt cbrt exp abs.
// A missing ")" at the end is closed for you.

export function calcEvaluate(src: string, deg: boolean): number {
  const s = src.replace(/÷/g, "/").replace(/×/g, "*").replace(/−/g, "-").replace(/π/g, "pi").replace(/√/g, "sqrt(").replace(/∛/g, "cbrt(");
  const tokens = s.match(/\d+\.?\d*(?:e[+-]?\d+)?|\.\d+|[a-z]+|[+\-*/^()!%]/gi) ?? [];
  let pos = 0;
  const peek = () => tokens[pos]?.toLowerCase();
  const next = () => tokens[pos++]?.toLowerCase();
  const toRad = (x: number) => (deg ? (x * Math.PI) / 180 : x);
  const fromRad = (x: number) => (deg ? (x * 180) / Math.PI : x);
  const FNS: Record<string, (x: number) => number> = {
    sin: (x) => { const r = Math.sin(toRad(x)); return Math.abs(r) < 1e-15 ? 0 : r; },
    cos: (x) => { const r = Math.cos(toRad(x)); return Math.abs(r) < 1e-15 ? 0 : r; },
    tan: (x) => Math.tan(toRad(x)),
    asin: (x) => fromRad(Math.asin(x)), acos: (x) => fromRad(Math.acos(x)), atan: (x) => fromRad(Math.atan(x)),
    sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh, asinh: Math.asinh, acosh: Math.acosh, atanh: Math.atanh,
    log: Math.log10, ln: Math.log, sqrt: Math.sqrt, cbrt: Math.cbrt, exp: Math.exp, abs: Math.abs,
  };
  const fact = (n: number) => {
    if (!Number.isInteger(n) || n < 0 || n > 170) throw new Error("factorial needs a whole number from 0 to 170");
    let r = 1;
    for (let i = 2; i <= n; i++) r *= i;
    return r;
  };
  const startsValue = (t: string | undefined) => t !== undefined && (/^[\d.]/.test(t) || t === "(" || (/^[a-z]+$/.test(t) && t !== "mod"));

  function expr(): number {
    let v = term();
    while (peek() === "+" || peek() === "-") v = next() === "+" ? v + term() : v - term();
    return v;
  }
  function term(): number {
    let v = unary();
    for (;;) {
      const t = peek();
      if (t === "*") { next(); v *= unary(); }
      else if (t === "/") { next(); v /= unary(); }
      else if (t === "mod" || t === "%") { next(); v %= unary(); }
      else if (startsValue(tokens[pos])) v *= unary(); // implicit multiplication
      else return v;
    }
  }
  function unary(): number {
    if (peek() === "-") { next(); return -unary(); }
    if (peek() === "+") { next(); return unary(); }
    return power();
  }
  function power(): number {
    const base = postfix();
    if (peek() === "^") { next(); return Math.pow(base, unary()); }
    return base;
  }
  function postfix(): number {
    let v = primary();
    while (peek() === "!") { next(); v = fact(v); }
    return v;
  }
  function primary(): number {
    const t = next();
    if (t === undefined) throw new Error("incomplete");
    if (t === "(") { const v = expr(); if (peek() === ")") next(); return v; }
    if (/^[\d.]/.test(t)) return parseFloat(t);
    if (t === "pi") return Math.PI;
    if (t === "e") return Math.E;
    const f = FNS[t];
    if (f) {
      if (next() !== "(") throw new Error("expected (");
      const v = expr();
      if (peek() === ")") next();
      return f(v);
    }
    throw new Error("unknown " + t);
  }
  const v = expr();
  if (pos < tokens.length) throw new Error("extra input");
  return v;
}

/** 12 significant digits, no trailing zeros; "Error" for NaN/Infinity. */
export function calcFormat(v: number): string {
  if (!Number.isFinite(v)) return "Error";
  const r = parseFloat(v.toPrecision(12));
  return Math.abs(r) >= 1e15 || (r !== 0 && Math.abs(r) < 1e-9) ? r.toExponential().replace("e+", "e") : String(r);
}
