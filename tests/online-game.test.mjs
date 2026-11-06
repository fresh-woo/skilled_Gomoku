import assert from 'node:assert/strict'
import test from 'node:test'
import { once } from 'node:events'
import { WebSocket as Ws } from 'ws'
import { createOnlineServer } from '../server/index.mjs'

async function client(url) {
  const socket = new WebSocket(url)
  const messages = []
  socket.addEventListener('message', ({ data }) => messages.push(JSON.parse(data)))
  await once(socket, 'open')
  return {
    socket,
    clear() { messages.length = 0 },
    sounds() { return messages.filter((message) => message.type === 'sound') },
    send(message) { const requestId = message.requestId ?? crypto.randomUUID(); socket.send(JSON.stringify({ v: 1, ...message, requestId })); return requestId },
    async next(type, predicate = () => true, timeout = 2500) {
      const deadline = Date.now() + timeout
      while (Date.now() < deadline) {
        const index = messages.findIndex((m) => m.type === type && predicate(m))
        if (index >= 0) return messages.splice(index, 1)[0]
        await new Promise((done) => setTimeout(done, 5))
      }
      throw new Error(`Missing ${type}: ${JSON.stringify(messages)}`)
    },
    async close() { const closed = once(socket, 'close'); socket.close(); await closed },
  }
}

test('online snipe keeps a private, idempotent defense across reconnect and resolves without a defender', { timeout: 25000 }, async (t) => {
  const draws = [0, 1, 0]
  const ctx = await setup(t, 'five-in-a-row', 'stone-skills', { drawCard: () => draws.shift() ?? 0 })
  await chooseInitialFortification(ctx)
  let view = ctx.view
  assert.equal(view.rules, 'skills')
  const [first, second] = view.game.players.map(({ id }) => id)
  const attacker = first === 'black' ? ctx.a : ctx.b
  const defender = first === 'black' ? ctx.b : ctx.a
  const defenderToken = (defender === ctx.a ? ctx.sessionA : ctx.sessionB).token
  const target = { row: 2, column: 0 }
  for (let column = 0; column < 2; column++) {
    view = await placePair(attacker, defender, view, column)
  }
  view = await attacker.next('snapshot', (m) => m.revision === view.revision)
  const cardId = view.skills.hands[first][0].id
  const badTarget = await command(attacker, view, { type: 'use-skill', cardId, position: { row: 0, column: 0 } })
  assert.equal(badTarget.result.code, 'invalid-target')
  const snipe = await command(attacker, view, { type: 'use-skill', cardId, position: target })
  assert.equal(snipe.result.ok, true)
  view = snipe.view
  const pending = view.skills.response
  assert.equal(pending.phase, 'snipe')
  assert.deepEqual(view.turn, { phase: 'waiting-defense', activePlayerId: first, round: view.game.turn.round })
  assert.deepEqual(pending.position, target)
  assert.equal(pending.targetId, second)
  assert.equal(view.skills.hands[second], undefined)
  for (const privateKey of ['drawPile', 'randomSeed', 'effects', 'nextDraw']) assert.equal(view.skills[privateKey], undefined)

  await defender.close()
  await attacker.next('snapshot', (m) => m.members.some((member) => member.id === second && !member.connected))
  const resumed = await client(ctx.url)
  resumed.send({ type: 'resume', token: defenderToken })
  await resumed.next('session')
  const restored = await resumed.next('snapshot')
  assert.deepEqual(restored.skills.response, pending)
  assert.deepEqual(restored.turn, { ...view.turn, phase: 'defend' })
  assert.equal(restored.skills.hands[first], undefined)
  const [nullify] = restored.skills.hands[second]
  assert.equal(nullify.skill.kind, 'nullify')
  assert.equal(restored.skills.cardBlocks[nullify.id], null)
  assert.deepEqual(Object.keys(restored.skills.cardBlocks), [String(nullify.id)])

  const response = { type: 'respond', attackId: pending.id, cardId: nullify.id }
  const canceled = await command(resumed, restored, response)
  assert.equal(canceled.result.ok, true)
  const retry = await command(resumed, restored, response, { requestId: canceled.requestId })
  assert.deepEqual(retry.result, canceled.result)
  assert.deepEqual(retry.view.skills.hands[second], [])
  assert.equal(retry.view.skills.snipeOutcome, 'nullified')
  assert.equal(retry.view.turn.phase, 'opponent-turn')
  assert.deepEqual(retry.view.game.turn, view.game.turn)
  assert.equal(retry.view.game.board.cells[2][0].ownerId, second)
  const attackView = await attacker.next('snapshot', (m) => m.revision === canceled.view.revision)
  assert.equal(attackView.skills.hands[second], undefined)
  assert.equal(attackView.turn.phase, 'my-turn')
  assert.equal(JSON.stringify(attackView).includes('discardCardId'), false)

  const place = await command(attacker, attackView, { type: 'place-stone', position: { row: 0, column: 2 } })
  assert.equal(place.result.ok, true)
  const nextTurn = await command(resumed, place.view, { type: 'place-stone', position: { row: 2, column: 2 } })
  assert.equal(nextTurn.result.ok, true)
  const nextAttackView = await attacker.next('snapshot', (m) => m.revision === nextTurn.view.revision)
  const nextSnipe = await command(attacker, nextAttackView, {
    type: 'use-skill', cardId: nextAttackView.skills.hands[first].find(({ skill }) => skill.kind === 'snipe').id, position: target,
  })
  assert.equal(nextSnipe.result.ok, true)
  await resumed.close()
  const timedOut = await attacker.next('snapshot', (m) => m.skills?.snipeOutcome === 'destroyed', 17_000)
  assert.equal(timedOut.revision, nextSnipe.view.revision + 1)
  assert.equal(timedOut.skills.response, null)
  assert.equal(timedOut.game.board.cells[2][0], null)
  assert.deepEqual(timedOut.game.turn, nextSnipe.view.game.turn)
  const later = await client(ctx.url)
  later.send({ type: 'resume', token: defenderToken })
  await later.next('session')
  const postTimeout = await later.next('snapshot')
  assert.equal(postTimeout.revision, timedOut.revision)
  assert.deepEqual(postTimeout.game, timedOut.game)
  assert.equal(postTimeout.skills.hands[second].length, nextTurn.view.skills.hands[second].length)
})
async function setup(t, mode = 'five-in-a-row', rules = 'basic', options = {}) {
  const server = createOnlineServer(options)
  await once(server.http, 'listening')
  t.after(() => server.close())
  const url = `ws://127.0.0.1:${server.http.address().port}/online`
  const a = await client(url)
  a.send({ type: 'create', mode, rules })
  const sessionA = await a.next('session')
  const waiting = await a.next('snapshot')
  assert.equal(waiting.game, null)
  const b = await client(url)
  b.send({ type: 'join', roomId: sessionA.roomId })
  const sessionB = await b.next('session')
  const view = await a.next('snapshot', (m) => !!m.game)
  await b.next('snapshot', (m) => !!m.game)
  return { server, url, a, b, sessionA, sessionB, view }
}
async function command(client, view, action, extra = {}) {
  const requestId = client.send({ type: 'command', gameId: view.gameId, revision: view.revision, action, ...extra })
  const result = await client.next('result', (m) => m.requestId === requestId)
  const next = await client.next('snapshot', (m) => m.revision === result.revision)
  return { result, view: next, requestId }
}

