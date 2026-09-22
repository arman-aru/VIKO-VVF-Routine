import { VerifiedIcon } from "./icons";

const OFFICIAL_TIMETABLE_URL = "https://vikovvf.edupage.org/timetable/";

/** States where the timetable comes from, so students can check it themselves. */
const SourceNote = () => (
  <p className="source-note">
    <VerifiedIcon size={15} className="source-note__icon" />
    <span>
      All data comes directly from the official VIKO VVF timetable:{" "}
      <a
        className="source-note__link"
        href={OFFICIAL_TIMETABLE_URL}
        target="_blank"
        rel="noopener noreferrer"
      >
        vikovvf.edupage.org/timetable
      </a>
    </span>
  </p>
);

export default SourceNote;
