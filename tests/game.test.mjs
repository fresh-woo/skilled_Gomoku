import assert from 'node:assert/strict'
import { test } from 'node:test'
import { applyCommand, BOARD_SIZE, startGame } from '../src/entities/game/model/game.ts'
import { LOCAL_PLAYER_IDS, startLocalGame } from '../src/features/local-game/model/localGame.ts'

const players = ['A', 'B']
const modes = [
  { mode: 'five-in-a-row', target: 5 },
  { mode: 'six-in-a-row', target: 6 },
]

function accepted(transition) {
  assert.ok(transition.ok, transition.reason)
  return transition
}

function place(game, actorId, row, column) {
  return applyCommand(game, { type: 'place-stone', actorId, position: { row, column } })
}

function checkTurn(transition, playerId, round) {
  const { state, events } = accepted(transition)
  assert.equal(state.status, 'playing')
  assert.equal(state.players[state.turn.activeSeat].id, playerId)
  assert.equal(state.turn.round, round)
  assert.deepEqual(events, [{ type: 'turn-started', playerId, round, stoneGrant: 1, skillCardGrant: 1 }])
  return state
}

test('accepts exactly two distinct players and grants once on each new turn', () => {
  for (const ids of [[], ['A'], ['A', 'B', 'C'], ['A', 'A']]) {
    assert.deepEqual(startGame('five-in-a-row', ids), { ok: false, reason: 'invalid-player-order' })
  }
  let game = checkTurn(startGame('five-in-a-row', players), 'A', 1)
  assert.equal(game.board.size, 15)
  assert.equal(game.board.cells.flat().length, 225)
  assert.ok(game.board.cells.flat().every((stone) => stone === null))
  game = checkTurn(place(game, 'A', 0, 0), 'B', 1)
  checkTurn(place(game, 'B', 14, 14), 'A', 2)
})

test('rejects wrong players, malformed coordinates and occupied points without mutating state', () => {
  const { state: initial } = accepted(startGame('five-in-a-row', players))
  assert.deepEqual(place(initial, 'B', 0, 0), { ok: false, reason: 'not-active-player' })
  for (const [row, column] of [[-1, 0], [0, 15], [14, -1], [15, 14], [0.5, 0], [0, NaN]]) {
    assert.deepEqual(place(initial, 'A', row, column), { ok: false, reason: 'invalid-position' })
  }
  const { state: afterPlacement } = accepted(place(initial, 'A', 0, 0))
  assert.equal(initial.board.cells[0][0], null)
  assert.deepEqual(afterPlacement.board.cells[0][0], { ownerId: 'A' })
  const beforeRejection = structuredClone(afterPlacement)
  assert.deepEqual(place(afterPlacement, 'B', 0, 0), { ok: false, reason: 'occupied-position' })
  assert.deepEqual(afterPlacement, beforeRejection)
})

const directions = [
  { name: 'horizontal', rowStep: 0, columnStep: 1, firstColumn: 0 },
  { name: 'vertical', rowStep: 1, columnStep: 0, firstColumn: 0 },
  { name: 'descending diagonal', rowStep: 1, columnStep: 1, firstColumn: 0 },
  { name: 'ascending diagonal', rowStep: 1, columnStep: -1, firstColumn: 14 },
]

for (const { mode, target } of modes) {
  for (const { name, rowStep, columnStep, firstColumn } of directions) {
    test(`${mode}: an exact ${name} line wins when the gap closes`, () => {
      let { state } = accepted(startGame(mode, players))
      let replyColumn = 0
      const gap = 2
      for (let offset = 0; offset < target; offset += 1) {
        if (offset === gap) continue
        const column = firstColumn + offset * columnStep
        state = accepted(place(state, 'A', offset * rowStep, column)).state
        assert.equal(state.status, 'playing')
        state = accepted(place(state, 'B', 14, replyColumn)).state
        replyColumn += 2
      }
      const winningMove = accepted(place(state, 'A', gap * rowStep, firstColumn + gap * columnStep))
      assert.equal(winningMove.state.status, 'finished')
      assert.deepEqual(winningMove.state.result, { kind: 'win', winnerId: 'A' })
      assert.deepEqual(winningMove.events, [])
      assert.deepEqual(place(winningMove.state, 'B', 8, 8), { ok: false, reason: 'game-finished' })
    })
  }

  test(`${mode}: making ${target + 1} in a row is legal and starts the opponent's turn`, () => {
    let { state } = accepted(startGame(mode, players))
    for (let offset = 0; offset <= target; offset += 1) {
      if (offset === 2) continue
      state = accepted(place(state, 'A', 0, offset)).state
      state = accepted(place(state, 'B', 14, offset * 2)).state
    }
    const afterOverline = checkTurn(place(state, 'A', 0, 2), 'B', target + 1)
    assert.equal(afterOverline.board.cells[0][2]?.ownerId, 'A')
  })

  for (const lastMoveWins of [false, true]) {
    test(`${mode}: the final empty point yields ${lastMoveWins ? 'a win' : 'a draw'}`, () => {
      const lastMove = [0, 2]
      const pointsByPlayer = [[], []]
      for (let row = 0; row < BOARD_SIZE; row += 1) {
        for (let column = 0; column < BOARD_SIZE; column += 1) {
          if (row === lastMove[0] && column === lastMove[1]) continue
          // Alternating pairs avoid long lines. The win fixture adds an exact line across the gap.
          let seat = (row + Math.floor(column / 2)) % 2
          if (lastMoveWins) {
            if (row === 0 && column <= target) seat = column < target ? 0 : 1
            if (row === 14 && column < target - 4) seat = 1
          } else if (row === 14 && column === 0) {
            // Transfer one point to B because the reserved point would normally belong to B.
            seat = 1
          }
          pointsByPlayer[seat].push([row, column])
        }
      }
      assert.deepEqual(pointsByPlayer.map((points) => points.length), [112, 112])

      let { state } = accepted(startGame(mode, players))
      for (const [index, point] of pointsByPlayer[0].entries()) {
        state = accepted(place(state, 'A', ...point)).state
        state = accepted(place(state, 'B', ...pointsByPlayer[1][index])).state
        assert.equal(state.status, 'playing')
      }
      const end = accepted(place(state, 'A', ...lastMove))
      assert.equal(end.state.status, 'finished')
      assert.deepEqual(end.state.result, lastMoveWins ? { kind: 'win', winnerId: 'A' } : { kind: 'draw' })
      assert.deepEqual(end.events, [])
    })
  }
}

test('the local session chooses a first player randomly and alternates for new games', () => {
  const [first, second] = LOCAL_PLAYER_IDS
  const firstGame = checkTurn(startLocalGame('five-in-a-row', null, () => 0), first, 1)
  checkTurn(startLocalGame('five-in-a-row', null, () => 0.99), second, 1)
  const nextGame = checkTurn(startLocalGame('six-in-a-row', firstGame, () => assert.fail('rerolled')), second, 1)
  assert.equal(nextGame.mode, 'six-in-a-row')
  assert.ok(nextGame.board.cells.flat().every((stone) => stone === null))
  checkTurn(startLocalGame('six-in-a-row', nextGame), first, 1)
})
