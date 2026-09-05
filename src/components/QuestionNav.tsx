import { Check, Flag } from 'lucide-react'
import type { Question } from '../api/contracts'
import { isAnswered, type DraftAnswer } from '../state/exam'

export function QuestionNav({ questions, answers, current, flagged, onSelect, disabled }: { questions: Question[]; answers: Record<string, DraftAnswer>; current: number; flagged: Set<string>; onSelect: (index: number) => void; disabled: boolean }) {
  const answered = questions.filter(question => answers[question.id] && !answers[question.id]!.invalid && isAnswered(answers[question.id]!.response)).length
  return <nav aria-label="Question navigation"><div className="flex items-center justify-between"><h2 className="text-sm font-medium">Questions</h2><span className="font-mono text-[11px] text-muted">{answered}/{questions.length}</span></div><div className="mt-4 h-1 overflow-hidden rounded-full bg-raised"><div className="h-full rounded-full bg-accent transition-all" style={{ width: `${answered / questions.length * 100}%` }} /></div><div className="question-grid mt-6">{questions.map((question, index) => {
    const answer = answers[question.id]
    const complete = answer && !answer.invalid && isAnswered(answer.response)
    return <button key={question.id} className={`question-nav-button ${index === current ? 'current' : ''} ${complete ? 'answered' : ''}`} onClick={() => onSelect(index)} disabled={disabled} aria-current={index === current ? 'step' : undefined} aria-label={`Question ${index + 1}${complete ? ', answered' : ', unanswered'}${flagged.has(question.id) ? ', marked for review' : ''}`}>{String(index + 1).padStart(2, '0')}{flagged.has(question.id) ? <Flag className="absolute -top-1 -right-1 size-3 fill-amber-200 text-amber-200" /> : complete ? <Check className="absolute right-1 bottom-1 size-2.5" /> : null}</button>
  })}</div><div className="mt-6 flex flex-wrap gap-x-4 gap-y-3 text-[10px] text-muted"><span className="flex items-center gap-1.5"><span className="size-2 rounded-sm border border-accent bg-accent/20" />Answered</span><span className="flex items-center gap-1.5"><span className="size-2 rounded-sm border border-line" />Unanswered</span><span className="flex items-center gap-1.5"><Flag className="size-2.5 text-amber-200" />For review</span></div></nav>
}
