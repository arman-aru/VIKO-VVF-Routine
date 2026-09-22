import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  buildLecturesByDate,
  parseDateRange,
  parseTimetable,
  pickTimetable,
  weekIndexFor,
} from "./regularTimetable.js";

const TERM = { from: "2026-09-02", to: "2026-12-23" };

// Minimal regularttGetData response: one group with a lesson every Monday of
// week 1, one every Monday of week 2, and a two-period seminar for subgroup 1
// every Friday.
const regularResponse = {
  r: {
    dbiAccessorRes: {
      tables: [
        { id: "classes", data_rows: [
          { id: "*2", short: "TV26", name: "TV26" },
          { id: "*1", short: "IB26E", name: "IB26E" },
        ] },
        { id: "periods", data_rows: [
          { period: "1", starttime: "08:30", endtime: "10:00" },
          { period: "2", starttime: "10:15", endtime: "11:45" },
          { period: "3", starttime: "12:30", endtime: "14:00" },
        ] },
        { id: "subjects", data_rows: [
          { id: "s1", name: "Marketing", short: "Mkt", color: "#33CC33" },
          { id: "s2", name: "Statistics", short: "Stat", color: "#FF0000" },
          { id: "s3", name: "English", short: "Eng", color: "#0000FF" },
        ] },
        { id: "teachers", data_rows: [
          { id: "t1", short: "Jonaitis J.", name: "lektorius Jonaitis J." },
        ] },
        { id: "classrooms", data_rows: [{ id: "r1", short: "217" }] },
        { id: "groups", data_rows: [
          { id: "g0", classid: "*1", name: "Visa klasė", entireclass: true },
          { id: "g1", classid: "*1", name: "Pirma grupė", entireclass: false },
        ] },
        { id: "lessons", data_rows: [
          { id: "L1", subjectid: "s1", teacherids: ["t1"], classids: ["*1"], groupids: ["g0"], durationperiods: 1 },
          { id: "L2", subjectid: "s2", teacherids: ["t1"], classids: ["*1", "*2"], groupids: ["g0"], durationperiods: 1 },
          { id: "L3", subjectid: "s3", teacherids: ["t1"], classids: ["*1"], groupids: ["g1"], durationperiods: 2 },
          { id: "L4", subjectid: "s1", teacherids: ["t1"], classids: ["*2"], groupids: [], durationperiods: 1 },
        ] },
        { id: "cards", data_rows: [
          { lessonid: "L1", period: "1", days: "10000", weeks: "10", classroomids: ["r1"] },
          { lessonid: "L2", period: "2", days: "10000", weeks: "01", classroomids: [] },
          { lessonid: "L3", period: "2", days: "00001", weeks: "11", classroomids: ["r1"] },
          { lessonid: "L4", period: "3", days: "10000", weeks: "11", classroomids: ["r1"] },
        ] },
      ],
    },
  },
};

describe("parseDateRange", () => {
  test("reads an ISO range from a Lithuanian timetable title", () => {
    assert.deepEqual(
      parseDateRange("Nuolatinių (dieninių) tvarkaraštis 1 ir 2 savaitės atskirai 2026-09-02 - 2026-12-23"),
      { from: "2026-09-02", to: "2026-12-23" }
    );
  });

  test("reads a day-first range from an English timetable title", () => {
    assert.deepEqual(
      parseDateRange("Timetable for daily students 02-09-2026 - 23-12-2026"),
      { from: "2026-09-02", to: "2026-12-23" }
    );
  });

  test("returns null when the title has no range", () => {
    assert.equal(parseDateRange("Timetable"), null);
  });
});

describe("pickTimetable", () => {
  const viewer = (timetables, defaultNum = "331") => ({
    r: { regular: { default_num: defaultNum, timetables } },
  });

  test("picks the full-time week-split timetable over the others", () => {
    const picked = pickTimetable(viewer([
      { tt_num: "326", datefrom: "2026-09-01", text: "Nuotolinių/sesijinių paskaitų tvarkaraštis 2026-09-07 - 2026-12-23" },
      { tt_num: "328", datefrom: "2026-09-01", text: "Nuolatinių (dieninių) paskaitų tvarkaraštis 2026-09-02 - 2026-12-23" },
      { tt_num: "329", datefrom: "2026-09-01", text: "Nuolatinių (dieninių) tvarkaraštis 1 ir 2 savaitės atskirai 2026-09-02 - 2026-12-23" },
    ]), "2026-09-23");

    assert.deepEqual(picked, { ttNum: "329", from: "2026-09-02", to: "2026-12-23" });
  });

  test("picks the latest timetable that has started by the viewed date", () => {
    const list = viewer([
      { tt_num: "329", datefrom: "2026-09-01", text: "tvarkaraštis 1 ir 2 savaitės atskirai 2026-09-02 - 2026-12-23" },
      { tt_num: "340", datefrom: "2027-02-01", text: "tvarkaraštis 1 ir 2 savaitės atskirai 2027-02-03 - 2027-06-10" },
    ]);

    assert.equal(pickTimetable(list, "2026-10-01").ttNum, "329");
    assert.equal(pickTimetable(list, "2027-03-01").ttNum, "340");
    assert.equal(pickTimetable(list, "2026-08-20").ttNum, "329");
  });

  test("ignores hidden timetables", () => {
    const picked = pickTimetable(viewer([
      { tt_num: "329", hidden: true, datefrom: "2026-09-01", text: "1 ir 2 savaitės 2026-09-02 - 2026-12-23" },
      { tt_num: "330", datefrom: "2026-09-01", text: "1 ir 2 savaitės 2026-09-02 - 2026-12-23" },
    ]), "2026-09-23");

    assert.equal(picked.ttNum, "330");
  });

  test("falls back to the default timetable when no week-split one exists", () => {
    const picked = pickTimetable(viewer([
      { tt_num: "330", datefrom: "2026-09-01", text: "Timetable for daily students 02-09-2026 - 23-12-2026" },
      { tt_num: "331", datefrom: "2026-09-01", text: "Other" },
    ], "330"), "2026-09-23");

    assert.equal(picked.ttNum, "330");
  });

  test("returns null when nothing is published", () => {
    assert.equal(pickTimetable(viewer([]), "2026-09-23"), null);
    assert.equal(pickTimetable(null, "2026-09-23"), null);
  });
});

