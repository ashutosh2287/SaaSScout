import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { createShutdownHandler, type ServerLike } from "../src/shutdown.js";

function stubServer(): ServerLike & {
  closedWith: Error | undefined;
  closeCalls: number;
  closeAllCalls: number;
} {
  const s: ServerLike & {
    closedWith: Error | undefined;
    closeCalls: number;
    closeAllCalls: number;
  } = {
    closeCalls: 0,
    closeAllCalls: 0,
    closedWith: undefined,
    close(cb?: (err?: Error) => void) {
      this.closeCalls += 1;
      // Stub: asynchronously call the callback with no error.
      setTimeout(() => cb?.(undefined), 0);
      return this;
    },
    closeAllConnections() {
      this.closeAllCalls += 1;
    },
  };
  return s;
}

describe("Graceful shutdown", () => {
  test("closes the server and then exits 0", async () => {
    const server = stubServer();
    const exits: number[] = [];
    const shutdown = createShutdownHandler(server, {
      exit: (code) => exits.push(code),
      forceTimeoutMs: 500,
    });
    shutdown("SIGTERM");
    await new Promise((r) => setTimeout(r, 20));
    assert.ok(server.closeAllCalls >= 1, "stops accepting new connections");
    assert.equal(server.closeCalls, 1);
    assert.deepEqual(exits, [0]);
  });

  test("second signal is a no-op (no duplicate shutdown)", async () => {
    const server = stubServer();
    const exits: number[] = [];
    const shutdown = createShutdownHandler(server, {
      exit: (code) => exits.push(code),
      forceTimeoutMs: 500,
    });
    shutdown("SIGINT");
    shutdown("SIGINT"); // duplicate
    shutdown("SIGTERM"); // duplicate
    await new Promise((r) => setTimeout(r, 20));
    assert.equal(server.closeCalls, 1, "server.close called exactly once");
    assert.deepEqual(exits, [0]);
  });

  test("close error leads to exit 1 (handled safely, no crash)", async () => {
    const server = stubServer();
    server.close = function (cb?: (err?: Error) => void) {
      this.closeCalls += 1;
      setTimeout(() => cb?.(new Error("boom")), 0);
      return this;
    } as ServerLike["close"];
    const exits: number[] = [];
    const shutdown = createShutdownHandler(server, {
      exit: (code) => exits.push(code),
      forceTimeoutMs: 500,
      errorLog: () => {},
    });
    shutdown("SIGTERM");
    await new Promise((r) => setTimeout(r, 20));
    assert.deepEqual(exits, [1]);
  });

  test("force-exits (1) if closing hangs past the timeout", async () => {
    // A stub whose close callback never fires simulates a hung server.
    const server = stubServer();
    server.close = function () {
      this.closeCalls += 1;
      return this; // never calls cb
    } as ServerLike["close"];
    const exits: number[] = [];
    const shutdown = createShutdownHandler(server, {
      exit: (code) => exits.push(code),
      forceTimeoutMs: 30,
      errorLog: () => {},
    });
    shutdown("SIGINT");
    await new Promise((r) => setTimeout(r, 60));
    assert.equal(server.closeAllConnections && exits.includes(1), true);
    assert.ok(exits.includes(1), "force-exited after timeout");
  });
});
