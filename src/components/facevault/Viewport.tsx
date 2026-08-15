import type { ReactNode, RefObject } from "react";

export function Viewport({
  videoRef,
  active,
  hint,
  overlay,
  children,
}: {
  videoRef: RefObject<HTMLVideoElement | null>;
  active: boolean;
  hint: string;
  overlay?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-panel ring-1 ring-border">
      <div className="fv-grid absolute inset-0" />
      <video
        ref={videoRef}
        muted
        playsInline
        className={`h-full w-full object-cover transition-opacity duration-500 ${
          active ? "opacity-100" : "opacity-0"
        }`}
      />

      {!active && (
        <div className="absolute inset-0 grid place-items-center px-8 text-center">
          <p className="max-w-[46ch] text-sm text-muted-foreground">{hint}</p>
        </div>
      )}

      {/* alignment reticle */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="relative grid size-64 place-items-center rounded-full border border-primary/15">
          <div className="relative size-48 rounded-full border border-primary/35">
            <span className="absolute left-1/2 top-0 h-6 w-px -translate-x-1/2 bg-primary/70" />
            <span className="absolute bottom-0 left-1/2 h-6 w-px -translate-x-1/2 bg-primary/70" />
            <span className="absolute left-0 top-1/2 h-px w-6 -translate-y-1/2 bg-primary/70" />
            <span className="absolute right-0 top-1/2 h-px w-6 -translate-y-1/2 bg-primary/70" />
          </div>
        </div>
      </div>

      {active && (
        <div className="fv-scanline pointer-events-none absolute inset-x-0 top-0 h-px bg-primary/40 blur-[1px]" />
      )}

      <div className="pointer-events-none absolute inset-0 p-4">
        <span className="absolute left-4 top-4 size-6 border-l border-t border-primary/40" />
        <span className="absolute right-4 top-4 size-6 border-r border-t border-primary/40" />
        <span className="absolute bottom-4 left-4 size-6 border-b border-l border-primary/40" />
        <span className="absolute bottom-4 right-4 size-6 border-b border-r border-primary/40" />
      </div>

      {overlay}
      {children}
    </div>
  );
}
