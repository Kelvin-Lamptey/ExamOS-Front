import type { QuestionProps } from './types'

export function CodeQuestion({
  question,
  draft,
  disabled,
  onChange,
}: QuestionProps) {
  const response =
    draft.response.type === 'code'
      ? draft.response
      : {
          type: 'code' as const,
          language: question.code_config?.language ?? 'text',
          source: '',
        }
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <label className="text-xs text-muted" htmlFor={`answer-${question.id}`}>
          Your code
        </label>
        <span className="rounded-md border border-line bg-raised px-2 py-1 font-mono text-[10px] text-accent">
          {response.language}
        </span>
      </div>
      <textarea
        id={`answer-${question.id}`}
        className="input min-h-80 resize-y bg-deep/60 font-mono text-[13px] leading-7"
        value={response.source}
        rows={14}
        disabled={disabled}
        onChange={(event) =>
          onChange({ ...response, source: event.target.value })
        }
        autoCapitalize="off"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        maxLength={100_000}
        placeholder="// Write your code here"
        style={{ tabSize: 2 }}
      />
      <p className="mt-3 text-[11px] leading-relaxed text-muted">
        Your code is saved as text. Code execution is not available during this
        exam.
      </p>
    </div>
  )
}
