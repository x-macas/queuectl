const Job = require("../models/Job");
const appConfig = require("../config/appConfig");
const logger = require("../utils/logger");
const { getNextRetryTime } = require("../utils/time");
const dlqManager = require("./dlq");

class RetryManager {
  /** Handle job failure: retry or move to DLQ */
  async handleFailure(jobId, error) {
    try {
      const job = await Job.findOne({ id: jobId });
      if (!job) {
        logger.error(`Job ${jobId} not found for retry`);
        return null;
      }

      const attempts = job.attempts + 1;
      const canRetry = attempts < job.max_retries;
      logger.info(
        `Job ${jobId} failed (attempt ${attempts}/${job.max_retries})`
      );

      return canRetry
        ? this.scheduleRetry(job, attempts, error)
        : dlqManager.moveToDeadLetter(job, error, attempts);
    } catch (err) {
      logger.error(`Error handling failure for ${jobId}: ${err.message}`);
      return null;
    }
  }

  /** Schedule job retry with exponential backoff */
  async scheduleRetry(job, attempts, error) {
    try {
      const base = await appConfig.get("backoff-base", 2);
      const nextRetryAt = getNextRetryTime(attempts, base);

      const updated = await Job.findOneAndUpdate(
        { id: job.id },
        {
          state: "failed",
          attempts,
          next_retry_at: nextRetryAt,
          error: error || "Unknown error",
          locked_at: null,
          locked_by: null,
          updated_at: new Date(),
        },
        { new: true }
      );

      logger.info(`Job ${job.id} will retry at ${nextRetryAt.toISOString()}`);
      return updated;
    } catch (err) {
      logger.error(`Error scheduling retry for ${job.id}: ${err.message}`);
      return null;
    }
  }

  /** Fetch jobs eligible for retry */
  async getRetryableJobs(limit = 10) {
    try {
      const now = new Date();
      const fiveMinAgo = new Date(now - 300000);

      return await Job.find({
        state: "failed",
        next_retry_at: { $lte: now },
        $or: [{ locked_at: null }, { locked_at: { $lt: fiveMinAgo } }],
      })
        .sort({ next_retry_at: 1 })
        .limit(limit);
    } catch (err) {
      logger.error(`Error fetching retryable jobs: ${err.message}`);
      return [];
    }
  }

  /** Reset job to pending for manual retry (DLQ → queue) */
  async resetForRetry(jobId) {
    try {
      const job = await Job.findOneAndUpdate(
        { id: jobId },
        {
          state: "pending",
          attempts: 0,
          next_retry_at: null,
          error: "",
          locked_at: null,
          locked_by: null,
          updated_at: new Date(),
        },
        { new: true }
      );

      if (job) logger.info(`Job ${jobId} reset for retry`);
      return job;
    } catch (err) {
      logger.error(`Error resetting job ${jobId}: ${err.message}`);
      return null;
    }
  }
}

module.exports = new RetryManager();
