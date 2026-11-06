import assert from 'node:assert/strict'
import test from 'node:test'
import { applySkillCommand, expireSnipe, ONLINE_SKILL_COUNT, startSkillGame } from '../src/entities/game/model/skillGame.ts'

const point = (column, row = 0) => ({ row, column })
const card = (id, kind) => ({ id, skill: { kind } })
const attack = (cardId = 1, position = point(0)) => ({ type: 'use-skill', actorId: 'a', cardId, position })
const place = (actorId, position) => ({ type: 'place-stone', actorId, position })
const defend = (fields = {}) => ({ type: 'respond', actorId: 'b', attackId: 1, ...fields })

function accept(state, command, now = 1_000) {
  const result = applySkillCommand(state, command, now)
  assert.equal(result.ok, true, result.reason)
  return result.state
}

function fixture(mode = 'five-in-a-row') {
  const initial = startSkillGame(mode, ['a', 'b'], [], 0).state
  let state = accept(initial, place('a', point(0, 1)))
  state = accept(state, place('b', point(0)))
  return {
    ...state,
    hands: { a: [card(1, 'snipe'), card(2, 'snipe')], b: [card(3, 'nullify'), card(4, 'shield')] },
  }
}

test('only the active player can target a live opposing stone with snipe or an own stone with shield', () => {
  const state = fixture()
  for (const position of [point(-1), point(15), point(0.5), point(1), point(0, 1)]) {
    assert.deepEqual(applySkillCommand(state, attack(1, position)), { ok: false, reason: 'invalid-target' })
  }
  assert.equal(applySkillCommand(state, { ...attack(), actorId: 'b' }).reason, 'not-active-player')
  const withShield = { ...state, hands: { ...state.hands, a: [card(5, 'shield')] } }
  assert.equal(applySkillCommand(withShield, attack(5)).reason, 'invalid-target')
  assert.equal(state.hands.a.length, 2)
  assert.equal(state.game.board.cells[0][0].ownerId, 'b')
})

test('nullify requires the defender to pick a separate card from their hand and keeps the shield', () => {
  const state = fixture()
  const shield = { position: point(0), expiresRound: 6 }
  const pending = accept({ ...state, shields: [shield] }, attack())
  assert.equal(pending.response.deadline, 16_000)
  assert.equal(pending.hands.a.length, 1)
  assert.equal(applySkillCommand(pending, place('a', point(2))).reason, 'response-pending')
  assert.equal(applySkillCommand(pending, defend({ actorId: 'a' })).reason, 'invalid-response')
  assert.equal(applySkillCommand(pending, defend({ attackId: 2 })).reason, 'invalid-response')
  for (const discardCardId of [undefined, 3, 2, 999]) {
    assert.equal(applySkillCommand(pending, defend({ cardId: 3, discardCardId }), 15_999).reason, 'invalid-nullify-cost')
  }
  assert.deepEqual(pending.hands.b, state.hands.b)
  assert.equal(applySkillCommand(pending, defend({ cardId: 4, discardCardId: 3 })).reason, 'invalid-skill-timing')
  const canceled = accept(pending, defend({ cardId: 3, discardCardId: 4 }), 15_999)
  assert.deepEqual(canceled.hands.b, [])
  assert.equal(canceled.snipeOutcome, 'nullified')
  assert.equal(canceled.response, null)
  assert.deepEqual(canceled.shields, [shield])
  assert.equal(canceled.game, state.game)
  assert.equal(applySkillCommand(canceled, defend({ cardId: 3, discardCardId: 4 })).reason, 'invalid-response')
  assert.equal(applySkillCommand(canceled, attack(2)).reason, 'skill-used-this-turn')
  const nextTurn = accept(accept(canceled, place('a', point(2))), place('b', point(3)))
  const blocked = accept(accept(nextTurn, attack(2)), defend({ attackId: 2 }))
  assert.deepEqual(blocked.shields, [])
  assert.equal(blocked.snipeOutcome, 'shielded')
  assert.equal(blocked.game, nextTurn.game)
  assert.equal(accept(blocked, place('a', point(4))).game.turn.activeSeat, 1)
})

