export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <img src="/exam-mark.svg" alt="" className="size-10" />
      <div>
        <div className="text-xl font-semibold tracking-[-0.04em]">Exam<span className="text-accent">OS</span></div>
        {!compact && <div className="mt-0.5 font-mono text-[9px] tracking-[0.17em] text-muted">BY SMARTSCRIPT</div>}
      </div>
    </div>
  )
}
