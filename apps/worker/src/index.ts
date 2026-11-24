import { loadWorkerEnv } from "./env.js";
import { startWorkerHealthServer } from "./health.js";
import { runWorkerTick } from "./tick.js";

const env = loadWorkerEnv();

if (!env.WORKER_ENABLED) {
  console.log("[worker] WORKER_ENABLED=false — exiting.");
  process.exit(0);
}

console.log(
  `[worker] Plexsol Business Manager worker started (poll every ${env.WORKER_POLL_INTERVAL_MS}ms)`,
);

const healthServer = startWorkerHealthServer(env.WORKER_HEALTH_PORT);

let tickInFlight = false;

const schedule = async () => {
  if (tickInFlight) {
    return;
  }

  tickInFlight = true;
  try {
    await runWorkerTick(env);
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
  healthServer?.close();
  process.exit(0);
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
