import { Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis } from "recharts";
import type { Analysis } from "./types";

const MATRIX_BASE = "bg-card ring-1 ring-border rounded-md p-3 font-mono text-center";

function MatrixBlock({
  label,
  dims,
  color,
  children,
}: {
  label: string;
  dims: string;
  color: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={`${MATRIX_BASE} min-w-[72px]`}>
      <div className={`text-[10px] uppercase tracking-wider ${color}`}>{label}</div>
      <div className="mt-2 text-lg font-semibold text-foreground">{children}</div>
      <div className="mt-1 text-[10px] text-muted-foreground">{dims}</div>
    </div>
  );
}

function Operator({ symbol }: { symbol: string }) {
  return (
    <div className="flex items-center px-1 text-lg font-mono text-muted-foreground">{symbol}</div>
  );
}

export function SVDEquationView({ analysis }: { analysis: Analysis }) {
  const svData =
    analysis.singularValues.length > 0
      ? analysis.singularValues.map((s, i) => ({
          idx: i + 1,
          sigma: Math.round(s * 1000) / 1000,
        }))
      : [];

  const maxSigma = svData.length > 0 ? svData[0]!.sigma : 1;
  const retainedEnergy =
    analysis.ranks.filter((r) => r.rank === Math.max(...analysis.ranks.map((x) => x.rank))).at(0)
      ?.energy ?? 1;

  return (
    <div className="space-y-8">
      <header className="space-y-1 border-b border-border pb-4">
        <p className="fv-label">Section 04 // SVD decomposition</p>
        <h2 className="text-2xl font-medium tracking-tight text-foreground">
          Singular-value decomposition graph
        </h2>
        <p className="text-sm text-muted-foreground">
          Every input image is a matrix A (m x n). Its SVD factorises A into orthogonal bases U, V
          and a diagonal singular-value matrix Σ.
        </p>
      </header>

      <section className="space-y-3">
        <h3 className="fv-label">Decomposition equation</h3>
        <div className="flex flex-wrap items-center gap-2 overflow-x-auto rounded-lg bg-card p-4 ring-1 ring-border">
          <MatrixBlock label="A" dims={`${64}×${64}`} color="text-primary">
            <span className="text-xl">A</span>
          </MatrixBlock>
          <Operator symbol="=" />
          <MatrixBlock label="U" dims={`${64}×${64}`} color="text-blue-400">
            U
          </MatrixBlock>
          <Operator symbol="·" />
          <MatrixBlock label="Σ" dims={`${64}×${64}`} color="text-emerald-400">
            <span className="text-xl">Σ</span>
          </MatrixBlock>
          <Operator symbol="·" />
          <MatrixBlock label="Vᵀ" dims={`${64}×${64}`} color="text-amber-400">
            <span className="text-base">
              V<sup>⊤</sup>
            </span>
          </MatrixBlock>
        </div>
        <p className="text-xs text-muted-foreground">
          Left singular vectors (U) span the row space. Right singular vectors (V) span the column
          space. Diagonal entries σ₁ ≥ σ₂ ≥ … ≥ σᵣ &gt; 0 are the singular values.
        </p>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="fv-label">Singular-value spectrum</h3>
          <div className="font-mono text-[10px] text-muted-foreground">
            σ₁ = {maxSigma.toFixed(3)} · Σσ² ={" "}
            {svData.reduce((s, x) => s + x.sigma ** 2, 0).toFixed(3)}
          </div>
        </div>
        <div className="h-64 rounded-lg bg-card p-4 ring-1 ring-border">
          {svData.length > 0 ? (
            <BarChart data={svData} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="2 4" />
              <XAxis
                dataKey="idx"
                stroke="var(--muted-foreground)"
                tick={{ fontSize: 10, fontFamily: "var(--font-mono)" }}
                tickLine={false}
                label={{
                  value: "component i",
                  position: "insideBottom",
                  offset: -4,
                  fontSize: 9,
                  fontFamily: "var(--font-mono)",
                  fill: "var(--muted-foreground)",
                }}
              />
              <YAxis
                stroke="var(--muted-foreground)"
                tick={{ fontSize: 10, fontFamily: "var(--font-mono)" }}
                tickLine={false}
                label={{
                  value: "σᵢ",
                  angle: -90,
                  position: "insideLeft",
                  offset: 8,
                  fontSize: 10,
                  fontFamily: "var(--font-mono)",
                  fill: "var(--muted-foreground)",
                }}
              />
              <Tooltip
                contentStyle={{
                  background: "var(--panel)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                }}
                formatter={(value: number) => [`σ = ${value.toFixed(3)}`, "singular value"]}
              />
              <Bar dataKey="sigma" fill="var(--primary)" radius={[2, 2, 0, 0]} />
            </BarChart>
          ) : (
            <p className="text-sm text-muted-foreground">
              No spectrum available. Run a capture to generate the singular-value spectrum.
            </p>
          )}
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="fv-label">Rank-k reconstruction</h3>
        <div className="rounded-lg bg-card p-4 ring-1 ring-border">
          <div className="font-mono text-sm text-foreground">Aₖ = Σᵢ₌₁ᵏ σᵢ · uᵢ · vᵢᵀ</div>
          <p className="mt-2 text-xs text-muted-foreground">
            Truncating after the top-k singular triplets yields the best rank-k approximation of A
            in the Frobenius norm. Retained spectral energy at k=
            {analysis.ranks.find((r) => r.rank === Math.max(...analysis.ranks.map((x) => x.rank)))
              ?.rank ?? "—"}
            : {(retainedEnergy * 100).toFixed(1)}%
          </p>
        </div>
      </section>
    </div>
  );
}
