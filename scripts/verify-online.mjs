import assert from 'node:assert/strict'
import { once } from 'node:events'
import { WebSocket } from 'ws'

// Explicitly invoked post-deployment smoke check. Never print tokens or full snapshots.
const origin = new URL(process.argv[2] ?? 'http://127.0.0.1:8787').origin
const healthResponse = await fetch(`${origin}/health`, { signal: AbortSignal.timeout(90_000) })
assert.equal(healthResponse.status, 200)
const health = await healthResponse.json()
assert.equal(health.status, 'ok')
if (process.argv[3]) assert.equal(health.commit, process.argv[3])
const page = await fetch(origin, { signal: AbortSignal.timeout(20_000) })
assert.equal(page.status, 200)
assert.match(await page.text(), /Skilled Gomoku/)
const clients = []
async function client() {
  const ws = new WebSocket(origin.replace(/^http/, 'ws') + '/online', { origin, handshakeTimeout: 20_000 })
  const inbox = []
  ws.on('error', () => {})
  ws.on('message', (data) => inbox.push(JSON.parse(data)))
  clients.push(ws)
  await once(ws, 'open')
  return {
    ws,
    send(message) { const requestId = crypto.randomUUID(); ws.send(JSON.stringify({ v: 1, ...message, requestId })); return requestId },
    async next(type, predicate = () => true) {
      const deadline = Date.now() + 20_000
      while (Date.now() < deadline) {
        const index = inbox.findIndex((message) => message.type === type && predicate(message))
        if (index >= 0) return inbox.splice(index, 1)[0]
        await new Promise((done) => setTimeout(done, 25))
      }
      throw new Error(`Timeout waiting for ${type}`)
    },
  }
}

try {
  for (const rules of ['basic', 'skills']) {
    const a = await client(), b = await client()
    a.send({ type: 'create', mode: 'five-in-a-row', rules })
    const session = await a.next('session')
    b.send({ type: 'join', roomId: session.roomId })
    await b.next('session')
    let initial = await a.next('snapshot', (view) => !!view.game)
    const joined = await b.next('snapshot', (view) => !!view.game)
    if (initial.skills?.augment?.pending) {
      for (const [player, view] of [[a, initial], [b, joined]]) {
        const requestId = player.send({ type: 'command', gameId: view.gameId, revision: view.revision,
          action: { type: 'choose-augment', round: view.game.turn.round, augmentId: view.skills.augment.choices[0] } })
        assert.equal((await player.next('result', (message) => message.requestId === requestId)).ok, true)
      }
      initial = await a.next('snapshot', (view) => view.skills?.augment?.pending === false)
    }
    const first = initial.game.players[0].id === 'black' ? a : b
    const id = first.send({ type: 'command', gameId: initial.gameId, revision: initial.revision, action: { type: 'place-stone', position: { row: 7, column: 7 } } })
    assert.equal((await first.next('result', (message) => message.requestId === id)).ok, true)
    const left = await a.next('snapshot', (view) => view.revision > initial.revision)
    const right = await b.next('snapshot', (view) => view.revision > initial.revision)
    assert.deepEqual(left.game, right.game)
    if (rules === 'skills') {
      assert.deepEqual(Object.keys(left.skills.hands), ['black'])
      assert.deepEqual(Object.keys(right.skills.hands), ['white'])
      assert.equal('randomSeed' in left.skills, false)
    }
    const closed = once(a.ws, 'close'); a.ws.terminate(); await closed
    const recovered = await client()
    recovered.send({ type: 'resume', token: session.token })
    await recovered.next('session')
    const restored = await recovered.next('snapshot')
    assert.deepEqual(restored.game, left.game)
    assert.equal(restored.playerId, 'black')
    assert.deepEqual(restored.handCounts, left.handCounts)
    recovered.send({ type: 'leave' })
    console.log(`${rules}: ${origin.startsWith('https:') ? 'WSS' : 'WS'} join, authoritative move, synchronization, private view and resume OK`)
  }
  console.log(`Verified ${origin} at commit ${health.commit}`)
} finally {
  for (const ws of clients) ws.terminate()
}
