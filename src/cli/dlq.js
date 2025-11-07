const chalk = require("chalk");
const Table = require("cli-table3");
const readline = require("readline");
const dlqManager = require("../core/dlq");

async function listDLQ(options) {
  try {
    const limit = Number(options.limit) || 20;
    const jobs = await dlqManager.listDeadLetterJobs(limit);

    if (!jobs.length) {
      console.log(chalk.yellow("Dead Letter Queue is empty"));
      return;
    }

    console.log(
      chalk.bold.magenta(`\n💀 Dead Letter Queue (${jobs.length} jobs)\n`)
    );

    const table = new Table({
      head: [
        chalk.cyan("Job ID"),
        chalk.cyan("Command"),
        chalk.cyan("Attempts"),
        chalk.cyan("Error"),
        chalk.cyan("Updated"),
      ],
      colWidths: [25, 25, 10, 30, 20],
      wordWrap: true,
      style: { head: [], border: [] },
    });

    jobs.forEach((job) => {
      const cmd =
        job.command.length > 22
          ? job.command.slice(0, 22) + "..."
          : job.command;
      const err =
        job.error.length > 27 ? job.error.slice(0, 27) + "..." : job.error;
      const updated = new Date(job.updated_at).toLocaleString();

      table.push([job.id, cmd, job.attempts, chalk.red(err), updated]);
    });

    console.log(table.toString(), "\n");
  } catch (err) {
    console.error(chalk.red("✗ Failed to list DLQ:"), err.message);
    process.exit(1);
  }
}

async function retryJob(jobId) {
  try {
    const job = await dlqManager.retryFromDLQ(jobId);
    if (!job) {
      console.error(chalk.red(`✗ Job ${jobId} not found in DLQ`));
      process.exit(1);
    }
    console.log(chalk.green(`✓ Job ${jobId} moved back to queue`));
    console.log(chalk.gray("  It will be retried automatically by workers."));
  } catch (err) {
    console.error(chalk.red("✗ Failed to retry job:"), err.message);
    process.exit(1);
  }
}

async function deleteJob(jobId) {
  try {
    const deleted = await dlqManager.deleteFromDLQ(jobId);
    if (!deleted) {
      console.error(chalk.red(`✗ Job ${jobId} not found in DLQ`));
      process.exit(1);
    }
    console.log(chalk.green(`✓ Deleted job ${jobId} from DLQ`));
  } catch (err) {
    console.error(chalk.red("✗ Failed to delete job:"), err.message);
    process.exit(1);
  }
}

async function clearDLQ() {
  try {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    const answer = await new Promise((res) =>
      rl.question(chalk.yellow("⚠️  Clear entire DLQ? (yes/no): "), res)
    );
    rl.close();

    if (answer.trim().toLowerCase() !== "yes") {
      console.log(chalk.gray("Operation cancelled."));
      return;
    }

    const count = await dlqManager.clearDLQ();
    console.log(chalk.green(`✓ Cleared ${count} job(s) from DLQ`));
  } catch (err) {
    console.error(chalk.red("✗ Failed to clear DLQ:"), err.message);
    process.exit(1);
  }
}

module.exports = {
  list: listDLQ,
  retry: retryJob,
  deleteJob,
  clear: clearDLQ,
};
