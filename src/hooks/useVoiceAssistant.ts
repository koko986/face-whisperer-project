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

export type ConversationTurn = {
  id: string;
  role: "user" | "assistant";
  content: string;
  at: number;
};

export type UseVoiceAssistantOptions = {
  context?: string;
  onAction?: (action: VoiceAction) => void;
};

export function useVoiceAssistant(options: UseVoiceAssistantOptions = {}) {
  const [state, setState] = useState<VoiceState>("idle");
  const [conversation, setConversation] = useState<ConversationTurn[]>([]);
  const assistantRef = useRef<ReturnType<typeof createVoiceAssistant> | null>(null);

  if (!assistantRef.current) {
    assistantRef.current = createVoiceAssistant({
      onCommand: (command, transcript, reply) => {
        const now = Date.now();
        setConversation((prev) => [
          ...prev,
          { id: `${now}-u`, role: "user", content: transcript, at: now },
          { id: `${now}-a`, role: "assistant", content: reply, at: now },
        ]);
        options.onAction?.(command);
      },
      onError: (message) => {
        const now = Date.now();
        setConversation((prev) => [
          ...prev,
          { id: `${now}-a`, role: "assistant", content: `Error: ${message}`, at: now },
        ]);
      },
    });
  }

  const assistant = assistantRef.current;

  useEffect(() => {
    const unsub = assistant.onStateChange(setState);
    return unsub;
  }, [assistant]);

  const start = useCallback(() => {
    assistant.startListening(options.context ?? "No active capture.");
  }, [assistant, options.context]);

  const stop = useCallback(() => {
    assistant.stopListening();
  }, [assistant]);

  const cancel = useCallback(() => {
    assistant.cancel();
    setConversation([]);
  }, [assistant]);

  return {
    state,
    start,
    stop,
    cancel,
    conversation,
  };
}
