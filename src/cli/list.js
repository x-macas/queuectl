const chalk = require("chalk");
const Table = require("cli-table3");
const jobManager = require("../core/jobManager");

async function listJobs(options) {
  try {
    const state = options.state || null;
    const limit = Number(options.limit) || 20;
    const jobs = await jobManager.listJobs(state, limit);

    if (!jobs.length) {
      console.log(chalk.yellow("No jobs found"));
      return;
    }

    const title = state
      ? `Jobs (state: ${state}, showing ${jobs.length})`
      : `All Jobs (showing ${jobs.length})`;

    console.log(chalk.bold.blue(`\n${title}\n`));

    const table = new Table({
      head: [
        chalk.cyan("Job ID"),
        chalk.cyan("Command"),
        chalk.cyan("State"),
        chalk.cyan("Attempts"),
        chalk.cyan("Created"),
      ],
      colWidths: [25, 30, 12, 10, 20],
      wordWrap: true,
      style: { head: [], border: [] },
    });

    const stateColor = {
      pending: chalk.yellow,
      processing: chalk.blue,
      completed: chalk.green,
      failed: chalk.red,
      dead: chalk.magenta,
    };

    jobs.forEach((job) => {
      const cmd =
        job.command.length > 27
          ? job.command.slice(0, 27) + "..."
          : job.command;
      const created = new Date(job.created_at).toLocaleString();

      table.push([
        job.id,
        cmd,
        (stateColor[job.state] || chalk.white)(job.state),
        `${job.attempts}/${job.max_retries}`,
        created,
      ]);
    });

    console.log(table.toString(), "\n");
  } catch (err) {
    console.error(chalk.red("✗ Failed to list jobs:"), err.message);
    process.exit(1);
  }
}

module.exports = listJobs;
