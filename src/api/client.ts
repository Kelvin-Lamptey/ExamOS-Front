import { z } from 'zod'
import {
  AnswerAcknowledgementSchema, ApiErrorBodySchema, ExamPackageSchema,
  ExamSummarySchema, HealthSchema, SessionSchema, SubmissionSchema,
  SystemStatusSchema, type AnswerSaveRequest, type LoginRequest,
  type SubmissionRequest,
} from './contracts'
import { getSessionToken, setSessionToken } from '../state/session'

export const API_BASE_URL = 'http://127.0.0.1:43100/v1'

export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 0,
    public readonly retryable = false,
    public readonly currentRevision?: number,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

type RequestOptions = { method?: 'GET' | 'POST' | 'PUT'; body?: unknown; keepalive?: boolean }

// This is the only network boundary in the student application. No Internet
// connectivity checks gate requests to the loopback service.
async function request<T>(path: string, schema: z.ZodType<T>, options: RequestOptions = {}): Promise<T> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8000)
  const token = getSessionToken()
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: options.method ?? 'GET',
      headers: {
        Accept: 'application/json',
        ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
      keepalive: options.keepalive,
      cache: 'no-store',
    })
    const payload: unknown = response.status === 204 ? null : await response.json().catch(() => null)
    if (!response.ok) {
      const parsed = ApiErrorBodySchema.safeParse(payload)
      const error = parsed.success ? parsed.data.error : undefined
      throw new ApiError(
        error?.code ?? 'SERVICE_ERROR',
        error?.message ?? `The local service returned an error (${response.status}). Please try again.`,
        response.status,
        error?.retryable ?? response.status >= 500,
        error?.current_revision,
      )
    }
    const result = schema.safeParse(payload)
    if (!result.success) {
      throw new ApiError('CONTRACT_MISMATCH', 'The local service returned an incompatible response. Ask your invigilator to check the service version.')
    }
    return result.data
  } catch (error) {
    if (error instanceof ApiError) throw error
    throw new ApiError('SERVICE_UNAVAILABLE', 'The local Exam OS service is unavailable. Your latest changes have not been confirmed. Reconnect to the local service and retry.', 0, true)
  } finally {
    clearTimeout(timeout)
  }
}

const examPath = (id: string) => `/exams/${encodeURIComponent(id)}`

export const api = {
  health: () => request('/health', HealthSchema),
  session: () => request('/session', SessionSchema),
  login: async (credentials: LoginRequest) => {
    const session = await request('/auth/login', SessionSchema, { method: 'POST', body: credentials })
    setSessionToken(session.session_id)
    return session
  },
  logout: async () => {
    await request('/auth/logout', z.null(), { method: 'POST' })
    setSessionToken(null)
  },
  exams: async () => (await request('/exams', z.object({ exams: z.array(ExamSummarySchema) }))).exams,
  exam: (id: string) => request(examPath(id), ExamPackageSchema),
  startExam: (id: string) => request(`${examPath(id)}/start`, ExamPackageSchema, { method: 'POST', body: {} }),
  saveAnswer: (examId: string, questionId: string, body: AnswerSaveRequest, keepalive = false) =>
    request(`${examPath(examId)}/answers/${encodeURIComponent(questionId)}`, AnswerAcknowledgementSchema, { method: 'PUT', body, keepalive }),
  systemStatus: () => request('/system/status', SystemStatusSchema),
  submit: (id: string, body: SubmissionRequest) => request(`${examPath(id)}/submit`, SubmissionSchema, { method: 'POST', body }),
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.'
}
