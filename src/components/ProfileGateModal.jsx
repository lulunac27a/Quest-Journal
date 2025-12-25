// src/components/ProfileGateModal.jsx
export default function ProfileGateModal({
  open,
  profileName,
  onChangeName,
  onSave,
  onClose,
}) {
  if (!open) return null;
  return (
    <div className="modal-backdrop">
      <div className="modal">
        <div className="modal-header">
          <h3 style={{ margin: 0 }}>Welcome, adventurer!</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            {"\u00D7"}
          </button>
        </div>
        <div className="modal-body">
          <div className="hint">
            Pick a name. We'll use it in stories and keep it for your profile.
          </div>
          <input
            type="text"
            placeholder="Your name (e.g., Saeed)"
            value={profileName}
            onChange={(e) => onChangeName(e.target.value)}
          />
          <div className="row-sb">
            <span className="hint">
              You can change this later from Settings (profile).
            </span>
            <button
              className="btn primary"
              disabled={!profileName.trim()}
              onClick={onSave}
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

