import { Mic, MicOff, Send, Volume2, VolumeX } from "lucide-react";
import { useVoiceAssistant } from "@/hooks/useVoiceAssistant";
import { parseCommand } from "@/lib/voice-assistant";

export function VoiceAssistant({
  context,
  onAction,
}: {
  context?: string;
  onAction?: (action: { type: string; target?: string | undefined }) => void;
}) {
  const { state, start, stop, cancel, lastTranscript, lastResponse, error } = useVoiceAssistant({
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

  const handleManualSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const input = e.currentTarget.elements.namedItem("voice-text") as HTMLInputElement | null;
    const text = input?.value?.trim();
    if (!text) return;
    const command = parseCommand(text);
    onAction?.({
      type: command.type,
      target: command.type === "navigate" ? command.target : undefined,
    });
    if (input) input.value = "";
  };

  return (
    <>
      {/* Floating pill */}
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
        title={isListening ? "Stop listening" : "Start voice assistant"}
      >
        {isListening ? (
          <MicOff className="size-5" />
        ) : isSpeaking ? (
          <Volume2 className="size-5" />
        ) : (
          <Mic className="size-5" />
        )}
      </button>

      {/* Expanded panel */}
      {(isActive || lastTranscript || lastResponse || error) && (
        <div className="fixed bottom-20 right-6 z-50 w-80 space-y-3 rounded-xl bg-card/95 p-4 shadow-xl ring-1 ring-border backdrop-blur">
          <div className="flex items-center justify-between">
            <p className="fv-label">Voice</p>
            <button
              onClick={cancel}
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              <VolumeX className="size-4" />
            </button>
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}

          {lastTranscript && (
            <div>
              <p className="font-mono text-[10px] uppercase text-muted-foreground">You said</p>
              <p className="mt-1 text-sm text-foreground">{lastTranscript}</p>
            </div>
          )}

          {lastResponse && (
            <div>
              <p className="font-mono text-[10px] uppercase text-muted-foreground">Assistant</p>
              <div className="mt-1 flex items-start gap-2">
                <Volume2 className="mt-0.5 size-3 shrink-0 text-primary" />
                <p className="text-sm text-foreground">{lastResponse}</p>
              </div>
            </div>
          )}

          {!lastTranscript && !lastResponse && !error && (
            <p className="text-xs text-muted-foreground">
              {isListening
                ? "Listening..."
                : isProcessing
                  ? "Thinking..."
                  : isSpeaking
                    ? "Speaking..."
                    : "Tap the mic to start"}
            </p>
          )}

          <form onSubmit={handleManualSubmit} className="flex gap-2">
            <input
              name="voice-text"
              type="text"
              placeholder="Type a command..."
              className="flex-1 rounded-md bg-secondary px-3 py-1.5 text-xs text-foreground outline-none ring-1 ring-border placeholder:text-muted-foreground focus:ring-primary/60"
            />
            <button
              type="submit"
              className="flex items-center justify-center rounded-md bg-primary px-3 py-1.5 text-primary-foreground transition hover:brightness-110"
            >
              <Send className="size-3.5" />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
