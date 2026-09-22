# VIKO VVF Lecture Timetable

A mobile-first PWA showing the lecture timetable for full-time students of
the VIKO Faculty of Business Management (Verslo vadybos fakultetas). All data
comes from the official timetable at <https://vikovvf.edupage.org/timetable/>.

## How the data works

VVF publishes weekly timetable templates rather than a dated timetable, and
lessons alternate between a **1st week** and a **2nd week**.

- `ttviewer` lists the faculty's published timetables. The app uses the
  full-time one with both weeks kept apart ("… 1 ir 2 savaitės atskirai …").
  It covers every full-time group, English groups included.
- `regulartt` returns that timetable's groups, lessons and cards.
- `src/utils/regularTimetable.js` turns the template into dated lessons. The
  week containing the term's first day (from the timetable title, e.g.
  `2026-09-02 - 2026-12-23`) is week 1, and weeks alternate from there.

Both endpoints are proxied from the same origin, so there is no separate
backend: Netlify Functions in `netlify/functions` in production, and the Vite
dev server proxy (`vite.config.js`) in development.

## Development

```bash
npm install
npm run dev     # http://localhost:5173
npm test        # unit tests for the timetable logic
npm run build
```

## Deploying to Netlify

Create a new Netlify project from this folder's repository. `netlify.toml`
sets the build command, the `dist` publish directory and the functions
directory, so no environment variables are needed.
