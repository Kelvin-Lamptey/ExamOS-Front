# MVP validation — 2026-09-05

## Proven in this workspace

| Check                                   | Result                                                           |
| --------------------------------------- | ---------------------------------------------------------------- |
| Strict TypeScript validation            | Pass                                                             |
| Vitest unit and HTTP service tests      | 30 passing                                                       |
| Playwright browser acceptance tests     | 7 passing                                                        |
| Production frontend build               | Pass                                                             |
| Tauri Rust check                        | Pass                                                             |
| Linux release and Debian package build  | Pass                                                             |
| Packaged native WebKit boot smoke check | Pass; `tauri://localhost` reached `/v1/health` and `/v1/session` |

Browser acceptance covers:

1. Login, controlled calculator, isolated scratchpads, all five question types, Internet-offline saves, refresh recovery, single submission, permanent lock, simulated reconnect/sync and logout.
2. Recoverable service-unavailable boot, access-code validation, and no horizontal overflow at a 390-pixel viewport.
3. Failed local persistence keeps the current draft and blocks question navigation; retry and resume recover it.
4. A lost submit response is reconciled through GET, with exactly one POST.
5. Session expiry reauthenticates the same student and retains unsaved typing.
6. Leaving the exam flushes the pending draft before navigation.
7. Expiry automatically submits once and preserves the lock after refresh.

The full flow asserts no browser JavaScript errors or external HTTP requests. Mock-service tests also prove recovery after a service restart, student isolation, stale-write rejection, empty numeric clearing, idempotent retries and submission locks after restart. Save-controller tests cover concurrent typing while saving, false acknowledgements, revision recovery, failed pre-submission saves and ambiguous submissions.

## Artifacts and reproduction

- Browser screenshots: `test-results/launcher.png`, `exam-runner.png`, `submission.png`, `mobile-launcher.png` (generated, ignored by Git).
- Debian package: `src-tauri/target/release/bundle/deb/Exam OS_0.1.0_amd64.deb` (generated, ignored by Git).
- Production binary: `src-tauri/target/release/exam-os`.
- Reproduce checks with the commands in [README](../README.md).

## Integration limits

- The supplied teammate backend was not present. The complete flow ran against the bundled persistent HTTP mock. Agree the explicit start/recovery/status/session conventions in [api-contract.md](api-contract.md) before claiming interoperability with another service.
- Native smoke verifies packaged assets, production CSP, WebKit execution and loopback API access. The automated full exam flow runs in Chromium; it does not automate the native window close button. The close handler is typechecked and built, and shares the tested flush controller.
- Mock sync is simulated; no SmartScript/cloud integration or grading exists.
- No OS boot-session settings, kiosk/anti-cheat rules, or fleet configuration were changed. Those are a later deployment step.
- A forced process kill or power loss can lose edits that have not been acknowledged by the local backend. The UI labels those edits unsaved and guards normal navigation/closing.
