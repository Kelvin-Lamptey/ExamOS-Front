import { useState } from 'react'
import { Check, Trash2 } from 'lucide-react'

export function Scratchpad({ studentId, scope }: { studentId: string; scope: string }) {
  const key = `examos.scratch.v1:${studentId}:${scope}`
  const [initial] = useState(() => {
    try { return { text: localStorage.getItem(key) ?? '', error: '' } }
    catch { return { text: '', error: 'Scratchpad storage is unavailable. Keep this window open to retain your notes.' } }
  })
  const [text, setText] = useState(initial.text)
  const [error, setError] = useState(initial.error)
  const [confirmClear, setConfirmClear] = useState(false)
  function save(value: string) {
    setText(value)
    try { localStorage.setItem(key, value); setError('') }
    catch { setError('Your latest rough work could not be stored. Keep this window open to retain it.') }
  }
  return <div><p className="mb-5 text-sm leading-relaxed text-muted">A little room to work things out. These notes stay on this device and are not submitted with your answers.</p><label htmlFor="scratchpad-notes" className="sr-only">Rough work</label><textarea id="scratchpad-notes" className="input min-h-80 resize-y bg-ink font-mono text-xs leading-7" rows={14} value={text} maxLength={100_000} onChange={event => save(event.target.value)} placeholder="Ideas, calculations, a place to start…" spellCheck={false} autoComplete="off" /><div className="mt-4 flex flex-wrap items-center justify-between gap-3"><p className={`flex items-center gap-1.5 text-[11px] ${error ? 'text-amber-200' : 'text-muted'}`} role="status">{error || <><Check className="size-3" />Rough work saved on this device</>}</p><button className="button button-small button-secondary" disabled={!text} onClick={() => setConfirmClear(true)}><Trash2 className="size-3" />Clear notes</button></div>{confirmClear && <div className="mt-4 rounded-xl border border-amber-200/20 p-4"><p className="text-xs text-amber-200">Clear all rough work in this scratchpad? This cannot be undone.</p><div className="mt-3 flex gap-2"><button className="button button-small button-secondary" onClick={() => setConfirmClear(false)}>Keep notes</button><button className="button button-small button-primary" onClick={() => { save(''); setConfirmClear(false) }}>Clear this scratchpad</button></div></div>}</div>
}
