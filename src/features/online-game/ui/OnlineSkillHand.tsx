import { useEffect, useId, useRef, useState } from 'react'
import { Button } from '../../../design-system/Button'
import { Stone } from '../../../design-system/GomokuBoard'
import { SkillCardPicker } from '../../../design-system/SkillCardPicker'
import type { SkillCardOption } from '../../../design-system/SkillCardPicker'
import type { StoneColor } from '../../../design-system/board-model'
import type { SkillView } from '../../../entities/game/model/skillGameView'
import { skillCards } from '../../skill-catalog/cards'
import blackArt from '../../local-game/assets/skills-black.jpg'
import whiteArt from '../../local-game/assets/skills-white.jpg'

type Card = SkillView['hands'][string][number]
type Phase = NonNullable<SkillView['response']>['phase']
export type SelectedStoneSkill = { kind: 'snipe' | 'shield'; cardId: number }
type HandAction = { type: 'card'; cardId: number } | { type: 'pass' }

const blockedText: Partial<Record<NonNullable<SkillView['cardBlocks'][number]>, string>> = {
  'not-active-player': '내 턴에 사용할 수 있어요.',
  'response-pending': '상대의 방어 응답을 기다리고 있어요.',
  'response-expired': '방어 응답 시간이 지났어요.',
  'augment-pending': '증강 선택이 끝나면 사용할 수 있어요.',
  'invalid-skill-timing': '현재 시점에는 이 카드를 사용할 수 없어요.',
  'skill-used-this-turn': '이번 턴에 이미 사용했어요.',
  'no-skill-target': '판에 선택할 수 있는 대상 돌이 없어요.',
}

function cardOption({ id, skill }: Card, artSrc: string): Omit<SkillCardOption, 'count'> {
  switch (skill.kind) {
    case 'discard':
      return {
        id: String(id),
        title: '무장해제',
        timing: '적용 전 응답',
        kind: '공격',
        art: { src: artSrc, position: 'left' },
        description: '상대 손패에서 무작위로 카드 1장을 버리게 해요.',
      }
    case 'snipe':
    case 'shield':
    case 'nullify': {
      const definition = skillCards.find((entry) => entry.id === skill.kind)!
      return { ...definition, id: String(id) }
    }
    default:
      return { id: String(id), title: '예약 효과', kind: '특수', description: '이 대국의 테스트 덱에서는 사용하지 않아요.', unavailable: '사용 불가' }
  }
}

function PlayableSkillCards({ hand, side, phase, cardBlocks, uiBlock, onAction, onTarget }: {
  hand: readonly Card[]
  side: StoneColor
  phase?: Phase
  cardBlocks: SkillView['cardBlocks']
  uiBlock?: string
  onAction: (action: HandAction) => void
  onTarget: (target: SelectedStoneSkill) => void
}) {
  const name = useId()
  const [choice, setChoice] = useState('')
  const artSrc = side === 'black' ? blackArt : whiteArt
  const groups = new Map<string, SkillCardOption>()
  for (const card of hand) {
    const key = card.skill.kind
    const group = groups.get(key)
    if (group) group.count += 1
    else {
      const option = cardOption(card, artSrc)
      const reason = cardBlocks[card.id]
      option.unavailable = uiBlock ?? (reason ? blockedText[reason] ?? '지금은 사용할 수 없어요.' : undefined)
      groups.set(key, { ...option, count: 1 })
    }
  }
  const options = [...groups.values()]
  const selected = options.find((option) => option.id === choice && !option.unavailable)
  const selectedKind = hand.find(({ id }) => String(id) === selected?.id)?.skill.kind

  function act(action: HandAction) {
    setChoice('')
    onAction(action)
  }

  function playSelectedCard(cardId: number) {
    if (selectedKind === 'snipe' || selectedKind === 'shield') {
      onTarget({ kind: selectedKind, cardId })
    } else {
      act({ type: 'card', cardId })
    }
  }

  return (
    <>
      <div className="local-game__card-list">
        {hand.length > 0
          ? <SkillCardPicker name={name} side={side} cards={options} selected={selected?.id ?? ''} onSelect={setChoice} />
          : <p>손패에 카드가 없어요.</p>}
      </div>
      <div className="local-game__actions">
        <Button disabled={!selected} onClick={() => { if (selected) playSelectedCard(Number(selected.id)) }}>
          {selectedKind === 'snipe' || selectedKind === 'shield' ? '판에서 대상 선택' : '선택한 카드 사용'}
        </Button>
        {phase && <Button variant="secondary" onClick={() => act({ type: 'pass' })}>방어하지 않기</Button>}
      </div>
    </>
  )
}

export function OnlineSkillHand({ state, playerId, side, uiBlock, onAction, onTarget }: {
  state: SkillView
  playerId: string
  side: StoneColor
  uiBlock?: string
  onAction: (action: HandAction) => void
  onTarget: (target: SelectedStoneSkill) => void
}) {
  const name = useId()
  const heading = useRef<HTMLHeadingElement>(null)
  const { game, response } = state
  const active = game.status === 'playing' && playerId === (response?.targetId ?? game.players[game.turn.activeSeat].id)
  const attackId = active ? response?.id : undefined
  const hand = state.hands[playerId]
  const label = side === 'black' ? '흑돌' : '백돌'

  useEffect(() => {
    if (attackId !== undefined) heading.current?.focus({ preventScroll: true })
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
      {game.status === 'playing' && (
        <PlayableSkillCards key={active ? response?.id ?? 'turn' : 'waiting'} hand={hand} side={side} phase={active ? response?.phase : undefined}
          cardBlocks={state.cardBlocks} uiBlock={uiBlock} onTarget={onTarget}
          onAction={(action) => { heading.current?.focus({ preventScroll: true }); onAction(action) }} />
      )}
    </section>
  )
}
