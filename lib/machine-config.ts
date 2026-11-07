export function machineConfig(timeScale = Number(process.env.TIME_SCALE ?? "1")) {
  if (!Number.isFinite(timeScale) || timeScale <= 0) {
    throw new Error("TIME_SCALE must be a positive number, such as 1 or 22.5.");
  }
  // Single source of truth. Speed changes elapsed-time requirements, not amplitude.
  return {
    RUN_THRESHOLD: 0.2,
    RUN_CONFIRM_MS: (20 * 1000) / timeScale,
    MIN_RUN_MS: (8 * 60 * 1000) / timeScale,
    QUIET_CONFIRM_MS: (3 * 60 * 1000) / timeScale,
    TIME_SCALE: timeScale,
    // Network tolerance stays in real time: devices report every ~2 seconds.
    MAX_READING_GAP_MS: 10_000,
    DEMO_CYCLE_MS: (45 * 60 * 1000) / timeScale,
    DEMO_PAUSE_MS: (60 * 1000) / timeScale,
    DEMO_POLL_MS: Math.min(2000, (5 * 1000) / timeScale),
  } as const;
}

export const MACHINE_CONFIG = machineConfig();
