// Single-slot in-flight operation guard. A stale completion (a parse, a save)
// must never commit once its operation has been superseded by a newer one or
// the owning component has unmounted. Framework-free so the ordering semantics
// are deterministically unit-testable without a DOM.

export function createSingleFlight() {
  let token = 0;
  let active = false;

  return {
    // Begins an operation if none is running. Returns a token to pass to
    // isCurrent/end, or null when another operation holds the slot (double
    // action in the same tick must not start twice).
    start(): number | null {
      if (active) return null;
      active = true;
      token += 1;
      return token;
    },
    // True only while `t` is the current, still-running operation.
    isCurrent(t: number): boolean {
      return active && t === token;
    },
    // Supersedes the running operation (file replaced, component unmounted).
    invalidate(): void {
      active = false;
      token += 1;
    },
    // Closes the slot, but only if this token still owns it, so finishing a
    // superseded operation can never free a newer operation's slot.
    end(t: number): void {
      if (t === token) active = false;
    },
  };
}

export type SingleFlight = ReturnType<typeof createSingleFlight>;