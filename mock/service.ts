import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { mkdir, open, readFile, rename } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import {
  AnswerSaveRequestSchema, AttemptSchema, LoginRequestSchema, SavedAnswerSchema,
  SessionSchema, SubmissionRequestSchema, SubmissionSchema,
  type ExamPackage, type ExamSummary, type Session, type SystemStatus,
} from '../src/api/contracts.ts'
import { createExams, students, type SeedExam } from './fixtures.ts'

const RecordSchema = z.object({
  attempt: AttemptSchema.nullable(),
  answers: z.record(z.string(), SavedAnswerSchema),
  submission: SubmissionSchema.nullable(),
})
type ExamRecord = z.infer<typeof RecordSchema>
const StoreSchema = z.object({
  version: z.literal(1),
  exams: z.array(z.custom<SeedExam>()),
  sessions: z.record(z.string(), SessionSchema),
  records: z.record(z.string(), z.record(z.string(), RecordSchema)),
  lastSyncedAt: z.string().nullable(),
})
type Store = z.infer<typeof StoreSchema>

class HttpError extends Error {
  status: number
  code: string
  retryable: boolean
  currentRevision?: number

  constructor(status: number, code: string, message: string, retryable = false, currentRevision?: number) {
    super(message)
    this.status = status
    this.code = code
    this.retryable = retryable
    this.currentRevision = currentRevision
  }
}

export interface MockOptions {
  dataDir: string
  offline?: boolean
  now?: () => number
  syncDelayMs?: number
}

