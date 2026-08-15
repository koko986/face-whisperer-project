import { useCallback, useEffect, useMemo, useState } from "react";
import { buildModel, type Participant } from "./face";

const KEY = "svd-facevault-participants";
const RUNS_KEY = "svd-facevault-runs";

function load(): Participant[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Participant[]) : [];
  } catch {
    return [];
  }
}

export function useVault() {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [runs, setRuns] = useState(0);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setParticipants(load());
    setRuns(Number(window.localStorage.getItem(RUNS_KEY) ?? 0));
    setHydrated(true);
  }, []);

  const persist = useCallback((next: Participant[]) => {
    setParticipants(next);
    window.localStorage.setItem(KEY, JSON.stringify(next));
  }, []);

  const addParticipant = useCallback(
    (name: string, samples: number[][], thumb: string) => {
      const next = [
        ...load().filter((p) => p.name.toLowerCase() !== name.toLowerCase()),
        { id: crypto.randomUUID(), name, samples, thumb },
      ];
      persist(next);
    },
    [persist],
  );

  const removeParticipant = useCallback(
    (id: string) => persist(load().filter((p) => p.id !== id)),
    [persist],
  );

  const countRun = useCallback(() => {
    setRuns((r) => {
      const next = r + 1;
      window.localStorage.setItem(RUNS_KEY, String(next));
      return next;
    });
  }, []);

  const model = useMemo(() => buildModel(participants), [participants]);

  return { participants, model, runs, hydrated, addParticipant, removeParticipant, countRun };
}
