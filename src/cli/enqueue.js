const chalk = require("chalk");
const jobManager = require("../core/jobManager");

/**
 * Convert PowerShell's quote-stripped JSON to valid JSON
 * Example: {command:echo Hello,priority:5} -> {"command":"echo Hello","priority":5}
 */
function fixPowerShellJSON(str) {
  // Remove outer braces temporarily
  let content = str.trim().slice(1, -1);

  // Split by commas (but not commas within values)
  const pairs = [];
  let current = "";
  let depth = 0;

  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    if (char === "{" || char === "[") depth++;
    if (char === "}" || char === "]") depth--;

    if (char === "," && depth === 0) {
      pairs.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  if (current.trim()) pairs.push(current.trim());

  // Convert each key:value pair to "key":"value"
  const fixedPairs = pairs.map((pair) => {
    const colonIndex = pair.indexOf(":");
    if (colonIndex === -1) return pair;

    const key = pair.slice(0, colonIndex).trim();
    const value = pair.slice(colonIndex + 1).trim();

    // Quote the key
    const quotedKey = `"${key}"`;

    // Quote the value if it's not a number, boolean, null, or already quoted
    let quotedValue = value;
    if (
      !/^(\d+|true|false|null|\[.*\]|\{.*\})$/.test(value) &&
      !value.startsWith('"')
    ) {
      quotedValue = `"${value}"`;
    }

    return `${quotedKey}:${quotedValue}`;
  });

  return `{${fixedPairs.join(",")}}`;
}

async function enqueueJob(jobInput, options) {
  try {
    let jobData;

    // Try to parse as JSON first
    try {
      const parsed = JSON.parse(jobInput);

      // Validate that it has a command field
      if (!parsed.command) {
        throw new Error('JSON input missing required field "command"');
      }

      jobData = parsed;
    } catch (jsonError) {
      // Check if it looks like PowerShell's quote-stripped JSON
      if (jobInput.trim().startsWith("{") && jobInput.trim().endsWith("}")) {
        try {
          // Try to fix and parse PowerShell format
          const fixed = fixPowerShellJSON(jobInput);
          const parsed = JSON.parse(fixed);

          if (!parsed.command) {
            throw new Error('JSON input missing required field "command"');
          }

          jobData = parsed;
          console.log(
            chalk.yellow(
              "ℹ Note: PowerShell stripped quotes from JSON (parsed successfully)"
            )
          );
        } catch (fixError) {
          console.error(chalk.red("✗ Invalid JSON format."));
          console.error(chalk.yellow("\nTip: Use the simple command format:"));
          console.error(chalk.gray('  queuectl enqueue "echo Hello QueueCTL"'));
          console.error(chalk.yellow("\nFor JSON, save to a file:"));
          console.error(
            chalk.gray('  echo \'{"command":"echo Hello"}\' > job.json')
          );
          console.error(
            chalk.gray("  queuectl enqueue (Get-Content job.json -Raw)")
          );
          process.exit(1);
        }
      } else {
        // Otherwise, treat the entire input as a raw command
        jobData = { command: jobInput };
      }
    }

    // Apply CLI options if provided (these override JSON values)
    if (options.priority !== undefined) {
      jobData.priority = Number(options.priority);
    }
    if (options.retries !== undefined) {
      jobData.max_retries = Number(options.retries);
    }

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
