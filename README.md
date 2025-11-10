# ⚙️ QueueCTL - Background Job Queue CLI

QueueCTL is a **minimal, production-ready background job queue system** built with **Node.js** and **MongoDB**, designed as part of the *QueueCTL Backend Developer Internship Assignment*. It provides a **CLI-based interface** for managing background jobs, worker processes, retries, and a **Dead Letter Queue (DLQ)**.


---

## 🎥 Demo Video

📹 [Watch Demo on Google Drive](https://drive.google.com/file/d/1vi9oee49Fhl_3JnLNj7RLwTiuPCHG6fG/view?usp=drive_link)

---

## 🧠 Overview

This project implements a job queue system that:

* Enqueues and manages background jobs
* Executes them using multiple worker processes
* Handles retries using exponential backoff
* Moves permanently failed jobs to a Dead Letter Queue (DLQ)
* Persists job data across restarts

All operations are accessible through a **command-line interface (CLI)**.

---

## 🛠 Tech Stack

* **Language:** Node.js
* **Database:** MongoDB (for job persistence)
* **CLI Framework:** Commander.js
* **Libraries Used:** child_process (for job execution), mongoose (for DB)

---

## ⚡ Setup Instructions

### Prerequisites

* Node.js v14 or higher
* MongoDB (local or cloud instance)

### Installation

```bash
# Clone repository
git clone https://github.com/<your-username>/queuectl.git
cd queuectl

# Install dependencies
npm install

# Configure MongoDB URI in the code (if not already done)
# Example:
# const MONGODB_URI = 'mongodb://localhost:27017/queuectl';

# Start MongoDB service
mongod --dbpath=/data/db

# Link CLI globally (optional)
npm link
```

---

## 🧩 CLI Commands & Usage Examples

### Enqueue Jobs

```bash
queuectl enqueue "echo 'Hello QueueCTL'"
queuectl enqueue '{"id":"job1","command":"sleep 2"}'
```

### Start Workers

```bash
queuectl worker start --count 3
```

### Stop Workers

```bash
queuectl worker stop
```

### Check Status

```bash
queuectl status
```

### List Jobs

```bash
queuectl list --state pending
queuectl list --state completed
queuectl list --state failed
```

### Dead Letter Queue

```bash
queuectl dlq list
queuectl dlq retry <job_id>
queuectl dlq delete <job_id>
queuectl dlq clear
```

### Configuration Management

```bash
queuectl config get
queuectl config set max-retries 5
queuectl config set backoff-base 3
```

---

## 🔄 Job Lifecycle

| State      | Description                      |
| ---------- | -------------------------------- |
| pending    | Waiting for worker to pick up    |
| processing | Currently executing              |
| completed  | Executed successfully            |
| failed     | Failed but retryable             |
| dead       | Permanently failed, moved to DLQ |

**Job Retry Mechanism:**
If a job fails, it’s retried using an **exponential backoff** formula:

```
delay = base ^ attempts
```

Default values:
`base = 2`, `max_retries = 3`

---

## 💾 Data Persistence

Jobs are stored in MongoDB and persist across system restarts. Example schema:

```js
{
  id: String,
  command: String,
  state: String, // pending | processing | completed | failed | dead
  attempts: Number,
  max_retries: Number,
  created_at: Date,
  updated_at: Date,
  output: String,
  error: String
}
```

---

## ⚙️ Worker Logic

* Each worker polls MongoDB for jobs with state `pending`.
* Job is atomically locked using `findOneAndUpdate()`.
* Executes the command using `child_process.exec`.
* On success → marks job `completed`.
* On failure → retries with backoff until max retries.
* If all retries fail → moved to DLQ.
* On shutdown → finishes current job before exit.

---

## 🧪 Testing Instructions

### Manual Testing

Open two terminals:

**Terminal 1:**

```bash
queuectl worker start --count 2
```

**Terminal 2:**

```bash
queuectl enqueue "echo 'Test successful job'"
queuectl enqueue "exit 1"   # failed job
queuectl enqueue "invalidcommand"   # DLQ test
```

**Expected Behavior:**

| Case            | Result                      |
| --------------- | --------------------------- |
| Successful job  | Completes normally          |
| Failed job      | Retries thrice with backoff |
| Invalid command | Moves to DLQ                |

---

## 🧩 Architecture Overview

```
   +----------+        +----------------+           +----------+
   |  Client  |  --->  | CLI / Operator |  --->     | Job Store|
   | (you)    |        | (queuectl)     |           | (MongoDB)|
   +----------+        +----------------+           +-----+----+
                                                          |
                                                          v
                                                    +-----+------+
                                                    | Job Manager|
                                                    | - Scheduler|
                                                    | - Locking  |
                                                    +-----+------+
                                                          |
                                +-------------------------+-------------------------+
                                |                                                   |
                                v                                                   v
                       +------------------+                               +------------------+
                       | Worker Pool      |                               | Retry Engine     |
                       | (N workers)      |                               | - Backoff calc   |
                       | - Lock & exec    |                               | - Retry policy   |
                       +--------+---------+                               +--------+---------+
                                |                                                   |
                                |                                                   v
                                |                                         +------------------+
                                |                                         | Dead Letter Queue|
                                |                                         | (DLQ collection) |
                                v                                         +------------------+
                        +---------------+
                        | Command Exec  |
                        | child_process |
                        +---------------+

```
### Component Responsibities
* CLI / Operator: Entry point for user commands (enqueue, worker, list, config, dlq).
* Job Store (MongoDB): Stores all job data, states, attempts, and timestamps with atomic updates.
* Job Manager: Handles job lifecycle — enqueue, lock, retry, DLQ transition.
* Worker Pool: Executes jobs in parallel, updates job status, and prevents duplicate processing.
* Retry Engine: Applies exponential backoff (delay = base ^ attempts) for failed jobs.
* DLQ: Holds jobs that exceed retry limits; supports retry or delete actions.
* Command Executor: Runs shell commands via child_process.exec, captures output or errors.
---

## 🔄 Job Lifecycle
    ┌──────────┐
    │ PENDING  │
    └────┬─────┘
         │ Worker picks up
         ▼
    ┌────────────┐
    │ PROCESSING │
    └─────┬──────┘
          │
       ___|_____________
      │ Success        │ Failure
      ▼                ▼
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
               

---

## 🧑‍🔬 Testing Script

A test file `test/test.js` verifies key functionalities:

```bash
node test/test.js
```

It validates enqueueing, retries, DLQ movement, and persistence.


## ✅ Submission Summary

* ✔️ CLI tool with enqueue, worker, list, DLQ, and config commands
* ✔️ Retry and exponential backoff implemented
* ✔️ MongoDB-based persistence
* ✔️ DLQ handling
* ✔️ Configurable max retries and backoff
* ✔️ Tested manually via CLI

---

**Author:** Vishal Kumar Sharma
📧 [vksharma11235@gmail.com](mailto:vksharma11235@gmail.com)
