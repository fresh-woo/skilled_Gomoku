import { applyCommand, startGame } from '../../../entities/game/model/game.ts'
import type { GameMode, GameState, Position } from '../../../entities/game/model/game.ts'

export const LOCAL_PLAYER_IDS = ['player-1', 'player-2'] as const

export function startLocalGame(mode: GameMode, previousGame: GameState | null, random = Math.random) {
  const [first, second] = LOCAL_PLAYER_IDS
  const firstSeat = previousGame
    ? previousGame.players[1].id
    : (random() < 0.5 ? first : second)
  const secondSeat = firstSeat === first ? second : first
  return startGame(mode, [firstSeat, secondSeat])
}

export function placeLocalStone(game: GameState, position: Position) {
  if (game.status === 'finished') return { ok: false, reason: 'game-finished' } as const

  return applyCommand(game, {
    type: 'place-stone',
    actorId: game.players[game.turn.activeSeat].id,
    position,
  })
}
