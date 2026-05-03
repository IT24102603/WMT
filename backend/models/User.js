const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 255 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 255 },
    password: { type: String, required: true },
    role: { type: String, enum: ["student", "admin"], default: "student" },
    index_number: { type: String, default: "", maxlength: 100 },
    profile_pic: { type: String, default: null },
    target_gpa: { type: Number, default: null, min: 0, max: 4 },
    target_attendance: { type: Number, default: 80, min: 0, max: 100 },
    notify_deadlines: { type: Boolean, default: true },
    deadline_reminder_days: { type: Number, default: 3, min: 1, max: 30 },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", UserSchema);
