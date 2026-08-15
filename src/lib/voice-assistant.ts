type SpeechRecognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: { results: SpeechRecognitionResultList }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
};

type SpeechRecognitionConstructor = new () => SpeechRecognition;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

export type VoiceState = "idle" | "listening" | "processing" | "speaking" | "error";

export type ParsedCommand =
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

export type VoiceAssistantOptions = {
  onCommand?: (command: ParsedCommand, transcript: string, reply: string) => void;
  onError?: (error: string) => void;
};

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

function getApiKey(): string {
  const key = import.meta.env["VITE_GROQ_API_KEY"];
  if (!key) {
    throw new Error(
      "Missing VITE_GROQ_API_KEY. Add it to .env at the project root and restart the dev server.",
    );
  }
  return key;
}

export function parseCommand(transcript: string): ParsedCommand {
  const t = transcript.toLowerCase();

  if (/\b(go to|open|show|switch to|navigate to)\b/.test(t)) {
    if (/\b(registration|register|enrol|enroll)\b/.test(t))
      return { type: "navigate", target: "register" };
    if (/\b(capture|live|camera|feed)\b/.test(t)) return { type: "navigate", target: "capture" };
    if (/\b(analytics|analysis|chart|graph|lab)\b/.test(t))
      return { type: "navigate", target: "analytics" };
  }

  if (/\b(start|turn on|enable)\b/.test(t)) {
    if (/\b(camera|feed|video)\b/.test(t)) return { type: "startCamera" };
    if (/\b(recognition|live|detect|identify)\b/.test(t)) return { type: "startRecognition" };
  }

  if (/\b(stop|turn off|disable)\b/.test(t)) {
    if (/\b(camera|feed|video)\b/.test(t)) return { type: "stopCamera" };
    if (/\b(recognition|live|detect)\b/.test(t)) return { type: "stopRecognition" };
  }

  if (/\b(capture|take photo|snapshot|freeze|shoot)\b/.test(t)) return { type: "capture" };
  if (/\b(upload|browse|open file|load photo)\b/.test(t)) return { type: "upload" };
  if (/\b(register|save face|commit|enrol subject)\b/.test(t)) return { type: "register" };
  if (/\b(delete|remove)\b/.test(t) && /\b(last|participant|subject|face)\b/.test(t))
    return { type: "deleteLast" };
  if (/\b(help|commands|what can you do|instructions)\b/.test(t)) return { type: "help" };

  return { type: "unknown" };
}

