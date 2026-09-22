// Request bodies for the EduPage timetable endpoints (see netlify/functions)

const GSH = "00000000";

/** The faculty's published timetables for an academic year. */
export const viewerPayload = (year) => ({ __args: [null, year], __gsh: GSH });

/** One regular (weekly) timetable by its number. */
export const regularPayload = (ttNum) => ({ __args: [null, ttNum], __gsh: GSH });
