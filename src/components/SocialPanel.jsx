import React, { useEffect, useState } from "react";
import * as SocialAPI from "../api/socialClient.js";
import { getProfile } from "../api/profile.js";
import { requestFriend, acceptFriend, removeFriend, currentUid, subscribeFriends } from "../social/model.js";
import { levelProgress } from "../core/gamify.js";

export default function SocialPanel({ onToast }) {
  const [q, setQ] = useState("");
  const [info, setInfo] = useState(null); // { handle, uid, profile }
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const me = currentUid();
  const [friends, setFriends] = useState({ accepted: [], pendingIncoming: [], pendingOutgoing: [] });
  const [friendStats, setFriendStats] = useState({}); // uid -> { xp, level }
  const [friendProfiles, setFriendProfiles] = useState({}); // uid -> { handle, name }

  useEffect(() => {
    if (!me) return;
    const unsub = subscribeFriends(me, async (data) => {
      setFriends(data);
    });
    return () => unsub?.();
  }, [me]);

  // Fetch XP for accepted friends (and me) lazily
  useEffect(() => {
    let alive = true;
    async function fetchXp(uids) {
      const entries = await Promise.all(
        uids.map(async (u) => {
          try {
            const prof = await getProfile(u);
            const xp = parseInt(prof?.xp || 0, 10) || 0;
            const { level } = levelProgress(xp);
            return [u, { xp, level }];
          } catch {
            return [u, { xp: 0, level: 1 }];
          }
        })
      );
      if (!alive) return;
      setFriendStats((prev) => ({ ...prev, ...Object.fromEntries(entries) }));
    }
    const uids = Array.from(new Set([me, ...friends.accepted.map((d) => (d.a === me ? d.b : d.a))].filter(Boolean)));
    if (uids.length) fetchXp(uids);
    return () => {
      alive = false;
    };
  }, [me, friends.accepted.length]);

  // Fetch Profiles for friends (handles & names)
  useEffect(() => {
    let alive = true;
    async function run(uids) {
      const entries = await Promise.all(
        uids.map(async (u) => {
          try {
            const p = await getProfile(u);
            return [u, { handle: p?.handle || null, name: p?.name || null }];
          } catch {
            return [u, { handle: null, name: null }];
          }
        })
      );
      if (!alive) return;
      setFriendProfiles((prev) => ({ ...prev, ...Object.fromEntries(entries) }));
    }
    const uids = Array.from(new Set([me, ...friends.accepted.map((d) => (d.a === me ? d.b : d.a))]));
    if (uids.length) run(uids);
    return () => {
      alive = false;
    };
  }, [me, friends.accepted.length]);

  async function onSearch() {
    const clean = SocialAPI.sanitize(q);
    if (!clean) {
      setMsg("Enter a valid ID");
      return;
    }
    setBusy(true);
    setMsg("");
    setInfo(null);
    try {
      // We use availability API to resolve owner
      const r = await SocialAPI.isAvailable(clean);
      if (r.available || !r.owner) {
        setMsg("Not found");
        return;
      }
      const prof = await getProfile(r.owner).catch(() => null);
      setInfo({ handle: clean, uid: r.owner, profile: prof });
      onToast?.(`Found @${prof?.handle || clean}`);
    } catch (e) {
      setMsg(e?.message || "Search failed");
    } finally {
      setBusy(false);
    }
  }

  const nameFor = (uid) => {
    const prof = friendProfiles[uid] || {};
    if (uid === me) return "You";
    if (prof.handle) return prof.handle;
    if (prof.name) return prof.name;
    return `${uid.slice(0, 6)}...`;
  };

  return (
    <div className="social-panel">
      <div style={{ display: "grid", gap: 8 }}>
        <b>Find friends</b>
        <div className="social-search-row" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input
            type="text"
            placeholder="Friend ID"
            value={q}
            onChange={(e) => setQ(SocialAPI.sanitize(e.target.value))}
            onKeyDown={(e) => {
              if (e.key === "Enter") onSearch();
            }}
            style={{ flex: 1, minWidth: 180 }}
          />
          <button className="btn" onClick={onSearch} disabled={busy}>Search</button>
        </div>
        {msg && <div className="hint">{msg}</div>}
        {info && (
          <div className="sf-card" style={{ padding: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700, overflowWrap: "anywhere" }}>@{info.profile?.handle || info.handle}</div>
                {info.profile?.name && <div className="hint" style={{ overflowWrap: "anywhere" }}>{info.profile.name}</div>}
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <button
                  className="btn"
                  onClick={async () => {
                    try {
                      const me = currentUid();
                      if (!me) {
                        setMsg("Sign in to add friends");
                        return;
                      }
                      const r = await requestFriend(me, info.uid);
                      const text = r?.status === "accepted" ? "Already friends" : "Request sent";
                      setMsg(text);
                      onToast?.(text);
                    } catch (e) {
                      setMsg(e?.message || "Failed");
                    }
                  }}
                >
                  Add friend
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <hr />

      <div style={{ display: "grid", gap: 8 }}>
        <b>Challenges</b>
        <div className="hint">Challenges will appear here (Coming soon)</div>
      </div>

      <hr />

      {/* Friends & Requests */}
      <div style={{ display: "grid", gap: 8 }}>
        <b>Friends</b>
        {friends.accepted.length === 0 && <div className="hint">No friends yet.</div>}
        {friends.accepted.map((d) => {
          const other = d.a === me ? d.b : d.a;
          const stats = friendStats[other] || { xp: 0, level: 1 };
          return (
            <div key={d.id} className="social-row" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
              <div className="social-row-main" style={{ minWidth: 0 }}>
                <b style={{ overflowWrap: "anywhere" }}>{nameFor(other)}</b> <span className="hint">Lv {stats.level}</span>
              </div>
              <div className="social-row-actions" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <button
                  className="btn"
                  onClick={async () => {
                    try {
                      await removeFriend(me, other);
                    } catch (e) {
                      setMsg(e?.message || "Failed");
                    }
                  }}
                >
                  Remove
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
        <b>Requests</b>
        {friends.pendingIncoming.length === 0 && friends.pendingOutgoing.length === 0 && (
          <div className="hint">No pending requests.</div>
        )}
        {friends.pendingIncoming.map((d) => {
          const other = d.invitedBy === me ? d.b : d.a === me ? d.b : d.a;
          return (
            <div key={d.id} className="social-row social-request" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
              <div className="social-row-main" style={{ minWidth: 0 }}>
                <b style={{ overflowWrap: "anywhere" }}>{nameFor(other)}</b> <span className="badge">Incoming</span>
              </div>
              <div className="social-row-actions" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <button
                  className="btn primary"
                  onClick={async () => {
                    try {
                      await acceptFriend(me, other);
                      onToast?.("Friend request accepted");
                    } catch (e) {
                      setMsg(e?.message || "Failed");
                    }
                  }}
                >
                  Accept
                </button>
                <button
                  className="btn"
                  onClick={async () => {
                    try {
                      await removeFriend(me, other);
                      onToast?.("Request declined");
                    } catch (e) {
                      setMsg(e?.message || "Failed");
                    }
                  }}
                >
                  Decline
                </button>
              </div>
            </div>
          );
        })}
        {friends.pendingOutgoing.map((d) => {
          const other = d.invitedBy === me ? (d.a === me ? d.b : d.a) : d.a === me ? d.b : d.a;
          return (
            <div key={d.id} className="social-row social-request" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
              <div className="social-row-main" style={{ minWidth: 0 }}>
                <b style={{ overflowWrap: "anywhere" }}>{nameFor(other)}</b> <span className="badge">Outgoing</span>
              </div>
              <div className="social-row-actions" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <button
                  className="btn"
                  onClick={async () => {
                    try {
                      await removeFriend(me, other);
                      onToast?.("Request canceled");
                    } catch (e) {
                      setMsg(e?.message || "Failed");
                    }
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
