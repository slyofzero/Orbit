import { Question } from "./types";
import { Rng, makeRng, pick, randInt, shuffle } from "./rng";
import { QBody, mcq, nat } from "./questions/helpers";

// Each generator makes a fresh numeric question with a computed (hence verified) answer.
export interface Generator {
  id: string;
  topic: string;
  marks: 1 | 2;
  make: (r: Rng) => QBody;
}

const mat = (rows: number[][]) => String.raw`\begin{pmatrix}${rows.map((r) => r.join("&")).join("\\\\")}\end{pmatrix}`;
const round = (x: number, d = 4) => Number(x.toFixed(d));
const sigmoid = (z: number) => 1 / (1 + Math.exp(-z));
const comb = (n: number, k: number) => {
  let c = 1;
  for (let i = 1; i <= k; i++) c = (c * (n - k + i)) / i;
  return Math.round(c);
};
const fact = (n: number): number => (n <= 1 ? 1 : n * fact(n - 1));
const log2 = (x: number) => Math.log(x) / Math.log(2);
const H = (...counts: number[]) => {
  const n = counts.reduce((a, b) => a + b, 0);
  return -counts.reduce((s, c) => (c === 0 ? s : s + (c / n) * log2(c / n)), 0);
};

function det3(m: number[][]) {
  return (
    m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) -
    m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) +
    m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0])
  );
}

function rankOf(m: number[][]) {
  const a = m.map((r) => [...r]);
  let rank = 0;
  for (let c = 0; c < a[0].length && rank < a.length; c++) {
    let p = rank;
    for (let i = rank; i < a.length; i++) if (Math.abs(a[i][c]) > Math.abs(a[p][c])) p = i;
    if (Math.abs(a[p][c]) < 1e-9) continue;
    [a[rank], a[p]] = [a[p], a[rank]];
    for (let i = rank + 1; i < a.length; i++) {
      const f = a[i][c] / a[rank][c];
      for (let j = c; j < a[0].length; j++) a[i][j] -= f * a[rank][j];
    }
    rank++;
  }
  return rank;
}

