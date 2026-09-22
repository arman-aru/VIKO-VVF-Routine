import moment from "moment";

// VVF publishes no dated ("current") timetable, only weekly templates that
// alternate between a 1st and a 2nd week. This turns such a template into
// dated lessons shaped like the ones the day view renders.

const ISO = "YYYY-MM-DD";

// "Nuolatinių (dieninių) tvarkaraštis 1 ir 2 savaitės atskirai …" — the
// full-time timetable with both weeks kept apart. It covers every full-time
// group, English ones included.
const WEEK_SPLIT_TIMETABLE = /1 ir 2 savait/i;

const ISO_RANGE = /(\d{4}-\d{2}-\d{2})\s*-\s*(\d{4}-\d{2}-\d{2})/;
const DAY_FIRST_RANGE = /(\d{2})-(\d{2})-(\d{4})\s*-\s*(\d{2})-(\d{2})-(\d{4})/;

/** A timetable's validity, read from its title ("… 2026-09-02 - 2026-12-23"). */
export const parseDateRange = (text = "") => {
  const iso = text.match(ISO_RANGE);
  if (iso) return { from: iso[1], to: iso[2] };

  const dayFirst = text.match(DAY_FIRST_RANGE);
  if (dayFirst) {
    const [, d1, m1, y1, d2, m2, y2] = dayFirst;
    return { from: `${y1}-${m1}-${d1}`, to: `${y2}-${m2}-${d2}` };
  }
  return null;
};

/**
 * Chooses which published timetable to show for `date`: the full-time
 * week-split one (else the faculty's default), and of those the latest that
 * has already started — so the spring timetable takes over once it begins.
 */
export const pickTimetable = (viewerData, date) => {
  const regular = viewerData?.r?.regular;
  const visible = (regular?.timetables || []).filter((t) => !t.hidden);
  const weekSplit = visible.filter((t) => WEEK_SPLIT_TIMETABLE.test(t.text));
  const pool = weekSplit.length
    ? weekSplit
    : visible.filter((t) => t.tt_num === regular?.default_num);
  if (!pool.length) return null;

  const sorted = pool
    .map((t) => {
      const range = parseDateRange(t.text);
      return { ttNum: t.tt_num, from: range?.from || t.datefrom, to: range?.to || null };
    })
    .sort((a, b) => a.from.localeCompare(b.from));

  const started = sorted.filter((t) => t.from <= date);
  return started.length ? started[started.length - 1] : sorted[0];
};

/**
 * Position of `date` in the timetable's week cycle. The week containing the
 * term's first day is week 1 (index 0); weeks alternate from there.
 */
export const weekIndexFor = (date, termStart, cycleLength) => {
  const weeks = moment(date, ISO)
    .startOf("isoWeek")
    .diff(moment(termStart, ISO).startOf("isoWeek"), "weeks");
  return ((weeks % cycleLength) + cycleLength) % cycleLength;
};

// "Verslumo centras (Entrepreneurship Centre) (221)", "Tokijas (Tokyo)(226)"
const TRAILING_ROOM_NUMBER = /^(.*?)\s*\(\s*(\d[\w-]*)\s*\)$/;
const BARE_ROOM_NUMBER = /^\d[\w-]*$/;
const TRANSLATION = /\s*\(([^()]+)\)$/;

/**
 * Splits an EduPage room label into its number and a readable name, so the
 * number — what students look for — can lead. Rooms without a number
 * ("Teams") come back as a name only.
 */
export const parseRoom = (label = "") => {
  const text = label.trim();
  const numbered = text.match(TRAILING_ROOM_NUMBER);
  if (numbered) {
    const name = numbered[1].replace(TRANSLATION, " · $1").trim();
    return { number: numbered[2], name: name || null };
  }
  if (BARE_ROOM_NUMBER.test(text)) return { number: text, name: null };
  return { number: null, name: text || null };
};

const indexById = (rows) => new Map(rows.map((row) => [String(row.id), row]));

