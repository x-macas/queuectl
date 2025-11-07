#!/usr/bin/env node

const { Command } = require("commander");
const { connectDB, disconnectDB } = require("../config/db");
const enqueueCmd = require("./enqueue");
const workerCmd = require("./worker");
const statusCmd = require("./status");
const configCmd = require("./config");
const dlqCmd = require("./dlq");
const listCmd = require("./list");

const program = new Command();

program
  .name("queuectl")
  .description("CLI-based background job queue system")
  .version("1.0.0");

// ---------- Enqueue ----------
program
  .command("enqueue <job>")
  .description("Add a new job (JSON string or command)")
  .option("-p, --priority <number>", "Job priority (default: 0)", "0")
  .option("-r, --retries <number>", "Max retry attempts")
  .action(async (job, opts) => {
    await connectDB();
    await enqueueCmd(job, opts);
    await disconnectDB();
  });

// ---------- Worker ----------
const worker = program.command("worker").description("Manage job workers");

worker
  .command("start")
  .description("Start one or more workers")
  .option("-c, --count <number>", "Number of workers", "1")
  .action(async (opts) => {
    await connectDB();
    await workerCmd.start(opts);
  });

worker
  .command("stop")
  .description("Stop all running workers")
  .action(async () => {
    await connectDB();
    await workerCmd.stop();
    await disconnectDB();
  });

// ---------- Status ----------
program
  .command("status")
  .description("Show queue statistics")
  .action(async () => {
    await connectDB();
    await statusCmd();
    await disconnectDB();
  });

// ---------- List ----------
program
  .command("list")
  .description("Show jobs by state")
  .option(
    "-s, --state <state>",
    "Filter (pending|processing|completed|failed|dead)"
  )
  .option("-l, --limit <number>", "Limit number of jobs", "20")
  .action(async (opts) => {
    await connectDB();
    await listCmd(opts);
    await disconnectDB();
  });

// ---------- DLQ ----------
const dlq = program.command("dlq").description("Dead Letter Queue actions");

dlq
  .command("list")
  .description("Show jobs in DLQ")
  .option("-l, --limit <number>", "Limit number of jobs", "20")
  .action(async (opts) => {
    await connectDB();
    await dlqCmd.list(opts);
    await disconnectDB();
  });

dlq
  .command("retry <jobId>")
  .description("Re-enqueue a DLQ job")
  .action(async (jobId) => {
    await connectDB();
    await dlqCmd.retry(jobId);
    await disconnectDB();
  });

dlq
  .command("delete <jobId>")
  .description("Remove a DLQ job permanently")
  .action(async (jobId) => {
    await connectDB();
    await dlqCmd.deleteJob(jobId);
    await disconnectDB();
  });

dlq
  .command("clear")
  .description("Remove all jobs from DLQ")
  .action(async () => {
    await connectDB();
    await dlqCmd.clear();
    await disconnectDB();
  });

// ---------- Config ----------
const config = program.command("config").description("Configuration options");

config
  .command("get [key]")
  .description("View configuration values")
  .action(async (key) => {
    await connectDB();
    await configCmd.get(key);
    await disconnectDB();
  });

config
  .command("set <key> <value>")
  .description("Set a configuration key (e.g. max-retries, backoff-base)")
  .action(async (key, value) => {
    await connectDB();
    await configCmd.set(key, value);
    await disconnectDB();
  });

// ---------- Graceful Shutdown ----------
const shutdown = async (signal) => {
  console.log(`\nReceived ${signal}. Closing connections...`);
  await disconnectDB();
  process.exit(0);
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

program.parse();
