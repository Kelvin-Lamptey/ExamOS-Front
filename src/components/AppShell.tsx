import { NavLink, Outlet, useLocation } from 'react-router'
import { BookOpen, CircleHelp, LayoutGrid, ShieldCheck } from 'lucide-react'
import { Brand } from './Brand'
import { SyncIndicator } from './SyncIndicator'
import { useApp, useStudent } from '../app/AppRoot'

export function AppShell() {
  const student = useStudent()
  const { health } = useApp()
  const location = useLocation()
  const inRunner = /\/exams\/[^/]+\/run/.test(location.pathname)
  const initials = student.display_name.split(' ').map(part => part[0]).slice(0, 2).join('')
  return (
    <div className={inRunner ? 'app-shell runner-shell' : 'app-shell'}>
      <a href="#main-content" className="skip-link">Skip to content</a>
      <header className="app-header">
        <Brand />
        <div className="hidden items-center gap-2 text-xs text-muted md:flex"><span className="size-1 rounded-full bg-muted" />Student workspace{health.mode === 'mock' && <span className="ml-2 rounded border border-line px-2 py-0.5 font-mono text-[10px] text-accent">MOCK</span>}</div>
        <div className="ml-auto flex items-center gap-6"><div className="hidden sm:block"><SyncIndicator compact /></div><div className="flex items-center gap-3"><div className="hidden text-right lg:block"><p className="text-sm font-medium">{student.display_name}</p><p className="mt-0.5 font-mono text-[10px] text-muted">{student.student_id}</p></div><div className="grid size-9 place-items-center rounded-full border border-accent/20 bg-accent/10 text-xs font-medium text-accent" aria-label={student.display_name}>{initials}</div></div></div>
      </header>
      {!inRunner && <aside className="workspace-sidebar">
        <p className="eyebrow px-3 text-[9px] text-muted">WORKSPACE</p>
        <nav className="mt-4 space-y-1" aria-label="Main navigation"><NavLink to="/" end className="sidebar-link"><LayoutGrid className="size-4" />My exams<span className="ml-auto text-accent">↗</span></NavLink></nav>
        <div className="mt-10 border-t border-line px-3 pt-6"><BookOpen className="mb-3 size-5 text-accent" /><p className="text-sm font-medium">One thing at a time.</p><p className="mt-2 text-xs leading-relaxed text-muted">Settle in. Take a breath.<br />You’ve prepared for this.</p></div>
        <div className="mt-auto space-y-5 px-3 pt-8"><div className="flex gap-2.5 text-xs text-muted"><CircleHelp className="size-4 shrink-0" /><p>Need a hand?<br /><span className="mt-1 block text-paper">Ask your invigilator.</span></p></div><div className="flex items-center gap-2 border-t border-line pt-5 text-[10px] text-muted"><ShieldCheck className="size-3.5" />Powered by KenolTech</div></div>
      </aside>}
      <main id="main-content" className={inRunner ? 'runner-main' : 'workspace-main'} tabIndex={-1}><Outlet /></main>
    </div>
  )
}
