// Squarified treemap: lays out values as rectangles that fill a box, keeping tiles close to square. Coordinates are percentages.
export interface Rect { x: number; y: number; w: number; h: number }

export function squarify(values: number[], W = 100, H = 100): Rect[] {
  const out: Rect[] = values.map(() => ({ x: 0, y: 0, w: 0, h: 0 }));
  const total = values.reduce((s, v) => s + v, 0);
  if (!values.length || total <= 0) return out;
  const scale = (W * H) / total;
  const items = values.map((v, i) => ({ i, a: v * scale })).sort((p, q) => q.a - p.a);
  let x = 0, y = 0, w = W, h = H;
  let row: typeof items = [];
  const worst = (r: typeof items, side: number) => {
    const s = r.reduce((t, it) => t + it.a, 0);
    const mx = Math.max(...r.map((it) => it.a)), mn = Math.min(...r.map((it) => it.a));
    return Math.max((side * side * mx) / (s * s), (s * s) / (side * side * mn));
  };
  const place = (r: typeof items) => {
    const s = r.reduce((t, it) => t + it.a, 0);
    if (w >= h) { // a column on the left
      const cw = s / h; let cy = y;
      for (const it of r) { const ch = it.a / cw; out[it.i] = { x, y: cy, w: cw, h: ch }; cy += ch; }
      x += cw; w -= cw;
    } else { // a row on top
      const rh = s / w; let cx = x;
      for (const it of r) { const cw = it.a / rh; out[it.i] = { x: cx, y, w: cw, h: rh }; cx += cw; }
      y += rh; h -= rh;
    }
  };
  for (const it of items) {
    const side = Math.min(w, h);
    if (!row.length || worst([...row, it], side) <= worst(row, side)) row.push(it);
    else { place(row); row = [it]; }
  }
  if (row.length) place(row);
  return out;
}
