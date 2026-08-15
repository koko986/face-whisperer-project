import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Images, Loader2, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { fileToFace, sourceToFace, subjectScore, type Participant } from "@/lib/facevault/face";
import { useCamera } from "./useCamera";
import { Viewport } from "./Viewport";

type Sample = { vec: number[]; preview: string };

const GUIDED_FRAMES = 6;

export function RegisterView({
  participants,
  onRegister,
  onRemove,
}: {
  participants: Participant[];
  onRegister: (name: string, samples: number[][], thumb: string) => void;
  onRemove: (id: string) => void;
}) {
  const [mode, setMode] = useState<"photos" | "video">("photos");
  const [name, setName] = useState("");
  const [samples, setSamples] = useState<Sample[]>([]);
  const [busy, setBusy] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const camera = useCamera();
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopGuided = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    setCapturing(false);
  }, []);

  useEffect(() => () => stopGuided(), [stopGuided]);

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    const next: Sample[] = [];
    for (const file of Array.from(files)) {
      try {
        const face = await fileToFace(file);
        next.push({ vec: Array.from(face.vec), preview: face.preview });
      } catch {
        /* skip unreadable file */
      }
    }
    setSamples((s) => [...s, ...next]);
    setBusy(false);
    toast.success(`${next.length} frames vectorised`);
  };

  const startGuided = async () => {
    if (!camera.active) await camera.start();
    setCapturing(true);
    let taken = 0;
    timer.current = setInterval(() => {
      const video = camera.videoRef.current;
      if (!video || video.videoWidth === 0) return;
      const face = sourceToFace(video, video.videoWidth, video.videoHeight);
      if (subjectScore(face.vec) < 0.05) return;
      setSamples((s) => [...s, { vec: Array.from(face.vec), preview: face.preview }]);
      taken += 1;
      if (taken >= GUIDED_FRAMES) {
        stopGuided();
        toast.success("Guided capture complete — 6 frames stored");
      }
    }, 650);
  };

  const commit = () => {
    if (!name.trim()) {
      toast.error("Participant name required");
      return;
    }
    if (samples.length < 2) {
      toast.error("At least 2 training frames required");
      return;
    }
    onRegister(
      name.trim(),
      samples.map((s) => s.vec),
      samples[0]!.preview,
    );
    setName("");
    setSamples([]);
    stopGuided();
    camera.stop();
    toast.success("Face set registered — eigenbasis rebuilt");
  };

  return (
    <div className="space-y-10">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-4">
        <div className="space-y-1">
          <p className="fv-label">Section 01 // Enrolment</p>
          <h2 className="text-2xl font-medium tracking-tight text-foreground">
            Participant Registration
          </h2>
        </div>
        <div className="flex rounded-md ring-1 ring-border">
          <button
            onClick={() => {
              setMode("photos");
              stopGuided();
              camera.stop();
            }}
            className={`flex items-center gap-2 rounded-l-md px-4 py-2 text-sm transition-colors ${
              mode === "photos"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Images className="size-3.5" /> Photos
          </button>
          <button
            onClick={() => setMode("video")}
            className={`flex items-center gap-2 rounded-r-md px-4 py-2 text-sm transition-colors ${
              mode === "video"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Camera className="size-3.5" /> Video
          </button>
        </div>
      </header>

      <section className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {mode === "video" ? (
            <>
              <Viewport
                videoRef={camera.videoRef}
                active={camera.active}
                hint="Guided capture — look straight into the lens. Once the subject is centred the instrument samples 6 frames automatically."
              />
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => (camera.active ? camera.stop() : camera.start())}
                  className="rounded-md px-4 py-2 text-sm font-medium ring-1 ring-border transition-colors hover:bg-secondary"
                >
                  {camera.active ? "Stop feed" : "Start feed"}
                </button>
                <button
                  onClick={capturing ? stopGuided : startGuided}
                  className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:brightness-110"
                >
                  {capturing ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Camera className="size-3.5" />
                  )}
                  {capturing ? "Sampling…" : "Run guided capture"}
                </button>
              </div>
              {camera.error && <p className="text-xs text-destructive">{camera.error}</p>}
            </>
          ) : (
            <label className="flex aspect-video w-full cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-card/40 transition-colors hover:border-primary/40">
              <div className="fv-grid absolute" />
              {busy ? (
                <Loader2 className="size-6 animate-spin text-primary" />
              ) : (
                <Images className="size-6 text-muted-foreground" />
              )}
              <p className="text-sm text-muted-foreground">
                Drop or browse training photos — multiple angles improve the eigenbasis
              </p>
              <p className="fv-label">accepted: jpg / png / webp</p>
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => onFiles(e.target.files)}
              />
            </label>
          )}
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="fv-label" htmlFor="pname">
              Participant name
            </label>
            <input
              id="pname"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. aung"
              className="w-full rounded-md bg-card px-3 py-2 text-sm text-foreground ring-1 ring-border outline-none placeholder:text-muted-foreground focus:ring-primary/60"
            />
          </div>

          <div className="rounded-lg bg-card p-3 ring-1 ring-border">
            <div className="mb-3 flex items-center justify-between">
              <span className="fv-label">Buffered frames</span>
              <span className="font-mono text-xs text-foreground">
                {String(samples.length).padStart(2, "0")}
              </span>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {samples.slice(-8).map((s, i) => (
                <img
                  key={i}
                  src={s.preview}
                  alt="training frame"
                  className="aspect-square w-full rounded-sm object-cover ring-1 ring-border"
                />
              ))}
              {samples.length === 0 && (
                <p className="col-span-4 py-4 text-center text-xs text-muted-foreground">
                  No frames buffered
                </p>
              )}
            </div>
          </div>

          <button
            onClick={commit}
            className="flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition hover:brightness-110"
          >
            <UserPlus className="size-4" /> Register face set
          </button>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="fv-label">Registry // {participants.length} subjects</h3>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {participants.map((p) => (
            <article
              key={p.id}
              className="flex gap-4 rounded-lg bg-card p-4 ring-1 ring-border transition-colors hover:ring-primary/30"
            >
              <img
                src={p.thumb}
                alt={`${p.name} reference frame`}
                className="size-16 shrink-0 rounded-md object-cover ring-1 ring-border"
              />
              <div className="flex min-w-0 flex-1 flex-col justify-between">
                <div>
                  <h4 className="truncate text-sm font-medium text-foreground">{p.name}</h4>
                  <p className="font-mono text-xs text-muted-foreground">
                    UID: {p.id.slice(0, 4).toUpperCase()}-{p.samples.length}
                  </p>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] uppercase text-muted-foreground">
                    {String(p.samples.length).padStart(2, "0")} samples
                  </span>
                  <button
                    onClick={() => onRemove(p.id)}
                    className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-destructive/80 transition-colors hover:text-destructive"
                  >
                    <Trash2 className="size-3" /> Delete
                  </button>
                </div>
              </div>
            </article>
          ))}
          {participants.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Registry empty — enrol a subject to build the eigenbasis.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
