import React, { useEffect, useMemo, useState } from "react";
import "./InboxLibrary.css";
import { uid } from "../utils/constants.js";
import { loadTemplates, saveTemplates } from "../core/templates.js";
import AddTaskBar from "./AddTaskBar.jsx";
import TemplateRow from "./TemplateRow.jsx";

// Inbox Library uses the exact AddTaskBar UI to create templates
export default function InboxLibrary({ lists = [], activeListId = "main", onActivate }) {
  const [templates, setTemplates] = useState(() => loadTemplates());
  useEffect(() => { saveTemplates(templates); }, [templates]);

  // Disallow Inbox/all for activation target
  const selectableLists = useMemo(
    () => (Array.isArray(lists) ? lists.filter(l => l.id !== "all" && l.id !== "inbox") : []),
    [lists]
  );
  const targetListId = useMemo(() => {
    const preferred = selectableLists.find(l => l.id === "main") || selectableLists[0];
    return preferred?.id || "main";
  }, [selectableLists]);

  function removeTemplate(id){ setTemplates(p => p.filter(x => x.id !== id)); }
  function updateTemplate(id, patch){ setTemplates(p => p.map(x => x.id === id ? { ...x, ...patch, updatedAt: new Date().toISOString() } : x)); }

  function activateTemplate(tpl){
    if (typeof onActivate !== 'function') return;
    const payload = {
      title: tpl.title,
      xpBase: tpl.xpBase ?? tpl.baseXp ?? tpl.xp ?? 1,
      xpAwards: tpl.xpAwards,
      questType: tpl.questType,
      description: tpl.description ?? tpl.desc ?? "",
      recur: tpl.recur,
      absoluteDue: tpl.absoluteDue ?? tpl.deadline,
      deadlineLocked: tpl.deadlineLocked,
      subtasks: tpl.subtasks,
      createdAt: new Date().toISOString(),
      listId: tpl.toListId || targetListId,
    };
    onActivate(payload);
  }

  return (
    <div className="inbox-lib">
      <TemplateAddBar onSave={(tpl)=> setTemplates(p => [{ id: uid(), ...tpl, updatedAt: new Date().toISOString() }, ...p])} />

      <section className="tpl-list">
        <div className="tpl-card-head" style={{ marginBottom: 6 }}>
          <b>Templates</b>
          <span className="tpl-card-meta">{templates.length} total</span>
        </div>
        <div className="list">
          {templates.map(t => (
            <TemplateRow key={t.id} tpl={t} lists={selectableLists} onActivate={activateTemplate} onUpdate={updateTemplate} />
          ))}
          {templates.length === 0 && <div className="empty">No templates yet — create one above.</div>}
        </div>
      </section>
    </div>
  );
}


// Wrapper that reuses AddTaskBar to build a full payload, then saves it as a template
function TemplateAddBar({ onSave }){
  const [text, setText] = useState("");
  const [aiText, setAiText] = useState("");
  const [xpInput, setXpInput] = useState("");
  const [deadlineAmt, setDeadlineAmt] = useState("");
  const [deadlineUnit, setDeadlineUnit] = useState("h");
  const [absoluteDue, setAbsoluteDue] = useState(null);
  const [recur, setRecur] = useState("none");
  const [recurCustom, setRecurCustom] = useState([]);
  const [recurWeeklyDays, setRecurWeeklyDays] = useState([new Date().getDay()]);
  const [desc, setDesc] = useState("");

  return (
    <section className="inbox-col tpl-editor">
      <div className="tpl-card-head"><b>New Template</b></div>
      <AddTaskBar
        text={text} setText={setText}
        aiText={aiText} setAiText={setAiText}
        xpInput={xpInput} setXpInput={setXpInput}
        deadlineAmt={deadlineAmt} setDeadlineAmt={setDeadlineAmt}
        deadlineUnit={deadlineUnit} setDeadlineUnit={setDeadlineUnit}
        setAbsoluteDue={setAbsoluteDue}
        desc={desc} setDesc={setDesc}
        recur={recur} setRecur={setRecur}
        recurCustom={recurCustom} setRecurCustom={setRecurCustom}
        recurWeeklyDays={recurWeeklyDays} setRecurWeeklyDays={setRecurWeeklyDays}
        level={1}
        aiMode="epic"
        onAdd={(payload) => {
          const tpl = { ...payload, absoluteDue };
          onSave?.(tpl);
          setText(""); setAiText(""); setXpInput(""); setDeadlineAmt(""); setDeadlineUnit("h"); setAbsoluteDue(null); setDesc(""); setRecur("none"); setRecurCustom([]); setRecurWeeklyDays([new Date().getDay()]);
        }}
      />
    </section>
  );
}
