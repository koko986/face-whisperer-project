// Small dense-matrix helpers used by the eigenface + SVD pipeline.
// Row-major Float64Array matrices; deterministic power iteration.

export type Vec = Float64Array<ArrayBufferLike>;
export type Mat = { rows: number; cols: number; data: Vec };

export function mat(rows: number, cols: number, data?: Vec): Mat {
  return { rows, cols, data: data ?? new Float64Array(rows * cols) };
}

export function dot(a: Vec, b: Vec): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i]! * b[i]!;
  return s;
}

export function norm(a: Vec): number {
  return Math.sqrt(dot(a, a));
}

export function scale(a: Vec, k: number): Vec {
  const out = new Float64Array(a.length);
  for (let i = 0; i < a.length; i++) out[i] = a[i]! * k;
  return out;
}

/** y = M x */
export function mulVec(m: Mat, x: Vec): Vec {
  const y = new Float64Array(m.rows);
  for (let r = 0; r < m.rows; r++) {
    let s = 0;
    const off = r * m.cols;
    for (let c = 0; c < m.cols; c++) s += m.data[off + c]! * x[c]!;
    y[r] = s;
  }
  return y;
}

/** y = Mᵀ x */
export function mulVecT(m: Mat, x: Vec): Vec {
  const y = new Float64Array(m.cols);
  for (let r = 0; r < m.rows; r++) {
    const v = x[r]!;
    if (v === 0) continue;
    const off = r * m.cols;
    for (let c = 0; c < m.cols; c++) y[c]! += m.data[off + c]! * v;
  }
  return y;
}

function seededRandom(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff - 0.5;
  };
}

export type SVDResult = { u: Vec[]; v: Vec[]; s: number[] };

/**
 * Top-k singular triplets via power iteration on AᵀA with deflation.
 */
export function partialSVD(a: Mat, k: number, iters = 60): SVDResult {
  const rand = seededRandom(0x5eed);
  const us: Vec[] = [];
  const vs: Vec[] = [];
  const sigmas: number[] = [];
  const kk = Math.min(k, a.rows, a.cols);

  for (let comp = 0; comp < kk; comp++) {
    let v: Vec = new Float64Array(a.cols);
    for (let i = 0; i < v.length; i++) v[i] = rand();
    let n = norm(v) || 1;
    v = scale(v, 1 / n);

    for (let it = 0; it < iters; it++) {
      const av = mulVec(a, v);
      for (let p = 0; p < comp; p++) {
        const up = us[p]!;
        const c = dot(av, up);
        for (let i = 0; i < av.length; i++) av[i]! -= c * up[i]!;
      }
      const w = mulVecT(a, av);
      for (let p = 0; p < comp; p++) {
        const vp = vs[p]!;
        const c = dot(w, vp);
        for (let i = 0; i < w.length; i++) w[i]! -= c * vp[i]!;
      }
      n = norm(w);
      if (n < 1e-12) break;
      v = scale(w, 1 / n);
    }

    const av = mulVec(a, v);
    const sigma = norm(av);
    if (sigma < 1e-10) break;
    us.push(scale(av, 1 / sigma));
    vs.push(v);
    sigmas.push(sigma);
  }

  return { u: us, v: vs, s: sigmas };
}

/** Rank-k reconstruction from precomputed triplets. */
export function reconstruct(svd: SVDResult, rows: number, cols: number, rank: number): Mat {
  const out = mat(rows, cols);
  const k = Math.min(rank, svd.s.length);
  for (let c = 0; c < k; c++) {
    const u = svd.u[c]!;
    const v = svd.v[c]!;
    const s = svd.s[c]!;
    for (let r = 0; r < rows; r++) {
      const ur = u[r]! * s;
      const off = r * cols;
      for (let j = 0; j < cols; j++) out.data[off + j]! += ur * v[j]!;
    }
  }
  return out;
}
