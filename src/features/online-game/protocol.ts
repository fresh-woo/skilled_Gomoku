import type { GameState, Position } from '../../entities/game/model/game'
import type { SkillView } from '../../entities/game/model/skillGameView'
import type { OnlineTurn, OnlineTurnClock } from '../../entities/game/model/onlineTurn'
export type OnlineAction =
  | { type: 'place-stone'; position: Position }
  | { type: 'use-skill'; cardId: number; position?: Position }
  | { type: 'respond'; attackId: number; cardId?: number }
  | { type: 'choose-augment'; augmentId: string; round: number }
export type Snapshot = {
  type: 'snapshot'; v: 1; roomId: string; gameId: string; revision: number; serverTime: number
  playerId: string; mode: string; rules: string
  members: { id: string; connected: boolean; ready: boolean }[]
  game: GameState | null; skills: SkillView | null
  turn: OnlineTurn
  turnClock: OnlineTurnClock | null
  handCounts: Record<string, number>
}
