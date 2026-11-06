import assert from 'node:assert/strict'
import { test } from 'node:test'
import { applySkillCommand, startSkillGame } from '../src/entities/game/model/skillGame.ts'

// Synthetic cards exercise the engine without fixing the production card pool or timing.
const attack = { kind: 'discard' }
const nullify = { kind: 'nullify' }
const shield = { kind: 'shield' }
const seed = 123456789

function accepted(transition) {
  assert.ok(transition.ok, transition.reason)
  return transition.state
}

function start(drawPile) {
  return accepted(startSkillGame('five-in-a-row', ['A', 'B'], drawPile, seed))
}

function place(state, actorId, row, column) {
  return applySkillCommand(state, { type: 'place-stone', actorId, position: { row, column } })
}

function use(state, actorId, cardId, targetId) {
  return applySkillCommand(state, { type: 'use-skill', actorId, cardId, targetId })
}

function reply(state, actorId, attackId, cardId) {
  return applySkillCommand(state, { type: 'respond', actorId, attackId, cardId })
}

function hand(state, playerId) {
  return state.hands[playerId].map(({ id }) => id)
}

test('first turn draws once and a valid counter resumes the same turn without using randomness', () => {
  let state = start([attack, nullify, attack])
  assert.deepEqual(hand(state, 'A'), [0])
  assert.deepEqual(hand(state, 'B'), [])
  state = accepted(place(state, 'A', 0, 0))
  state = accepted(place(state, 'B', 1, 0))
  assert.deepEqual(hand(state, 'A'), [0, 2])
  assert.deepEqual(hand(state, 'B'), [1])

  const waiting = accepted(use(state, 'A', 0, 'B'))
  assert.equal(waiting.response.phase, 'before')
  assert.deepEqual(hand(waiting, 'A'), [2])
  const resumed = accepted(reply(waiting, 'B', 0, 1))
  assert.deepEqual(resumed.game.turn, { activeSeat: 0, round: 2 })
  assert.equal(resumed.response, null)
  assert.equal(resumed.randomSeed, seed)
  assert.deepEqual(hand(resumed, 'B'), [])
  assert.deepEqual(hand(accepted(place(resumed, 'A', 0, 1)), 'B'), [])
})

test('invalid timing, target, actor and stale response leave the whole snapshot unchanged', () => {
  let state = start([attack, shield, nullify])
  state = accepted(place(state, 'A', 0, 0))
  state = accepted(place(state, 'B', 1, 0))
  assert.deepEqual(use(state, 'B', 1, 'A'), { ok: false, reason: 'not-active-player' })
  assert.deepEqual(use(state, 'A', 99, 'B'), { ok: false, reason: 'card-not-in-hand' })
  assert.deepEqual(use(state, 'A', 2, 'B'), { ok: false, reason: 'invalid-skill-timing' })
  for (const target of ['A', 'unknown']) {
    assert.deepEqual(use(state, 'A', 0, target), { ok: false, reason: 'invalid-target' })
  }
  const waiting = accepted(use(state, 'A', 0, 'B'))
  const snapshot = structuredClone(waiting)
  assert.deepEqual(place(waiting, 'A', 0, 1), { ok: false, reason: 'response-pending' })
  assert.deepEqual(use(waiting, 'A', 2, 'B'), { ok: false, reason: 'response-pending' })
  assert.deepEqual(reply(waiting, 'A', 0), { ok: false, reason: 'invalid-response' })
  assert.deepEqual(reply(waiting, 'B', 7), { ok: false, reason: 'invalid-response' })
  assert.deepEqual(reply(waiting, 'B', 0, 1), { ok: false, reason: 'invalid-skill-timing' })
  assert.deepEqual(waiting, snapshot)
})

test('passing before disarm can discard nullify itself and rejects replay', () => {
  let state = start([attack, nullify, nullify, shield])
  for (const [actor, row, column] of [['A', 0, 0], ['B', 1, 0], ['A', 0, 1], ['B', 1, 1]]) {
    state = accepted(place(state, actor, row, column))
  }
  assert.deepEqual(hand(state, 'B'), [1, 3])
  const waiting = accepted(use(state, 'A', 0, 'B'))
  const resumed = accepted(reply(waiting, 'B', 0))
  assert.deepEqual(resumed, accepted(reply(structuredClone(waiting), 'B', 0)))
  assert.deepEqual(hand(resumed, 'B'), [3])
  assert.notEqual(resumed.randomSeed, seed)
  assert.deepEqual(reply(resumed, 'B', 0), { ok: false, reason: 'invalid-response' })
})

