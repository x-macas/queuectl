const { exec } = require("child_process");
const Job = require("../models/Job");
const jobManager = require("./jobManager");
const retryManager = require("./retry");
const appConfig = require("../config/appConfig");
const logger = require("../utils/logger");
const { sleep } = require("../utils/time");

// 🔧 Normalize shell commands (for Windows compatibility)
function normalizeCommand(cmd) {
  const trimmed = cmd.trim();

  // Handle pseudo-commands (sleep, fail) - return as-is
  if (/^sleep\s+\d+$/i.test(trimmed) || trimmed.toLowerCase() === "fail") {
    return trimmed;
  }

  // For Windows, wrap commands with cmd.exe if not already wrapped
  if (process.platform === "win32") {
    // Check if already wrapped with cmd /c or powershell
    if (!/^(cmd|powershell)/i.test(trimmed)) {
      // Escape quotes inside the command
      const escaped = trimmed.replace(/"/g, '\\"');
      return `cmd /c "${escaped}"`;
    }
  }

  return trimmed;
}

class WorkerEngine {
  constructor() {
    this.workers = new Map();
    this.isShuttingDown = false;
  }

  /** Start one or more workers */
  async startWorkers(count = 1) {
    logger.info(`Starting ${count} worker(s)...`);
    for (let i = 0; i < count; i++) {
      const id = `worker_${Date.now()}_${i}`;
      const worker = this.createWorker(id);
      this.workers.set(id, worker);
    }
    logger.info(`${count} worker(s) active`);
    return [...this.workers.keys()];
  }

  /** Create and initialize a worker loop */
  createWorker(id) {
    const worker = { id, isRunning: true, currentJob: null, processedCount: 0 };

    this.processLoop(worker).catch((err) => {
      logger.error(`Worker ${id} crashed: ${err.message}`);
      this.workers.delete(id);
    });

    return worker;
  }

  /** Core loop — each worker continuously polls for jobs */
  async processLoop(worker) {
    const pollInterval = await appConfig.get("worker-poll-interval", 1000);

    while (worker.isRunning && !this.isShuttingDown) {
      try {
        const job = await this.getNextJob(worker.id);
        if (job) {
          worker.currentJob = job.id;
          await this.executeJob(job, worker.id);
          worker.processedCount++;
          worker.currentJob = null;
        } else {
          await sleep(pollInterval);
        }
      } catch (err) {
        logger.error(`Worker ${worker.id} error: ${err.message}`);
        worker.currentJob = null;
        await sleep(pollInterval);
      }
    }

    logger.info(
      `Worker ${worker.id} stopped after ${worker.processedCount} job(s).`
    );
  }

  /** Find and lock the next job ready for processing */
  async getNextJob(workerId) {
    try {
      const now = new Date();
      const lockTimeout = await appConfig.get("lock-timeout", 300000);
      const expired = new Date(now - lockTimeout);

      return await Job.findOneAndUpdate(
        {
          state: { $in: ["pending", "failed"] },
          $or: [{ locked_at: null }, { locked_at: { $lt: expired } }],
          $and: [
            {
              $or: [{ next_retry_at: null }, { next_retry_at: { $lte: now } }],
            },
          ],
        },
        {
          state: "processing",
          locked_at: now,
          locked_by: workerId,
          updated_at: now,
        },
        { new: true, sort: { priority: -1, created_at: 1 } }
      );
    } catch (err) {
      logger.error(`Error fetching next job: ${err.message}`);
      return null;
    }
  }

  /** Execute a job command */
  async executeJob(job, workerId) {
    logger.info(`Worker ${workerId} executing job ${job.id}: ${job.command}`);
    try {
      const output = await this.runCommand(job.command);
      await jobManager.updateJobState(job.id, "completed", {
        output: output.trim(),
        completed_at: new Date(),
        locked_at: null,
        locked_by: null,
      });
      logger.info(`Job ${job.id} completed successfully`);
    } catch (err) {
      logger.error(`Job ${job.id} failed: ${err.message}`);
      await retryManager.handleFailure(job.id, err.message);
    }
  }

  /**
   * Run a shell command with timeout.
   * Supports pseudo-commands like:
   *   - sleep <seconds> (cross-platform)
   *   - fail (simulated failure)
   */
  async runCommand(command, timeout = 60000) {
    const cmd = command.trim();

    // 💤 Handle pseudo-command: sleep N (cross-platform)
    if (/^sleep\s+\d+$/i.test(cmd)) {
      const seconds = parseInt(cmd.split(/\s+/)[1]);
      logger.info(`Simulating sleep for ${seconds} second(s)...`);
      await sleep(seconds * 1000);
      return `Slept for ${seconds} second(s)`;
    }

    // 💥 Handle pseudo-command: fail (for DLQ/retry testing)
    if (cmd.toLowerCase() === "fail") {
      throw new Error("Simulated job failure for testing retries/DLQ");
    }

    // 🧩 Otherwise, execute as a real shell command
    const normalizedCmd = normalizeCommand(cmd);

    return new Promise((resolve, reject) => {
      exec(normalizedCmd, { timeout }, (error, stdout, stderr) => {
        if (error) {
          reject(new Error(stderr || error.message));
        } else {
          resolve(stdout || "");
        }
      });
    });
  }

  /** Gracefully stop all workers */
  async stopWorkers() {
    if (this.workers.size === 0) {
      logger.info("No workers running.");
      return;
    }

    logger.info(`Stopping ${this.workers.size} worker(s)...`);
    this.isShuttingDown = true;
    this.workers.forEach((w) => (w.isRunning = false));

    const maxWait = 30000;
    const start = Date.now();

    while (Date.now() - start < maxWait) {
      const active = [...this.workers.values()].filter((w) => w.currentJob);
      if (!active.length) break;

      logger.info(`Waiting for ${active.length} active job(s)...`);
      await sleep(1000);
    }

    // Release locks if any jobs still held
    for (const w of this.workers.values()) {
      if (w.currentJob) await jobManager.releaseLock(w.currentJob);
    }

    this.workers.clear();
    this.isShuttingDown = false;
    logger.info("All workers stopped gracefully.");
  }

  /** Worker info snapshot (for CLI status) */
  getWorkersInfo() {
    return [...this.workers.values()].map((w) => ({
      id: w.id,
      currentJob: w.currentJob,
      processedCount: w.processedCount,
      isRunning: w.isRunning,
    }));
  }

  /** Get total worker count */
  getWorkerCount() {
    return this.workers.size;
  }
}

module.exports = new WorkerEngine();
