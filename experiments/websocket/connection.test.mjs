import assert from 'node:assert/strict'
import { once } from 'node:events'
import test from 'node:test'
import { createServer } from './server.mjs'

async function client(url) {
  // Node 24 and browsers both provide the standard WebSocket client.
  const socket = new WebSocket(url)
  const messages = []
  socket.addEventListener('message', (event) => messages.push(JSON.parse(event.data)))
  await once(socket, 'open')
  return {
    socket,
    send: (message) => socket.send(JSON.stringify({ v: 1, requestId: crypto.randomUUID(), ...message })),
    async next(type, predicate = () => true) {
      const deadline = Date.now() + 2000
      while (Date.now() < deadline) {
        const index = messages.findIndex((message) => message.type === type && predicate(message))
        if (index !== -1) return messages.splice(index, 1)[0]
        await new Promise((resolve) => setTimeout(resolve, 5))
      }
      throw new Error(`Timed out waiting for ${type}`)
    },
    async close() {
      const closed = once(socket, 'close')
      socket.close()
      await closed
    },
  }
}

test('join, isolated rooms, missed state, resume identity, invalid credentials and messages', { timeout: 10_000 }, async (t) => {
  const server = createServer()
  await once(server.wss, 'listening')
  t.after(() => server.close())
  const url = `ws://127.0.0.1:${server.wss.address().port}`
  const a = await client(url)
  const b = await client(url)
  a.send({ type: 'room.join', roomId: 'alpha' })
  const identity = await a.next('session.ready')
  const initial = await a.next('room.snapshot')
  b.send({ type: 'room.join', roomId: 'alpha' })
  await b.next('session.ready')
  const joined = await a.next('room.snapshot', (m) => m.members.length === 2)
  assert.ok(joined.revision > initial.revision)
  // Abrupt transport loss: no client close handshake.
  const disconnected = once(a.socket, 'close')
  const serverSocket = [...server.wss.clients][0]
  serverSocket.terminate()
  await disconnected
  await b.next('room.snapshot', (m) => m.members.some((p) => p.id === identity.memberId && !p.connected))
  const outsider = await client(url)
  outsider.send({ type: 'room.join', roomId: 'beta' })
  const otherRoom = await outsider.next('room.snapshot')
  assert.equal(otherRoom.members.length, 1)
  const c = await client(url)
  c.send({ type: 'room.join', roomId: 'alpha' })
  await c.next('session.ready')
  await b.next('room.snapshot', (m) => m.members.length === 3)
  const resumed = await client(url)
  resumed.send({ type: 'session.resume', roomId: 'alpha', resumeToken: identity.resumeToken })
  assert.equal((await resumed.next('session.ready')).memberId, identity.memberId)
  const recovered = await resumed.next('room.snapshot')
  assert.ok(!JSON.stringify(recovered).includes(identity.resumeToken))
  assert.equal(recovered.members.length, 3)
  assert.ok(recovered.members.every((p) => p.connected))
  assert.ok(recovered.revision > joined.revision)
  const invalid = await client(url)
  invalid.send({ type: 'session.resume', roomId: 'beta', resumeToken: identity.resumeToken })
  assert.equal((await invalid.next('error')).code, 'RESUME_REJECTED')
  invalid.send({ type: 'session.resume', roomId: 'alpha', resumeToken: 'bad' })
  assert.equal((await invalid.next('error')).code, 'RESUME_REJECTED')
  invalid.send({ type: 'session.resume', roomId: 'alpha', resumeToken: identity.resumeToken })
  assert.equal((await invalid.next('error')).code, 'SESSION_ACTIVE')
  invalid.socket.send('{')
  assert.equal((await invalid.next('error')).code, 'INVALID_MESSAGE')
  invalid.send({ type: 'ping', v: 2 })
  assert.equal((await invalid.next('error')).code, 'INVALID_MESSAGE')
  invalid.send({ type: 'game.command' })
  assert.equal((await invalid.next('error')).code, 'UNSUPPORTED_MESSAGE')
  invalid.send({ type: 'ping', requestId: 'health' })
  assert.equal((await invalid.next('pong')).requestId, 'health')
})

test('expired session cannot resume', { timeout: 10_000 }, async (t) => {
  const server = createServer({ graceMs: 20 })
  await once(server.wss, 'listening')
  t.after(() => server.close())
  const url = `ws://127.0.0.1:${server.wss.address().port}`
  const a = await client(url)
  a.send({ type: 'room.join', roomId: 'expiry' })
  const identity = await a.next('session.ready')
  await a.close()
  await new Promise((resolve) => setTimeout(resolve, 80))
  const b = await client(url)
  b.send({ type: 'session.resume', roomId: 'expiry', resumeToken: identity.resumeToken })
  assert.equal((await b.next('error')).code, 'RESUME_REJECTED')
})
