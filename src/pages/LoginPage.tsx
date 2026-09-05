import { Navigate, useNavigate } from 'react-router'
import { ArrowUpRight, Check, ShieldCheck } from 'lucide-react'
import { useApp } from '../app/AppRoot'
import { Brand } from '../components/Brand'
import { LoginForm } from '../components/LoginForm'
import { replaceSession } from '../state/queries'

export function LoginPage() {
  const { session, health } = useApp()
  const navigate = useNavigate()
  if (session) return <Navigate to="/" replace />
  return (
    <main className="login-layout">
      <section className="login-story">
        <Brand />
        <div className="relative z-10 my-auto py-16">
          <p className="eyebrow mb-6">A LITTLE FOCUS. A LOT OF POSSIBILITY.</p>
          <h1 className="max-w-lg text-[clamp(3rem,5vw,5.2rem)] leading-[1.02] font-semibold tracking-[-0.065em]">
            Your knowledge.
            <br />
            <span className="text-accent">Your moment.</span>
          </h1>
          <p className="mt-7 max-w-sm text-lg leading-relaxed text-muted">
            A calm space to think clearly, do your best work, and take the next
            step.
          </p>
          <div className="mt-12 flex flex-wrap gap-x-7 gap-y-3 text-xs text-muted">
            <span className="flex items-center gap-2">
              <Check className="size-4 text-accent" />
              Saved as you go
            </span>
            <span className="flex items-center gap-2">
              <Check className="size-4 text-accent" />
              Works without internet
            </span>
          </div>
        </div>
        <div className="relative z-10 flex items-center justify-between border-t border-line pt-6 text-xs text-muted">
          <span>
            Built by{' '}
            <span className="font-semibold text-paper">
              Kenol<span className="text-accent">Tech</span>
            </span>
          </span>
          <span className="flex items-center gap-1">
            Built around you
            <ArrowUpRight className="size-3.5" />
          </span>
        </div>
        <div className="story-grid" aria-hidden="true" />
      </section>
      <section className="flex flex-col justify-center px-7 py-12 sm:px-14 lg:px-20">
        <div className="mx-auto w-full max-w-[370px]">
          <span className="status-pill status-success mb-10">
            <span className="size-1.5 rounded-full bg-current" />
            Local exam service ready
          </span>
          <p className="eyebrow mb-3">STUDENT SIGN IN</p>
          <h2 className="text-3xl font-semibold tracking-[-0.04em]">
            Welcome to your workspace.
          </h2>
          <p className="mt-3 mb-9 text-sm leading-relaxed text-muted">
            Enter your details below. Your exams will be waiting for you.
          </p>
          <LoginForm
            onSuccess={(session) => {
              replaceSession(session)
              void navigate('/', { replace: true })
            }}
          />
          {health.mode === 'mock' && (
            <div className="mt-7 rounded-xl border border-dashed border-line p-4 text-xs leading-relaxed text-muted">
              <p className="mb-1 font-medium text-accent">Demo workspace</p>
              <p>
                Student ID:{' '}
                <span className="font-mono text-paper">GCTU-CS-001</span>
              </p>
              <p>
                Access code: <span className="font-mono text-paper">A7K2</span>
              </p>
            </div>
          )}
          <div className="mt-9 flex items-start gap-2.5 border-t border-line pt-6 text-xs leading-relaxed text-muted">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-accent" />
            <p>
              Your work stays on this device’s exam service and syncs when a
              connection is available.
            </p>
          </div>
        </div>
      </section>
    </main>
  )
}
