const mongoose = require("mongoose");
const PDFDocument = require("pdfkit");
const ModuleModel = require("../models/Module");
const User = require("../models/User");
const { VALID_GRADES, GRADE_TO_POINT } = require("../lib/constants");
const { requireAuth } = require("../middleware/auth");
const { oidRequired, findDuplicateModule } = require("./helpers");

module.exports = function register(app) {
  app.get("/users/:id/modules", requireAuth, async (req, res) => {
    if (req.params.id !== req.user.id && req.user.role !== "admin") return res.status(403).json({ error: "Forbidden" });
    try {
      const uid = oidRequired(req.params.id, res, "user id");
      if (!uid) return;
      const rows = await ModuleModel.find({ user: uid }).lean().sort({ semester: 1, code: 1 });
      const out = rows.map((m) => ({
        id: m._id.toString(),
        user_id: uid.toString(),
        university_id: m.university ? m.university.toString() : null,
        academic_year: m.academic_year,
        semester_in_year: m.semester_in_year,
        source_type: m.source_type,
        name: m.name,
        code: m.code,
        credits: m.credits,
        grade_letter: m.grade_letter,
        grade_point: m.grade_point,
        ca_percentage: m.ca_percentage,
        semester: m.semester,
        is_repeat: m.is_repeat,
      }));
      res.json(out);
    } catch (err) {
      res.json([]);
    }
  });

  app.post("/modules", requireAuth, async (req, res) => {
    try {
      const body = req.body || {};
      if (req.user.id !== String(body.user_id) && req.user.role !== "admin") {
        return res.status(403).json({ error: "Forbidden" });
      }

      const {
        user_id,
        university_id,
        academic_year,
        semester_in_year,
        source_type,
        name,
        code,
        credits,
        grade_letter,
        grade_point,
        ca_percentage,
        semester,
        is_repeat,
      } = body;
      const uidOid = oidRequired(user_id, res, "user id");
      if (!uidOid) return;
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

      let uniOid = null;
      if (university_id != null && university_id !== "") {
        if (!mongoose.isValidObjectId(String(university_id))) return res.status(400).json({ error: "university_id is invalid" });
        uniOid = new mongoose.Types.ObjectId(String(university_id));
      }

      const ayVal = academic_year != null && academic_year !== "" ? parseInt(academic_year, 10) : null;
      if (ayVal != null && (isNaN(ayVal) || ayVal < 1 || ayVal > 10)) return res.status(400).json({ error: "Academic year must be between 1 and 10" });

      const siyVal = semester_in_year != null && semester_in_year !== "" ? parseInt(semester_in_year, 10) : null;
      if (siyVal != null && (isNaN(siyVal) || siyVal < 1 || siyVal > 3)) return res.status(400).json({ error: "Semester must be between 1 and 3" });

      const dup = await findDuplicateModule(uidOid, c, sem, uniOid);
      const srcType = typeof source_type === "string" && source_type.trim() ? source_type.trim().slice(0, 30) : "normal";

      let gpVal = grade_point != null ? parseFloat(grade_point) : null;
      if ((gpVal == null || isNaN(gpVal)) && grade_letter && GRADE_TO_POINT[grade_letter] != null) {
        gpVal = GRADE_TO_POINT[grade_letter];
      }
      if (gpVal != null && (isNaN(gpVal) || gpVal < 0 || gpVal > 4)) gpVal = null;

      if (dup) {
        await ModuleModel.updateOne(
          { _id: dup._id },
          {
            $set: {
              university: uniOid,
              academic_year: ayVal,
              semester_in_year: siyVal,
              source_type: srcType,
              name: n,
              code: c,
              credits: cred,
              grade_letter: grade_letter || null,
              grade_point: gpVal,
              ca_percentage: ca,
              semester: sem,
              is_repeat: !!is_repeat,
            },
          }
        );
        return res.json({ id: dup._id.toString(), updated: true });
      }

      const created = await ModuleModel.create({
        user: uidOid,
        university: uniOid,
        academic_year: ayVal,
        semester_in_year: siyVal,
        source_type: srcType,
        name: n,
        code: c,
        credits: cred,
        grade_letter: grade_letter || null,
        grade_point: gpVal,
        ca_percentage: ca,
        semester: sem,
        is_repeat: !!is_repeat,
      });
      res.json({ id: created._id.toString() });
    } catch (err) {
      console.error(err);
      res.json({ error: "Insert failed" });
    }
  });

  app.put("/modules/:id", requireAuth, async (req, res) => {
    try {
      if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: "Invalid module ID" });
      const moduleId = new mongoose.Types.ObjectId(req.params.id);
      const existing = await ModuleModel.findById(moduleId).lean();
      if (!existing) return res.status(404).json({ error: "Module not found" });
      if (existing.user.toString() !== req.user.id && req.user.role !== "admin") return res.status(403).json({ error: "Forbidden" });

      const { grade_letter, grade_point, ca_percentage, is_repeat, semester } = req.body || {};
      const updates = {};

      if (grade_letter !== undefined) {
        if (grade_letter && !VALID_GRADES.includes(grade_letter)) return res.status(400).json({ error: "Invalid grade" });
        updates.grade_letter = grade_letter || null;
      }
      if (grade_point !== undefined) {
        const gp = grade_point != null ? parseFloat(grade_point) : null;
        if (gp != null && (isNaN(gp) || gp < 0 || gp > 4)) return res.status(400).json({ error: "Grade point must be between 0 and 4" });
        updates.grade_point = gp;
      }
      if (ca_percentage !== undefined) {
        const caVal = ca_percentage != null ? parseInt(ca_percentage, 10) : null;
        if (caVal != null && (isNaN(caVal) || caVal < 0 || caVal > 100)) {
          return res.status(400).json({ error: "CA percentage must be between 0 and 100" });
        }
        updates.ca_percentage = caVal;
      }
      if (is_repeat !== undefined) updates.is_repeat = !!is_repeat;
      if (semester !== undefined) {
        const sem = semester != null ? parseInt(semester, 10) : 1;
        if (sem < 1 || sem > 20) return res.status(400).json({ error: "Semester must be between 1 and 20" });
        updates.semester = sem;
      }
      if (Object.keys(updates).length === 0) return res.json({ success: true });
      await ModuleModel.updateOne({ _id: moduleId }, { $set: updates });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/modules/:id", requireAuth, async (req, res) => {
    try {
      if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: "Invalid id" });
      const moduleId = new mongoose.Types.ObjectId(req.params.id);
      const existing = await ModuleModel.findById(moduleId).lean();
      if (!existing) return res.status(404).json({ error: "Not found" });
      if (existing.user.toString() !== req.user.id && req.user.role !== "admin") return res.status(403).json({ error: "Forbidden" });

      await ModuleModel.deleteOne({ _id: moduleId });
      res.json({ success: true });
    } catch (_) {
      res.json({ error: "Delete failed" });
    }
  });

  app.get("/users/:id/gpa", requireAuth, async (req, res) => {
    if (req.params.id !== req.user.id && req.user.role !== "admin") return res.status(403).json({ error: "Forbidden" });
    try {
      const uid = oidRequired(req.params.id, res, "user id");
      if (!uid) return;
      const rows = await ModuleModel.find({ user: uid }).sort({ semester: 1, name: 1 }).lean();

      const semesters = {};
      let overallCredits = 0;
      let overallPoints = 0;

      rows.forEach((m) => {
        const sem = m.semester || 1;
        if (!semesters[sem]) semesters[sem] = { modules: [], credits: 0, points: 0 };
        semesters[sem].modules.push({
          ...m,
          id: m._id.toString(),
          user_id: uid.toString(),
          university_id: m.university?.toString() || null,
        });
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
        return { semester: parseInt(sem, 10), gpa: parseFloat(gpa), credits: data.credits, modules: data.modules };
      }).sort((a, b) => a.semester - b.semester);

      const overallGpa = overallCredits ? (overallPoints / overallCredits).toFixed(2) : 0;

      const flatModules = rows.map((m) => ({
        ...m,
        id: m._id.toString(),
        _id: undefined,
        user: undefined,
        user_id: uid.toString(),
        university_id: m.university?.toString() || null,
      }));

      res.json({
        overall: { gpa: parseFloat(overallGpa), credits: overallCredits },
        semesters: semesterGpas,
        modules: flatModules,
      });
    } catch (err) {
      console.error(err);
      res.json({ overall: { gpa: 0, credits: 0 }, semesters: [], modules: [] });
    }
  });

  app.get("/users/:id/report.pdf", requireAuth, async (req, res) => {
    if (req.params.id !== req.user.id && req.user.role !== "admin") return res.status(403).json({ error: "Forbidden" });
    const user_id = req.params.id;
    if (!mongoose.isValidObjectId(user_id)) return res.status(400).end();
    const doc = new PDFDocument();
    res.setHeader("Content-Disposition", "attachment; filename=uninavigator-report.pdf");
    doc.pipe(res);
    doc.fontSize(18).text("UniNavigator", { align: "center" });
    doc.moveDown(0.3);
    doc.fontSize(14).text("Student Performance Profile", { align: "center" });

    try {
      const [usersArr, modules] = await Promise.all([
        User.findById(user_id).lean(),
        ModuleModel.find({ user: user_id }).lean(),
      ]);
      if (usersArr) {
        doc.moveDown();
        doc.fontSize(12).text(`Registration No: ${usersArr.index_number || "N/A"}`);
        doc.moveDown(0.2);
        doc.text(`Full Name: ${usersArr.name}`);
      }
      const graded = modules.filter((m) => m.grade_point != null);
      const cumulativeCredits = graded.reduce((a, m) => a + (parseInt(m.credits, 10) || 0), 0);
      const cumulativePoints = graded.reduce(
        (a, m) => a + ((parseFloat(m.grade_point) || 0) * (parseInt(m.credits, 10) || 0)),
        0
      );
      const cumulativeGpa = cumulativeCredits ? cumulativePoints / cumulativeCredits : 0;
      doc.moveDown();
      doc.text(`Cumulative Credits: ${cumulativeCredits} | Cumulative GPA: ${cumulativeGpa.toFixed(2)}`);

      const grouped = {};
      for (const m of modules) {
        const y = m.academic_year || Math.ceil((m.semester || 1) / 2);
        const s = m.semester_in_year || (m.semester || 1) % 2 || 2;
        const key = `${y}-${s}`;
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(m);
      }

      Object.keys(grouped)
        .sort((a, b) => {
          const [ya, sa] = a.split("-").map(Number);
          const [yb, sb] = b.split("-").map(Number);
          return ya === yb ? sa - sb : ya - yb;
        })
        .forEach((k) => {
          const rows = grouped[k];
          const semCredits = rows.filter((r) => r.grade_point != null).reduce((a, r) => a + (parseInt(r.credits, 10) || 0), 0);
          const semPoints = rows.filter((r) => r.grade_point != null).reduce(
            (a, r) => a + ((parseFloat(r.grade_point) || 0) * (parseInt(r.credits, 10) || 0)),
            0
          );
          const semGpa = semCredits ? semPoints / semCredits : 0;
          doc.moveDown();
          doc.fontSize(12).text(`${k}: GPA ${semGpa.toFixed(2)}`);
          rows.forEach((m) => {
            doc.fontSize(10).text(
              `${m.code || "-"} | ${m.name} | Credits: ${m.credits} | Grade: ${m.grade_letter || "-"}`
            );
          });
        });
    } catch (err) {
      doc.text(String(err.message || "Error loading data."));
    }
    doc.end();
  });
};
