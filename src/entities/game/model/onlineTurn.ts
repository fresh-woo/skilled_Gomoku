import type { GameState, PlayerId } from './game.ts'
import type { SkillView } from './skillGameView.ts'

export type OnlineTurn =
  | { phase: 'waiting' | 'finished' }
  | {
    phase: 'my-turn' | 'opponent-turn' | 'defend' | 'waiting-defense' | 'choose-augment'
    activePlayerId: PlayerId
    round: number
  }

export function projectOnlineTurn(game: GameState | null, skills: SkillView | null, viewer: PlayerId): OnlineTurn {
  if (!game) return { phase: 'waiting' }
  if (game.status === 'finished') return { phase: 'finished' }

  const activePlayerId = game.players[game.turn.activeSeat].id
  const { round } = game.turn
  if (skills?.augment.pending) return { phase: 'choose-augment', activePlayerId, round }
  if (skills?.response) {
    return { phase: skills.response.targetId === viewer ? 'defend' : 'waiting-defense', activePlayerId, round }
  }
  return { phase: activePlayerId === viewer ? 'my-turn' : 'opponent-turn', activePlayerId, round }
}