async function placePair(first, second, view, column) {
  for (const [actor, row] of [[first, 0], [second, 2]]) {
    const move = await command(actor, view, { type: 'place-stone', position: { row, column } })
    assert.equal(move.result.ok, true)
    view = move.view
  }
  return view
}

async function chooseInitialFortification(ctx) {
  const action = { type: 'choose-augment', round: 1, augmentId: 'fortification' }
  assert.equal((await command(ctx.a, ctx.view, action)).result.ok, true)
  assert.equal((await command(ctx.b, ctx.view, action)).result.ok, true)
  ctx.view = await ctx.a.next('snapshot', (m) => m.skills?.augment.pending === false)
}

test('skill turn clock pauses for defense, survives reconnect and auto-places once at the deadline', async (t) => {
  let time = 100_000
  const draws = [3, 1]
  const ctx = await setup(t, 'five-in-a-row', 'skills', {
    clockNow: () => time, drawCard: () => draws.shift() ?? 3,
  })
  assert.deepEqual(ctx.view.turnClock, { deadline: null, remainingMs: 20_000 })
  time += 30_000
  await chooseInitialFortification(ctx)
  const firstId = ctx.view.turn.activePlayerId
  const first = firstId === 'black' ? ctx.a : ctx.b
  const second = first === ctx.a ? ctx.b : ctx.a
  const secondId = firstId === 'black' ? 'white' : 'black'
  const secondToken = (second === ctx.a ? ctx.sessionA : ctx.sessionB).token
  assert.deepEqual(ctx.view.turnClock, { deadline: time + 20_000 })

  const roundTwo = await placePair(first, second, ctx.view, 0)
  const roundThree = await placePair(first, second, roundTwo, 1)
  const before = await first.next('snapshot', (m) => m.revision === roundThree.revision)
  const disarm = before.skills.hands[firstId].find((card) => card.skill.kind === 'discard')
  time += 7_000
  const attack = await command(first, before, { type: 'use-skill', cardId: disarm.id })
  assert.equal(attack.result.ok, true)
  assert.deepEqual(attack.view.turnClock, { deadline: null, remainingMs: 13_000 })
  const defense = await second.next('snapshot', (m) => m.revision === attack.view.revision)
  const [nullify] = defense.skills.hands[secondId]
  assert.equal(nullify.skill.kind, 'nullify')
  assert.equal(defense.skills.cardBlocks[nullify.id], null)
  await second.close()
  time += 50_000

  const resumed = await client(ctx.url)
  resumed.send({ type: 'resume', token: secondToken })
  await resumed.next('session')
  const restored = await resumed.next('snapshot')
  assert.deepEqual(restored.turnClock, defense.turnClock)
  assert.deepEqual(restored.skills.hands[secondId], [nullify])
  const pass = { type: 'respond', attackId: disarm.id }
  const resolved = await command(resumed, restored, pass)
  assert.equal(resolved.result.ok, true)
  assert.deepEqual(resolved.view.turnClock, { deadline: time + 13_000 })
  assert.deepEqual(resolved.view.skills.hands[secondId], [])
  assert.equal(nullify.id in resolved.view.skills.cardBlocks, false)
  assert.equal(resolved.view.turn.activePlayerId, firstId)
  const restoredAgain = await client(ctx.url)
  restoredAgain.send({ type: 'resume', token: secondToken })
  await restoredAgain.next('session')
  const restoredAfter = await restoredAgain.next('snapshot')
  assert.deepEqual(restoredAfter.skills.hands[secondId], [])
  assert.deepEqual(restoredAfter.turnClock, resolved.view.turnClock)
  const replay = await command(restoredAgain, restored, pass, { requestId: resolved.requestId })
  assert.deepEqual(replay.result, resolved.result)
  assert.deepEqual(replay.view.turnClock, resolved.view.turnClock)

  time = resolved.view.turnClock.deadline
  const place = { type: 'place-stone', position: { row: 0, column: 2 } }
  const late = await command(first, resolved.view, place)
  assert.equal(late.result.code, 'STALE_REVISION')
  assert.equal(late.view.revision, resolved.view.revision + 1)
  assert.equal(late.view.turn.activePlayerId, secondId)
  assert.deepEqual(late.view.turnClock, { deadline: time + 20_000 })
  assert.equal(late.view.game.board.cells.flat().filter(Boolean).length, 5)
  assert.equal(late.view.game.board.cells.flat().filter((stone) => stone?.ownerId === firstId).length, 3)
  const duplicate = await command(first, resolved.view, place, { requestId: late.requestId })
  assert.deepEqual(duplicate.result, late.result)
  assert.deepEqual(duplicate.view.game, late.view.game)
})

