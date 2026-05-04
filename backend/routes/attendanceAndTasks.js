const mongoose = require("mongoose");
const User = require("../models/User");
const University = require("../models/University");
const LectureHall = require("../models/LectureHall");
const TimetablePdf = require("../models/TimetablePdf");
const Attendance = require("../models/Attendance");
const AttendanceLog = require("../models/AttendanceLog");
const ScheduleSlot = require("../models/ScheduleSlot");
const Task = require("../models/Task");
const { requireAuth } = require("../middleware/auth");
const { oidRequired } = require("./helpers");

async function getUserRole(userId) {
  const u = await User.findById(userId).lean();
  if (!u) return null;
  return u.role || "student";
}

function registerAttendanceAndTasks(app, { timetableUpload }) {
  app.get("/users/:id/attendance", requireAuth, async (req, res) => {
    if (req.params.id !== req.user.id && req.user.role !== "admin") return res.status(403).json({ error: "Forbidden" });
    try {
      const uid = oidRequired(req.params.id, res);
      if (!uid) return;
      const rows = await Attendance.find({ user: uid }).lean();
      const out = rows.map((r) => ({
        id: r._id.toString(),
        user_id: r.user.toString(),
        module_name: r.module_name,
        attended: r.attended,
        total_sessions: r.total_sessions,
        semester: r.semester,
      }));
      res.json(out);
    } catch (_) {
      res.json([]);
    }
  });

  app.get("/users/:id/attendance-logs", requireAuth, async (req, res) => {
    if (req.params.id !== req.user.id && req.user.role !== "admin") return res.status(403).json({ error: "Forbidden" });
    try {
      const uid = oidRequired(req.params.id, res);
      if (!uid) return;
      const logs = await AttendanceLog.find({
        user: uid,
        verification_status: { $in: ["auto_verified", "approved"] },
      })
        .sort({ lecture_date: -1, created_at: -1 })
        .lean();

      const out = [];
      for (const l of logs) {
        const student = await User.findById(l.user).select("name").lean();
        const uni = l.university ? await University.findById(l.university).select("name").lean() : null;
        const hall = l.hall ? await LectureHall.findById(l.hall).select("hall_name").lean() : null;
        out.push({
          id: l._id.toString(),
          user_id: l.user.toString(),
          module_name: l.module_name,
          semester: l.semester,
          attended: l.attended,
          total_sessions: l.total_sessions,
          lecture_date: l.lecture_date ? l.lecture_date.toISOString().slice(0, 10) : null,
          delivery_mode: l.delivery_mode,
          university_id: l.university?.toString() || null,
          hall_id: l.hall?.toString() || null,
          proof_path: l.proof_path,
          verification_status: l.verification_status,
          created_at: l.created_at,
          student_name: student?.name || null,
          university_name: uni?.name || null,
          hall_name: hall?.hall_name || null,
        });
      }
      res.json(out);
    } catch (_) {
      res.json([]);
    }
  });

  app.post("/attendance", requireAuth, async (req, res) => {
    try {
      const { user_id, module_name, attended, total_sessions, semester } = req.body || {};
      if (!user_id) return res.status(400).json({ error: "User ID is required" });
      if (user_id !== req.user.id && req.user.role !== "admin") return res.status(403).json({ error: "Forbidden" });
      const mn = typeof module_name === "string" ? module_name.trim() : "";
      if (!mn || mn.length > 255) return res.status(400).json({ error: "Module name is required (1–255 characters)" });
      const att = parseInt(attended, 10) || 0;
      const tot = parseInt(total_sessions, 10) || 0;
      if (att < 0 || tot < 0) return res.status(400).json({ error: "Attended and total sessions must be 0 or greater" });
      if (att > tot) return res.status(400).json({ error: "Attended cannot exceed total sessions" });

      const uid = oidRequired(user_id, res);
      if (!uid) return;

      const created = await Attendance.create({
        user: uid,
        module_name: mn,
        attended: att,
        total_sessions: tot,
        semester: semester != null ? parseInt(semester, 10) || null : null,
      });
      res.json({ id: created._id.toString() });
    } catch (_) {
      res.json({ error: "Attendance insert failed" });
    }
  });

  app.post("/attendance/mark", requireAuth, timetableUpload.single("proof"), async (req, res) => {
    try {
      const body = req.body || {};
      const slot_id = body.slot_id;
      const user_id = req.user.id;
      let module_name = body.module_name;
      const attended = body.attended;
      const total_sessions = body.total_sessions;
      let semester = body.semester;
      let delivery_mode = body.delivery_mode;
      let university_id = body.university_id;
      let hall_id = body.hall_id;
      const academic_year = body.academic_year;
      const lecture_date = body.lecture_date;

      let mn = typeof module_name === "string" ? module_name.trim() : "";
      if (slot_id) {
        if (!mongoose.isValidObjectId(String(slot_id))) return res.status(400).json({ error: "slot_id is invalid" });
        const slot = await ScheduleSlot.findOne({
          _id: slot_id,
          user: req.user.id,
        }).lean();
        if (!slot) return res.status(404).json({ error: "Schedule slot not found" });
        mn = slot.module_name;
        delivery_mode = slot.delivery_mode === "online" ? "online" : "offline";
        university_id = slot.university?.toString();
        hall_id = slot.hall?.toString();
        semester = slot.semester;
      }

      if (!mn || mn.length > 255) return res.status(400).json({ error: "Module name is required (1-255 characters)" });

      const sem = semester != null ? parseInt(semester, 10) : null;
      const att = parseInt(attended, 10) || 0;
      const tot = parseInt(total_sessions, 10) || 0;
      if (att < 0 || tot < 0) return res.status(400).json({ error: "Attended and total sessions must be 0 or greater" });
      if (att > tot) return res.status(400).json({ error: "Attended cannot exceed total sessions" });

      const mode = delivery_mode === "online" ? "online" : "offline";
      const uniIdOid = oidOrNullFlexible(university_id);
      const hallIdOid = oidOrNullFlexible(hall_id);

      let dateVal = null;
      if (lecture_date) dateVal = new Date(String(lecture_date).slice(0, 10));
      const yearNumber = academic_year != null ? parseInt(academic_year, 10) : null;

      let verificationStatus = "pending";
      let proofPath = null;

      if (mode === "offline") {
        if (!uniIdOid || !hallIdOid || !sem)
          return res.status(400).json({ error: "Offline attendance requires university, hall and semester" });
        if (yearNumber == null || isNaN(yearNumber) || yearNumber < 1 || yearNumber > 10) {
          return res.status(400).json({ error: "Offline attendance requires academic_year (1-10)" });
        }
        const halls = await LectureHall.countDocuments({ _id: hallIdOid, university: uniIdOid });
        if (!halls) return res.status(400).json({ error: "Selected hall does not belong to the selected university" });

        const timetableRows = await TimetablePdf.findOne({
          uploaded_by_user: user_id,
          university: uniIdOid,
          semester: String(sem),
          year_number: yearNumber,
        })
          .sort({ createdAt: -1 })
          .lean();

        verificationStatus = timetableRows ? "auto_verified" : "timetable_missing";
      } else {
        if (!uniIdOid || !sem) return res.status(400).json({ error: "Online attendance requires university and semester" });
        if (!req.file) return res.status(400).json({ error: "Proof upload is required for online lecture mode" });
        if (req.file.mimetype !== "application/pdf") return res.status(400).json({ error: "Proof must be PDF" });
        proofPath = req.file.path;

        const lectureYear = yearNumber;
        if (lectureYear == null || isNaN(lectureYear) || lectureYear < 1 || lectureYear > 10) {
          return res.status(400).json({ error: "Online attendance requires academic_year (1-10)" });
        }

        const timetableRows = await TimetablePdf.findOne({
          uploaded_by_user: user_id,
          university: uniIdOid,
          semester: String(sem),
          year_number: lectureYear,
        })
          .sort({ createdAt: -1 })
          .lean();

        verificationStatus = timetableRows ? "auto_verified" : "timetable_missing";
      }

      const uidMark = oidOrNullFlexible(user_id);
      if (!uidMark) return res.status(400).json({ error: "user_id invalid" });

      const logInsert = await AttendanceLog.create({
        user: uidMark,
        module_name: mn,
        semester: sem || null,
        attended: att,
        total_sessions: tot,
        lecture_date: dateVal || null,
        delivery_mode: mode,
        university: uniIdOid,
        hall: hallIdOid,
        proof_path: proofPath,
        verification_status: verificationStatus,
      });

      let attendanceInserted = false;
      if (verificationStatus === "auto_verified") {
        await Attendance.create({
          user: uidMark,
          module_name: mn,
          attended: att,
          total_sessions: tot,
          semester: sem || null,
        });
        attendanceInserted = true;
      }

      res.json({
        success: true,
        log_id: logInsert._id.toString(),
        verification_status: verificationStatus,
        attendance_inserted: attendanceInserted,
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Attendance mark failed" });
    }
  });

  app.post("/attendance/slots", requireAuth, async (req, res) => {
    try {
      const {
        user_id,
        university_id,
        semester,
        year_number,
        day_of_week,
        start_time,
        end_time,
        module_name,
        delivery_mode,
        location_text,
        hall_id,
      } = req.body || {};

      if (!user_id) return res.status(400).json({ error: "User ID is required" });
      if (user_id !== req.user.id && req.user.role !== "admin") return res.status(403).json({ error: "Forbidden" });
      const uid = oidRequired(user_id, res);
      if (!uid) return;

      const uniId = university_id ? toUniversityOid(university_id) : null;
      const sem = semester != null ? parseInt(semester, 10) : null;
      const yn = year_number != null ? parseInt(year_number, 10) : null;
      const day = typeof day_of_week === "string" ? day_of_week.trim() : "";
      const st = typeof start_time === "string" ? start_time.trim() : "";
      const et = typeof end_time === "string" ? end_time.trim() : "";
      let mn = typeof module_name === "string" ? module_name.trim() : "";
      let mode = delivery_mode === "online" ? "online" : "physical";
      const loc = location_text ? String(location_text).slice(0, 255) : null;
      const hallIdOid = oidOrNullFlexible(hall_id);

      if (!uniId) return res.status(400).json({ error: "university_id is invalid" });
      if (!sem || isNaN(sem)) return res.status(400).json({ error: "semester is invalid" });
      if (!yn || isNaN(yn) || yn < 1 || yn > 10) return res.status(400).json({ error: "academic year is invalid" });
      if (!day || day.length > 15) return res.status(400).json({ error: "day_of_week is required" });
      if (!st || !et) return res.status(400).json({ error: "start_time and end_time are required" });
      if (!mn || mn.length > 255) return res.status(400).json({ error: "module_name is required" });

      let deliveryModeStored = mode === "online" ? "online" : "physical";
      if (deliveryModeStored === "physical" && hallIdOid) {
        const hallRows = await LectureHall.countDocuments({ _id: hallIdOid, university: uniId });
        if (!hallRows) return res.status(400).json({ error: "hall_id does not belong to selected university" });
      }

      const timetableRows = await TimetablePdf.findOne({
        uploaded_by_user: user_id,
        university: uniId,
        semester: String(sem),
        year_number: yn,
      })
        .sort({ createdAt: -1 })
        .lean();

      const verificationStatus = timetableRows ? "auto_verified" : "timetable_missing";

      const result = await ScheduleSlot.create({
        user: uid,
        university: uniId,
        semester: sem,
        academic_year: yn,
        year_number: yn,
        day_of_week: day,
        start_time: st,
        end_time: et,
        module_name: mn,
        delivery_mode: deliveryModeStored,
        location_text: loc,
        hall: hallIdOid || null,
        verification_status: verificationStatus,
      });

      res.json({ success: true, slot_id: result._id.toString(), verification_status: verificationStatus });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Slot insert failed" });
    }
  });

  app.get("/attendance/slots", requireAuth, async (req, res) => {
    try {
      const { user_id, university_id, semester, year_number, day_of_week } = req.query || {};
      const uid = user_id ? oidRequired(user_id, res, "user_id") : null;
      const uniId = university_id ? toUniversityOid(university_id) : null;
      const sem = semester != null ? parseInt(semester, 10) : null;
      const yn = year_number != null ? parseInt(year_number, 10) : null;
      const day = typeof day_of_week === "string" ? day_of_week.trim() : "";

      if (!uid) return res.status(400).json({ error: "user_id is required" });
      if (!uniId || !sem || !yn) return res.status(400).json({ error: "Invalid filters" });

      const q = { user: uid, university: uniId, semester: sem, year_number: yn };
      if (day) q.day_of_week = day;
      const rows = await ScheduleSlot.find(q).sort(day ? { start_time: 1 } : { day_of_week: 1, start_time: 1 }).lean();

      const out = rows.map((s) => ({
        id: s._id.toString(),
        day_of_week: s.day_of_week,
        start_time: s.start_time,
        end_time: s.end_time,
        module_name: s.module_name,
        delivery_mode: s.delivery_mode,
        location_text: s.location_text,
        hall_id: s.hall ? s.hall.toString() : null,
        verification_status: s.verification_status,
        created_at: s.created_at,
      }));
      res.json(out);
    } catch (_) {
      res.status(500).json({ error: "Slots fetch failed" });
    }
  });

  app.get("/users/:id/tasks", requireAuth, async (req, res) => {
    if (req.params.id !== req.user.id && req.user.role !== "admin") return res.status(403).json({ error: "Forbidden" });
    try {
      const uid = oidRequired(req.params.id, res);
      if (!uid) return;
      const rows = await Task.find({ user: uid }).sort({ due_date: 1, priority_score: -1 }).lean();
      const out = rows.map((t) => ({
        id: t._id.toString(),
        user_id: t.user.toString(),
        module_code: t.module_code,
        title: t.title,
        due_date: t.due_date ? t.due_date.toISOString().slice(0, 10) : null,
        priority_score: t.priority_score,
        completed: t.completed ? 1 : 0,
        created_at: t.created_at,
      }));
      res.json(out);
    } catch (_) {
      res.json([]);
    }
  });

  app.post("/tasks", requireAuth, async (req, res) => {
    try {
      const { user_id, module_code, title, due_date, priority_score } = req.body || {};
      if (!user_id) return res.status(400).json({ error: "User ID is required" });
      if (user_id !== req.user.id && req.user.role !== "admin") return res.status(403).json({ error: "Forbidden" });
      const mc = module_code != null ? String(module_code).trim().slice(0, 50).toUpperCase() : null;
      const tt = typeof title === "string" ? title.trim() : "";
      if (!tt || tt.length > 500) return res.status(400).json({ error: "Task title is required (1–500 characters)" });
      const prio = parseInt(priority_score, 10) || 5;
      if (prio < 1 || prio > 10) return res.status(400).json({ error: "Priority must be between 1 and 10" });
      let due = null;
      if (due_date) {
        const d = new Date(due_date);
        if (!isNaN(d.getTime())) due = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
      }
      const uid = oidRequired(user_id, res);
      if (!uid) return;
      const created = await Task.create({ user: uid, module_code: mc, title: tt, due_date: due, priority_score: prio });
      res.json({ id: created._id.toString() });
    } catch (_) {
      res.json({ error: "Task insert failed" });
    }
  });

  app.patch("/tasks/:id", requireAuth, async (req, res) => {
    try {
      if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: "Invalid id" });
      const tid = req.params.id;
      const existing = await Task.findById(tid).lean();
      if (!existing) return res.status(404).json({ error: "Not found" });
      if (existing.user.toString() !== req.user.id && req.user.role !== "admin")
        return res.status(403).json({ error: "Forbidden" });
      await Task.updateOne({ _id: tid }, { completed: !!(req.body && req.body.completed) });
      res.json({ success: true });
    } catch (_) {
      res.json({ error: "Update failed" });
    }
  });

  app.delete("/tasks/:id", requireAuth, async (req, res) => {
    try {
      if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: "Invalid id" });
      const existing = await Task.findById(req.params.id).lean();
      if (!existing) return res.status(404).json({ error: "Not found" });
      if (existing.user.toString() !== req.user.id && req.user.role !== "admin")
        return res.status(403).json({ error: "Forbidden" });
      await Task.deleteOne({ _id: req.params.id });
      res.json({ success: true });
    } catch (_) {
      res.json({ error: "Delete failed" });
    }
  });

}

registerAttendanceAndTasks.getUserRole = getUserRole;
module.exports = registerAttendanceAndTasks;

function oidOrNullFlexible(val) {
  if (val == null || val === "") return null;
  const s = String(val);
  if (!mongoose.isValidObjectId(s)) return null;
  return new mongoose.Types.ObjectId(s);
}

function toUniversityOid(u) {
  if (!mongoose.isValidObjectId(String(u))) return null;
  return new mongoose.Types.ObjectId(String(u));
}
