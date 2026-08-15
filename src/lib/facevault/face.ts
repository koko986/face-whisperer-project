import { mat, partialSVD, reconstruct, dot, norm, type Mat, type Vec } from "./linalg";

export const FACE_SIZE = 64;
export const RANKS = [5, 10, 20, 30, 50, 64] as const;

/* ---------------------------------------------------------------- imaging */

function canvas2d(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  return { c, ctx };
}

/** Center-square crop -> FACE_SIZE grayscale, contrast normalised. */
export function sourceToFace(source: CanvasImageSource, sw: number, sh: number) {
  const side = Math.min(sw, sh);
  const sx = (sw - side) / 2;
  const sy = (sh - side) / 2;
  const { c, ctx } = canvas2d(FACE_SIZE, FACE_SIZE);
  ctx.drawImage(source, sx, sy, side, side, 0, 0, FACE_SIZE, FACE_SIZE);
  const img = ctx.getImageData(0, 0, FACE_SIZE, FACE_SIZE);
  const vec: Vec = new Float64Array(FACE_SIZE * FACE_SIZE);
  for (let i = 0; i < vec.length; i++) {
    const r = img.data[i * 4]!;
    const g = img.data[i * 4 + 1]!;
    const b = img.data[i * 4 + 2]!;
    vec[i] = 0.299 * r + 0.587 * g + 0.114 * b;
  }
  return { vec: standardize(vec), preview: matToDataUrl(mat(FACE_SIZE, FACE_SIZE, vec)) };
}

export function standardize(v: Vec): Vec {
  let mean = 0;
  for (let i = 0; i < v.length; i++) mean += v[i]!;
  mean /= v.length;
  let sd = 0;
  for (let i = 0; i < v.length; i++) sd += (v[i]! - mean) ** 2;
  sd = Math.sqrt(sd / v.length) || 1;
  const out: Vec = new Float64Array(v.length);
  for (let i = 0; i < v.length; i++) out[i] = (v[i]! - mean) / sd;
  return out;
}

