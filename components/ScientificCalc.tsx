"use client";
import { useEffect, useRef, useState } from "react";
import ModalClose from "@/components/ModalClose";
import { calcEvaluate, calcFormat } from "@/lib/calc";

type Key = { label: string; send: string; cls?: string; inv?: [string, string] };
// 5 columns. send = what is typed, or a command (MC MR MS M+ M- BS C = NEG RECIP).
const KEYS: Key[][] = [
  [{ label: "MC", send: "MC", cls: "mem" }, { label: "MR", send: "MR", cls: "mem" }, { label: "MS", send: "MS", cls: "mem" }, { label: "M+", send: "M+", cls: "mem" }, { label: "M−", send: "M-", cls: "mem" }],
  [{ label: "sin", send: "sin(", inv: ["sin⁻¹", "asin("] }, { label: "cos", send: "cos(", inv: ["cos⁻¹", "acos("] }, { label: "tan", send: "tan(", inv: ["tan⁻¹", "atan("] }, { label: "⌫", send: "BS", cls: "fn" }, { label: "C", send: "C", cls: "clr" }],
  [{ label: "sinh", send: "sinh(", inv: ["sinh⁻¹", "asinh("] }, { label: "cosh", send: "cosh(", inv: ["cosh⁻¹", "acosh("] }, { label: "tanh", send: "tanh(", inv: ["tanh⁻¹", "atanh("] }, { label: "(", send: "(", cls: "fn" }, { label: ")", send: ")", cls: "fn" }],
  [{ label: "x²", send: "^2" }, { label: "x³", send: "^3" }, { label: "xʸ", send: "^" }, { label: "√x", send: "sqrt(" }, { label: "∛x", send: "cbrt(" }],
  [{ label: "log", send: "log(" }, { label: "ln", send: "ln(" }, { label: "10ˣ", send: "10^(" }, { label: "eˣ", send: "exp(" }, { label: "n!", send: "!" }],
  [{ label: "7", send: "7", cls: "num" }, { label: "8", send: "8", cls: "num" }, { label: "9", send: "9", cls: "num" }, { label: "÷", send: "÷", cls: "op" }, { label: "1/x", send: "RECIP" }],
  [{ label: "4", send: "4", cls: "num" }, { label: "5", send: "5", cls: "num" }, { label: "6", send: "6", cls: "num" }, { label: "×", send: "×", cls: "op" }, { label: "mod", send: " mod " }],
  [{ label: "1", send: "1", cls: "num" }, { label: "2", send: "2", cls: "num" }, { label: "3", send: "3", cls: "num" }, { label: "−", send: "−", cls: "op" }, { label: "π", send: "π" }],
  [{ label: "0", send: "0", cls: "num" }, { label: ".", send: ".", cls: "num" }, { label: "±", send: "NEG" }, { label: "+", send: "+", cls: "op" }, { label: "=", send: "=", cls: "eq" }],
];
const OPS = /^[+\-−×÷^!]|^ mod $/;

