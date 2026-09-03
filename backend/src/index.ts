import { serve } from "@hono/node-server";
import { app, REQUEST_ID_HEADER } from "./app.js";
import { createShutdownHandler } from "./shutdown.js";

const port = Number(process.env.PORT) || 3001;
const host = process.env.HOST;

const server = serve(
  { fetch: app.fetch, port, hostname: host },
  (info) => {
    console.log(
      `Sasscout backend listening on http://${info.address}:${info.port}`,
    );
  },
);

// Graceful shutdown: handle SIGINT/SIGTERM, stop accepting new connections,
// let in-flight requests finish, and force-exit if closing hangs. Duplicate
// signals are no-ops. Never logs request bodies or sensitive data.
const shutdown = createShutdownHandler(server, {
  forceTimeoutMs: 10_000,
});

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

export { REQUEST_ID_HEADER };
