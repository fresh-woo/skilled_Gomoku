import { useEffect, useState } from 'react'
import type { OnlineTurnClock } from '../../../entities/game/model/onlineTurn'

export function Countdown({ label, deadline, remainingMs }: OnlineTurnClock & { label: string }) {
  const [now, setNow] = useState(() => performance.now())
  useEffect(() => {
    if (deadline === null) return
    const timer = setInterval(() => setNow(performance.now()), 200)
    return () => clearInterval(timer)
  }, [deadline])

  const seconds = Math.max(0, Math.ceil((deadline === null ? remainingMs : deadline - now) / 1_000))
  return <p role="timer" aria-label={label}>{label} {seconds}초{deadline === null && ' · 일시 정지'}</p>
}
