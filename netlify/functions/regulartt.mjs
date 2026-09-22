import { EDUPAGE_ENDPOINTS, proxyToEdupage } from "../lib/edupageProxy.mjs";

// One weekly timetable: groups, subjects, teachers, rooms, lessons and cards
export default (req) => proxyToEdupage(req, EDUPAGE_ENDPOINTS.regulartt);
