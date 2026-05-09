
  UNINAVIGATOR — Academic Companion for Sri Lankan University Students
  Project ID  : WE_IT_06
  Course      : SE2020 WMT Project
  Campus      : SLIIT Malabe | Stream: Information Technology | WD/WE: WE
=============================================================================================
To view previous github history goto - https://github.com/IT24102603/IT-Project---ITP_105
Exsisting ITP project developed as mobile application.

OVERVIEW
--------
UniNavigator is a web and mobile platform that helps Sri Lankan university
students track GPA, attendance, modules, and academic tasks in one place.
It targets the specific pressures of local degree programmes — the 80%
attendance rule, weighted-credit GPA calculations, and degree-class
prediction — removing guesswork and helping students stay on track.

TEAM
----
  01  IT24103838  Dissanayaka D.M.H   — GPA Tracker & Goal Calculator
  02  IT24100309  Godagama U.H        — Attendance Tracker (80% Rule)
  03  IT24103056  Jpgnanatheepan N    — Repeat & Improvement Manager
  04  IT24102603  Rajapaksha K.M.P    — User Management & PDF Reports
  05  IT24100235  Gunarathne H.T.K    — Smart Task Planner

TECH STACK
----------
  Backend   : Node.js (>=20.10.0) + Express 4
  Database  : MongoDB (Mongoose 8)
  Auth      : JWT (jsonwebtoken) + bcryptjs
  PDF gen   : PDFKit
  Uploads   : Multer (max 10 MB per file)
  Email     : Nodemailer (concern forwarding)
  Frontend  : Vanilla JS + HTML/CSS  (frontend/public/)
  Mobile    : Expo (React Native)    (mobile/)

PROJECT STRUCTURE
-----------------
  uninavigator/
  ├── backend/
  │   ├── config/         — MongoDB connection (db.js)
  │   ├── middleware/      — JWT authentication (auth.js)
  │   ├── models/          — Mongoose schemas
  │   │     Attendance.js, AttendanceLog.js, Concern.js,
  │   │     LectureHall.js, Module.js, ScheduleSlot.js,
  │   │     Task.js, TimetablePdf.js, University.js,
  │   │     UsageEvent.js, User.js
  │   ├── routes/          — Express route handlers
  │   │     authAndUsers.js
  │   │     modulesAndGpa.js
  │   │     attendanceAndTasks.js
  │   │     universitiesConcernsAnalyticsAdmin.js
  │   ├── lib/             — Shared utilities
  │   │     constants.js   (grade scale, GPA points)
  │   │     mailer.js      (SMTP helper)
  │   ├── uploads/         — Multer upload directory (gitignored)
  │   ├── migrate.js       — DB migration helper
  │   ├── schema.sql        — Reference schema
  │   └── server.js        — Entry point (port 3000 default)
  ├── frontend/
  │   └── public/
  │       ├── index.html
  │       ├── css/style.css
  │       └── js/app.js, gpa-calculator.js
  ├── mobile/              — Expo app
  ├── .env.example         — Environment variable template
  └── package.json

GETTING STARTED
---------------
  1. Prerequisites
       Node.js >= 20.10.0
       A MongoDB Atlas cluster (or local MongoDB instance)

  2. Clone & install
       git clone <repo-url>
       cd uninavigator
       npm install

  3. Configure environment
       cp .env.example .env
       # Open .env and set the following:
       #   MONGODB_URI   — your Atlas connection string
       #   JWT_SECRET    — random string, min 16 characters
       #   JWT_EXPIRES_IN — token lifetime (default: 7d)
       #   PORT          — listening port (default: 3000)
       #   CORS_ORIGIN   — allowed origins, or * for all
       #   SMTP_*        — optional, for concern-forwarding emails

  4. Run the server
       npm start          # production
       npm run dev        # development (same entry point)

  5. Access
       API  →  http://localhost:3000
       Web  →  open frontend/public/index.html in a browser
               (or serve via any static file server)
       Mobile → cd mobile && npm install && npx expo start

ENVIRONMENT VARIABLES (.env)
-----------------------------
  MONGODB_URI       Required. MongoDB connection string.
  JWT_SECRET        Required. Min 16 characters. Keep secret.
  JWT_EXPIRES_IN    Optional. Default: 7d
  PORT              Optional. Default: 3000
  CORS_ORIGIN       Optional. Default: * (reflects all origins)
  SMTP_HOST         Optional. SMTP server host.
  SMTP_PORT         Optional. Default: 587
  SMTP_USER         Optional. SMTP username / email.
  SMTP_PASS         Optional. SMTP password.
  SMTP_FROM         Optional. From address for outgoing emails.

AUTHENTICATION
--------------
  Most endpoints require a Bearer token in the Authorization header:
    Authorization: Bearer <token>
  Tokens are issued on POST /register and POST /login.
  Admin endpoints additionally require the requesting user to have
  role = "admin" in the database.

GPA SCALE (4.0)
---------------
  A+ / A → 4.0   A- → 3.7   B+ → 3.3   B → 3.0   B- → 2.7
  C+ → 2.3       C  → 2.0   C- → 1.7   D → 1.0   E → 0.5   F → 0.0

FILE UPLOADS
------------
  Accepted endpoints that receive file uploads use multipart/form-data.
  Field name  : "file"  (timetable PDFs)  or  "proof"  (attendance mark)
  Size limit  : 10 MB per upload
  Storage     : backend/uploads/  (served at /uploads/<filename>)

HEALTH CHECK
------------
  GET /health
  Returns: { "ok": true, "db": "mongo" }

NOTES
-----
  * Never commit the .env file. It contains secrets.
  * For production, set a strong JWT_SECRET and restrict CORS_ORIGIN.
  * The mobile app is managed separately under mobile/ with its own
    package.json — run `npm --prefix mobile start` or use
    `npm run mobile` from the project root.


