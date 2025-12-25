// src/hooks/useCloudBridge.js
import { useEffect } from "react";
import { useCloudSync } from "../sync/useCloudSync.js";
import * as Sync from "../sync/index.js";

export default function useCloudBridge({
  applyRemote,
  applyRemoteRef,
  packState,
  pushDeps = [],
  activeListId,
  resetLocalToDefaults,
}) {
  const syncState = useCloudSync({ applyRemote });

  useEffect(() => {
    if (applyRemoteRef) applyRemoteRef.current = applyRemote;
  }, [applyRemote, applyRemoteRef]);

  useEffect(() => {
    try {
      Sync.configureLocalIO({
        resetLocalToDefaults: (...args) => resetLocalToDefaults?.(...args),
      });
    } catch {}
  }, [resetLocalToDefaults]);

  useEffect(() => {
    if (typeof syncState.pushLocal === "function") {
      syncState.pushLocal(packState);
    }
  }, [packState, syncState.pushLocal, ...pushDeps]);

  useEffect(() => {
    try { Sync.flushNow?.(); } catch {}
  }, [activeListId]);

  return syncState;
}