export const GENERATORS: Generator[] = [
  {
    id: "det3", topic: "det", marks: 1,
    make: (r) => {
      const m = Array.from({ length: 3 }, () => Array.from({ length: 3 }, () => randInt(r, -3, 3)));
      return nat("det", 1, String.raw`Compute the determinant of $${mat(m)}$.`, det3(m), 0.01,
        "Expand along the first row: a(ei − fh) − b(di − fg) + c(dh − eg).");
    },
  },
  {
    id: "rank3", topic: "rank", marks: 1,
    make: (r) => {
      const base = () => Array.from({ length: 3 }, () => randInt(r, -2, 4));
      const r1 = base(), r2 = base();
      const dependent = r() < 0.6;
      const a = randInt(r, 1, 3), b = randInt(r, -2, 2);
      const r3 = dependent ? r1.map((x, i) => a * x + b * r2[i]) : base();
      const m = shuffle(r, [r1, r2, r3]);
      return nat("rank", 1, String.raw`Find the rank of $${mat(m)}$.`, rankOf(m), 0.01,
        "Row-reduce and count the nonzero rows (pivots).");
    },
  },
  {
    id: "eig2", topic: "eigen", marks: 1,
    make: (r) => {
      for (let t = 0; t < 500; t++) {
        const a = randInt(r, 1, 6), d = randInt(r, 1, 6), b = randInt(r, 1, 4), c = randInt(r, 0, 4);
        const disc = (a + d) ** 2 - 4 * (a * d - b * c);
        if (disc < 0) continue;
        const s = Math.sqrt(disc);
        if (!Number.isInteger(s) || s === 0 || (a + d + s) % 2 !== 0) continue;
        const big = (a + d + s) / 2;
        return nat("eigen", 1, String.raw`Find the largest eigenvalue of $${mat([[a, b], [c, d]])}$.`, big, 0.01,
          String.raw`Characteristic polynomial $\lambda^2 - ${a + d}\lambda + ${a * d - b * c} = 0$, so the eigenvalues are ${(a + d - s) / 2} and ${big}.`);
      }
      return nat("eigen", 1, String.raw`Find the largest eigenvalue of $${mat([[3, 1], [0, 2]])}$.`, 3, 0.01, "Triangular matrix: eigenvalues are the diagonal entries.");
    },
  },
  {
    id: "lu2", topic: "lu", marks: 1,
    make: (r) => {
      const a = randInt(r, 1, 4), m = randInt(r, 1, 4), b = randInt(r, 1, 5), d = randInt(r, 1, 9);
      const A = [[a, b], [a * m, d]];
      return nat("lu", 1, String.raw`In the LU decomposition (no pivoting, unit diagonal in $L$) of $${mat(A)}$, find $u_{22}$.`, d - m * b, 0.01,
        String.raw`$l_{21} = ${a * m}/${a} = ${m}$. $u_{22} = ${d} - ${m}\cdot${b} = ${d - m * b}$.`);
    },
  },
  {
    id: "svd1", topic: "svd", marks: 2,
    make: (r) => {
      const u = [randInt(r, 1, 3), randInt(r, 1, 3)], v = [randInt(r, 1, 3), randInt(r, 1, 3)];
      const A = [[u[0] * v[0], u[0] * v[1]], [u[1] * v[0], u[1] * v[1]]];
      const s = Math.hypot(...u) * Math.hypot(...v);
      return nat("svd", 2, String.raw`Find the largest singular value of $${mat(A)}$ (2 decimals).`, round(s, 2), 0.01,
        String.raw`The matrix has rank 1, so $\sigma_1 = \|A\|_F = \sqrt{${A.flat().map((x) => x * x).reduce((a, b) => a + b, 0)}} \approx ${round(s, 2)}$.`);
    },
  },
  {
    id: "bayes1", topic: "bayes", marks: 2,
    make: (r) => {
      const prev = pick(r, [1, 2, 5, 10]) / 100, sens = pick(r, [90, 95, 99]) / 100, fpr = pick(r, [2, 5, 10]) / 100;
      const post = (sens * prev) / (sens * prev + fpr * (1 - prev));
      return nat("bayes", 2, `A condition has prevalence ${prev * 100}%. A test is positive for ${sens * 100}% of people with the condition and for ${fpr * 100}% of those without it. Given a positive test, what is the probability of having the condition? (3 decimals)`,
        round(post, 3), 0.004, String.raw`$P(D|+) = \frac{${sens}\cdot${prev}}{${sens}\cdot${prev} + ${fpr}\cdot${round(1 - prev, 2)}} \approx ${round(post, 3)}$.`);
    },
  },
  {
    id: "binom", topic: "discrete", marks: 1,
    make: (r) => {
      const n = randInt(r, 4, 8), p = pick(r, [0.5, 0.3, 0.4]), k = randInt(r, 1, n - 1);
      const v = comb(n, k) * p ** k * (1 - p) ** (n - k);
      return nat("discrete", 1, `X ~ Binomial(n = ${n}, p = ${p}). Find P(X = ${k}). (3 decimals)`, round(v, 3), 0.002,
        String.raw`$\binom{${n}}{${k}}\, ${p}^{${k}}\, ${round(1 - p, 2)}^{${n - k}} \approx ${round(v, 3)}$.`);
    },
  },
  {
    id: "poisson", topic: "discrete", marks: 1,
    make: (r) => {
      const lam = randInt(r, 1, 4), k = randInt(r, 0, 3);
      const v = (Math.exp(-lam) * lam ** k) / fact(k);
      return nat("discrete", 1, `X ~ Poisson(λ = ${lam}). Find P(X = ${k}). (3 decimals)`, round(v, 3), 0.002,
        String.raw`$e^{-${lam}}\,${lam}^{${k}}/${k}! \approx ${round(v, 3)}$.`);
    },
  },
  {
    id: "ci1", topic: "ci", marks: 2,
    make: (r) => {
      const sigma = pick(r, [5, 10, 15, 20]), n = pick(r, [25, 36, 49, 64, 100]), m = randInt(r, 20, 80);
      const hw = (1.96 * sigma) / Math.sqrt(n);
      return nat("ci", 2, `A sample of size ${n} from a population with known σ = ${sigma} has mean ${m}. What is the upper limit of the 95% confidence interval for the population mean? (Use z = 1.96; 2 decimals)`,
        round(m + hw, 2), 0.02, String.raw`Half-width $=1.96\cdot${sigma}/\sqrt{${n}} = ${round(hw, 3)}$, so the upper limit is ${round(m + hw, 2)}.`);
    },
  },
  {
    id: "tstat", topic: "htest", marks: 1,
    make: (r) => {
      const n = pick(r, [9, 16, 25, 36]), mu = randInt(r, 50, 100), diff = randInt(r, 1, 6), s = pick(r, [4, 6, 8, 10, 12]);
      const t = diff / (s / Math.sqrt(n));
      return nat("htest", 1, `To test H0: μ = ${mu}, a sample of size ${n} has mean ${mu + diff} and sample standard deviation ${s}. Compute the t-statistic (2 decimals).`,
        round(t, 2), 0.01, String.raw`$t = \frac{${diff}}{${s}/\sqrt{${n}}} \approx ${round(t, 2)}$.`);
    },
  },
  {
    id: "chi2gof", topic: "htest", marks: 2,
    make: (r) => {
      const E = [randInt(r, 10, 30), randInt(r, 10, 30), randInt(r, 10, 30)];
      const d1 = randInt(r, -5, 5), d2 = randInt(r, -5, 5), d3 = -(d1 + d2);
      const O = [E[0] + d1, E[1] + d2, E[2] + d3];
      const chi = [d1, d2, d3].reduce((s, d, i) => s + (d * d) / E[i], 0);
      return nat("htest", 2, `Observed counts are [${O.join(", ")}] and expected counts are [${E.join(", ")}]. Compute the chi-squared statistic (2 decimals).`,
        round(chi, 2), 0.01, String.raw`$\sum (O-E)^2/E \approx ${round(chi, 2)}$.`);
    },
  },
  {
    id: "ig", topic: "dt", marks: 2,
    make: (r) => {
      const a = [randInt(r, 1, 7), randInt(r, 1, 7)], b = [randInt(r, 1, 7), randInt(r, 1, 7)];
      const P = a[0] + b[0], N = a[1] + b[1], T = P + N;
      const ig = H(P, N) - ((a[0] + a[1]) / T) * H(a[0], a[1]) - ((b[0] + b[1]) / T) * H(b[0], b[1]);
      return nat("dt", 2, `A node has ${P} positive and ${N} negative examples. A split gives children with (${a[0]}+, ${a[1]}−) and (${b[0]}+, ${b[1]}−). Compute the information gain using log base 2 (2 decimals).`,
        round(ig, 2), 0.011, String.raw`Gain $= H(\text{parent}) - \sum_i \frac{n_i}{n}H(\text{child}_i) \approx ${round(ig, 3)}$.`);
    },
  },
  {
    id: "gini", topic: "dt", marks: 1,
    make: (r) => {
      const p = randInt(r, 1, 8), n = randInt(r, 1, 8), T = p + n;
      const g = 1 - (p / T) ** 2 - (n / T) ** 2;
      return nat("dt", 1, `A node has ${p} positive and ${n} negative examples. What is its Gini impurity? (3 decimals)`, round(g, 3), 0.002,
        String.raw`$1 - (${p}/${T})^2 - (${n}/${T})^2 \approx ${round(g, 3)}$.`);
    },
  },
  {
    id: "kmeans1", topic: "kmeans", marks: 1,
    make: (r) => {
      const pts = Array.from({ length: 6 }, () => randInt(r, 1, 20)).sort((a, b) => a - b);
      const c1 = randInt(r, 1, 8), c2 = randInt(r, 12, 20);
      const g1 = pts.filter((x) => Math.abs(x - c1) <= Math.abs(x - c2));
      const g2 = pts.filter((x) => Math.abs(x - c1) > Math.abs(x - c2));
      if (g1.length === 0 || g2.length === 0) return GENERATORS.find((g) => g.id === "kmeans1")!.make(r);
      const m1 = g1.reduce((s, x) => s + x, 0) / g1.length;
      return nat("kmeans", 1, `1-D points: ${pts.join(", ")}. k-means starts with centroids ${c1} and ${c2} (points equidistant from both go to the first). After ONE assignment and update step, what is the new value of the first centroid? (2 decimals)`,
        round(m1, 2), 0.01, `Cluster 1 = {${g1.join(", ")}}, so its mean is ${round(m1, 2)}.`);
    },
  },
  {
    id: "sigm", topic: "logreg", marks: 1,
    make: (r) => {
      const w = randInt(r, -3, 3) || 1, b = randInt(r, -2, 2), x = randInt(r, -2, 2);
      const z = w * x + b;
      return nat("logreg", 1, `A logistic regression model has P(y = 1 | x) = σ(${w}x ${b < 0 ? "−" : "+"} ${Math.abs(b)}). Find P(y = 1 | x = ${x}). (3 decimals)`,
        round(sigmoid(z), 3), 0.003, String.raw`$z = ${w}\cdot${x} + (${b}) = ${z}$, so $\sigma(z) = 1/(1+e^{-${z}}) \approx ${round(sigmoid(z), 3)}$.`);
    },
  },
  {
    id: "knn1", topic: "knn", marks: 2,
    make: (r) => {
      for (let t = 0; t < 200; t++) {
        const pts = Array.from({ length: 6 }, () => ({ x: randInt(r, 0, 6), y: randInt(r, 0, 6), c: r() < 0.5 ? "A" : "B" }));
        if (new Set(pts.map((p) => `${p.x},${p.y}`)).size !== pts.length) continue;
        const q = { x: randInt(r, 0, 6), y: randInt(r, 0, 6) };
        const d = pts.map((p) => ({ ...p, d: (p.x - q.x) ** 2 + (p.y - q.y) ** 2 })).sort((a, b) => a.d - b.d);
        if (d[2].d === d[3].d || d[0].d === 0) continue;
        const cntA = d.slice(0, 3).filter((p) => p.c === "A").length;
        const ans = cntA >= 2 ? 0 : 1;
        return mcq("knn", 2, `Training points (x, y, class): ${pts.map((p) => `(${p.x}, ${p.y}, ${p.c})`).join(", ")}. Using Euclidean distance and k = 3, what is the predicted class of the query point (${q.x}, ${q.y})?`,
          ["Class A", "Class B"], ans, `Squared distances of the 3 nearest: ${d.slice(0, 3).map((p) => `${p.c}:${p.d}`).join(", ")}. Majority vote gives class ${ans === 0 ? "A" : "B"}.`);
      }
      return mcq("knn", 2, "With k = 1, a query point identical in position to a training point of class A is predicted as", ["Class A", "Class B"], 0, "The nearest neighbour is at distance 0.");
    },
  },
  {
    id: "ridge1", topic: "ridge", marks: 1,
    make: (r) => {
      const sxy = randInt(r, 4, 20), sxx = randInt(r, 3, 12), lam = randInt(r, 1, 5);
      return nat("ridge", 1, String.raw`In 1-D ridge regression without intercept, $w = \frac{\sum x_iy_i}{\sum x_i^2 + \lambda}$. If $\sum x_iy_i = ${sxy}$, $\sum x_i^2 = ${sxx}$ and $\lambda = ${lam}$, find $w$ (3 decimals).`,
        round(sxy / (sxx + lam), 3), 0.003, String.raw`$w = ${sxy}/(${sxx}+${lam}) \approx ${round(sxy / (sxx + lam), 3)}$.`);
    },
  },
  {
    id: "mlpparams", topic: "mlp", marks: 2,
    make: (r) => {
      const i = randInt(r, 2, 6), h = randInt(r, 2, 8), o = randInt(r, 1, 4);
      return nat("mlp", 2, `A feed-forward network has ${i} inputs, one hidden layer with ${h} units and ${o} output units. Every non-input unit has a bias. How many trainable parameters does it have?`,
        (i + 1) * h + (h + 1) * o, 0.01, `Hidden: (${i}+1)×${h} = ${(i + 1) * h}. Output: (${h}+1)×${o} = ${(h + 1) * o}.`);
    },
  },
  {
    id: "hashlp", topic: "hashing", marks: 2,
    make: (r) => {
      const m = pick(r, [7, 9, 11]);
      const keys: number[] = [];
      while (keys.length < 4) {
        const k = randInt(r, 10, 60);
        if (!keys.includes(k)) keys.push(k);
      }
      const table: (number | null)[] = Array(m).fill(null);
      let idx = 0;
      for (const k of keys) {
        let i = k % m;
        while (table[i] !== null) i = (i + 1) % m;
        table[i] = k;
        idx = i;
      }
      return nat("hashing", 2, `A hash table of size ${m} uses h(k) = k mod ${m} with linear probing (step +1, wrapping around). Keys ${keys.join(", ")} are inserted in this order. At which index is the key ${keys[3]} stored?`,
        idx, 0.01, `Simulate the insertions in order; the final table is [${table.map((x) => (x === null ? "_" : x)).join(", ")}].`);
    },
  },
  {
    id: "binsearch", topic: "search", marks: 1,
    make: (r) => {
      const n = randInt(r, 100, 5000);
      return nat("search", 1, `What is the maximum number of comparisons binary search makes on a sorted array of ${n} elements?`,
        Math.floor(log2(n)) + 1, 0.01, String.raw`$\lfloor\log_2 ${n}\rfloor + 1 = ${Math.floor(log2(n)) + 1}$.`);
    },
  },
  {
    id: "inversions", topic: "sortbasic", marks: 1,
    make: (r) => {
      const arr = shuffle(r, [1, 2, 3, 4, 5, 6, 7, 8, 9]).slice(0, 6);
      let inv = 0;
      for (let i = 0; i < arr.length; i++) for (let j = i + 1; j < arr.length; j++) if (arr[i] > arr[j]) inv++;
      return nat("sortbasic", 1, `How many swaps does bubble sort perform on [${arr.join(", ")}]?`, inv, 0.01,
        "Each swap of adjacent elements removes exactly one inversion, so the answer is the number of inversions.");
    },
  },
  {
    id: "bplus", topic: "index", marks: 2,
    make: (r) => {
      const B = pick(r, [512, 1024, 2048, 4096]), key = pick(r, [4, 8, 10, 12]), ptr = pick(r, [4, 8]);
      const n = Math.floor((B + key) / (key + ptr));
      return nat("index", 2, `A block is ${B} bytes, a key takes ${key} bytes and a pointer ${ptr} bytes. In a B+ tree, an internal node holds n pointers and n − 1 keys. What is the maximum number of keys in an internal node?`,
        n - 1, 0.01, String.raw`$${key}(n-1) + ${ptr}n \le ${B} \Rightarrow n \le ${(B + key) / (key + ptr)}$, so $n=${n}$ and the maximum keys is ${n - 1}.`);
    },
  },
  {
    id: "minmax", topic: "transform", marks: 1,
    make: (r) => {
      const lo = randInt(r, 0, 40), hi = lo + pick(r, [50, 80, 100, 200]), x = lo + randInt(r, 1, hi - lo - 1);
      return nat("transform", 1, `Use min-max normalization to [0, 1] on a value ${x} from an attribute ranging from ${lo} to ${hi}. (3 decimals)`,
        round((x - lo) / (hi - lo), 3), 0.002, String.raw`$(${x}-${lo})/(${hi}-${lo}) \approx ${round((x - lo) / (hi - lo), 3)}$.`);
    },
  },
  {
    id: "bnparams", topic: "bncond", marks: 2,
    make: (r) => {
      const opts: [string, string[]][] = [
        ["A→B, A→C, B→D, C→D", ["", "A", "A", "B,C"]],
        ["A→B, B→C, C→D", ["", "A", "B", "C"]],
        ["A→C, B→C, C→D, B→D", ["", "", "A,B", "B,C"]],
        ["A→B, A→C, A→D, B→D", ["", "A", "A", "A,B"]],
      ];
      const [edges, pa] = pick(r, opts);
      const total = pa.reduce((s, p) => s + 2 ** (p === "" ? 0 : p.split(",").length), 0);
      return nat("bncond", 2, `Binary variables A, B, C, D form a Bayesian network with edges ${edges}. How many independent probability parameters are needed for all the CPTs?`,
        total, 0.01, `Each node needs 2^(number of parents) parameters: ${pa.map((p) => 2 ** (p === "" ? 0 : p.split(",").length)).join(" + ")} = ${total}.`);
    },
  },
  {
    id: "ve1", topic: "ve", marks: 1,
    make: (r) => {
      const pa = randInt(r, 2, 8) / 10, q1 = randInt(r, 1, 9) / 10, q0 = randInt(r, 1, 9) / 10;
      const v = pa * q1 + (1 - pa) * q0;
      return nat("ve", 1, `A→B with P(A=1) = ${pa}, P(B=1|A=1) = ${q1}, P(B=1|A=0) = ${q0}. Eliminate A to compute P(B=1). (3 decimals)`,
        round(v, 3), 0.002, `P(B=1) = ${pa}·${q1} + ${round(1 - pa, 2)}·${q0} = ${round(v, 3)}.`);
    },
  },
  // ---------- General Aptitude ----------
  {
    id: "pct", topic: "quant", marks: 1,
    make: (r) => {
      const x = pick(r, [10, 20, 25, 50]), y = pick(r, [10, 20, 25]);
      const net = ((1 + x / 100) * (1 - y / 100) - 1) * 100;
      return nat("quant", 1, `A price is increased by ${x}% and the new price is then decreased by ${y}%. What is the net percentage change in the price? (Use a negative sign for a net decrease.)`,
        round(net, 2), 0.01, `Multiplier = ${1 + x / 100} × ${1 - y / 100} = ${round((1 + x / 100) * (1 - y / 100), 4)}, i.e. ${round(net, 2)}%.`);
    },
  },
  {
    id: "work", topic: "quant", marks: 1,
    make: (r) => {
      const [a, b] = pick(r, [[12, 6], [10, 15], [20, 30], [12, 24], [30, 60], [6, 3], [15, 10]]);
      return nat("quant", 1, `A can finish a job in ${a} days and B can finish it in ${b} days. Working together, in how many days will they finish it?`, (a * b) / (a + b), 0.01,
        String.raw`Combined rate $=1/${a} + 1/${b}$, so time $=\frac{${a}\cdot${b}}{${a}+${b}} = ${(a * b) / (a + b)}$ days.`);
    },
  },
  {
    id: "avgspeed", topic: "quant", marks: 2,
    make: (r) => {
      const [u, v] = pick(r, [[40, 60], [30, 60], [20, 30], [60, 90], [50, 75]]);
      return nat("quant", 2, `A car travels from P to Q at ${u} km/h and returns along the same route at ${v} km/h. What is its average speed for the round trip, in km/h?`,
        round((2 * u * v) / (u + v), 2), 0.01, String.raw`Equal distances, so average speed is the harmonic mean: $\frac{2\cdot${u}\cdot${v}}{${u}+${v}} = ${round((2 * u * v) / (u + v), 2)}$.`);
    },
  },
  {
    id: "si", topic: "quant", marks: 1,
    make: (r) => {
      const P = pick(r, [1000, 2000, 5000, 8000]), rate = pick(r, [5, 6, 8, 10]), t = randInt(r, 2, 5);
      return nat("quant", 1, `What is the simple interest on ₹${P} at ${rate}% per annum for ${t} years (in ₹)?`, (P * rate * t) / 100, 0.01,
        String.raw`$SI = \frac{PRT}{100} = \frac{${P}\cdot${rate}\cdot${t}}{100} = ${(P * rate * t) / 100}$.`);
    },
  },
  {
    id: "series", topic: "di", marks: 2,
    make: (r) => {
      const a = randInt(r, 1, 6), d = randInt(r, 1, 4), e = randInt(r, 1, 3);
      const terms: number[] = [a];
      let diff = d;
      for (let i = 0; i < 5; i++) { terms.push(terms[i] + diff); diff += e; }
      return nat("di", 2, `Find the next term of the series: ${terms.slice(0, 5).join(", ")}, ?`, terms[5], 0.01,
        `Differences are ${terms.slice(1, 5).map((x, i) => x - terms[i]).join(", ")}; they rise by ${e} each time, so the next difference is ${terms[5] - terms[4]}.`);
    },
  },
];

export function generate(gen: Generator, seed: number): Question {
  const body = gen.make(makeRng(seed));
  return { ...body, id: `g:${gen.id}:${seed}` };
}

export const generatorsForTopic = (topic: string) => GENERATORS.filter((g) => g.topic === topic);
