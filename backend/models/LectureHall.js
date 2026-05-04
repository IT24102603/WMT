const mongoose = require("mongoose");

const LectureHallSchema = new mongoose.Schema(
  {
    university: { type: mongoose.Schema.Types.ObjectId, ref: "University", required: true },
    hall_name: { type: String, required: true, trim: true, maxlength: 255 },
    building_name: { type: String, default: null, maxlength: 255 },
    floor_number: { type: Number, default: null },
    center_lat: { type: Number, required: true },
    center_lng: { type: Number, required: true },
    radius_m: { type: Number, required: true, min: 1 },
  },
  { timestamps: true }
);

module.exports = mongoose.model("LectureHall", LectureHallSchema);
