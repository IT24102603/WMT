const mongoose = require("mongoose");

const TaskSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    module_code: { type: String, default: null, uppercase: true, maxlength: 50 },
    title: { type: String, required: true, maxlength: 500 },
    due_date: { type: Date, default: null },
    priority_score: { type: Number, default: 5, min: 1, max: 10 },
    completed: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: "created_at", updatedAt: false } }
);

module.exports = mongoose.model("Task", TaskSchema);
