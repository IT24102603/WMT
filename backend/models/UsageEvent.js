const mongoose = require("mongoose");

const UsageEventSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    event_type: { type: String, required: true, maxlength: 50 },
    page: { type: String, default: null, maxlength: 100 },
    meta: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { timestamps: { createdAt: "created_at", updatedAt: false } }
);

module.exports = mongoose.model("UsageEvent", UsageEventSchema);
