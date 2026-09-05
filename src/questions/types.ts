import type { AnswerResponse, Question } from '../api/contracts'
import type { DraftAnswer } from '../state/exam'

export interface QuestionProps {
  question: Question
  draft: DraftAnswer
  disabled: boolean
  onChange: (response: AnswerResponse, numeric?: { raw: string; error: string | null }) => void
}
