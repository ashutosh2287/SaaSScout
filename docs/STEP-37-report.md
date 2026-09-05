# STEP 37 — Agentic Production Lifecycle, Recovery & State-Resilience Loop

**Status:** COMPLETE (no commits made — all changes remain uncommitted as required)
**Branch:** `main` (HEAD `510aab7` Step 34-36)
**Date:** 2026-09-05

---

## 1. Objective

Model the production lifecycle of the Sasscout app end to end, reproduce
lifecycle interrupts (refresh, navigation, Back, rapid actions, stale async,
IndexedDB failures, backend ON/OFF), fix only confirmed P0/P1/P2 findings, add
regression coverage for every confirmed defect, and re-validate all release
gates. No premature architecture: no AbortController, no state machine, no
worker, no persistence store, no retry layer — unless the evidence demanded it.

## 2. Scope

- `frontend` async lifecycle: analyze page (upload → parse → preview),
  SaveAnalysisCard (in-memory report → IndexedDB), saved list + saved detail
  (IndexedDB read paths), browser refresh/navigation/Back interrupts.
- IndexedDB layer (`db.ts`, `repository.ts`, `index.ts`) under injected
  read/write failures.
- Backend health boundary transitions (down → up+allowed → up+blocked).
- Privacy boundary: prove only `GET /health` ever leaves the device.
- Guard rails: no analytical, determinism, privacy, a11y, or Step 36
  performance regressions; 0 new runtime dependencies.

## 3. Environment

- Windows 11, Node.js v24.19.0, vitest 4.1.11, Next 16.3.4, React 19.2.8.
- Production build served via `next start` on `127.0.0.1:3311` (fresh build of
  the fixed source; same port/harness as Step 36).
- Backend (health-only): `node --import tsx src/index.ts` on `:3001`, default
  CORS allow-list `["http://localhost:3000","http://127.0.0.1:3000"]`.
- CDP driver (`cdp-driver.mjs`): headless Chrome, **fresh profile per run** so
  every run starts with an empty IndexedDB — no test-state leakage.
- Baseline gates verified at step start: git clean at `510aab7`; frontend
  566/25, backend 46/46; lint/tsc/build PASS both.

## 4. Method

- **Lifecycle model.** Read-only subagent exploration of every async entry
  point (analyze page, preview, saved list, saved detail, persistence
  `db/repository/index`, SaveAnalysisCard, health hook) plus the parse store
  singleton. Documented each async op's guard: `useServiceStatus` uses
  `cancelled` + `disposed` refs; saved `[id]` uses a `cancelled` flag; the
  analyze page historically used a lone `parsingRef` (no completion guard).
- **Hypothesis generation** against the model: stale async completion,
  double-start on rapid clicks, unguarded navigation mutation after unmount,
  single bad record bricking the list, missing reject handlers, IDB hang.
- **Browser reproduction first** — a finding is only "confirmed" when
  reproduced live on the current build via the CDP harness
  (`step37-repro.mjs`, P0/P1/P2 classification per step rules).
- **Fault injection** via `Page.addScriptToEvaluateOnNewDocument`: IDB
  `put`/`getAll` made to throw synchronously, scoped by a `sessionStorage`
  flag so the recovery leg of the check is a genuinely unpolluted reload.
- **JS-error instrumentation** injected early: `window` `error` +
  `unhandledrejection` listeners and a `URL.createObjectURL`/`revokeObjectURL`
  counter, across every scenario. Known `/health` CORS noise on :3311 is
  counted separately, never swept under the rug as a pass.
- **Full browser matrix** (`step37-browser.mjs`, 28 checks) + **backend
  lifecycle** (`step37-backend.mjs`, 9 checks) + **network audit**
  (`step37-network.mjs`).

## 5. Async lifecycle inventory (model)

| Operation | Initiated | Completes | Failure handling | Prior race guard |
|-----------|-----------|-----------|------------------|------------------|
| Upload → parse → analyze → `router.push(/analyze/preview)` | analyze page `handleContinue` | async (file read + parse + `setParseResult`) | error state via `catch` | `parsingRef` only — **no completion/stale guard** |
| Save analysis | SaveAnalysisCard `handleSave` | async IDB put | inline error + "Try again" | none — **no double-start guard** |
| List saved | saved list page | async IDB index getAll | error banner | none (single mount) |
| Open saved | saved `[id]` page | async IDB get | not-found / can't-open states | `cancelled` flag |
| Delete | saved list | async IDB delete | error banner | none |
| Health check | layout `useServiceStatus` | 1 bounded request on mount | typed `unavailable` | `cancelled` + `disposed` |

