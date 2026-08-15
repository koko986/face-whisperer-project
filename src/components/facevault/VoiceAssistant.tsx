import { Mic, MicOff, StopCircle, Volume2 } from "lucide-react";
import { useVoiceAssistant } from "@/hooks/useVoiceAssistant";

export function VoiceAssistant({
  context,
  onAction,
}: {
  context?: string;
  onAction?: (action: { type: string; target?: string | undefined }) => void;
}) {
  const { state, start, stop } = useVoiceAssistant({
    context: context ?? "No active capture.",
    onAction: (cmd) => {
      const mapped = { type: cmd.type, target: cmd.type === "navigate" ? cmd.target : undefined };
      onAction?.(mapped);
    },
  });

  const isListening = state === "listening";
  const isSpeaking = state === "speaking";
  const isProcessing = state === "processing";
  const isActive = isListening || isProcessing || isSpeaking;

  return (
    <>
      {/* Floating mic button */}
      <button
        onClick={() => {
          if (isActive) {
            stop();
          } else {
            start();
          }
        }}
        className={`fixed bottom-6 right-6 z-50 flex size-12 items-center justify-center rounded-full shadow-lg transition-all ${
          isListening
            ? "bg-primary text-primary-foreground animate-pulse"
            : isSpeaking
              ? "bg-emerald-500 text-white"
              : isProcessing
                ? "bg-amber-500 text-white animate-pulse"
                : state === "error"
                  ? "bg-destructive text-white"
                  : "bg-card text-foreground ring-1 ring-border hover:bg-secondary"
        }`}
        title={isListening ? "Stop conversation" : "Start voice conversation"}
      >
        {isListening ? (
          <MicOff className="size-5" />
        ) : isSpeaking ? (
          <Volume2 className="size-5" />
        ) : (
          <Mic className="size-5" />
        )}
      </button>

      {/* Minimal status when active */}
      {isActive && (
        <div className="fixed bottom-20 right-6 z-50 flex items-center gap-3 rounded-xl bg-card/95 px-4 py-2.5 shadow-xl ring-1 ring-border backdrop-blur">
          <span className="font-mono text-[10px] uppercase text-muted-foreground">
            {isListening ? "Listening..." : isProcessing ? "Thinking..." : "Speaking..."}
          </span>
          <button
            onClick={stop}
            className="text-muted-foreground transition-colors hover:text-foreground"
            title="Stop conversation"
          >
            <StopCircle className="size-4" />
          </button>
        </div>
      )}
    </>
  );
}
