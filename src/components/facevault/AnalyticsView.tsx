import { SVDEquationView } from "./SVDEquationView";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Analysis } from "./types";
import { VoiceAssistant } from "./VoiceAssistant";

export function AnalyticsView({
  analysis,
  onVoiceAction,
}: {
  analysis: Analysis | null;
  onVoiceAction?: (action: { type: string; target?: string | undefined }) => void;
}) {
  const data =
    analysis?.ranks.map((r) => ({
      rank: `k=${r.rank}`,
      confidence: Math.round(r.confidence * 1000) / 10,
      energy: Math.round(r.energy * 1000) / 10,
    })) ?? [];

  const best = analysis?.ranks.reduce((a, b) => (b.confidence > a.confidence ? b : a));

  return (
    <div className="space-y-8">
      <header className="space-y-1 border-b border-border pb-4">
        <p className="fv-label">Section 03 // Compression lab</p>
        <h2 className="text-2xl font-medium tracking-tight text-foreground">
          Rank-truncated recognition sweep
        </h2>
      </header>

      {!analysis ? (
        <p className="text-sm text-muted-foreground">
          No experiment on the bench. Run{" "}
          <span className="text-foreground">Capture &amp; analyse</span> or upload a specimen from
          the capture view.
        </p>
      ) : (
        <>
          <SVDEquationView analysis={analysis} />

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="space-y-2">
              <Metric
                label="Original prediction"
                value={analysis.base.name ?? "UNKNOWN"}
                sub={`${(analysis.base.confidence * 100).toFixed(1)}% confidence · ${analysis.origin}`}
                accent
              />
              {analysis.base.candidates.length > 1 && (
                <div className="space-y-1 rounded-lg bg-card p-3 ring-1 ring-border">
                  <p className="fv-label">Top candidates</p>
                  {analysis.base.candidates.map((c, i) => (
                    <div key={c.name} className="flex items-center justify-between text-[11px]">
                      <span className="font-mono text-muted-foreground">
                        {i + 1}. {c.name}
                      </span>
                      <span className="font-mono text-muted-foreground">
                        {(c.confidence * 100).toFixed(0)}%
                      </span>
                    </div>
                  ))}
                </div>
              )}
              <Metric
                label="Recommended rank (k)"
                value={String(best?.rank ?? "—")}
                sub={`${((best?.energy ?? 0) * 100).toFixed(1)}% spectral energy retained`}
              />
              <Metric
                label="Peak confidence"
                value={`${((best?.confidence ?? 0) * 100).toFixed(1)}%`}
                sub={`identified as ${best?.name ?? "unknown"}`}
              />
            </div>

            <div className="space-y-3 lg:col-span-2">
              <div className="flex items-center justify-between">
                <h3 className="fv-label">Confidence vs. singular-value rank</h3>
                <div className="flex gap-4 font-mono text-[10px]">
                  <span className="flex items-center gap-1.5 text-primary">
                    <span className="size-1.5 rounded-full bg-primary" /> confidence
                  </span>
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <span className="size-1.5 rounded-full bg-muted-foreground" /> energy
                  </span>
                </div>
              </div>
              <div className="h-72 rounded-lg bg-card p-4 ring-1 ring-border">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
                    <CartesianGrid stroke="var(--border)" strokeDasharray="2 4" />
                    <XAxis
                      dataKey="rank"
                      stroke="var(--muted-foreground)"
                      tick={{ fontSize: 10, fontFamily: "var(--font-mono)" }}
                      tickLine={false}
                    />
                    <YAxis
                      domain={[0, 100]}
                      stroke="var(--muted-foreground)"
                      tick={{ fontSize: 10, fontFamily: "var(--font-mono)" }}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "var(--panel)",
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                        fontFamily: "var(--font-mono)",
                        fontSize: 11,
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="confidence"
                      stroke="var(--primary)"
                      strokeWidth={2}
                      dot={{ r: 3, fill: "var(--primary)" }}
                    />
                    <Line
                      type="monotone"
                      dataKey="energy"
                      stroke="var(--muted-foreground)"
                      strokeWidth={1.5}
                      strokeDasharray="4 4"
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <section className="space-y-3">
            <h3 className="fv-label">Reconstruction thumbnails</h3>
            <div className="flex gap-3 overflow-x-auto pb-2">
              <figure className="w-32 flex-none rounded-md bg-card p-1.5 ring-1 ring-border">
                <img src={analysis.preview} alt="original capture" className="w-full rounded-sm" />
                <figcaption className="pt-1.5 text-center font-mono text-[10px] uppercase text-muted-foreground">
                  raw input
                </figcaption>
              </figure>
              {analysis.ranks.map((r) => (
                <figure
                  key={r.rank}
                  className={`w-32 flex-none rounded-md bg-card p-1.5 ring-1 transition-colors ${
                    r.rank === best?.rank ? "ring-primary/60" : "ring-border"
                  }`}
                >
                  <img
                    src={r.preview}
                    alt={`rank ${r.rank} reconstruction`}
                    className="w-full rounded-sm"
                  />
                  <figcaption className="space-y-0.5 pt-1.5 text-center">
                    <p
                      className={`font-mono text-[10px] uppercase ${
                        r.rank === best?.rank ? "text-primary" : "text-muted-foreground"
                      }`}
                    >
                      k={r.rank}
                    </p>
                    <p className="font-mono text-[10px] text-foreground">
                      {(r.confidence * 100).toFixed(0)}% · {r.name ?? "—"}
                    </p>
                  </figcaption>
                </figure>
              ))}
            </div>
          </section>

          <VoiceAssistant
            context={`Analytics lab. Best rank: ${best?.rank ?? "—"} at ${((best?.energy ?? 0) * 100).toFixed(1)}% energy. Available commands: go to registration, go to capture, help.`}
            onAction={(action) => {
              onVoiceAction?.(action);
            }}
          />
        </>
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-lg bg-card p-4 ring-1 ring-border">
      <p className="fv-label">{label}</p>
      <p
        className={`mt-1 truncate font-mono text-2xl ${accent ? "text-primary" : "text-foreground"}`}
      >
        {value}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{sub}</p>
    </div>
  );
}
