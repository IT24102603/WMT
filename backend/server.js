/**
 * UniNavigator — Backend (Node.js + Express + MongoDB)
 *
 * Converted from MySQL/express-session to MongoDB/JWT.
 * All original API routes and business logic are preserved.
 *
 * Setup:
 *   npm install express mongoose bcryptjs jsonwebtoken cors dotenv
 *                multer nodemailer pdfkit xlsx
 *
 * Environment variables (.env):
 *   MONGO_URI=mongodb://localhost:27017/uniNavigator
 *   JWT_SECRET=uninavigator-jwt-secret
 *   PORT=3000
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM  (optional)
 */

require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const nodemailer = require("nodemailer");
const PDFDocument = require("pdfkit");
const XLSX = require("xlsx");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "uninavigator-jwt-secret";

// ============================================================
// Middleware
// ============================================================
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "10mb" }));

// ============================================================
// MongoDB Connection
// ============================================================
mongoose
  .connect(process.env.MONGO_URI || "mongodb://localhost:27017/uniNavigator")
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("MongoDB connection failed:", err.message));

// ============================================================
// Schemas & Models
// ============================================================

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, maxlength: 255 },
  email: { type: String, required: true, unique: true, maxlength: 255 },
  password: { type: String, required: true },
  role: { type: String, default: "student" },
  index_number: { type: String, default: null },
  profile_pic: { type: String, default: null },
  target_gpa: { type: Number, default: null },
  target_attendance: { type: Number, default: 80 },
  notify_deadlines: { type: Boolean, default: true },
  deadline_reminder_days: { type: Number, default: 3 },
  created_at: { type: Date, default: Date.now },
});
const User = mongoose.model("User", userSchema);

const universitySchema = new mongoose.Schema({
  name: { type: String, required: true, maxlength: 255 },
  general_email: { type: String, required: true },
  created_at: { type: Date, default: Date.now },
});
const University = mongoose.model("University", universitySchema);

const lectureHallSchema = new mongoose.Schema({
  university_id: { type: mongoose.Schema.Types.ObjectId, ref: "University", required: true },
  hall_name: { type: String, required: true, maxlength: 255 },
  building_name: { type: String, default: null },
  floor_number: { type: Number, default: null },
  center_lat: { type: Number, required: true },
  center_lng: { type: Number, required: true },
  radius_m: { type: Number, required: true },
  created_at: { type: Date, default: Date.now },
});
const LectureHall = mongoose.model("LectureHall", lectureHallSchema);

const moduleSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  university_id: { type: mongoose.Schema.Types.ObjectId, ref: "University", default: null },
  academic_year: { type: Number, default: null },
  semester_in_year: { type: Number, default: null },
  source_type: { type: String, default: "normal", maxlength: 30 },
  name: { type: String, required: true, maxlength: 255 },
  code: { type: String, default: null, maxlength: 50 },
  credits: { type: Number, default: 3 },
  grade_letter: { type: String, default: null },
  grade_point: { type: Number, default: null },
  ca_percentage: { type: Number, default: null },
  semester: { type: Number, default: 1 },
  is_repeat: { type: Boolean, default: false },
});
const Module = mongoose.model("Module", moduleSchema);

const attendanceSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  module_name: { type: String, required: true, maxlength: 255 },
  attended: { type: Number, default: 0 },
  total_sessions: { type: Number, default: 0 },
  semester: { type: Number, default: null },
});
const Attendance = mongoose.model("Attendance", attendanceSchema);

const attendanceLogSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  module_name: { type: String, required: true, maxlength: 255 },
  semester: { type: Number, default: null },
  attended: { type: Number, default: 0 },
  total_sessions: { type: Number, default: 0 },
  lecture_date: { type: Date, default: null },
  delivery_mode: { type: String, default: "offline" },
  university_id: { type: mongoose.Schema.Types.ObjectId, ref: "University", default: null },
  hall_id: { type: mongoose.Schema.Types.ObjectId, ref: "LectureHall", default: null },
  proof_path: { type: String, default: null },
  verification_status: { type: String, default: "pending" },
  created_at: { type: Date, default: Date.now },
});
const AttendanceLog = mongoose.model("AttendanceLog", attendanceLogSchema);

const scheduleSlotSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  university_id: { type: mongoose.Schema.Types.ObjectId, ref: "University", required: true },
  semester: { type: Number, default: null },
  academic_year: { type: Number, default: null },
  year_number: { type: Number, default: null },
  day_of_week: { type: String, required: true, maxlength: 15 },
  start_time: { type: String, required: true },
  end_time: { type: String, required: true },
  module_name: { type: String, required: true, maxlength: 255 },
  delivery_mode: { type: String, default: "physical" },
  location_text: { type: String, default: null },
  hall_id: { type: mongoose.Schema.Types.ObjectId, ref: "LectureHall", default: null },
  verification_status: { type: String, default: "timetable_missing" },
  created_at: { type: Date, default: Date.now },
});
const ScheduleSlot = mongoose.model("ScheduleSlot", scheduleSlotSchema);

const taskSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  module_code: { type: String, default: null, maxlength: 50 },
  title: { type: String, required: true, maxlength: 500 },
  due_date: { type: Date, default: null },
  priority_score: { type: Number, default: 5 },
  completed: { type: Boolean, default: false },
  created_at: { type: Date, default: Date.now },
});
const Task = mongoose.model("Task", taskSchema);

const timetablePdfSchema = new mongoose.Schema({
  university_id: { type: mongoose.Schema.Types.ObjectId, ref: "University", required: true },
  semester: { type: String, required: true, maxlength: 50 },
  academic_year: { type: Number, default: null },
  semester_number: { type: Number, default: null },
  year_number: { type: Number, default: null },
  file_path: { type: String, required: true },
  uploaded_by_admin_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  uploaded_by_user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  admin_review_status: { type: String, default: "pending" },
  admin_review_note: { type: String, default: null },
  created_at: { type: Date, default: Date.now },
});
const TimetablePdf = mongoose.model("TimetablePdf", timetablePdfSchema);

const concernSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  university_id: { type: mongoose.Schema.Types.ObjectId, ref: "University", required: true },
  category: { type: String, default: null },
  message: { type: String, required: true },
  status: { type: String, default: "open" },
  created_at: { type: Date, default: Date.now },
  forwarded_at: { type: Date, default: null },
});
const Concern = mongoose.model("Concern", concernSchema);

const usageEventSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  event_type: { type: String, required: true, maxlength: 50 },
  page: { type: String, default: null },
  meta: { type: mongoose.Schema.Types.Mixed, default: null },
  created_at: { type: Date, default: Date.now },
});
const UsageEvent = mongoose.model("UsageEvent", usageEventSchema);

// ============================================================
// File Uploads
// ============================================================
const UPLOAD_DIR = path.join(__dirname, "uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
const timetableUpload = multer({ dest: UPLOAD_DIR, limits: { fileSize: 10 * 1024 * 1024 } });
app.use("/uploads", express.static(UPLOAD_DIR));

// ============================================================
// Helpers
// ============================================================
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VALID_GRADES = ["A+", "A", "A-", "B+", "B", "B-", "C+", "C", "C-", "D", "E", "F"];

function isValidEmail(str) {
  return typeof str === "string" && str.length >= 3 && str.length <= 255 && EMAIL_REGEX.test(str.trim());
}

function generateToken(userId) {
  return jwt.sign({ userId: String(userId) }, JWT_SECRET, { expiresIn: "7d" });
}

function verifyToken(req, res, next) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Unauthorized" });
  try {
    req.userId = jwt.verify(token, JWT_SECRET).userId;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

async function requireAdmin(userId) {
  const user = await User.findById(userId).select("role");
  if (!user || user.role !== "admin") {
    const err = new Error("Forbidden: admin only");
    err.statusCode = 403;
    throw err;
  }
}

function buildMailer() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) return null;
  const port = parseInt(SMTP_PORT, 10);
  return nodemailer.createTransport({
    host: SMTP_HOST, port, secure: port === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
}

async function sendMail({ to, subject, text }) {
  const mailer = buildMailer();
  if (!mailer) throw new Error("SMTP is not configured on the server.");
  await mailer.sendMail({ from: process.env.SMTP_FROM || process.env.SMTP_USER || "no-reply@localhost", to, subject, text });
}

// ============================================================
// Auth Routes
// ============================================================

// POST /register
app.post("/register", async (req, res) => {
  try {
    const n = typeof req.body.name === "string" ? req.body.name.trim() : "";
    const e = typeof req.body.email === "string" ? req.body.email.trim() : "";
    const p = typeof req.body.password === "string" ? req.body.password : "";

    if (!n || n.length > 255) return res.status(400).json({ error: "Name is required (1–255 characters)" });
    if (!isValidEmail(e)) return res.status(400).json({ error: "Enter a valid email address" });
    if (!p || p.length < 6) return res.status(400).json({ error: "Password must be at least 6 characters" });

    const hashed = await bcrypt.hash(p, 10);
    const user = await User.create({ name: n, email: e.toLowerCase(), password: hashed });
    res.json({ id: user._id, name: user.name, email: user.email });
  } catch (err) {
    res.status(400).json({ error: "Email already exists" });
  }
});

// POST /login
app.post("/login", async (req, res) => {
  try {
    const email = typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : "";
    const password = typeof req.body.password === "string" ? req.body.password : "";
    if (!email || !password) return res.status(400).json({ error: "Email and password are required" });

    const user = await User.findOne({ email });
    if (!user) return res.json({ error: "Invalid credentials" });

    let isMatch = false;
    try { isMatch = await bcrypt.compare(password, user.password); } catch (_) {}
    if (!isMatch && user.password === password) {
      isMatch = true;
      user.password = await bcrypt.hash(password, 10);
      await user.save();
    }
    if (!isMatch) return res.json({ error: "Invalid credentials" });

    const token = generateToken(user._id);
    res.json({
      token,
      id: user._id,
      name: user.name,
      email: user.email,
      index_number: user.index_number,
      profile_pic: user.profile_pic,
      role: user.role || "student",
      target_gpa: user.target_gpa ?? null,
      target_attendance: user.target_attendance || 80,
      notify_deadlines: user.notify_deadlines ?? true,
      deadline_reminder_days: user.deadline_reminder_days ?? 3,
    });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// GET /me  (JWT-protected)
app.get("/me", verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.json({ user: null });
    res.json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        index_number: user.index_number,
        profile_pic: user.profile_pic,
        role: user.role || "student",
        target_gpa: user.target_gpa ?? null,
        target_attendance: user.target_attendance || 80,
        notify_deadlines: user.notify_deadlines ?? true,
        deadline_reminder_days: user.deadline_reminder_days ?? 3,
      },
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to load session" });
  }
});

// POST /logout  (client just discards token; endpoint kept for API parity)
app.post("/logout", (req, res) => res.json({ success: true }));

// ============================================================
// User Profile
// ============================================================

// GET /users/:id/profile
app.get("/users/:id/profile", async (req, res) => {
  try {
    const u = await User.findById(req.params.id);
    if (!u) return res.status(404).json({ error: "Not found" });
    res.json({
      id: u._id,
      name: u.name,
      email: u.email,
      index_number: u.index_number,
      profile_pic: u.profile_pic,
      target_gpa: u.target_gpa ?? null,
      target_attendance: u.target_attendance || 80,
      notify_deadlines: u.notify_deadlines ?? true,
      deadline_reminder_days: u.deadline_reminder_days ?? 3,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /users/:id/profile
app.put("/users/:id/profile", async (req, res) => {
  try {
    const { name, index_number, target_gpa, target_attendance, profile_pic, notify_deadlines, deadline_reminder_days } = req.body;
    const update = {};
    if (name !== undefined) {
      const n = typeof name === "string" ? name.trim() : "";
      if (n.length > 255) return res.status(400).json({ error: "Name must be 255 characters or less" });
      update.name = n;
    }
    if (index_number !== undefined) update.index_number = typeof index_number === "string" ? index_number.trim().slice(0, 100) || null : null;
    if (target_gpa !== undefined) {
      const tg = parseFloat(target_gpa);
      if (isNaN(tg) || tg < 0 || tg > 4) return res.status(400).json({ error: "Target GPA must be between 0 and 4" });
      update.target_gpa = tg;
    }
    if (target_attendance !== undefined) {
      const ta = parseInt(target_attendance, 10);
      if (isNaN(ta) || ta < 0 || ta > 100) return res.status(400).json({ error: "Target attendance must be between 0 and 100" });
      update.target_attendance = ta;
    }
    if (profile_pic !== undefined) update.profile_pic = profile_pic;
    if (notify_deadlines !== undefined) update.notify_deadlines = !!notify_deadlines;
    if (deadline_reminder_days !== undefined) update.deadline_reminder_days = Math.min(30, Math.max(1, parseInt(deadline_reminder_days, 10) || 3));

    await User.findByIdAndUpdate(req.params.id, { $set: update });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /users/:id
app.delete("/users/:id", async (req, res) => {
  try {
    const id = req.params.id;
    await Attendance.deleteMany({ user_id: id });
    await Task.deleteMany({ user_id: id });
    await Module.deleteMany({ user_id: id });
    await User.findByIdAndDelete(id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// Modules
// ============================================================

// GET /users/:id/modules
app.get("/users/:id/modules", async (req, res) => {
  try {
    const rows = await Module.find({ user_id: req.params.id });
    res.json(rows);
  } catch (err) {
    res.json([]);
  }
});

// POST /modules
app.post("/modules", async (req, res) => {
  try {
    const { user_id, university_id, academic_year, semester_in_year, source_type, name, code, credits, grade_letter, grade_point, ca_percentage, semester, is_repeat } = req.body;
    if (!user_id) return res.status(400).json({ error: "User ID is required" });
    const n = typeof name === "string" ? name.trim() : "";
    if (!n || n.length > 255) return res.status(400).json({ error: "Module name is required (1–255 characters)" });
    const cred = parseInt(credits, 10) || 3;
    if (cred < 1 || cred > 30) return res.status(400).json({ error: "Credits must be between 1 and 30" });
    if (grade_letter && !VALID_GRADES.includes(grade_letter)) return res.status(400).json({ error: "Invalid grade" });
    const ca = ca_percentage != null ? parseInt(ca_percentage, 10) : null;
    if (ca != null && (ca < 0 || ca > 100)) return res.status(400).json({ error: "CA percentage must be between 0 and 100" });
    const c = (typeof code === "string" ? code.trim().slice(0, 50) : "").toUpperCase();
    if (!c) return res.status(400).json({ error: "Module code is required" });
    const sem = semester != null ? parseInt(semester, 10) : 1;
    if (!sem || isNaN(sem) || sem < 1 || sem > 20) return res.status(400).json({ error: "Semester must be between 1 and 20" });
    const uniId = university_id || null;
    const ay = academic_year != null && academic_year !== "" ? parseInt(academic_year, 10) : null;
    if (ay != null && (isNaN(ay) || ay < 1 || ay > 10)) return res.status(400).json({ error: "Academic year must be between 1 and 10" });
    const siy = semester_in_year != null && semester_in_year !== "" ? parseInt(semester_in_year, 10) : null;
    if (siy != null && (isNaN(siy) || siy < 1 || siy > 3)) return res.status(400).json({ error: "Semester must be between 1 and 3" });
    const srcType = typeof source_type === "string" && source_type.trim() ? source_type.trim().slice(0, 30) : "normal";

    // Upsert: if code+user+semester+university already exists, update
    const existing = await Module.findOne({ user_id, code: c, semester: sem, university_id: uniId });
    const payload = { university_id: uniId, academic_year: ay, semester_in_year: siy, source_type: srcType, name: n, code: c, credits: cred, grade_letter: grade_letter || null, grade_point: grade_point != null ? parseFloat(grade_point) : null, ca_percentage: ca, semester: sem, is_repeat: !!is_repeat };

    if (existing) {
      await Module.findByIdAndUpdate(existing._id, { $set: payload });
      return res.json({ id: existing._id, updated: true });
    }

    const mod = await Module.create({ user_id, ...payload });
    res.json({ id: mod._id });
  } catch (err) {
  console.error("Module insert error:", err.message);
  if (err.code === 11000) return res.status(400).json({ error: "This module already exists for this semester" });
  res.status(500).json({ error: err.message || "Insert failed" });
}
});

// PUT /modules/:id
app.put("/modules/:id", async (req, res) => {
  try {
    const existing = await Module.findById(req.params.id);
    if (!existing) return res.status(404).json({ error: "Module not found" });
    const { grade_letter, grade_point, ca_percentage, is_repeat, semester } = req.body;
    const update = {};
    if (grade_letter !== undefined) {
      if (grade_letter && !VALID_GRADES.includes(grade_letter)) return res.status(400).json({ error: "Invalid grade" });
      update.grade_letter = grade_letter || null;
    }
    if (grade_point !== undefined) {
      const gp = grade_point != null ? parseFloat(grade_point) : null;
      if (gp != null && (isNaN(gp) || gp < 0 || gp > 4)) return res.status(400).json({ error: "Grade point must be between 0 and 4" });
      update.grade_point = gp;
    }
    if (ca_percentage !== undefined) {
      const ca = ca_percentage != null ? parseInt(ca_percentage, 10) : null;
      if (ca != null && (isNaN(ca) || ca < 0 || ca > 100)) return res.status(400).json({ error: "CA percentage must be between 0 and 100" });
      update.ca_percentage = ca;
    }
    if (is_repeat !== undefined) update.is_repeat = !!is_repeat;
    if (semester !== undefined) {
      const sem = parseInt(semester, 10) || 1;
      if (sem < 1 || sem > 20) return res.status(400).json({ error: "Semester must be between 1 and 20" });
      update.semester = sem;
    }
    if (Object.keys(update).length === 0) return res.json({ success: true });
    await Module.findByIdAndUpdate(req.params.id, { $set: update });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /modules/:id
app.delete("/modules/:id", async (req, res) => {
  try {
    await Module.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.json({ error: "Delete failed" });
  }
});

// ============================================================
// GPA Calculation
// ============================================================

// GET /users/:id/gpa
app.get("/users/:id/gpa", async (req, res) => {
  try {
    const rows = await Module.find({ user_id: req.params.id }).sort({ semester: 1, name: 1 });
    const semesters = {};
    let overallCredits = 0;
    let overallPoints = 0;

    rows.forEach((m) => {
      const sem = m.semester || 1;
      if (!semesters[sem]) semesters[sem] = { modules: [], credits: 0, points: 0 };
      semesters[sem].modules.push(m);
      if (m.grade_point != null) {
        semesters[sem].credits += m.credits;
        semesters[sem].points += m.grade_point * m.credits;
        overallCredits += m.credits;
        overallPoints += m.grade_point * m.credits;
      }
    });

    const semesterGpas = Object.keys(semesters).map((sem) => {
      const data = semesters[sem];
      const gpa = data.credits ? (data.points / data.credits).toFixed(2) : 0;
      return { semester: parseInt(sem), gpa: parseFloat(gpa), credits: data.credits, modules: data.modules };
    }).sort((a, b) => a.semester - b.semester);

    const overallGpa = overallCredits ? (overallPoints / overallCredits).toFixed(2) : 0;
    res.json({ overall: { gpa: parseFloat(overallGpa), credits: overallCredits }, semesters: semesterGpas, modules: rows });
  } catch (err) {
    res.json({ overall: { gpa: 0, credits: 0 }, semesters: [], modules: [] });
  }
});

// ============================================================
// Attendance
// ============================================================

// GET /users/:id/attendance
app.get("/users/:id/attendance", async (req, res) => {
  try {
    res.json(await Attendance.find({ user_id: req.params.id }));
  } catch (err) {
    res.json([]);
  }
});

// GET /users/:id/attendance-logs
app.get("/users/:id/attendance-logs", async (req, res) => {
  try {
    const logs = await AttendanceLog.find({
      user_id: req.params.id,
      verification_status: { $in: ["auto_verified", "approved"] },
    })
      .populate("university_id", "name")
      .populate("hall_id", "hall_name")
      .sort({ lecture_date: -1, created_at: -1 });
    res.json(logs);
  } catch (err) {
    res.json([]);
  }
});

// POST /attendance
app.post("/attendance", async (req, res) => {
  try {
    const { user_id, module_name, attended, total_sessions, semester } = req.body;
    if (!user_id) return res.status(400).json({ error: "User ID is required" });
    const mn = typeof module_name === "string" ? module_name.trim() : "";
    if (!mn || mn.length > 255) return res.status(400).json({ error: "Module name is required (1–255 characters)" });
    const att = parseInt(attended, 10) || 0;
    const tot = parseInt(total_sessions, 10) || 0;
    if (att < 0 || tot < 0) return res.status(400).json({ error: "Attended and total sessions must be 0 or greater" });
    if (att > tot) return res.status(400).json({ error: "Attended cannot exceed total sessions" });
    const rec = await Attendance.create({ user_id, module_name: mn, attended: att, total_sessions: tot, semester: semester != null ? parseInt(semester, 10) || null : null });
    res.json({ id: rec._id });
  } catch (err) {
    res.json({ error: "Attendance insert failed" });
  }
});

// POST /attendance/mark  (with optional file upload)
app.post("/attendance/mark", timetableUpload.single("proof"), async (req, res) => {
  try {
    const body = req.body || {};
    let { slot_id, user_id, module_name, attended, total_sessions, semester, delivery_mode, university_id, hall_id, academic_year, lecture_date } = body;
    if (!user_id) return res.status(400).json({ error: "user_id is required" });

    let mn = typeof module_name === "string" ? module_name.trim() : "";
    if (slot_id) {
      const slot = await ScheduleSlot.findOne({ _id: slot_id, user_id });
      if (!slot) return res.status(404).json({ error: "Schedule slot not found" });
      mn = slot.module_name;
      delivery_mode = slot.delivery_mode;
      university_id = slot.university_id;
      hall_id = slot.hall_id;
      semester = slot.semester;
    }
    if (!mn || mn.length > 255) return res.status(400).json({ error: "Module name is required (1-255 characters)" });

    const sem = semester != null ? parseInt(semester, 10) : null;
    const att = parseInt(attended, 10) || 0;
    const tot = parseInt(total_sessions, 10) || 0;
    if (att < 0 || tot < 0) return res.status(400).json({ error: "Attended and total sessions must be 0 or greater" });
    if (att > tot) return res.status(400).json({ error: "Attended cannot exceed total sessions" });

    const mode = delivery_mode === "online" ? "online" : "offline";
    const uniId = university_id || null;
    const hallId = hall_id || null;
    const dateVal = lecture_date ? String(lecture_date).slice(0, 10) : null;
    const yearNumber = academic_year != null ? parseInt(academic_year, 10) : null;

    let verificationStatus = "pending";
    let proofPath = null;

    if (mode === "offline") {
      if (!uniId || !hallId || !sem) return res.status(400).json({ error: "Offline attendance requires university, hall and semester" });
      if (yearNumber == null || isNaN(yearNumber) || yearNumber < 1 || yearNumber > 10) return res.status(400).json({ error: "Offline attendance requires academic_year (1-10)" });
      const hall = await LectureHall.findOne({ _id: hallId, university_id: uniId });
      if (!hall) return res.status(400).json({ error: "Selected hall does not belong to the selected university" });
      const timetable = await TimetablePdf.findOne({ uploaded_by_user_id: user_id, university_id: uniId, semester: String(sem), year_number: yearNumber });
      verificationStatus = timetable ? "auto_verified" : "timetable_missing";
    } else {
      if (!uniId || !sem) return res.status(400).json({ error: "Online attendance requires university and semester" });
      if (!req.file) return res.status(400).json({ error: "Proof upload is required for online lecture mode" });
      if (!["application/pdf"].includes(req.file.mimetype)) return res.status(400).json({ error: "Proof must be PDF" });
      proofPath = req.file.path;
      if (yearNumber == null || isNaN(yearNumber) || yearNumber < 1 || yearNumber > 10) return res.status(400).json({ error: "Online attendance requires academic_year (1-10)" });
      const timetable = await TimetablePdf.findOne({ uploaded_by_user_id: user_id, university_id: uniId, semester: String(sem), year_number: yearNumber });
      verificationStatus = timetable ? "auto_verified" : "timetable_missing";
    }

    const log = await AttendanceLog.create({ user_id, module_name: mn, semester: sem || null, attended: att, total_sessions: tot, lecture_date: dateVal || null, delivery_mode: mode, university_id: uniId, hall_id: hallId, proof_path: proofPath, verification_status: verificationStatus });

    let attendanceInserted = false;
    if (verificationStatus === "auto_verified") {
      await Attendance.create({ user_id, module_name: mn, attended: att, total_sessions: tot, semester: sem || null });
      attendanceInserted = true;
    }

    res.json({ success: true, log_id: log._id, verification_status: verificationStatus, attendance_inserted: attendanceInserted });
  } catch (err) {
    res.status(500).json({ error: "Attendance mark failed" });
  }
});

// ============================================================
// Admin: Attendance Queue
// ============================================================

// GET /admin/attendance-queue
app.get("/admin/attendance-queue", async (req, res) => {
  try {
    const adminUserId = req.query.admin_user_id;
    if (!adminUserId) return res.status(400).json({ error: "admin_user_id is required" });
    await requireAdmin(adminUserId);

    const status = req.query.status ? String(req.query.status).trim() : "";
    const allowed = ["pending", "timetable_missing", "approved", "rejected", "auto_verified", ""];
    const effectiveStatus = allowed.includes(status) ? status : "";
    const filter = effectiveStatus ? { verification_status: effectiveStatus } : { verification_status: { $in: ["pending", "timetable_missing"] } };

    const logs = await AttendanceLog.find(filter)
      .populate("user_id", "name")
      .populate("university_id", "name")
      .populate("hall_id", "hall_name building_name floor_number")
      .sort({ created_at: -1 })
      .limit(500);
    res.json(logs);
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message || "Admin failed" });
  }
});

// POST /admin/attendance-queue/:id/approve
app.post("/admin/attendance-queue/:id/approve", async (req, res) => {
  try {
    const adminUserId = req.body?.admin_user_id;
    if (!adminUserId) return res.status(400).json({ error: "admin_user_id is required" });
    await requireAdmin(adminUserId);
    const log = await AttendanceLog.findById(req.params.id);
    if (!log) return res.status(404).json({ error: "Attendance log not found" });
    if (log.verification_status === "approved") return res.json({ success: true, skipped: true });
    if (log.verification_status === "rejected") return res.status(400).json({ error: "Cannot approve rejected log" });
    await AttendanceLog.findByIdAndUpdate(req.params.id, { verification_status: "approved" });
    await Attendance.create({ user_id: log.user_id, module_name: log.module_name, attended: log.attended, total_sessions: log.total_sessions, semester: log.semester });
    res.json({ success: true });
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message || "Approve failed" });
  }
});

// POST /admin/attendance-queue/:id/reject
app.post("/admin/attendance-queue/:id/reject", async (req, res) => {
  try {
    const adminUserId = req.body?.admin_user_id;
    if (!adminUserId) return res.status(400).json({ error: "admin_user_id is required" });
    await requireAdmin(adminUserId);
    const log = await AttendanceLog.findById(req.params.id);
    if (!log) return res.status(404).json({ error: "Attendance log not found" });
    if (log.verification_status === "rejected") return res.json({ success: true, skipped: true });
    await AttendanceLog.findByIdAndUpdate(req.params.id, { verification_status: "rejected" });
    res.json({ success: true });
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message || "Reject failed" });
  }
});

// ============================================================
// Schedule Slots
// ============================================================

// POST /attendance/slots
app.post("/attendance/slots", async (req, res) => {
  try {
    const { user_id, university_id, semester, year_number, day_of_week, start_time, end_time, module_name, delivery_mode, location_text, hall_id } = req.body || {};
    if (!user_id) return res.status(400).json({ error: "user_id is required" });
    const sem = semester != null ? parseInt(semester, 10) : null;
    const yn = year_number != null ? parseInt(year_number, 10) : null;
    const day = typeof day_of_week === "string" ? day_of_week.trim() : "";
    const st = typeof start_time === "string" ? start_time.trim() : "";
    const et = typeof end_time === "string" ? end_time.trim() : "";
    const mn = typeof module_name === "string" ? module_name.trim() : "";
    const mode = delivery_mode === "online" ? "online" : "physical";
    const loc = location_text ? String(location_text).slice(0, 255) : null;

    if (!university_id) return res.status(400).json({ error: "university_id is invalid" });
    if (!sem || isNaN(sem)) return res.status(400).json({ error: "semester is invalid" });
    if (!yn || isNaN(yn) || yn < 1 || yn > 10) return res.status(400).json({ error: "academic year is invalid" });
    if (!day || day.length > 15) return res.status(400).json({ error: "day_of_week is required" });
    if (!st || !et) return res.status(400).json({ error: "start_time and end_time are required" });
    if (!mn || mn.length > 255) return res.status(400).json({ error: "module_name is required" });

    if (mode === "physical" && hall_id) {
      const hall = await LectureHall.findOne({ _id: hall_id, university_id });
      if (!hall) return res.status(400).json({ error: "hall_id does not belong to selected university" });
    }

    const timetable = await TimetablePdf.findOne({ uploaded_by_user_id: user_id, university_id, semester: String(sem), year_number: yn });
    const verificationStatus = timetable ? "auto_verified" : "timetable_missing";

    const slot = await ScheduleSlot.create({ user_id, university_id, semester: sem, year_number: yn, day_of_week: day, start_time: st, end_time: et, module_name: mn, delivery_mode: mode, location_text: loc, hall_id: hall_id || null, verification_status: verificationStatus });
    res.json({ success: true, slot_id: slot._id, verification_status: verificationStatus });
  } catch (err) {
    res.status(500).json({ error: "Slot insert failed" });
  }
});

// GET /attendance/slots
app.get("/attendance/slots", async (req, res) => {
  try {
    const { user_id, university_id, semester, year_number, day_of_week } = req.query || {};
    if (!user_id) return res.status(400).json({ error: "user_id is required" });
    if (!university_id) return res.status(400).json({ error: "university_id is invalid" });
    const sem = parseInt(semester, 10);
    const yn = parseInt(year_number, 10);
    if (isNaN(sem)) return res.status(400).json({ error: "semester is invalid" });
    if (isNaN(yn)) return res.status(400).json({ error: "year_number is invalid" });
    const filter = { user_id, university_id, semester: sem, year_number: yn };
    if (day_of_week) filter.day_of_week = day_of_week.trim();
    const slots = await ScheduleSlot.find(filter).sort({ start_time: 1 });
    res.json(slots);
  } catch (err) {
    res.status(500).json({ error: "Slots fetch failed" });
  }
});

// ============================================================
// Tasks
// ============================================================

// GET /users/:id/tasks
app.get("/users/:id/tasks", async (req, res) => {
  try {
    const tasks = await Task.find({ user_id: req.params.id }).sort({ due_date: 1, priority_score: -1 });
    res.json(tasks);
  } catch (err) {
    res.json([]);
  }
});

// POST /tasks
app.post("/tasks", async (req, res) => {
  try {
    const { user_id, module_code, title, due_date, priority_score } = req.body;
    if (!user_id) return res.status(400).json({ error: "User ID is required" });
    const mc = module_code != null ? String(module_code).trim().slice(0, 50).toUpperCase() : null;
    const t = typeof title === "string" ? title.trim() : "";
    if (!t || t.length > 500) return res.status(400).json({ error: "Task title is required (1–500 characters)" });
    const prio = parseInt(priority_score, 10) || 5;
    if (prio < 1 || prio > 10) return res.status(400).json({ error: "Priority must be between 1 and 10" });
    let due = null;
    if (due_date) { const d = new Date(due_date); if (!isNaN(d.getTime())) due = due_date; }
    const task = await Task.create({ user_id, module_code: mc, title: t, due_date: due, priority_score: prio });
    res.json({ id: task._id });
  } catch (err) {
    res.json({ error: "Task insert failed" });
  }
});

// PATCH /tasks/:id
app.patch("/tasks/:id", async (req, res) => {
  try {
    await Task.findByIdAndUpdate(req.params.id, { completed: !!req.body.completed });
    res.json({ success: true });
  } catch (err) {
    res.json({ error: "Update failed" });
  }
});

// DELETE /tasks/:id
app.delete("/tasks/:id", async (req, res) => {
  try {
    await Task.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.json({ error: "Delete failed" });
  }
});

// ============================================================
// Universities & Lecture Halls
// ============================================================

// GET /universities
app.get("/universities", async (req, res) => {
  try {
    res.json(await University.find().sort({ name: 1 }).select("name general_email"));
  } catch (err) {
    res.json([]);
  }
});

// GET /universities/:id/halls
app.get("/universities/:id/halls", async (req, res) => {
  try {
    const halls = await LectureHall.find({ university_id: req.params.id })
      .sort({ floor_number: 1, building_name: 1, hall_name: 1 })
      .select("hall_name building_name floor_number center_lat center_lng radius_m");
    res.json(halls);
  } catch (err) {
    res.json([]);
  }
});

// ============================================================
// Admin: User Management
// ============================================================

// GET /admin/users
app.get("/admin/users", async (req, res) => {
  try {
    const adminUserId = req.query.admin_user_id;
    if (!adminUserId) return res.status(400).json({ error: "admin_user_id is required" });
    await requireAdmin(adminUserId);
    const users = await User.find().sort({ created_at: -1 }).select("-password");
    res.json(users);
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message || "Admin failed" });
  }
});

// GET /admin/users/:id
app.get("/admin/users/:id", async (req, res) => {
  try {
    const adminUserId = req.query.admin_user_id;
    if (!adminUserId) return res.status(400).json({ error: "admin_user_id is required" });
    await requireAdmin(adminUserId);
    const u = await User.findById(req.params.id).select("-password");
    res.json(u || {});
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message || "Admin failed" });
  }
});

// PUT /admin/users/:id/role
app.put("/admin/users/:id/role", async (req, res) => {
  try {
    const { admin_user_id, role } = req.body || {};
    if (!admin_user_id) return res.status(400).json({ error: "admin_user_id is required" });
    await requireAdmin(admin_user_id);
    const newRole = role === "admin" ? "admin" : "student";
    await User.findByIdAndUpdate(req.params.id, { role: newRole });
    res.json({ success: true, role: newRole });
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message || "Admin failed" });
  }
});

// ============================================================
// Admin: Universities & Halls
// ============================================================

// POST /admin/universities
app.post("/admin/universities", async (req, res) => {
  try {
    const { admin_user_id, name, general_email } = req.body;
    if (!admin_user_id) return res.status(400).json({ error: "admin_user_id is required" });
    await requireAdmin(admin_user_id);
    const n = typeof name === "string" ? name.trim() : "";
    if (!n || n.length > 255) return res.status(400).json({ error: "University name is required (max 255)" });
    const e = typeof general_email === "string" ? general_email.trim() : "";
    if (!e || !isValidEmail(e)) return res.status(400).json({ error: "Valid general_email is required" });
    await University.create({ name: n, general_email: e });
    res.json({ success: true });
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message || "Admin failed" });
  }
});

// POST /admin/lecture-halls
app.post("/admin/lecture-halls", async (req, res) => {
  try {
    const { admin_user_id, university_id, hall_name, building_name, floor_number, center_lat, center_lng, radius_m } = req.body;
    if (!admin_user_id) return res.status(400).json({ error: "admin_user_id is required" });
    await requireAdmin(admin_user_id);
    if (!university_id) return res.status(400).json({ error: "university_id is invalid" });
    const hn = typeof hall_name === "string" ? hall_name.trim() : "";
    if (!hn || hn.length > 255) return res.status(400).json({ error: "hall_name is required (max 255)" });
    const lat = parseFloat(center_lat);
    const lng = parseFloat(center_lng);
    const r = parseInt(radius_m, 10);
    if (isNaN(lat) || lat < -90 || lat > 90) return res.status(400).json({ error: "center_lat invalid" });
    if (isNaN(lng) || lng < -180 || lng > 180) return res.status(400).json({ error: "center_lng invalid" });
    if (isNaN(r) || r < 1) return res.status(400).json({ error: "radius_m must be >= 1" });
    await LectureHall.create({ university_id, hall_name: hn, building_name: building_name || null, floor_number: floor_number != null ? parseInt(floor_number, 10) : null, center_lat: lat, center_lng: lng, radius_m: r });
    res.json({ success: true });
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message || "Admin failed" });
  }
});

// DELETE /admin/lecture-halls/:id
app.delete("/admin/lecture-halls/:id", async (req, res) => {
  try {
    const { admin_user_id } = req.body || {};
    if (!admin_user_id) return res.status(400).json({ error: "admin_user_id is required" });
    await requireAdmin(admin_user_id);
    await LectureHall.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message || "Admin failed" });
  }
});

