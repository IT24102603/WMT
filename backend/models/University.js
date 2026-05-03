const mongoose = require("mongoose");

const UniversitySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 255 },
    general_email: { type: String, required: true, trim: true, lowercase: true, maxlength: 255 },
  },
  { timestamps: true }
);

module.exports = mongoose.model("University", UniversitySchema);
