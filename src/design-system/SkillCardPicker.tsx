import type { ReactNode } from 'react'
import type { StoneColor } from './board-model'
import './SkillCardPicker.css'

export type IllustratedSkill = {
  id: string
  title: string
  description: string
  kind: '공격' | '방어' | '특수'
  timing?: string
  count?: number
  unavailable?: string
  art?: { src: string; position: 'left' | 'center' | 'right'; row?: 'top' | 'center' | 'bottom' }
}

export type SkillCardOption = IllustratedSkill & { count: number }

// Inset atlas crops slightly so the neighboring tile's edges don't show.
const atlasColumns = { left: '3.33%', center: '50%', right: '96.67%' }
const atlasRows = { top: '3.33%', center: '50%', bottom: '96.67%' }

export function SkillCardFace({ card, side, id, control }: {
  card: IllustratedSkill
  side: StoneColor
  id?: string
  control?: ReactNode
}) {
  return (
    <>
      <span className="play-skill-card__top">
        <span className="play-skill-card__owner">{side === 'black' ? '흑돌' : '백돌'} <span aria-hidden="true">·</span> {card.kind}</span>
        {card.count !== undefined && <span className="play-skill-card__count">{card.count}장</span>}
      </span>
      <span className="play-skill-card__title">
        <span id={id && `${id}-title`}>
          <strong>{card.title}</strong>
          {card.timing && <small>{card.timing}</small>}
        </span>
        {control}
      </span>
      {card.art && (
        <span className="play-skill-card__art" aria-hidden="true" style={{
          backgroundImage: `url("${card.art.src}")`,
          backgroundPosition: card.art.row ? `${atlasColumns[card.art.position]} ${atlasRows[card.art.row]}` : `${card.art.position} center`,
          backgroundSize: card.art.row ? '350% 350%' : undefined,
        }} />
      )}
      <span className="play-skill-card__copy" id={id && `${id}-description`}>
        <span>{card.description}</span>
        {card.unavailable && <small>{card.unavailable}</small>}
      </span>
    </>
  )
}

export function SkillCardPicker({ name, side, cards, selected, onSelect }: {
  name: string
  side: StoneColor
  cards: readonly SkillCardOption[]
  selected: string
  onSelect: (id: string) => void
}) {
  return (
    <fieldset className="skill-card-picker" data-side={side}>
      <legend>사용할 카드 선택</legend>
      <div className="skill-card-picker__grid">
        {cards.map((card) => {
          const id = `${name}-${card.id}`

          return (
            <label className="play-skill-card" key={card.id}>
              <SkillCardFace card={card} side={side} id={id} control={
                <input
                  type="radio"
                  name={name}
                  value={card.id}
                  checked={selected === card.id}
                  disabled={Boolean(card.unavailable)}
                  aria-labelledby={`${id}-title`}
                  aria-describedby={`${id}-description`}
                  onChange={() => onSelect(card.id)}
                />
              } />
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}
