const jwt = require("jsonwebtoken");
const User = require("../models/User");

function jwtSecret() {
  return (
    process.env.JWT_SECRET ||
    "uninavigator-dev-only-min-16-characters-long-change-in-production"
  );
}

function signToken(user) {
  return jwt.sign(
    { sub: user._id.toString(), role: user.role || "student" },
    jwtSecret(),
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
  );
}

async function authenticate(req, _res, next) {
  const h = req.headers.authorization;
  req.user = null;
  if (!h || typeof h !== "string" || !h.startsWith("Bearer ")) {
    return next();
  }
  const token = h.slice(7).trim();
  if (!token) return next();
  try {
    const payload = jwt.verify(token, jwtSecret());
    const doc = await User.findById(payload.sub).lean();
    if (!doc) return next();
    req.user = {
      id: doc._id.toString(),
      role: doc.role || "student",
      _doc: doc,
    };
  } catch (_) {
    req.user = null;
  }
  next();
}

function requireAuth(req, res, next) {
  if (!req.user?.id) return res.status(401).json({ error: "Unauthorized" });
  next();
}

function requireSelfOrAdmin(paramName = "id") {
  return (req, res, next) => {
    if (!req.user?.id) return res.status(401).json({ error: "Unauthorized" });
    const target = req.params[paramName];
    if (req.user.role === "admin" || req.user.id === target) return next();
    return res.status(403).json({ error: "Forbidden" });
  };
}

async function requireAdminFromBodyOrAuth(req, res, next) {
  try {
    if (req.user?.role === "admin") return next();
    const raw = req.body?.admin_user_id || req.query?.admin_user_id;
    if (!raw) return res.status(400).json({ error: "admin_user_id is required" });
    await requireAdminByUserId(raw);
    return next();
  } catch (e) {
    return res.status(e.statusCode || 500).json({ error: e.message });
  }
}

async function requireAdminByQuery(req, res, next) {
  try {
    if (req.user?.role === "admin") return next();
    const raw = req.query.admin_user_id;
    if (!raw) {
      return res.status(400).json({ error: "admin_user_id is required" });
    }
    await requireAdminByUserId(raw);
    return next();
  } catch (e) {
    const code = e.statusCode || 500;
    return res.status(code).json({ error: e.message });
  }
}

async function requireAdminByUserId(raw) {
  const u = await User.findById(String(raw)).lean();
  if (!u || u.role !== "admin") {
    const err = new Error("Forbidden: admin only");
    err.statusCode = 403;
    throw err;
  }
}

module.exports = {
  signToken,
  authenticate,
  requireAuth,
  requireSelfOrAdmin,
  requireAdminFromBodyOrAuth,
  requireAdminByQuery,
};
