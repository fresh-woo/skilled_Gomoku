import type { ReactNode } from 'react'
import { useId } from 'react'
import { Stone } from './GomokuBoard'
import type { StoneColor } from './board-model'
import { Button } from './Button'
import { Modal } from './Modal'
import './game-ui.css'

export type GameOption = { id: string; title: string; description: string; label?: string; unavailable?: string }

export function GameChoices({ name, legend, options, value, onChange }: {
  name: string
  legend: string
  options: readonly GameOption[]
  value: string
  onChange: (value: string) => void
}) {
  return (
    <fieldset className="game-choices">
      <legend>{legend}</legend>
      {options.map((option) => (
        <label className="game-choice" key={option.id}>
          <input type="radio" name={name} value={option.id} checked={value === option.id} disabled={Boolean(option.unavailable)} onChange={() => onChange(option.id)} />
          <span>
            <strong>{option.title}</strong>{option.label && <small className="game-choice__tag">{option.label}</small>}
            <span className="game-choice__description">{option.description}</span>
            {option.unavailable && <small>{option.unavailable}</small>}
          </span>
        </label>
      ))}
    </fieldset>
  )
}

export function PlayerStatus({ name, stone, active, goal, detail }: {
  name: string
  stone: StoneColor
  active?: boolean
  goal: number
  detail?: string
}) {
  return (
    <div className="player-status" data-active={active}>
      <Stone color={stone} />
      <div><strong>{name}</strong><small>정확히 {goal}목{detail && ` · ${detail}`}</small></div>
      {active && <span className="game-tag">현재 턴</span>}
    </div>
  )
}

export function GameNotice({ tone = 'info', alert = false, children }: {
  tone?: 'info' | 'warning' | 'error'
  alert?: boolean
  children: ReactNode
}) {
  return <div className={`game-notice game-notice--${tone}`} role={alert ? 'alert' : 'status'}>{children}</div>
}

export function GameChoiceModal({ title, description, legend, options, value, onChange, onConfirm, onDismiss, confirmLabel, alternate }: {
  title: string
  description?: string
  legend: string
  options: readonly GameOption[]
  value: string
  onChange: (value: string) => void
  onConfirm: () => void
  onDismiss: () => void
  confirmLabel: string
  alternate?: ReactNode
}) {
  const name = useId()
  const canConfirm = options.some((option) => option.id === value && !option.unavailable)

  return (
    <Modal title={title} description={description} onDismiss={onDismiss} actions={
      <>{alternate ?? <Button variant="secondary" onClick={onDismiss}>취소</Button>}
        <Button disabled={!canConfirm} onClick={onConfirm}>{confirmLabel}</Button></>
    }>
      <GameChoices name={name} legend={legend} options={options} value={value} onChange={onChange} />
    </Modal>
  )
}

export type SkillCardData = GameOption & { kind: '공격' | '방어' | '버프' | '특수' }

export function SkillHand({ cards, onInspect }: {
  cards: readonly SkillCardData[]
  onInspect: (id: string) => void
}) {
  if (!cards.length) return <p className="game-empty">보유한 스킬카드가 없어요.</p>

  return (
    <ul className="skill-hand">
      {cards.map((card) => (
        <li key={card.id}>
          <button className="skill-card" type="button" onClick={() => onInspect(card.id)}>
            <span className="game-tag" data-kind={card.kind}>{card.kind}</span>
            <strong>{card.title}</strong>
            {card.unavailable && <small>{card.unavailable}</small>}
          </button>
        </li>
      ))}
    </ul>
  )
}
