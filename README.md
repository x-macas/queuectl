# 🚀 QueueCTL - Background Job Queue System

A **production-grade CLI-based background job queue system** built with **Node.js** and **MongoDB**.  
QueueCTL efficiently manages background jobs using worker processes, automatic retries with exponential backoff,  
and a **Dead Letter Queue (DLQ)** for permanently failed jobs.

---

## 🎥 Demo Video

## https://drive.google.com/file/d/1vi9oee49Fhl_3JnLNj7RLwTiuPCHG6fG/view?usp=drive_link

## ✨ Features

✅ **Job Queue Management** — Enqueue, track, and manage background jobs  
✅ **Multiple Workers** — Run multiple concurrent worker processes  
✅ **Automatic Retries** — Implements exponential backoff retry mechanism  
✅ **Dead Letter Queue (DLQ)** — Automatically handles permanently failed jobs  
✅ **Persistent Storage** — MongoDB-based job persistence  
✅ **CLI Interface** — Full-featured and user-friendly command-line tool  
✅ **Web Dashboard** — Real-time job monitoring through an Express-based dashboard  
✅ **Configuration Management** — Runtime-configurable retry and backoff settings  
✅ **Graceful Shutdown** — Workers complete current jobs before stopping

---

## 🧰 Tech Stack

- **Backend:** Node.js, Express.js
- **Database:** MongoDB (Mongoose ORM)
- **CLI Framework:** Commander.js
- **Frontend (Dashboard):** EJS Templates, CSS, JavaScript

---

## 🚀 Installation & Setup

### Prerequisites

- **Node.js** (v14 or higher)
- **MongoDB** (v4.4 or higher)
- **npm** or **yarn**

---

### 🧩 Steps

```bash
# 1️⃣ Clone the repository
git clone https://github.com/manjureddy12/queuectl.git
cd queuectl

# 2️⃣ Install dependencies
npm install

# 3️⃣ Configure environment variables
cp .env.example .env
# Open .env and update it with your MongoDB connection string
# Example:
# MONGODB_URI=mongodb://localhost:27017/queuectl

# 4️⃣ Link the CLI tool globally (optional but recommended)
npm link

# 5️⃣ Start MongoDB (if not running)
mongod --dbpath "C:\data\db"
# or specify your custom data directory
```

## ⚡ Basic Usage

Once the setup is complete, you can start using **QueueCTL** directly from your terminal.

```bash
# Enqueue a job
queuectl enqueue "echo 'Hello World'"

# Start workers
queuectl worker start --count 3

# Check system status
queuectl status

# List jobs by state
queuectl list --state pending

# Start the web dashboard
npm start
# Visit http://localhost:3000
```

## 📖 Documentation

This section covers all available **CLI commands** for managing jobs, workers, configuration, and the Dead Letter Queue (DLQ).

---

### 🧾 Enqueue Jobs

```bash
# Enqueue with command string
queuectl enqueue "sleep 2"

# Enqueue with JSON payload
queuectl enqueue '{"id":"job1","command":"echo test","priority":1}'

# Enqueue with options
queuectl enqueue "curl https://api.example.com" --priority 5 --retries 5
```

### 🧾 Worker Management

```bash
# Start workers
queuectl worker start --count 3

# Stop workers (graceful shutdown)
queuectl worker stop
```

### 🧾 Job Monitoring

```bash
# Show system status

queuectl status

# List all jobs

queuectl list

# Filter by state

queuectl list --state pending
queuectl list --state failed
queuectl list --state completed

# Limit number of results

queuectl list --limit 50
```

### 🧾 Dead Letter Queue(DLQ)

```bash
# List jobs in the DLQ

queuectl dlq list

# Retry a failed job from DLQ

queuectl dlq retry job_abc123

# Delete a specific job from DLQ

queuectl dlq delete job_abc123

# Clear all jobs from DLQ (with confirmation)

queuectl dlq clear
```

### 🧾 Configuration Management

```bash
# View all configuration

queuectl config get

# View a specific configuration value

queuectl config get max-retries

# Update configuration values

queuectl config set max-retries 5
queuectl config set backoff-base 3

```

```

```

## 🏗️ Architecture

### 🧩 System Components

```
┌─────────────┐      ┌──────────────┐      ┌──────────────┐
│   CLI Tool  │─────▶│  Job Manager │─────▶│   MongoDB    │
└─────────────┘      └──────────────┘      └──────────────┘
                            │
                            ▼
                     ┌──────────────┐
                     │   Workers    │
                     │  (Multiple)  │
                     └──────────────┘
                            │
                            ▼
                     ┌──────────────┐
                     │ Retry Engine │
                     └──────────────┘
                            │
                    ┌───────┴────────┐
                    ▼                ▼
            ┌─────────────┐   ┌──────────┐
            │  Backoff    │   │   DLQ    │
            └─────────────┘   └──────────┘
```

### Explanation

