const mongoose = require("mongoose");
const XLSX = require("xlsx");
const University = require("../models/University");
const LectureHall = require("../models/LectureHall");
const TimetablePdf = require("../models/TimetablePdf");
const User = require("../models/User");
const Concern = require("../models/Concern");
const UsageEvent = require("../models/UsageEvent");
const AttendanceLog = require("../models/AttendanceLog");
const Attendance = require("../models/Attendance");
const ScheduleSlot = require("../models/ScheduleSlot");
const { isValidEmail } = require("../lib/constants");
const { sendMail } = require("../lib/mailer");
const {
  requireAuth,
  requireAdminFromBodyOrAuth,
  requireAdminByQuery,
} = require("../middleware/auth");
const { oidRequired } = require("./helpers");
const getUserRole = require("./attendanceAndTasks").getUserRole;

module.exports = function registerUniversitiesAdminEtc(app, { timetableUpload }) {
  app.get("/universities", async (_req, res) => {
    try {
      const rows = await University.find().select("name general_email").sort({ name: 1 }).lean();
      res.json(rows.map((r) => ({ id: r._id.toString(), name: r.name, general_email: r.general_email })));
    } catch (_) {
      res.json([]);
    }
  });

  app.get("/universities/:id/halls", async (req, res) => {
    try {
      const uniId = oidRequired(req.params.id, res, "university id");
      if (!uniId) return;
      const halls = await LectureHall.find({ university: uniId })
        .sort({ floor_number: 1, building_name: 1, hall_name: 1 })
        .lean();
      res.json(
        halls.map((h) => ({
          id: h._id.toString(),
          university_id: h.university.toString(),
          hall_name: h.hall_name,
          building_name: h.building_name,
          floor_number: h.floor_number,
          center_lat: h.center_lat,
          center_lng: h.center_lng,
          radius_m: h.radius_m,
        }))
      );
    } catch (_) {
      res.json([]);
    }
  });

  app.post("/concerns", requireAuth, async (req, res) => {
    try {
      const { user_id, university_id, category, message } = req.body || {};
      if (!user_id || user_id !== req.user.id) return res.status(403).json({ error: "Forbidden" });
      const uid = oidRequired(user_id, res);
      if (!uid) return;
      const uniOid = oidRequired(university_id, res, "university_id");
      if (!uniOid) return;
      const msg = typeof message === "string" ? message.trim() : "";
      if (!msg || msg.length > 2000) return res.status(400).json({ error: "message is required (max 2000)" });
      await Concern.create({
        user: uid,
        university: uniOid,
        category: category ? String(category).trim().slice(0, 50) : null,
        message: msg,
      });
      res.json({ success: true });
    } catch (_) {
      res.status(500).json({ error: "Concern submit failed" });
    }
  });

  app.get("/users/:id/concerns", requireAuth, async (req, res) => {
    if (req.params.id !== req.user.id && req.user.role !== "admin") return res.status(403).json({ error: "Forbidden" });
    try {
      const uid = oidRequired(req.params.id, res);
      if (!uid) return;
      const rows = await Concern.find({ user: uid }).sort({ created_at: -1 }).lean();
      const out = [];
      for (const c of rows) {
        const uni = c.university ? await University.findById(c.university).select("name").lean() : null;
        out.push({
          id: c._id.toString(),
          university_id: c.university?.toString() || null,
          university_name: uni?.name || null,
          category: c.category,
          message: c.message,
          status: c.status,
          created_at: c.created_at,
          forwarded_at: c.forwarded_at,
        });
      }
      res.json(out);
    } catch (_) {
      res.json([]);
    }
  });

  app.post("/analytics/event", requireAuth, async (req, res) => {
    try {
      const { user_id, event_type, page, meta } = req.body || {};
      if (!user_id || user_id !== req.user.id) return res.status(403).json({ error: "Forbidden" });
      const et = typeof event_type === "string" ? event_type.trim() : "";
      if (!et || et.length > 50) return res.status(400).json({ error: "event_type is required (max 50)" });
      const uid = oidRequired(user_id, res);
      if (!uid) return;
      const p = page ? String(page).slice(0, 100) : null;
      await UsageEvent.create({ user: uid, event_type: et, page: p, meta: meta && typeof meta === "object" ? meta : meta || null });
      res.json({ success: true });
    } catch (_) {
      res.status(500).json({ error: "Event insert failed" });
    }
  });

  app.get("/admin/attendance-queue", requireAdminByQuery, async (req, res) => {
    try {
      const status = req.query.status ? String(req.query.status).trim() : "";
      const allowed = ["pending", "timetable_missing", "approved", "rejected", "auto_verified", ""];
      const effectiveStatus = allowed.includes(status) ? status : "";

      const filter = effectiveStatus
        ? { verification_status: effectiveStatus }
        : { verification_status: { $in: ["pending", "timetable_missing"] } };

      const logs = await AttendanceLog.find(filter).sort({ created_at: -1 }).limit(500).lean();

      const rows = [];
      for (const l of logs) {
        const u = await User.findById(l.user).select("name").lean();
        const uni = l.university ? await University.findById(l.university).select("name").lean() : null;
        const hall = l.hall ? await LectureHall.findById(l.hall).lean() : null;
        let latestPath = null;
        if (l.user && l.university && l.semester && l.lecture_date) {
          const y = new Date(l.lecture_date).getFullYear();
          const pdf = await TimetablePdf.findOne({
            uploaded_by_user: l.user,
            university: l.university,
            semester: String(l.semester),
            year_number: y,
          })
            .sort({ createdAt: -1 })
            .lean();
          latestPath = pdf?.file_path || null;
        }
        rows.push({
          id: l._id.toString(),
          user_id: l.user.toString(),
          student_name: u?.name || null,
          module_name: l.module_name,
          semester: l.semester,
          attended: l.attended,
          total_sessions: l.total_sessions,
          lecture_date: l.lecture_date ? l.lecture_date.toISOString().slice(0, 10) : null,
          delivery_mode: l.delivery_mode,
          verification_status: l.verification_status,
          proof_path: l.proof_path,
          university_name: uni?.name || null,
          hall_name: hall?.hall_name || null,
          building_name: hall?.building_name || null,
          floor_number: hall?.floor_number ?? null,
          latest_student_timetable_path: latestPath,
        });
      }
      res.json(rows);
    } catch (e) {
      res.status(e.statusCode || 500).json({ error: e.message || "Admin failed" });
    }
  });

  app.post("/admin/attendance-queue/:id/approve", requireAdminFromBodyOrAuth, async (req, res) => {
    try {
      if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: "Invalid log id" });
      const logs = await AttendanceLog.findById(req.params.id).lean();
      if (!logs) return res.status(404).json({ error: "Attendance log not found" });
      if (logs.verification_status === "approved") return res.json({ success: true, skipped: true });
      if (logs.verification_status === "rejected") return res.status(400).json({ error: "Cannot approve rejected log" });

      await AttendanceLog.updateOne({ _id: req.params.id }, { verification_status: "approved" });
      await Attendance.create({
        user: logs.user,
        module_name: logs.module_name,
        attended: logs.attended,
        total_sessions: logs.total_sessions,
        semester: logs.semester,
      });
      res.json({ success: true });
    } catch (e) {
      res.status(e.statusCode || 500).json({ error: e.message || "Approve failed" });
    }
  });

  app.post("/admin/attendance-queue/:id/reject", requireAdminFromBodyOrAuth, async (req, res) => {
    try {
      if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: "Invalid log id" });
      const logs = await AttendanceLog.findById(req.params.id).lean();
      if (!logs) return res.status(404).json({ error: "Attendance log not found" });
      if (logs.verification_status === "rejected") return res.json({ success: true, skipped: true });
      await AttendanceLog.updateOne({ _id: req.params.id }, { verification_status: "rejected" });
      res.json({ success: true });
    } catch (e) {
      res.status(e.statusCode || 500).json({ error: e.message || "Reject failed" });
    }
  });

  app.get("/users/:id/timetables", requireAuth, async (req, res) => {
    if (req.params.id !== req.user.id && req.user.role !== "admin") return res.status(403).json({ error: "Forbidden" });
    try {
      const userId = oidRequired(req.params.id, res);
      if (!userId) return;
      const rows = await TimetablePdf.find({ uploaded_by_user: userId }).sort({ createdAt: -1 }).limit(50).lean();
      const out = [];
      for (const tp of rows) {
        const uni = tp.university ? await University.findById(tp.university).select("name").lean() : null;
        out.push({
          id: tp._id.toString(),
          university_id: tp.university?.toString() || null,
          university_name: uni?.name || null,
          semester: tp.semester,
          academic_year: tp.academic_year,
          year_number: tp.year_number,
          file_path: tp.file_path,
          created_at: tp.createdAt,
        });
      }
      res.json(out);
    } catch (_) {
      res.status(500).json({ error: "Failed to load timetables" });
    }
  });

  app.post("/attendance/timetable-pdfs", requireAuth, timetableUpload.single("file"), async (req, res) => {
    try {
      const { user_id, university_id, semester, year_number } = req.body || {};
      if (!user_id || user_id !== req.user.id) return res.status(403).json({ error: "Forbidden" });
      const role = await getUserRole(user_id);
      if (role !== "student") return res.status(403).json({ error: "Only students can upload timetables" });
      const uniOidPdf = oidRequired(university_id, res, "university_id");
      if (!uniOidPdf) return;
      const sem = typeof semester === "string" ? semester.trim() : "";
      if (!sem || sem.length > 50) return res.status(400).json({ error: "semester is required (max 50)" });
      const yn = year_number != null ? parseInt(year_number, 10) : null;
      if (yn == null || isNaN(yn) || yn < 1 || yn > 10) return res.status(400).json({ error: "academic_year is required and must be 1-10" });
      if (!req.file) return res.status(400).json({ error: "File is required" });
      if (req.file.mimetype !== "application/pdf") return res.status(400).json({ error: "Only PDF is allowed" });
      await TimetablePdf.create({
        university: uniOidPdf,
        semester: sem,
        year_number: yn,
        file_path: req.file.path,
        uploaded_by_user: user_id,
      });
      res.json({ success: true });
    } catch (e) {
      res.status(e.statusCode || 500).json({ error: e.message || "Upload failed" });
    }
  });

  app.get("/admin/users", requireAdminByQuery, async (_req, res) => {
    try {
      const rows = await User.find()
        .select(
          "name email index_number role createdAt target_gpa target_attendance notify_deadlines deadline_reminder_days"
        )
        .sort({ createdAt: -1 })
        .lean();
      res.json(
        rows.map((u) => ({
          id: u._id.toString(),
          name: u.name,
          email: u.email,
          index_number: u.index_number,
          role: u.role,
          created_at: u.createdAt,
          target_gpa: u.target_gpa,
          target_attendance: u.target_attendance,
          notify_deadlines: u.notify_deadlines,
          deadline_reminder_days: u.deadline_reminder_days,
        }))
      );
    } catch (e) {
      res.status(e.statusCode || 500).json({ error: e.message || "Admin failed" });
    }
  });

  app.get("/admin/users/:id", requireAdminByQuery, async (req, res) => {
    try {
      const u = oidRequired(req.params.id, res, "id");
      if (!u) return;
      const rows = await User.findById(u)
        .select(
          "name email index_number role createdAt target_gpa target_attendance notify_deadlines deadline_reminder_days"
        )
        .lean();
      if (!rows) return res.json({});
      res.json({
        id: rows._id.toString(),
        name: rows.name,
        email: rows.email,
        index_number: rows.index_number,
        role: rows.role,
        created_at: rows.createdAt,
        target_gpa: rows.target_gpa,
        target_attendance: rows.target_attendance,
        notify_deadlines: rows.notify_deadlines,
        deadline_reminder_days: rows.deadline_reminder_days,
      });
    } catch (e) {
      res.status(e.statusCode || 500).json({ error: e.message || "Admin failed" });
    }
  });

  app.put("/admin/users/:id/role", requireAdminFromBodyOrAuth, async (req, res) => {
    try {
      const newRole = req.body?.role === "admin" ? "admin" : "student";
      const oid = oidRequired(req.params.id, res, "id");
      if (!oid) return;
      await User.updateOne({ _id: oid }, { role: newRole });
      res.json({ success: true, role: newRole });
    } catch (e) {
      res.status(e.statusCode || 500).json({ error: e.message || "Admin failed" });
    }
  });

  app.post("/admin/universities", requireAdminFromBodyOrAuth, async (req, res) => {
    try {
      const { name, general_email } = req.body || {};
      const n = typeof name === "string" ? name.trim() : "";
      if (!n || n.length > 255) return res.status(400).json({ error: "University name is required (max 255)" });
      const e = typeof general_email === "string" ? general_email.trim() : "";
      if (!e || !isValidEmail(e)) return res.status(400).json({ error: "Valid general_email is required" });
      await University.create({ name: n, general_email: e });
      res.json({ success: true });
    } catch (e) {
      res.status(e.statusCode || 500).json({ error: e.message || "Admin failed" });
    }
  });

  app.post("/admin/lecture-halls", requireAdminFromBodyOrAuth, async (req, res) => {
    try {
      const { university_id, hall_name, building_name, floor_number, center_lat, center_lng, radius_m } = req.body || {};
      const uniOid = oidRequired(university_id, res, "university_id");
      if (!uniOid) return;
      const hn = typeof hall_name === "string" ? hall_name.trim() : "";
      if (!hn || hn.length > 255) return res.status(400).json({ error: "hall_name is required (max 255)" });
      const bl = building_name != null ? String(building_name).trim() : null;
      const fn = floor_number == null ? null : parseInt(floor_number, 10);
      const lat = parseFloat(center_lat);
      const lng = parseFloat(center_lng);
      const r = parseInt(radius_m, 10);
      if (isNaN(lat) || lat < -90 || lat > 90) return res.status(400).json({ error: "center_lat invalid" });
      if (isNaN(lng) || lng < -180 || lng > 180) return res.status(400).json({ error: "center_lng invalid" });
      if (isNaN(r) || r < 1) return res.status(400).json({ error: "radius_m must be >= 1" });
      await LectureHall.create({
        university: uniOid,
        hall_name: hn,
        building_name: bl || null,
        floor_number: fn,
        center_lat: lat,
        center_lng: lng,
        radius_m: r,
      });
      res.json({ success: true });
    } catch (e) {
      res.status(e.statusCode || 500).json({ error: e.message || "Admin failed" });
    }
  });

  app.delete("/admin/lecture-halls/:id", requireAdminFromBodyOrAuth, async (req, res) => {
    try {
      const hid = oidRequired(req.params.id, res, "id");
      if (!hid) return;
      await LectureHall.deleteOne({ _id: hid });
      res.json({ success: true });
    } catch (e) {
      res.status(e.statusCode || 500).json({ error: e.message || "Admin failed" });
    }
  });

  app.post("/admin/timetable-pdfs", timetableUpload.single("file"), requireAdminFromBodyOrAuth, async (req, res) => {
    try {
      const { university_id, semester, year_number } = req.body || {};
      const uid = oidRequired(university_id, res, "university_id");
      if (!uid) return;
      const sem = typeof semester === "string" ? semester.trim() : "";
      if (!sem || sem.length > 50) return res.status(400).json({ error: "semester is required (max 50)" });
      const yn = year_number != null ? parseInt(year_number, 10) : null;
      if (yn != null && (isNaN(yn) || yn < 1 || yn > 10)) return res.status(400).json({ error: "academic year is invalid" });
      if (!req.file) return res.status(400).json({ error: "PDF file is required" });
      if (req.file.mimetype !== "application/pdf") return res.status(400).json({ error: "Only PDF is allowed" });
      const adminIdRaw = req.body?.admin_user_id || req.query?.admin_user_id || req.user?.id;
      await TimetablePdf.create({
        university: uid,
        semester: sem,
        year_number: yn,
        file_path: req.file.path,
        uploaded_by_admin: adminIdRaw ? new mongoose.Types.ObjectId(String(adminIdRaw)) : null,
      });
      res.json({ success: true });
    } catch (e) {
      res.status(e.statusCode || 500).json({ error: e.message || "Upload failed" });
    }
  });

  app.get("/admin/student-timetables", requireAdminByQuery, async (_req, res) => {
    try {
      const users = await User.find().select("name email").sort({ createdAt: -1 }).limit(200).lean();
      const out = [];
      for (const u of users) {
        const timetables = await TimetablePdf.find({ uploaded_by_user: u._id })
          .sort({ createdAt: -1 })
          .limit(10)
          .lean();
        const ttOut = [];
        for (const tp of timetables) {
          const un = tp.university ? await University.findById(tp.university).select("name").lean() : null;
          ttOut.push({
            id: tp._id.toString(),
            university_id: tp.university?.toString() || null,
            university_name: un?.name || null,
            semester: tp.semester,
            year_number: tp.year_number,
            file_path: tp.file_path,
            admin_review_status: tp.admin_review_status,
            admin_review_note: tp.admin_review_note,
            created_at: tp.createdAt,
          });
        }
        const slots = await ScheduleSlot.find({ user: u._id })
          .sort({ created_at: -1 })
          .limit(50)
          .lean();
        const slotOut = slots.map((s) => ({
          id: s._id.toString(),
          university_id: s.university?.toString(),
          semester: s.semester,
          year_number: s.year_number,
          day_of_week: s.day_of_week,
          start_time: s.start_time,
          end_time: s.end_time,
          module_name: s.module_name,
          delivery_mode: s.delivery_mode,
          location_text: s.location_text,
          hall_id: s.hall?.toString() || null,
          verification_status: s.verification_status,
          created_at: s.created_at,
        }));
        out.push({
          user: { id: u._id.toString(), name: u.name, email: u.email },
          timetables: ttOut,
          slots: slotOut,
        });
      }
      res.json(out);
    } catch (e) {
      res.status(e.statusCode || 500).json({ error: e.message || "Admin failed" });
    }
  });

  app.post("/admin/timetables/:id/review", requireAdminFromBodyOrAuth, async (req, res) => {
    try {
      const ttId = oidRequired(req.params.id, res);
      if (!ttId) return;
      const status =
        req.body?.status === "approved" ? "approved" : req.body?.status === "rejected" ? "rejected" : "pending";
      const note = req.body?.note ? String(req.body.note).slice(0, 500) : null;
      await TimetablePdf.updateOne({ _id: ttId }, { admin_review_status: status, admin_review_note: note });
      res.json({ success: true });
    } catch (e) {
      res.status(e.statusCode || 500).json({ error: e.message || "Admin failed" });
    }
  });

  app.get("/admin/timetable-pdfs", requireAdminByQuery, async (req, res) => {
    try {
      const uniId = req.query.university_id ? oidRequired(req.query.university_id, res) : null;
      if (req.query.university_id && !uniId) return;
      const q = uniId ? { university: uniId } : {};
      const rows = await TimetablePdf.find(q).sort({ createdAt: -1 }).lean();
      res.json(
        rows.map((tp) => ({
          id: tp._id.toString(),
          university_id: tp.university?.toString() || null,
          semester: tp.semester,
          year_number: tp.year_number,
          file_path: tp.file_path,
          created_at: tp.createdAt,
        }))
      );
    } catch (e) {
      res.status(e.statusCode || 500).json({ error: e.message || "Admin failed" });
    }
  });

  app.get("/admin/concerns", requireAdminByQuery, async (req, res) => {
    try {
      const status = req.query.status ? String(req.query.status).trim() : null;
      const q = status ? { status } : {};
      const rows = await Concern.find(q).sort({ created_at: -1 }).lean();
      const out = [];
      for (const c of rows) {
        const u = await User.findById(c.user).select("name").lean();
        const un = c.university ? await University.findById(c.university).select("name").lean() : null;
        out.push({
          id: c._id.toString(),
          user_id: c.user.toString(),
          student_name: u?.name || null,
          university_id: c.university?.toString() || null,
          university_name: un?.name || null,
          category: c.category,
          message: c.message,
          status: c.status,
          created_at: c.created_at,
          forwarded_at: c.forwarded_at,
        });
      }
      res.json(out);
    } catch (e) {
      res.status(e.statusCode || 500).json({ error: e.message || "Admin failed" });
    }
  });

  app.post("/admin/concerns/:id/forward", requireAdminFromBodyOrAuth, async (req, res) => {
    try {
      const concernId = oidRequired(req.params.id, res);
      if (!concernId) return;
      const concern = await Concern.findById(concernId).lean();
      if (!concern) return res.status(404).json({ error: "Concern not found" });
      if (concern.status === "forwarded") return res.json({ success: true, skipped: true });
      const uni = await University.findById(concern.university).select("general_email").lean();
      const to = uni?.general_email;
      if (!to) return res.status(400).json({ error: "University general_email not configured" });
      await Concern.updateOne({ _id: concernId }, { status: "forwarded", forwarded_at: new Date() });
      try {
        await sendMail({
          to,
          subject: `UniNavigator Concern: ${concern.category || "Concern"}`,
          text: `Student ID: ${concern.user.toString()}\n\nMessage:\n${concern.message}`,
        });
      } catch (_) {}
      res.json({ success: true });
    } catch (e) {
      res.status(e.statusCode || 500).json({ error: e.message || "Forward failed" });
    }
  });

  app.get("/admin/analytics/usage-summary", requireAdminByQuery, async (req, res) => {
    try {
      const days = Math.min(30, Math.max(1, parseInt(req.query.days || 7, 10)));
      const start = new Date();
      start.setUTCDate(start.getUTCDate() - days);
      const rows = await UsageEvent.aggregate([
        { $match: { created_at: { $gte: start } } },
        {
          $group: {
            _id: {
              day: { $dateToString: { format: "%Y-%m-%d", date: "$created_at", timezone: "UTC" } },
              event_type: "$event_type",
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { "_id.day": 1 } },
      ]);
      const flat = rows.map((r) => ({
        day: r._id.day,
        event_type: r._id.event_type,
        count: r.count,
      }));
      res.json({ days, rows: flat });
    } catch (e) {
      res.status(e.statusCode || 500).json({ error: e.message || "Admin failed" });
    }
  });

  app.get("/admin/analytics/usage-export-excel", requireAdminByQuery, async (req, res) => {
    try {
      const days = Math.min(30, Math.max(1, parseInt(req.query.days || 7, 10)));
      const start = new Date();
      start.setUTCDate(start.getUTCDate() - days);
      const rows = await UsageEvent.aggregate([
        { $match: { created_at: { $gte: start } } },
        {
          $group: {
            _id: {
              day: { $dateToString: { format: "%Y-%m-%d", date: "$created_at", timezone: "UTC" } },
              event_type: "$event_type",
              page: "$page",
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { "_id.day": 1 } },
      ]);
      const data = rows.map((r) => ({
        Day: r._id.day,
        EventType: r._id.event_type,
        Page: r._id.page || "",
        Count: r.count,
      }));
      const sheet = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, sheet, "usage");
      const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
      res.setHeader("Content-Disposition", `attachment; filename=uninavigator-usage-${days}d.xlsx`);
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.send(buffer);
    } catch (e) {
      res.status(e.statusCode || 500).json({ error: e.message || "Export failed" });
    }
  });
};
