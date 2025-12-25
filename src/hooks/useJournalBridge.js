// src/hooks/useJournalBridge.js
import { useEffect, useState } from "react";

export default function useJournalBridge(_lastActionRef) {
  const [journalTick, setJournalTick] = useState(0);
  useEffect(() => {
    const handler = () => {
      setJournalTick((x) => x + 1);
    };
    try { window.addEventListener("qj:journal-updated", handler); } catch {}
    return () => { try { window.removeEventListener("qj:journal-updated", handler); } catch {} };
  }, []);

  return journalTick;
}
