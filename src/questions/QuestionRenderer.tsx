import { McqQuestion } from './McqQuestion'
import { TextQuestion } from './TextQuestion'
import { NumberQuestion } from './NumberQuestion'
import { CodeQuestion } from './CodeQuestion'
import type { QuestionProps } from './types'

export function QuestionRenderer(props: QuestionProps) {
  switch (props.question.type) {
    case 'mcq':
      return <McqQuestion {...props} />
    case 'short_text':
    case 'long_text':
      return <TextQuestion {...props} />
    case 'number':
      return <NumberQuestion {...props} />
    case 'code':
      return <CodeQuestion {...props} />
  }
}
