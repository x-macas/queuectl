const mongoose = require("mongoose");

const jobSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  command: {
    type: String,
    required: true,
  },
  state: {
    type: String,
    enum: ["pending", "processing", "completed", "failed", "dead"],
    default: "pending",
    index: true,
  },
  attempts: {
    type: Number,
    default: 0,
  },
  max_retries: {
    type: Number,
    default: 3,
  },
  priority: {
    type: Number,
    default: 0,
  },
  next_retry_at: {
    type: Date,
    default: null,
    index: true,
  },
  output: {
    type: String,
    default: "",
  },
  error: {
    type: String,
    default: "",
  },
  worker_id: {
    type: String,
    default: null,
  },
  locked_at: {
    type: Date,
    default: null,
  },
  locked_by: {
    type: String,
    default: null,
  },
  created_at: {
    type: Date,
    default: Date.now,
  },
  updated_at: {
    type: Date,
    default: Date.now,
  },
  completed_at: {
    type: Date,
    default: null,
  },
});

// Index for efficient worker queries
jobSchema.index({ state: 1, next_retry_at: 1, locked_at: 1 });

// Update timestamp on save
jobSchema.pre("save", function (next) {
  this.updated_at = new Date();
  next();
});

module.exports = mongoose.model("Job", jobSchema);
