import { useState, type FormEvent } from 'react'
import { ArrowRight, LoaderCircle, LockKeyhole, UserRound } from 'lucide-react'
import { api, errorMessage } from '../api/client'
import { LoginRequestSchema, type Session } from '../api/contracts'

export function LoginForm({ onSuccess, studentId = '' }: { onSuccess: (session: Session) => void; studentId?: string }) {
  const [id, setId] = useState(studentId)
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    const result = LoginRequestSchema.safeParse({ student_id: id, access_code: code })
    if (!result.success) { setError('Enter your student ID and exactly 4 letters or numbers for your access code.'); return }
    setBusy(true); setError('')
    try { onSuccess(await api.login(result.data)) }
    catch (error) { setError(errorMessage(error)) }
    finally { setBusy(false) }
  }
  return (
    <form onSubmit={event => void submit(event)} className="space-y-6">
      <div>
        <label className="field-label" htmlFor="student-id">Student ID</label>
        <div className="relative"><UserRound className="field-icon" /><input id="student-id" className="input pl-11" value={id} onChange={event => setId(event.target.value)} readOnly={Boolean(studentId)} placeholder="e.g. GCTU-CS-001" autoComplete="username" autoCapitalize="none" spellCheck={false} required maxLength={100} /></div>
      </div>
      <div>
        <label className="field-label" htmlFor="access-code">Access code</label>
        <div className="relative"><LockKeyhole className="field-icon" /><input id="access-code" className="input pl-11 font-mono tracking-[0.25em]" value={code} onChange={event => setCode(event.target.value)} placeholder="••••" type="password" autoComplete="current-password" pattern="[A-Za-z0-9]{4}" minLength={4} maxLength={4} required aria-describedby="access-hint" /></div>
        <p className="mt-2 text-xs text-muted" id="access-hint">The 4-character code provided by your invigilator.</p>
      </div>
      {error && <p className="rounded-xl border border-amber-300/25 bg-amber-300/5 p-3 text-sm text-amber-200" role="alert">{error}</p>}
      <button className="button button-primary w-full" type="submit" disabled={busy}>{busy ? <><LoaderCircle className="size-4 animate-spin" />Signing in…</> : <>Enter workspace<ArrowRight className="size-4" /></>}</button>
    </form>
  )
}
