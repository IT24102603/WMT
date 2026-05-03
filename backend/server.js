require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const { connectDb } = require("./config/db");
const { authenticate } = require("./middleware/auth");

const UPLOAD_DIR = path.join(__dirname, "uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const timetableUpload = multer({
  dest: UPLOAD_DIR,
  limits: { fileSize: 10 * 1024 * 1024 },
});

const PORT = parseInt(process.env.PORT || "5000", 10);

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 16) {
  console.warn("[warn] Set JWT_SECRET (min 16 chars) in environment for production.");
}

async function bootstrap() {
  await connectDb();

  const app = express();
  const allowed = process.env.CORS_ORIGIN;
  app.use(
    cors({
      origin: allowed === "*" || !allowed ? true : allowed.split(",").map((s) => s.trim()),
      credentials: false,
    })
  );
  app.use(express.json({ limit: "10mb" }));

  app.use("/uploads", express.static(UPLOAD_DIR));

  app.use(authenticate);

  require("./routes/authAndUsers")(app);
  require("./routes/modulesAndGpa")(app);
  require("./routes/attendanceAndTasks")(app, { timetableUpload });
  require("./routes/universitiesConcernsAnalyticsAdmin")(app, { timetableUpload });

  app.get("/health", (_req, res) => res.json({ ok: true, db: "mongo" }));

  app.use((_req, res) => res.status(404).json({ error: "Not found" }));

  app.listen(PORT, () => {
    console.log(`UniNavigator API listening on port ${PORT}`);
  });
}

bootstrap().catch((err) => {
  console.error("Server failed to start:", err);
  process.exit(1);
});
