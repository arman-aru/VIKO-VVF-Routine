import moment from "moment";
import { useContext, useEffect, useMemo, useState } from "react";
import { Route, Routes, useSearchParams } from "react-router-dom";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { AppContext } from "./context/AppContext";
import { regularPayload, viewerPayload } from "./payloads";
import useFetch from "./useFetch";
import { getAcademicYear } from "./utils/academicYear";
import {
  buildLecturesByDate,
  parseTimetable,
  pickTimetable,
} from "./utils/regularTimetable";

import BottomNav from "./components/BottomNav";
import InstallPrompt from "./components/InstallPrompt";
import GroupModal from "./components/GroupModal";
import Header from "./components/Header";
import ScheduleView from "./components/ScheduleView";
import WeekStrip from "./components/WeekStrip";

const today = () => moment().format("YYYY-MM-DD");

const App = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { API_URL } = useContext(AppContext);

  // Always open on today. An installed PWA relaunches the URL it saved, so
  // honouring an incoming ?date= would reopen the app on a stale day.
  const [date, setDate] = useState(today);

  // Strip any leftover date param so it can never come back on a reload
  useEffect(() => {
    if (!searchParams.get("date")) return;
    const next = new URLSearchParams(searchParams);
    next.delete("date");
    setSearchParams(next, { replace: true });
  }, []);

  // Reopening the app always lands on today
  useEffect(() => {
    const syncToToday = () => setDate(today());

    const onVisible = () => {
      if (document.visibilityState === "visible") syncToToday();
    };

    // visibilitychange covers app resume and tab switching; pageshow covers
    // bfcache restores, which is how mobile PWAs usually return to the front
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pageshow", syncToToday);

    // Fire exactly at the next midnight, then reschedule
    let timer;
    const scheduleAtMidnight = () => {
      const msUntilMidnight = moment().endOf("day").add(1, "ms").diff(moment());
      timer = setTimeout(() => {
        syncToToday();
        scheduleAtMidnight();
      }, msUntilMidnight);
    };
    scheduleAtMidnight();

    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pageshow", syncToToday);
      clearTimeout(timer);
    };
  }, []);

  // Group state — from localStorage or null (triggers modal)
  const [selectedGroup, setSelectedGroup] = useState(() => {
    const saved = localStorage.getItem("selected_group");
    return saved ? JSON.parse(saved) : null;
  });

  // A shared ?group= link resolves on its own once the group list lands, so
  // don't open the picker over it.
  const [showGroupModal, setShowGroupModal] = useState(
    () => !localStorage.getItem("selected_group") && !searchParams.get("group")
  );

  // Refresh key — increment to force re-fetch
  const [refreshKey, setRefreshKey] = useState(0);

  // EduPage scopes its timetable list to an academic year, derived from the date
  const academicYear = useMemo(() => getAcademicYear(date), [date]);

  const weekStart = moment(date).startOf("isoWeek").format("YYYY-MM-DD");
  const weekEnd = moment(date).endOf("isoWeek").format("YYYY-MM-DD");

  // The strip can be swiped a week either side, so build those too — their
  // class-count dots are then already there when the week comes into view.
  const rangeStart = moment(weekStart).subtract(1, "week").format("YYYY-MM-DD");
  const rangeEnd = moment(weekEnd).add(1, "week").format("YYYY-MM-DD");

  // Step 1: which timetables the faculty has published this academic year
  const {
    data: viewerData,
    loading: viewerLoading,
    error: viewerError,
  } = useFetch(
    `${API_URL}/ttviewer`,
    viewerPayload(academicYear),
    academicYear,
    undefined,
    refreshKey
  );

  // Step 2: the weekly timetable in force for the viewed date
  const term = useMemo(() => pickTimetable(viewerData, date), [viewerData, date]);

  const {
    data: ttData,
    loading: ttLoading,
    error: ttError,
  } = useFetch(
    term ? `${API_URL}/regulartt` : null,
    regularPayload(term?.ttNum),
    term?.ttNum,
    undefined,
    refreshKey
  );

  const timetable = useMemo(() => (ttData ? parseTimetable(ttData) : null), [ttData]);
  const groups = useMemo(() => timetable?.groups || [], [timetable]);

  // Group ids can change between timetables, so always resolve the saved
  // group by its short code against the timetable in force.
  const resolvedGroupId = useMemo(() => {
    if (!selectedGroup) return null;
    return groups.find((g) => g.short === selectedGroup.short)?.id || null;
  }, [groups, selectedGroup]);

  // Three weeks of dated lessons for the chosen group, sliced by day below
  const weekLectures = useMemo(
    () =>
      term && timetable
        ? buildLecturesByDate(
            timetable,
            resolvedGroupId,
            { from: rangeStart, to: rangeEnd },
            term
          )
        : null,
    [timetable, resolvedGroupId, rangeStart, rangeEnd, term]
  );

  const lectures = useMemo(
    () => (weekLectures ? weekLectures[date] || [] : null),
    [weekLectures, date]
  );

  // Per-day class counts drive the load dots in the week strip
  const weekCounts = useMemo(() => {
    if (!weekLectures) return {};
    return Object.fromEntries(
      Object.entries(weekLectures).map(([d, list]) => [d, list.length])
    );
  }, [weekLectures]);

  // Sync URL params. The viewed date is deliberately NOT persisted here: the
  // browser and PWA relaunch the last URL, so a stored date would reopen the
  // app on a stale day.
  useEffect(() => {
    if (selectedGroup) {
      setSearchParams({ group: selectedGroup.short }, { replace: true });
    }
  }, [selectedGroup]);

  // Handle URL group param on load (URL overrides, e.g. shared link)
  useEffect(() => {
    if (groups.length === 0) return;
    const paramGroup = searchParams.get("group");
    if (paramGroup) {
      const found = groups.find((g) => g.short === paramGroup.toUpperCase());
      if (found) handleSelectGroup(found);
    }
  }, [groups]);

  const handleSelectGroup = (group) => {
    setSelectedGroup(group);
    localStorage.setItem("selected_group", JSON.stringify(group));
    setShowGroupModal(false);
  };

  const handleRefresh = () => {
    setRefreshKey((k) => k + 1);
  };

  const navigateDate = (direction) => {
    const newDate = moment(date).add(direction, "days").format("YYYY-MM-DD");
    setDate(newDate);
  };

  const goToToday = () => setDate(today());

  const hasLoadError = !!viewerError || !!ttError;
  const groupsLoading = viewerLoading || ttLoading;

  const isLoading =
    !!selectedGroup && !hasLoadError && (groupsLoading || !timetable);

  return (
    <div className="app-root">
      {/* Brand row and week strip share one full-bleed sticky bar, so there
          is a single backdrop rather than two overlapping panels. */}
      <div className="appbar">
        <Header
          selectedGroup={selectedGroup}
          onChangeGroup={() => setShowGroupModal(true)}
        />
        <WeekStrip
          currentDate={date}
          onSelectDate={setDate}
          weekCounts={weekCounts}
        />
      </div>

      <main className="main-content">
        <ScheduleView
          date={date}
          lectures={lectures}
          isLoading={isLoading}
          hasError={!!selectedGroup && hasLoadError}
          selectedGroup={selectedGroup}
          onSelectGroup={() => setShowGroupModal(true)}
          onRefresh={handleRefresh}
        />
      </main>

      <BottomNav
        date={date}
        onPrev={() => navigateDate(-1)}
        onNext={() => navigateDate(1)}
        onToday={goToToday}
      />

      {showGroupModal && (
        <GroupModal
          groups={groups}
          groupsLoading={groupsLoading}
          selectedGroup={selectedGroup}
          onSelect={handleSelectGroup}
          onClose={selectedGroup ? () => setShowGroupModal(false) : null}
        />
      )}

      <InstallPrompt />

      <ToastContainer
        position="top-center"
        autoClose={2500}
        hideProgressBar
        closeOnClick
        draggable
        theme="dark"
        toastClassName="toast-custom"
      />
    </div>
  );
};

const AppWithRoutes = () => (
  <Routes>
    <Route path="*" element={<App />} />
  </Routes>
);

export default AppWithRoutes;