// ============================================================
// Admin & Student: Timetable PDFs
// ============================================================

// POST /admin/timetable-pdfs
app.post("/admin/timetable-pdfs", timetableUpload.single("file"), async (req, res) => {
  try {
    const { admin_user_id, university_id, semester, year_number } = req.body || {};
    if (!admin_user_id) return res.status(400).json({ error: "admin_user_id is required" });
    await requireAdmin(admin_user_id);
    if (!university_id) return res.status(400).json({ error: "university_id is invalid" });
    const sem = typeof semester === "string" ? semester.trim() : "";
    if (!sem || sem.length > 50) return res.status(400).json({ error: "semester is required (max 50)" });
    const yn = year_number != null ? parseInt(year_number, 10) : null;
    if (yn != null && (isNaN(yn) || yn < 1 || yn > 10)) return res.status(400).json({ error: "academic year is invalid" });
    if (!req.file) return res.status(400).json({ error: "PDF file is required" });
    if (!["application/pdf"].includes(req.file.mimetype)) return res.status(400).json({ error: "Only PDF is allowed" });
    await TimetablePdf.create({ university_id, semester: sem, year_number: yn, file_path: req.file.path, uploaded_by_admin_id: admin_user_id });
    res.json({ success: true });
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message || "Upload failed" });
  }
});

