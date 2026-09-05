import type { QuestionProps } from './types'

export function TextQuestion({ question, draft, disabled, onChange }: QuestionProps) {
  const value = draft.response.type === 'text' ? draft.response.value : ''
  const shared = { id: `answer-${question.id}`, value, disabled, maxLength: 100_000, spellCheck: false, autoComplete: 'off', className: 'input leading-relaxed', onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange({ type: 'text' as const, value: event.target.value }) }
  return <div><label htmlFor={shared.id} className="field-label text-xs text-muted">Your answer</label>{question.type === 'long_text' ? <textarea {...shared} rows={12} placeholder="Take your time. Develop your answer here…" className="input min-h-64 resize-y leading-7" /> : <input {...shared} type="text" placeholder="Type your answer…" />}<div className="mt-3 flex justify-between gap-4 text-[11px] text-muted"><span>Saved automatically as you type.</span><span>{value.trim() ? value.trim().split(/\s+/).length : 0} words</span></div></div>
}
