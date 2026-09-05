import { describe, expect, it } from 'vitest'
import { calculate } from './arithmetic'

describe('controlled calculator', () => {
  it.each([
    ['2+3×4', '14'],
    ['(2+3)×4', '20'],
    ['-4 + 8÷2', '0'],
    ['100×25%', '25'],
    ['0.1+0.2', '0.3'],
    ['.5×8', '4'],
    ['2×(-3)', '-6'],
  ])('evaluates %s', (input, expected) =>
    expect(calculate(input)).toBe(expected),
  )
  it.each([
    '1/0',
    'alert(1)',
    'globalThis',
    '2**3',
    '(2+3',
    '2+',
    '1;2',
    '2(3)',
    '',
  ])('rejects invalid input %s', (input) =>
    expect(() => calculate(input)).toThrow(),
  )
})