// POST /attendance/timetable-pdfs  (student upload)
app.post("/attendance/timetable-pdfs", timetableUpload.single("file"), async (req, res) => {
  try {
    const { user_id, university_id, semester, year_number } = req.body || {};
    if (!user_id) return res.status(400).json({ error: "user_id is required" });
    const user = await User.findById(user_id).select("role");
    if (!user || user.role !== "student") return res.status(403).json({ error: "Only students can upload timetables" });
    if (!university_id) return res.status(400).json({ error: "university_id is invalid" });
    const sem = typeof semester === "string" ? semester.trim() : "";
    if (!sem || sem.length > 50) return res.status(400).json({ error: "semester is required (max 50)" });
    const yn = year_number != null ? parseInt(year_number, 10) : null;
    if (yn == null || isNaN(yn) || yn < 1 || yn > 10) return res.status(400).json({ error: "academic_year is required and must be 1-10" });
    if (!req.file) return res.status(400).json({ error: "File is required" });
    if (!["application/pdf"].includes(req.file.mimetype)) return res.status(400).json({ error: "Only PDF is allowed" });
    await TimetablePdf.create({ university_id, semester: sem, year_number: yn, file_path: req.file.path, uploaded_by_user_id: user_id });
    res.json({ success: true });
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message || "Upload failed" });
  }
});

