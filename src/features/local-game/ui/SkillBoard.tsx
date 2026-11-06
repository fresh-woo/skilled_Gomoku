import { useEffect, useRef, useState } from 'react'
import { Button } from '../../../design-system/Button'
import { GameNotice } from '../../../design-system/GameControls'
import { GomokuBoard } from '../../../design-system/GomokuBoard'
import { boardCoordinate } from '../../../design-system/board-model'
import type { BoardCell, StoneColor } from '../../../design-system/board-model'
import type { GameState, PlayerId, Position } from '../../../entities/game/model/game'
import { canTargetStone } from '../../../entities/game/model/skillGame'
import type { SkillView } from '../../../entities/game/model/skillGameView'
import type { SelectedStoneSkill } from './LocalSkillHand'

const snipeMessages = {
  destroyed: '저격으로 돌이 파괴됐어요.',
  shielded: '보호막이 저격을 막고 사라졌어요.',
  nullified: '무효화로 저격을 막았어요.',
}

export function SnipeNotice({ position, deadline }: { position: Position; deadline: number }) {
  const [now, setNow] = useState(() => performance.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(performance.now()), 200)
    return () => clearInterval(timer)
  }, [])

  const remaining = Math.max(0, Math.ceil((deadline - now) / 1_000))
  return <>
    <GameNotice>{boardCoordinate(position)} 돌이 저격 대상이에요. 방어자는 무효화하거나 건너뛸 수 있어요.</GameNotice>
    <p role="timer">남은 시간 {remaining}초</p>
  </>
}

export function SnipeOutcome({ outcome }: { outcome: NonNullable<SkillView['snipeOutcome']> }) {
  return <GameNotice>{snipeMessages[outcome]}</GameNotice>
}

export function SkillBoard({ game, skills, target, canAct, color, onSelect, onCancel }: {
  game: GameState
  skills?: SkillView | null
  target?: SelectedStoneSkill | null
  canAct: boolean
  color: (id: PlayerId) => StoneColor
  onSelect: (position: Position) => void
  onCancel: () => void
}) {
  const board = useRef<HTMLDivElement>(null)
  const cells: Partial<Record<string, BoardCell>> = {}
  const shields = new Set(skills?.shields.map(({ position }) => boardCoordinate(position)))
  const response = skills?.response
  const selected = response?.phase === 'snipe' ? response.position : undefined
  game.board.cells.forEach((line, row) => line.forEach((stone, column) => {
    if (!stone) return
    const key = boardCoordinate({ row, column })
    cells[key] = {
      stone: color(stone.ownerId),
      ...(shields.has(key) ? { marker: { label: '보호막', symbol: '보호' } } : {}),
    }
  }))

  useEffect(() => {
    if (target) board.current?.querySelector<HTMLButtonElement>('[data-point]:not([aria-disabled="true"])')?.focus()
  }, [target])

  function isSelectable(position: Position) {
    if (!canAct || response || game.status !== 'playing') return false
    if (target && skills) {
      const actorId = game.players[game.turn.activeSeat].id
      if (target.kind === 'shield' && shields.has(boardCoordinate(position))) return false
      return canTargetStone(skills, actorId, target.kind, position)
    }
    return game.board.cells[position.row][position.column] === null
  }

  return <div ref={board}>
    {target && <div className="local-game__actions">
      <GameNotice>{target.kind === 'snipe' ? '판에서 저격할 상대 돌을 선택하세요.' : '판에서 보호막을 부여할 내 돌을 선택하세요.'}</GameNotice>
      <Button variant="secondary" onClick={onCancel}>대상 선택 취소</Button>
    </div>}
    <GomokuBoard cells={cells} size={game.board.size} selected={selected} isSelectable={isSelectable} onSelect={onSelect} />
  </div>
}