export async function createMockService(options: MockOptions) {
  const now = options.now ?? Date.now
  let offline = options.offline ?? false
  const file = join(options.dataDir, 'state.json')
  await mkdir(options.dataDir, { recursive: true, mode: 0o700 })
  let state: Store
  try {
    state = StoreSchema.parse(JSON.parse(await readFile(file, 'utf8')))
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    state = { version: 1, exams: createExams(now()), sessions: {}, records: {}, lastSyncedAt: null }
  }

  // Disk failures never leave unacknowledged changes in the live in-memory store.
  async function persist(next: Store) {
    const temporary = `${file}.${randomUUID()}.tmp`
    const handle = await open(temporary, 'wx', 0o600)
    try {
      await handle.writeFile(JSON.stringify(next, null, 2))
      await handle.sync()
    } finally {
      await handle.close()
    }
    await rename(temporary, file)
    const directory = await open(options.dataDir, 'r')
    try { await directory.sync() } finally { await directory.close() }
    state = next
  }
  await persist(state)

  let queue = Promise.resolve()
  function serialize<T>(work: () => Promise<T>): Promise<T> {
    const result = queue.then(work)
    queue = result.then(() => undefined, () => undefined)
    return result
  }
  const isoNow = () => new Date(now()).toISOString()
  function getRecord(studentId: string, examId: string): ExamRecord {
    return state.records[studentId]?.[examId] ?? { attempt: null, answers: {}, submission: null }
  }
  async function updateRecord(studentId: string, examId: string, record: ExamRecord) {
    const next = structuredClone(state)
    next.records[studentId] ??= {}
    next.records[studentId][examId] = record
    await persist(next)
  }
  function status(exam: SeedExam, record: ExamRecord): ExamSummary['status'] {
    if (record.submission?.local_locked) return 'submitted'
    if (record.attempt) return 'in_progress'
    if (now() < Date.parse(exam.starts_at)) return 'upcoming'
    return now() >= Date.parse(exam.ends_at) ? 'closed' : 'available'
  }
  function getPackage(exam: SeedExam, studentId: string): ExamPackage {
    const record = getRecord(studentId, exam.id)
    return {
      ...exam, status: status(exam, record), server_time: isoNow(),
      answers: Object.values(record.answers), attempt: record.attempt, submission: record.submission,
    }
  }
  function getSession(req: IncomingMessage): Session {
    const token = req.headers.authorization?.replace(/^Bearer /, '')
    const session = token ? state.sessions[token] : undefined
    if (!session || Date.parse(session.expires_at) <= now()) {
      throw new HttpError(401, 'SESSION_EXPIRED', 'Your session has expired. Sign in again to continue.')
    }
    return session
  }
  function systemStatus(studentId: string): SystemStatus {
    const records = Object.values(state.records[studentId] ?? {})
    const pending = records.flatMap(r => [...Object.values(r.answers), ...(r.submission ? [r.submission] : [])]).filter(item => item.sync_state !== 'synced').length
    return {
      connectivity: offline ? 'offline' : 'online', sync_state: offline ? 'offline' : pending ? 'queued' : 'synced',
      pending_count: pending, last_synced_at: state.lastSyncedAt, server_time: isoNow(),
    }
  }

  async function body(req: IncomingMessage): Promise<unknown> {
    let length = 0
    const chunks: Buffer[] = []
    for await (const chunk of req) {
      length += Buffer.byteLength(chunk)
      if (length > 512_000) throw new HttpError(422, 'PAYLOAD_TOO_LARGE', 'This answer exceeds the local service size limit.')
      chunks.push(Buffer.from(chunk))
    }
    try { return JSON.parse(Buffer.concat(chunks).toString() || '{}') }
    catch { throw new HttpError(422, 'INVALID_JSON', 'The request must contain valid JSON.') }
  }

  async function route(req: IncomingMessage): Promise<{ status?: number; data?: unknown }> {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1:43100')
    const path = url.pathname
    if (req.method === 'GET' && path === '/v1/health') return { data: { status: 'ok', contract_version: 'v1', mode: 'mock' } }
    if (req.method === 'POST' && path === '/v1/auth/login') {
      const credentials = LoginRequestSchema.parse(await body(req))
      const person = students.find(s => s.student.student_id === credentials.student_id && s.accessCode === credentials.access_code)
      if (!person) throw new HttpError(401, 'INVALID_CREDENTIALS', 'Student ID or access code is invalid.')
      const session: Session = { session_id: `ses_${randomUUID()}`, student: person.student, expires_at: new Date(now() + 12 * 3_600_000).toISOString() }
      const next = structuredClone(state)
      next.sessions[session.session_id] = session
      await persist(next)
      return { data: session }
    }
    const session = getSession(req)
    const studentId = session.student.id
    if (req.method === 'GET' && path === '/v1/session') return { data: session }
    if (req.method === 'GET' && path === '/v1/system/status') return { data: systemStatus(studentId) }
    if (req.method === 'POST' && path === '/v1/auth/logout') {
      if (Object.values(state.records[studentId] ?? {}).some(r => r.attempt && !r.submission?.local_locked)) {
        throw new HttpError(409, 'EXAM_IN_PROGRESS', 'Submit your in-progress exams before signing out.')
      }
      const next = structuredClone(state)
      delete next.sessions[session.session_id]
      await persist(next)
      return { status: 204 }
    }
    if (req.method === 'GET' && path === '/v1/exams') {
      return { data: { exams: state.exams.map(exam => ({
        id: exam.id, title: exam.title, course_code: exam.course_code,
        starts_at: exam.starts_at, ends_at: exam.ends_at, duration_minutes: exam.duration_minutes,
        question_count: exam.questions.length, allowed_utilities: exam.allowed_utilities,
        status: status(exam, getRecord(studentId, exam.id)),
      })) } }
    }
    const match = path.match(/^\/v1\/exams\/([^/]+)(?:\/(start|submit|answers)(?:\/([^/]+))?)?$/)
    if (!match) throw new HttpError(404, 'NOT_FOUND', 'This resource does not exist.')
    const examId = decodeURIComponent(match[1]!)
    const exam = state.exams.find(exam => exam.id === examId)
    if (!exam) throw new HttpError(404, 'EXAM_NOT_FOUND', 'This exam does not exist.')
    const action = match[2]
    const record = structuredClone(getRecord(studentId, examId))
    if (req.method === 'GET' && !action) return { data: getPackage(exam, studentId) }
    if (req.method === 'POST' && action === 'start') {
      if (record.submission?.local_locked || record.attempt) return { data: getPackage(exam, studentId) }
      if (status(exam, record) !== 'available') throw new HttpError(403, 'EXAM_UNAVAILABLE', 'This exam is not currently available to start.')
      record.attempt = { started_at: isoNow(), expires_at: new Date(Math.min(now() + exam.duration_minutes * 60_000, Date.parse(exam.ends_at))).toISOString(), last_revision: 0 }
      await updateRecord(studentId, examId, record)
      return { data: getPackage(exam, studentId) }
    }
    if (req.method === 'PUT' && action === 'answers' && match[3]) {
      if (record.submission?.local_locked) throw new HttpError(409, 'EXAM_LOCKED', 'This exam has already been submitted. Your answers are locked.')
      if (!record.attempt) throw new HttpError(409, 'EXAM_NOT_STARTED', 'Start this exam before saving answers.')
      const questionId = decodeURIComponent(match[3])
      const question = exam.questions.find(question => question.id === questionId)
      if (!question) throw new HttpError(404, 'QUESTION_NOT_FOUND', 'This question does not exist.')
      const input = AnswerSaveRequestSchema.parse(await body(req))
      const previous = record.answers[questionId]
      if (previous?.revision === input.revision && JSON.stringify(previous.response) === JSON.stringify(input.response)) {
        const { response: _response, ...ack } = previous
        return { data: ack }
      }
      if (now() > Date.parse(record.attempt.expires_at) + 30_000) throw new HttpError(409, 'TIME_EXPIRED', 'The exam time has ended. Ask your invigilator about any unconfirmed changes.')
      if (input.revision <= record.attempt.last_revision) throw new HttpError(409, 'STALE_REVISION', 'A newer answer revision is already saved. Reload the exam state before retrying.', false, record.attempt.last_revision)
      const response = input.response
      const expectedType = question.type === 'short_text' || question.type === 'long_text' ? 'text' : question.type
      if (response.type !== expectedType) throw new HttpError(422, 'ANSWER_TYPE_MISMATCH', 'This answer does not match the question type.')
      if (response.type === 'mcq' && response.selected_option_ids.some(id => !question.options?.some(option => option.id === id))) throw new HttpError(422, 'INVALID_OPTION', 'The selected option does not exist.')
      if (response.type === 'code' && response.language !== (question.code_config?.language ?? 'text')) throw new HttpError(422, 'INVALID_LANGUAGE', 'Use the language supplied with this question.')
      const saved = { question_id: questionId, revision: input.revision, local_saved: true, local_saved_at: isoNow(), sync_state: offline ? 'offline' as const : 'queued' as const, response }
      record.answers[questionId] = saved
      record.attempt.last_revision = input.revision
      await updateRecord(studentId, examId, record)
      const { response: _response, ...ack } = saved
      return { data: ack }
    }
    if (req.method === 'POST' && action === 'submit') {
      const input = SubmissionRequestSchema.parse(await body(req))
      if (record.submission) {
        if (record.submission.submission_id === input.submission_id) return { data: record.submission }
        throw new HttpError(409, 'EXAM_LOCKED', 'This exam has already been submitted. Check its submission status.')
      }
      if (!record.attempt) throw new HttpError(409, 'EXAM_NOT_STARTED', 'Start this exam before submitting.')
      if (record.attempt.last_revision !== input.final_revision) throw new HttpError(409, 'REVISION_MISMATCH', 'The final revision does not match locally saved answers. Review the saved state before submitting.', false, record.attempt.last_revision)
      record.submission = { submission_id: input.submission_id, exam_id: examId, state: 'submitted', local_locked: true, sync_state: offline ? 'offline' : 'queued' }
      await updateRecord(studentId, examId, record)
      return { data: record.submission }
    }
    throw new HttpError(404, 'NOT_FOUND', 'This resource does not exist.')
  }

  const allowedOrigins = new Set(['http://127.0.0.1:1420', 'http://localhost:1420', 'tauri://localhost', 'http://tauri.localhost', 'https://tauri.localhost'])
  const server = createServer((req, res) => {
    const origin = req.headers.origin
    res.setHeader('Cache-Control', 'no-store')
    res.setHeader('Vary', 'Origin')
    if (origin && !allowedOrigins.has(origin)) {
      send(res, 403, { error: { code: 'ORIGIN_DENIED', message: 'This origin is not allowed.', retryable: false } })
      return
    }
    if (origin) res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return }
    void serialize(async () => {
      try {
        const result = await route(req)
        send(res, result.status ?? 200, result.data)
      } catch (error) {
        if (error instanceof z.ZodError) {
          send(res, 422, { error: { code: 'VALIDATION_FAILED', message: error.issues[0]?.message ?? 'Invalid payload.', retryable: false } })
        } else if (error instanceof HttpError) {
          send(res, error.status, { error: { code: error.code, message: error.message, retryable: error.retryable, ...(error.currentRevision !== undefined ? { current_revision: error.currentRevision } : {}) } })
        } else {
          console.error('Mock local service error:', error)
          send(res, 500, { error: { code: 'LOCAL_SERVICE_ERROR', message: 'The local service could not complete this request.', retryable: true } })
        }
      }
    })
  })
  server.requestTimeout = 15_000

  const syncTimer = setInterval(() => {
    void serialize(async () => {
      if (offline) return
      const next = structuredClone(state)
      let changed = false
      for (const records of Object.values(next.records)) {
        for (const record of Object.values(records)) {
          for (const item of [...Object.values(record.answers), ...(record.submission ? [record.submission] : [])]) {
            if (item.sync_state !== 'synced') { item.sync_state = 'synced'; changed = true }
          }
        }
      }
      if (changed) { next.lastSyncedAt = isoNow(); await persist(next) }
    }).catch(error => console.error('Mock sync error:', error))
  }, options.syncDelayMs ?? 2500)
  syncTimer.unref()

  return {
    server,
    setOffline: (value: boolean) => { offline = value },
    isOffline: () => offline,
    close: async () => {
      clearInterval(syncTimer)
      await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
      await queue
    },
  }
}

function send(res: ServerResponse, status: number, data?: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(data === undefined ? undefined : JSON.stringify(data))
}
