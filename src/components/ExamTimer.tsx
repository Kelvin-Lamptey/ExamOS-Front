import { useEffect, useRef, useState } from 'react'
import { Clock3 } from 'lucide-react'

export function ExamTimer({ expiresAt, serverTime, onExpire }: { expiresAt: string; serverTime: string; onExpire: () => void }) {
  const baseline = useRef({ service: Date.parse(serverTime), monotonic: performance.now() })
  const calculate = () => Math.max(0, Math.ceil((Date.parse(expiresAt) - baseline.current.service - (performance.now() - baseline.current.monotonic)) / 1000))
  const [remaining, setRemaining] = useState(calculate)
  const expired = useRef(false)
  useEffect(() => {
    const tick = () => {
      const seconds = Math.max(0, Math.ceil((Date.parse(expiresAt) - baseline.current.service - (performance.now() - baseline.current.monotonic)) / 1000))
      setRemaining(seconds)
      if (seconds === 0 && !expired.current) { expired.current = true; onExpire() }
    }
    tick()
    const timer = setInterval(tick, 1000)
    return () => clearInterval(timer)
  }, [expiresAt, onExpire])
  const hours = Math.floor(remaining / 3600)
  const minutes = Math.floor((remaining % 3600) / 60)
  const seconds = remaining % 60
  const time = `${hours > 0 ? `${String(hours).padStart(2, '0')}:` : ''}${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  return <div className={`exam-timer ${remaining <= 300 ? 'timer-warning' : ''}`}><Clock3 className="size-4" /><div><p className="font-mono text-lg font-medium leading-tight tabular-nums" aria-label={`${hours} hours ${minutes} minutes ${seconds} seconds remaining`}>{time}</p><p className="mt-1 text-[9px] tracking-wider uppercase">Time remaining</p></div>{remaining <= 300 && <span className="sr-only" role="status">{remaining === 0 ? 'Time has ended. Submitting your saved answers.' : 'Five minutes or less remaining.'}</span>}</div>
}