// GET /users/:id/timetables
app.get("/users/:id/timetables", async (req, res) => {
  try {
    const rows = await TimetablePdf.find({ uploaded_by_user_id: req.params.id })
      .populate("university_id", "name")
      .sort({ created_at: -1 })
      .limit(50);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to load timetables" });
  }
});

// GET /admin/timetable-pdfs
app.get("/admin/timetable-pdfs", async (req, res) => {
  try {
    const adminUserId = req.query.admin_user_id;
    if (!adminUserId) return res.status(400).json({ error: "admin_user_id is required" });
    await requireAdmin(adminUserId);
    const filter = req.query.university_id ? { university_id: req.query.university_id } : {};
    const rows = await TimetablePdf.find(filter).sort({ created_at: -1 });
    res.json(rows);
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message || "Admin failed" });
  }
});

// GET /admin/student-timetables
app.get("/admin/student-timetables", async (req, res) => {
  try {
    const adminUserId = req.query.admin_user_id;
    if (!adminUserId) return res.status(400).json({ error: "admin_user_id is required" });
    await requireAdmin(adminUserId);
    const email = req.query.email ? String(req.query.email).trim() : "";
    const userFilter = email ? { email: { $regex: email, $options: "i" } } : {};
    const users = await User.find(userFilter).sort({ created_at: -1 }).limit(200).select("name email");
    const out = [];
    for (const u of users) {
      const timetables = await TimetablePdf.find({ uploaded_by_user_id: u._id }).populate("university_id", "name").sort({ created_at: -1 }).limit(10);
      const slots = await ScheduleSlot.find({ user_id: u._id }).sort({ created_at: -1 }).limit(50);
      out.push({ user: { id: u._id, name: u.name, email: u.email }, timetables, slots });
    }
    res.json(out);
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message || "Admin failed" });
  }
});

