/**
 * Background tick placeholder for Phase 1.
 * Reminder / email job processing is introduced in later phases.
 */
export async function runWorkerTick(): Promise<void> {
  const timestamp = new Date().toISOString();
  console.log(`[worker] Idle tick at ${timestamp}`);
}
