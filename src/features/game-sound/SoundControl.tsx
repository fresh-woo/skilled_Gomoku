import { useEffect, useState } from 'react'
import { Button } from '../../design-system/Button'
import { setSoundEnabled, soundEnabled, unlockGameSound } from './audio'

export function SoundControl() {
  const [enabled, setEnabled] = useState(soundEnabled)
  useEffect(() => {
    const unlock = (event: Event) => { if (event.isTrusted) unlockGameSound() }
    document.addEventListener('pointerdown', unlock, true)
    document.addEventListener('keydown', unlock, true)
    return () => {
      document.removeEventListener('pointerdown', unlock, true)
      document.removeEventListener('keydown', unlock, true)
    }
  }, [])
  return <Button variant="secondary" aria-pressed={enabled} onClick={() => {
    setSoundEnabled(!enabled)
    setEnabled(!enabled)
  }}>효과음 {enabled ? '켜짐' : '꺼짐'}</Button>
}