describe("weekIndexFor", () => {
  test("the week containing the term start is week 1 (index 0)", () => {
    assert.equal(weekIndexFor("2026-08-31", TERM.from, 2), 0);
    assert.equal(weekIndexFor("2026-09-06", TERM.from, 2), 0);
  });

  test("weeks then alternate", () => {
    assert.equal(weekIndexFor("2026-09-07", TERM.from, 2), 1);
    assert.equal(weekIndexFor("2026-09-13", TERM.from, 2), 1);
    assert.equal(weekIndexFor("2026-09-14", TERM.from, 2), 0);
    assert.equal(weekIndexFor("2026-09-23", TERM.from, 2), 1);
  });
});

describe("parseTimetable", () => {
  test("lists groups sorted by code", () => {
    const { groups } = parseTimetable(regularResponse);
    assert.deepEqual(groups.map((g) => g.short), ["IB26E", "TV26"]);
  });

  test("tolerates an empty response", () => {
    assert.deepEqual(parseTimetable({}).groups, []);
  });
});

describe("buildLecturesByDate", () => {
  const timetable = parseTimetable(regularResponse);
  const weekOfSep7 = { from: "2026-09-07", to: "2026-09-13" }; // week 2
  const weekOfSep14 = { from: "2026-09-14", to: "2026-09-20" }; // week 1

  test("shows week-2 lessons only in week 2", () => {
    const byDate = buildLecturesByDate(timetable, "*1", weekOfSep7, TERM);
    assert.deepEqual(byDate["2026-09-07"].map((l) => l.subject), ["Statistics"]);
  });

  test("shows week-1 lessons only in week 1", () => {
    const byDate = buildLecturesByDate(timetable, "*1", weekOfSep14, TERM);
    assert.deepEqual(byDate["2026-09-14"].map((l) => l.subject), ["Marketing"]);
  });

  test("fills in times, room, teacher, colour and period", () => {
    const [lecture] = buildLecturesByDate(timetable, "*1", weekOfSep14, TERM)["2026-09-14"];
    assert.deepEqual(lecture, {
      subject: "Marketing",
      subjectShort: "Mkt",
      classroom: "217",
      teacher: "Jonaitis J.",
      teacherFull: "lektorius Jonaitis J.",
      date: "2026-09-14",
      starttime: "08:30",
      endtime: "10:00",
      periodno: "1",
      color: "#33CC33",
      changed: false,
      subgroup: null,
    });
  });

  test("a multi-period lesson ends with its last period and names its subgroup", () => {
    const [seminar] = buildLecturesByDate(timetable, "*1", weekOfSep14, TERM)["2026-09-18"];
    assert.equal(seminar.starttime, "10:15");
    assert.equal(seminar.endtime, "14:00");
    assert.equal(seminar.subgroup, "Pirma grupė");
    assert.equal(seminar.classroom, "217");
  });

  test("a lesson with no room shows a dash", () => {
    const [stats] = buildLecturesByDate(timetable, "*1", weekOfSep7, TERM)["2026-09-07"];
    assert.equal(stats.classroom, "–");
  });

  test("only includes lessons of the chosen group", () => {
    const byDate = buildLecturesByDate(timetable, "*2", weekOfSep14, TERM);
    assert.deepEqual(byDate["2026-09-14"].map((l) => l.subject), ["Marketing"]);
    assert.equal(byDate["2026-09-14"][0].starttime, "12:30");
  });

  test("sorts a day's lessons by start time", () => {
    const byDate = buildLecturesByDate(timetable, "*2", weekOfSep7, TERM);
    assert.deepEqual(byDate["2026-09-07"].map((l) => l.starttime), ["10:15", "12:30"]);
  });

  test("leaves out days outside the term", () => {
    const byDate = buildLecturesByDate(
      timetable, "*1", { from: "2026-08-31", to: "2026-09-06" }, TERM
    );
    assert.equal(byDate["2026-08-31"], undefined);
    assert.ok(byDate["2026-09-04"]);
  });

  test("returns null without a timetable or group", () => {
    assert.equal(buildLecturesByDate(null, "*1", weekOfSep7, TERM), null);
    assert.equal(buildLecturesByDate(timetable, null, weekOfSep7, TERM), null);
  });
});
