import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import { createApp } from "./app.js";
import { loadApiEnv } from "./env.js";

const rootEnv = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../.env",
);
loadEnv({ path: rootEnv });

const env = loadApiEnv();
const app = createApp(env);

const server = app.listen(env.API_PORT, env.API_HOST, () => {
  console.log(
    `[api] Plexsol Business Manager listening on http://${env.API_HOST}:${env.API_PORT}`,
  );
  console.log(`[api] Health check: http://localhost:${env.API_PORT}/health`);
});

const shutdown = (signal: string) => {
  console.log(`[api] Received ${signal}, shutting down...`);
  server.close(() => {
    process.exit(0);
  });
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
