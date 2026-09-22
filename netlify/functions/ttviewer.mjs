import { EDUPAGE_ENDPOINTS, proxyToEdupage } from "../lib/edupageProxy.mjs";

// The faculty's published timetables for an academic year
export default (req) => proxyToEdupage(req, EDUPAGE_ENDPOINTS.ttviewer);
