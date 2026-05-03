const mongoose = require("mongoose");

function oidOrNull(str) {
  if (str === undefined || str === null || str === "") return null;
  if (!mongoose.isValidObjectId(String(str))) return null;
  return new mongoose.Types.ObjectId(String(str));
}

function oidRequired(str, res, label = "id") {
  if (!mongoose.isValidObjectId(String(str))) {
    res.status(400).json({ error: `Invalid ${label}` });
    return null;
  }
  return new mongoose.Types.ObjectId(String(str));
}

function userPublic(u) {
  if (!u) return null;
  return {
    id: u._id.toString(),
    name: u.name,
    email: u.email,
    index_number: u.index_number ?? null,
    profile_pic: u.profile_pic ?? null,
    role: u.role || "student",
    target_gpa: u.target_gpa != null ? Number(u.target_gpa) : null,
    target_attendance: u.target_attendance != null ? Number(u.target_attendance) : 80,
    notify_deadlines: u.notify_deadlines != null ? !!u.notify_deadlines : true,
    deadline_reminder_days: u.deadline_reminder_days != null ? parseInt(u.deadline_reminder_days, 10) : 3,
  };
}

function uniKeyMongo(u) {
  return u != null ? u.toString() : "__null__";
}

async function findDuplicateModule(userOid, codeUpper, semester, uniOidMaybe) {
  const Module = require("../models/Module");
  const list = await Module.find({ user: userOid, code: codeUpper, semester }).lean();
  const wantKey = uniKeyMongo(uniOidMaybe);
  return list.find((m) => uniKeyMongo(m.university) === wantKey);
}

module.exports = { oidOrNull, oidRequired, userPublic, findDuplicateModule, uniKeyMongo };
