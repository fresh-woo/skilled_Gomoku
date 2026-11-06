import assert from 'node:assert/strict'
import test from 'node:test'
import { isFortified } from '../src/entities/game/model/augments.ts'
import { applySkillCommand, offerRoundAugments, startSkillGame } from '../src/entities/game/model/skillGame.ts'

function accept(state, command) {
  const result = applySkillCommand(state, command)
  assert.equal(result.ok, true, result.reason)
  return result.state
}

function choose(state, actorId, augmentId) {
  return accept(state, { type: 'choose-augment', actorId, augmentId, round: state.game.turn.round })
}

test('augment offers open on scheduled round starts and exclude owned choices', () => {
  const start = startSkillGame('five-in-a-row', ['a', 'b'], null, 0).state
  const offer = offerRoundAugments(start)
  assert.deepEqual(offer.augmentOffer, { a: ['card-bundle', 'fortification'], b: ['card-bundle', 'fortification'] })
  const bundled = choose(offer, 'a', 'card-bundle')
  assert.deepEqual(bundled, choose(offer, 'a', 'card-bundle'))
  assert.equal(bundled.hands.a.length, 4)
  assert.equal(new Set(bundled.hands.a.map(({ id }) => id)).size, 4)
  assert.deepEqual(bundled.hands.b, [])
  const played = choose(bundled, 'b', 'fortification')
  const at = (state, round, activeSeat = 0) => ({
    ...state, game: { ...state.game, turn: { round, activeSeat } },
  })
  assert.equal(offerRoundAugments(at(played, 5)).augmentOffer, null)
  assert.equal(offerRoundAugments(at(played, 6, 1)).augmentOffer, null)
  const second = offerRoundAugments(at(played, 6))
  assert.deepEqual(second.augmentOffer, { a: ['fortification'], b: ['card-bundle'] })
  const exhausted = choose(choose(second, 'a', 'fortification'), 'b', 'card-bundle')
  assert.equal(offerRoundAugments(at(exhausted, 11)).augmentOffer, null)
})

for (const [mode, length] of [['five-in-a-row', 5], ['six-in-a-row', 6]]) {
  test(`fortification uses exactly n−1 for ${mode} and preserves a rejected snipe`, () => {
    const started = startSkillGame(mode, ['a', 'b'], [{ kind: 'snipe' }], 0).state
    const offer = offerRoundAugments(started)
    let state = choose(choose(offer, 'a', 'fortification'), 'b', 'fortification')
    const attack = (column) => ({ type: 'use-skill', actorId: 'a', cardId: 0, position: { row: column, column } })
    for (let column = 0; column < length - 1; column++) {
      state = accept(state, { type: 'place-stone', actorId: 'a', position: { row: 10, column: 2 * column } })
      state = accept(state, { type: 'place-stone', actorId: 'b', position: { row: column, column } })
      assert.equal(isFortified(state.game, { row: 0, column: 0 }, ['b']), column === length - 2)
    }
    assert.deepEqual(applySkillCommand(state, attack(0)), { ok: false, reason: 'fortified-target' })
    assert.deepEqual(applySkillCommand(state, attack(2)), { ok: false, reason: 'fortified-target' })
    assert.equal(state.hands.a[0].id, 0)
    assert.equal(state.response, null)
    assert.equal(isFortified(state.game, { row: 0, column: 0 }, ['a']), false)
  })
}
