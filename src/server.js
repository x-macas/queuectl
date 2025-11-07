const express = require("express");
const path = require("path");
require("dotenv").config();
const { connectDB } = require("./config/db");
const routes = require("./api/routes");
const logger = require("./utils/logger");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

// View engine
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Routes
app.use("/api", routes);

// Dashboard route
app.get("/", (req, res) => {
  res.render("dashboard", { title: "QueueCTL Dashboard" });
});

app.get("/jobs", (req, res) => {
  res.render("jobs", { title: "Jobs" });
});

app.get("/dlq", (req, res) => {
  res.render("dlq", { title: "Dead Letter Queue" });
});

// Start server
async function start() {
  try {
    await connectDB();
    app.listen(PORT, () => {
      logger.info(`🚀 QueueCTL Dashboard running on http://localhost:${PORT}`);
      console.log(`\n📊 Dashboard: http://localhost:${PORT}`);
      console.log(`📋 Jobs: http://localhost:${PORT}/jobs`);
      console.log(`💀 DLQ: http://localhost:${PORT}/dlq\n`);
    });
  } catch (error) {
    logger.error("Failed to start server:", error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on("SIGINT", () => {
  logger.info("Shutting down server...");
  process.exit(0);
});

if (require.main === module) {
  start();
}

module.exports = app;
