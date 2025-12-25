import React, { useState } from "react";

export default function NameCaptureModal({ onSave, initial = "" }) {
  const [name, setName] = useState(initial);
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Welcome">
      <div className="modal">
        <div className="modal-header">
          <h3 style={{ margin: 0 }}>Welcome!</h3>
        </div>
        <div className="modal-body">
          <p className="hint">Let’s personalize your journey. Pick a display name (you can change it later in Settings).</p>
          <input
            type="text"
            placeholder="Your hero name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
          <div className="row-sb" style={{ marginTop: 8 }}>
            <button className="btn" onClick={() => onSave("")}>Skip</button>
            <button className="btn primary" disabled={!name.trim()} onClick={() => onSave(name.trim())}>Save</button>
          </div>
        </div>
      </div>
    </div>
  );
}