test('online augment choices wait for both players and survive reconnect without regranting cards', async (t) => {
  const ctx = await setup(t, 'five-in-a-row', 'skills', { drawCard: () => 0 })
  const initial = ctx.view
  assert.deepEqual(initial.skills.augment.choices, ['card-bundle', 'fortification'])
  assert.equal(initial.skills.augment.pending, true)
  const active = initial.game.players[0].id === 'black' ? ctx.a : ctx.b
  const blocked = await command(active, initial, { type: 'place-stone', position: { row: 0, column: 0 } })
  assert.equal(blocked.result.code, 'augment-pending')

  const choose = { type: 'choose-augment', round: 1, augmentId: 'card-bundle' }
  const badRound = await command(ctx.a, initial, { ...choose, round: 6 })
  assert.equal(badRound.result.code, 'invalid-augment')
  const picked = await command(ctx.a, initial, choose)
  assert.equal(picked.result.ok, true)
  assert.equal(picked.view.handCounts.black, initial.handCounts.black + 4)
  assert.deepEqual(picked.view.skills.augment.owned, ['card-bundle'])
  assert.deepEqual(picked.view.skills.augment.choices, [])
  assert.equal(picked.view.skills.augment.pending, true)
  const duplicate = await command(ctx.a, initial, choose, { requestId: picked.requestId })
  assert.deepEqual(duplicate.result, picked.result)
  const alreadyPicked = await command(ctx.a, picked.view, { ...choose, augmentId: 'fortification' })
  assert.equal(alreadyPicked.result.code, 'invalid-augment')

  await ctx.b.close()
  const restored = await client(ctx.url)
  restored.send({ type: 'resume', token: ctx.sessionB.token })
  await restored.next('session')
  const rejoined = await restored.next('snapshot')
  assert.deepEqual(rejoined.skills.augment.choices, initial.skills.augment.choices)
  assert.deepEqual(rejoined.skills.augment.owned, [])
  assert.equal(rejoined.skills.hands.black, undefined)
  assert.equal(rejoined.skills.augmentOffer, undefined)
  const finished = await command(restored, initial, { ...choose, augmentId: 'fortification' })
  assert.equal(finished.result.ok, true)
  assert.equal(finished.view.skills.augment.pending, false)
  assert.deepEqual(finished.view.skills.augment.fortifiedPlayers, ['white'])
  const mirrored = await ctx.a.next('snapshot', (m) => m.revision === finished.view.revision)
  assert.deepEqual(mirrored.game, finished.view.game)
  assert.equal(mirrored.handCounts.black, initial.handCounts.black + 4)
  ctx.a.send({ type: 'sync' })
  await ctx.a.next('snapshot', (m) => m.revision === finished.view.revision)
  assert.deepEqual(ctx.a.sounds(), [])
})

