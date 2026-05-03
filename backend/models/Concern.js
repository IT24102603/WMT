const mongoose = require("mongoose");

const ConcernSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    university: { type: mongoose.Schema.Types.ObjectId, ref: "University", required: true },
    category: { type: String, default: null, maxlength: 50 },
    message: { type: String, required: true, maxlength: 2000 },
    status: { type: String, enum: ["open", "forwarded", "closed"], default: "open" },
    forwarded_at: { type: Date, default: null },
  },
  { timestamps: { createdAt: "created_at", updatedAt: false } }
);

module.exports = mongoose.model("Concern", ConcernSchema);