// POST /admin/timetables/:id/review
app.post("/admin/timetables/:id/review", async (req, res) => {
  try {
    const adminUserId = req.body?.admin_user_id;
    if (!adminUserId) return res.status(400).json({ error: "admin_user_id is required" });
    await requireAdmin(adminUserId);
    const status = ["approved", "rejected", "pending"].includes(req.body?.status) ? req.body.status : "pending";
    const note = req.body?.note ? String(req.body.note).slice(0, 500) : null;
    await TimetablePdf.findByIdAndUpdate(req.params.id, { admin_review_status: status, admin_review_note: note });
    res.json({ success: true });
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message || "Admin failed" });
  }
});

// ============================================================
// Concerns
// ============================================================

// POST /concerns
app.post("/concerns", async (req, res) => {
  try {
    const { user_id, university_id, category, message } = req.body || {};
    if (!user_id) return res.status(400).json({ error: "user_id is required" });
    if (!university_id) return res.status(400).json({ error: "university_id is invalid" });
    const msg = typeof message === "string" ? message.trim() : "";
    if (!msg || msg.length > 2000) return res.status(400).json({ error: "message is required (max 2000)" });
    await Concern.create({ user_id, university_id, category: category ? String(category).trim().slice(0, 50) : null, message: msg });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Concern submit failed" });
  }
});

