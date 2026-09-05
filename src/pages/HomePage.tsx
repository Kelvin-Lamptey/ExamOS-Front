import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CalendarDays, Cloud, LogOut, RefreshCw } from 'lucide-react'
import { useStudent } from '../app/AppRoot'
import { api } from '../api/client'
import { examsOptions, replaceSession, useSystemStatus } from '../state/queries'
import { ExamCard } from '../components/ExamCard'
import { ErrorState, LoadingState } from '../components/Feedback'
import { SyncIndicator } from '../components/SyncIndicator'
import { Utilities } from '../utilities/Utilities'

export function HomePage() {
  const student = useStudent()
  const exams = useQuery({ ...examsOptions, refetchInterval: 15_000 })
  const status = useSystemStatus()
  const [logoutError, setLogoutError] = useState<unknown>(null)
  const [loggingOut, setLoggingOut] = useState(false)
  const [filter, setFilter] = useState<'all' | 'active' | 'submitted'>('all')
  const active = exams.data?.filter(exam => ['available', 'in_progress'].includes(exam.status)).length ?? 0
  const submitted = exams.data?.filter(exam => exam.status === 'submitted').length ?? 0
  const visible = exams.data?.filter(exam => filter === 'all' || (filter === 'submitted' ? exam.status === 'submitted' : ['available', 'in_progress'].includes(exam.status)))
  async function logout() {
    setLoggingOut(true); setLogoutError(null)
    try { await api.logout(); replaceSession(null) }
    catch (error) { setLogoutError(error) }
    finally { setLoggingOut(false) }
  }
  return (
    <div className="mx-auto max-w-[1220px]">
      <div className="flex flex-wrap items-center justify-between gap-4"><p className="eyebrow">YOUR DAY, AT A GLANCE</p><span className="flex items-center gap-2 text-xs text-muted"><CalendarDays className="size-3.5" />{new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span></div>
      <div className="mt-5 flex flex-wrap items-end justify-between gap-5"><div><h1 className="text-[clamp(2rem,3vw,2.8rem)] font-semibold tracking-[-0.055em]">Welcome back, {student.display_name.split(' ')[0]}<span className="text-accent">.</span></h1><p className="mt-3 text-sm text-muted">A fresh page. A clear mind. Your exams are right here.</p></div><button className="button button-secondary button-small" onClick={() => void logout()} disabled={loggingOut || exams.data?.some(exam => exam.status === 'in_progress')} title={exams.data?.some(exam => exam.status === 'in_progress') ? 'Submit your in-progress exams before signing out.' : undefined}><LogOut className="size-3.5" />{loggingOut ? 'Signing out…' : 'Sign out'}</button></div>
      {logoutError ? <div className="mt-6"><ErrorState error={logoutError} /></div> : null}
      <section className="welcome-banner mt-9"><div className="relative z-10"><p className="eyebrow mb-3">MAKE ROOM FOR YOUR BEST WORK</p><h2 className="max-w-md text-2xl font-medium leading-snug tracking-tight">Everything you need.<br /><span className="text-accent">Space to focus.</span></h2><p className="mt-4 max-w-sm text-xs leading-relaxed text-muted">Your answers save as you go. If the internet drops, keep going. We’ll take care of the sync.</p></div><div className="banner-orbits" aria-hidden="true"><div /><div /><div /><img src="/exam-mark.svg" alt="" /></div><span className="absolute top-5 right-5 hidden font-mono text-[10px] tracking-widest text-accent/60 sm:block">EXAM OS / 01</span></section>
      <div className="stats-strip"><div><span className="stat-number">{exams.data?.length ?? '—'}</span><span>Exams today</span></div><div><span className="stat-number">{active}</span><span>Ready or in progress</span></div><div><span className="stat-number">{submitted.toString().padStart(2, '0')}</span><span>Submitted</span></div><div className="ml-auto hidden items-center gap-3 lg:flex"><Cloud className="size-5 text-accent" /><div><p className="text-xs text-paper">Your work, kept safe</p><p className="mt-1 text-[11px] text-muted">{status.data?.connectivity === 'offline' ? 'Local saving is available offline.' : 'Saved locally. Synced in the background.'}</p></div></div></div>
      <section className="mt-9" aria-labelledby="exams-heading">
        <div className="flex flex-wrap items-center justify-between gap-4"><h2 id="exams-heading" className="text-xl font-medium tracking-tight">Today’s exams <span className="ml-2 rounded-md border border-line px-2 py-0.5 font-mono text-xs text-muted">{exams.data?.length ?? 0}</span></h2><button className="icon-button" onClick={() => void exams.refetch()} aria-label="Refresh exams" disabled={exams.isFetching}><RefreshCw className={`size-4 ${exams.isFetching ? 'animate-spin' : ''}`} /></button></div>
        <div className="filter-tabs mt-5" role="group" aria-label="Filter exams">{(['all', 'active', 'submitted'] as const).map(value => <button key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>{value === 'all' ? 'All exams' : value === 'active' ? 'Ready & in progress' : 'Submitted'}</button>)}</div>
        {exams.isPending ? <LoadingState label="Finding today’s exams…" /> : exams.isError ? <ErrorState error={exams.error} retry={() => void exams.refetch()} /> : visible?.length ? <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">{visible.map(exam => <ExamCard key={exam.id} exam={exam} />)}</div> : <div className="panel mt-6 p-12 text-center"><p className="font-medium">{filter === 'submitted' ? 'No submissions yet.' : filter === 'active' ? 'Nothing ready to start right now.' : 'No exams scheduled for today.'}</p><p className="mt-2 text-sm text-muted">{filter === 'submitted' ? 'Your completed exams will appear here.' : 'Refresh to check for updates, or ask your invigilator.'}</p></div>}
      </section>
      <section className="mt-8"><Utilities allowed={['calculator', 'scratchpad']} scope="workspace" /></section>
      <footer className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-line pt-5 text-[10px] text-muted"><span>SMARTSCRIPT EXAM OS <span className="mx-2 text-line">/</span> A KenolTech product</span><SyncIndicator /></footer>
    </div>
  )
}
