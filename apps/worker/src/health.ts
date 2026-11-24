import { createServer, type Server } from "node:http";
import { prisma } from "@plexsol/database";
import {
  healthResponseSchema,
  readinessResponseSchema,
} from "@plexsol/shared";

const VERSION = process.env.npm_package_version ?? "0.1.0";

/**
 * Lightweight health HTTP server for managed hosting probes.
 * Does not share Express — worker remains a separate process.
 */
export function startWorkerHealthServer(port: number): Server | null {
  if (!port || port <= 0) {
    return null;
  }

  const server = createServer(async (req, res) => {
    const url = req.url?.split("?")[0] ?? "/";

    if (url === "/health") {
      const payload = healthResponseSchema.parse({
        status: "ok",
        service: "plexsol-worker",
        timestamp: new Date().toISOString(),
        version: VERSION,
      });
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(payload));
      return;
    }

    if (url === "/health/ready") {
      let database: "up" | "down" = "down";
      let detail: string | undefined;
      try {
        await prisma.$queryRaw`SELECT 1`;
        database = "up";
      } catch (error) {
        detail =
          error instanceof Error ? error.message : "Database check failed";
      }
      const payload = readinessResponseSchema.parse({
        status: database === "up" ? "ok" : "error",
        service: "plexsol-worker",
        timestamp: new Date().toISOString(),
        version: VERSION,
        checks: { database },
        ...(detail ? { detail } : {}),
      });
      res.writeHead(database === "up" ? 200 : 503, {
        "content-type": "application/json",
      });
      res.end(JSON.stringify(payload));
      return;
    }

    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "not_found" }));
  });

  server.listen(port, "0.0.0.0", () => {
    console.log(`[worker] Health listening on http://0.0.0.0:${port}/health`);
  });

  return server;
}