- **CLI Tool** → Handles user commands (enqueue, worker, config, status, etc.)
- **Job Manager** → Creates, updates, and tracks job states in MongoDB
- **Workers** → Continuously poll and execute queued jobs concurrently
- **Retry Engine** → Manages exponential backoff retries for failed jobs
- **DLQ (Dead Letter Queue)** → Stores permanently failed jobs after max retries

---

### 🔄 Job Lifecycle

```
┌──────────┐
│ PENDING  │
└────┬─────┘
     │ Worker picks up
     ▼
┌────────────┐
│ PROCESSING │
└─────┬──────┘
      │
  ┌───┴────┐
  │ Success│ Failure
  ▼        ▼
┌──────────┐  ┌──────────┐
│COMPLETED │  │  FAILED  │
└──────────┘  └────┬─────┘
                   │
              ┌────┴─────┐
              │ Attempts │
              │ < Max?   │
              └────┬─────┘
                   │
            ┌──────┴───────┐
            │ Yes          │ No
            ▼              ▼
    ┌─────────────┐  ┌────────┐
    │ Exponential │  │  DEAD  │
    │   Backoff   │  │ (DLQ)  │
    └──────┬──────┘  └────────┘
           │
           └──▶ Back to FAILED
```

---

## 💾 Data Persistence

All jobs are stored persistently in **MongoDB** to ensure reliability across restarts and crashes.  
Each job document follows the schema below:

```javascript
{
  id: String,                    // Unique job identifier
  command: String,               // Command to execute (e.g., "echo 'Hello'")
  state: {                       // Current state of the job
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed', 'dead']
  },
  attempts: Number,              // Number of attempts made
  max_retries: Number,           // Maximum allowed retries
  priority: Number,              // Job priority for scheduling
  next_retry_at: Date,           // Next retry timestamp for failed jobs
  output: String,                // Command output (on success)
  error: String,                 // Error message (on failure)
  locked_at: Date,               // Timestamp when job was locked by a worker
  locked_by: String,             // Worker ID currently processing the job
  created_at: Date,              // Job creation time
  updated_at: Date,              // Last updated timestamp
  completed_at: Date             // Completion timestamp
}
```

## ⚙️ Worker Processing

Workers are responsible for picking up and executing jobs from the queue.  
Each worker continuously polls MongoDB for new or retryable jobs and processes them in isolation.

---

### 🔁 Job Acquisition

- Workers **atomically lock jobs** using MongoDB’s `findOneAndUpdate()` operation.
- This ensures that no two workers process the same job concurrently.

---

### ⚡ Execution

- Jobs are executed using Node.js’ built-in **`child_process.exec`** method.
- The `command` field of each job determines what is run (e.g., `echo "Hello"`, `sleep 2`).

---

### 🧩 Result Handling

- **Success:** The job’s state is updated to `completed`, and the output is stored in MongoDB.
- **Failure:** The job is retried using the exponential backoff strategy (explained below).

---

### 🔓 Lock Release

- Once a worker finishes or fails a job, its lock is released.
- Locks also **automatically expire** after a configurable timeout, ensuring no job stays “stuck” indefinitely.

---

## 🔁 Retry Mechanism

QueueCTL uses an **exponential backoff** strategy for retries, ensuring failed jobs don’t overwhelm the system.

### 📐 Formula

delay = base ^ attempts

### ⚙️ Default Settings

- **Base:** 2
- **Max Retries:** 3

### 🕒 Example Delays

| Attempt | Delay Before Next Retry          |
| ------- | -------------------------------- |
| 1       | 2 seconds                        |
| 2       | 4 seconds                        |
| 3       | 8 seconds                        |
| 4       | Moved to DLQ (Dead Letter Queue) |

---

## 🧪 Testing

QueueCTL can be tested both automatically and manually to verify job processing, retries, and DLQ handling.

---

### 🧰 Test Script

Run the built-in test suite to validate the queue system:

```bash
# Run test suite
node test/test.js

```

### 🧑‍🔧 Manual Testing

```bash
### 🖥️ Terminal 1 — Start Workers
queuectl worker start --count 2

```

```bash
### 🧪 Terminal 2 — Run Test Scenarios
# 1. Successful job
queuectl enqueue "echo 'Success test'"

# 2. Failed job with retries
queuectl enqueue "exit 1"

# 3. Command not found
queuectl enqueue "nonexistentcommand"

# 4. Long-running job
queuectl enqueue "sleep 10"

# 5. Priority job
queuectl enqueue "echo 'High priority'" --priority 10

```

| **Test Case**             | **Expected Outcome**                        |
| ------------------------- | ------------------------------------------- |
| Valid command             | Job completes successfully                  |
| Exit code 1               | Job retries 3 times, then moves to DLQ      |
| Invalid command           | Job fails, retries, and moves to DLQ        |
| Restart during processing | Job resumes after restart                   |
| Multiple workers          | Jobs processed concurrently without overlap |
