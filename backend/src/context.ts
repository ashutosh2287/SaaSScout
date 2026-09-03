/**
 * Shared Hono app environment (STEP 30).
 *
 * Centralizes the context-variable typing so every middleware and handler sees
 * the same shape. Only app-scoped, non-sensitive correlation data lives here.
 */
import { Hono } from "hono";

export type AppEnv = {
  Variables: {
    /** Fresh per-request correlation ID (crypto.randomUUID). Never user data. */
    requestId: string;
  };
};

export function createHono(): Hono<AppEnv> {
  return new Hono<AppEnv>();
}
