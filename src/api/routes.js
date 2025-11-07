const express = require("express");
const router = express.Router();
const jobManager = require("../core/jobManager");
const workerEngine = require("../core/workerEngine");
const dlqManager = require("../core/dlq");
const appConfig = require("../config/appConfig");

// Get stats
router.get("/stats", async (req, res) => {
  try {
    const stats = await jobManager.getStats();
    const workers = workerEngine.getWorkersInfo();
    const config = await appConfig.getAll();

    res.json({
      jobs: stats,
      workers: {
        count: workers.length,
        active: workers.filter((w) => w.currentJob).length,
        details: workers,
      },
      config,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// List jobs
router.get("/jobs", async (req, res) => {
  try {
    const { state, limit = 50 } = req.query;
    const jobs = await jobManager.listJobs(state, parseInt(limit));
    res.json({ jobs });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get single job
router.get("/jobs/:id", async (req, res) => {
  try {
    const job = await jobManager.getJob(req.params.id);
    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }
    res.json({ job });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create job
router.post("/jobs", async (req, res) => {
  try {
    const job = await jobManager.createJob(req.body);
    res.status(201).json({ job });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete job
router.delete("/jobs/:id", async (req, res) => {
  try {
    const success = await jobManager.deleteJob(req.params.id);
    if (!success) {
      return res.status(404).json({ error: "Job not found" });
    }
    res.json({ message: "Job deleted" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DLQ routes
router.get("/dlq", async (req, res) => {
  try {
    const { limit = 50 } = req.query;
    const jobs = await dlqManager.listDeadLetterJobs(parseInt(limit));
    res.json({ jobs });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/dlq/:id/retry", async (req, res) => {
  try {
    const job = await dlqManager.retryFromDLQ(req.params.id);
    if (!job) {
      return res.status(404).json({ error: "Job not found in DLQ" });
    }
    res.json({ job, message: "Job moved back to queue" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete("/dlq/:id", async (req, res) => {
  try {
    const success = await dlqManager.deleteFromDLQ(req.params.id);
    if (!success) {
      return res.status(404).json({ error: "Job not found in DLQ" });
    }
    res.json({ message: "Job deleted from DLQ" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Worker routes
router.post("/workers/start", async (req, res) => {
  try {
    const { count = 1 } = req.body;
    const workerIds = await workerEngine.startWorkers(count);
    res.json({ workerIds, message: `Started ${workerIds.length} worker(s)` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/workers/stop", async (req, res) => {
  try {
    await workerEngine.stopWorkers();
    res.json({ message: "All workers stopped" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/workers", async (req, res) => {
  try {
    const workers = workerEngine.getWorkersInfo();
    res.json({ workers });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Config routes
router.get("/config", async (req, res) => {
  try {
    const config = await appConfig.getAll();
    res.json({ config });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put("/config/:key", async (req, res) => {
  try {
    const { value } = req.body;
    await appConfig.set(req.params.key, value);
    res.json({ message: "Config updated" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
