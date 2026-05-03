const mongoose = require("mongoose");

const ScheduleSlotSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    university: { type: mongoose.Schema.Types.ObjectId, ref: "University", required: true },
    semester: { type: Number, default: null },
    academic_year: { type: Number, default: null },
    year_number: { type: Number, default: null },
    day_of_week: { type: String, required: true, maxlength: 15 },
    start_time: { type: String, required: true, maxlength: 10 },
    end_time: { type: String, required: true, maxlength: 10 },
    module_name: { type: String, required: true, maxlength: 255 },
    delivery_mode: { type: String, enum: ["physical", "online"], default: "physical" },
    location_text: { type: String, default: null, maxlength: 255 },
    hall: { type: mongoose.Schema.Types.ObjectId, ref: "LectureHall", default: null },
    verification_status: { type: String, enum: ["auto_verified", "timetable_missing"], default: "timetable_missing" },
  },
  { timestamps: { createdAt: "created_at", updatedAt: false } }
);

ScheduleSlotSchema.index({ user: 1, university: 1, semester: 1, year_number: 1, day_of_week: 1 });

module.exports = mongoose.model("ScheduleSlot", ScheduleSlotSchema);
