// src/components/SettingsModal.jsx
import React, { useState, useEffect, useRef } from "react";
import { styles as settingsModalStyles } from "./SettingsModal.styles.js";
import { getStatus as getSyncStatus } from "../sync/index.js";
import SyncStatusBadge from "./SyncStatusBadge.jsx";
import ChallengeManager from "./ChallengeManager.jsx";
import AiConnect from "./AiConnect.jsx";
import { uid } from "../utils/constants.js";
import * as SocialAPI from "../api/socialClient.js";

/**
 * SettingsModal
 *
 * نکته‌ها:
 * - بدون تغییر API قبلی کار می‌کند.
 * - اختیاری: onCloudPull / onCloudPush برای "اجبار ایمپورت/اکسپورت ابری" اگر پاس داده شوند، بخش کنترل دستی Sync نمایش داده می‌شود.
 * - پیام خطا/Busy بدون تغییر. اسکرول فقط عمودی تا اوورفلو افقی در موبایل رخ نده.
 */
export default function SettingsModal({
  open,
  onClose,
  settings,
  setSettings,
  dailyTpl,
  setDailyTpl,
  weeklyTpl,
  setWeeklyTpl,
  fbReady,
  user,
  cloudBusy,
  cloudError,
  onSignIn,
  onSignOut,
  profileName,
  setProfileName,
  onSaveProfileName,
  onResetAccount,
  onResetCloud,
  onEmailSignUp,
  onEmailSignIn,
  staySignedIn,
  onToggleStaySignedIn,

  // --- اختیاری (در صورت پاس‌دادن از بیرون، بلوک Sync دستی فعال می‌شود)
  onCloudPull,   // legacy (unused)
  onCloudPush,   // legacy (unused)
  onBackupLocal, // () => void   - Save a full app snapshot into local storage
  onRestoreFromLocalToCloud, // () => void - Replace cloud state with saved local snapshot
}) {
  // appearance | challenges | account | ai | about
  const [section, setSection] = useState("appearance");
  const restoreInputRef = useRef(null);

  // ensure hero name is always typeable (local fallback + sync)
  const [localName, setLocalName] = useState(profileName ?? "");
  useEffect(() => { setLocalName(profileName ?? ""); }, [profileName]);

  // --- Public ID (handle)
  const [handleInput, setHandleInput] = useState("");
  const [handleBusy, setHandleBusy] = useState(false);
  const [handleMsg, setHandleMsg] = useState("");
  const [handleOk, setHandleOk] = useState(false);
  const [authMode, setAuthMode] = useState("signup"); // signup | signin
  const [emailInput, setEmailInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [authMsg, setAuthMsg] = useState("");
  const [authBusy, setAuthBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        if (!fbReady || !user?.uid) return;
        const cur = await (async () => {
          try { return await SocialAPI.getCurrentHandle?.(user.uid); } catch {}
          return null;
        })();
        if (cur) {
          setHandleInput(cur);
          setHandleOk(true);
          setHandleMsg("Reserved");
        }
      } catch {}
    })();
  }, [fbReady, user?.uid]);

  // accessibility: close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      {/* modal container with responsive sizing and no horizontal overflow */}
      <div
        className="modal settings-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
      >
        {/* Header */}
        <div className="modal-header settings-modal__header">
          <h3 id="settings-title">Settings</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>

        {/* Tabs (wrap on small screens) */}
        <div className="modal-tabs settings-modal__tabs" role="tablist" aria-label="Settings sections">
          <button
            role="tab"
            className={`tab ${section === "appearance" ? "active" : ""}`}
            onClick={() => setSection("appearance")}
          >
            Mode
          </button>
          <button
            role="tab"
            className={`tab ${section === "challenges" ? "active" : ""}`}
            onClick={() => setSection("challenges")}
          >
            Manage Challenges
          </button>
          <button
            role="tab"
            className={`tab ${section === "account" ? "active" : ""}`}
            onClick={() => setSection("account")}
          >
            Account
          </button>
          <button
            role="tab"
            className={`tab ${section === "ai" ? "active" : ""}`}
            onClick={() => setSection("ai")}
          >
            AI
          </button>
          <button
            role="tab"
            className={`tab ${section === "about" ? "active" : ""}`}
            onClick={() => setSection("about")}
          >
            About
          </button>
        </div>

        {/* Appearance */}
        {section === "appearance" && (
          <div className="modal-body settings-modal__body">
            <label className="row-sb settings-row">
              <span>Dark mode</span>
              <input
                type="checkbox"
                checked={!!settings.dark}
                onChange={(e) => setSettings((s) => ({ ...s, dark: e.target.checked }))}
              />
            </label>

            <label className="row-sb settings-row">
              <span>Celebration animations</span>
              <input
                type="checkbox"
                checked={!!settings.animations}
                onChange={(e) => setSettings((s) => ({ ...s, animations: e.target.checked }))}
              />
            </label>

            <label className="row-sb settings-row">
              <span>Sounds</span>
              <input
                type="checkbox"
                checked={!!settings.sounds}
                onChange={(e) => setSettings((s) => ({ ...s, sounds: e.target.checked }))}
              />
            </label>

            <hr />

            {/* Themes grouped into two categories */}
            <div>
              <div className="hint" style={{ marginBottom: 8 }}>
                World Skin
              </div>

              <div className="sf-card" style={{ padding: 10, marginBottom: 10 }}>
                <div className="hint" style={{ marginBottom: 8 }}>Nature based</div>
                <div className="settings-chiprow">
                  {["classic", "misty", "desert", "forest"].map((m) => (
                    <button
                      key={m}
                      className={`btn ${settings.skin === m ? "primary" : ""}`}
                      onClick={() => setSettings((s) => ({ ...s, skin: m }))}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              <div className="sf-card" style={{ padding: 10 }}>
                <div className="hint" style={{ marginBottom: 8 }}>Character based</div>
                <div className="settings-chiprow">
                  {["warrior", "fairy", "witch", "artisan", "scholar"].map((m) => (
                    <button
                      key={m}
                      className={`btn ${settings.skin === m ? "primary" : ""}`}
                      onClick={() => setSettings((s) => ({ ...s, skin: m }))}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Challenges */}
        {section === "challenges" && (
          <div className="modal-body settings-modal__body" style={{ display: "grid", gap: 12 }}>
            <h4>Daily templates</h4>
            <ChallengeManager
              label="Daily"
              templates={dailyTpl}
              defaultXP={250}
              onAdd={(title, xp) => setDailyTpl((p) => [{ id: uid(), title, xp }, ...p])}
              onRemove={(id) => setDailyTpl((p) => p.filter((t) => t.id !== id))}
            />

            <h4 style={{ marginTop: 16 }}>Weekly templates</h4>
            <ChallengeManager
              label="Weekly"
              templates={weeklyTpl}
              defaultXP={500}
              onAdd={(title, xp) => setWeeklyTpl((p) => [{ id: uid(), title, xp }, ...p])}
              onRemove={(id) => setWeeklyTpl((p) => p.filter((t) => t.id !== id))}
            />
          </div>
        )}

        {/* AI */}
        {section === "ai" && (
          <div className="modal-body settings-modal__body" style={{ display: "grid", gap: 12 }}>
            <AiConnect />

            <div className="sf-card" style={{ padding: 10 }}>
              <div className="hint" style={{ marginBottom: 8 }}>AI mode</div>
              <div className="settings-chiprow">
                {[
                  { id: "explanatory", label: "Explanatory" },
                  { id: "encouraging", label: "Encouraging" },
                  { id: "literary", label: "Literary" },
                  { id: "epic", label: "Epic" },
                ].map((m) => (
                  <button
                    key={m.id}
                    className={`btn ${(settings.aiMode || 'epic') === m.id ? "primary" : ""}`}
                    onClick={() => setSettings((s) => ({ ...s, aiMode: m.id }))}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
              <div className="hint" style={{ marginTop: 6 }}>
                Chooses the style used for ✨ AI story on tasks.
              </div>
            </div>
          </div>
        )}

        {/* Account (restyled + editable Hero name) */}
        {section === "account" && (
          <div className="modal-body settings-modal__body" style={{ display: "grid", gap: 12 }}>
            {!fbReady && (
              <div className="hint">
                Cloud sync is not configured. Add Firebase env vars in .env or .env.local to enable login and sync.
              </div>
            )}

            {fbReady && (
              <>
                <div className="sf-card" style={{ padding: 12 }}>
                  <div className="settings-row">
                    <div className="settings-row__left">
                      {user?.photoURL ? (
                        <img src={user.photoURL} alt="" className="settings-avatar" />
                      ) : (
                        <div className="settings-avatar ph">👤</div>
                      )}
                      <div>
                        <div style={{ fontWeight: 700 }}>
                          {user ? (user.displayName || "Signed in") : "Not signed in"}
                        </div>
                        {user && <div className="hint" style={{ fontSize: 12 }}>{user.email}</div>}
                      </div>
                    </div>
                    <div className="settings-row__right">
                      {user ? (
                        <>
                          {cloudBusy && <span className="hint">syncing…</span>}
                          <button className="btn" onClick={onSignOut}>Sign out</button>
                        </>
                      ) : (
                        <button
                          className="btn primary"
                          onClick={onSignIn}
                          disabled={cloudBusy}
                        >
                          Sign in with Google
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="settings-row wrap" style={{ marginTop: 12, gap: 8 }}>
                    <label className="hint" style={{ minWidth: 100 }}>Stay signed in</label>
                    <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <input
                        type="checkbox"
                        checked={!!staySignedIn}
                        onChange={(e) => onToggleStaySignedIn?.(e.target.checked)}
                      />
                      <span className="hint" style={{ color: "var(--text-muted)" }}>
                        Keep me signed in on this device
                      </span>
                    </label>
                  </div>
                  {!user && (
                    <div className="email-auth" style={{ marginTop: 12, display: "grid", gap: 8 }}>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button
                          type="button"
                          className={`btn ${authMode === "signup" ? "primary" : ""}`}
                          onClick={() => setAuthMode("signup")}
                          disabled={authBusy}
                        >
                          Sign up
                        </button>
                        <button
                          type="button"
                          className={`btn ${authMode === "signin" ? "primary" : ""}`}
                          onClick={() => setAuthMode("signin")}
                          disabled={authBusy}
                        >
                          Sign in
                        </button>
                      </div>
                      <form
                        onSubmit={async (e) => {
                          e.preventDefault();
                          setAuthMsg("");
                          setAuthBusy(true);
                          try {
                            if (authMode === "signup") {
                              if (typeof onEmailSignUp !== "function") throw new Error("Email sign-up unavailable");
                              await onEmailSignUp(emailInput, passwordInput);
                              setAuthMsg("Account created.");
                            } else {
                              if (typeof onEmailSignIn !== "function") throw new Error("Email sign-in unavailable");
                              await onEmailSignIn(emailInput, passwordInput);
                              setAuthMsg("");
                            }
                          } catch (err) {
                            setAuthMsg(err?.message || "Action failed");
                          } finally {
                            setAuthBusy(false);
                          }
                        }}
                        style={{ display: "grid", gap: 6 }}
                      >
                        <div className="settings-row wrap">
                          <label className="hint" style={{ minWidth: 100 }}>Email</label>
                          <input
                            type="email"
                            className="settings-text"
                            required
                            value={emailInput}
                            onChange={(e) => setEmailInput(e.target.value)}
                            placeholder="you@example.com"
                            disabled={authBusy}
                          />
                        </div>
                        <div className="settings-row wrap">
                          <label className="hint" style={{ minWidth: 100 }}>Password</label>
                          <input
                            type="password"
                            className="settings-text"
                            required
                            value={passwordInput}
                            onChange={(e) => setPasswordInput(e.target.value)}
                            placeholder="********"
                            disabled={authBusy}
                          />
                        </div>
                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <button className="btn primary" type="submit" disabled={authBusy}>
                            {authMode === "signup" ? "Create account" : "Sign in"}
                          </button>
                          {authBusy && <span className="hint">Processing...</span>}
                        </div>
                        {authMsg && (
                          <div
                            className="hint"
                            style={{ color: authMsg.toLowerCase().includes("fail") ? "#b91c1c" : "var(--text-muted)" }}
                          >
                            {authMsg}
                          </div>
                        )}
                      </form>
                    </div>
                  )}
                  {cloudError && (
                    <div className="hint" style={{ color: "#b91c1c", marginTop: 8 }}>{cloudError}</div>
                  )}
                </div>

                {/* Profile / Hero name */}
                <div className="sf-card" style={{ padding: 12 }}>
                  <div style={{ marginBottom: 8 }}>
                    <b>Profile</b>
                    <div className="hint">Set your Hero name. This will appear across the app.</div>
                  </div>

                  <div className="settings-row wrap">
                    <label htmlFor="heroName" className="hint" style={{ minWidth: 100 }}>Hero name</label>
                    <input
                      id="heroName"
                      type="text"
                      value={localName}
                      onChange={(e) => {
                        const v = e.target.value;
                        setLocalName(v);
                        setProfileName?.(v);
                      }}
                      placeholder="e.g., Aria the Brave"
                      className="settings-text"
                    />
                    <button
                      className="btn"
                      onClick={() => onSaveProfileName?.()}
                      disabled={!localName.trim()}
                      title="Save hero name"
                    >
                      Save
                    </button>
                  </div>
                </div>

                {/* Public ID (handle) */}
                <div className="sf-card" style={{ padding: 12 }}>
                  <div style={{ marginBottom: 8 }}>
                    <b>Public ID</b>
                    <div className="hint">Choose a unique ID so friends can find you. 3–20 chars, letters/numbers/underscore.</div>
                  </div>

                  {!user && (
                    <div className="hint" style={{ color: "var(--text-muted)" }}>Sign in to claim an ID.</div>
                  )}

                  <div className="settings-row wrap">
                    <label htmlFor="heroId" className="hint" style={{ minWidth: 100 }}>ID</label>
                    <input
                      id="heroId"
                      type="text"
                      value={handleInput}
                      onChange={(e) => {
                        const v = e.target.value;
                        setHandleInput(SocialAPI.sanitize(v));
                        setHandleOk(false);
                        setHandleMsg("");
                      }}
                      placeholder="e.g., aria_brv"
                      className="settings-text"
                      disabled={!user}
                    />
                    <button
                      className="btn"
                      type="button"
                      disabled={!user || handleBusy || !handleInput}
                      onClick={async () => {
                        setHandleBusy(true); setHandleMsg(""); setHandleOk(false);
                        try {
                          const v = SocialAPI.validate(handleInput);
                          if (!v.ok) { setHandleMsg(v.reason === 'length' ? 'Use 3–20 characters' : 'Invalid characters'); return; }
                          const r = await SocialAPI.isAvailable(handleInput);
                          if (r.available) { setHandleOk(true); setHandleMsg("Available"); }
                          else { setHandleOk(false); setHandleMsg("Taken"); }
                        } catch (e) {
                          setHandleMsg(e?.message || 'Error');
                        } finally { setHandleBusy(false); }
                      }}
                    >
                      Check
                    </button>
                    <button
                      className="btn primary"
                      type="button"
                      disabled={!user || handleBusy || !handleInput}
                      onClick={async () => {
                        setHandleBusy(true); setHandleMsg("");
                        try {
                          await SocialAPI.claimHandle(user.uid, handleInput);
                          setHandleOk(true);
                          setHandleMsg("Reserved");
                        } catch (e) {
                          setHandleOk(false);
                          setHandleMsg(e?.message || 'Failed');
                        } finally { setHandleBusy(false); }
                      }}
                    >
                      Save ID
                    </button>
                  </div>
                  {handleMsg && (
                    <div className="hint" style={{ marginTop: 6, color: handleOk ? 'var(--success,#16a34a)' : 'var(--text-muted,#888)' }}>{handleMsg}</div>
                  )}
                </div>

                {/* Backup / Restore (local ↔ cloud) */}
                {user && (
                  <div className="sf-card" style={{ padding: 12 }}>
                    <div className="settings-row" style={{ marginBottom: 6 }}>
                      <b>Backup & Restore</b>
                      <SyncStatusBadge />
                    </div>
                    <div className="settings-row wrap">
                      <button
                        className="btn"
                        disabled={cloudBusy}
                        onClick={() => { try { onBackupLocal?.(); } catch {} }}
                        title="Download a full app snapshot as a file"
                      >
                        download backup
                      </button>
                      <button
                        className="btn"
                        disabled={cloudBusy}
                        onClick={() => { try { restoreInputRef.current?.click(); } catch {} }}
                        title="Select a backup file to replace the cloud state"
                      >
                        restore from backup file
                      </button>
                      <input
                        ref={restoreInputRef}
                        type="file"
                        accept="application/json"
                        style={{ display: "none" }}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            try { onRestoreFromLocalToCloud?.(file); } catch {}
                          }
                          if (e.target) e.target.value = "";
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* Danger zone */}
                <div className="sf-card" style={{ padding: 12 }}>
                  <b>Danger zone</b>
                  <div className="hint" style={{ margin: "6px 0" }}>
                    Reset EVERYTHING for this account (cloud + local: lists, tasks, XP, achievements, settings). This cannot be undone.
                  </div>
                  <button
                    className="btn"
                    onClick={() => {
                      const msg = user
                        ? "Reset account and cloud data? This removes all local and cloud lists, tasks, XP and settings."
                        : "Reset account data on this device?";
                      if (confirm(msg)) {
                        // Use unified reset (hardResetAccount already clears cloud when signed in)
                        onResetCloud?.();
                        onClose?.();
                      }
                    }}
                  >
                    Reset account (cloud + local)
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* About */}
        {section === "about" && (
          <div className="modal-body settings-modal__body">
            <div className="hint">
              Quest Journal — If your life had a progress bar! Built by Saeed Sotoudemehr.
            </div>
          </div>
        )}

        {/* Scoped responsive styles to prevent horizontal scroll on mobile */}
        <style>{settingsModalStyles}</style>
      </div>
    </div>
  );
}
