import { loadWorkerEnv } from "./env.js";
import { runWorkerTick } from "./tick.js";

const env = loadWorkerEnv();

if (!env.WORKER_ENABLED) {
  console.log("[worker] WORKER_ENABLED=false — exiting.");
  process.exit(0);
}

console.log(
  `[worker] Plexsol Business Manager worker started (poll every ${env.WORKER_POLL_INTERVAL_MS}ms)`,
);
console.log(
  "[worker] Phase 1 foundation only — job processors will be added in later phases.",
);

let tickInFlight = false;

const schedule = async () => {
  if (tickInFlight) {
    return;
  }

  tickInFlight = true;
  try {
    await runWorkerTick();
  } catch (error) {
    console.error("[worker] Tick failed:", error);
  } finally {
    tickInFlight = false;
  }
};

void schedule();
const interval = setInterval(() => {
  void schedule();
}, env.WORKER_POLL_INTERVAL_MS);

const shutdown = (signal: string) => {
  console.log(`[worker] Received ${signal}, shutting down...`);
  clearInterval(interval);
  process.exit(0);
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
