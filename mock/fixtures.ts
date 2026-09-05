import type { ExamSummary, Question, Session } from '../src/api/contracts.ts'

export type SeedExam = Omit<ExamSummary, 'status' | 'question_count'> & {
  instructions: string
  duration_minutes: number
  questions: Question[]
}

export const students: { accessCode: string; student: Session['student'] }[] = [
  {
    accessCode: 'A7K2',
    student: {
      id: 'stu_001',
      student_id: 'GCTU-CS-001',
      display_name: 'Kelvin Lamptey',
      class_ids: ['cls_cs_d'],
    },
  },
  {
    accessCode: 'B8L3',
    student: {
      id: 'stu_002',
      student_id: 'GCTU-CS-002',
      display_name: 'Ama Mensah',
      class_ids: ['cls_cs_d'],
    },
  },
]

export function createExams(now: number): SeedExam[] {
  const midnight = new Date(now)
  midnight.setUTCHours(0, 0, 0, 0)
  const today = midnight.getTime()
  const iso = (time: number) => new Date(time).toISOString()
  return [
    {
      id: 'exam_ooad_001',
      title: 'Object Oriented Analysis and Design',
      course_code: 'CSOO 242',
      starts_at: iso(today),
      ends_at: iso(today + 86_400_000),
      duration_minutes: 120,
      allowed_utilities: ['calculator', 'scratchpad'],
      instructions:
        'Read each question carefully before answering.\nAnswer all required questions. You can move between questions and review your work before submitting.\nYour answers are saved to this device’s exam service as you work. You can continue if the internet disconnects.\nOnce you submit, your answers are locked and cannot be changed.',
      questions: [
        {
          id: 'q1',
          order: 1,
          type: 'mcq',
          prompt:
            'Which object-oriented concept hides implementation details and exposes only the essential features of an object?',
          required: true,
          marks: 2,
          options: [
            { id: 'a', label: 'Encapsulation' },
            { id: 'b', label: 'Inheritance' },
            { id: 'c', label: 'Polymorphism' },
            { id: 'd', label: 'Association' },
          ],
        },
        {
          id: 'q2',
          order: 2,
          type: 'short_text',
          prompt:
            'What is the name of the UML diagram used to describe interactions between a system and its external users?',
          required: true,
          marks: 3,
        },
        {
          id: 'q3',
          order: 3,
          type: 'long_text',
          prompt:
            'Explain cohesion and coupling in object-oriented design. Describe how they influence the maintainability of a software system, using an example.',
          required: true,
          marks: 10,
        },
        {
          id: 'q4',
          order: 4,
          type: 'number',
          prompt:
            'A system has 8 classes. Each class is directly associated with every other class exactly once. How many unique associations are there in total?',
          required: true,
          marks: 5,
        },
        {
          id: 'q5',
          order: 5,
          type: 'code',
          prompt:
            'Write a simple Java class named Student. Include a private name field, a constructor that accepts a name, and a public method that returns the name.',
          required: false,
          marks: 10,
          code_config: { language: 'java' },
        },
      ],
    },
    {
      id: 'exam_db_002',
      title: 'Database Management Systems',
      course_code: 'CSDB 244',
      starts_at: iso(now + 3_600_000),
      ends_at: iso(now + 10_800_000),
      duration_minutes: 90,
      allowed_utilities: ['scratchpad'],
      instructions:
        'Answer the following question. Your work is saved locally.',
      questions: [
        {
          id: 'db_q1',
          order: 1,
          type: 'long_text',
          prompt: 'Describe the purpose of database normalization.',
          required: true,
          marks: 10,
        },
      ],
    },
    {
      id: 'exam_networks_003',
      title: 'Computer Networks',
      course_code: 'CSCN 246',
      starts_at: iso(now - 10_800_000),
      ends_at: iso(now - 3_600_000),
      duration_minutes: 60,
      allowed_utilities: [],
      instructions: 'Answer the following question.',
      questions: [
        {
          id: 'net_q1',
          order: 1,
          type: 'short_text',
          prompt: 'Expand the acronym LAN.',
          required: true,
          marks: 2,
        },
      ],
    },
  ]
}
