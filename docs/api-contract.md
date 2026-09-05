# Local API integration, v1

The frontend always calls `http://127.0.0.1:43100/v1` through `src/api/client.ts`. It has no mock switch, SmartScript URL, database access or OS commands. `mock/server.ts` is a separate development-only HTTP service, never included in the frontend bundle.

The handoff's login, summary, question, PUT-answer and POST-submit fields are preserved. The following are **explicit integration additions/conventions** needed to fulfill start/timer, recovery and lock requirements. These are implemented in the bundled mock and must be agreed with/implemented by the teammate service. The original package alone cannot reconstruct saved answers.

## Session and service

- Login uses the supplied JSON. `session_id` is an opaque bearer token on subsequent calls: `Authorization: Bearer <session_id>`. The UI keeps only this token in local storage to reopen a session; all student/exam records are fetched from the service. GET session validates expiry; logout revokes the token. The mock is single-student demo authentication, not production authentication.
- GET `/health`: `{ "status": "ok", "contract_version": "v1", "mode": "mock" }` (`mode` may be `local`). Public, available without a session.
- GET `/system/status`: `{ "connectivity": "online", "sync_state": "synced", "pending_count": 0, "last_synced_at": "2026-09-05T10:00:00Z", "server_time": "2026-09-05T10:00:00Z" }`. Connectivity is `online | offline`; sync uses the supplied enum. Last sync may be null. Counts are scoped to the authenticated student. `synced` means all acknowledged local items have reached the cloud (or simulated mock cloud).
- CORS allows the browser dev origin `http://127.0.0.1:1420` and Tauri origins `tauri://localhost`, `http://tauri.localhost`, `https://tauri.localhost`; allow `Content-Type`, `Authorization`, GET/POST/PUT/OPTIONS. No cookies are required.
- Return the supplied error envelope and HTTP statuses. `STALE_REVISION` (409) additionally carries `error.current_revision` for recovery; GET package remains authoritative if this field is absent. Never mark `local_saved: true` until durable persistence succeeds.

## Starting and restoring an attempt

GET `/exams/{id}` adds these fields to the supplied package:

```json
{
  "status": "in_progress",
  "starts_at": "2026-09-05T00:00:00Z",
  "ends_at": "2026-09-05T23:59:59Z",
  "server_time": "2026-09-05T10:00:05Z",
  "answers": [{
    "question_id": "q2",
    "revision": 7,
    "response": { "type": "text", "value": "Cohesion describes..." },
    "local_saved": true,
    "local_saved_at": "2026-09-05T10:00:03Z",
    "sync_state": "queued"
  }],
  "attempt": {
    "started_at": "2026-09-05T10:00:00Z",
    "expires_at": "2026-09-05T12:00:00Z",
    "last_revision": 7
  },
  "submission": null
}
```

- Before starting, `answers: []`, `attempt: null`, `submission: null` are required. Refuse to guess these fields if missing.
- POST `/exams/{id}/start` with `{}` idempotently starts or resumes the attempt and returns the complete package above. The service owns start time and deadline (minimum of duration and availability end). GET does not start the clock.
- After submission, `status: "submitted"` and `submission` is the supplied submit response, including `local_locked: true`. GET must retain this lock across reload, session expiry and service restart. Reading/submitting an already-started attempt remains possible after the exam window closes.
- Revisions increase across the entire attempt, not just each question. `attempt.last_revision` is the largest accepted revision. Retrying exactly the same question/revision/response is idempotent; changing an already accepted revision is a 409. No write can reduce a revision.
- An empty numeric input persists `{ "type": "number", "value": null }` to clear an earlier number. This explicit addition avoids coercing blank to zero. MCQ clears with `selected_option_ids: []`; text/code clear with empty strings. Numeric zero is a real answer.

## Submission and expiry

- Flush all local writes before POST submit. `final_revision` must equal the attempt's largest accepted revision; the mock rejects a mismatch.
- A submission ID identifies one logical submission and is recorded durably. Duplicate requests with that ID return the same receipt. A different ID for an already-locked attempt returns 409; GET returns the existing receipt.
- If the POST response is lost, the UI disables editing and checks GET package. It does not generate a fresh ID or automatically repeat POST. An explicit retry uses the same ID, and is safe only with backend idempotency.
- On timer expiry the UI freezes input, flushes already-entered answers and initiates submission. The local service must accommodate the final flush of edits made before expiry. The mock enforces a 30-second flush grace period; an unavailable service past that period is an invigilator recovery case, never a false save.
- Required questions are highlighted and unanswered counts are shown at confirmation; final submission may contain unanswered questions. No grading result is inferred.
- A receipt with `local_locked: true` always locks the UI, irrespective of cloud connectivity. `local_locked: false` is not treated as successful finalization.

## Mock data

Seed credentials: `GCTU-CS-001` / `A7K2`. A second demonstration student is `GCTU-CS-002` / `B8L3` for isolation testing. Availability dates are generated for the day the mock data is first created. The main exam has all five renderers, and two other cards demonstrate upcoming and closed availability. Use `npm run mock:reset` to start a fresh demo on a new day (archives the previous store first).

The mock persists to `.mock-data/state.json` by atomic replacement before acknowledgements. It simulates sync without making external requests. Start with `npm run mock:offline` or toggle the running mock with `SIGUSR2`; the student UI never calls a test-control endpoint. Logout is denied while an attempt remains in progress.