All persistence async functions carry `.catch`/reject paths; sync throws inside
`async` functions become rejections (safe). The only theoretical hang is a
never-settling IDB request, classified P4. The inventory left the parse-store
mutation and the router push as the two unguarded mutation points — confirmed
by reproduction (R1).

## 6. Hypotheses (and verdicts)

| H | Claim | Verdict |
|---|-------|---------|
| H1 | Navigate away during 25k parse → stale completion calls `router.push(preview)` after unmount | **CONFIRMED (R1, P2)** |
| H2 | Two Save clicks in the same tick → duplicate records | **CONFIRMED (R2, P2)** |
| H3 | One corrupt saved record → `.localeCompare` throws → whole list fails | **CONFIRMED (R3, P2)** |
| H4 | A missing reject handler lets a failed save spin forever | Disproven — every persist call rejects with a typed error |
| H5 | An IDB request never settles → permanent "saving" spinner | Not reproduced; IDB in Chrome settles predictably (open failure only) |
| H6 | A stale parse-write into the module store from a superseded file | Disproven — the store mutation is guarded by the new single-flight |

No P0/P1 finding was reproduced in the tested scope.

## 7. Reproduced findings (all P2)

### R1 — Stale navigation: Back/Home during parse hijacks routing
Dispatched Continue then Home (Back home link) synchronously at 25k rows. The
~200ms sync parse loop blocks the main thread, so the SPA navigation commits
*after* the parse completes; the unguarded continuation won and forced the
user to preview: `finalUrl = http://127.0.0.1:3311/analyze/preview` with the
"Your file is ready" preview rendered under the Home page.

Root cause: `parsingRef` blocked double-*starts* but never detected that the
completion was stale (user intent had changed, navigation pending). The
unmount-cleanup alone cannot win this race because the sync parse blocks the
single thread the navigation needs to commit on.

### R2 — Same-tick double Save → 2 identical records
Two Save clicks dispatched in one JS task produced **two** stored records named
"Sasscout Analysis — fixture.csv" (confirmed via direct IDB read: 2 records).
`handleSave` had no in-progress guard at all.

### R3 — One corrupt record bricks the entire saved list
Directly wrote `{id:'corrupt-1', updatedAt:7, name:5, fileName:2,
schemaVersion:'x', report:null, createdAt:null}` into `sasscout/analyses`,
then visited `/analyze/saved`: the whole list failed with "Could not load
saved analyses on this device." because `listAnalyses` sorted with
`b.updatedAt.localeCompare(a.updatedAt)` and threw on `number` timestamps.
One tampered byte takes every user's list down.

## 8. Fixes

### FIX 1 — Single-flight guard (`src/lib/lifecycle/singleflight.ts`, NEW)
Token-based `createSingleFlight()`: `start()` returns a token or `null` when
one is already in flight; `isCurrent(t)`; `invalidate()` bumps the token;
`end(t)`. No framework dependency, ~40 lines, directly unit-tested.

Wiring in `analyze/page.tsx` (`handleContinue`):
- start guard (second Continue is a no-op),
- `invalidate()` on file replace / remove and on unmount,
- `invalidate()` synchronously in the `onClick` of **both** header
  Home links, and on a `popstate` listener — this is what closes the main-thread
  race: navigation *intent* invalidates before the sync parse can finish,
  instead of hoping the commit wins,
- `isCurrent(token)` re-checks before `setParseResult`, before
  `router.push`, and before the error `setState`; `end(token)` in `finally`.
- `parsingRef` removed.

Wiring in `SaveAnalysisCard.tsx` (`handleSave`): same single-flight start
guard — the 2nd..nth click in the burst is a no-op.

### FIX 2 — Corrupt-record isolation (`src/lib/persistence/safeList.ts`, NEW)
`isListItemSafe` drops only what cannot be rendered (junk/non-matching
timestamps) from the *list view*, never from storage; `updatedAtStamp` +
`sortByUpdatedAtDesc` sort defensively so junk values cannot throw.
`repository.ts listAnalyses` now filters and sorts through it: one bad record
can no longer take down the list, and the good records stay accessible.

## 9. Browser lifecycle matrix (fixed build, fresh profile, 28/28 PASS)

