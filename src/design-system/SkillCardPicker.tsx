import { useId, useState } from 'react'
import type { ReactNode } from 'react'
import type { StoneColor } from './board-model'
import { SkillCardArt } from './SkillCardArt'
import type { SkillArtwork } from './SkillCardArt'
import './SkillCardPicker.css'

export type IllustratedSkill = {
  id: string
  title: string
  description: string
  kind: '공격' | '방어' | '특수'
  timing?: string
  count?: number
  unavailable?: string
  artwork?: SkillArtwork
}
export type SkillCardOption = IllustratedSkill & { count: number }

export function SkillCardFace({ card, side, id, control }: {
  card: IllustratedSkill; side: StoneColor; id?: string; control?: ReactNode
}) {
  const generatedId = useId()
  const descriptionId = `${id ?? generatedId}-description`
  const [open, setOpen] = useState(false)
  const Face = control ? 'label' : 'div'
  return <div className="play-skill-card" data-side={side} data-kind={card.kind} data-unavailable={Boolean(card.unavailable)} data-card-state={card.unavailable ? 'unavailable' : 'available'} tabIndex={0}
    aria-label={`${side === 'black' ? '흑돌' : '백돌'} ${card.title}${card.timing ? ` · ${card.timing}` : ''}`}
    onPointerEnter={(e) => { if (e.pointerType === 'mouse') setOpen(true) }}
    onPointerLeave={(e) => { if (!e.currentTarget.contains(document.activeElement)) setOpen(false) }}
    onFocus={(e) => { if (e.target === e.currentTarget || e.target instanceof HTMLInputElement) setOpen(true) }}
    onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false) }}
    onKeyDown={(e) => { if (e.key === 'Escape' && open) { e.stopPropagation(); setOpen(false) } }}>
    <Face className="play-skill-card__face">
      {control}
      <span className="play-skill-card__owner" aria-hidden="true"><i />{side === 'black' ? '흑' : '백'}</span>
      {card.count !== undefined && <span className="play-skill-card__count">×{card.count}</span>}
      {card.artwork && <SkillCardArt kind={card.artwork} side={side} />}
      <strong className="play-skill-card__title" id={id && `${id}-title`}>{card.title}</strong>
      <span className="play-skill-card__copy" id={descriptionId} hidden={!open}>
        <b>{card.kind}{card.timing ? ` · ${card.timing}` : ''}</b>
        <span>{card.description}</span>
        {(card.unavailable || control) && <small>{card.unavailable ?? '사용 가능'}</small>}
      </span>
    </Face>
    <button type="button" className="play-skill-card__info" aria-label={`${card.title} 설명`} aria-expanded={open} aria-controls={descriptionId}
      onClick={() => setOpen(!open)}>i</button>
  </div>
}

export function SkillCardPicker({ name, side, cards, selected, onSelect }: {
  name: string; side: StoneColor; cards: readonly SkillCardOption[]; selected: string; onSelect: (id: string) => void
}) {
  return <fieldset className="skill-card-picker" data-side={side}>
    <legend>사용할 카드 선택</legend>
    <div className="skill-card-picker__grid">
      {cards.map((card) => {
        const id = `${name}-${card.id}`
        return <SkillCardFace key={card.id} card={card} side={side} id={id} control={
          <input type="radio" name={name} value={card.id} checked={selected === card.id} disabled={Boolean(card.unavailable)}
            aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`} onChange={() => onSelect(card.id)} />
        } />
      })}
    </div>
  </fieldset>
}
