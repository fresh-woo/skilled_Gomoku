import { BOARD_SIZE } from './game.ts'
import type { GameMode } from './game.ts'
import { startSkillGame } from './skillGame.ts'

// Shared local/online test scenario, not the final card policy.
export function startTestSkillGame(mode: GameMode, players: readonly string[], seed: number) {
  const cycle = [
    { kind: 'discard', response: 'before' }, { kind: 'cancel' },
    { kind: 'recover' }, { kind: 'discard', response: 'after' },
  ] as const
  const deck = Array.from({ length: BOARD_SIZE ** 2 }, (_, index) => cycle[Math.floor(index / players.length) % cycle.length])
  return startSkillGame(mode, players, deck, seed)
}
