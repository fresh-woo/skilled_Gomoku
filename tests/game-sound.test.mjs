import assert from 'node:assert/strict'
import test from 'node:test'
import { applyCommand, startGame } from '../src/entities/game/model/game.ts'
import { actionSounds, createSoundCursor } from '../src/entities/game/model/soundEvents.ts'

test('placement plays only one stone sound, including the winning move', () => {
  let game = startGame('five-in-a-row', ['A', 'B']).state
  for (let column = 0; column < 5; column++) {
    const next = applyCommand(game, { type: 'place-stone', actorId: 'A', position: { row: 0, column } }).state
    assert.deepEqual(actionSounds('place'), ['place'])
    game = next
    if (column < 4) game = applyCommand(game, { type: 'place-stone', actorId: 'B', position: { row: 2, column } }).state
  }
  assert.equal(game.status, 'finished')
})

test('skill and defense use the skill cue; passive updates stay silent', () => {
  assert.deepEqual(actionSounds('skill'), ['skill'])
  assert.deepEqual(actionSounds(null), [])
})

test('join/resume snapshots baseline sound history and duplicates/old games never replay', () => {
  const cursor = createSoundCursor()
  const event = { gameId: 'first', revision: 4, cues: ['skill'] }
  assert.deepEqual(cursor.consume(event), [])
  cursor.sync('first', 3)
  assert.deepEqual(cursor.consume(event), ['skill'])
  assert.deepEqual(cursor.consume(event), [])
  cursor.sync('first', 10)
  assert.deepEqual(cursor.consume({ ...event, revision: 9 }), [])
  assert.deepEqual(cursor.consume({ ...event, revision: 10 }), [])
  assert.deepEqual(cursor.consume({ ...event, revision: 11 }), ['skill'])
  cursor.sync('rematch', 12)
  assert.deepEqual(cursor.consume({ ...event, revision: 14 }), [])
  assert.deepEqual(cursor.consume({ ...event, gameId: 'rematch', revision: 13 }), ['skill'])
})
