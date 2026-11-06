import { useEffect, useId, useRef, useState } from 'react'
import { Button } from '../../../design-system/Button'
import { GameChoices } from '../../../design-system/GameControls'
import type { SkillGame } from '../../../entities/game/model/skillGame'
import type { LocalSkillAction } from '../model/localGame'

type Card = SkillGame['hands'][string][number]

function cardOption({ id, skill }: Card, phase: 'before' | 'after' | undefined) {
  switch (skill.kind) {
    case 'discard':
      return {
        id: String(id),
        title: skill.response === 'before' ? '무장해제 · 적용 전 응답' : '무장해제 · 적용 후 응답',
        description: '상대 손패에서 무작위로 카드 1장을 버리게 해요.',
        unavailable: phase ? '방어 응답 중에는 사용할 수 없어요.' : undefined,
      }
    case 'cancel':
      return {
        id: String(id),
        title: '무효화',
        description: '상대의 무장해제가 적용되기 전에 막아요.',
        unavailable: phase !== 'before' ? '공격 적용 전에 사용할 수 있어요.' : undefined,
      }
    case 'recover':
      return {
        id: String(id),
        title: '손패 복구',
        description: '방금 버려진 카드를 손패로 돌려받아요.',
        unavailable: phase !== 'after' ? '공격 적용 후에 사용할 수 있어요.' : undefined,
      }
    default:
      return { id: String(id), title: '예약 효과', description: '이 대국의 테스트 덱에서는 사용하지 않아요.', unavailable: '사용 불가' }
  }
}

export function LocalSkillHand({ state, playerLabel, onAction }: {
  state: SkillGame
  playerLabel: (playerId: string) => string
  onAction: (action: LocalSkillAction) => void
}) {
  const name = useId()
  const heading = useRef<HTMLHeadingElement>(null)
  const [choice, setChoice] = useState('')
  const { game, response } = state
  const attackId = response?.id

  useEffect(() => {
    if (attackId !== undefined) heading.current?.focus()
  }, [attackId])

  if (game.status === 'finished') return null

  const playerId = response?.targetId ?? game.players[game.turn.activeSeat].id
  const hand = state.hands[playerId]
  const groups = new Map<string, { option: ReturnType<typeof cardOption>; count: number }>()
  for (const card of hand) {
    const key = card.skill.kind === 'discard' ? `discard-${card.skill.response}` : card.skill.kind
    const group = groups.get(key)
    if (group) group.count += 1
    else groups.set(key, { option: cardOption(card, response?.phase), count: 1 })
  }
  const options = [...groups.values()].map(({ option, count }) => ({ ...option, label: `${count}장` }))
  const selected = options.find((option) => option.id === choice && !option.unavailable)

  function act(action: LocalSkillAction) {
    heading.current?.focus()
    setChoice('')
    onAction(action)
  }

  return (
    <section className="local-game__skills" aria-labelledby={name}>
      <h3 id={name} ref={heading} tabIndex={-1}>
        {playerLabel(playerId)} {response ? '방어 응답' : '손패'} · {hand.length}장
      </h3>
      {hand.length > 0
        ? <GameChoices name={name} legend="카드 선택" options={options} value={selected?.id ?? ''} onChange={setChoice} />
        : <p>손패에 카드가 없어요.</p>}
      <div className="local-game__actions">
        {selected && <Button onClick={() => act({ type: 'card', cardId: Number(selected.id) })}>선택한 카드 사용</Button>}
        {response && <Button variant="secondary" onClick={() => act({ type: 'pass' })}>방어하지 않기</Button>}
      </div>
    </section>
  )
}
