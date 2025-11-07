/**
 * Calculate exponential backoff delay in milliseconds
 * Formula: (base ^ attempts) * 1000
 */
function calculateBackoff(attempts, base = 2) {
  const delaySeconds = Math.pow(base, attempts);
  return delaySeconds * 1000;
}

/**
 * Get next retry time based on current attempt
 */
function getNextRetryTime(attempts, base = 2) {
  const delay = calculateBackoff(attempts, base);
  return new Date(Date.now() + delay);
}

/**
 * Format duration in human readable format
 */
function formatDuration(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = {
  calculateBackoff,
  getNextRetryTime,
  formatDuration,
  sleep,
};
