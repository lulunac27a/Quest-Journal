// src/hooks/useSymbols.js
import { useCallback, useState } from "react";
import { uid, SYMBOLS } from "../utils/constants.js";

export default function useSymbols() {
  const [symbols, setSymbols] = useState([]);

  const addSymbol = useCallback(
    (char) => {
      if (!char) return;
      setSymbols((s) => [...s.slice(-9), { id: uid(), char }]);
    },
    [setSymbols],
  );

  const addRandomSymbol = useCallback(() => {
    const next = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
    if (next) addSymbol(next);
  }, [addSymbol]);

  const resetSymbols = useCallback(() => setSymbols([]), []);

  return { symbols, addSymbol, addRandomSymbol, resetSymbols };
}
