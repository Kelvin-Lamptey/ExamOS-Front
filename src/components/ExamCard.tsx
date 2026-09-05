import { ArrowRight, CheckCircle2, Clock3, FileText, LockKeyhole } from 'lucide-react'
import { Link } from 'react-router'
import type { ExamSummary } from '../api/contracts'

const statusLabel: Record<ExamSummary['status'], string> = { available: 'Ready to start', in_progress: 'In progress', upcoming: 'Upcoming', submitted: 'Submitted', closed: 'Closed' }
export function ExamCard({ exam }: { exam: ExamSummary }) {
  const canOpen = ['available', 'in_progress', 'submitted'].includes(exam.status)
  const time = new Date(exam.starts_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  return (
    <article className={`exam-card ${canOpen && exam.status !== 'submitted' ? 'exam-card-available' : ''}`}>
      <div className="flex items-start justify-between gap-3"><div className="course-icon"><FileText className="size-5" /></div><span className={`status-pill ${exam.status === 'available' || exam.status === 'submitted' ? 'status-success' : ''}`}>{exam.status === 'submitted' && <CheckCircle2 className="size-3" />}{statusLabel[exam.status]}</span></div>
      <p className="mt-6 font-mono text-[11px] tracking-wider text-accent">{exam.course_code ?? 'EXAMINATION'}</p>
      <h3 className="mt-2 text-xl leading-snug font-medium tracking-tight">{exam.title}</h3>
      <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted">{exam.duration_minutes !== undefined && <span className="flex items-center gap-1.5"><Clock3 className="size-3.5" />{exam.duration_minutes} min</span>}<span className="flex items-center gap-1.5"><FileText className="size-3.5" />{exam.question_count} {exam.question_count === 1 ? 'question' : 'questions'}</span></div>
      <div className="mt-auto pt-7"><div className="border-t border-line pt-5">{canOpen ? <Link className={`button w-full ${exam.status !== 'submitted' ? 'button-primary' : 'button-secondary'}`} to={`/exams/${exam.id}${exam.status === 'submitted' ? '/submitted' : ''}`}>{exam.status === 'submitted' ? 'View submission' : exam.status === 'in_progress' ? 'Continue exam' : 'View exam'}<ArrowRight className="size-4" /></Link> : <div className="flex h-11 items-center justify-center gap-2 text-xs text-muted"><LockKeyhole className="size-3.5" />{exam.status === 'upcoming' ? `Opens at ${time}` : 'Exam window has closed'}</div>}</div></div>
    </article>
  )
}
