import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Radar, ScanLine, Upload } from "lucide-react";
import { toast } from "sonner";
import {
  classify,
  compressionSweep,
  fileToFace,
  sourceToFace,
  subjectScore,
  type FaceModel,
  type MatchResult,
} from "@/lib/facevault/face";
import type { Analysis } from "./types";
import { useCamera } from "./useCamera";
import { Viewport } from "./Viewport";
import { VoiceAssistant } from "./VoiceAssistant";

export function CaptureView({
  model,
  onAnalysis,
  onVoiceAction,
}: {
  model: FaceModel | null;
  onAnalysis: (a: Analysis) => void;
  onVoiceAction?: (action: { type: string; target?: string | undefined }) => void;
}) {
  const camera = useCamera();
  const [live, setLive] = useState(false);
  const [match, setMatch] = useState<MatchResult | null>(null);
  const [detected, setDetected] = useState(false);
  const loop = useRef<ReturnType<typeof setInterval> | null>(null);

  const startLive = useCallback(async () => {
    if (!model) {
      toast.error("Register at least two participants first");
      return;
    }
    if (!camera.active) await camera.start();
    setLive(true);
    loop.current = setInterval(() => {
      const video = camera.videoRef.current;
      if (!video || video.videoWidth === 0) return;
      const face = sourceToFace(video, video.videoWidth, video.videoHeight);
      const present = subjectScore(face.vec) >= 0.05;
      setDetected(present);
      setMatch(present ? classify(face.vec, model) : null);
    }, 500);
  }, [model, camera]);

  const stopLive = useCallback(() => {
    if (loop.current) clearInterval(loop.current);
    loop.current = null;
    setLive(false);
  }, []);

  useEffect(() => () => stopLive(), [stopLive]);

  const analyse = useCallback(
    (vec: Float64Array<ArrayBufferLike>, preview: string, origin: string) => {
      const base = classify(vec, model);
      const { ranks, singularValues } = compressionSweep(vec, model);
      onAnalysis({ preview, base, ranks, singularValues, origin, at: Date.now() });
      toast.success("Compression sweep complete — see Analytics Lab");
    },
    [model, onAnalysis],
  );

  const snapshot = useCallback(() => {
    const video = camera.videoRef.current;
    if (!video || video.videoWidth === 0) {
      toast.error("Start the camera feed first");
      return;
    }
    const face = sourceToFace(video, video.videoWidth, video.videoHeight);
    analyse(face.vec, face.preview, "live frame");
  }, [camera, analyse]);

  const onUpload = async (file?: File) => {
    if (!file) return;
    const face = await fileToFace(file);
    analyse(face.vec, face.preview, file.name);
  };

  const handleVoiceAction = useCallback(
    (action: { type: string; target?: string | undefined }) => {
      onVoiceAction?.(action);

      switch (action.type) {
        case "startCamera":
          if (!camera.active) void camera.start();
          break;
        case "stopCamera":
          if (camera.active) {
            stopLive();
            camera.stop();
          }
          break;
        case "startRecognition":
          if (!live) void startLive();
          break;
        case "stopRecognition":
          if (live) stopLive();
          break;
        case "capture":
          snapshot();
          break;
        case "upload":
          document.getElementById("voice-upload-input")?.click();
          break;
        default:
          break;
      }
    },
    [camera, live, onVoiceAction, snapshot, startLive, stopLive],
  );

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <p className="fv-label">Section 02 // Active viewport</p>
          <p className="max-w-[56ch] text-pretty text-muted-foreground">
            Calibrated optical feed with real-time vector alignment. Keep the subject inside the
            primary reticle for a valid SVD extraction.
          </p>
        </div>
        <div className="rounded px-3 py-1 font-mono text-[10px] text-primary ring-1 ring-primary/30">
          BASIS: {model ? `${model.basis.length} EIGENFACES` : "UNCALIBRATED"}
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Viewport
            videoRef={camera.videoRef}
            active={camera.active}
            hint="Optical feed idle. Press Start feed to bring the sensor online."
            overlay={
              camera.active ? (
                <div className="pointer-events-none absolute left-6 top-1/2 -translate-y-1/2 space-y-1 font-mono text-[9px] text-primary/70">
                  <div>DET: {detected ? "SUBJECT" : "NONE"}</div>
                  <div>BASIS: {model?.basis.length ?? 0}</div>
                  <div>MODE: {live ? "LIVE" : "IDLE"}</div>
                </div>
              ) : null
            }
          >
            {camera.active && match?.name && (
              <div className="absolute right-6 top-6 rounded bg-panel/85 px-3 py-1.5 font-mono text-xs text-primary ring-1 ring-primary/40 backdrop-blur">
                MATCH {match.name.toUpperCase()} · {(match.confidence * 100).toFixed(1)}%
              </div>
            )}
          </Viewport>

          <div className="mx-auto flex w-fit gap-1 rounded-lg bg-card/80 p-1.5 ring-1 ring-border backdrop-blur">
            <button
              onClick={() => (camera.active ? (stopLive(), camera.stop()) : camera.start())}
              className="flex items-center gap-2 rounded px-4 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <span className="font-mono text-[10px]">[01]</span>
              <Camera className="size-3.5" /> {camera.active ? "Stop feed" : "Start feed"}
            </button>
            <span className="w-px bg-border" />
            <button
              onClick={live ? stopLive : startLive}
              className={`flex items-center gap-2 rounded px-4 py-2 text-sm transition-colors ${
                live ? "text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <span className="font-mono text-[10px]">[02]</span>
              <Radar className={`size-3.5 ${live ? "fv-blink" : ""}`} />
              {live ? "Recognition on" : "Live recognition"}
            </button>
            <span className="w-px bg-border" />
            <button
              onClick={snapshot}
              className="flex items-center gap-2 rounded px-4 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <span className="font-mono text-[10px]">[03]</span>
              <ScanLine className="size-3.5" /> Capture &amp; analyse
            </button>
          </div>
          {camera.error && <p className="text-center text-xs text-destructive">{camera.error}</p>}
        </div>

        <aside className="space-y-4">
          <div className="rounded-lg bg-card p-4 ring-1 ring-border">
            <p className="fv-label">Live recognition</p>
            {match ? (
              <div className="mt-3 space-y-2">
                <div className="flex items-end justify-between gap-2">
                  <p className="truncate text-2xl font-mono text-primary">
                    {match.name ?? "UNKNOWN"}
                  </p>
                  <span className="shrink-0 font-mono text-[10px] uppercase text-muted-foreground">
                    {(match.confidence * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="h-1 overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full bg-primary transition-all duration-500"
                    style={{ width: `${Math.round(match.confidence * 100)}%` }}
                  />
                </div>
                {match.candidates.length > 1 && (
                  <div className="mt-2 space-y-1">
                    {match.candidates.slice(1).map((c) => (
                      <div key={c.name} className="flex items-center justify-between text-[11px]">
                        <span className="font-mono text-muted-foreground">{c.name}</span>
                        <span className="font-mono text-muted-foreground">
                          {(c.confidence * 100).toFixed(0)}%
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <p className="mt-2 text-lg font-mono text-muted-foreground">
                {detected ? "UNKNOWN" : "NO SUBJECT"}
              </p>
            )}
          </div>

          <div className="space-y-3 rounded-lg bg-card p-4 ring-1 ring-border">
            <p className="fv-label">Offline specimen</p>
            <label className="flex cursor-pointer flex-col items-center gap-2 rounded-md border border-dashed border-border px-4 py-6 text-center transition-colors hover:border-primary/40">
              <Upload className="size-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">
                Upload a photo to run the same sweep
              </span>
              <input
                id="voice-upload-input"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => onUpload(e.target.files?.[0])}
              />
            </label>
          </div>
        </aside>
      </div>

      <VoiceAssistant
        context={
          model
            ? `Currently detected: ${match?.name ?? "unknown subject"}. Model has ${model.basis.length} eigenfaces. Available commands: go to registration, go to analytics, start camera, stop camera, start live recognition, stop recognition, capture, upload photo, help.`
            : "Model not yet calibrated. Register participants first."
        }
        onAction={handleVoiceAction}
      />
    </div>
  );
}
