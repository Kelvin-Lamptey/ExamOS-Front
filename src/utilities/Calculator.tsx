import { useState } from 'react'
import { Delete } from 'lucide-react'
import { calculate } from './arithmetic'
import { errorMessage } from '../api/client'

export function Calculator() {
  const [expression, setExpression] = useState('')
  const [result, setResult] = useState('0')
  const [error, setError] = useState('')
  const [evaluated, setEvaluated] = useState(false)
  function evaluate() {
    try {
      setResult(calculate(expression))
      setError('')
      setEvaluated(true)
    } catch (error) {
      setError(errorMessage(error))
    }
  }
  function press(key: string) {
    if (key === '=') {
      evaluate()
      return
    }
    if (key === 'AC') {
      setExpression('')
      setResult('0')
      setError('')
      setEvaluated(false)
      return
    }
    if (key === '⌫') {
      setExpression((value) => value.slice(0, -1))
      setEvaluated(false)
      setError('')
      return
    }
    setExpression((value) =>
      `${evaluated ? (/^[+−×÷%]$/.test(key) ? result : '') : value}${key}`.slice(
        0,
        200,
      ),
    )
    setEvaluated(false)
    setError('')
  }
  return (
    <div>
      <div className="rounded-xl border border-line bg-deep p-4">
        <label htmlFor="calculator-expression" className="sr-only">
          Calculator expression
        </label>
        <input
          id="calculator-expression"
          className="w-full bg-transparent text-right font-mono text-sm text-muted outline-none"
          value={expression}
          onChange={(event) => {
            setExpression(event.target.value)
            setEvaluated(false)
            setError('')
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === '=') {
              event.preventDefault()
              evaluate()
            }
          }}
          autoComplete="off"
          maxLength={200}
          placeholder="0"
        />
        <output
          className="mt-3 block overflow-x-auto text-right font-mono text-3xl text-paper"
          aria-label="Calculator result"
          aria-live="polite"
        >
          {result}
        </output>
      </div>
      {error && (
        <p className="mt-3 text-xs text-amber-200" role="alert">
          {error}
        </p>
      )}
      <div className="mt-4 grid grid-cols-4 gap-2">
        {[
          'AC',
          '(',
          ')',
          '÷',
          '7',
          '8',
          '9',
          '×',
          '4',
          '5',
          '6',
          '−',
          '1',
          '2',
          '3',
          '+',
          '%',
          '0',
          '.',
          '=',
          '⌫',
        ].map((key) => (
          <button
            key={key}
            className={`calculator-key ${key === '=' ? 'bg-accent! text-ink!' : /^[+−×÷]$/.test(key) ? 'text-accent' : ''} ${key === '⌫' ? 'col-span-4 h-9! text-xs!' : ''}`}
            onClick={() => press(key)}
            aria-label={
              key === '⌫'
                ? 'Backspace'
                : key === 'AC'
                  ? 'Clear calculator'
                  : key === '='
                    ? 'Equals'
                    : key
            }
          >
            {key === '⌫' ? <Delete className="mx-auto size-4" /> : key}
          </button>
        ))}
      </div>
      <p className="mt-4 text-[11px] text-muted">
        Use your keyboard or the buttons. % divides a value by 100.
      </p>
    </div>
  )
}
