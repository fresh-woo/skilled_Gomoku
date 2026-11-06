import { hasExactLine } from './game.ts'
import type { GameState, Position } from './game.ts'

export const AUGMENTS = {
  'card-bundle': { title: '카드뭉치', description: '즉시 스킬카드 4장을 얻어요.' },
  fortification: { title: '요새화', description: '승리 조건보다 한 개 짧은 연속 줄의 내 돌을 공격에서 보호해요.' },
} as const

export type AugmentId = keyof typeof AUGMENTS

export function isFortified(game: GameState, position: Position, owners: readonly string[]): boolean {
  const ownerId = game.board.cells[position.row]?.[position.column]?.ownerId
  const player = game.players.find(({ id }) => id === ownerId)
  return Boolean(player && owners.includes(player.id) &&
    hasExactLine(game.board, position, player.id, player.winCondition.lineLength - 1))
}
