import React, { useEffect, useMemo, useState } from "react";
import { fetchGlobalLeaderboards } from "../api/socialClient.js";
import { getProfile } from "../api/profile.js";
import { levelProgress } from "../core/gamify.js";
import { currentUid, subscribeFriends } from "../social/model.js";

export default function SocialLeaderboards() {
  const me = currentUid();
  const [boards, setBoards] = useState({ topLevel: [], topDailyGrowth: [] });
  const [error, setError] = useState("");
  const [friends, setFriends] = useState({ accepted: [], pendingIncoming: [], pendingOutgoing: [] });
  const [friendStats, setFriendStats] = useState({});
  const [friendProfiles, setFriendProfiles] = useState({});
  const [baseline, setBaseline] = useState({});

  useEffect(() => {
    if (!me) return;
    const unsub = subscribeFriends(me, (data) => setFriends(data));
    return () => unsub?.();
  }, [me]);

  const friendUids = useMemo(() => {
    const ids = [me, ...friends.accepted.map((d) => (d.a === me ? d.b : d.a))].filter(Boolean);
    return Array.from(new Set(ids));
  }, [me, friends.accepted]);

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
    if (friendUids.length) fetchXp(friendUids);
    return () => {
      alive = false;
    };
  }, [friendUids.length]);

  useEffect(() => {
    let alive = true;
    async function fetchProfiles(uids) {
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
    if (friendUids.length) fetchProfiles(friendUids);
    return () => {
      alive = false;
    };
  }, [friendUids.length]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await fetchGlobalLeaderboards(friendUids);
        if (!alive) return;
        setBoards({ topLevel: data.topLevel || [], topDailyGrowth: data.topDailyGrowth || [] });
        setBaseline(data.baseline || {});
        setError(data.error ? "Coming soon." : "");
      } catch (e) {
        if (!alive) return;
        setError("Coming soon.");
      }
    })();
    return () => {
      alive = false;
    };
  }, [friendUids.join(",")]);

  const friendOverallRows = useMemo(() => {
    return friendUids
      .map((uid) => ({
        uid,
        stats: friendStats[uid] || { xp: 0, level: 1 },
        prof: friendProfiles[uid] || {},
      }))
      .sort((a, b) => b.stats.level - a.stats.level || b.stats.xp - a.stats.xp)
      .slice(0, 5);
  }, [friendUids, friendStats, friendProfiles]);

  const friendGrowthRows = useMemo(() => {
    const base = baseline || {};
    return friendUids
      .map((uid) => {
        const stats = friendStats[uid] || { xp: 0, level: 1 };
        const prof = friendProfiles[uid] || {};
        const growth = Math.max(0, (stats.xp || 0) - (parseInt(base[uid] || 0, 10) || 0));
        return { uid, stats, prof, growth };
      })
      .sort((a, b) => b.growth - a.growth || b.stats.xp - a.stats.xp)
      .slice(0, 5);
  }, [friendUids, baseline, friendStats, friendProfiles]);

  const renderName = (row) => {
    if (row.uid === me) return "You";
    const prof = row.prof || {};
    if (prof.handle) return prof.handle;
    if (prof.name) return prof.name;
    return (row.uid || "friend").slice(0, 6);
  };

  const rankBadge = (n) => (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 24,
        height: 24,
        borderRadius: 8,
        background: "var(--card-strong, #e8ecfb)",
        fontWeight: 700,
        fontSize: 12,
      }}
    >
      {n}
    </span>
  );

  const blockStyles = { padding: 10, borderRadius: 12, border: "1px solid var(--border)", background: "var(--card)" };
  const rowStyle = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "4px 0",
    gap: 8,
    flexWrap: "wrap",
    minWidth: 0,
  };
  const rowLeftStyle = { display: "flex", alignItems: "center", gap: 8, minWidth: 0 };
  const nameStyle = { overflowWrap: "anywhere" };
  const rowHintStyle = { whiteSpace: "nowrap" };

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div className="sf-card" style={{ padding: 10, display: "grid", gap: 10 }}>
        <div style={{ fontWeight: 800, fontSize: 14, letterSpacing: 0.2 }}>Global</div>
        <div style={{ ...blockStyles }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Top - Overall Level</div>
          {error ? (
            <div className="hint">{error}</div>
          ) : (
            (boards.topLevel || []).slice(0, 10).map((row, i) => (
              <div key={row.uid || i} style={rowStyle}>
                <div style={rowLeftStyle}>
                  {rankBadge(i + 1)}
                  <b style={nameStyle}>{row.handle || row.name || (row.uid ? row.uid.slice(0, 6) : "user")}</b>
                </div>
                <div className="hint" style={rowHintStyle}>Lv {row.level}</div>
              </div>
            ))
          )}
        </div>

        <div style={{ ...blockStyles }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Top - Daily Growth</div>
          {error ? (
            <div className="hint">{error}</div>
          ) : (
            (boards.topDailyGrowth || []).slice(0, 10).map((row, i) => (
              <div key={row.uid || i} style={rowStyle}>
                <div style={rowLeftStyle}>
                  {rankBadge(i + 1)}
                  <b style={nameStyle}>{row.handle || row.name || (row.uid ? row.uid.slice(0, 6) : "user")}</b>
                </div>
                <div className="hint" style={rowHintStyle}>+{Math.max(0, row.growth || 0)} XP</div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="sf-card" style={{ padding: 10, display: "grid", gap: 10 }}>
        <div style={{ fontWeight: 800, fontSize: 14, letterSpacing: 0.2 }}>Friends</div>

        <div style={{ ...blockStyles }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Top - Overall Level</div>
          {friendOverallRows.length === 0 && <div className="hint">Add friends to see a friends leaderboard.</div>}
          {friendOverallRows.map((row, i) => (
            <div key={row.uid} style={rowStyle}>
              <div style={rowLeftStyle}>
                {rankBadge(i + 1)}
                <b style={nameStyle}>{renderName(row)}</b>
              </div>
              <div className="hint" style={rowHintStyle}>Lv {row.stats.level}</div>
            </div>
          ))}
        </div>

        <div style={{ ...blockStyles }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Top - Daily Growth</div>
          {friendGrowthRows.length === 0 && <div className="hint">No friend growth yet.</div>}
          {friendGrowthRows.map((row, i) => (
            <div key={row.uid} style={rowStyle}>
              <div style={rowLeftStyle}>
                {rankBadge(i + 1)}
                <b style={nameStyle}>{renderName(row)}</b>
              </div>
              <div className="hint" style={rowHintStyle}>+{row.growth} XP</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
