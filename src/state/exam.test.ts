import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../api/client'
import type { AnswerAcknowledgement, AnswerSaveRequest, ExamPackage, Submission } from '../api/contracts'
import { createExams } from '../../mock/fixtures'
import { ExamController, isAnswered } from './exam'

function fixture(): ExamPackage {
  return { ...createExams(Date.parse('2026-09-05T10:00:00Z'))[0]!, status: 'in_progress', server_time: '2026-09-05T10:00:00Z', answers: [], attempt: { started_at: '2026-09-05T10:00:00Z', expires_at: '2026-09-05T12:00:00Z', last_revision: 0 }, submission: null }
}
function acknowledgement(id: string, input: AnswerSaveRequest): AnswerAcknowledgement {
  return { question_id: id, revision: input.revision, local_saved: true, local_saved_at: input.client_saved_at, sync_state: 'queued' }
}
function harness(exam = fixture()) {
  const backend = {
    saveAnswer: vi.fn(async (_examId: string, id: string, input: AnswerSaveRequest) => acknowledgement(id, input)),
    exam: vi.fn(async () => exam),
    submit: vi.fn(async (_id: string, input: { submission_id: string }): Promise<Submission> => ({ submission_id: input.submission_id, exam_id: exam.id, local_locked: true, state: 'submitted', sync_state: 'queued' })),
  }
  const controller = new ExamController(exam, backend)
  return { controller, backend }
}
afterEach(() => vi.useRealTimers())

