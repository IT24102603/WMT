const bcrypt = require("bcryptjs");
const User = require("../models/User");
const Attendance = require("../models/Attendance");
const Module = require("../models/Module");
const Task = require("../models/Task");
const { isValidEmail } = require("../lib/constants");
const { signToken, requireAuth } = require("../middleware/auth");
const { oidRequired, userPublic } = require("./helpers");

module.exports = function register(app) {
  app.post("/register", async (req, res) => {
    try {
      const { name, email, password } = req.body;
      const n = typeof name === "string" ? name.trim() : "";
      const e = typeof email === "string" ? email.trim() : "";
      const p = typeof password === "string" ? password : "";
      if (!n || n.length < 1 || n.length > 255) return res.status(400).json({ error: "Name is required (1–255 characters)" });
      if (!isValidEmail(e)) return res.status(400).json({ error: "Enter a valid email address" });
      if (!p || p.length < 6) return res.status(400).json({ error: "Password must be at least 6 characters" });

      const hashed = await bcrypt.hash(p, 10);
      const u = await User.create({ name: n, email: e, password: hashed });
      const token = signToken(u);
      const pub = userPublic(u.toObject());
      res.status(201).json({ ...pub, token });
    } catch (err) {
      if (err?.code === 11000) return res.status(400).json({ error: "Email already exists" });
      console.error(err);
      res.status(500).json({ error: "Registration failed" });
    }
  });

  app.post("/login", async (req, res) => {
    try {
      const email = typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : "";
      const password = typeof req.body.password === "string" ? req.body.password : "";
      if (!email || !password) return res.status(400).json({ error: "Email and password are required" });

      const user = await User.findOne({ email });
      if (!user) return res.json({ error: "Invalid credentials" });

      let isMatch = false;
      try {
        isMatch = await bcrypt.compare(password, user.password);
      } catch (_) {
        isMatch = false;
      }
      if (!isMatch && typeof user.password === "string" && user.password === password) {
        isMatch = true;
        try {
          user.password = await bcrypt.hash(password, 10);
          await user.save();
        } catch (_) {}
      }

      if (!isMatch) return res.json({ error: "Invalid credentials" });

      const token = signToken(user);
      const pub = userPublic(user.toObject());
      res.json({ ...pub, token });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  });

  app.get("/me", async (req, res) => {
    if (!req.user?.id) return res.json({ user: null });
    try {
      const u = await User.findById(req.user.id).lean();
      if (!u) return res.json({ user: null });
      res.json({ user: userPublic(u) });
    } catch (_) {
      res.status(500).json({ error: "Failed to load session" });
    }
  });

  app.post("/logout", (_req, res) => {
    res.json({ success: true });
  });

  app.get("/users/:id/profile", requireAuth, async (req, res) => {
    if (req.params.id !== req.user.id && req.user.role !== "admin") return res.status(403).json({ error: "Forbidden" });
    try {
      const oid = oidRequired(req.params.id, res, "user id");
      if (!oid) return;
      const u = await User.findById(oid).lean();
      if (!u) return res.status(404).json({ error: "Not found" });
      const { password: _pw, ...rest } = u;
      res.json({
        id: u._id.toString(),
        name: u.name,
        email: u.email,
        index_number: u.index_number ?? null,
        profile_pic: u.profile_pic ?? null,
        target_gpa: u.target_gpa != null ? Number(u.target_gpa) : null,
        target_attendance: u.target_attendance || 80,
        notify_deadlines: u.notify_deadlines != null ? !!u.notify_deadlines : true,
        deadline_reminder_days:
          u.deadline_reminder_days != null ? parseInt(u.deadline_reminder_days, 10) : 3,
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put("/users/:id/profile", requireAuth, async (req, res) => {
    if (req.params.id !== req.user.id && req.user.role !== "admin") return res.status(403).json({ error: "Forbidden" });
    try {
      const oid = oidRequired(req.params.id, res, "user id");
      if (!oid) return;
      const { name, index_number, target_gpa, target_attendance, profile_pic, notify_deadlines, deadline_reminder_days } =
        req.body || {};
      const updates = {};

      if (name !== undefined) {
        const n = typeof name === "string" ? name.trim() : "";
        if (n.length > 255) return res.status(400).json({ error: "Name must be 255 characters or less" });
        updates.name = n;
      }
      if (index_number !== undefined) {
        updates.index_number = typeof index_number === "string" ? index_number.trim().slice(0, 100) : "";
      }
      if (target_gpa !== undefined) {
        const tg = parseFloat(target_gpa);
        if (isNaN(tg) || tg < 0 || tg > 4) return res.status(400).json({ error: "Target GPA must be between 0 and 4" });
        updates.target_gpa = tg;
      }
      if (target_attendance !== undefined) {
        const ta = parseInt(target_attendance, 10);
        if (isNaN(ta) || ta < 0 || ta > 100) return res.status(400).json({ error: "Target attendance must be between 0 and 100" });
        updates.target_attendance = ta;
      }
      if (profile_pic !== undefined) updates.profile_pic = profile_pic;
      if (notify_deadlines !== undefined) updates.notify_deadlines = !!notify_deadlines;
      if (deadline_reminder_days !== undefined)
        updates.deadline_reminder_days = Math.min(30, Math.max(1, parseInt(deadline_reminder_days, 10) || 3));

      if (Object.keys(updates).length === 0) return res.json({ success: true });
      await User.updateOne({ _id: oid }, { $set: updates });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/users/:id", requireAuth, async (req, res) => {
    if (req.params.id !== req.user.id && req.user.role !== "admin") return res.status(403).json({ error: "Forbidden" });
    try {
      const uid = oidRequired(req.params.id, res, "user id");
      if (!uid) return;
      await Attendance.deleteMany({ user: uid });
      await Task.deleteMany({ user: uid });
      await Module.deleteMany({ user: uid });
      const AttendanceLog = require("../models/AttendanceLog");
      const Concern = require("../models/Concern");
      const UsageEvent = require("../models/UsageEvent");
      const ScheduleSlot = require("../models/ScheduleSlot");
      const TimetablePdf = require("../models/TimetablePdf");
      await Promise.all([
        AttendanceLog.deleteMany({ user: uid }),
        Concern.deleteMany({ user: uid }),
        UsageEvent.deleteMany({ user: uid }),
        ScheduleSlot.deleteMany({ user: uid }),
        TimetablePdf.deleteMany({ uploaded_by_user: uid }),
      ]);
      await User.deleteOne({ _id: uid });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
};
