import { useEffect, useId, useRef, useState } from 'react'
import { Button } from '../../../design-system/Button'
import { Stone } from '../../../design-system/GomokuBoard'
import { SkillCardPicker } from '../../../design-system/SkillCardPicker'
import type { SkillCardOption } from '../../../design-system/SkillCardPicker'
import type { StoneColor } from '../../../design-system/board-model'
import type { SkillView } from '../../../entities/game/model/skillGameView'
import type { LocalSkillAction } from '../model/localGame'
import blackArt from '../assets/skills-black.jpg'
import whiteArt from '../assets/skills-white.jpg'

type Card = SkillView['hands'][string][number]

function cardOption({ id, skill }: Card, phase: 'before' | 'after' | undefined, artSrc: string): Omit<SkillCardOption, 'count'> {
  switch (skill.kind) {
    case 'discard':
      return {
        id: String(id),
        title: '무장해제',
        timing: skill.response === 'before' ? '적용 전 응답' : '적용 후 응답',
        kind: '공격',
        art: { src: artSrc, position: 'left' },
        description: '상대 손패에서 무작위로 카드 1장을 버리게 해요.',
        unavailable: phase ? '방어 응답 중에는 사용할 수 없어요.' : undefined,
      }
    case 'cancel':
      return {
        id: String(id),
        title: '무효화',
        kind: '방어',
        art: { src: artSrc, position: 'center' },
        description: '상대의 무장해제가 적용되기 전에 막아요.',
        unavailable: phase !== 'before' ? '공격 적용 전에 사용할 수 있어요.' : undefined,
      }
    case 'recover':
      return {
        id: String(id),
        title: '손패 복구',
        kind: '방어',
        art: { src: artSrc, position: 'right' },
        description: '방금 버려진 카드를 손패로 돌려받아요.',
        unavailable: phase !== 'after' ? '공격 적용 후에 사용할 수 있어요.' : undefined,
      }
    default:
      return { id: String(id), title: '예약 효과', kind: '특수', description: '이 대국의 테스트 덱에서는 사용하지 않아요.', unavailable: '사용 불가' }
  }
}

function PlayableSkillCards({ hand, side, phase, onAction }: {
  hand: readonly Card[]
  side: StoneColor
  phase?: 'before' | 'after'
  onAction: (action: LocalSkillAction) => void
}) {
  const name = useId()
  const [choice, setChoice] = useState('')
  const artSrc = side === 'black' ? blackArt : whiteArt
  const groups = new Map<string, SkillCardOption>()
  for (const card of hand) {
    const key = card.skill.kind === 'discard' ? `discard-${card.skill.response}` : card.skill.kind
    const group = groups.get(key)
    if (group) group.count += 1
    else groups.set(key, { ...cardOption(card, phase, artSrc), count: 1 })
  }
  const options = [...groups.values()]
  const selected = options.find((option) => option.id === choice && !option.unavailable)

  function act(action: LocalSkillAction) {
    setChoice('')
    onAction(action)
  }

  return (
    <>
      {hand.length > 0
        ? <SkillCardPicker name={name} side={side} cards={options} selected={selected?.id ?? ''} onSelect={setChoice} />
        : <p>손패에 카드가 없어요.</p>}
      {(selected || phase) && (
        <div className="local-game__actions">
          {selected && <Button onClick={() => act({ type: 'card', cardId: Number(selected.id) })}>선택한 카드 사용</Button>}
          {phase && <Button variant="secondary" onClick={() => act({ type: 'pass' })}>방어하지 않기</Button>}
        </div>
      )}
    </>
  )
}

export function LocalSkillHand({ state, playerId, side, showWhenWaiting = false, onAction }: {
  showWhenWaiting?: boolean
  state: SkillView
  playerId: string
  side: StoneColor
  onAction: (action: LocalSkillAction) => void
}) {
  const name = useId()
  const heading = useRef<HTMLHeadingElement>(null)
  const { game, response } = state
  const active = game.status === 'playing' && playerId === (response?.targetId ?? game.players[game.turn.activeSeat].id)
  const attackId = active ? response?.id : undefined
  const hand = state.hands[playerId]
  const label = side === 'black' ? '흑돌' : '백돌'

  useEffect(() => {
    if (attackId !== undefined) heading.current?.focus()
  }, [attackId])

  return (
    <section className="local-game__skills" data-side={side} data-active={active} aria-labelledby={name}>
      <div className="local-game__hand-header">
        <Stone color={side} />
        <h3 id={name} ref={heading} tabIndex={-1}>{label} 손패</h3>
        <span>{hand.length}장</span>
      </div>
      <p className="local-game__hand-status">
        {game.status === 'finished' ? '대국 종료' : active ? (response ? '방어 응답' : '현재 차례') : '대기 중'}
      </p>
      {game.status === 'playing' && (active || showWhenWaiting) ? (
        <PlayableSkillCards key={active ? response?.phase ?? 'turn' : 'waiting'} hand={hand} side={side} phase={active ? response?.phase : undefined}
          onAction={(action) => { heading.current?.focus(); onAction(action) }} />
      ) : (
        <div className="local-game__hidden-hand">
          {hand.length > 0 && <span className="local-game__card-back" aria-hidden="true"><Stone color={side} /></span>}
          <p>{hand.length ? '차례가 오면 카드가 열려요.' : '손패에 카드가 없어요.'}</p>
        </div>
      )}
    </section>
  )
}
