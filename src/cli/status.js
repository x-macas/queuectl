const chalk = require("chalk");
const Table = require("cli-table3");
const jobManager = require("../core/jobManager");
const workerEngine = require("../core/workerEngine");
const appConfig = require("../config/appConfig");

async function showStatus() {
  try {
    console.log(chalk.bold.blue("\n📊 QueueCTL Status\n"));

    // --- Job Statistics ---
    const stats = await jobManager.getStats();
    const jobTable = new Table({
      head: [chalk.cyan("State"), chalk.cyan("Count")],
      style: { head: [], border: [] },
    });

    jobTable.push(
      [chalk.yellow("Pending"), stats.pending],
      [chalk.blue("Processing"), stats.processing],
      [chalk.green("Completed"), stats.completed],
      [chalk.red("Failed"), stats.failed],
      [chalk.magenta("Dead (DLQ)"), stats.dead],
      [chalk.bold("Total"), chalk.bold(stats.total)]
    );

    console.log(chalk.bold("Jobs:"));
    console.log(jobTable.toString());

    // --- Worker Info ---
    const workers = workerEngine.getWorkersInfo();
    console.log(chalk.bold("\nWorkers:"));
    if (!workers.length) {
      console.log(chalk.gray("  No workers running"));
    } else {
      const workerTable = new Table({
        head: [
          chalk.cyan("Worker ID"),
          chalk.cyan("Current Job"),
          chalk.cyan("Processed"),
        ],
        style: { head: [], border: [] },
      });

      workers.forEach((w) =>
        workerTable.push([
          w.id,
          w.currentJob || chalk.gray("idle"),
          w.processedCount,
        ])
      );
      console.log(workerTable.toString());
    }

    // --- Config Info ---
    console.log(chalk.bold("\nConfiguration:"));
    const config = await appConfig.getAll();
    const cfgTable = new Table({
      head: [chalk.cyan("Key"), chalk.cyan("Value")],
      style: { head: [], border: [] },
    });

    cfgTable.push(
      [
        "max-retries",
        config["max-retries"] || (await appConfig.get("max-retries")),
      ],
      [
        "backoff-base",
        config["backoff-base"] || (await appConfig.get("backoff-base")),
      ]
    );

    console.log(cfgTable.toString(), "\n");
  } catch (err) {
    console.error(chalk.red("✗ Failed to fetch status:"), err.message);
    process.exit(1);
  }
}

module.exports = showStatus;