describe('exam persistence and submission invariants', () => {
  it('debounces typing and flushes immediately for navigation', async () => {
    vi.useFakeTimers()
    const { controller, backend } = harness()
    controller.change('q2', { type: 'text', value: 'first' })
    await vi.advanceTimersByTimeAsync(300)
    controller.change('q2', { type: 'text', value: 'final' })
    await vi.advanceTimersByTimeAsync(300)
    expect(backend.saveAnswer).not.toHaveBeenCalled()
    await controller.flush()
    expect(backend.saveAnswer).toHaveBeenCalledOnce()
    expect(backend.saveAnswer.mock.calls[0]?.[2]).toMatchObject({ revision: 1, response: { value: 'final' } })
    expect(controller.getSnapshot().dirty).toBe(false)
  })

  it('preserves typing during an in-flight save and serializes subsequent revisions', async () => {
    const { controller, backend } = harness()
    let complete!: (ack: AnswerAcknowledgement) => void
    backend.saveAnswer.mockImplementationOnce(() => new Promise(resolve => { complete = resolve }))
    controller.change('q2', { type: 'text', value: 'old' })
    const flushing = controller.flush()
    controller.change('q2', { type: 'text', value: 'new while saving' })
    controller.change('q3', { type: 'text', value: 'another question' })
    expect(backend.saveAnswer).toHaveBeenCalledOnce()
    const [, id, input] = backend.saveAnswer.mock.calls[0]!
    complete(acknowledgement(id, input))
    await flushing
    expect(backend.saveAnswer.mock.calls.map(call => call[2].revision)).toEqual([1, 2, 3])
    expect(controller.getSnapshot().answers.q2?.response).toEqual({ type: 'text', value: 'new while saving' })
    expect(controller.getSnapshot().dirty).toBe(false)
    controller.dispose()
  })

  it('never treats local_saved=false as successful and retries the exact revision', async () => {
    const { controller, backend } = harness()
    backend.saveAnswer.mockImplementationOnce(async (_examId, id, input) => ({ ...acknowledgement(id, input), local_saved: false }))
    controller.change('q2', { type: 'text', value: 'unconfirmed' })
    await expect(controller.flush()).rejects.toMatchObject({ code: 'SAVE_NOT_CONFIRMED' })
    expect(controller.getSnapshot()).toMatchObject({ dirty: true, lastRevision: 0 })
    expect(controller.getSnapshot().answers.q2?.saved).toBe(false)
    await controller.flush()
    expect(backend.saveAnswer.mock.calls.map(call => call[2].revision)).toEqual([1, 1])
    expect(controller.getSnapshot().dirty).toBe(false)
  })

  it('starts above recovered revisions and preserves a draft through stale-write reconciliation', async () => {
    const exam = fixture()
    exam.attempt!.last_revision = 7
    const { controller, backend } = harness(exam)
    backend.saveAnswer.mockRejectedValueOnce(new ApiError('STALE_REVISION', 'Stale revision', 409, false, 20))
    backend.exam.mockResolvedValueOnce({ ...exam, attempt: { ...exam.attempt!, last_revision: 20 } })
    controller.change('q2', { type: 'text', value: 'my current draft' })
    await expect(controller.flush()).rejects.toMatchObject({ code: 'STALE_REVISION' })
    await controller.flush()
    expect(backend.saveAnswer.mock.calls.map(call => call[2].revision)).toEqual([8, 21])
    expect(controller.getSnapshot().answers.q2?.response).toEqual({ type: 'text', value: 'my current draft' })
  })

  it('does not submit if a save fails, and coalesces double-click submissions after flush', async () => {
    const { controller, backend } = harness()
    backend.saveAnswer.mockRejectedValueOnce(new ApiError('SERVICE_UNAVAILABLE', 'Offline local service', 0, true))
    controller.change('q2', { type: 'text', value: 'before submit' })
    expect(await controller.submit()).toBeNull()
    expect(backend.submit).not.toHaveBeenCalled()
    const [first, second] = await Promise.all([controller.submit(), controller.submit()])
    expect(first).toEqual(second)
    expect(backend.submit).toHaveBeenCalledOnce()
    expect(backend.submit.mock.calls[0]?.[1]).toMatchObject({ final_revision: 1 })
    controller.change('q2', { type: 'text', value: 'after lock' })
    expect(controller.getSnapshot().answers.q2?.response).toEqual({ type: 'text', value: 'before submit' })
  })

  it('reconciles a lost submission response without issuing another POST', async () => {
    const { controller, backend } = harness()
    backend.submit.mockImplementationOnce(async (_id, input) => {
      backend.exam.mockResolvedValue({ ...fixture(), submission: { exam_id: fixture().id, submission_id: input.submission_id, local_locked: true, state: 'submitted', sync_state: 'queued' } })
      throw new ApiError('SERVICE_UNAVAILABLE', 'Lost response')
    })
    expect(await controller.submit()).toMatchObject({ local_locked: true })
    expect(backend.submit).toHaveBeenCalledOnce()
    expect(controller.getSnapshot().submissionUncertain).toBe(false)
  })

  it('freezes an uncertain outcome and reuses the submission ID on an explicit retry', async () => {
    const { controller, backend } = harness()
    backend.submit.mockRejectedValueOnce(new ApiError('SERVICE_UNAVAILABLE', 'Lost response'))
    await controller.submit()
    expect(controller.getSnapshot().submissionUncertain).toBe(true)
    controller.change('q2', { type: 'text', value: 'unsafe edit' })
    expect(controller.getSnapshot().dirty).toBe(false)
    await controller.submit()
    expect(backend.submit).toHaveBeenCalledOnce()
    await controller.submit(true)
    expect(backend.submit.mock.calls[0]?.[1].submission_id).toBe(backend.submit.mock.calls[1]?.[1].submission_id)
  })

  it('distinguishes zero, cleared numbers and invalid unfinished numeric input', async () => {
    const { controller, backend } = harness()
    expect(isAnswered({ type: 'number', value: 0 })).toBe(true)
    expect(isAnswered({ type: 'number', value: null })).toBe(false)
    controller.change('q4', { type: 'number', value: null }, { raw: '-', error: 'Finish entering a valid number.' })
    await expect(controller.flush()).rejects.toMatchObject({ code: 'INVALID_ANSWER' })
    expect(backend.saveAnswer).not.toHaveBeenCalled()
    controller.change('q4', { type: 'number', value: 0 }, { raw: '0', error: null })
    await controller.flush()
    expect(controller.getSnapshot().answers.q4?.saved).toBe(true)
  })
})
