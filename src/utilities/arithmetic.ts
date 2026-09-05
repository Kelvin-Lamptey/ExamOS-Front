// A small arithmetic parser: no eval, Function, scripts, or external execution.
export function calculate(expression: string): string {
  const source = expression
    .replaceAll('×', '*')
    .replaceAll('÷', '/')
    .replaceAll('−', '-')
    .replace(/\s/g, '')
  if (!source || source.length > 200)
    throw new Error('Enter an expression of up to 200 characters.')
  const tokens = source.match(/(?:\d+(?:\.\d*)?|\.\d+)|[()+\-*/%]/g)
  if (!tokens || tokens.join('') !== source)
    throw new Error('Use numbers and arithmetic operators only.')
  let position = 0
  function factor(): number {
    const token = tokens![position++]
    if (token === '+') return factor()
    if (token === '-') return -factor()
    let value: number
    if (token === '(') {
      value = sum()
      if (tokens![position++] !== ')')
        throw new Error('Close the parentheses to finish this expression.')
    } else if (token && /^(?:\d+(?:\.\d*)?|\.\d+)$/.test(token))
      value = Number(token)
    else throw new Error('Finish entering your expression.')
    while (tokens![position] === '%') {
      position++
      value /= 100
    }
    return value
  }
  function product(): number {
    let value = factor()
    while (tokens![position] === '*' || tokens![position] === '/') {
      const operator = tokens![position++]
      const operand = factor()
      if (operator === '/' && operand === 0)
        throw new Error('Cannot divide by zero.')
      value = operator === '*' ? value * operand : value / operand
    }
    return value
  }
  function sum(): number {
    let value = product()
    while (tokens![position] === '+' || tokens![position] === '-') {
      const operator = tokens![position++]
      const operand = product()
      value = operator === '+' ? value + operand : value - operand
    }
    return value
  }
  const result = sum()
  if (position !== tokens.length)
    throw new Error('Check the operators in your expression.')
  if (!Number.isFinite(result))
    throw new Error('The result is too large to display.')
  return Number(result.toPrecision(12)).toString()
}