for (const [mode, length, rules] of [['five-in-a-row', 5, 'basic'], ['six-in-a-row', 6, 'basic'], ['five-in-a-row', 5, 'skills']]) {
  test(`online ${mode} ${rules}: exact win, two-party rematch and stable player identity`, { timeout: 15000 }, async (t) => {
    const ctx = await setup(t, mode, rules)
    if (rules === 'skills') await chooseInitialFortification(ctx)
    let view = ctx.view
    const [firstId, secondId] = view.game.players.map(({ id }) => id)
    const first = firstId === 'black' ? ctx.a : ctx.b
    const second = first === ctx.a ? ctx.b : ctx.a
    const colors = (snapshot) => Object.fromEntries(snapshot.members.map(({ id, color }) => [id, color]))
    if (rules === 'skills') assert.deepEqual(colors(view), { [firstId]: 'black', [secondId]: 'white' })
    for (let column = 0; column < length; column++) {
      let step = await command(first, view, { type: 'place-stone', position: { row: 0, column } })
      assert.equal(step.result.ok, true)
      view = step.view
      if (column < length - 1) {
        step = await command(second, view, { type: 'place-stone', position: { row: 2, column } })
        assert.equal(step.result.ok, true)
        view = step.view
      }
    }
    assert.equal(view.game.status, 'finished')
    assert.equal(view.game.result.winnerId, view.game.players[0].id)
    const oldGameId = view.gameId
    const oldFirst = view.game.players[0].id
    view = (await command(first, view, { type: 'rematch' })).view
    const newRound = await command(second, view, { type: 'rematch' })
    assert.equal(newRound.result.ok, true)
    assert.notEqual(newRound.view.gameId, oldGameId)
    assert.notEqual(newRound.view.game.players[0].id, oldFirst)
    assert.ok(newRound.view.game.board.cells.flat().every((cell) => cell === null))
    if (rules === 'skills') {
      const mirrored = await first.next('snapshot', (m) => m.gameId === newRound.view.gameId)
      assert.equal(mirrored.playerId, firstId)
      assert.equal(newRound.view.playerId, secondId)
      assert.deepEqual(colors(newRound.view), { [firstId]: 'white', [secondId]: 'black' })
      assert.deepEqual(colors(mirrored), colors(newRound.view))
      const resumed = await client(ctx.url)
      resumed.send({ type: 'resume', token: (first === ctx.a ? ctx.sessionA : ctx.sessionB).token })
      await resumed.next('session')
      const restored = await resumed.next('snapshot')
      assert.equal(restored.playerId, firstId)
      assert.deepEqual(colors(restored), colors(newRound.view))
      assert.deepEqual(restored.handCounts, { [firstId]: 0, [secondId]: 0 })
    }
  })
}

