import { createContext, useContext } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Navigate, Outlet } from 'react-router'
import { api } from '../api/client'
import type { Health, Session } from '../api/contracts'
import { sessionOptions } from '../state/queries'
import { Brand } from '../components/Brand'
import { ErrorState, LoadingState } from '../components/Feedback'
import { ArrowRight, LoaderCircle, RefreshCw } from 'lucide-react'

const AppContext = createContext<{ session: Session | null; health: Health } | null>(null)
export function useApp() {
  const context = useContext(AppContext)
  if (!context) throw new Error('App context is not available')
  return context
}
export function useStudent() {
  const { session } = useApp()
  if (!session) throw new Error('A student session is required')
  return session.student
}

export function AppRoot() {
  const health = useQuery({ queryKey: ['health'], queryFn: api.health, staleTime: Infinity, refetchInterval: query => query.state.status === 'error' ? 5000 : false })
  const session = useQuery({ ...sessionOptions, enabled: health.isSuccess })
  if (!health.data) {
    return (
      <main className="boot-screen">
        <Brand />
        <div className="boot-orbit" aria-hidden="true"><div /><img src="/exam-mark.svg" alt="" /></div>
        <div className="max-w-md text-center">
          <p className="eyebrow mb-4">YOUR FOCUSED SPACE FOR EXAMS</p>
          <h1 className="text-3xl font-semibold tracking-tight">{health.isError ? 'Let’s get you connected.' : 'Preparing your workspace.'}</h1>
          <p className="mt-4 leading-relaxed text-muted">{health.isError ? 'The local Exam OS service isn’t responding yet. We’ll keep checking. You can retry, or ask your invigilator for help.' : 'Connecting to the local Exam OS service. You’ll be ready in a moment.'}</p>
          {health.isError ? <button onClick={() => void health.refetch()} disabled={health.isFetching} className="button button-primary mt-7"><RefreshCw className={`size-4 ${health.isFetching ? 'animate-spin' : ''}`} />Retry connection<ArrowRight className="size-4" /></button> : <LoaderCircle className="mx-auto mt-7 size-6 animate-spin text-accent" />}
          {health.isError && <p className="mt-5 text-xs text-muted">This is a local service connection. Internet access is not required.</p>}
        </div>
        <p className="boot-footer">A KenolTech product</p>
      </main>
    )
  }
  if (session.isPending) return <LoadingState label="Restoring your session…" />
  if (session.isError) return <main className="mx-auto max-w-2xl p-8"><Brand /><div className="mt-12"><ErrorState error={session.error} retry={() => void session.refetch()} /></div></main>
  return <AppContext.Provider value={{ session: session.data, health: health.data }}><Outlet /></AppContext.Provider>
}

export function RequireSession() {
  return useApp().session ? <Outlet /> : <Navigate to="/login" replace />
}
