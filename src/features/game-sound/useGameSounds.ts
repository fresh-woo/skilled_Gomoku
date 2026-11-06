import { useEffect, useRef } from 'react'
import type { GameSound } from '../../entities/game/model/soundEvents'
import { playGameSounds } from './audio'

export function useGameSounds(cues: readonly GameSound[] | undefined) {
  const played = useRef<readonly GameSound[] | undefined>(undefined)
  useEffect(() => {
    if (cues && played.current !== cues) {
      played.current = cues
      void playGameSounds(cues)
    }
  }, [cues])
}
