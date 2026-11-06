import { useEffect, useId, useRef, useState } from 'react'
import { Button } from '../../../design-system/Button'
import { GameChoices } from '../../../design-system/GameControls'
import { AUGMENTS } from '../../../entities/game/model/augments'
import type { AugmentId } from '../../../entities/game/model/augments'

export function AugmentChoice({ choices, disabled, onChoose }: {
  choices: readonly AugmentId[]
  disabled: boolean
  onChoose: (choice: AugmentId) => void
}) {
  const heading = useRef<HTMLHeadingElement>(null)
  const headingId = useId()
  const [selected, setSelected] = useState('')
  const choice = choices.find((id) => id === selected)

  useEffect(() => { heading.current?.focus() }, [])

  return <section aria-labelledby={headingId}>
    <h3 id={headingId} tabIndex={-1} ref={heading}>증강 선택</h3>
    <GameChoices name={headingId} legend="증강 하나를 고르세요"
      options={choices.map((id) => ({ id, ...AUGMENTS[id] }))} value={selected} onChange={setSelected} />
    <Button disabled={disabled || !choice} onClick={() => { if (choice) onChoose(choice) }}>증강 확정</Button>
  </section>
}
