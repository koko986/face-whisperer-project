import { useCallback, useEffect, useRef, useState } from "react";
import { createVoiceAssistant, type ParsedCommand, type VoiceState } from "@/lib/voice-assistant";

export type VoiceAction =
  | { type: "navigate"; target: "register" | "capture" | "analytics" }
  | { type: "startCamera" }
  | { type: "stopCamera" }
  | { type: "startRecognition" }
  | { type: "stopRecognition" }
  | { type: "capture" }
  | { type: "upload" }
  | { type: "register" }
  | { type: "deleteLast" }
  | { type: "help" }
  | { type: "unknown" };

export type UseVoiceAssistantOptions = {
  context?: string;
  onAction?: (action: VoiceAction) => void;
};

export function useVoiceAssistant(options: UseVoiceAssistantOptions = {}) {
  const [state, setState] = useState<VoiceState>("idle");
  const [lastTranscript, setLastTranscript] = useState("");
  const [lastResponse, setLastResponse] = useState("");
  const [error, setError] = useState<string | null>(null);
  const assistantRef = useRef<ReturnType<typeof createVoiceAssistant> | null>(null);

  if (!assistantRef.current) {
    assistantRef.current = createVoiceAssistant({
      onCommand: (command, transcript, reply) => {
        setLastTranscript(transcript);
        setLastResponse(reply);
        options.onAction?.(command);
      },
      onError: (message) => setError(message),
    });
  }

  const assistant = assistantRef.current;

  useEffect(() => {
    const unsub = assistant.onStateChange(setState);
    return unsub;
  }, [assistant]);

  const start = useCallback(() => {
    setError(null);
    assistant.startListening(options.context ?? "No active capture.");
  }, [assistant, options.context]);

  const stop = useCallback(() => {
    assistant.stopListening();
  }, [assistant]);

  const cancel = useCallback(() => {
    setLastTranscript("");
    setLastResponse("");
    setError(null);
    assistant.cancel();
  }, [assistant]);

  return {
    state,
    start,
    stop,
    cancel,
    lastTranscript,
    lastResponse,
    error,
  };
}