/** A floating scientific calculator in the style of the exam-centre one: Deg/Rad, inverse functions, memory, factorial, mod. Drag it by its title. */
export default function ScientificCalc({ onClose }: { onClose: () => void }) {
  const [expr, setExpr] = useState("");
  const [res, setRes] = useState("");
  const [deg, setDeg] = useState(true);
  const [inv, setInv] = useState(false);
  const [mem, setMem] = useState(0);
  const [fresh, setFresh] = useState(false); // a result is on screen; a digit starts over, an operator continues from it
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const drag = useRef<{ dx: number; dy: number } | null>(null);

  useEffect(() => { box.current?.focus(); }, []);

  const value = (): number | null => {
    if (!expr && !res) return 0;
    try { return calcEvaluate(expr || res, deg); } catch { return null; }
  };
  const equals = () => {
    if (!expr) return;
    try { const v = calcEvaluate(expr, deg); setRes(calcFormat(v)); setFresh(Number.isFinite(v)); } catch { setRes("Error"); setFresh(false); }
  };
  const press = (k: string) => {
    if (k === "C") { setExpr(""); setRes(""); setFresh(false); return; }
    if (k === "BS") { setFresh(false); setExpr((e) => e.replace(/(a?(?:sin|cos|tan)h?\(|log\(|ln\(|sqrt\(|cbrt\(|exp\(| mod |pi|π|.)$/, "")); return; }
    if (k === "=") { equals(); return; }
    if (k === "MC") { setMem(0); return; }
    if (k === "MR") { setExpr(calcFormat(mem)); setRes(""); setFresh(false); return; }
    if (k === "MS" || k === "M+" || k === "M-") {
      const v = value();
      if (v === null || !Number.isFinite(v)) return;
      setMem((m) => (k === "MS" ? v : k === "M+" ? m + v : m - v));
      return;
    }
    if (k === "NEG") { setFresh(false); setExpr((e) => { const base = e || res; return !base ? "−" : /^−\(.*\)$/.test(base) ? base.slice(2, -1) : `−(${base})`; }); setRes(""); return; }
    if (k === "RECIP") { setFresh(false); setExpr((e) => { const base = e || res; return base ? `1/(${base})` : e; }); setRes(""); return; }
    // typing: after a result, an operator continues from it, anything else starts over
    if (fresh) {
      setFresh(false);
      if (OPS.test(k)) { setExpr(res + k); setRes(""); return; }
      setExpr(k); setRes(""); return;
    }
    setExpr((e) => e + k);
  };

  const onKey = (e: React.KeyboardEvent) => {
    const k = e.key;
    if (k === "Escape") { e.stopPropagation(); onClose(); return; }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (k === "Enter" || k === "=") { e.preventDefault(); press("="); }
    else if (k === "Backspace") { e.preventDefault(); press("BS"); }
    else if (k === "Delete") { e.preventDefault(); press("C"); }
    else if (/^[0-9.()+\-^!]$/.test(k)) { e.preventDefault(); press(k === "-" ? "−" : k); }
    else if (k === "*") { e.preventDefault(); press("×"); }
    else if (k === "/") { e.preventDefault(); press("÷"); }
    else if (k === "%") { e.preventDefault(); press(" mod "); }
  };

  const startDrag = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("button, label")) return;
    const r = box.current!.getBoundingClientRect();
    drag.current = { dx: e.clientX - r.left, dy: e.clientY - r.top };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const moveDrag = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const w = box.current!.offsetWidth, h = box.current!.offsetHeight;
    setPos({ x: Math.min(Math.max(0, e.clientX - drag.current.dx), window.innerWidth - w), y: Math.min(Math.max(0, e.clientY - drag.current.dy), window.innerHeight - h) });
  };

  return (
    <div ref={box} className="sci" role="dialog" aria-label="Scientific calculator" tabIndex={-1} onKeyDown={onKey} style={pos ? { left: pos.x, top: pos.y, right: "auto" } : undefined}>
      <div className="sci-head" onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={() => (drag.current = null)}>
        <b>Calculator</b>
        <ModalClose onClick={onClose} inline />
      </div>
      <div className="sci-screen" aria-live="polite">
        <div className="sci-expr">{expr || "0"}{mem !== 0 && <span className="sci-m">M</span>}</div>
        <div className="sci-res">{res || " "}</div>
      </div>
      <div className="sci-modes">
        <label><input type="radio" name="sci-ang" checked={deg} onChange={() => setDeg(true)} /> Deg</label>
        <label><input type="radio" name="sci-ang" checked={!deg} onChange={() => setDeg(false)} /> Rad</label>
        <label className="sci-inv"><input type="checkbox" checked={inv} onChange={(e) => setInv(e.target.checked)} /> Inv</label>
      </div>
      <div className="sci-keys">
        {KEYS.flat().map((k) => {
          const [label, send] = inv && k.inv ? k.inv : [k.label, k.send];
          return <button key={k.label} type="button" className={k.cls ?? "fnk"} onClick={() => { press(send); box.current?.focus(); }}>{label}</button>;
        })}
      </div>
    </div>
  );
}
