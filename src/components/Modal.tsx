import { useEffect, useId, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'

export function Modal({ title, children, onClose, wide = false }: { title: string; children: ReactNode; onClose?: () => void; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null)
  const id = useId()
  useEffect(() => {
    const dialog = ref.current
    dialog?.showModal()
    return () => dialog?.close()
  }, [])
  return <dialog ref={ref} aria-labelledby={id} className={`modal ${wide ? 'modal-wide' : ''}`} onCancel={event => { event.preventDefault(); onClose?.() }}><div className="mb-6 flex items-center justify-between gap-4"><h2 id={id} className="text-xl font-medium tracking-tight">{title}</h2>{onClose && <button className="icon-button" onClick={onClose} aria-label="Close dialog"><X className="size-4" /></button>}</div>{children}</dialog>
}
