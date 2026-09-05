import type { QuestionProps } from './types'

export function McqQuestion({
  question,
  draft,
  disabled,
  onChange,
}: QuestionProps) {
  const selected =
    draft.response.type === 'mcq'
      ? draft.response.selected_option_ids[0]
      : undefined
  return (
    <fieldset disabled={disabled} className="space-y-3">
      <legend className="mb-5 text-xs text-muted">Select one answer.</legend>
      {question.options?.map((option, index) => (
        <label
          key={option.id}
          className={`mcq-option ${selected === option.id ? 'mcq-selected' : ''}`}
        >
          <input
            type="radio"
            className="sr-only"
            name={question.id}
            value={option.id}
            checked={selected === option.id}
            onChange={() =>
              onChange({ type: 'mcq', selected_option_ids: [option.id] })
            }
          />
          <span className="mcq-letter" aria-hidden="true">
            {String.fromCharCode(65 + index)}
          </span>
          <span className="flex-1 text-sm leading-relaxed">{option.label}</span>
          <span className="mcq-radio" aria-hidden="true" />
        </label>
      ))}
      {selected && (
        <button
          className="mt-3 text-xs text-muted underline decoration-line underline-offset-4 hover:text-accent"
          onClick={() => onChange({ type: 'mcq', selected_option_ids: [] })}
        >
          Clear selection
        </button>
      )}
    </fieldset>
  )
}
