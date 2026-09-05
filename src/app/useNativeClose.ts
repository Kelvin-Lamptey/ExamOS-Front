import { useEffect, useState } from 'react'
import type { ExamController } from '../state/exam'

export function useNativeClose(controller: ExamController, onError: (error: unknown) => void) {
  const [closing, setClosing] = useState(false)
  useEffect(() => {
    if (!('__TAURI_INTERNALS__' in window)) return
    let active = true
    let unlisten: (() => void) | undefined
    void import('@tauri-apps/api/window').then(async ({ getCurrentWindow }) => {
      const stop = await getCurrentWindow().onCloseRequested(async event => {
        const snapshot = controller.getSnapshot()
        if (snapshot.submitting || snapshot.submissionUncertain) {
          event.preventDefault()
          onError(new Error('Wait for the local submission status to be confirmed before closing Exam OS.'))
          return
        }
        setClosing(true)
        try { await controller.flush() }
        catch (error) { event.preventDefault(); setClosing(false); onError(error) }
      })
      if (!active) stop()
      else unlisten = stop
    }).catch(onError)
    return () => { active = false; unlisten?.() }
  }, [controller, onError])
  return closing
}
