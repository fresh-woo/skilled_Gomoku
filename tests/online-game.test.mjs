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
    send(message) { const requestId = message.requestId ?? crypto.randomUUID(); socket.send(JSON.stringify({ v: 1, ...message, requestId })); return requestId },
    async next(type, predicate = () => true) {
      const deadline = Date.now() + 2500
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

for (const [mode, length] of [['five-in-a-row', 5], ['six-in-a-row', 6]]) {
  test(`online ${mode}: authorized turns, exact win, two-party rematch`, { timeout: 15000 }, async (t) => {
    const ctx = await setup(t, mode)
    let view = ctx.view
    const first = view.game.players[0].id === 'black' ? ctx.a : ctx.b
    const second = first === ctx.a ? ctx.b : ctx.a
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
  const ctx = await setup(t, 'five-in-a-row', 'skills')
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
  view = (await command(first, view, { type: 'place-stone', position: { row: 0, column: 0 } })).view
  view = (await command(second, view, { type: 'place-stone', position: { row: 2, column: 0 } })).view
  view = (await command(first, view, { type: 'place-stone', position: { row: 0, column: 1 } })).view
  view = (await command(second, view, { type: 'place-stone', position: { row: 2, column: 1 } })).view
  const firstViewId = first.send({ type: 'sync' })
  assert.ok(firstViewId)
  view = await first.next('snapshot', (m) => m.revision === view.revision && m.playerId === firstId)
  const card = view.skills.hands[firstId].find((c) => c.skill.kind === 'discard')
  view = (await command(first, view, { type: 'use-skill', cardId: card.id })).view
  assert.equal(view.skills.response.targetId, secondId)
  const rejected = await command(first, view, { type: 'place-stone', position: { row: 0, column: 1 } })
  assert.equal(rejected.result.code, 'response-pending')
  second.send({ type: 'sync' })
  const defenseView = await second.next('snapshot', (m) => m.revision === view.revision && !!m.skills.response)
  const defense = defenseView.skills.hands[secondId].find((c) => c.skill.kind === 'cancel')
  view = (await command(second, view, { type: 'respond', attackId: view.skills.response.id, cardId: defense.id })).view
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
  assert.equal(restored.revision, view.revision)
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
