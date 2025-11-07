const Job = require("../models/Job");
const appConfig = require("../config/appConfig");
const logger = require("../utils/logger");
const { randomUUID } = require("crypto");

class JobManager {
  /** Create and store a new job */
  async createJob(jobData) {
    try {
      const maxRetries = await appConfig.get("max-retries", 3);
      const job = new Job({
        id: jobData.id || this.generateJobId(),
        command: jobData.command,
        state: "pending",
        attempts: 0,
        max_retries: jobData.max_retries || maxRetries,
        priority: jobData.priority || 0,
        created_at: new Date(),
        updated_at: new Date(),
      });

      await job.save();
      logger.info(`Job created: ${job.id}`);
      return job;
    } catch (err) {
      logger.error(`Error creating job: ${err.message}`);
      throw err;
    }
  }

  /** Generate a unique job ID */
  generateJobId() {
    const ts = Date.now().toString(36);
    const rand = Math.random().toString(36).slice(2, 8);
    return `job_${ts}_${rand}`;
  }

  /** Get job by ID */
  async getJob(jobId) {
    try {
      return await Job.findOne({ id: jobId });
    } catch (err) {
      logger.error(`Error fetching job ${jobId}: ${err.message}`);
      return null;
    }
  }

  /** Update job state with optional extra data */
  async updateJobState(jobId, state, extra = {}) {
    try {
      const data = { state, updated_at: new Date(), ...extra };
      if (state === "completed") data.completed_at = new Date();

      const job = await Job.findOneAndUpdate({ id: jobId }, data, {
        new: true,
      });
      if (job) logger.info(`Job ${jobId} updated to state: ${state}`);
      return job;
    } catch (err) {
      logger.error(`Error updating job ${jobId}: ${err.message}`);
      return null;
    }
  }

  /** List jobs (optionally by state) */
  async listJobs(state = null, limit = 100) {
    try {
      const query = state ? { state } : {};
      return await Job.find(query).sort({ created_at: -1 }).limit(limit);
    } catch (err) {
      logger.error(`Error listing jobs: ${err.message}`);
      return [];
    }
  }

  /** Get aggregated job statistics */
  async getStats() {
    try {
      const states = ["pending", "processing", "completed", "failed", "dead"];
      const counts = await Promise.all(
        states.map((s) => Job.countDocuments({ state: s }))
      );
      const total = counts.reduce((a, b) => a + b, 0);

      return {
        pending: counts[0],
        processing: counts[1],
        completed: counts[2],
        failed: counts[3],
        dead: counts[4],
        total,
      };
    } catch (err) {
      logger.error(`Error fetching stats: ${err.message}`);
      return null;
    }
  }

  /** Delete a job by ID */
  async deleteJob(jobId) {
    try {
      const result = await Job.deleteOne({ id: jobId });
      if (result.deletedCount > 0) {
        logger.info(`Job deleted: ${jobId}`);
        return true;
      }
      return false;
    } catch (err) {
      logger.error(`Error deleting job ${jobId}: ${err.message}`);
      return false;
    }
  }

  /** Try to lock a job for processing */
  async acquireLock(jobId, workerId) {
    try {
      const lockTimeout = await appConfig.get("lock-timeout", 300000);
      const now = new Date();
      const expired = new Date(now - lockTimeout);

      const job = await Job.findOneAndUpdate(
        {
          id: jobId,
          state: { $in: ["pending", "failed"] },
          $or: [{ locked_at: null }, { locked_at: { $lt: expired } }],
          $or: [{ next_retry_at: null }, { next_retry_at: { $lte: now } }],
        },
        { locked_at: now, locked_by: workerId, state: "processing" },
        { new: true }
      );

      return job;
    } catch (err) {
      logger.error(`Error acquiring lock for ${jobId}: ${err.message}`);
      return null;
    }
  }

  /** Release a job lock */
  async releaseLock(jobId) {
    try {
      await Job.updateOne({ id: jobId }, { locked_at: null, locked_by: null });
    } catch (err) {
      logger.error(`Error releasing lock for ${jobId}: ${err.message}`);
    }
  }
}

module.exports = new JobManager();
