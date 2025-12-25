// src/App.jsx
import { useEffect } from "react";
import AchievementAnimationOverlay from "./components/AchievementAnimationOverlay.jsx";
import SettingsModal from "./components/SettingsModal.jsx";
import { MusicProvider } from "./ctx/MusicContext.jsx";
import GlobalPlayer from "./components/GlobalPlayer.jsx";
import ThemeStage from "./theme/ThemeStage.jsx";
import Tour from "./Tour.jsx";
import * as Sync from "./sync/index.js";
import AppTabs from "./components/AppTabs.jsx";
import ProfileGateModal from "./components/ProfileGateModal.jsx";
import "./achievements-glow.css";
import { AppStateProvider, useAppView } from "./app/state/AppStateContext.jsx";

export default function App() {
  useEffect(() => {
    let detach;
    try {
      detach = Sync.attachWindowListeners?.();
    } catch {}
    return () => {
      try { detach?.(); } catch {}
    };
  }, []);

  return (
    <AppStateProvider>
      <MusicProvider>
        <AppShell />
      </MusicProvider>
    </AppStateProvider>
  );
}

function AppShell() {
  const {
    tab,
    setTab,
    settings,
    level,
    ach,
    anim,
    dismissAnim,
    symbols,
    currentToast,
    settingsModalProps,
    profileModalProps,
  } = useAppView();

  const settingsOpen = settingsModalProps.open;
  const profileOpen = profileModalProps.open;

  return (
    <>
      <GlobalPlayer />
      <ThemeStage activeSkin={settings.skin} dark={!!settings.dark} />
      <AchievementAnimationOverlay
        visible={anim.visible}
        animationUrl={anim.url}
        message={anim.message}
        durationMs={4000}
        playSound={false}
        allowClose={true}
        onClose={dismissAnim}
      />
      <div className="app-root">
        {settings.skin === "fairy" && (
          <div className="fairy-swarm" aria-hidden="true" />
        )}
        {settings.skin === "witch" && (
          <div className="witch-runes" aria-hidden="true" />
        )}
        <div className="symbols">
          {symbols.map((s) => (
            <span key={s.id}>{s.char}</span>
          ))}
        </div>
        {currentToast && (
          <div key={currentToast.id} className="toast">
            {currentToast.text}
          </div>
        )}
        <AppTabs
          tab={tab}
          setTab={setTab}
          musicLevel={level}
          ach={ach}
        />
      </div>
      <Tour
        enabled={!settingsOpen && !profileOpen}
        activeTab={tab}
        overlay={false}
      />
      <SettingsModal {...settingsModalProps} />
      <ProfileGateModal {...profileModalProps} />
    </>
  );
}
