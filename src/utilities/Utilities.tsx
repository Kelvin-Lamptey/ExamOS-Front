import { useState } from 'react'
import {
  ArrowUpRight,
  Calculator as CalculatorIcon,
  NotebookPen,
} from 'lucide-react'
import { Modal } from '../components/Modal'
import { Calculator } from './Calculator'
import { Scratchpad } from './Scratchpad'
import { useStudent } from '../app/AppRoot'

export function Utilities({
  allowed,
  scope,
  compact = false,
  disabled = false,
}: {
  allowed: string[]
  scope: string
  compact?: boolean
  disabled?: boolean
}) {
  const student = useStudent()
  const [open, setOpen] = useState<'calculator' | 'scratchpad' | null>(null)
  const supported = allowed.filter(
    (utility) => utility === 'calculator' || utility === 'scratchpad',
  )
  if (!supported.length)
    return (
      <p className="text-xs text-muted">
        No utilities are allowed in this exam.
      </p>
    )
  return (
    <>
      <h2
        className={
          compact ? 'eyebrow text-[9px] text-muted' : 'text-sm font-medium'
        }
      >
        {compact ? 'EXAM TOOLS' : 'A little extra thinking space'}
      </h2>
      <div
        className={
          compact ? 'mt-4 space-y-2' : 'mt-4 grid gap-4 sm:grid-cols-2'
        }
      >
        {supported.map((utility) => {
          const Icon = utility === 'calculator' ? CalculatorIcon : NotebookPen
          return (
            <button
              key={utility}
              disabled={disabled}
              className={compact ? 'utility-compact' : 'utility-card'}
              onClick={() => setOpen(utility)}
            >
              <Icon
                className={`${compact ? 'size-4' : 'size-5'} shrink-0 text-accent`}
              />
              <span className="flex-1 text-left">
                <span className="block text-xs font-medium capitalize">
                  {utility}
                </span>
                {!compact && (
                  <span className="mt-1.5 block text-[11px] text-muted">
                    {utility === 'calculator'
                      ? 'For the numbers you need to work out.'
                      : 'For the thoughts along the way.'}
                  </span>
                )}
              </span>
              <ArrowUpRight className="size-3.5 shrink-0 text-muted" />
            </button>
          )
        })}
      </div>
      {open && supported.includes(open) && (
        <Modal
          title={open === 'calculator' ? 'Calculator' : 'Scratchpad'}
          onClose={() => setOpen(null)}
          wide={open === 'scratchpad'}
        >
          {open === 'calculator' ? (
            <Calculator />
          ) : (
            <Scratchpad studentId={student.id} scope={scope} />
          )}
        </Modal>
      )}
    </>
  )
}
