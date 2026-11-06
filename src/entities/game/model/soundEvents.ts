export type GameSound = 'skill' | 'place'
export type SoundEvent = Readonly<{ gameId: string; revision: number; cues: readonly GameSound[] }>

// Presentation events only: this does not decide game rules or expose card details.
export function actionSounds(action: GameSound | null): GameSound[] {
  return action ? [action] : []
}

export function createSoundCursor() {
  let gameId = ''
  let revision = -1
  return {
    // Baseline on join/resume/new game. Historical sounds are never replayed.
    sync(id: string, currentRevision: number) {
      gameId = id
      revision = currentRevision
    },
    consume(event: SoundEvent): readonly GameSound[] {
      if (!gameId || event.gameId !== gameId || event.revision <= revision) return []
      revision = event.revision
      return event.cues
    },
  }
}
