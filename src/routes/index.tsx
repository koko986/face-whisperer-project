import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { BarChart3, ScanFace, UserRoundPlus } from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import { AnalyticsView } from "@/components/facevault/AnalyticsView";
import { CaptureView } from "@/components/facevault/CaptureView";
import { RegisterView } from "@/components/facevault/RegisterView";
import type { Analysis } from "@/components/facevault/types";
import { useVault } from "@/lib/facevault/store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SVD FaceVault — Eigenface Recognition Instrument" },
      {
        name: "description",
        content:
          "Research instrument for eigenface recognition: enrol subjects by photo or video, run live recognition, and study how SVD rank truncation affects confidence.",
      },
      { property: "og:title", content: "SVD FaceVault — Eigenface Recognition Instrument" },
      {
        property: "og:description",
        content:
          "Enrol faces by photo or guided video capture, run live recognition, and chart confidence against SVD compression rank.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: FaceVault,
});

type View = "register" | "capture" | "analytics";

const NAV: { id: View; label: string; icon: typeof ScanFace }[] = [
  { id: "register", label: "Registration", icon: UserRoundPlus },
  { id: "capture", label: "Capture view", icon: ScanFace },
  { id: "analytics", label: "Analytics lab", icon: BarChart3 },
];

function FaceVault() {
  const [view, setView] = useState<View>("register");
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const vault = useVault();

  const frames = vault.participants.reduce((s, p) => s + p.samples.length, 0);

  return (
    <div className="min-h-screen bg-panel text-foreground selection:bg-primary/30">
      <header className="sticky top-0 z-50 flex h-10 items-center justify-between border-b border-border bg-card/80 px-4 backdrop-blur-md">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="fv-blink size-2 rounded-full bg-primary" />
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              System status: {vault.model ? "basis calibrated" : "awaiting enrolment"}
            </span>
          </div>
          <div className="hidden gap-4 border-l border-border pl-4 md:flex">
            <Telemetry k="dim" v="64×64" />
            <Telemetry k="basis" v={String(vault.model?.basis.length ?? 0)} />
            <Telemetry k="frames" v={String(frames)} />
          </div>
        </div>
        <span className="font-mono text-[10px] uppercase tabular-nums text-muted-foreground">
          Session · SVD-RX-{String(vault.runs).padStart(4, "0")}
        </span>
      </header>

      <div className="flex">
        <aside className="sticky top-10 hidden h-[calc(100vh-2.5rem)] w-64 shrink-0 flex-col gap-8 border-r border-border bg-sidebar p-4 md:flex">
          <div className="space-y-1">
            <h1 className="text-xl font-semibold tracking-tight text-foreground">SVD FaceVault</h1>
            <p className="font-mono text-xs text-muted-foreground">eigenface engine · v4.2</p>
          </div>

          <nav className="flex flex-col gap-1">
            {NAV.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setView(id)}
                className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium transition-colors ${
                  view === id
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <span
                  className={`grid size-4 shrink-0 place-items-center rounded-sm ${
                    view === id ? "bg-primary/20" : "bg-secondary"
                  }`}
                >
                  <Icon className={`size-2.5 ${view === id ? "text-primary" : "text-muted-foreground"}`} />
                </span>
                {label}
              </button>
            ))}
          </nav>

          <div className="mt-auto space-y-4 border-t border-border pt-4">
            <div className="space-y-1">
              <div className="flex justify-between font-mono text-[10px] uppercase text-muted-foreground">
                <span>Basis saturation</span>
                <span className="text-foreground">
                  {Math.min(100, Math.round(((vault.model?.basis.length ?? 0) / 24) * 100))}%
                </span>
              </div>
              <div className="h-1 overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full bg-primary transition-all"
                  style={{
                    width: `${Math.min(100, ((vault.model?.basis.length ?? 0) / 24) * 100)}%`,
                  }}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Stat label="Subjects" value={String(vault.participants.length).padStart(2, "0")} />
              <Stat label="Runs" value={String(vault.runs).padStart(2, "0")} />
            </div>
          </div>
        </aside>

        <main className="w-full max-w-[1200px] flex-1 p-6">
          {view === "register" && (
            <RegisterView
              participants={vault.participants}
              onRegister={vault.addParticipant}
              onRemove={vault.removeParticipant}
            />
          )}
          {view === "capture" && (
            <CaptureView
              model={vault.model}
              onAnalysis={(a) => {
                setAnalysis(a);
                vault.countRun();
                setView("analytics");
              }}
            />
          )}
          {view === "analytics" && <AnalyticsView analysis={analysis} />}
        </main>
      </div>

      <nav className="sticky bottom-0 flex border-t border-border bg-card/90 backdrop-blur md:hidden">
        {NAV.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setView(id)}
            className={`flex flex-1 flex-col items-center gap-1 py-2 text-[10px] ${
              view === id ? "text-primary" : "text-muted-foreground"
            }`}
          >
            <Icon className="size-4" />
            {label}
          </button>
        ))}
      </nav>

      <Toaster />
    </div>
  );
}

function Telemetry({ k, v }: { k: string; v: string }) {
  return (
    <span className="font-mono text-[10px] uppercase text-muted-foreground">
      {k}: <span className="text-foreground">{v}</span>
    </span>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded bg-card p-2 ring-1 ring-border">
      <span className="block font-mono text-[10px] uppercase text-muted-foreground">{label}</span>
      <span className="font-mono text-lg text-foreground">{value}</span>
    </div>
  );
}
