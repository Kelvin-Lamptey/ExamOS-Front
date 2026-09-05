import { api, ApiError, errorMessage } from '../api/client'
import type { AnswerAcknowledgement, AnswerResponse, AnswerSaveRequest, ExamPackage, Question, Submission, SyncState } from '../api/contracts'

export function emptyResponse(question: Question): AnswerResponse {
  switch (question.type) {
    case 'mcq': return { type: 'mcq', selected_option_ids: [] }
    case 'short_text': case 'long_text': return { type: 'text', value: '' }
    case 'number': return { type: 'number', value: null }
    case 'code': return { type: 'code', language: question.code_config?.language ?? 'text', source: '' }
  }
}
export function isAnswered(response: AnswerResponse): boolean {
  switch (response.type) {
    case 'mcq': return response.selected_option_ids.length > 0
    case 'text': return response.value.trim().length > 0
    case 'number': return response.value !== null
    case 'code': return response.source.trim().length > 0
  }
}

export interface DraftAnswer {
  response: AnswerResponse
  version: number
  acceptedVersion: number
  revision: number
  saved: boolean
  syncState?: SyncState
  error: string | null
  invalid: string | null
  rawNumber?: string
  pending?: { request: AnswerSaveRequest; version: number }
}
export interface ExamSnapshot {
  answers: Record<string, DraftAnswer>
  lastRevision: number
  dirty: boolean
  saving: boolean
  error: string | null
  errorCode: string | null
  submission: Submission | null
  submitting: boolean
  submissionUncertain: boolean
  submissionError: string | null
  expired: boolean
}
type ExamApi = Pick<typeof api, 'saveAnswer' | 'exam' | 'submit'>
export interface SubmissionIntent { id: string; attempted: boolean }
export interface IntentStore { read: () => SubmissionIntent | null; write: (intent: SubmissionIntent) => void }

export function submissionIntentStore(studentId: string, exam: ExamPackage): IntentStore {
  const key = `examos.submission.v1:${studentId}:${exam.id}:${exam.attempt?.started_at}`
  let memory: SubmissionIntent | null = null
  return {
    read: () => {
      try {
        const data: unknown = JSON.parse(localStorage.getItem(key) ?? 'null')
        if (data && typeof data === 'object' && 'id' in data && typeof data.id === 'string' && 'attempted' in data && typeof data.attempted === 'boolean') return { id: data.id, attempted: data.attempted }
      } catch { /* Memory fallback is valid for the current application lifetime. */ }
      return memory
    },
    write: intent => { memory = intent; try { localStorage.setItem(key, JSON.stringify(intent)) } catch { /* GET remains authoritative after a restart. */ } },
  }
}

// One controller owns an attempt. All answer PUTs are serialized across questions.
// React reads immutable snapshots; edits can continue while a PUT is in flight.
export class ExamController {
  private snapshot: ExamSnapshot
  private readonly listeners = new Set<() => void>()
  private timer: ReturnType<typeof setTimeout> | undefined
  private running: Promise<void> | null = null
  private submissionRun: Promise<Submission | null> | null = null
  private nextRevision: number
  private lastAcknowledgedAt = 0
  private intent: SubmissionIntent | null

  constructor(
    readonly exam: ExamPackage,
    private readonly backend: ExamApi = api,
    private readonly intentStore?: IntentStore,
    private readonly debounceMs = 500,
  ) {
    const answers: Record<string, DraftAnswer> = {}
    for (const question of exam.questions) {
      const saved = exam.answers.find(answer => answer.question_id === question.id && answer.local_saved)
      const response = saved?.response ?? emptyResponse(question)
      answers[question.id] = {
        response, version: 0, acceptedVersion: 0, revision: saved?.revision ?? 0,
        saved: Boolean(saved), syncState: saved?.sync_state, error: null, invalid: null,
        rawNumber: response.type === 'number' ? response.value?.toString() ?? '' : undefined,
      }
      if (saved) this.lastAcknowledgedAt = Math.max(this.lastAcknowledgedAt, Date.parse(saved.local_saved_at))
    }
    this.nextRevision = Math.max(exam.attempt?.last_revision ?? 0, ...exam.answers.map(answer => answer.revision))
    this.intent = intentStore?.read() ?? null
    this.snapshot = {
      answers, lastRevision: this.nextRevision, dirty: false, saving: false, error: null, errorCode: null,
      submission: exam.submission, submitting: false,
      submissionUncertain: Boolean(this.intent?.attempted && !exam.submission?.local_locked),
      submissionError: null, expired: false,
    }
  }

