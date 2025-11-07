const chalk = require("chalk");
const jobManager = require("../core/jobManager");

async function enqueueJob(jobInput, options) {
  try {
    let jobData;

    // Parse JSON or fallback to raw command
    try {
      jobData = JSON.parse(jobInput);
      if (!jobData.command) throw new Error('Missing required field "command"');
    } catch {
      jobData = { command: jobInput };
    }

    // Apply CLI options if provided
    if (options.priority) jobData.priority = Number(options.priority);
    if (options.retries) jobData.max_retries = Number(options.retries);

    const job = await jobManager.createJob(jobData);

    console.log(chalk.green("✓ Job enqueued successfully"));
    console.log(chalk.gray("─".repeat(50)));
    console.log(chalk.cyan("Job ID:      "), job.id);
    console.log(chalk.cyan("Command:     "), job.command);
    console.log(chalk.cyan("State:       "), job.state);
    console.log(chalk.cyan("Max Retries: "), job.max_retries);
    console.log(chalk.cyan("Priority:    "), job.priority);
    console.log(chalk.cyan("Created:     "), job.created_at.toISOString());
    console.log(chalk.gray("─".repeat(50)));
  } catch (err) {
    console.error(chalk.red("✗ Failed to enqueue job:"), err.message);
    process.exit(1);
  }
}

module.exports = enqueueJob;