test('authority, idempotency, revision race, room capacity, resume and fencing', { timeout: 15000 }, async (t) => {
  const ctx = await setup(t)
  let view = ctx.view
  const first = view.game.players[0].id === 'black' ? ctx.a : ctx.b
  const second = first === ctx.a ? ctx.b : ctx.a
  const rejected = await command(second, view, { type: 'place-stone', actorId: view.game.players[0].id, position: { row: 0, column: 0 } })
  assert.equal(rejected.result.code, 'not-active-player')
  const move = { type: 'place-stone', position: { row: 7, column: 7 } }
  const accepted = await command(first, view, move)
  assert.equal(accepted.result.ok, true)
  const repeat = await command(first, view, move, { requestId: accepted.requestId })
  assert.deepEqual(repeat.result, accepted.result)
  first.send({ type: 'command', requestId: accepted.requestId, gameId: view.gameId, revision: view.revision, action: { type: 'place-stone', position: { row: 0, column: 0 } } })
  assert.equal((await first.next('error')).code, 'REQUEST_ID_REUSED')
  const stale = await command(second, view, { type: 'place-stone', position: { row: 0, column: 1 } })
  assert.equal(stale.result.code, 'STALE_REVISION')
  view = accepted.view
  const third = await client(ctx.url)
  third.send({ type: 'join', roomId: view.roomId })
  assert.equal((await third.next('error')).code, 'ROOM_FULL')
  const closed = once(ctx.a.socket, 'close')
  // Abrupt server-side disconnect rather than a graceful client handshake.
  const aServerSocket = [...ctx.server.wss.clients][0]
  aServerSocket.terminate()
  await closed
  await ctx.b.next('snapshot', (m) => m.members.some((p) => p.id === 'black' && !p.connected))
  const resumed = await client(ctx.url)
  resumed.send({ type: 'resume', token: ctx.sessionA.token })
  await resumed.next('session')
  const restored = await resumed.next('snapshot')
  assert.equal(restored.playerId, 'black')
  assert.deepEqual(restored.game, view.game)
  const replacement = await client(ctx.url)
  const replaced = once(resumed.socket, 'close')
  replacement.send({ type: 'resume', token: ctx.sessionA.token })
  await replacement.next('session')
  await replaced
  third.send({ type: 'resume', token: 'invalid' })
  assert.equal((await third.next('error')).code, 'SESSION_EXPIRED')
})

test('skill play, private projection, defense and resume do not redraw', { timeout: 15000 }, async (t) => {
  const draws = [3, 1]
  const ctx = await setup(t, 'five-in-a-row', 'skills', { drawCard: () => draws.shift() ?? 3 })
  await chooseInitialFortification(ctx)
  let view = ctx.view
  const firstId = view.game.players[0].id
  const first = firstId === 'black' ? ctx.a : ctx.b
  const second = first === ctx.a ? ctx.b : ctx.a
  const secondId = firstId === 'black' ? 'white' : 'black'
  const checkPrivacy = (snapshot) => {
    assert.deepEqual(Object.keys(snapshot.skills.hands), [snapshot.playerId])
    assert.ok(!('randomSeed' in snapshot.skills))
    assert.ok(!('drawPile' in snapshot.skills))
    assert.ok(!('effects' in snapshot.skills))
    assert.ok(!snapshot.skills.response || !('discarded' in snapshot.skills.response))
  }
  checkPrivacy(view)
  assert.deepEqual(view.handCounts, { black: 0, white: 0 })
  view = await placePair(first, second, view, 0)
  assert.deepEqual(view.handCounts, { [firstId]: 1, [secondId]: 0 })
  view = await placePair(first, second, view, 1)
  assert.deepEqual(view.handCounts, { [firstId]: 1, [secondId]: 1 })
  const firstViewId = first.send({ type: 'sync' })
  assert.ok(firstViewId)
  view = await first.next('snapshot', (m) => m.revision === view.revision && m.playerId === firstId)
  const card = view.skills.hands[firstId].find((c) => c.skill.kind === 'discard')
  view = (await command(first, view, { type: 'use-skill', cardId: card.id })).view
  const attackSound = await first.next('sound', (message) => message.revision === view.revision)
  assert.deepEqual(attackSound.cues, ['skill'])
  assert.deepEqual(await second.next('sound', (message) => message.revision === view.revision), attackSound)
  assert.deepEqual(Object.keys(attackSound).sort(), ['cues', 'gameId', 'revision', 'type', 'v'])
  assert.equal(view.skills.response.targetId, secondId)
  assert.equal(view.skills.response.phase, 'before')
  assert.equal(view.skills.response.deadline, undefined)
  const rejected = await command(first, view, { type: 'place-stone', position: { row: 0, column: 1 } })
  assert.equal(rejected.result.code, 'response-pending')
  second.send({ type: 'sync' })
  const defenseView = await second.next('snapshot', (m) => m.revision === view.revision && !!m.skills.response)
  const defense = defenseView.skills.hands[secondId].find((c) => c.skill.kind === 'nullify')
  assert.equal(defenseView.skills.cardBlocks[defense.id], null)
  const reply = { type: 'respond', attackId: view.skills.response.id, cardId: defense.id }
  const accepted = await command(second, view, reply)
  assert.equal(accepted.result.ok, true)
  const replayed = await command(second, view, reply, { requestId: accepted.requestId })
  assert.deepEqual(replayed.result, accepted.result)
  view = accepted.view
  assert.deepEqual(view.skills.hands[secondId], defenseView.skills.hands[secondId].filter((c) => c.id !== defense.id))
  assert.deepEqual((await second.next('sound', (message) => message.revision === view.revision)).cues, ['skill'])
  assert.equal(view.skills.response, null)
  assert.equal(view.game.players[view.game.turn.activeSeat].id, firstId)
  checkPrivacy(view)
  const token = second === ctx.a ? ctx.sessionA.token : ctx.sessionB.token
  const restore = await client(ctx.url)
  restore.send({ type: 'resume', token })
  await restore.next('session')
  const restored = await restore.next('snapshot')
  checkPrivacy(restored)
  assert.deepEqual(restored.handCounts, view.handCounts)
  assert.deepEqual(restored.skills.hands[secondId], view.skills.hands[secondId])
  assert.equal(restored.revision, view.revision)
})