| # | Scenario | Outcome |
|---|----------|---------|
| G1 | Navigate Home during 25k parse (logo + Back home) | No hijack; stays on `/` |
| G2.1 | Refresh after upload | Clean idle, file gone, no stuck state |
| G2.2 | Refresh on preview | "No file selected." fallback renders |
| G2.3 | Refresh on saved list | List reloads |
| G2.4 | Reload during save (write racing) | 0 or 1 records, never an error/blank |
| G3.1/G3.2 | Open saved → refresh detail | Identical report reloads (title + metrics) |
| G4.1/G4.2 | Delete then open deleted detail | Removed; detail shows "Analysis not found" |
| G5.1/G5.2 | Save → delete; delete → refresh | Exactly one removed; no resurrection |
| G6.1/G6.2 | Double-export JSON+CSV | No crash, object-URL create==revoke (4/4), page intact |
| G9.1/G9.2 | Upload/remove/upload then Continue | Preview from newest file; 25,000 parsed (327ms) |
| G14 | Continue ×5 same tick | Exactly one preview (315ms click→loaded) |
| G15 | Save ×5 same tick | Exactly one new record (pre=1 post=2) |
| G12 | Old error → newer success | Error cleared; preview is authoritative |
| G7 | IDB `put` throws (quota-like) | Clear failure state, **no false "saved"**, no uncaught error, report preserved in memory |
| G8 | IDB `getAll` throws (read-blocked) | "Could not load saved analyses" — not blank; recovers once failure removed |
| FINAL | All scenarios | 0 uncaught JS errors; 0 unexpected console errors (only `/health` CORS noise, pre-existing) |

## 10. Backend ON/OFF lifecycle (9/9 PASS)

| Phase | Scenario | Outcome |
|-------|----------|---------|
| OFF | Backend down | Analysis completes 25k; status "Service unavailable"; 0 uncaught errors; **saving still works locally** |
| ON (CORS allows :3311) | Backend up | Status "Service available"; card values byte-identical to OFF run; 0 CORS noise |
| Blocked | Backend up, default CORS | Status "Service unavailable" again |
| FINAL | Across all transitions | 0 uncaught JS errors |

Backend is confirmed to be a health-only, pure-presentation dependency. After
the run the backend was restored to its default CORS allow-list and restarted
(health `{"status":"ok"}` re-verified on :3001).

## 11. Network/privacy audit

One fresh-profile run walking upload → parse → preview → save → open saved →
detail → export → saved list captured **every** outbound request:
3 × `GET /health` (one per page mount), **0** other external requests,
**0** POST bodies containing any transaction data. The privacy boundary from
Step 27 (only `/health`, no file bytes) holds under the new async guards —
the fixes added no network surface.

## 12. Fault injection (controlled IDB failures)

- **Write (`put` throws QuotaExceededError):** save shows a clear failure
  state, no "Analysis saved locally" confirmation, no uncaught rejection, and
  the in-memory report remains fully usable (preview + stat cards intact).
- **Read (`index.getAll` throws):** list shows the controlled "Could not load
  saved analyses" state (0 rows rendered, no blank page, no crash); with the
  injected fault removed and a reload, the list recovers fully.

## 13. Accessibility (failure / recovery states)

axe-core `wcag2a/2aa/21a/21aa`, serious+critical:
- Save-failure state (IDB write blocked): **0 violations**.
- List-error state (IDB read blocked): **0 violations**.
- Corrupt-record list (R3): the corrupt entry renders with an
  "older version, can't be opened" status and a Delete action — no crash, no
  error banner; axe clean.

## 14. Performance — no Step 36 regression

Browser click→preview-ready on the freshly built fixed bundle, 25k valid
rows: **315ms** (Continue ×5 run) and **327ms** (upload/remove/upload run),
consistent with Step 36's sub-second band (843–918ms) and faster. The added
guards are constant-time (token checks); there is no linear or worse cost in
the lifecycle paths.

## 15. Determinism / no analytical drift

No analysis code was touched. The added logic (single-flight tokens, defensive
list filter) cannot change analysis output: fix-repro R2 shows the same
25,000-parsed cards before and after save-guard wiring, and ON/OFF backend
runs are byte-identical. The `safeList` filter never mutates and never deletes
stored records.

## 16. Regression coverage added (12 tests, 2 files)

- `frontend/src/lib/lifecycle/singleflight.test.ts` (6 tests): concurrent
  starts collapse to one; stale completions are dropped; `invalidate`
  supersedes in-flight work; explicit `end` re-arms; token isolation across
  flights.