for (const guardExpires of [true, false]) {
  test(`delayed discard runs before the draw with the guard ${guardExpires ? 'expired' : 'still active'}`, () => {
    const guard = { kind: 'guard', at: guardExpires ? { playerId: 'B', round: 4 } : { playerId: 'A', round: 5 } }
    const delay = { kind: 'delay', at: { playerId: 'B', round: 4 } }
    let state = start([attack, guard, nullify, delay, nullify, shield, nullify, nullify])
    state = accepted(place(state, 'A', 0, 0))
    state = accepted(use(state, 'B', 1, 'B'))
    state = accepted(place(state, 'B', 1, 0))
    for (const column of [1, 2]) {
      state = accepted(place(state, 'A', 0, column))
      state = accepted(place(state, 'B', 1, column))
    }
    state = accepted(use(state, 'A', 0, 'B'))
    state = accepted(reply(state, 'B', 0, 3))
    assert.deepEqual(hand(state, 'B'), [5])
    assert.equal(state.randomSeed, seed)
    state = accepted(place(state, 'A', 0, 3))
    assert.deepEqual(hand(state, 'B'), guardExpires ? [7] : [5, 7])
    assert.deepEqual(state.effects, [])
    assert.equal(state.response, null)
    assert.equal(state.randomSeed === seed, !guardExpires)
  })
}

test('a past or unknown effect boundary cannot consume a card', () => {
  for (const at of [{ playerId: 'A', round: 1 }, { playerId: 'unknown', round: 2 }]) {
    const state = start([{ kind: 'guard', at }])
    assert.deepEqual(use(state, 'A', 0, 'A'), { ok: false, reason: 'invalid-boundary' })
    assert.deepEqual(hand(state, 'A'), [0])
  }
})

test('a winning placement does not advance the draw or scheduled effects', () => {
  const guard = { kind: 'guard', at: { playerId: 'A', round: 6 } }
  let state = start([guard, ...Array(10).fill(nullify)])
  state = accepted(use(state, 'A', 0, 'A'))
  for (let column = 0; column < 4; column++) {
    state = accepted(place(state, 'A', 0, column))
    state = accepted(place(state, 'B', 14, column * 2))
  }
  const final = place(state, 'A', 0, 4)
  const finished = accepted(final)
  assert.deepEqual(finished.game.result, { kind: 'win', winnerId: 'A' })
  assert.equal(finished.nextDraw, state.nextDraw)
  assert.deepEqual(finished.effects, [])
  assert.deepEqual(final.events, [])
  assert.deepEqual(use(finished, 'A', 2, 'B'), { ok: false, reason: 'game-finished' })
})

const scriptedDeck = [attack, attack, nullify, nullify, shield, shield, attack, attack]

test('a five-in-a-row skill match continues to victory after an off-turn defense', () => {
  const [black, white] = ['black', 'white']
  let state = accepted(startSkillGame('five-in-a-row', [black, white], scriptedDeck, 0))
  function move(row, column) {
    state = accepted(place(state, row === 0 ? black : white, row, column))
  }

  move(0, 0)
  move(14, 0)
  move(0, 1)
  assert.deepEqual(hand(state, white), [1, 3])
  state = accepted(use(state, white, 1, black))
  assert.equal(state.response.targetId, black)
  assert.deepEqual(place(state, white, 14, 2), {
    ok: false, reason: 'response-pending',
  })
  state = accepted(reply(state, black, state.response.id, 2))
  assert.equal(state.response, null)
  assert.deepEqual(hand(state, black), [0])
  move(14, 2)
  for (const column of [2, 3]) {
    move(0, column)
    move(14, column * 2)
  }
  move(0, 4)
  assert.deepEqual(state.game.result, { kind: 'win', winnerId: black })

  const rematch = accepted(startSkillGame('six-in-a-row', [white, black], scriptedDeck, 0))
  assert.equal(rematch.game.players[0].id, white)
  assert.deepEqual(hand(rematch, white), [0])
  assert.deepEqual(hand(rematch, black), [])
})

test('a six-in-a-row skill match continues after nullifying disarm', () => {
  const [black, white] = ['black', 'white']
  let state = accepted(startSkillGame('six-in-a-row', [black, white], scriptedDeck, 0))
  for (const column of [0, 1, 2]) {
    state = accepted(place(state, black, 0, column))
    state = accepted(place(state, white, 14, column))
  }
  state = accepted(use(state, black, 6, white))
  assert.equal(state.response.phase, 'before')
  assert.deepEqual(hand(state, white), [1, 3, 5])
  state = accepted(reply(state, white, state.response.id, 3))
  assert.equal(state.response, null)
  assert.deepEqual(hand(state, white), [1, 5])
  for (const column of [3, 4, 5]) {
    state = accepted(place(state, black, 0, column))
    if (column < 5) {
      assert.equal(state.game.status, 'playing')
      state = accepted(place(state, white, 14, column))
    }
  }
  assert.deepEqual(state.game.result, { kind: 'win', winnerId: black })
})
