const mongoose = require("mongoose");

const TimetablePdfSchema = new mongoose.Schema(
  {
    university: { type: mongoose.Schema.Types.ObjectId, ref: "University", required: true },
    semester: { type: String, required: true, maxlength: 50 },
    academic_year: { type: Number, default: null },
    semester_number: { type: Number, default: null },
    year_number: { type: Number, default: null },
    file_path: { type: String, required: true },
    uploaded_by_admin: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    uploaded_by_user: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    admin_review_status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
    admin_review_note: { type: String, default: null, maxlength: 500 },
  },
  { timestamps: true }
);

module.exports = mongoose.model("TimetablePdf", TimetablePdfSchema);
