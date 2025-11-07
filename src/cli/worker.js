const chalk = require("chalk");
const workerEngine = require("../core/workerEngine");

async function startWorkers(options) {
  try {
    const count = Number(options.count) || 1;

    if (count < 1 || count > 10) {
      console.error(chalk.red("✗ Worker count must be between 1 and 10"));
      process.exit(1);
    }

    console.log(chalk.blue(`Starting ${count} worker(s)...`));
    const ids = await workerEngine.startWorkers(count);

    console.log(chalk.green(`✓ ${ids.length} worker(s) started successfully`));
    console.log(chalk.gray("─".repeat(50)));
    ids.forEach((id, i) => console.log(chalk.cyan(`Worker ${i + 1}:`), id));
    console.log(chalk.gray("─".repeat(50)));
    console.log(chalk.yellow("Workers running... Press Ctrl+C to stop."));

    // Keep alive until manual termination
    await new Promise(() => {});
  } catch (err) {
    console.error(chalk.red("✗ Failed to start workers:"), err.message);
    process.exit(1);
  }
}

async function stopWorkers() {
  try {
    console.log(chalk.blue("Stopping all workers..."));
    await workerEngine.stopWorkers();
    console.log(chalk.green("✓ All workers stopped successfully"));
  } catch (err) {
    console.error(chalk.red("✗ Failed to stop workers:"), err.message);
    process.exit(1);
  }
}

module.exports = { start: startWorkers, stop: stopWorkers };
