import { z } from 'zod'

export const SyncStateSchema = z.enum(['synced', 'queued', 'syncing', 'offline', 'error'])
export type SyncState = z.infer<typeof SyncStateSchema>
export const ExamStatusSchema = z.enum(['upcoming', 'available', 'in_progress', 'submitted', 'closed'])
export const QuestionTypeSchema = z.enum(['mcq', 'short_text', 'long_text', 'number', 'code'])
export type QuestionType = z.infer<typeof QuestionTypeSchema>

export const LoginRequestSchema = z.object({
  student_id: z.string().trim().min(1).max(100),
  access_code: z.string().regex(/^[A-Za-z0-9]{4}$/, 'Enter exactly 4 letters or numbers.'),
})
export type LoginRequest = z.infer<typeof LoginRequestSchema>

export const SessionSchema = z.object({
  session_id: z.string().min(1),
  student: z.object({
    id: z.string(),
    student_id: z.string(),
    display_name: z.string(),
    class_ids: z.array(z.string()),
  }),
  expires_at: z.iso.datetime(),
})
export type Session = z.infer<typeof SessionSchema>

export const ExamSummarySchema = z.object({
  id: z.string(),
  title: z.string(),
  course_code: z.string().optional(),
  starts_at: z.iso.datetime(),
  ends_at: z.iso.datetime(),
  duration_minutes: z.number().positive().optional(),
  status: ExamStatusSchema,
  question_count: z.number().int().nonnegative(),
  allowed_utilities: z.array(z.string()),
})
export type ExamSummary = z.infer<typeof ExamSummarySchema>

export const QuestionSchema = z.object({
  id: z.string(),
  order: z.number().int().positive(),
  type: QuestionTypeSchema,
  prompt: z.string(),
  required: z.boolean(),
  marks: z.number().nonnegative().optional(),
  options: z.array(z.object({ id: z.string(), label: z.string() })).optional(),
  code_config: z.object({ language: z.string().optional() }).optional(),
})
export type Question = z.infer<typeof QuestionSchema>

export const AnswerResponseSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('mcq'), selected_option_ids: z.array(z.string()).max(1) }),
  z.object({ type: z.literal('text'), value: z.string().max(100_000) }),
  z.object({ type: z.literal('number'), value: z.number().finite().nullable() }),
  z.object({ type: z.literal('code'), language: z.string(), source: z.string().max(100_000) }),
])
export type AnswerResponse = z.infer<typeof AnswerResponseSchema>
export const AnswerSaveRequestSchema = z.object({
  revision: z.number().int().positive(),
  response: AnswerResponseSchema,
  client_saved_at: z.iso.datetime(),
})
export type AnswerSaveRequest = z.infer<typeof AnswerSaveRequestSchema>
export const AnswerAcknowledgementSchema = z.object({
  question_id: z.string(),
  revision: z.number().int().positive(),
  local_saved: z.boolean(),
  local_saved_at: z.iso.datetime(),
  sync_state: SyncStateSchema,
})
export type AnswerAcknowledgement = z.infer<typeof AnswerAcknowledgementSchema>
export const SavedAnswerSchema = AnswerAcknowledgementSchema.extend({ response: AnswerResponseSchema })
export type SavedAnswer = z.infer<typeof SavedAnswerSchema>

export const AttemptSchema = z.object({
  started_at: z.iso.datetime(),
  expires_at: z.iso.datetime(),
  last_revision: z.number().int().nonnegative(),
})
export type Attempt = z.infer<typeof AttemptSchema>
export const SubmissionRequestSchema = z.object({
  submission_id: z.string().min(1).max(100),
  final_revision: z.number().int().nonnegative(),
})
export type SubmissionRequest = z.infer<typeof SubmissionRequestSchema>
export const SubmissionSchema = z.object({
  submission_id: z.string(),
  exam_id: z.string(),
  state: z.literal('submitted'),
  local_locked: z.boolean(),
  sync_state: SyncStateSchema,
})
export type Submission = z.infer<typeof SubmissionSchema>

// Recovery/start conventions are explicit additions to the supplied v1 package.
// Zod strips unrecognized properties: only student-safe fields enter UI state.
export const ExamPackageSchema = z.object({
  id: z.string(),
  title: z.string(),
  course_code: z.string().optional(),
  instructions: z.string(),
  duration_minutes: z.number().positive(),
  allowed_utilities: z.array(z.string()),
  questions: z.array(QuestionSchema).min(1),
  status: ExamStatusSchema,
  starts_at: z.iso.datetime(),
  ends_at: z.iso.datetime(),
  server_time: z.iso.datetime(),
  answers: z.array(SavedAnswerSchema),
  attempt: AttemptSchema.nullable(),
  submission: SubmissionSchema.nullable(),
})
export type ExamPackage = z.infer<typeof ExamPackageSchema>

export const HealthSchema = z.object({
  status: z.literal('ok'),
  contract_version: z.literal('v1'),
  mode: z.enum(['mock', 'local']),
})
export type Health = z.infer<typeof HealthSchema>
export const SystemStatusSchema = z.object({
  connectivity: z.enum(['online', 'offline']),
  sync_state: SyncStateSchema,
  pending_count: z.number().int().nonnegative(),
  last_synced_at: z.iso.datetime().nullable(),
  server_time: z.iso.datetime(),
})
export type SystemStatus = z.infer<typeof SystemStatusSchema>

export const ApiErrorBodySchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    retryable: z.boolean(),
    current_revision: z.number().int().nonnegative().optional(),
  }),
})