// GET /users/:id/concerns
app.get("/users/:id/concerns", async (req, res) => {
  try {
    const concerns = await Concern.find({ user_id: req.params.id })
      .select("university_id category message status created_at forwarded_at")
      .sort({ created_at: -1 });
    res.json(concerns);
  } catch (err) {
    res.json([]);
  }
});

// GET /admin/concerns
app.get("/admin/concerns", async (req, res) => {
  try {
    const adminUserId = req.query.admin_user_id;
    if (!adminUserId) return res.status(400).json({ error: "admin_user_id is required" });
    await requireAdmin(adminUserId);
    const filter = req.query.status ? { status: String(req.query.status).trim() } : {};
    const concerns = await Concern.find(filter)
      .populate("user_id", "name")
      .populate("university_id", "name")
      .sort({ created_at: -1 });
    res.json(concerns);
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message || "Admin failed" });
  }
});

// POST /admin/concerns/:id/forward
app.post("/admin/concerns/:id/forward", async (req, res) => {
  try {
    const { admin_user_id } = req.body || {};
    if (!admin_user_id) return res.status(400).json({ error: "admin_user_id is required" });
    await requireAdmin(admin_user_id);
    const concern = await Concern.findById(req.params.id).populate("university_id", "general_email");
    if (!concern) return res.status(404).json({ error: "Concern not found" });
    if (concern.status === "forwarded") return res.json({ success: true, skipped: true });
    const to = concern.university_id?.general_email;
    if (!to) return res.status(400).json({ error: "University general_email not configured" });

    await Concern.findByIdAndUpdate(req.params.id, { status: "forwarded", forwarded_at: new Date() });
    try {
      await sendMail({ to, subject: `UniNavigator Concern: ${concern.category || "Concern"}`, text: `Student ID: ${concern.user_id}\n\nMessage:\n${concern.message}` });
    } catch (_) {
      // keep forwarded status even if mail fails
    }
    res.json({ success: true });
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message || "Forward failed" });
  }
});