/** Indexes a regularttGetData response once, so days can be built cheaply. */
export const parseTimetable = (ttData) => {
  const tables = Object.fromEntries(
    (ttData?.r?.dbiAccessorRes?.tables || []).map((t) => [t.id, t.data_rows || []])
  );
  const rows = (name) => tables[name] || [];

  return {
    groups: rows("classes")
      .map((c) => ({ id: String(c.id), short: c.short, name: c.name }))
      .sort((a, b) => a.short.localeCompare(b.short)),
    subjects: indexById(rows("subjects")),
    teachers: indexById(rows("teachers")),
    classrooms: indexById(rows("classrooms")),
    divisions: indexById(rows("groups")),
    lessons: indexById(rows("lessons")),
    periods: new Map(rows("periods").map((p) => [String(p.period), p])),
    cards: rows("cards"),
  };
};

const namesOf = (ids, index, key) =>
  (ids || [])
    .map((id) => index.get(String(id))?.[key])
    .filter(Boolean)
    .join(", ");

/** The class's subgroup for this lesson ("Pirma grupė"), or null for all. */
const subgroupOf = (lesson, classId, divisions) =>
  (lesson.groupids || [])
    .map((id) => divisions.get(String(id)))
    .filter((g) => g && String(g.classid) === classId && !g.entireclass)
    .map((g) => g.name)
    .join(", ") || null;

const toLecture = ({ card, lesson }, date, classId, timetable) => {
  const { subjects, teachers, classrooms, divisions, periods } = timetable;
  const subject = subjects.get(String(lesson.subjectid));
  const firstPeriod = periods.get(String(card.period));
  const lastPeriod = periods.get(
    String(Number(card.period) + (lesson.durationperiods || 1) - 1)
  );

  return {
    subject: subject?.name || subject?.short || "Unknown subject",
    subjectShort: subject?.short || "?",
    classroom: namesOf(card.classroomids, classrooms, "short") || "–",
    rooms: (card.classroomids || [])
      .map((id) => classrooms.get(String(id))?.short)
      .filter(Boolean)
      .map(parseRoom),
    teacher: namesOf(lesson.teacherids, teachers, "short") || "–",
    teacherFull: namesOf(lesson.teacherids, teachers, "name") || "–",
    date,
    starttime: firstPeriod?.starttime || "",
    endtime: (lastPeriod || firstPeriod)?.endtime || "",
    periodno: card.period,
    color: subject?.color || null,
    changed: false,
    subgroup: subgroupOf(lesson, classId, divisions),
  };
};

const isScheduledOn = (card, date, term) => {
  const dayIndex = moment(date, ISO).isoWeekday() - 1;
  if (card.days?.[dayIndex] !== "1") return false;
  if (!card.weeks) return true;
  return card.weeks[weekIndexFor(date, term.from, card.weeks.length)] === "1";
};

const isInTerm = (date, term) =>
  date >= term.from && (!term.to || date <= term.to);

/**
 * One group's lessons for each date in `range` (inclusive), keyed by
 * YYYY-MM-DD and sorted by start time. Days without lessons are left out.
 */
export const buildLecturesByDate = (timetable, classId, range, term) => {
  if (!timetable || !classId) return null;

  const classCards = timetable.cards
    .map((card) => ({ card, lesson: timetable.lessons.get(String(card.lessonid)) }))
    .filter(({ lesson }) => lesson?.classids?.map(String).includes(classId));

  const dayCount = moment(range.to, ISO).diff(moment(range.from, ISO), "days") + 1;
  const dates = Array.from({ length: Math.max(0, dayCount) }, (_, i) =>
    moment(range.from, ISO).add(i, "days").format(ISO)
  );

  return Object.fromEntries(
    dates
      .filter((date) => isInTerm(date, term))
      .map((date) => [
        date,
        classCards
          .filter(({ card }) => isScheduledOn(card, date, term))
          .map((entry) => toLecture(entry, date, classId, timetable))
          .sort((a, b) => a.starttime.localeCompare(b.starttime)),
      ])
      .filter(([, lectures]) => lectures.length > 0)
  );
};
