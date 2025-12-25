// src/hooks/useTaskComposer.js
import { useState, useMemo } from "react";

export default function useTaskComposer() {
  const [text, setText] = useState("");
  const [aiText, setAiText] = useState("");
  const [xpInput, setXpInput] = useState("");
  const [deadlineAmt, setDeadlineAmt] = useState("");
  const [deadlineUnit, setDeadlineUnit] = useState("h");
  const [absoluteDue, setAbsoluteDue] = useState(null);
  const [desc, setDesc] = useState("");
  const [recur, setRecur] = useState("none");
  const [recurCustom, setRecurCustom] = useState([]);
  const [recurWeeklyDays, setRecurWeeklyDays] = useState(() => [new Date().getDay()]);

  const composerInputs = useMemo(() => ({
    text, setText,
    aiText, setAiText,
    xpInput, setXpInput,
    deadlineAmt, setDeadlineAmt,
    deadlineUnit, setDeadlineUnit,
    absoluteDue, setAbsoluteDue,
    desc, setDesc,
    recur, setRecur,
    recurCustom, setRecurCustom,
    recurWeeklyDays, setRecurWeeklyDays,
  }), [text, aiText, xpInput, deadlineAmt, deadlineUnit, absoluteDue, desc, recur, recurCustom, recurWeeklyDays]);

  return {
    text, setText,
    aiText, setAiText,
    xpInput, setXpInput,
    deadlineAmt, setDeadlineAmt,
    deadlineUnit, setDeadlineUnit,
    absoluteDue, setAbsoluteDue,
    desc, setDesc,
    recur, setRecur,
    recurCustom, setRecurCustom,
    recurWeeklyDays, setRecurWeeklyDays,
    composerInputs,
  };
}