// ============================================================
// Usage Analytics
// ============================================================

// POST /analytics/event
app.post("/analytics/event", async (req, res) => {
  try {
    const { user_id, event_type, page, meta } = req.body || {};
    if (!user_id) return res.status(400).json({ error: "user_id is required" });
    const et = typeof event_type === "string" ? event_type.trim() : "";
    if (!et || et.length > 50) return res.status(400).json({ error: "event_type is required (max 50)" });
    await UsageEvent.create({ user_id, event_type: et, page: page ? String(page).slice(0, 100) : null, meta: meta || null });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Event insert failed" });
  }
});

// GET /admin/analytics/usage-summary
app.get("/admin/analytics/usage-summary", async (req, res) => {
  try {
    const adminUserId = req.query.admin_user_id;
    if (!adminUserId) return res.status(400).json({ error: "admin_user_id is required" });
    await requireAdmin(adminUserId);
    const days = Math.min(30, Math.max(1, parseInt(req.query.days || 7, 10)));
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const rows = await UsageEvent.aggregate([
      { $match: { created_at: { $gte: since } } },
      { $group: { _id: { day: { $dateToString: { format: "%Y-%m-%d", date: "$created_at" } }, event_type: "$event_type" }, count: { $sum: 1 } } },
      { $sort: { "_id.day": 1 } },
    ]);
    res.json({ days, rows: rows.map(r => ({ day: r._id.day, event_type: r._id.event_type, count: r.count })) });
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message || "Admin failed" });
  }
});

// GET /admin/analytics/usage-export-excel
app.get("/admin/analytics/usage-export-excel", async (req, res) => {
  try {
    const adminUserId = req.query.admin_user_id;
    if (!adminUserId) return res.status(400).json({ error: "admin_user_id is required" });
    await requireAdmin(adminUserId);
    const days = Math.min(30, Math.max(1, parseInt(req.query.days || 7, 10)));
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const rows = await UsageEvent.aggregate([
      { $match: { created_at: { $gte: since } } },
      { $group: { _id: { day: { $dateToString: { format: "%Y-%m-%d", date: "$created_at" } }, event_type: "$event_type", page: "$page" }, count: { $sum: 1 } } },
      { $sort: { "_id.day": 1 } },
    ]);
    const data = rows.map(r => ({ Day: r._id.day, EventType: r._id.event_type, Page: r._id.page || "", Count: r.count }));
    const sheet = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, sheet, "usage");
    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    res.setHeader("Content-Disposition", `attachment; filename=uninavigator-usage-${days}d.xlsx`);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.send(buffer);
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message || "Export failed" });
  }
});

// ============================================================
// PDF Report
// ============================================================

// GET /users/:id/report.pdf
app.get("/users/:id/report.pdf", async (req, res) => {
  const user_id = req.params.id;
  const doc = new PDFDocument();
  res.setHeader("Content-Disposition", "attachment; filename=uninavigator-report.pdf");
  doc.pipe(res);
  doc.fontSize(18).text("Sri Lanka Institute of Information Technology", { align: "center" });
  doc.moveDown(0.3);
  doc.fontSize(13).text("Bachelor of Science Honours in Information Technology", { align: "center" });
  doc.moveDown(0.3);
  doc.fontSize(14).text("Student Performance Profile", { align: "center" });

  try {
    const user = await User.findById(user_id);
    if (user) {
      doc.moveDown();
      doc.fontSize(12).text(`Registration No: ${user.index_number || "N/A"}`);
      doc.moveDown(0.2).text(`Full Name: ${user.name}`);
      doc.moveDown(0.2).text("Specialization: Information Technology");
    }
    const modules = await Module.find({ user_id });
    const graded = modules.filter((m) => m.grade_point != null);
    const cumulativeCredits = graded.reduce((a, m) => a + (m.credits || 0), 0);
    const cumulativePoints = graded.reduce((a, m) => a + ((m.grade_point || 0) * (m.credits || 0)), 0);
    const cumulativeGpa = cumulativeCredits ? cumulativePoints / cumulativeCredits : 0;
    doc.moveDown();
    doc.text(`Cumulative Credits: ${cumulativeCredits}   |   Cumulative Grade Points: ${cumulativePoints.toFixed(2)}   |   Cumulative GPA: ${cumulativeGpa.toFixed(2)}`);

    const grouped = {};
    for (const m of modules) {
      const y = m.academic_year || Math.ceil((m.semester || 1) / 2);
      const s = m.semester_in_year || ((m.semester || 1) % 2 || 2);
      const key = `${y}-${s}`;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(m);
    }
    const keys = Object.keys(grouped).sort((a, b) => {
      const [ya, sa] = a.split("-").map(Number);
      const [yb, sb] = b.split("-").map(Number);
      return ya === yb ? sa - sb : ya - yb;
    });
    keys.forEach((k) => {
      const [y, s] = k.split("-");
      const rows = grouped[k];
      const semCredits = rows.filter((r) => r.grade_point != null).reduce((a, r) => a + (r.credits || 0), 0);
      const semPoints = rows.filter((r) => r.grade_point != null).reduce((a, r) => a + ((r.grade_point || 0) * (r.credits || 0)), 0);
      const semGpa = semCredits ? semPoints / semCredits : 0;
      doc.moveDown();
      doc.fontSize(12).text(`Academic Year: ${y}, Semester: ${s}, GPA: ${semGpa.toFixed(2)}`);
      rows.forEach((m) => {
        doc.fontSize(10).text(`${m.code || "-"} | ${m.name} | Credits: ${m.credits} | Attempt: 1 | Grade: ${m.grade_letter || "-"}`);
      });
    });
  } catch (err) {
    doc.text("Error loading data.");
  }
  doc.end();
});

// ============================================================
// Start Server
// ============================================================
app.listen(PORT, () => console.log(`UniNavigator backend running on port ${PORT}`));
