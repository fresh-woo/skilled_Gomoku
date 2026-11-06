import { applySkillCommand, startSkillGame } from '../entities/game/model/skillGame.ts'

export const attacker = 'black'
export const defender = 'white'
export const followUpMove = { row: 0, column: 2 }

export function createSkillDemo() {
  // A fixed test deck and four legal moves give White two different cards to defend with.
  const start = startSkillGame('five-in-a-row', [attacker, defender], [
    { kind: 'discard', response: 'before' },
    { kind: 'cancel' },
    { kind: 'discard', response: 'before' },
    { kind: 'recover' },
    { kind: 'discard', response: 'before' },
    { kind: 'cancel' },
  ], 1000)
  if (!start.ok) throw new Error(start.reason)

  let state = start.state
  for (const column of [0, 1]) {
    for (const [actorId, row] of [[attacker, 0], [defender, 1]] as const) {
      const move = applySkillCommand(state, { type: 'place-stone', actorId, position: { row, column } })
      if (!move.ok) throw new Error(move.reason)
      state = move.state
    }
  }
  return state
}
