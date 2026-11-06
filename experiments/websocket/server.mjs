// Disposable transport spike. No game rules, seats, account system or persistence.
import { randomUUID } from 'node:crypto'
import { pathToFileURL } from 'node:url'
import { WebSocket, WebSocketServer } from 'ws'

export function createServer({ port = 0, graceMs = 60_000 } = {}) {
  const rooms = new Map()
  const sessions = new Map()
  const wss = new WebSocketServer({ host: '127.0.0.1', port, maxPayload: 4096 })
  const send = (socket, message) => {
    if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ v: 1, ...message }))
  }
  const snapshot = (room) => ({
    roomId: room.id,
    revision: room.revision,
    members: [...room.members.values()].map(({ id, socket }) => ({ id, connected: !!socket })),
  })
  function publish(room) {
    room.revision++
    for (const member of room.members.values()) {
      if (member.socket) send(member.socket, { type: 'room.snapshot', ...snapshot(room) })
    }
  }
  function remove(member) {
    clearTimeout(member.expiry)
    sessions.delete(member.token)
    member.room.members.delete(member.id)
    if (!member.room.members.size) rooms.delete(member.room.id)
    else publish(member.room)
  }
  wss.on('connection', (socket) => {
    let member
    socket.on('error', () => {})
    socket.on('message', (data, binary) => {
      let message
      try { message = JSON.parse(data.toString()) } catch { /* rejected below */ }
      const requestId = message?.requestId
      const reject = (code) => send(socket, { type: 'error', requestId, code })
      if (binary || !message || message.v !== 1 || typeof requestId !== 'string' || requestId.length > 80) {
        reject('INVALID_MESSAGE'); return
      }
      if (message.type === 'ping') {
        send(socket, { type: 'pong', requestId }); return
      }
      if (message.type !== 'room.join' && message.type !== 'session.resume') {
        reject('UNSUPPORTED_MESSAGE'); return
      }
      if (member) { reject('ALREADY_JOINED'); return }
      if (message.type === 'room.join') {
        if (typeof message.roomId !== 'string' || !/^[a-zA-Z0-9-]{1,32}$/.test(message.roomId)) {
          reject('INVALID_ROOM'); return
        }
        let room = rooms.get(message.roomId)
        if ((!room && rooms.size >= 20) || (room && room.members.size >= 16)) {
          reject('EXPERIMENT_LIMIT'); return
        }
        if (!room) {
          room = { id: message.roomId, revision: 0, members: new Map() }
          rooms.set(room.id, room)
        }
        member = { id: randomUUID(), token: randomUUID(), room, socket, expiry: undefined }
        room.members.set(member.id, member)
        sessions.set(member.token, member)
      } else {
        if (typeof message.resumeToken !== 'string') { reject('RESUME_REJECTED'); return }
        const existing = sessions.get(message.resumeToken)
        if (!existing || existing.room.id !== message.roomId) { reject('RESUME_REJECTED'); return }
        if (existing.socket) { reject('SESSION_ACTIVE'); return }
        member = existing
        clearTimeout(member.expiry)
        member.socket = socket
      }
      send(socket, { type: 'session.ready', requestId, memberId: member.id, resumeToken: member.token })
      // Always use a full snapshot in this experiment, including on resume.
      publish(member.room)
    })
    socket.on('close', () => {
      if (!member || member.socket !== socket) return
      member.socket = undefined
      publish(member.room)
      member.expiry = setTimeout(() => remove(member), graceMs)
      member.expiry.unref()
    })
  })
  return {
    wss,
    async close() {
      for (const member of sessions.values()) clearTimeout(member.expiry)
      for (const socket of wss.clients) socket.terminate()
      await new Promise((resolve) => wss.close(resolve))
      // close handlers can create timers; clear those too.
      for (const member of sessions.values()) clearTimeout(member.expiry)
    },
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const server = createServer({ port: 8787 })
  server.wss.on('listening', () => console.log('Experimental WebSocket: ws://127.0.0.1:8787'))
  process.once('SIGINT', () => void server.close())
}