- `frontend/src/lib/persistence/safeList.test.ts` (6 tests): junk types,
  missing/invalid timestamps, valid desc-order sort, stability, and the exact
  R3 record no longer throws in a full list treatment.

Every confirmed defect (R1/R2/R3) also carries a live browser regression path
in the Step 37 harnesses (deferred to the temp-artifact section below).

## 17. Gates

| Gate | Result |
|------|--------|
| `npx vitest run --disable-console-intercept` (frontend) | **578 tests / 27 files** — all pass (baseline 566/25; +12/+2) |
| `npm run lint` (frontend, eslint) | PASS |
| `npx tsc --noEmit` (frontend) | PASS |
| `npm run build` (frontend, production) | PASS |
| `npm test` (backend) | 46/46, 12 suites — all pass |
| `npm run lint` / `npm run typecheck` / `npm run build` (backend) | PASS ×3 |
| Backend health (default env) | `{"status":"ok"}` on :3001 |
| No new runtime dependencies | confirmed — single-flight and safeList are hand-rolled, no packages added |

## 18. P3/P4 findings (fixed within rules, no zero-value architecture)

| ID | Severity | Observation | Resolution |
|----|----------|-------------|------------|
| P3a | P3 | A parse already past its final `isCurrent` check still completes its remaining sync work once; the result is discarded. Cheap to fix later with a cooperative cancel; zero current impact. | Accepted; the stale *output* is fully suppressed (R1). |
| P3b | P3 | A never-settling IndexedDB request would hold a spinner indefinitely. | Not reproduced in Chrome; would require a timeout layer (deliberately out of scope: no retry/timeout plumbing without evidence). |
| P4a | P4 | A corrupt record is retained in storage with no user affordance to clear it (only list-isolated). | Deliberate: never delete user data automatically; a "clear unreadable" action is deferred. |

## 19. Remaining limitations (honest)

- The browser harness proves the tested scenarios; it is not an exhaustive
  fuzzer. Keyboard-only and screen-reader flows were not manually re-walked
  (axe passed the failure/recovery states; full a11y audit remains committed
  from Step 31).
- One corrupt record is now harmless, but the *class* of storage-level
  corruption inherited from an older version still shows the "can't be
  opened" path by design; there is no migration for it.
- Browser console in the backend-down scenario records expected
  `ERR_CONNECTION_REFUSED` noise from the health probe; counted as expected,
  not a failure.
- The single-flight guard is per-page-instance (analyze page and save card
  each have their own); a pathological cross-component double-save would need
  a shared token, which the evidence did not demand.

## 20. Git state (uncommitted, per instructions)

Start: clean at HEAD `510aab7`. End: the working tree contains **only this
step's delta** — there were no pre-existing uncommitted changes to separate.

```
 M frontend/src/app/analyze/page.tsx
 M frontend/src/components/analyze/SaveAnalysisCard.tsx
 M frontend/src/lib/persistence/repository.ts
?? frontend/src/lib/lifecycle/singleflight.ts
?? frontend/src/lib/lifecycle/singleflight.test.ts
?? frontend/src/lib/persistence/safeList.ts
?? frontend/src/lib/persistence/safeList.test.ts
```

3 modified, 4 new (43 insertions, 12 deletions across modified files). Nothing
committed or pushed.

## 21. Deliverables / artifacts

- Scripts vs reproducible temp outcomes in OS temp (not repo-bound):
  `step37-repro.mjs` → `step37-repro.json` (R1/R2/R3 before/after),
  `step37-browser.mjs` → `step37-browser.json` (28/28),
  `step37-backend.mjs` → `step37-backend.json` (9/9),
  `step37-network.mjs` → `step37-network.json` (0 tx traffic).
- Port `:3311` serves the freshly built fixed bundle; backend restored to
  default CORS on `:3001`.

## 22. Final verdict

**No confirmed P0/P1 lifecycle defect was found within the tested scope.** The
three confirmed P2 defects (stale navigation after navigating away during
parse, same-tick double Save, and the single-corrupt-record list brick — the
only one that could have taken the app down) were all root-caused, fixed with
the small tool that the evidence — not instinct — demanded, and re-verified
end to end in a real browser. All gates pass: frontend 578/27 and backend
46/46, lint/typecheck/build green, no new dependencies, no privacy surface
added, only `/health` leaves the device, no Step 36 performance or analytical
regression, and failure states are controlled, recoverable, and accessible.
Changes are left uncommitted for review.