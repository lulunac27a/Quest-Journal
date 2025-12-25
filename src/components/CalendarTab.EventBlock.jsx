import React, { useRef, useState } from "react";

export default function EventBlock({ ev, style, onMove, onResize, onClick, onToggleDone, onDelete, slotH = 22 }) {
  const [dragging, setDragging] = useState(null); // 'move' | 'start' | 'end' | null
  const startRef = useRef({ x:0, y:0 });
  const lastRef = useRef({ x:0, y:0 });

  function onDown(kind, e) {
    e.stopPropagation();
    setDragging(kind);
    startRef.current = { x: e.clientX, y: e.clientY };
    lastRef.current = { x: e.clientX, y: e.clientY };
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
  }
  function onMovePtr(e) {
    if (!dragging) return;
    const dx = e.clientX - lastRef.current.x;
    const dy = e.clientY - lastRef.current.y;
    lastRef.current = { x: e.clientX, y: e.clientY };
    const deltaMin = Math.round(dy / Math.max(1, slotH)) * 30; // 30 min per slot
    if (!deltaMin) return;
    if (dragging === 'move') onMove?.(deltaMin);
    else if (dragging === 'start') onResize?.('start', deltaMin);
    else if (dragging === 'end') onResize?.('end', deltaMin);
  }
  function onUpPtr(e) { setDragging(null); try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {} }

  return (
    <div
      className={`event ${ev.done ? 'done' : ''}`}
      style={style}
      role="button"
      tabIndex={0}
      onClick={(e)=>{ e.stopPropagation(); onClick?.(e); }}
      onKeyDown={(e)=>{ if (e.key==='Delete' || e.key==='Backspace') { e.preventDefault(); e.stopPropagation(); onDelete?.(); } }}
      onPointerDown={(e)=>onDown('move', e)}
      onPointerMove={onMovePtr}
      onPointerUp={onUpPtr}
      onPointerCancel={onUpPtr}
    >
      <div className="handle top" onPointerDown={(e)=>onDown('start', e)} />
      <div className="handle bot" onPointerDown={(e)=>onDown('end', e)} />
      <div className="title" style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:6 }}>
        <span>{ev.title}</span>
        {ev.kind==='task' && (
          <input title="Mark done" type="checkbox" checked={!!ev.done} onChange={(e)=> { e.stopPropagation(); onToggleDone?.(); }} />
        )}
      </div>

    </div>
  );
}

