const mongoose = require("mongoose");

const AttendanceSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    module_name: { type: String, required: true, trim: true, maxlength: 255 },
    attended: { type: Number, required: true, default: 0, min: 0 },
    total_sessions: { type: Number, required: true, default: 0, min: 0 },
    semester: { type: Number, default: null },
  },
  { timestamps: false }
);

module.exports = mongoose.model("Attendance", AttendanceSchema);
