import { workerEnvSchema, type WorkerEnv } from "@plexsol/shared";

export function loadWorkerEnv(
  source: NodeJS.ProcessEnv = process.env,
): WorkerEnv {
  const parsed = workerEnvSchema.safeParse(source);

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid worker environment: ${details}`);
  }

  return parsed.data;
}
