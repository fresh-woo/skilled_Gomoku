import { useState } from 'react'
import { Button } from '../../design-system/Button'
import { Modal } from '../../design-system/Modal'
import { SkillCardFace } from '../../design-system/SkillCardPicker'
import type { IllustratedSkill } from '../../design-system/SkillCardPicker'
import type { StoneColor } from '../../design-system/board-model'
import { deferredSkillCards, skillCards } from './cards'
import './skill-catalog.css'

const categories = ['공격', '방어'] as const

export function SkillCatalogButton() {
  const [isOpen, setIsOpen] = useState(false)
  const [kind, setKind] = useState<IllustratedSkill['kind']>('공격')
  const [side, setSide] = useState<StoneColor>('black')
  const cards = skillCards.filter((card) => card.kind === kind)

  return (
    <>
      <Button variant="secondary" onClick={() => setIsOpen(true)}>카드 도감 · {skillCards.length}종</Button>
      {isOpen && (
        <Modal title="스킬카드 도감" description="카드에 마우스를 올리거나 i 버튼을 눌러 효과를 확인하세요."
          onDismiss={() => setIsOpen(false)}>
          <div className="skill-catalog__filters">
            <div role="group" aria-label="카드 종류">
              {categories.map((category) => (
                <Button key={category} variant="secondary" aria-pressed={kind === category} onClick={() => setKind(category)}>{category}</Button>
              ))}
            </div>
            <div role="group" aria-label="카드 프레임">
              <Button variant="secondary" aria-pressed={side === 'black'} onClick={() => setSide('black')}>흑돌</Button>
              <Button variant="secondary" aria-pressed={side === 'white'} onClick={() => setSide('white')}>백돌</Button>
            </div>
          </div>
          <p className="skill-catalog__total" role="status">적용 {skillCards.length}종 중 {kind} {cards.length}종 · {side === 'black' ? '흑돌' : '백돌'} 플레이어</p>
          <ul className="skill-card-catalog skill-card-picker__grid" data-side={side}>
            {cards.map((card) => (
              <li key={card.id}><SkillCardFace card={card} side={side} /></li>
            ))}
          </ul>
          <details className="skill-catalog__deferred">
            <summary>보류한 카드</summary>
            <p>PDF의 나머지 {deferredSkillCards.length}종은 미구현으로 보류합니다. 대국에서 지급하지 않습니다.</p>
            <p>{deferredSkillCards.map(([, , title]) => title).join(' · ')}</p>
            <p>무장해제 무효화·손패 복구는 PDF에 없어 지급과 사용을 보류합니다. PDF의 복구는 돌을 되살리는 카드로, 손패 복구와 다릅니다.</p>
          </details>
        </Modal>
      )}
    </>
  )
}
