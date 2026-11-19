import { apiEnvSchema, type ApiEnv } from "@plexsol/shared";

export function loadApiEnv(
  source: NodeJS.ProcessEnv = process.env,
): ApiEnv {
  const parsed = apiEnvSchema.safeParse(source);

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid API environment: ${details}`);
  }

  return parsed.data;
}
