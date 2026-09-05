import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, Navigate, useBlocker, useParams } from 'react-router'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Flag,
  LoaderCircle,
  LockKeyhole,
  Send,
  ShieldCheck,
} from 'lucide-react'
import { ApiError } from '../api/client'
import type { ExamPackage } from '../api/contracts'
import { useStudent } from '../app/AppRoot'
import { examOptions, queryClient, useSystemStatus } from '../state/queries'
import {
  ExamController,
  isAnswered,
  submissionIntentStore,
} from '../state/exam'
import { ErrorState, LoadingState } from '../components/Feedback'
import { ExamTimer } from '../components/ExamTimer'
import { QuestionNav } from '../components/QuestionNav'
import { SaveIndicator, SyncIndicator } from '../components/SyncIndicator'
import { QuestionRenderer } from '../questions/QuestionRenderer'
import { Modal } from '../components/Modal'
import { LoginForm } from '../components/LoginForm'
import { Utilities } from '../utilities/Utilities'
import { useNativeClose } from '../app/useNativeClose'

const questionLabels = {
  mcq: 'Multiple choice',
  short_text: 'Short answer',
  long_text: 'Written answer',
  number: 'Numeric answer',
  code: 'Code question',
}

export function ExamRunnerPage() {
  const { examId = '' } = useParams()
  const exam = useQuery(examOptions(examId))
  if (exam.isPending)
    return <LoadingState label="Restoring your exam and saved answers…" />
  if (exam.isError)
    return (
      <div className="p-8">
        <ErrorState error={exam.error} retry={() => void exam.refetch()} />
      </div>
    )
  if (exam.data.submission?.local_locked)
    return <Navigate to={`/exams/${examId}/submitted`} replace />
  if (!exam.data.attempt) return <Navigate to={`/exams/${examId}`} replace />
  return (
    <ExamWorkspace
      key={`${examId}:${exam.data.attempt.started_at}`}
      exam={exam.data}
    />
  )
}

