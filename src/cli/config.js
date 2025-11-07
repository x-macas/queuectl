const chalk = require("chalk");
const Table = require("cli-table3");
const appConfig = require("../config/appConfig");

async function getConfig(key) {
  try {
    if (key) {
      const value = await appConfig.get(key);
      console.log(chalk.cyan(`${key}:`), value);
      return;
    }

    const configs = await appConfig.getAll();
    const maxRetries =
      configs["max-retries"] || (await appConfig.get("max-retries"));
    const backoffBase =
      configs["backoff-base"] || (await appConfig.get("backoff-base"));

    const table = new Table({
      head: [chalk.cyan("Key"), chalk.cyan("Value"), chalk.cyan("Source")],
      style: { head: [], border: [] },
    });

    table.push(
      [
        "max-retries",
        maxRetries,
        configs["max-retries"] ? "database" : "default",
      ],
      [
        "backoff-base",
        backoffBase,
        configs["backoff-base"] ? "database" : "default",
      ]
    );

    // Add any other configs beyond defaults
    for (const [k, v] of Object.entries(configs)) {
      if (k !== "max-retries" && k !== "backoff-base") {
        table.push([k, v, "database"]);
      }
    }

    console.log(chalk.bold.blue("\n⚙️  Configuration\n"));
    console.log(table.toString(), "\n");
  } catch (err) {
    console.error(chalk.red("✗ Failed to get configuration:"), err.message);
    process.exit(1);
  }
}

async function setConfig(key, value) {
  try {
    const validKeys = [
      "max-retries",
      "backoff-base",
      "lock-timeout",
      "worker-poll-interval",
    ];

    if (!validKeys.includes(key)) {
      console.log(chalk.yellow(`⚠️  '${key}' is not a standard key`));
      console.log(chalk.gray(`   Valid keys: ${validKeys.join(", ")}`));
    }

    const parsedValue = isNaN(value) ? value : parseFloat(value);
    const success = await appConfig.set(key, parsedValue);

    if (!success) {
      console.error(chalk.red("✗ Failed to update configuration"));
      process.exit(1);
    }

    console.log(
      chalk.green(`✓ Updated configuration: ${key} = ${parsedValue}`)
    );
    appConfig.clearCache(); // Refresh cached values
  } catch (err) {
    console.error(chalk.red("✗ Error setting configuration:"), err.message);
    process.exit(1);
  }
}

module.exports = { get: getConfig, set: setConfig };
