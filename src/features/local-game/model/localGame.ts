import { applyCommand, startGame } from '../../../entities/game/model/game.ts'
import type { GameMode, GameState, Position } from '../../../entities/game/model/game.ts'
import { applySkillCommand } from '../../../entities/game/model/skillGame.ts'
import { startTestSkillGame } from '../../../entities/game/model/testSkillScenario.ts'
import type { SkillGame } from '../../../entities/game/model/skillGame.ts'

export const LOCAL_PLAYER_IDS = ['player-1', 'player-2'] as const

function turnOrder(previousGame: GameState | null, random: () => number) {
  const [first, second] = LOCAL_PLAYER_IDS
  const firstSeat = previousGame
    ? previousGame.players[1].id
    : (random() < 0.5 ? first : second)
  const secondSeat = firstSeat === first ? second : first
  return [firstSeat, secondSeat] as const
}

export function startLocalGame(mode: GameMode, previousGame: GameState | null, random = Math.random) {
  return startGame(mode, turnOrder(previousGame, random))
}

export function startLocalSkillGame(mode: GameMode, previousGame: GameState | null, random = Math.random) {
  const players = turnOrder(previousGame, random)
  return startTestSkillGame(mode, players, Math.floor(random() * 0x100000000))
}

export type LocalSkillAction =
  | { type: 'place'; position: Position }
  | { type: 'card'; cardId: number }
  | { type: 'pass' }

export function applyLocalSkillAction(state: SkillGame, action: LocalSkillAction) {
  const { game, response } = state
  if (game.status === 'finished') return { ok: false, reason: 'game-finished' } as const

  const actorId = game.players[game.turn.activeSeat].id
  if (action.type === 'place') {
    return applySkillCommand(state, { type: 'place-stone', actorId, position: action.position })
  }
  if (response) {
    return applySkillCommand(state, {
      type: 'respond',
      actorId: response.targetId,
      attackId: response.id,
      cardId: action.type === 'card' ? action.cardId : undefined,
    })
  }
  if (action.type === 'pass') return { ok: false, reason: 'invalid-response' } as const

  const targetId = game.players[1 - game.turn.activeSeat].id
  return applySkillCommand(state, { type: 'use-skill', actorId, targetId, cardId: action.cardId })
}

export function placeLocalStone(game: GameState, position: Position) {
  if (game.status === 'finished') return { ok: false, reason: 'game-finished' } as const

  return applyCommand(game, {
    type: 'place-stone',
    actorId: game.players[game.turn.activeSeat].id,
    position,
  })
}
