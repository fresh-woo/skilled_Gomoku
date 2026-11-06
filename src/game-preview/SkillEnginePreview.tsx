import { useRef, useState } from 'react'
import { Button } from '../design-system/Button'
import { GameNotice } from '../design-system/GameControls'
import { boardCoordinate } from '../design-system/board-model'
import { applySkillCommand } from '../entities/game/model/skillGame'
import type { SkillGame } from '../entities/game/model/skillGame'
import { attacker, createSkillDemo, defender, followUpMove } from './skill-engine-demo'

type Command = Parameters<typeof applySkillCommand>[1]
const cardNames: Record<SkillGame['drawPile'][number]['kind'], string> = {
  discard: '버리기',
  cancel: '무효화',
  recover: '복구',
  guard: '보호',
  delay: '지연',
}

export function SkillEnginePreview() {
  const [state, setState] = useState(createSkillDemo)
  const [outcome, setOutcome] = useState<'cancel' | 'pass'>()
  const [error, setError] = useState(false)
  const primaryButton = useRef<HTMLButtonElement>(null)
  const { game, response } = state
  const turn = game.status === 'playing' ? game.turn : undefined
  const activeId = turn && game.players[turn.activeSeat].id
  const complete = activeId === defender
  const attack = state.hands[attacker].find(({ skill }) => skill.kind === 'discard')
  const defense = state.hands[defender].find(({ skill }) => skill.kind === 'cancel')
  const coordinate = boardCoordinate(followUpMove)

  function send(command: Command) {
    const transition = applySkillCommand(state, command)
    setError(!transition.ok)
    if (transition.ok) setState(transition.state)
    return transition.ok
  }

  function respond(choice: 'cancel' | 'pass') {
    if (!response || (choice === 'cancel' && !defense)) return
    if (send({
      type: 'respond',
      actorId: defender,
      attackId: response.id,
      cardId: choice === 'cancel' ? defense?.id : undefined,
    })) {
      setOutcome(choice)
      primaryButton.current?.focus()
    }
  }

  function advance() {
    if (complete) {
      setState(createSkillDemo())
      setOutcome(undefined)
      setError(false)
    } else if (response) {
      respond('cancel')
    } else if (outcome) {
      send({ type: 'place-stone', actorId: attacker, position: followUpMove })
    } else if (attack) {
      send({ type: 'use-skill', actorId: attacker, cardId: attack.id, targetId: defender })
    }
  }

  const action = complete ? '다시 테스트' : response ? '무효화 사용' : outcome ? `${coordinate}에 흑돌 놓기` : '흑의 공격 실행'
  const result = outcome === 'cancel' ? '공격을 무효화했어요.' : '백의 카드 1장을 버렸어요.'
  const message = complete
    ? `${coordinate}에 흑돌을 놓았어요. 백의 턴이 시작됐어요.`
    : response ? '백의 방어 응답을 기다리고 있어요.'
      : outcome ? `${result} 흑이 이어서 착수할 수 있어요.`
        : '흑의 공격으로 백의 방어 응답을 열어보세요.'

  return (
    <section className="match-preview__panel" id="skill-engine-preview" aria-labelledby="skill-engine-title">
      <h3 id="skill-engine-title">카드 엔진 테스트</h3>
      <p>테스트 카드로 공격, 방어 선택, 이어지는 착수를 확인하세요.</p>
      <dl className="match-preview__facts">
        <div><dt>진행</dt><dd>{turn?.round}라운드 · {activeId === attacker ? '흑' : '백'} 차례</dd></div>
        <div><dt>백의 테스트 손패</dt><dd>{state.hands[defender].map(({ skill }) => cardNames[skill.kind]).join(', ') || '없음'}</dd></div>
      </dl>
      <GameNotice>{message}</GameNotice>
      {error && <GameNotice tone="error" alert>처리할 수 없는 행동이에요. 현재 턴과 응답 상태를 확인하세요.</GameNotice>}
      <div className="match-preview__actions">
        <Button ref={primaryButton} onClick={advance} disabled={Boolean(response && !defense)}>{action}</Button>
        {response && <Button variant="secondary" onClick={() => respond('pass')}>방어하지 않기</Button>}
      </div>
    </section>
  )
}