  getSnapshot = () => this.snapshot
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener) } }
  private publish(patch: Partial<ExamSnapshot> = {}) {
    this.snapshot = { ...this.snapshot, ...patch }
    this.snapshot.dirty = Object.values(this.snapshot.answers).some(answer => answer.version !== answer.acceptedVersion)
    for (const listener of this.listeners) listener()
  }
  private patchAnswer(id: string, patch: Partial<DraftAnswer>) {
    const current = this.snapshot.answers[id]
    if (!current) return
    this.publish({ answers: { ...this.snapshot.answers, [id]: { ...current, ...patch } } })
  }
  isFrozen() { return Boolean(this.snapshot.submission?.local_locked || this.snapshot.submitting || this.snapshot.submissionUncertain || this.snapshot.expired) }

  change(questionId: string, response: AnswerResponse, numeric?: { raw: string; error: string | null }) {
    if (this.isFrozen()) return
    const current = this.snapshot.answers[questionId]
    if (!current || (JSON.stringify(current.response) === JSON.stringify(response) && current.invalid === (numeric?.error ?? null) && (!numeric || current.rawNumber === numeric.raw))) return
    this.patchAnswer(questionId, { response, version: current.version + 1, error: null, invalid: numeric?.error ?? null, ...(numeric ? { rawNumber: numeric.raw } : {}) })
    this.publish({ error: null, errorCode: null })
    clearTimeout(this.timer)
    this.timer = setTimeout(() => { void this.flush().catch(() => undefined) }, this.debounceMs)
  }

  async flush(keepalive = false): Promise<void> {
    clearTimeout(this.timer)
    if (this.snapshot.submission?.local_locked) return
    if (this.running) { await this.running; if (this.snapshot.dirty) return this.flush(keepalive); return }
    this.running = this.drain(keepalive)
    try { await this.running } finally { this.running = null }
  }

  private async drain(keepalive: boolean) {
    this.publish({ saving: true, error: null, errorCode: null })
    try {
      while (!this.snapshot.submission?.local_locked) {
        const entry = Object.entries(this.snapshot.answers).find(([, answer]) => answer.version !== answer.acceptedVersion)
        if (!entry) break
        const [questionId, draft] = entry
        if (draft.invalid) {
          this.patchAnswer(questionId, { error: draft.invalid })
          throw new ApiError('INVALID_ANSWER', draft.invalid)
        }
        // Retry an unacknowledged request exactly as sent, before later edits.
        const pending = draft.pending ?? {
          request: { revision: ++this.nextRevision, response: structuredClone(draft.response), client_saved_at: new Date().toISOString() },
          version: draft.version,
        }
        this.patchAnswer(questionId, { pending, error: null })
        try {
          const ack = await this.backend.saveAnswer(this.exam.id, questionId, pending.request, keepalive)
          this.accept(questionId, pending.version, pending.request, ack)
        } catch (error) {
          if (error instanceof ApiError && ['STALE_REVISION', 'EXAM_LOCKED'].includes(error.code)) {
            await this.reconcile().catch(() => undefined)
            if (this.snapshot.submission?.local_locked) break
            if (error.currentRevision !== undefined) this.nextRevision = Math.max(this.nextRevision, error.currentRevision)
            this.patchAnswer(questionId, { pending: undefined })
          }
          this.patchAnswer(questionId, { error: errorMessage(error) })
          throw error
        }
      }
    } catch (error) {
      this.publish({ error: errorMessage(error), errorCode: error instanceof ApiError ? error.code : null })
      throw error
    } finally { this.publish({ saving: false }) }
  }

  private accept(questionId: string, version: number, request: AnswerSaveRequest, ack: AnswerAcknowledgement) {
    if (!ack.local_saved || ack.question_id !== questionId || ack.revision !== request.revision) {
      throw new ApiError('SAVE_NOT_CONFIRMED', 'The local service did not confirm this answer revision. Your changes are still unsaved.', 0, true)
    }
    this.nextRevision = Math.max(this.nextRevision, ack.revision)
    this.lastAcknowledgedAt = Math.max(this.lastAcknowledgedAt, Date.parse(ack.local_saved_at))
    this.patchAnswer(questionId, { acceptedVersion: version, revision: ack.revision, saved: true, syncState: ack.sync_state, error: null, pending: undefined })
    this.publish({ lastRevision: Math.max(this.snapshot.lastRevision, ack.revision) })
  }

  markSynced(serverTime: string) {
    if (this.snapshot.saving || Date.parse(serverTime) < this.lastAcknowledgedAt) return
    const answers = { ...this.snapshot.answers }
    let changed = false
    for (const [id, answer] of Object.entries(answers)) {
      if (answer.saved && answer.syncState !== 'synced' && answer.version === answer.acceptedVersion) {
        answers[id] = { ...answer, syncState: 'synced' }; changed = true
      }
    }
    if (changed) this.publish({ answers })
  }

  async reconcile() {
    const remote = await this.backend.exam(this.exam.id)
    this.nextRevision = Math.max(this.nextRevision, remote.attempt?.last_revision ?? 0, ...remote.answers.map(answer => answer.revision))
    const answers = { ...this.snapshot.answers }
    for (const saved of remote.answers) {
      const local = answers[saved.question_id]
      if (!local || !saved.local_saved || saved.revision < local.revision) continue
      this.lastAcknowledgedAt = Math.max(this.lastAcknowledgedAt, Date.parse(saved.local_saved_at))
      const samePending = local.pending && saved.revision === local.pending.request.revision && JSON.stringify(saved.response) === JSON.stringify(local.pending.request.response)
      if (local.version === local.acceptedVersion) {
        answers[saved.question_id] = { ...local, response: saved.response, revision: saved.revision, saved: true, syncState: saved.sync_state, rawNumber: saved.response.type === 'number' ? saved.response.value?.toString() ?? '' : undefined }
      } else if (samePending) {
        answers[saved.question_id] = { ...local, acceptedVersion: local.pending!.version, revision: saved.revision, saved: true, syncState: saved.sync_state, pending: undefined, error: null }
      }
    }
    this.publish({ answers, lastRevision: Math.max(this.snapshot.lastRevision, remote.attempt?.last_revision ?? 0), ...(remote.submission?.local_locked ? { submission: remote.submission, submissionUncertain: false, submissionError: null } : {}) })
    return remote
  }

  expire() { this.publish({ expired: true }) }

  submit(explicitRetry = false): Promise<Submission | null> {
    if (this.snapshot.submission?.local_locked) return Promise.resolve(this.snapshot.submission)
    if (this.submissionRun) return this.submissionRun
    if (this.snapshot.submissionUncertain && !explicitRetry) return this.checkSubmission()
    this.submissionRun = this.performSubmit(explicitRetry)
    return this.submissionRun.finally(() => { this.submissionRun = null })
  }

  private async performSubmit(explicitRetry: boolean): Promise<Submission | null> {
    this.publish({ submitting: true, submissionError: null })
    try {
      if (explicitRetry) {
        const remote = await this.reconcile()
        if (remote.submission?.local_locked) return remote.submission
      }
      await this.flush()
      if (this.snapshot.submission?.local_locked) return this.snapshot.submission
      this.intent ??= { id: `sub_${crypto.randomUUID()}`, attempted: false }
      this.intent = { ...this.intent, attempted: true }
      this.intentStore?.write(this.intent)
      // From this point, a lost response is ambiguous: editing remains frozen.
      this.publish({ submissionUncertain: true })
      const receipt = await this.backend.submit(this.exam.id, { submission_id: this.intent.id, final_revision: this.snapshot.lastRevision })
      if (!receipt.local_locked || receipt.exam_id !== this.exam.id || receipt.submission_id !== this.intent.id) throw new ApiError('LOCK_NOT_CONFIRMED', 'Submission has not been confirmed as locked. Check its status before taking another action.')
      this.publish({ submission: receipt, submissionUncertain: false })
      return receipt
    } catch (error) {
      if (this.snapshot.submissionUncertain) {
        const remote = await this.reconcile().catch(() => null)
        if (remote?.submission?.local_locked) return remote.submission
      }
      this.publish({ submissionError: errorMessage(error) })
      return null
    } finally { this.publish({ submitting: false }) }
  }

  async checkSubmission() {
    try {
      const remote = await this.reconcile()
      if (!remote.submission?.local_locked) this.publish({ submissionError: 'The local service has no confirmed submission yet. You can retry with the same submission ID.' })
      return remote.submission
    } catch (error) { this.publish({ submissionError: errorMessage(error) }); return null }
  }

  dispose() { clearTimeout(this.timer) }
}
