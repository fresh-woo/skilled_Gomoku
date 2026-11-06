import { useEffect, useRef, useState } from 'react'
import { Button } from '../../design-system/Button'
import { GameChoices, GameNotice } from '../../design-system/GameControls'
import { GomokuBoard } from '../../design-system/GomokuBoard'
import { boardCoordinate } from '../../design-system/board-model'
import type { BoardCell } from '../../design-system/board-model'
import { LocalSkillHand } from '../local-game/ui/LocalSkillHand'
import type { OnlineAction, Snapshot } from './protocol'

const storageKey = 'gomoku-online-session-v1'
// LAN HTTP does not expose crypto.randomUUID; IDs are correlation keys, not credentials.
const requestId = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}-${Math.random()}`
const errors: Record<string, string> = {
  ROOM_NOT_FOUND: '방을 찾을 수 없어요. 코드를 확인하세요.',
  ROOM_FULL: '이미 두 명이 참가한 방이에요.',
  SESSION_EXPIRED: '복구할 수 있는 대국이 없어요. 새 방에 참가하세요.',
  STALE_REVISION: '상태가 바뀌었어요. 갱신된 판을 확인하고 다시 선택하세요.',
  WRONG_GAME: '대국이 변경되었어요. 현재 판을 확인하세요.',
  SERVER_FULL: '서버가 혼잡해요. 잠시 후 다시 시도하세요.',
  'not-active-player': '지금은 상대 차례예요.',
  'response-pending': '방어 응답이 끝날 때까지 기다려 주세요.',
}
function storedToken() { try { return sessionStorage.getItem(storageKey) } catch { return null } }
function saveToken(token: string | null) {
  try { if (token) sessionStorage.setItem(storageKey, token); else sessionStorage.removeItem(storageKey) } catch { /* Memory reconnection still works. */ }
}
type Entry = { type: 'resume'; token: string } | { type: 'create'; mode: string; rules: string } | { type: 'join'; roomId: string }
type Pending = { v: 1; type: 'command'; requestId: string; gameId: string; revision: number; action: OnlineAction | { type: 'rematch' } }

export function OnlineGame() {
  const [entry, setEntry] = useState<Entry | null>(() => {
    const token = storedToken()
    return token ? { type: 'resume', token } : null
  })
  const [view, setView] = useState<Snapshot | null>(null)
  const [status, setStatus] = useState('방을 만들거나 공유받은 코드로 참가하세요.')
  const [connected, setConnected] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [mode, setMode] = useState('five-in-a-row')
  const [rules, setRules] = useState('basic')
  const [code, setCode] = useState('')
  const socket = useRef<WebSocket | null>(null)
  const pending = useRef<Pending | null>(null)

  useEffect(() => {
    if (!entry) return
    let stopped = false, token = entry.type === 'resume' ? entry.token : null, attempts = 0
    let timer: ReturnType<typeof setTimeout>
    let current: WebSocket
    function connect() {
      if (stopped) return
      setConnected(false)
      setStatus(attempts ? '다시 연결하는 중…' : '서버에 연결하는 중…')
      current = new WebSocket(`${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/online`)
      socket.current = current
      current.onopen = () => current.send(JSON.stringify({ v: 1, requestId: requestId(), ...(token ? { type: 'resume', token } : entry) }))
      current.onmessage = ({ data }) => {
        if (stopped) return
        const message = JSON.parse(data)
        if (message.type === 'session') { token = message.token; saveToken(token); attempts = 0 }
        if (message.type === 'snapshot') {
          setView(message)
          setConnected(true)
          setStatus('연결됨')
          if (pending.current) current.send(JSON.stringify(pending.current))
        }
        if (message.type === 'result' || message.type === 'error') {
          if (pending.current?.requestId === message.requestId) { pending.current = null; setBusy(false) }
          if (message.type === 'error' || !message.ok) setError(errors[message.code] ?? '행동을 처리하지 못했어요. 현재 차례와 카드 사용 조건을 확인하세요.')
          if (message.type === 'error' && !token) { stopped = true; current.close(); setEntry(null) }
          if (message.code === 'SESSION_EXPIRED') { stopped = true; saveToken(null); pending.current = null; setBusy(false); current.close(); setView(null); setEntry(null) }
        }
      }
      current.onclose = (event) => {
        if (stopped) return
        setConnected(false)
        if (event.code === 4001 || event.code === 4003) {
          stopped = true; saveToken(null); pending.current = null; setBusy(false); setEntry(null); setView(null)
          setError(event.code === 4001 ? '다른 연결에서 세션을 사용 중이에요.' : '방이 종료되었어요.')
        } else if (token) {
          attempts++
          setStatus('연결이 끊겼어요. 자동 재접속 중…')
          timer = setTimeout(connect, Math.min(5000, 300 * 2 ** Math.min(attempts, 5)) + Math.random() * 300)
        } else { setEntry(null); setError('서버에 연결할 수 없어요. 잠시 후 다시 시도하세요.') }
      }
      current.onerror = () => { /* close drives recovery */ }
    }
    connect()
    return () => { stopped = true; clearTimeout(timer); current?.close(); socket.current = null }
  }, [entry])

  function act(action: Pending['action']) {
    if (!view || !connected || pending.current || socket.current?.readyState !== WebSocket.OPEN) return
    const message: Pending = { v: 1, type: 'command', requestId: requestId(), gameId: view.gameId, revision: view.revision, action }
    pending.current = message; setBusy(true); setError('')
    socket.current.send(JSON.stringify(message))
  }
  function leave() {
    if (connected) socket.current?.send(JSON.stringify({ v: 1, type: 'leave', requestId: requestId() }))
    setEntry(null); setView(null); setConnected(false); saveToken(null); pending.current = null; setBusy(false)
    setStatus('방을 만들거나 공유받은 코드로 참가하세요.')
  }
  const game = view?.game
  const response = view?.skills?.response
  const myTurn = game?.status === 'playing' && game.players[game.turn.activeSeat].id === view?.playerId
  const canAct = connected && !busy && (response ? response.targetId === view?.playerId : myTurn)
  const cells: Partial<Record<string, BoardCell>> = {}
  game?.board.cells.forEach((line, row) => line.forEach((stone, column) => {
    if (stone) cells[boardCoordinate({ row, column })] = { stone: stone.ownerId === 'black' ? 'black' : 'white' }
  }))
  const label = (id: string) => id === 'black' ? '흑돌' : '백돌'

  return <section className="local-game" id="online-game" aria-labelledby="online-title">
    <div className="local-game__setup">
      <h2 id="online-title">온라인 2인 대국</h2>
      <p>같은 방 코드로 참가하면 두 사람이 각자의 화면에서 플레이해요.</p>
      {!entry && !view && <>
        <GameChoices name="online-mode" legend="온라인 승리 모드" value={mode} onChange={setMode} options={[
          { id: 'five-in-a-row', title: '5목', description: '정확히 5개' }, { id: 'six-in-a-row', title: '6목', description: '정확히 6개' },
        ]} />
        <GameChoices name="online-rules" legend="온라인 대국 규칙" value={rules} onChange={setRules} options={[
          { id: 'basic', title: '기본 대국', description: '돌을 번갈아 놓아요.' }, { id: 'skills', title: '스킬 대국 · 테스트', description: '기존 테스트 카드 규칙' },
        ]} />
        <Button onClick={() => { setError(''); setEntry({ type: 'create', mode, rules }) }}>온라인 방 만들기</Button>
        <form onSubmit={(e) => { e.preventDefault(); setError(''); setEntry({ type: 'join', roomId: code.trim() }) }}>
          <label>방 코드 <input value={code} onChange={(e) => setCode(e.target.value)} required maxLength={80} /></label>
          <Button type="submit" disabled={!code.trim()}>방 참가</Button>
        </form>
      </>}
      <GameNotice>{status}</GameNotice>
      {error && !view?.skills && <GameNotice tone="error" alert>{error}</GameNotice>}
      {view && <>
        <p>방 코드: <strong style={{ overflowWrap: 'anywhere' }}>{view.roomId}</strong></p>
        <p>나는 {label(view.playerId)} · {view.rules === 'skills' ? '스킬 테스트' : '기본 대국'} · {view.mode === 'six-in-a-row' ? '6목' : '5목'}</p>
        <p>{view.members.map((m) => `${label(m.id)} ${m.connected ? '접속' : '재접속 대기'}${m.ready ? ' · 재대국 준비' : ''}`).join(' / ')}</p>
        {!game && <p>두 번째 플레이어가 참가하면 대국이 시작됩니다.</p>}
        {game?.status === 'playing' && <GameNotice>{game.turn.round}라운드 · {response ? `${label(response.targetId)} 방어 응답 대기` : `${label(game.players[game.turn.activeSeat].id)} 차례`}</GameNotice>}
        {game?.status === 'finished' && <>
          <GameNotice>{game.result.kind === 'draw' ? '무승부' : `${label(game.result.winnerId)} 승리`}</GameNotice>
          <Button disabled={!connected || busy || view.members.find((m) => m.id === view.playerId)?.ready} onClick={() => act({ type: 'rematch' })}>재대국 준비</Button>
        </>}
      </>}
      {entry && <Button variant="secondary" onClick={leave}>방 나가기 · 대국 종료</Button>}
    </div>
    {game && <div className="local-game__table" data-skills={Boolean(view?.skills)}>
      <div className="local-game__board">
        <GomokuBoard cells={cells} size={game.board.size} isSelectable={({ row, column }) => !!canAct && !response && game.status === 'playing' && !game.board.cells[row][column]} onSelect={(position) => act({ type: 'place-stone', position })} />
      </div>
      {view?.skills && <div className="local-game__hands">
        {error && <GameNotice tone="error" alert>{error}</GameNotice>}
        <p>상대 손패 {Object.entries(view.handCounts).find(([id]) => id !== view.playerId)?.[1] ?? 0}장</p>
        <fieldset disabled={!canAct}>
          <LocalSkillHand state={view.skills} playerId={view.playerId} side={view.playerId === 'black' ? 'black' : 'white'} showWhenWaiting onAction={(action) => {
            if (response) act({ type: 'respond', attackId: response.id, ...(action.type === 'card' ? { cardId: action.cardId } : {}) })
            else if (action.type === 'card') act({ type: 'use-skill', cardId: action.cardId })
          }} />
        </fieldset>
      </div>}
    </div>}
  </section>
}