/** Renders a grayscale matrix (any scale) to a data URL, auto-levelled. */
export function matToDataUrl(m: Mat, upscale = 3): string {
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0; i < m.data.length; i++) {
    const v = m.data[i]!;
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  const span = hi - lo || 1;
  const { c, ctx } = canvas2d(m.cols, m.rows);
  const img = ctx.createImageData(m.cols, m.rows);
  for (let i = 0; i < m.data.length; i++) {
    const g = Math.round(((m.data[i]! - lo) / span) * 255);
    img.data[i * 4] = g;
    img.data[i * 4 + 1] = g;
    img.data[i * 4 + 2] = g;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const out = canvas2d(m.cols * upscale, m.rows * upscale);
  out.ctx.imageSmoothingEnabled = false;
  out.ctx.drawImage(c, 0, 0, m.cols * upscale, m.rows * upscale);
  return out.c.toDataURL("image/png");
}

export async function fileToFace(file: File) {
  const bitmap = await createImageBitmap(file);
  const face = sourceToFace(bitmap, bitmap.width, bitmap.height);
  bitmap.close();
  return face;
}

/** Cheap "is there a face-ish subject" gate: centre region must carry detail. */
export function subjectScore(v: Vec): number {
  let energy = 0;
  const n = FACE_SIZE;
  for (let y = n * 0.2; y < n * 0.8; y++) {
    for (let x = n * 0.2; x < n * 0.8; x++) {
      const i = y * n + x;
      const right = v[i + 1] ?? 0;
      const down = v[i + n] ?? 0;
      energy += Math.abs(v[i]! - right) + Math.abs(v[i]! - down);
    }
  }
  return energy / (n * n);
}

/* ------------------------------------------------------------- eigenfaces */

export type Participant = { id: string; name: string; samples: number[][]; thumb: string };

export type FaceModel = {
  mean: Vec;
  basis: Vec[];
  refs: { id: string; name: string; coords: Vec }[];
};

export function buildModel(participants: Participant[], components = 24): FaceModel | null {
  const rows: Vec[] = [];
  const owners: { id: string; name: string }[] = [];
  for (const p of participants) {
    for (const s of p.samples) {
      rows.push(Float64Array.from(s));
      owners.push({ id: p.id, name: p.name });
    }
  }
  if (rows.length < 2) return null;

  const dim = rows[0]!.length;
  const mean: Vec = new Float64Array(dim);
  for (const r of rows) for (let i = 0; i < dim; i++) mean[i]! += r[i]! / rows.length;

  const a = mat(rows.length, dim);
  rows.forEach((r, ri) => {
    for (let i = 0; i < dim; i++) a.data[ri * dim + i] = r[i]! - mean[i]!;
  });

  const { v: basis } = partialSVD(a, Math.min(components, rows.length - 1), 40);
  const refs = rows.map((r, ri) => ({
    id: owners[ri]!.id,
    name: owners[ri]!.name,
    coords: project(r, mean, basis),
  }));
  return { mean, basis, refs };
}

export function project(v: Vec, mean: Vec, basis: Vec[]): Vec {
  const centred: Vec = new Float64Array(v.length);
  for (let i = 0; i < v.length; i++) centred[i] = v[i]! - mean[i]!;
  const out: Vec = new Float64Array(basis.length);
  basis.forEach((b, i) => {
    out[i] = dot(centred, b);
  });
  return out;
}

export type MatchResult = {
  name: string | null;
  confidence: number;
  distance: number;
  runnerUp: number;
};

export function classify(v: Vec, model: FaceModel | null): MatchResult {
  if (!model || model.refs.length === 0)
    return { name: null, confidence: 0, distance: Infinity, runnerUp: Infinity };
  const coords = project(v, model.mean, model.basis);
  const byName = new Map<string, number>();
  for (const ref of model.refs) {
    const d: Vec = new Float64Array(coords.length);
    for (let i = 0; i < coords.length; i++) d[i] = coords[i]! - ref.coords[i]!;
    const dist = norm(d);
    const prev = byName.get(ref.name);
    if (prev === undefined || dist < prev) byName.set(ref.name, dist);
  }
  const ranked = [...byName.entries()].sort((a, b) => a[1] - b[1]);
  const best = ranked[0]!;
  const runnerUp = ranked[1]?.[1] ?? best[1] * 2;
  const separation = runnerUp === 0 ? 0 : 1 - best[1] / runnerUp;
  const closeness = 1 / (1 + best[1] / (norm(coords) || 1));
  const confidence = Math.max(0, Math.min(1, 0.45 * separation + 0.9 * closeness));
  return { name: best[0], confidence, distance: best[1], runnerUp };
}

/* --------------------------------------------------------- compression lab */

export type RankSample = {
  rank: number;
  preview: string;
  confidence: number;
  name: string | null;
  energy: number;
};

/**
 * Rank-k SVD reconstructions of one face, each re-run through the classifier.
 * This is the compression experiment that feeds the chart.
 */
export function compressionSweep(v: Vec, model: FaceModel | null): RankSample[] {
  const image = mat(FACE_SIZE, FACE_SIZE, v);
  const svd = partialSVD(image, Math.max(...RANKS), 30);
  const total = svd.s.reduce((s, x) => s + x * x, 0) || 1;
  return RANKS.map((rank) => {
    const rec = reconstruct(svd, FACE_SIZE, FACE_SIZE, rank);
    const norm01 = standardize(rec.data);
    const match = classify(norm01, model);
    const energy = svd.s.slice(0, rank).reduce((s, x) => s + x * x, 0) / total;
    return {
      rank,
      preview: matToDataUrl(rec),
      confidence: match.confidence,
      name: match.name,
      energy,
    };
  });
}
