const mongoose = require("mongoose");

const ModuleSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    university: { type: mongoose.Schema.Types.ObjectId, ref: "University", default: null },
    academic_year: { type: Number, default: null },
    semester_in_year: { type: Number, default: null },
    source_type: { type: String, default: "normal", maxlength: 30 },
    name: { type: String, required: true, trim: true, maxlength: 255 },
    code: { type: String, required: true, trim: true, uppercase: true, maxlength: 50 },
    credits: { type: Number, required: true, default: 3, min: 1, max: 30 },
    grade_letter: { type: String, default: null, maxlength: 5 },
    grade_point: { type: Number, default: null, min: 0, max: 4 },
    ca_percentage: { type: Number, default: null, min: 0, max: 100 },
    semester: { type: Number, default: 1, min: 1, max: 20 },
    is_repeat: { type: Boolean, default: false },
  },
  { timestamps: true }
);

ModuleSchema.index({ user: 1, code: 1, semester: 1, university: 1 });

module.exports = mongoose.model("Module", ModuleSchema);