test('timeout resolves at the deadline exactly once and resumes the original turn', () => {
  const state = fixture()
  const pending = accept(state, attack())
  assert.equal(expireSnipe(pending, 15_999), pending)
  assert.equal(applySkillCommand(pending, defend({ cardId: 3, discardCardId: 4 }), 16_000).reason, 'response-expired')
  const resolved = expireSnipe(pending, 16_000)
  assert.equal(expireSnipe(resolved, 17_000), resolved)
  assert.equal(resolved.snipeOutcome, 'destroyed')
  assert.equal(resolved.response, null)
  assert.equal(resolved.game.board.cells[0][0], null)
  assert.equal(pending.game.board.cells[0][0].ownerId, 'b')
  assert.deepEqual(resolved.game.turn, state.game.turn)
  assert.deepEqual(resolved.hands.b, state.hands.b)
})

test('duplicate shield keeps the card and the existing shield expires at the start of round six', () => {
  const fixtureState = fixture()
  const state = { ...fixtureState, hands: { ...fixtureState.hands, a: [card(5, 'shield'), card(6, 'shield')] } }
  let next = accept(state, attack(5, point(0, 1)))
  assert.deepEqual(next.shields, [{ position: point(0, 1), expiresRound: 6 }])
  assert.equal(applySkillCommand(next, attack(6, point(0, 1))).reason, 'already-shielded')
  assert.deepEqual(next.hands.a.map(({ id }) => id), [6])
  for (let round = 2; round <= 5; round++) {
    assert.equal(next.game.turn.round, round)
    assert.equal(next.shields.length, 1)
    next = accept(next, place('a', point(round * 2, 1)))
    assert.equal(next.shields.length, 1)
    next = accept(next, place('b', point(round * 2)))
  }
  assert.equal(next.game.turn.round, 6)
  assert.deepEqual(next.shields, [])
})

test('the active player can use one shield and one snipe per turn', () => {
  let state = fixture()
  state = accept(accept(state, place('a', point(1, 1))), place('b', point(1)))
  state = { ...state, hands: { ...state.hands, a: [...state.hands.a, card(5, 'shield'), card(6, 'shield')] } }
  const shielded = accept(state, attack(5, point(0, 1)))
  assert.equal(applySkillCommand(shielded, attack(6, point(1, 1))).reason, 'skill-used-this-turn')
  const pending = accept(shielded, attack())
  const resolved = accept(pending, defend())
  assert.equal(applySkillCommand(resolved, attack(2, point(1))).reason, 'skill-used-this-turn')
  assert.deepEqual(resolved.hands.a.map(({ id }) => id), [2, 6])
})

for (const [mode, length] of [['five-in-a-row', 5], ['six-in-a-row', 6]]) {
  test(`snipe can turn an overline into an exact win for its owner in ${mode}`, () => {
    let state = fixture(mode)
    // Leave column 1 open until the last placement to create an overline in one turn.
    for (const column of [...Array.from({ length: length - 1 }, (_, i) => i + 2), 1]) {
      state = accept(state, place('a', point(column, 2 + (column % 2))))
      state = accept(state, place('b', point(column)))
    }
    assert.equal(state.game.status, 'playing')
    const resolved = accept(accept(state, attack()), defend())
    assert.equal(resolved.game.status, 'finished')
    assert.deepEqual(resolved.game.result, { kind: 'win', winnerId: 'b' })
  })
}

test('online mode can draw each of the seven cards and grants one per turn', () => {
  const draw = (index) => startSkillGame('five-in-a-row', ['a', 'b'], null, 0, index).state
  const skills = Array.from({ length: ONLINE_SKILL_COUNT }, (_, index) => draw(index).hands.a[0].skill)
  assert.deepEqual(skills, [
    { kind: 'snipe' }, { kind: 'nullify' }, { kind: 'shield' },
    { kind: 'discard', response: 'before' }, { kind: 'cancel' },
    { kind: 'recover' }, { kind: 'discard', response: 'after' },
  ])
  const first = draw(0)
  assert.equal(first.hands.a.length, 1)
  assert.equal(first.hands.b.length, 0)
  const moved = applySkillCommand(first, place('a', point(0)), 1_000, 4).state
  assert.deepEqual(moved.hands.a, first.hands.a)
  assert.deepEqual(moved.hands.b, [{ id: 1, skill: { kind: 'cancel' } }])
})
