// src/components/AppTabs.jsx
import TopTabs from "./TopTabs.jsx";
import { TasksTabPanel } from "./TasksTab.jsx";
import { CalendarTabPanel } from "./CalendarTab.jsx";
import MusicTab from "./MusicTab.jsx";
import { StoryTabPanel } from "./StoryTab.jsx";
import JournalTab from "./JournalTab.jsx";
import AchievementsHall from "./AchievementsHall.jsx";

export default function AppTabs({
  tab,
  setTab,
  musicLevel,
  ach,
}) {
  return (
    <>
      <TopTabs tab={tab} setTab={setTab} />
      {tab === "tasks" && <TasksTabPanel />}
      {tab === "calendar" && (
        <div className="card" style={{ padding: 12 }}>
          <CalendarTabPanel />
        </div>
      )}
      {tab === "music" && <MusicTab level={musicLevel} />}
      {tab === "story" && <StoryTabPanel />}
      {tab === "journal" && <JournalTab />}
      {tab === "ach" && <AchievementsHall ach={ach} />}
    </>
  );
}
