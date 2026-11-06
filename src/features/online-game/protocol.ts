import type { GameState, Position } from '../../entities/game/model/game'
import type { SkillView } from '../../entities/game/model/skillGameView'
export type OnlineAction =
  | { type: 'place-stone'; position: Position }
  | { type: 'use-skill'; cardId: number }
  | { type: 'respond'; attackId: number; cardId?: number }
export type Snapshot = {
  type: 'snapshot'; v: 1; roomId: string; gameId: string; revision: number
  playerId: string; mode: string; rules: string
  members: { id: string; connected: boolean; ready: boolean }[]
  game: GameState | null; skills: SkillView | null
  handCounts: Record<string, number>
}
