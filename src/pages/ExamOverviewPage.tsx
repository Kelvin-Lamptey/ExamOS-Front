import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, Navigate, useNavigate, useParams } from 'react-router'
import { ArrowLeft, ArrowRight, Check, Clock3, FileText, LoaderCircle, ShieldCheck } from 'lucide-react'
import { api } from '../api/client'
import { examOptions, queryClient } from '../state/queries'
import { ErrorState, LoadingState } from '../components/Feedback'

export function ExamOverviewPage() {
  const { examId = '' } = useParams()
  const navigate = useNavigate()
  const exam = useQuery(examOptions(examId))
  const [accepted, setAccepted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)
  if (exam.isPending) return <LoadingState label="Opening your exam…" />
  if (exam.isError) return <ErrorState error={exam.error} retry={() => void exam.refetch()} />
  const data = exam.data
  if (data.submission?.local_locked) return <Navigate to={`/exams/${examId}/submitted`} replace />
  async function start() {
    if (busy) return
    setBusy(true); setError(null)
    try {
      const started = await api.startExam(examId)
      queryClient.setQueryData(['exam', examId], started)
      void queryClient.invalidateQueries({ queryKey: ['exams'] })
      void navigate(`/exams/${examId}/${started.submission?.local_locked ? 'submitted' : 'run'}`)
    } catch (error) { setError(error) }
    finally { setBusy(false) }
  }
  return <div className="mx-auto max-w-4xl"><Link className="back-link" to="/"><ArrowLeft className="size-4" />My exams</Link><div className="mt-9 flex flex-wrap items-center gap-3"><p className="eyebrow">{data.course_code ?? 'EXAMINATION'}</p><span className="status-pill status-success">{data.attempt ? 'In progress' : data.status === 'available' ? 'Ready to start' : data.status}</span></div><h1 className="mt-4 max-w-2xl text-[clamp(2rem,4vw,3.4rem)] font-semibold leading-[1.1] tracking-[-0.055em]">{data.title}</h1><p className="mt-5 text-sm text-muted">Take a moment to read the instructions before you begin.</p><div className="my-8 flex flex-wrap gap-8 border-y border-line py-6"><div className="flex items-center gap-3"><Clock3 className="size-5 text-accent" /><div><p className="text-sm font-medium">{data.duration_minutes} minutes</p><p className="mt-1 text-xs text-muted">Exam duration</p></div></div><div className="flex items-center gap-3"><FileText className="size-5 text-accent" /><div><p className="text-sm font-medium">{data.questions.length} questions</p><p className="mt-1 text-xs text-muted">{data.questions.filter(q => q.required).length} required</p></div></div><div className="flex items-center gap-3"><ShieldCheck className="size-5 text-accent" /><div><p className="text-sm font-medium">Saved on this device</p><p className="mt-1 text-xs text-muted">Internet is optional</p></div></div></div><section className="panel p-7"><h2 className="text-lg font-medium tracking-tight">Before you begin</h2><div className="mt-5 space-y-4">{data.instructions.split('\n').filter(Boolean).map((line, index) => <div className="flex gap-3" key={index}><span className="mt-0.5 font-mono text-[11px] text-accent">{String(index + 1).padStart(2, '0')}</span><p className="text-sm leading-7 whitespace-pre-wrap text-muted">{line}</p></div>)}</div></section><section className="mt-7"><h2 className="text-sm font-medium">Allowed utilities</h2><div className="mt-3 flex flex-wrap gap-3">{data.allowed_utilities.length ? data.allowed_utilities.map(utility => <span className="status-pill" key={utility}><Check className="size-3 text-accent" /><span className="capitalize">{utility}</span></span>) : <p className="text-xs text-muted">No utilities are allowed in this exam.</p>}</div></section>{error ? <div className="mt-6"><ErrorState error={error} /></div> : null}<div className="mt-9 border-t border-line pt-6">{!data.attempt && <label className="mb-6 flex cursor-pointer items-start gap-3 text-sm text-muted"><input type="checkbox" className="mt-0.5 size-4 accent-accent" checked={accepted} onChange={event => setAccepted(event.target.checked)} /><span>I’ve read the instructions and I’m ready to begin.</span></label>}<div className="flex flex-wrap items-center justify-between gap-5"><p className="max-w-sm text-xs leading-relaxed text-muted">{data.attempt ? 'Your timer is already running. Continue to pick up where you left off.' : 'The timer starts when you begin. You can review your answers before submitting.'}</p><button className="button button-primary" onClick={() => void start()} disabled={busy || (!data.attempt && (!accepted || data.status !== 'available'))}>{busy ? <LoaderCircle className="size-4 animate-spin" /> : null}{data.attempt ? 'Continue exam' : 'Start exam'}<ArrowRight className="size-4" /></button></div></div></div>
}
