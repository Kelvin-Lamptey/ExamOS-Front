# Exam OS frontend MVP

Build the complete student workflow against `http://127.0.0.1:43100/v1` in a Tauri 2, React, TypeScript, Tailwind application. A separate, persistent loopback HTTP mock service stands in for the teammate's backend. The UI never imports the mock, accesses SQLite/system tools, or calls SmartScript.

## Acceptance

- Recoverable boot check; valid login requires a student ID and exactly four ASCII alphanumeric access-code characters.
- Today's exams, overview, five answer controls, question navigation, progress and backend-based timer.
- Local save is acknowledged only by `local_saved: true`. Debounce 500 ms; serialize persisted revisions and flush before navigation/submission. A failed save leaves an explicit unsaved state.
- Internet status never blocks local writes. Distinguish local acknowledgement from cloud/mock sync.
- Reload restores answers, revision, attempt times and submission lock from the local service.
- Calculator evaluates a controlled arithmetic grammar; scratchpad is student/exam-scoped browser storage with no file APIs.
- Submission uses one stable identifier per attempt, flushes first, reconciles uncertain outcomes through GET, and never unlocks a confirmed submission.
- Verify save races, error handling, durable mock persistence, all renderers and an entire browser flow; build the native shell.

## Work sequence / micro commits

1. Initialize React/Tauri shell and tooling.
2. Define API contracts and persistent mock service.
3. Boot/session, login and launcher.
4. Exam overview and all question renderers.
5. Revision-safe autosave, recovery and navigation.
6. Utilities, sync and submit/lock lifecycle.
7. Integration tests, desktop checks and handoff documentation.

## Scope and design

KenolTech reference inspected 2026-09-05: https://kenol.tech/. Match navy (`#07121f`, `#040a12`), pale blue (`#b7dcf7`), Geist/Geist Mono, pill buttons and fine borders. Bundle fonts locally for offline use. Prioritize legible exam content over decorative polish.

VM/TPM/anti-cheat, grading, proctoring, fleets, updates and OS boot configuration are out of scope. No boot-to-app OS changes until the application and teammate backend have been validated.

## Contract gaps to resolve explicitly

The handoff has no attempt-start endpoint or saved-answer/attempt fields in GET exam, and leaves health/status and session transport undefined. `docs/api-contract.md` specifies additive local API conventions needed for durable recovery, timer ownership and idempotency; these must be adopted by the teammate backend for full interoperability. Existing supplied request/response fields remain unchanged.
