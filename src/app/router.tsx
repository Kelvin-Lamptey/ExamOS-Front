import { createHashRouter } from 'react-router'

export const router = createHashRouter([
  {
    path: '*',
    element: (
      <main className="grid min-h-screen place-items-center p-8">
        <div>
          <p className="eyebrow">SMARTSCRIPT · STUDENT WORKSPACE</p>
          <h1 className="mb-4 text-5xl font-semibold tracking-tight">Exam OS</h1>
          <p className="text-muted">Your focused space for exams.</p>
        </div>
      </main>
    ),
  },
])
