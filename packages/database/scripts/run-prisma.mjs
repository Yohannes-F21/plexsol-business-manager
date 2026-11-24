/**
 * Prisma CLI wrapper that loads the monorepo root `.env` first (DEF-FS-11).
 * Example: node ./scripts/run-prisma.mjs migrate status
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
await import(pathToFileURL(path.join(here, "load-root-env.mjs")).href);

const args = process.argv.slice(2);
const result = spawnSync("prisma", args, {
  stdio: "inherit",
  shell: true,
  env: process.env,
  cwd: path.resolve(here, ".."),
});

process.exit(result.status ?? 1);
