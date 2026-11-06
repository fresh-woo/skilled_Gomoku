import { createServer } from 'node:http'
import { randomUUID, randomInt } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { resolve, extname, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { WebSocketServer, WebSocket } from 'ws'
import { applyCommand, startGame } from '../src/entities/game/model/game.ts'
import { applySkillCommand, expireSnipe, offerRoundAugments, ONLINE_SKILL_COUNT, startSkillGame } from '../src/entities/game/model/skillGame.ts'
import { projectSkillGame } from '../src/entities/game/model/skillGameView.ts'
import { actionSounds } from '../src/entities/game/model/soundEvents.ts'
import { projectOnlineTurn } from '../src/entities/game/model/onlineTurn.ts'

export function createOnlineServer({ port = 0, host = '127.0.0.1', graceMs = 600_000, origins = [], drawCard = () => randomInt(ONLINE_SKILL_COUNT) } = {}) {
  const rooms = new Map()
  const tokens = new Map()
  const root = fileURLToPath(new URL('../dist/', import.meta.url))
  const http = createServer(async (req, res) => {
    if (req.url === '/health') {
      res.setHeader('Content-Type', 'application/json')
      res.setHeader('Cache-Control', 'no-store')
      res.end(JSON.stringify({ status: 'ok', commit: process.env.RENDER_GIT_COMMIT ?? 'local' }))
      return
    }
    try {
      const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname)
      const file = resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname))
      if (!file.startsWith(root.endsWith(sep) ? root : root + sep)) { res.writeHead(403).end(); return }
      const body = await readFile(file)
      res.setHeader('Content-Type', ({ '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' })[extname(file)] ?? 'application/octet-stream')
      res.setHeader('X-Content-Type-Options', 'nosniff')
      res.end(body)
    } catch { res.writeHead(404).end('Not found. Run npm run build first.') }
  })
  const wss = new WebSocketServer({ noServer: true, maxPayload: 4096 })
  http.on('upgrade', (req, socket, head) => {
    const origin = req.headers.origin
    let validOrigin = !origin || origins.includes(origin)
    try { validOrigin ||= new URL(origin).host === req.headers.host } catch { /* missing/invalid origin */ }
    if (req.url !== '/online' || !validOrigin) { socket.end('HTTP/1.1 403 Forbidden\r\n\r\n'); return }
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws))
  })
  const send = (ws, message) => {
    if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ v: 1, ...message }))
  }
  function snapshot(room, member) {
    const skill = room.skills
    const skills = skill ? projectSkillGame(skill, member.id) : null
    const game = skills?.game ?? room.game
    return {
      type: 'snapshot', roomId: room.id, gameId: room.gameId, revision: room.revision, serverTime: Date.now(),
      playerId: member.id, mode: room.mode, rules: room.rules,
      members: room.members.map((m) => ({ id: m.id, connected: !!m.ws, ready: m.ready })),
      game, turn: projectOnlineTurn(game, skills, member.id),
      skills,
      handCounts: skill ? Object.fromEntries(room.members.map((m) => [m.id, skill.hands[m.id].length])) : {},
    }
  }
  function broadcast(room) { for (const member of room.members) send(member.ws, snapshot(room, member)) }
  function broadcastSounds(room, cues) {
    if (!cues.length) return
    for (const member of room.members) {
      send(member.ws, { type: 'sound', gameId: room.gameId, revision: room.revision, cues })
    }
  }
  function settleDefense(room, time) {
    if (!room.skills) return false
    const next = expireSnipe(room.skills, time)
    if (next === room.skills) return false
    room.skills = next
    room.revision++
    clearTimeout(room.defenseTimer)
    broadcast(room)
    return true
  }
  function scheduleDefense(room) {
    clearTimeout(room.defenseTimer)
    const response = room.skills?.response
    if (response?.phase !== 'snipe') return
    room.defenseTimer = setTimeout(() => {
      if (!settleDefense(room, Date.now())) scheduleDefense(room)
    }, Math.max(0, response.deadline - Date.now()))
    room.defenseTimer.unref()
  }
  function begin(room) {
    const previous = room.skills?.game ?? room.game
    const players = previous ? [...previous.players].reverse().map((p) => p.id)
      : (randomInt(2) ? ['black', 'white'] : ['white', 'black'])
    room.gameId = randomUUID()
    if (room.rules === 'skills') {
      room.skills = offerRoundAugments(startSkillGame(room.mode, players, null, randomInt(0x100000000), drawCard()).state)
    }
    else room.game = startGame(room.mode, players).state
    for (const m of room.members) { m.ready = false; m.results.clear() }
    room.revision++
  }
  function destroy(room) {
    clearTimeout(room.expiry)
    clearTimeout(room.defenseTimer)
    rooms.delete(room.id)
    for (const m of room.members) { tokens.delete(m.token); m.ws?.close(4003, 'Room expired') }
  }
  wss.on('connection', (ws) => {
    let member, room
    let windowStart = Date.now(), count = 0
    ws.alive = true
    ws.on('pong', () => { ws.alive = true })
    ws.on('error', () => {})
    ws.on('message', (raw, binary) => {
      if (Date.now() - windowStart > 1000) { count = 0; windowStart = Date.now() }
      if (++count > 30) { ws.close(4008, 'Rate limited'); return }
      let msg
      try { msg = JSON.parse(raw.toString()) } catch { send(ws, { type: 'error', code: 'INVALID_MESSAGE' }); return }
      const fail = (code) => send(ws, { type: 'error', requestId: msg?.requestId, code })
      if (binary || !msg || msg.v !== 1 || typeof msg.requestId !== 'string' || !msg.requestId.length || msg.requestId.length > 80) { fail('INVALID_MESSAGE'); return }
      if (!member) {
        if (msg.type === 'resume') {
          const saved = typeof msg.token === 'string' ? tokens.get(msg.token) : null
          if (!saved) { fail('SESSION_EXPIRED'); return }
          room = saved.room; member = saved.member
          const old = member.ws
          member.ws = ws
          old?.close(4001, 'Session replaced')
          clearTimeout(room.expiry)
        } else if (msg.type === 'create' || msg.type === 'join') {
          if (msg.type === 'create') {
            if (rooms.size >= 100) { fail('SERVER_FULL'); return }
            if (!['five-in-a-row', 'six-in-a-row'].includes(msg.mode) || !['basic', 'skills', 'stone-skills'].includes(msg.rules)) { fail('INVALID_SETTINGS'); return }
            const rules = msg.rules === 'stone-skills' ? 'skills' : msg.rules
            room = { id: randomUUID(), mode: msg.mode, rules, gameId: '', revision: 0, game: null, skills: null, members: [] }
            rooms.set(room.id, room)
          } else room = typeof msg.roomId === 'string' ? rooms.get(msg.roomId) : null
          if (!room) { fail('ROOM_NOT_FOUND'); return }
          if (room.members.length >= 2) { fail('ROOM_FULL'); return }
          member = { id: room.members.length ? 'white' : 'black', token: randomUUID(), ws, ready: false, results: new Map() }
          room.members.push(member)
          tokens.set(member.token, { member, room })
          if (room.members.length === 2) begin(room)
        } else { fail('NOT_JOINED'); return }
        send(ws, { type: 'session', token: member.token, roomId: room.id })
        if (!settleDefense(room, Date.now())) broadcast(room)
        return
      }
      if (member.ws !== ws) { fail('SESSION_REPLACED'); return }
      const time = Date.now()
      settleDefense(room, time)
      if (msg.type === 'sync') { send(ws, snapshot(room, member)); return }
      if (msg.type === 'leave') { destroy(room); return }
      if (msg.type !== 'command') { fail('INVALID_MESSAGE'); return }
      const fingerprint = JSON.stringify({ gameId: msg.gameId, revision: msg.revision, action: msg.action })
      const existing = member.results.get(msg.requestId)
      if (existing) {
        if (existing.fingerprint !== fingerprint) { fail('REQUEST_ID_REUSED'); return }
        send(ws, existing.result); send(ws, snapshot(room, member)); return
      }
      const result = { type: 'result', requestId: msg.requestId, ok: false, code: '', revision: room.revision }
      const action = msg.action
      const game = room.skills?.game ?? room.game
      // Both players may choose from the same snapshot while this round's offer is open.
      const currentOffer = action?.type === 'choose-augment' && room.skills?.augmentOffer &&
        action.round === game?.turn?.round && Number.isSafeInteger(msg.revision) &&
        msg.revision >= 0 && msg.revision <= room.revision
      let cues = []
      if (member.results.size >= 2048) { fail('HISTORY_FULL'); return }
      if (!game || msg.gameId !== room.gameId) result.code = 'WRONG_GAME'
      else if (msg.revision !== room.revision && !currentOffer) result.code = 'STALE_REVISION'
      else if (!action || typeof action !== 'object') result.code = 'INVALID_ACTION'
      else if (action.type === 'rematch') {
        if (game.status !== 'finished') result.code = 'GAME_NOT_FINISHED'
        else {
          member.ready = true
          result.ok = true
          if (room.members.every((m) => m.ready)) begin(room)
        }
      } else {
        let command
        if (action.type === 'place-stone' && action.position && Number.isInteger(action.position.row) && Number.isInteger(action.position.column)) {
          command = { type: action.type, actorId: member.id, position: { row: action.position.row, column: action.position.column } }
        } else if (action.type === 'use-skill' && Number.isSafeInteger(action.cardId)) {
          const point = action.position
          if (point === undefined || (point && Number.isInteger(point.row) && Number.isInteger(point.column))) {
            command = { type: action.type, actorId: member.id, cardId: action.cardId, targetId: room.members.find((m) => m !== member).id,
              position: point && { row: point.row, column: point.column } }
          }
        } else if (action.type === 'respond' && Number.isSafeInteger(action.attackId) &&
          (action.cardId === undefined || Number.isSafeInteger(action.cardId)) &&
          (action.discardCardId === undefined || Number.isSafeInteger(action.discardCardId))) {
          command = { type: action.type, actorId: member.id, attackId: action.attackId, cardId: action.cardId, discardCardId: action.discardCardId }
        } else if (action.type === 'choose-augment' && typeof action.augmentId === 'string' && Number.isSafeInteger(action.round)) {
          command = { type: action.type, actorId: member.id, augmentId: action.augmentId, round: action.round }
        }
        if (!command || (!room.skills && command.type !== 'place-stone')) result.code = 'INVALID_ACTION'
        else {
          const drawIndex = room.rules === 'skills' && command.type === 'place-stone' ? drawCard() : undefined
          const transition = room.skills ? applySkillCommand(room.skills, command, time, drawIndex) : applyCommand(room.game, command)
          if (!transition.ok) result.code = transition.reason
          else {
            if (room.skills) {
              room.skills = transition.events.length ? offerRoundAugments(transition.state) : transition.state
              scheduleDefense(room)
            }
            else room.game = transition.state
            room.revision++
            cues = actionSounds(command.type === 'place-stone' ? 'place'
              : command.type === 'use-skill' || (command.type === 'respond' && command.cardId !== undefined) ? 'skill' : null)
            result.ok = true
          }
        }
      }
      result.revision = room.revision
      member.results.set(msg.requestId, { fingerprint, result })
      send(ws, result)
      broadcast(room)
      broadcastSounds(room, cues)
    })
    ws.on('close', () => {
      if (!member || member.ws !== ws || !rooms.has(room.id)) return
      member.ws = null
      broadcast(room)
      // Room retention is separate from the pending defense timer.
      if (room.members.every((m) => !m.ws)) {
        clearTimeout(room.expiry)
        room.expiry = setTimeout(() => destroy(room), graceMs)
        room.expiry.unref()
      }
    })
  })
  const heartbeat = setInterval(() => {
    for (const ws of wss.clients) {
      if (!ws.alive) ws.terminate()
      else { ws.alive = false; ws.ping() }
    }
  }, 15_000)
  heartbeat.unref()
  http.listen(port, host)
  return { http, wss, async close() {
    clearInterval(heartbeat)
    for (const room of rooms.values()) destroy(room)
    for (const ws of wss.clients) ws.terminate()
    await new Promise((done) => wss.close(done))
    await new Promise((done) => http.close(done))
  } }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const origins = [...(process.env.ALLOWED_ORIGINS ?? '').split(','), process.env.RENDER_EXTERNAL_URL].filter(Boolean)
  const server = createOnlineServer({ port: Number(process.env.PORT ?? 8787), host: process.env.HOST ?? '127.0.0.1', origins })
  server.http.on('listening', () => console.log(`Gomoku HTTP/WebSocket server listening on ${server.http.address().port}`))
  process.once('SIGINT', () => void server.close())
  process.once('SIGTERM', () => void server.close())
}
