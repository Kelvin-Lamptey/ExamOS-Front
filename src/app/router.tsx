import { createHashRouter } from 'react-router'
import { AppRoot, RequireSession } from './AppRoot'
import { AppShell } from '../components/AppShell'
import { LoginPage } from '../pages/LoginPage'
import { HomePage } from '../pages/HomePage'
import { ErrorState } from '../components/Feedback'

export const router = createHashRouter([
  {
    Component: AppRoot,
    errorElement: <main className="mx-auto max-w-xl p-10"><ErrorState error={new Error('Please reopen Exam OS to restore your last locally confirmed work.')} title="Unable to display this page" /></main>,
    children: [
      { path: '/login', Component: LoginPage },
      { Component: RequireSession, children: [
        { Component: AppShell, children: [
          { index: true, Component: HomePage },
          { path: '*', element: <ErrorState title="Page not found" error={new Error('Use My exams to return to your workspace.')} /> },
        ] },
      ] },
    ],
  },
])
