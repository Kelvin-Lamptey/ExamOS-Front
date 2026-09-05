import { Check, Cloud, CloudOff, LoaderCircle, ServerOff } from 'lucide-react'
import { useSystemStatus } from '../state/queries'
import type { SyncState } from '../api/contracts'

export function SyncIndicator({ compact = false }: { compact?: boolean }) {
  const status = useSystemStatus()
  if (status.isError) return <span className="status-pill status-warning"><ServerOff className="size-3.5" />Local service unavailable</span>
  if (!status.data) return <span className="status-pill"><LoaderCircle className="size-3.5 animate-spin" />Checking connection</span>
  if (status.data.connectivity === 'offline') return <span className="status-pill status-warning"><CloudOff className="size-3.5" />{compact ? 'Offline' : 'Internet offline · local service ready'}</span>
  if (status.data.sync_state === 'error') return <span className="status-pill status-warning"><CloudOff className="size-3.5" />Sync needs attention</span>
  if (status.data.pending_count > 0) return <span className="status-pill"><Cloud className="size-3.5" />{status.data.pending_count} waiting to sync</span>
  return <span className="status-pill status-success"><span className="size-1.5 rounded-full bg-current" />{compact ? 'Connected' : 'Connected · all work synced'}</span>
}

export function SaveIndicator({ saving, error, saved, syncState, offline }: { saving: boolean; error?: string | null; saved: boolean; syncState?: SyncState; offline: boolean }) {
  let label = 'No changes yet'
  let Icon = Cloud
  if (error) { label = 'Not saved locally'; Icon = ServerOff }
  else if (saving) { label = 'Saving locally…'; Icon = LoaderCircle }
  else if (saved && (offline || syncState === 'offline')) { label = 'Saved locally – waiting to sync'; Icon = CloudOff }
  else if (saved && syncState === 'synced') { label = 'Synced'; Icon = Check }
  else if (saved) { label = 'Saved locally'; Icon = Check }
  return <span className={`inline-flex items-center gap-2 text-xs ${error ? 'text-amber-300' : 'text-muted'}`} role="status" aria-live="polite"><Icon className={`size-3.5 ${saving && !error ? 'animate-spin' : ''}`} />{label}</span>
}
