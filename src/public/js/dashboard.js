async function fetchStats() {
  try {
    const response = await fetch("/api/stats");
    const data = await response.json();

    // Update job stats
    document.getElementById("pending-count").textContent = data.jobs.pending;
    document.getElementById("processing-count").textContent =
      data.jobs.processing;
    document.getElementById("completed-count").textContent =
      data.jobs.completed;
    document.getElementById("failed-count").textContent = data.jobs.failed;
    document.getElementById("dead-count").textContent = data.jobs.dead;
    document.getElementById("total-count").textContent = data.jobs.total;

    // Update worker stats
    document.getElementById("worker-count").textContent = data.workers.count;
    document.getElementById("active-jobs").textContent = data.workers.active;

    // Update workers list
    const workersList = document.getElementById("workers-list");
    if (data.workers.details.length === 0) {
      workersList.innerHTML =
        '<p style="color: #666;">No workers currently running</p>';
    } else {
      workersList.innerHTML = data.workers.details
        .map(
          (worker) => `
        <div class="worker-card ${worker.currentJob ? "active" : "idle"}">
          <strong>${worker.id}</strong><br>
          Current Job: ${
            worker.currentJob
              ? `<code>${worker.currentJob}</code>`
              : "<em>idle</em>"
          }<br>
          Processed: ${worker.processedCount} jobs
        </div>
      `
        )
        .join("");
    }

    // Update config
    const configList = document.getElementById("config-list");
    const maxRetries = data.config["max-retries"] || 3;
    const backoffBase = data.config["backoff-base"] || 2;

    configList.innerHTML = `
      <div class="config-item">
        <strong>Max Retries</strong>
        <span>${maxRetries}</span>
      </div>
      <div class="config-item">
        <strong>Backoff Base</strong>
        <span>${backoffBase}</span>
      </div>
    `;
  } catch (error) {
    console.error("Error fetching stats:", error);
  }
}

// Fetch stats on page load
fetchStats();

// Refresh every 3 seconds
setInterval(fetchStats, 3000);
