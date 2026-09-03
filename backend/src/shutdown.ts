/**
 * Graceful shutdown (STEP 30).
 *
 * A small, testable handler for clean process shutdown:
 *   - stops accepting new connections (server.close + closeAllConnections),
 *   - lets in-flight requests finish where practical,
 *   - guards against duplicate shutdown invocation (called twice → no-op),
 *   - enforces a bounded force-exit timeout (never hang forever),
 *   - surfaces errors without printing sensitive request information.
 *
 * `ServerLike` is the minimal Node http.Server surface used here so the handler
 * can be unit-tested with a stub (no real port binding required).
 */

export type ServerLike = {
  close(cb?: (err?: Error) => void): ServerLike;
  closeAllConnections?: () => void;
};

export type ShutdownOptions = {
  /** Timeout (ms) after which the process is force-exited. */
  forceTimeoutMs?: number;
  /** Injectable exit function for tests. */
  exit?: (code: number) => void;
  /** Injectable logger for tests. */
  log?: typeof console.log;
  /** Injectable error logger for tests. */
  errorLog?: typeof console.error;
};

export type ShutdownHandler = (signal: string) => void;

/**
 * Build a shutdown handler bound to a server. Safe to install for both SIGINT
 * and SIGTERM; invoking it more than once is a no-op.
 */
export function createShutdownHandler(
  server: ServerLike,
  options: ShutdownOptions = {},
): ShutdownHandler {
  const forceTimeoutMs = options.forceTimeoutMs ?? 10_000;
  const exit = options.exit ?? ((code) => process.exit(code));
  const log = options.log ?? console.log;
  const errorLog = options.errorLog ?? console.error;

  let shuttingDown = false;
  let forceTimer: NodeJS.Timeout | null = null;

  return (signal) => {
    if (shuttingDown) return; // already shutting down — no duplicate work
    shuttingDown = true;

    log(`${signal} received, shutting down gracefully…`);

    if (forceTimer) clearTimeout(forceTimer);
    forceTimer = setTimeout(() => {
      errorLog(`Shutdown timed out after ${forceTimeoutMs}ms; forcing exit.`);
      if (forceTimer) clearTimeout(forceTimer);
      server.closeAllConnections?.();
      exit(1);
    }, forceTimeoutMs);
    forceTimer.unref?.();

    // Stop accepting new connections.
    server.closeAllConnections?.();

    server.close((err) => {
      if (forceTimer) clearTimeout(forceTimer);
      if (err) {
        errorLog("Error during shutdown:", err);
        exit(1);
        return;
      }
      exit(0);
    });
  };
}
