const mongoose = require("mongoose");

const AttendanceLogSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    module_name: { type: String, required: true, maxlength: 255 },
    semester: { type: Number, default: null },
    attended: { type: Number, default: 0, min: 0 },
    total_sessions: { type: Number, default: 0, min: 0 },
    lecture_date: { type: Date, default: null },
    delivery_mode: { type: String, enum: ["offline", "online"], default: "offline" },
    university: { type: mongoose.Schema.Types.ObjectId, ref: "University", default: null },
    hall: { type: mongoose.Schema.Types.ObjectId, ref: "LectureHall", default: null },
    proof_path: { type: String, default: null },
    verification_status: {
      type: String,
      enum: ["pending", "timetable_missing", "approved", "rejected", "auto_verified"],
      default: "pending",
    },
  },
  { timestamps: { createdAt: "created_at", updatedAt: false } }
);

module.exports = mongoose.model("AttendanceLog", AttendanceLogSchema);
