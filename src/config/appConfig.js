const Config = require("../models/Config");

class AppConfig {
  constructor() {
    this.cache = {};
  }

  async get(key, defaultValue) {
    // Return cached value if available
    if (this.cache[key] !== undefined) {
      return this.cache[key];
    }

    try {
      const config = await Config.findOne({ key });
      if (config) {
        this.cache[key] = config.value;
        return config.value;
      }
    } catch (error) {
      console.error(`Error fetching config ${key}:`, error.message);
    }

    // Return default from env or provided default
    const envDefaults = {
      "max-retries": parseInt(process.env.MAX_RETRIES) || 3,
      "backoff-base": parseInt(process.env.BACKOFF_BASE) || 2,
      "lock-timeout": 300000, // 5 minutes
      "worker-poll-interval": 1000, // 1 second
    };

    const value =
      envDefaults[key] !== undefined ? envDefaults[key] : defaultValue;
    this.cache[key] = value;
    return value;
  }

  async set(key, value) {
    try {
      await Config.findOneAndUpdate(
        { key },
        { key, value },
        { upsert: true, new: true }
      );
      this.cache[key] = value;
      return true;
    } catch (error) {
      console.error(`Error setting config ${key}:`, error.message);
      return false;
    }
  }

  async getAll() {
    try {
      const configs = await Config.find({});
      const result = {};
      configs.forEach((config) => {
        result[config.key] = config.value;
      });
      return result;
    } catch (error) {
      console.error("Error fetching all configs:", error.message);
      return {};
    }
  }

  clearCache() {
    this.cache = {};
  }
}

module.exports = new AppConfig();
