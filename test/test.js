#!/usr/bin/env node

/**
 * QueueCTL Minimal Test Suite
 * Tests: enqueue, workers, retries, DLQ, persistence
 */

require("dotenv").config();
const { connectDB, disconnectDB } = require("../src/config/db");
const jobManager = require("../src/core/jobManager");
const workerEngine = require("../src/core/workerEngine");
const retryManager = require("../src/core/retry");
const dlqManager = require("../src/core/dlq");
const Job = require("../src/models/Job");
const { sleep } = require("../src/utils/time");

async function cleanup() {
  await Job.deleteMany({});
  console.log("Database cleaned");
}

// 1️⃣ Basic job success
async function test_basicJobCompletion() {
  console.log("\nTest 1: Basic job completes successfully");
  const job = await jobManager.createJob({ command: 'echo "Hello World"' });
  await workerEngine.startWorkers(1);
  await sleep(3000);

  const result = await jobManager.getJob(job.id);
  const ok = result.state === "completed";
  console.log(ok ? "✓ Passed" : "✗ Failed", `state=${result.state}`);
  return ok;
}

// 2️⃣ Failed job retries and moves to DLQ
async function test_failedJobWithRetry() {
  console.log("\nTest 2: Failed job retries and moves to DLQ");
  const job = await jobManager.createJob({ command: "exit 1", max_retries: 2 });
  await sleep(10000);

  const result = await jobManager.getJob(job.id);
  const ok = result.state === "dead" && result.attempts >= 2;
  console.log(
    ok ? "✓ Passed" : "✗ Failed",
    `state=${result.state}, attempts=${result.attempts}`
  );
  return ok;
}

// 3️⃣ Multiple workers
async function test_multipleWorkers() {
  console.log("\nTest 3: Multiple workers process jobs");
  await workerEngine.stopWorkers();

  const cmds = [
    'node -p "Date.now()"',
    'node -p "Math.random()"',
    'node -p "process.version"',
    'node -p "process.platform"',
    'node -p "process.arch"',
  ];

  const jobs = await Promise.all(
    cmds.map((cmd) => jobManager.createJob({ command: cmd }))
  );
  await workerEngine.startWorkers(3);
  await sleep(5000);

  const states = await Promise.all(jobs.map((j) => jobManager.getJob(j.id)));
  const ok = states.every((j) => j.state === "completed");
  console.log(
    ok ? "✓ Passed" : "✗ Failed",
    `${states.filter((j) => j.state === "completed").length}/${
      jobs.length
    } completed`
  );
  return ok;
}

// 4️⃣ Invalid command
async function test_invalidCommand() {
  console.log("\nTest 4: Invalid command fails gracefully");
  const job = await jobManager.createJob({
    command: "nonexistentcommand123",
    max_retries: 1,
  });
  await sleep(5000);
  const result = await jobManager.getJob(job.id);
  const ok = result.state === "dead";
  console.log(ok ? "✓ Passed" : "✗ Failed", `state=${result.state}`);
  return ok;
}

// 5️⃣ Persistence
async function test_persistence() {
  console.log("\nTest 5: Job persists across restart");
  const job = await jobManager.createJob({
    command: 'echo "Persistence test"',
  });
  const id = job.id;
  await disconnectDB();
  await sleep(1000);
  await connectDB();
  const found = await jobManager.getJob(id);
  const ok = found && found.id === id;
  console.log(
    ok ? "✓ Passed" : "✗ Failed",
    found ? `found ${found.id}` : "not found"
  );
  return ok;
}

// 6️⃣ DLQ retry
async function test_dlqRetry() {
  console.log("\nTest 6: DLQ retry works");
  let [job] = await dlqManager.listDeadLetterJobs(1);
  if (!job) {
    job = await jobManager.createJob({ command: "exit 1", max_retries: 0 });
    await sleep(2000);
    [job] = await dlqManager.listDeadLetterJobs(1);
  }

  if (!job) {
    console.log("✗ Failed: No DLQ job available");
    return false;
  }

  const retried = await dlqManager.retryFromDLQ(job.id);
  const ok = retried && retried.state === "pending";
  console.log(
    ok ? "✓ Passed" : "✗ Failed",
    retried ? `state=${retried.state}` : "no job"
  );
  return ok;
}

async function runAllTests() {
  console.log("Running QueueCTL tests...");
  try {
    await connectDB();
    await cleanup();

    const tests = [
      test_basicJobCompletion,
      test_failedJobWithRetry,
      test_multipleWorkers,
      test_invalidCommand,
      test_persistence,
      test_dlqRetry,
    ];

    const results = [];
    for (const t of tests) results.push(await t().catch(() => false));

    await workerEngine.stopWorkers();

    const passed = results.filter(Boolean).length;
    console.log("\nSummary:", `${passed}/${results.length} tests passed`);
    await disconnectDB();
    process.exit(passed === results.length ? 0 : 1);
  } catch (err) {
    console.error("Test suite error:", err.message);
    await disconnectDB();
    process.exit(1);
  }
}

if (require.main === module) runAllTests();
module.exports = { runAllTests };
