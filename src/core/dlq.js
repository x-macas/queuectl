const Job = require("../models/Job");
const logger = require("../utils/logger");

class DLQManager {
  /** Move a job permanently to Dead Letter Queue */
  async moveToDeadLetter(job, error, attempts = null) {
    try {
      const finalAttempts = attempts ?? job.attempts;

      const updated = await Job.findOneAndUpdate(
        { id: job.id },
        {
          state: "dead",
          attempts: finalAttempts,
          error: error || "Max retries exceeded",
          locked_at: null,
          locked_by: null,
          updated_at: new Date(),
        },
        { new: true }
      );

      logger.warn(`Job ${job.id} moved to DLQ after ${finalAttempts} attempts`);
      return updated;
    } catch (err) {
      logger.error(`Error moving job ${job.id} to DLQ: ${err.message}`);
      return null;
    }
  }

  /** List DLQ jobs */
  async listDeadLetterJobs(limit = 100) {
    try {
      return await Job.find({ state: "dead" })
        .sort({ updated_at: -1 })
        .limit(limit);
    } catch (err) {
      logger.error(`Error listing DLQ jobs: ${err.message}`);
      return [];
    }
  }

  /** Move a DLQ job back to the queue for retry */
  async retryFromDLQ(jobId) {
    try {
      const job = await Job.findOne({ id: jobId, state: "dead" });
      if (!job) {
        logger.error(`Job ${jobId} not found in DLQ`);
        return null;
      }

      const updated = await Job.findOneAndUpdate(
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

      logger.info(`Job ${jobId} restored from DLQ to queue`);
      return updated;
    } catch (err) {
      logger.error(`Error retrying job ${jobId} from DLQ: ${err.message}`);
      return null;
    }
  }

  /** Delete a job from DLQ */
  async deleteFromDLQ(jobId) {
    try {
      const result = await Job.deleteOne({ id: jobId, state: "dead" });
      if (result.deletedCount) {
        logger.info(`Job ${jobId} deleted from DLQ`);
        return true;
      }
      logger.warn(`Job ${jobId} not found in DLQ`);
      return false;
    } catch (err) {
      logger.error(`Error deleting job ${jobId} from DLQ: ${err.message}`);
      return false;
    }
  }

  /** Get DLQ job count */
  async getDLQStats() {
    try {
      const count = await Job.countDocuments({ state: "dead" });
      return { count };
    } catch (err) {
      logger.error(`Error fetching DLQ stats: ${err.message}`);
      return { count: 0 };
    }
  }

  /** Clear the entire DLQ */
  async clearDLQ() {
    try {
      const result = await Job.deleteMany({ state: "dead" });
      const cleared = result.deletedCount || 0;
      logger.info(`Cleared ${cleared} job(s) from DLQ`);
      return cleared;
    } catch (err) {
      logger.error(`Error clearing DLQ: ${err.message}`);
      return 0;
    }
  }
}

module.exports = new DLQManager();
