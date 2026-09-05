import { AlertCircle, LoaderCircle, RefreshCw } from 'lucide-react'
import { errorMessage } from '../api/client'

export function LoadingState({ label = 'Loading your workspace…' }: { label?: string }) {
  return <div className="flex min-h-64 items-center justify-center gap-3 text-muted" role="status"><LoaderCircle className="size-5 animate-spin" />{label}</div>
}

export function ErrorState({ error, retry, title = 'Something needs attention' }: { error: unknown; retry?: () => void; title?: string }) {
  return (
    <div className="error-panel" role="alert">
      <AlertCircle className="size-5 shrink-0" />
      <div className="min-w-0 flex-1"><p className="font-medium">{title}</p><p className="mt-1 text-sm leading-relaxed opacity-85">{errorMessage(error)}</p></div>
      {retry && <button className="button button-small button-secondary shrink-0" onClick={retry}><RefreshCw className="size-4" />Retry</button>}
    </div>
  )
}