test('sound events are broadcast once on acceptance, not on rejection, replay or resume', { timeout: 10000 }, async (t) => {
  const ctx = await setup(t)
  const first = ctx.view.game.players[0].id === 'black' ? ctx.a : ctx.b
  const second = first === ctx.a ? ctx.b : ctx.a
  const move = { type: 'place-stone', position: { row: 7, column: 7 } }
  const accepted = await command(first, ctx.view, move)
  const sound = await first.next('sound')
  assert.deepEqual(sound.cues, ['place'])
  assert.equal(sound.revision, accepted.view.revision)
  assert.deepEqual(await second.next('sound'), sound)
  first.clear(); second.clear()
  await command(first, ctx.view, move, { requestId: accepted.requestId })
  first.send({ type: 'sync' })
  await first.next('snapshot')
  assert.deepEqual(first.sounds(), [])
  const rejected = await command(first, accepted.view, { type: 'place-stone', position: { row: 0, column: 0 } })
  assert.equal(rejected.result.ok, false)
  first.send({ type: 'sync' })
  await first.next('snapshot')
  assert.deepEqual(first.sounds(), [])
  assert.deepEqual(second.sounds(), [])
  const recovered = await client(ctx.url)
  recovered.send({ type: 'resume', token: ctx.sessionA.token })
  await recovered.next('session')
  await recovered.next('snapshot')
  recovered.send({ type: 'sync' })
  await recovered.next('snapshot')
  assert.deepEqual(recovered.sounds(), [])
})

test('expiration, invalid messages and origin rejection', { timeout: 10000 }, async (t) => {
  const ctx = await setup(t, 'five-in-a-row', 'basic', { graceMs: 25 })
  const health = await fetch(`http://127.0.0.1:${ctx.server.http.address().port}/health`)
  assert.equal(health.status, 200)
  assert.equal((await health.json()).status, 'ok')
  ctx.a.socket.send('{')
  assert.equal((await ctx.a.next('error')).code, 'INVALID_MESSAGE')
  const untrusted = new Ws(ctx.url, { origin: 'https://untrusted.example' })
  const rejected = once(untrusted, 'unexpected-response')
  const [, response] = await rejected
  assert.equal(response.statusCode, 403)
  response.resume()
  untrusted.terminate()
  untrusted.on('error', () => {})
  await ctx.a.close(); await ctx.b.close()
  await new Promise((done) => setTimeout(done, 80))
  const restored = await client(ctx.url)
  restored.send({ type: 'resume', token: ctx.sessionA.token })
  assert.equal((await restored.next('error')).code, 'SESSION_EXPIRED')
})
