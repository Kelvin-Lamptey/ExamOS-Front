import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { AddressInfo } from 'node:net'
import { createMockService } from '../mock/service'
import { ExamPackageSchema, SessionSchema } from '../src/api/contracts'

describe('persistent local mock API', () => {
  let service: Awaited<ReturnType<typeof createMockService>>
  let dataDir: string
  let base: string
  let token: string
  const clock = Date.parse('2026-09-05T10:00:00Z')

  async function boot() {
    service = await createMockService({ dataDir, offline: true, now: () => clock, syncDelayMs: 20 })
    await new Promise<void>(resolve => service.server.listen(0, '127.0.0.1', resolve))
    base = `http://127.0.0.1:${(service.server.address() as AddressInfo).port}/v1`
  }
  async function request(path: string, method = 'GET', body?: unknown, credential = token) {
    return fetch(`${base}${path}`, { method, headers: { 'Content-Type': 'application/json', ...(credential ? { Authorization: `Bearer ${credential}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) })
  }
  const answer = (revision: number, value = 'A saved answer') => ({ revision, response: { type: 'text', value }, client_saved_at: new Date(clock).toISOString() })

  beforeEach(async () => {
    dataDir = await mkdtemp(join(tmpdir(), 'examos-api-test-'))
    await boot()
    const response = await request('/auth/login', 'POST', { student_id: 'GCTU-CS-001', access_code: 'A7K2' }, '')
    token = SessionSchema.parse(await response.json()).session_id
  })
  afterEach(async () => { await service.close(); await rm(dataDir, { recursive: true, force: true }) })

  it('validates credentials, protects sessions, and rejects other origins', async () => {
    expect((await request('/exams', 'GET', undefined, '')).status).toBe(401)
    expect((await request('/auth/login', 'POST', { student_id: 'GCTU-CS-001', access_code: 'ABCDE' })).status).toBe(422)
    expect((await request('/auth/login', 'POST', { student_id: 'GCTU-CS-001', access_code: 'nope' })).status).toBe(401)
    expect((await fetch(`${base}/health`, { headers: { Origin: 'https://unrelated.example' } })).status).toBe(403)
  })

  it('persists all five answer shapes offline and reconstructs them after service restart', async () => {
    const initial = ExamPackageSchema.parse(await (await request('/exams/exam_ooad_001')).json())
    expect(initial.attempt).toBeNull()
    const started = ExamPackageSchema.parse(await (await request('/exams/exam_ooad_001/start', 'POST', {})).json())
    expect(started.attempt?.expires_at).toBe('2026-09-05T12:00:00.000Z')
    const responses = [
      { type: 'mcq', selected_option_ids: ['a'] }, { type: 'text', value: 'Short answer' },
      { type: 'text', value: 'Long answer\nwith lines' }, { type: 'number', value: 0 },
      { type: 'code', language: 'java', source: 'class Student {}' },
    ]
    for (const [i, response] of responses.entries()) {
      const result = await request(`/exams/exam_ooad_001/answers/q${i + 1}`, 'PUT', { revision: i + 1, response, client_saved_at: new Date(clock).toISOString() })
      expect(result.status).toBe(200)
      expect(await result.json()).toMatchObject({ local_saved: true, revision: i + 1, sync_state: 'offline' })
    }
    await service.close()
    await boot()
    const restored = ExamPackageSchema.parse(await (await request('/exams/exam_ooad_001')).json())
    expect(restored.answers.map(a => a.response)).toEqual(responses)
    expect(restored.attempt).toEqual({ started_at: '2026-09-05T10:00:00.000Z', expires_at: '2026-09-05T12:00:00.000Z', last_revision: 5 })
    expect((await request('/exams/exam_ooad_001/answers/q4', 'PUT', { ...answer(6), response: { type: 'number', value: null } })).status).toBe(200)
  })

  it('serializes revisions and makes an identical retry idempotent', async () => {
    await request('/exams/exam_ooad_001/start', 'POST', {})
    expect((await request('/exams/exam_ooad_001/answers/q2', 'PUT', answer(7))).status).toBe(200)
    expect((await request('/exams/exam_ooad_001/answers/q2', 'PUT', answer(7))).status).toBe(200)
    const stale = await request('/exams/exam_ooad_001/answers/q2', 'PUT', answer(6))
    expect(stale.status).toBe(409)
    expect(await stale.json()).toMatchObject({ error: { code: 'STALE_REVISION', current_revision: 7 } })
    expect((await request('/exams/exam_ooad_001/answers/q2', 'PUT', answer(7, 'Changed'))).status).toBe(409)
    expect((await request('/exams/exam_ooad_001/answers/q3', 'PUT', answer(7))).status).toBe(409)
  })

  it('permanently locks an idempotent submission, including after restart', async () => {
    await request('/exams/exam_ooad_001/start', 'POST', {})
    await request('/exams/exam_ooad_001/answers/q2', 'PUT', answer(1))
    expect((await request('/auth/logout', 'POST')).status).toBe(409)
    expect((await request('/exams/exam_ooad_001/submit', 'POST', { submission_id: 'sub_test', final_revision: 0 })).status).toBe(409)
    const submission = { submission_id: 'sub_test', final_revision: 1 }
    const receipt = await (await request('/exams/exam_ooad_001/submit', 'POST', submission)).json()
    expect(receipt).toMatchObject({ local_locked: true, state: 'submitted', sync_state: 'offline' })
    expect(await (await request('/exams/exam_ooad_001/submit', 'POST', submission)).json()).toEqual(receipt)
    await service.close(); await boot()
    expect((await request('/exams/exam_ooad_001/answers/q2', 'PUT', answer(2))).status).toBe(409)
    expect(ExamPackageSchema.parse(await (await request('/exams/exam_ooad_001')).json()).submission).toEqual(receipt)
  })

  it('isolates student answers and does not start unavailable exams', async () => {
    expect((await request('/exams/exam_db_002/start', 'POST', {})).status).toBe(403)
    expect((await request('/exams/exam_networks_003/start', 'POST', {})).status).toBe(403)
    await request('/exams/exam_ooad_001/start', 'POST', {})
    await request('/exams/exam_ooad_001/answers/q2', 'PUT', answer(1))
    const other = SessionSchema.parse(await (await request('/auth/login', 'POST', { student_id: 'GCTU-CS-002', access_code: 'B8L3' })).json())
    const exam = ExamPackageSchema.parse(await (await request('/exams/exam_ooad_001', 'GET', undefined, other.session_id)).json())
    expect(exam.answers).toEqual([])
    expect(exam.attempt).toBeNull()
  })

  it('syncs locally queued answers after simulated Internet reconnects', async () => {
    await request('/exams/exam_ooad_001/start', 'POST', {})
    await request('/exams/exam_ooad_001/answers/q2', 'PUT', answer(1))
    expect(await (await request('/system/status')).json()).toMatchObject({ connectivity: 'offline', pending_count: 1 })
    service.setOffline(false)
    await expect.poll(async () => (await (await request('/system/status')).json()).pending_count).toBe(0)
    expect(ExamPackageSchema.parse(await (await request('/exams/exam_ooad_001')).json()).answers[0]?.sync_state).toBe('synced')
  })
})
