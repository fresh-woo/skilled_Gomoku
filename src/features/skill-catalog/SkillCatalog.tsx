import { useState } from 'react'
import { Button } from '../../design-system/Button'
import { Modal } from '../../design-system/Modal'
import { SkillCardFace } from '../../design-system/SkillCardPicker'
import type { IllustratedSkill } from '../../design-system/SkillCardPicker'
import type { StoneColor } from '../../design-system/board-model'
import { skillCards } from './cards'
import './skill-catalog.css'

const categories = ['공격', '방어', '특수'] as const

export function SkillCatalogButton() {
  const [isOpen, setIsOpen] = useState(false)
  const [kind, setKind] = useState<IllustratedSkill['kind']>('공격')
  const [side, setSide] = useState<StoneColor>('black')
  const cards = skillCards.filter((card) => card.kind === kind)

  return (
    <>
      <Button variant="secondary" onClick={() => setIsOpen(true)}>카드 도감 · {skillCards.length}장</Button>
      {isOpen && (
        <Modal title="스킬카드 도감" description="카드별 효과와 흑·백 프레임을 확인하세요."
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
          <p className="skill-catalog__total" role="status">{kind} 카드 {cards.length}장</p>
          <ul className="skill-card-catalog skill-card-picker__grid" data-side={side}>
            {cards.map((card) => (
              <li className="play-skill-card" key={card.id}><SkillCardFace card={card} side={side} /></li>
            ))}
          </ul>
        </Modal>
      )}
    </>
  )
}