function ExamWorkspace({ exam }: { exam: ExamPackage }) {
  const student = useStudent()
  const [controller] = useState(
    () =>
      new ExamController(
        exam,
        undefined,
        submissionIntentStore(student.id, exam),
      ),
  )
  const snapshot = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
  )
  const questions = [...exam.questions].sort((a, b) => a.order - b.order)
  const [index, setIndex] = useState(0)
  const [switching, setSwitching] = useState(false)
  const [flagged, setFlagged] = useState(new Set<string>())
  const [confirm, setConfirm] = useState(false)
  const [reauth, setReauth] = useState(false)
  const [navigationError, setNavigationError] = useState<unknown>(null)
  const closing = useNativeClose(controller, setNavigationError)
  const status = useSystemStatus()
  const heading = useRef<HTMLHeadingElement>(null)
  const question = questions[index]!
  const draft = snapshot.answers[question.id]!
  const answered = questions.filter(
    (question) =>
      !snapshot.answers[question.id]!.invalid &&
      isAnswered(snapshot.answers[question.id]!.response),
  ).length
  const requiredMissing = questions.filter(
    (question) =>
      question.required &&
      (snapshot.answers[question.id]!.invalid ||
        !isAnswered(snapshot.answers[question.id]!.response)),
  ).length
  const frozen = controller.isFrozen() || closing
  const blocker = useBlocker(
    useCallback(
      ({ currentLocation, nextLocation }) =>
        currentLocation.pathname !== nextLocation.pathname &&
        !controller.getSnapshot().submission?.local_locked &&
        (controller.getSnapshot().dirty ||
          controller.getSnapshot().saving ||
          controller.getSnapshot().submissionUncertain ||
          controller.getSnapshot().submitting),
      [controller],
    ),
  )

  useEffect(() => {
    if (blocker.state !== 'blocked') return
    if (
      controller.getSnapshot().submissionUncertain ||
      controller.getSnapshot().submitting
    ) {
      blocker.reset()
      return
    }
    let active = true
    void controller
      .flush()
      .then(() => {
        if (active) blocker.proceed()
      })
      .catch((error) => {
        if (active) setNavigationError(error)
      })
    return () => {
      active = false
    }
  }, [blocker, controller])

  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      const state = controller.getSnapshot()
      if (
        !state.submission?.local_locked &&
        (state.dirty ||
          state.saving ||
          state.submissionUncertain ||
          state.submitting)
      ) {
        event.preventDefault()
        event.returnValue = ''
        if (!state.submissionUncertain)
          void controller.flush(true).catch(() => undefined)
      }
    }
    const visibility = () => {
      if (document.visibilityState === 'hidden')
        void controller.flush(true).catch(() => undefined)
    }
    const restored = () => {
      void controller.flush().catch(() => undefined)
    }
    window.addEventListener('beforeunload', beforeUnload)
    window.addEventListener('examos:session-restored', restored)
    document.addEventListener('visibilitychange', visibility)
    const timer = setInterval(() => {
      if (
        !controller.getSnapshot().saving &&
        !controller.getSnapshot().submitting
      )
        void controller.reconcile().catch(() => undefined)
    }, 10_000)
    return () => {
      window.removeEventListener('beforeunload', beforeUnload)
      window.removeEventListener('examos:session-restored', restored)
      document.removeEventListener('visibilitychange', visibility)
      clearInterval(timer)
      controller.dispose()
    }
  }, [controller])

  useEffect(() => {
    if (
      status.data?.connectivity === 'online' &&
      status.data.sync_state === 'synced' &&
      status.data.pending_count === 0
    )
      controller.markSynced(status.data.server_time)
  }, [status.data, controller])

  useEffect(() => {
    heading.current?.focus({ preventScroll: true })
  }, [index])

  const onExpire = useCallback(() => {
    controller.expire()
    setConfirm(true)
    void controller.submit()
  }, [controller])

  async function selectQuestion(next: number) {
    if (next === index || switching || next < 0 || next >= questions.length)
      return
    setSwitching(true)
    setNavigationError(null)
    try {
      await controller.flush()
      setIndex(next)
    } catch (error) {
      setNavigationError(error)
    } finally {
      setSwitching(false)
    }
  }
  const sessionExpired =
    snapshot.errorCode === 'SESSION_EXPIRED' ||
    (status.error instanceof ApiError && status.error.status === 401)
  if (snapshot.submission?.local_locked)
    return <Navigate to={`/exams/${exam.id}/submitted`} replace />

  return (
    <>
      <div className="runner-topbar">
        <div className="min-w-0">
          <Link className="back-link text-[11px]" to="/">
            <ArrowLeft className="size-3.5" />
            My exams
          </Link>
          <div className="mt-3 flex min-w-0 items-center gap-3">
            <span className="shrink-0 rounded-md border border-line bg-raised px-2 py-1 font-mono text-[10px] text-accent">
              {exam.course_code ?? 'EXAM'}
            </span>
            <h1 className="truncate text-sm font-medium">{exam.title}</h1>
          </div>
        </div>
        <ExamTimer
          expiresAt={exam.attempt!.expires_at}
          serverTime={exam.server_time}
          onExpire={onExpire}
        />
      </div>
      <div className="exam-layout">
        <aside className="exam-sidebar">
          <QuestionNav
            questions={questions}
            answers={snapshot.answers}
            current={index}
            flagged={flagged}
            onSelect={(next) => void selectQuestion(next)}
            disabled={
              switching || snapshot.submitting || snapshot.submissionUncertain
            }
          />
          <div className="mt-8 border-t border-line pt-6">
            <Utilities
              allowed={exam.allowed_utilities}
              scope={exam.id}
              compact
              disabled={frozen}
            />
          </div>
          <div className="mt-auto pt-8">
            <div className="rounded-xl border border-line bg-ink/70 p-4">
              <ShieldCheck className="mb-2 size-4 text-accent" />
              <p className="text-xs leading-relaxed text-muted">
                You focus on your answers.
                <br />
                We’ll keep them saved.
              </p>
              <div className="mt-4">
                <SyncIndicator compact />
              </div>
            </div>
          </div>
        </aside>
        <section className="question-workspace" aria-label="Current question">
          {sessionExpired && (
            <div className="error-panel mb-5">
              <p className="flex-1 text-sm">
                Your session has expired. Sign in again to save your current
                work.
              </p>
              <button
                className="button button-small button-secondary"
                onClick={() => setReauth(true)}
              >
                Sign in again
              </button>
            </div>
          )}
          {snapshot.error && !sessionExpired && (
            <div className="mb-5">
              <ErrorState
                title="Your latest changes need saving"
                error={new Error(snapshot.error)}
                retry={() => {
                  void controller
                    .flush()
                    .then(() => {
                      setNavigationError(null)
                      if (blocker.state === 'blocked') blocker.proceed()
                    })
                    .catch(() => undefined)
                }}
              />
            </div>
          )}
          {navigationError && !snapshot.error ? (
            <div className="mb-5">
              <ErrorState
                error={navigationError}
                title="Stay on this question until your work is saved"
              />
            </div>
          ) : null}
          <div className="question-card">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <p className="eyebrow">
                QUESTION {String(index + 1).padStart(2, '0')}{' '}
                <span className="ml-1 text-muted/50">
                  / {String(questions.length).padStart(2, '0')}
                </span>
              </p>
              <button
                className={`button button-small button-secondary ${flagged.has(question.id) ? 'border-amber-200/30 text-amber-200' : ''}`}
                onClick={() =>
                  setFlagged((previous) => {
                    const next = new Set(previous)
                    if (next.has(question.id)) next.delete(question.id)
                    else next.add(question.id)
                    return next
                  })
                }
                aria-pressed={flagged.has(question.id)}
                disabled={frozen}
              >
                <Flag
                  className={`size-3.5 ${flagged.has(question.id) ? 'fill-current' : ''}`}
                />
                {flagged.has(question.id)
                  ? 'Marked for review'
                  : 'Mark for review'}
              </button>
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-2 text-[10px] text-muted">
              <span className="rounded-md border border-line px-2 py-1">
                {questionLabels[question.type]}
              </span>
              <span className="px-1">
                {question.required ? 'Required' : 'Optional'}
              </span>
              {question.marks !== undefined && (
                <>
                  <span className="size-0.5 rounded-full bg-muted" />
                  <span className="px-1">
                    {question.marks} {question.marks === 1 ? 'mark' : 'marks'}
                  </span>
                </>
              )}
            </div>
            <h2
              ref={heading}
              tabIndex={-1}
              className="question-prompt mt-6 outline-none"
            >
              {question.prompt}
            </h2>
            <div className="mt-8">
              <QuestionRenderer
                key={question.id}
                question={question}
                draft={draft}
                disabled={frozen}
                onChange={(response, numeric) =>
                  controller.change(question.id, response, numeric)
                }
              />
            </div>
            <div className="mt-7 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
              <SaveIndicator
                saving={
                  draft.version !== draft.acceptedVersion || snapshot.saving
                }
                error={draft.error}
                saved={draft.saved}
                syncState={draft.syncState}
                offline={status.data?.connectivity === 'offline'}
              />
              <span className="font-mono text-[10px] text-muted">
                {draft.revision > 0
                  ? `REV ${String(draft.revision).padStart(3, '0')}`
                  : 'READY FOR YOUR ANSWER'}
              </span>
            </div>
          </div>
          <div className="mt-6 flex items-center justify-between gap-4">
            <button
              className="button button-secondary"
              disabled={
                index === 0 ||
                switching ||
                snapshot.submitting ||
                snapshot.submissionUncertain
              }
              onClick={() => void selectQuestion(index - 1)}
            >
              <ArrowLeft className="size-4" />
              Previous
            </button>
            {index < questions.length - 1 ? (
              <button
                className="button button-primary"
                disabled={
                  switching ||
                  snapshot.submitting ||
                  snapshot.submissionUncertain
                }
                onClick={() => void selectQuestion(index + 1)}
              >
                {switching ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : null}
                Next question
                <ArrowRight className="size-4" />
              </button>
            ) : (
              <button
                className="button button-primary"
                disabled={snapshot.submitting || snapshot.submissionUncertain}
                onClick={() => {
                  setConfirm(true)
                  void controller.flush().catch(() => undefined)
                }}
              >
                Review & submit
                <Check className="size-4" />
              </button>
            )}
          </div>
          <p className="mt-6 text-center text-[11px] text-muted">
            You can revisit any question before submitting your exam.
          </p>
        </section>
      </div>
      <div className="runner-bottom-bar">
        <span className="text-xs text-muted">
          <span className="font-medium text-paper">
            {answered} of {questions.length}
          </span>{' '}
          questions answered
          {flagged.size > 0 && (
            <span className="ml-4 hidden text-amber-200 sm:inline">
              {flagged.size} marked for review
            </span>
          )}
        </span>
        <button
          className="button button-small button-secondary"
          onClick={() => {
            setConfirm(true)
            void controller.flush().catch(() => undefined)
          }}
          disabled={snapshot.submitting || snapshot.submissionUncertain}
        >
          <Send className="size-3.5" />
          Submit exam
        </button>
      </div>
      {(confirm || snapshot.submissionUncertain) && (
        <Modal
          title={
            snapshot.submissionUncertain
              ? 'Confirming your submission'
              : snapshot.expired
                ? 'Your exam time has ended'
                : 'Ready to hand it in?'
          }
          onClose={
            !snapshot.submitting &&
            !snapshot.submissionUncertain &&
            !snapshot.expired
              ? () => setConfirm(false)
              : undefined
          }
        >
          <div className="mb-5 grid size-12 place-items-center rounded-xl border border-accent/20 bg-accent/5 text-accent">
            <LockKeyhole className="size-5" />
          </div>
          <p className="text-sm leading-7 text-muted">
            {snapshot.submissionUncertain
              ? 'Your submission was sent, but its final status is not yet confirmed. Your answers are temporarily locked while we check the local service.'
              : snapshot.expired
                ? 'Answer editing has stopped. We’re saving your latest changes and submitting your work.'
                : 'Final submission locks your answers. You won’t be able to make any more changes to this exam.'}
          </p>
          <div className="my-6 rounded-xl border border-line bg-ink p-4">
            <p className="text-sm font-medium">
              {answered} of {questions.length} questions answered
            </p>
            {requiredMissing > 0 && (
              <p className="mt-2 text-xs text-amber-200">
                {requiredMissing} required{' '}
                {requiredMissing === 1 ? 'question is' : 'questions are'}{' '}
                unanswered.
              </p>
            )}
            {flagged.size > 0 && (
              <p className="mt-2 text-xs text-amber-200">
                {flagged.size}{' '}
                {flagged.size === 1 ? 'question is' : 'questions are'} still
                marked for review.
              </p>
            )}
          </div>
          {snapshot.submissionError && (
            <div className="mb-5">
              <ErrorState error={new Error(snapshot.submissionError)} />
            </div>
          )}
          <div className="flex flex-wrap justify-end gap-3">
            {snapshot.submissionUncertain ? (
              <>
                <button
                  className="button button-secondary"
                  onClick={() => void controller.checkSubmission()}
                  disabled={snapshot.submitting}
                >
                  Check submission
                </button>
                <button
                  className="button button-primary"
                  onClick={() => void controller.submit(true)}
                  disabled={snapshot.submitting}
                >
                  {snapshot.submitting ? (
                    <LoaderCircle className="size-4 animate-spin" />
                  ) : (
                    <Send className="size-4" />
                  )}
                  Retry submission
                </button>
              </>
            ) : (
              <>
                {!snapshot.expired && (
                  <button
                    className="button button-secondary"
                    onClick={() => setConfirm(false)}
                    disabled={snapshot.submitting}
                  >
                    Keep reviewing
                  </button>
                )}
                <button
                  className="button button-primary"
                  onClick={() => void controller.submit()}
                  disabled={snapshot.submitting}
                >
                  {snapshot.submitting ? (
                    <>
                      <LoaderCircle className="size-4 animate-spin" />
                      Saving & submitting…
                    </>
                  ) : (
                    <>
                      Submit final answers
                      <ArrowRight className="size-4" />
                    </>
                  )}
                </button>
              </>
            )}
          </div>
          <p className="mt-5 text-[11px] leading-relaxed text-muted">
            Your submission is saved locally first. Internet connectivity won’t
            prevent submission.
          </p>
        </Modal>
      )}
      {reauth && (
        <Modal
          title="Restore your student session"
          onClose={() => setReauth(false)}
        >
          <p className="mb-6 text-sm text-muted">
            Sign in with the same student ID. Your current draft will stay here.
          </p>
          <LoginForm
            studentId={student.student_id}
            onSuccess={(session) => {
              queryClient.setQueryData(['session'], session)
              void queryClient.invalidateQueries({
                queryKey: ['system-status'],
              })
              setReauth(false)
              void controller.flush().catch(() => undefined)
            }}
          />
        </Modal>
      )}
    </>
  )
}
