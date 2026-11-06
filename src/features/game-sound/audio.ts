import type { GameSound } from '../../entities/game/model/soundEvents.ts'
import { GAME_SOUND_GAIN, renderGameSound } from './synthesis.ts'

const preferenceKey = 'gomoku-sound-enabled-v1'
let enabled = true
try { enabled = localStorage.getItem(preferenceKey) !== 'false' } catch { /* Optional storage. */ }
let context: AudioContext | undefined
let master: GainNode | undefined
let resumeTask: Promise<void> | undefined
let preferenceVersion = 0

export const soundEnabled = () => enabled

// Called synchronously from a user gesture, never from a server message.
export function unlockGameSound() {
  if (!enabled) return
  try {
    if (!context || context.state === 'closed') {
      context = new AudioContext()
      master = context.createGain()
      master.gain.value = GAME_SOUND_GAIN
      master.connect(context.destination)
      resumeTask = undefined
    }
    if (context.state === 'suspended' && !resumeTask) {
      const task = context.resume().catch(() => {})
      resumeTask = task
      void task.finally(() => { if (resumeTask === task) resumeTask = undefined })
    }
  } catch { /* Unsupported/blocked audio must not interrupt play. */ }
}

export function setSoundEnabled(value: boolean) {
  enabled = value
  preferenceVersion++
  try { localStorage.setItem(preferenceKey, String(value)) } catch { /* Keep in memory. */ }
  if (context && master) {
    master.gain.cancelScheduledValues(context.currentTime)
    master.gain.setTargetAtTime(value ? GAME_SOUND_GAIN : 0, context.currentTime, 0.005)
  }
  if (value) unlockGameSound()
}

export async function playGameSounds(cues: readonly GameSound[]) {
  if (!enabled || !context || !master || !cues.length) return
  const activeContext = context
  const activeMaster = master
  const version = preferenceVersion
  const requestedAt = performance.now()
  try {
    // Wait only for a gesture's in-flight resume, never replay stale events later.
    if (activeContext.state !== 'running') {
      if (!resumeTask) return
      await resumeTask
    }
    if (!enabled || version !== preferenceVersion || context !== activeContext ||
      activeContext.state !== 'running' || performance.now() - requestedAt > 250) return
    let start = activeContext.currentTime + 0.005
    for (const cue of cues) {
      renderGameSound(activeContext, activeMaster, cue, start)
      start += cue === 'skill' ? 0.4 : 0.11
    }
  } catch { /* Audio device errors never affect an accepted game action. */ }
}
