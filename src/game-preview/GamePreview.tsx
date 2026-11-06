import { useRef, useState } from 'react'
import { Button } from '../design-system/Button'
import { GameChoiceModal, GameNotice, PlayerStatus, SkillHand } from '../design-system/GameControls'
import { GomokuBoard } from '../design-system/GomokuBoard'
import { boardCoordinate } from '../design-system/board-model'
import type { BoardCell, BoardPoint, StoneColor } from '../design-system/board-model'
import { Modal } from '../design-system/Modal'
import { SkillEnginePreview } from './SkillEnginePreview'
import { augments, exampleBoard, exampleHand, modes, skillCards } from './examples'
import './game-preview.css'

type Dialog = 'setup' | 'augment' | 'defense' | 'result' | 'rules' | 'room'
type Connection = 'idle' | 'waiting' | 'reconnecting' | 'offline'

const connectionText: Record<Connection, string> = {
  idle: '온라인 방 연결 전',
  waiting: '상대 참가를 기다리는 중',
  reconnecting: '연결이 끊겨 다시 연결하는 중',
  offline: '다시 연결할 수 없어요. 연결 상태를 확인하고 다시 시도해 주세요.',
}

export function GamePreview() {
  const [mode, setMode] = useState('5')
  const [cells, setCells] = useState<Record<string, BoardCell>>(exampleBoard)
  const [turn, setTurn] = useState<StoneColor>('black')
  const [placed, setPlaced] = useState(0)
  const [selection, setSelection] = useState<BoardPoint>()
  const [hand, setHand] = useState(exampleHand)
  const [augment, setAugment] = useState('')
  const [dialog, setDialog] = useState<Dialog>()
  const [choice, setChoice] = useState('')
  const [inspectedCard, setInspectedCard] = useState<string>()
  const [targetCard, setTargetCard] = useState<string>()
  const [notice, setNotice] = useState('빈 교차점을 골라 다음 수를 미리 보세요.')
  const [connection, setConnection] = useState<Connection>('idle')
  const [roomCode, setRoomCode] = useState('')
  const [result, setResult] = useState<'win' | 'draw'>('win')
  const playArea = useRef<HTMLDivElement>(null)

  const card = hand.find((item) => item.id === inspectedCard)
  const target = hand.find((item) => item.id === targetCard)
  const selectedCoordinate = selection ? boardCoordinate(selection) : undefined
  const turnLabel = turn === 'black' ? '흑' : '백'

  function openDialog(next: Dialog, initialChoice = '') {
    setChoice(initialChoice)
    setDialog(next)
  }

  function canSelect(point: BoardPoint) {
    const cell = cells[boardCoordinate(point)]
    if (targetCard === 'snipe') return Boolean(cell?.stone && cell.stone !== turn)
    if (targetCard === 'shield') return cell?.stone === turn
    return !cell?.stone && !cell?.marker
  }

  function confirmPoint() {
    if (!selection || !selectedCoordinate || !canSelect(selection)) return

    if (target) {
      setNotice(`${target.title} · ${selectedCoordinate} 대상 선택을 확인했어요. 카드 효과는 예시에 적용하지 않아요.`)
      setTargetCard(undefined)
    } else {
      setCells(Object.fromEntries([
        ...Object.entries(cells).map(([key, cell]) => [key, { ...cell, last: false }]),
        [selectedCoordinate, { stone: turn, last: true }],
      ]))
      setTurn(turn === 'black' ? 'white' : 'black')
      setPlaced(placed + 1)
      setNotice(`${selectedCoordinate}에 ${turnLabel}돌을 표시했어요.`)
    }
    setSelection(undefined)
  }

  function resetBoard(nextMode = mode) {
    setMode(nextMode)
    setCells(exampleBoard)
    setTurn('black')
    setPlaced(0)
    setSelection(undefined)
    setTargetCard(undefined)
    setHand(exampleHand)
    setAugment('')
    setNotice('예시 대국을 초기화했어요. 빈 교차점을 선택하세요.')
    setDialog(undefined)
  }

  return (
    <section className="match-preview" id="game-preview" aria-labelledby="match-title" tabIndex={-1}>
      <header className="match-preview__heading">
        <div>
          <h2 id="match-title">대국 미리보기</h2>
          <p>착수와 카드 선택, 대국 중 만나는 화면을 예시로 살펴보세요.</p>
        </div>
        <Button variant="secondary" onClick={() => openDialog('setup', mode)}>대국 설정</Button>
      </header>
      <div className="match-preview__layout">
        <div className="match-preview__play" ref={playArea}>
          <div className="match-preview__turn">
            <h3>오목판</h3>
            <span className="game-tag">{mode}목 모드 · 2인 · 15×15</span>
          </div>
          <div className="match-preview__players">
            <PlayerStatus name="흑" stone="black" active={turn === 'black'} goal={Number(mode)} />
            <PlayerStatus name="백" stone="white" active={turn === 'white'} goal={Number(mode)} />
          </div>
          <GomokuBoard cells={cells} selected={selection} isSelectable={canSelect} onSelect={setSelection} />
          <div className="match-preview__placement">
            <div aria-live="polite">
              <strong>{target ? `${target.title} 대상 선택` : `${turnLabel} 차례`}</strong>
              <small>{selectedCoordinate ? `${selectedCoordinate} 선택됨` : '선택된 교차점 없음'}</small>
            </div>
            <div className="match-preview__actions">
              {(target || selection) && <Button variant="secondary" onClick={() => { setTargetCard(undefined); setSelection(undefined) }}>취소</Button>}
              <Button disabled={!selection} onClick={confirmPoint}>{target ? '대상 확인' : '착수 확인'}</Button>
            </div>
          </div>
          <p className="match-preview__legend">가운데 점은 마지막 수, ‘잠’은 잠금, ‘보’는 보호막 표시예요.</p>
        </div>
        <aside className="match-preview__sidebar" aria-label="대국 정보">
          {import.meta.env.DEV && <SkillEnginePreview />}
          <div className="match-preview__panel">
            <div className="match-preview__turn"><h3>스킬카드</h3><span className="game-tag">{hand.length}장 · 예시</span></div>
            <p>카드를 열어 효과와 사용 조건을 확인하세요.</p>
            <SkillHand cards={hand} onInspect={setInspectedCard} />
            <Button variant="secondary" onClick={() => {
              setHand(hand.length ? [] : exampleHand)
              setTargetCard(undefined)
              setSelection(undefined)
            }}>{hand.length ? '빈 손패 보기' : '예시 손패 보기'}</Button>
          </div>
          <div className="match-preview__panel">
            <h3>대국 상황</h3>
            <dl className="match-preview__facts">
              <div><dt>라운드</dt><dd>{Math.floor(placed / 2) + 1}라운드</dd></div>
              <div><dt>증강</dt><dd>{augments.find((option) => option.id === augment)?.title ?? '선택 전'}</dd></div>
              <div><dt>조우자</dt><dd>특수 규칙 미정</dd></div>
            </dl>
            <GameNotice>{notice}</GameNotice>
          </div>
          <div className="match-preview__panel">
            <h3>상황별 UI</h3>
            <p>각 버튼으로 대국 중 표시될 화면을 확인할 수 있어요.</p>
            <div className="match-preview__actions">
              <Button variant="secondary" onClick={() => openDialog('augment')}>증강 선택</Button>
              <Button variant="secondary" onClick={() => openDialog('defense')}>방어 응답</Button>
              <Button variant="secondary" onClick={() => { setResult('win'); openDialog('result') }}>대국 결과</Button>
              <Button variant="secondary" onClick={() => openDialog('room')}>온라인 방</Button>
              <Button variant="secondary" onClick={() => openDialog('rules')}>룰북</Button>
            </div>
          </div>
        </aside>
      </div>

      {dialog === 'setup' && <GameChoiceModal title="대국 설정" description="예시 대국에 적용할 기본 승리 조건을 고르세요." legend="대국 모드"
        options={modes} value={choice} onChange={setChoice} onDismiss={() => setDialog(undefined)} confirmLabel="예시 대국 시작" onConfirm={() => resetBoard(choice)} />}
      {dialog === 'augment' && <GameChoiceModal title="증강 선택" description="제시된 세 가지 증강 중 하나를 고르는 예시입니다." legend="증강 후보"
        options={augments.slice(0, 3)} value={choice} onChange={setChoice} onDismiss={() => setDialog(undefined)} confirmLabel="증강 선택 완료"
        onConfirm={() => { setAugment(choice); setDialog(undefined); setNotice('증강을 선택했어요. 효과 적용 전의 표시 예시입니다.') }} />}
      {dialog === 'defense' && <GameChoiceModal title="방어 응답" description="상대의 저격이 H8을 대상으로 지정한 예시입니다. 실제 응답 시점과 제한 시간은 기획 중입니다." legend="방어 카드"
        options={[
          skillCards.find((item) => item.id === 'delay')!,
          { ...skillCards.find((item) => item.id === 'restore')!, unavailable: '돌이 파괴된 직후에만 사용할 수 있어요.' },
        ]}
        value={choice} onChange={setChoice} onDismiss={() => setDialog(undefined)} confirmLabel="방어 선택 확인"
        alternate={<Button variant="secondary" onClick={() => { setDialog(undefined); setNotice('방어하지 않기를 선택했어요.') }}>방어하지 않기</Button>}
        onConfirm={() => { setDialog(undefined); setNotice('방어 선택을 확인했어요. 실제 공격은 적용하지 않아요.') }} />}
      {dialog === 'result' && <Modal title="대국 결과" description="승리와 무승부에 쓰이는 결과 화면 예시입니다." onDismiss={() => setDialog(undefined)}
        actions={<Button onClick={() => resetBoard()}>다시 미리보기</Button>}>
        <label className="match-field">결과 유형
          <select value={result} onChange={(event) => setResult(event.target.value === 'draw' ? 'draw' : 'win')}>
            <option value="win">흑 승리</option><option value="draw">무승부</option>
          </select>
        </label>
        <GameNotice><strong>{result === 'win' ? '흑 승리' : '무승부'}</strong><br />
          {result === 'win' ? `흑돌이 정확히 ${mode}개 연속으로 이어졌어요.` : '마지막 교차점까지 채웠지만 승자가 없어요.'}
        </GameNotice>
      </Modal>}
      {dialog === 'rules' && <Modal title="대국 룰북" description="게임 기획서에 기록된 기본 규칙과 카드·증강 초안입니다." onDismiss={() => setDialog(undefined)}>
        <ul className="match-rules">
          <li>기본 대국은 15×15 오목판의 2인 개인전입니다.</li>
          <li>5목·6목 모드에서는 해당 길이와 정확히 같은 연속 줄을 만들어야 승리합니다. 기본 금수는 없어요.</li>
          <li>자기 턴에 스킬을 사용한다면 착수 전에 사용합니다. 돌을 놓으면 기본 턴이 끝납니다.</li>
          <li>턴 시작마다 스킬카드 1장을 얻어요. 게임 시작 시 별도 지급은 없습니다.</li>
        </ul>
        <details><summary>스킬카드 {skillCards.length}종</summary>
          <dl className="match-catalog">{skillCards.map((item) => <div key={item.id}><dt>{item.title} <span className="game-tag" data-kind={item.kind}>{item.kind}</span></dt><dd>{item.description}</dd></div>)}</dl>
          <p>버프와 특수 카드의 개별 효과는 미정입니다.</p>
        </details>
        <details><summary>증강 {augments.length}종</summary>
          <dl className="match-catalog">{augments.map((item) => <div key={item.id}><dt>{item.title}</dt><dd>{item.description}</dd></div>)}</dl>
        </details>
        <details><summary>조우자</summary><p>게임 시작 시 정해지는 판별 특수 규칙입니다. 개별 효과는 미정입니다.</p></details>
      </Modal>}
      {dialog === 'room' && <Modal title="온라인 방" description="방 생성·참가·연결 상태의 화면 예시입니다. 코드 형식과 연결 방식은 미정입니다." onDismiss={() => setDialog(undefined)}>
        <label className="match-field">방 코드 <input value={roomCode} onChange={(event) => setRoomCode(event.target.value)} placeholder="예시 코드 입력" /></label>
        <div className="match-preview__actions">
          <Button variant="secondary" onClick={() => setConnection('waiting')}>방 만들기 예시</Button>
          <Button disabled={!roomCode.trim()} onClick={() => setConnection('waiting')}>방 참가 예시</Button>
        </div>
        <label className="match-field">연결 상태
          <select value={connection} onChange={(event) => setConnection(event.target.value as Connection)}>
            <option value="idle">연결 전</option><option value="waiting">상대 대기</option><option value="reconnecting">재연결 중</option><option value="offline">연결 실패</option>
          </select>
        </label>
        <GameNotice tone={connection === 'offline' ? 'error' : connection === 'reconnecting' ? 'warning' : 'info'} alert={connection === 'offline'}>{connectionText[connection]}</GameNotice>
        {connection === 'offline' && <Button variant="secondary" onClick={() => setConnection('reconnecting')}>다시 시도 예시</Button>}
      </Modal>}
      {card && <Modal title={card.title} description={`${card.kind} 스킬카드 · 효과 초안`} onDismiss={() => setInspectedCard(undefined)}
        actions={<Button onClick={() => {
          setInspectedCard(undefined)
          setSelection(undefined)
          setTargetCard(card.id)
          requestAnimationFrame(() => playArea.current?.querySelector<HTMLButtonElement>('[role="grid"] button[tabindex="0"]')?.focus())
        }}>판에서 대상 선택</Button>}>
        <p>{card.description}</p>
        <GameNotice tone="warning">대상 선택 화면의 예시입니다. 카드 사용 가능 여부와 효과는 실제 대국 상태가 결정합니다.</GameNotice>
      </Modal>}
    </section>
  )
}
