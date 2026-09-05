# SmartScript Exam OS

A student exam workspace built with Tauri 2, React 19, TypeScript, Tailwind CSS, React Router and TanStack Query. The interface follows [KenolTech](https://kenol.tech/)'s navy and pale-blue palette, Geist typography and rounded controls. Fonts and assets are bundled locally.

## Run the MVP

Requires Node.js **22.18+** (Node 24 recommended).

```bash
npm ci
npm run dev:mock
```

Open **http://127.0.0.1:1420**.

| Demo student                   | Access code |
| ------------------------------ | ----------- |
| `GCTU-CS-001` — Kelvin Lamptey | `A7K2`      |
| `GCTU-CS-002` — Ama Mensah     | `B8L3`      |

Choose **View exam → read instructions → Start exam**. The OOAD exam includes MCQ, short text, long text, numeric and Java code questions. Other cards demonstrate upcoming and closed exams. Calculator and scratchpad are available in the workspace; only backend-permitted tools appear inside an exam.

The mock is a separate HTTP service at `http://127.0.0.1:43100/v1`. It persists sessions, answers, revisions, attempt deadlines and submission receipts to `.mock-data/state.json`. Refreshing the UI or restarting the service restores confirmed work. Demo data contains no grading materials.

## Run the desktop application

Install Rust and the [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/) for your platform. Linux needs GTK 3 and WebKitGTK 4.1 development libraries. In separate terminals:

```bash
npm run mock
```

```bash
npm run desktop
```

Tauri starts the frontend dev server. The desktop shell does **not** launch or bundle a backend; the local Exam OS service is a separate process in deployment. Window close waits for answer saves and stays open if saving fails or submission remains uncertain. Browser reload/close prompts when work is unconfirmed; browsers cannot guarantee completion of asynchronous writes after a forced close.

Build a Linux Debian package:

```bash
npm run tauri -- build --bundles deb
```

Outputs live in `src-tauri/target/release/bundle/deb/`. `npm run desktop:build` builds the configured Linux bundle targets. For another desktop platform, set the appropriate bundle targets in `src-tauri/tauri.conf.json` and build on that platform.

## Offline development and service recovery

```bash
npm run mock:offline
# In another terminal:
npm run dev
```

This simulates **Internet** loss while leaving the local service available. All saves and final submission continue to work. Send `kill -USR2 <mock-pid>` using the PID printed by the mock to toggle simulated Internet connectivity. Queued work then transitions to simulated sync. No external cloud calls are made.

Stopping the local service is a different failure: the UI explicitly reports unconfirmed work, retains the current draft, and prevents navigation until a retry succeeds. Restart the service and use **Retry**. Session expiry opens a sign-in dialog for the same student without discarding the current draft.

To start a fresh demo or regenerate dates, stop the existing mock, then:

```bash
npm run mock:reset
```

This **archives** the previous store to `.mock-data/state.backup-<timestamp>.json` before creating fresh data and starting the mock. Never run two mock instances against the same data directory. To restore an archive, stop the mock and move the chosen backup to `state.json`, first preserving the current store.

## Backend integration

All frontend requests are centralized in [`src/api/client.ts`](src/api/client.ts). There is no client-side mock switch: stop the mock and start the teammate's service on the same loopback address. The frontend never directly calls SmartScript, SQLite, NetworkManager or system commands.

Read [`docs/api-contract.md`](docs/api-contract.md) before connecting another backend. The provided handoff leaves recovery, attempt start, health/status payloads and session transport unspecified. The explicit integration conventions implemented here include:

- GET exam returns `answers`, `attempt`, `submission`, availability and `server_time`.
- POST `/exams/{id}/start` starts/resumes a backend-timed attempt idempotently.
- The returned session ID is an opaque bearer token.
- Clearing a numeric answer uses `value: null`.
- Revisions increase across the attempt; identical PUT retries and submission IDs are idempotent.
- The backend owns durable saves, deadlines, sync and irreversible submission locking.

Missing recovery fields produce a recoverable contract error rather than pretending no answers were saved. The bundled service demonstrates these conventions; **interoperability with the teammate's actual backend still requires a joint contract check**.

## Save and submit behavior

- Text and code changes debounce for 500 ms. All question changes, exam navigation and submission flush pending writes.
- An acknowledgement counts only when `local_saved` is true and both question ID and revision match. An older response cannot overwrite newer typing.
- Writes are serialized across questions. Recovery restores the largest backend revision; conflicts preserve the current draft and offer retry.
- Internet status never gates loopback requests. The UI distinguishes **Saving locally…**, **Saved locally**, **Synced**, and **Saved locally – waiting to sync**. Failures never appear as saved.
- Submission freezes edits, flushes writes, and sends a stable submission ID once. A lost response triggers GET reconciliation. Explicit retry retains the same ID. Confirmed `local_locked: true` is never reversed by the UI.
- The backend clock drives the timer. Expiry freezes editing, flushes and submits. The mock permits a 30-second final-flush grace period; an unavailable local service beyond that needs invigilator recovery.
- Required unanswered questions and review flags are shown before submission; unanswered work may still be submitted. Only supplied marks are displayed; no scores are calculated.
- Scratchpads are separate per student and exam, stored in browser storage, and excluded from submissions. Clearing notes requires confirmation. This is functional isolation, not encrypted storage or anti-cheat hardening.

## Verify

```bash
npm run check
npx playwright install chromium
npm run test:e2e
npm run format:check
cargo check --manifest-path src-tauri/Cargo.toml --locked
```

After building the release binary on Linux, `npm run test:native` uses `xvfb-run` to launch the actual packaged WebKit application with temporary application storage and confirms it can reach the mock health/session endpoints through the production CSP. It requires a free port 43100 and does not need Vite.

Stop any service using **43100** before browser tests. Each test creates its own temporary mock store and removes only that test store afterward. The browser tests start/reuse Vite on **1420** and make real HTTP requests to the mock. Failure traces and screenshots appear in `test-results/`; `npx playwright show-report` opens the report.

Unit/integration coverage includes arithmetic validation, save races, false acknowledgements, revision conflicts, all five persisted response types, session validation, student isolation, offline sync, service restart recovery, idempotent submission and permanent locks. Browser coverage exercises the actual student flow and recoverable failure states.

## Layout

```text
src/
  api/          Runtime-validated student-safe contracts and the sole API client
  app/          Routing, boot/session gate and native window lifecycle
  components/   Shared shell, navigation, timer, status, dialog and form controls
  pages/        Login, launcher, overview, runner and submitted receipt
  questions/    Five student answer renderers
  state/        Session token, queries, serialized save/submission controller
  utilities/    Controlled calculator and scoped local scratchpad
mock/           Separate persistent loopback development service
tests/          HTTP service integration and browser acceptance tests
src-tauri/      Desktop shell; no filesystem/shell/database plugins
docs/           Integration conventions and implementation scope
```

Boot-to-app OS deployment, anti-cheat, VM/TPM detection, grading, proctoring, fleet management and OTA updates remain outside this MVP. Native shell packaging does not configure the machine's boot session.
