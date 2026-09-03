/**
 * Privacy & data-flow page content (STEP 28).
 *
 * Single source of truth for the copy on the /privacy page. Kept as plain
 * typed data so it can be rendered by a static server component and asserted
 * by a focused regression test (see safety.test.ts) that blocks unsupported
 * privacy claims and forbidden trust language.
 *
 * Every statement here is grounded in the codebase as it exists today:
 *  - parseFile reads files via browser APIs (file.text()/arrayBuffer()).
 *  - All analysis runs client-side.
 *  - Exports are generated with Blob + URL.createObjectURL locally.
 *  - Saved analyses persist in browser-local IndexedDB.
 *  - The only outbound network call is GET /health with no body (src/lib/api).
 * If the architecture changes, this copy must be updated to match.
 */

export const privacy = {
  pageTitle: "How your data stays private",

  intro: [
    "Sasscout is designed to keep transaction data on your device. This page explains, in plain language, where your data is processed and what — if anything — is sent to the backend.",
  ],

  transactionPath: {
    heading: "What happens to a transaction file",
    steps: [
      {
        title: "You choose a file",
        body: "You select a CSV or XLSX transaction file in the analyze flow.",
      },
      {
        title: "The file is read in your browser",
        body: "The file is opened and parsed locally, in your browser.",
      },
      {
        title: "Analysis happens locally",
        body: "Sasscout derives merchant, classification, recurring, software, and review information on this device.",
      },
      {
        title: "Optional local save",
        body: "The resulting report can be saved in this browser's local IndexedDB storage.",
      },
      {
        title: "Optional local export",
        body: "CSV and JSON exports are generated locally and downloaded by your browser.",
      },
    ],
    note: "None of these steps upload your transaction file, transaction rows, or reports to a Sasscout server.",
  },

  backend: {
    heading: "What goes to the backend",
    intro:
      "Currently, Sasscout only contacts the backend for a service health check.",
    requestBadge: "GET /health",
    bullets: [
      "It is a single service-health request.",
      "It contains no transaction file.",
      "It contains no transaction rows.",
      "It contains no report.",
      "It contains no merchant transaction history.",
      "It contains no analysis payload.",
      "The health response is only a service-status response, such as { \"status\": \"ok\" }.",
    ],
    closing:
      "The backend does not receive transaction data. The service check is kept separate from transaction-data processing.",
  },

  storage: {
    heading: "What is stored",
    intro:
      "Saved analyses are stored locally on this device, in your browser's IndexedDB storage.",
    bullets: [
      "Storing and reopening an analysis does not involve the backend.",
      "Deleting a saved analysis removes it from this browser's local storage.",
    ],
    note:
      "Local browser storage is per-browser and per-device. It is not a backup or a server-side store, and no retention period is managed by Sasscout.",
  },

  notImplemented: {
    heading: "What Sasscout does not currently do",
    intro: "The current product does not use:",
    items: [
      "cloud transaction storage",
      "user accounts or authentication",
      "server-side transaction processing",
      "AI or LLM processing of transactions",
      "payment integrations",
      "analytics or telemetry for transaction data",
    ],
    closing: "This can change as the product evolves; this page will be updated to match.",
  },
};
