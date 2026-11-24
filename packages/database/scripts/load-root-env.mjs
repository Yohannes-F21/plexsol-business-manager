/**
 * Loads repo-root `.env` before Prisma CLI commands (DEF-FS-11 / DEF-P2-03).
 * Usage: node --import ./scripts/load-root-env.mjs ../../node_modules/prisma/build/index.js …
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";

const here = path.dirname(fileURLToPath(import.meta.url));
const rootEnv = path.resolve(here, "../../../.env");
const localEnv = path.resolve(here, "../.env");

loadEnv({ path: rootEnv });
loadEnv({ path: localEnv });
