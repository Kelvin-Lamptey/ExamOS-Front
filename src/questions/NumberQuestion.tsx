import type { QuestionProps } from './types'

export function NumberQuestion({ question, draft, disabled, onChange }: QuestionProps) {
  const raw = draft.rawNumber ?? (draft.response.type === 'number' ? draft.response.value?.toString() ?? '' : '')
  return <div className="max-w-md"><label htmlFor={`answer-${question.id}`} className="field-label text-xs text-muted">Your numeric answer</label><input id={`answer-${question.id}`} className="input font-mono text-xl" type="text" inputMode="decimal" autoComplete="off" value={raw} maxLength={100} disabled={disabled} placeholder="Enter a number" aria-invalid={Boolean(draft.invalid)} aria-describedby={`number-hint-${question.id}`} onChange={event => {
    const value = event.target.value
    const trimmed = value.trim()
    const valid = trimmed === '' || (/^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/.test(trimmed) && Number.isFinite(Number(trimmed)))
    onChange({ type: 'number', value: trimmed && valid ? Number(trimmed) : null }, { raw: value, error: valid ? null : 'Finish entering a valid number before moving on.' })
  }} /><p id={`number-hint-${question.id}`} className={`mt-3 text-xs ${draft.invalid ? 'text-amber-200' : 'text-muted'}`}>{draft.invalid ?? 'Use a decimal point for decimals. The calculator is available if permitted.'}</p></div>
}