export function createVoiceAssistant(options: VoiceAssistantOptions = {}) {
  const recognition: SpeechRecognition | null = (() => {
    const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Ctor) return null;
    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";
    return rec;
  })();

  let state: VoiceState = "idle";
  let stateListeners: Array<(s: VoiceState) => void> = [];
  let transcriptListeners: Array<(text: string) => void> = [];
  let responseListeners: Array<(text: string) => void> = [];
  const history: { role: "user" | "assistant"; content: string }[] = [];
  let conversationActive = false;

  const MAX_HISTORY = 10;

  function setState(next: VoiceState) {
    state = next;
    stateListeners.forEach((fn) => fn(next));
  }

  function getState() {
    return state;
  }

  function isInConversation() {
    return conversationActive;
  }

  function onStateChange(fn: (s: VoiceState) => void) {
    stateListeners.push(fn);
    return () => {
      stateListeners = stateListeners.filter((f) => f !== fn);
    };
  }

  function onTranscript(fn: (text: string) => void) {
    transcriptListeners.push(fn);
    return () => {
      transcriptListeners = transcriptListeners.filter((f) => f !== fn);
    };
  }

  function onResponse(fn: (text: string) => void) {
    responseListeners.push(fn);
    return () => {
      responseListeners = responseListeners.filter((f) => f !== fn);
    };
  }

  function speak(text: string) {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 1;
    utter.pitch = 1;
    utter.volume = 1;
    utter.onstart = () => setState("speaking");
    utter.onend = () => {
      setState("listening");
      if (conversationActive && recognition) {
        try {
          recognition.start();
        } catch {
          // ignore restart errors
        }
      }
    };
    utter.onerror = () => {
      setState("listening");
      if (conversationActive && recognition) {
        try {
          recognition.start();
        } catch {
          // ignore restart errors
        }
      }
    };
    setState("speaking");
    window.speechSynthesis.speak(utter);
  }

  async function processWithGroq(transcript: string, context: string): Promise<string> {
    const apiKey = getApiKey();

    const systemPrompt = `You are a concise voice assistant for a face recognition research instrument.
Current context: ${context}
Available voice commands: go to registration, go to capture, go to analytics, start camera, stop camera, start live recognition, stop recognition, capture, upload photo, register face, delete last participant, help.
Rules:
- Keep replies under 25 words unless the user explicitly asks for detail.
- Do not reveal API keys or secrets.
- If the user asks to run an action, confirm it in one short sentence.
- Be helpful but terse.`;

    const messages = [
      { role: "system" as const, content: systemPrompt },
      ...history.slice(-MAX_HISTORY),
      { role: "user" as const, content: transcript },
    ];

    const res = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages,
        max_tokens: 120,
        temperature: 0.3,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Groq error ${res.status}: ${text}`);
    }

    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const reply = data.choices?.[0]?.message?.content?.trim() ?? "I couldn't process that.";

    history.push({ role: "user", content: transcript }, { role: "assistant", content: reply });
    if (history.length > MAX_HISTORY * 2) history.splice(0, history.length - MAX_HISTORY * 2);

    return reply;
  }

  async function handleTranscript(transcript: string, context: string) {
    transcript = transcript.trim();
    if (!transcript) return;
    transcriptListeners.forEach((fn) => fn(transcript));

    const command = parseCommand(transcript);
    let reply = "";
    let groqError: string | null = null;

    try {
      setState("processing");
      reply = await processWithGroq(transcript, context);
      responseListeners.forEach((fn) => fn(reply));
    } catch (error) {
      groqError = error instanceof Error ? error.message : "Unknown error";
      reply = `Command recognised. ${groqError}`;
      responseListeners.forEach((fn) => fn(reply));
    }

    options.onCommand?.(command, transcript, reply);

    if (groqError) {
      setState("error");
      options.onError?.(groqError);
      setTimeout(() => {
        if (conversationActive && recognition) {
          try {
            recognition.start();
          } catch {
            // ignore restart errors
          }
        }
      }, 3000);
    } else {
      speak(reply);
    }
  }

  async function startConversation(context: string) {
    if (!recognition) {
      options.onError?.("Speech recognition is not supported in this browser.");
      return;
    }
    if (conversationActive) {
      return;
    }

    conversationActive = true;
    history.length = 0;

    recognition.onresult = (event: { results: SpeechRecognitionResultList }) => {
      const last = event.results[event.results.length - 1];
      if (last && last.isFinal) {
        const transcript = last[0]?.transcript ?? "";
        void handleTranscript(transcript, context);
      }
    };
    recognition.onerror = (event: { error: string }) => {
      setState("error");
      options.onError?.(event.error);
      setTimeout(() => {
        if (conversationActive && recognition) {
          try {
            recognition.start();
          } catch {
            // ignore restart errors
          }
        }
      }, 3000);
    };
    recognition.onend = () => {
      if (conversationActive && state !== "processing" && state !== "speaking") {
        try {
          recognition.start();
        } catch {
          // ignore restart errors
        }
      }
    };
    recognition.onstart = () => setState("listening");

    try {
      setState("listening");
      recognition.start();
    } catch {
      setState("error");
      options.onError?.("Microphone access denied or unavailable.");
      conversationActive = false;
      setState("idle");
    }
  }

  function stopConversation() {
    conversationActive = false;
    if (recognition) {
      recognition.onend = null;
      try {
        recognition.abort();
      } catch {
        // ignore abort errors
      }
    }
    if (state === "listening") {
      setState("idle");
    }
  }

  function cancel() {
    stopConversation();
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    history.length = 0;
    setState("idle");
  }

  return {
    getState,
    setState,
    onStateChange,
    onTranscript,
    onResponse,
    startListening: startConversation,
    stopListening: stopConversation,
    cancel,
    speak,
    parseCommand,
    history,
    isInConversation,
  };
}
