import { useState } from 'react'
import { Button } from '../../../design-system/Button'
import { GameChoices, GameNotice } from '../../../design-system/GameControls'
import { GomokuBoard } from '../../../design-system/GomokuBoard'
import { boardCoordinate } from '../../../design-system/board-model'
import type { BoardCell, StoneColor } from '../../../design-system/board-model'
import { WIN_LENGTH } from '../../../entities/game/model/game'
import type { Board, GameMode, GameState, PlayerId, Position } from '../../../entities/game/model/game'
import type { SkillGame } from '../../../entities/game/model/skillGame'
import { applyLocalSkillAction, LOCAL_PLAYER_IDS, placeLocalStone, startLocalGame, startLocalSkillGame } from '../model/localGame'
import type { LocalSkillAction } from '../model/localGame'
import { LocalSkillHand } from './LocalSkillHand'
import { SkillCatalogButton } from '../../skill-catalog/SkillCatalog'
import './LocalGame.css'

const modeOptions = (Object.keys(WIN_LENGTH) as GameMode[]).map((mode) => ({
  id: mode,
  title: `${WIN_LENGTH[mode]}목`,
  description: `정확히 ${WIN_LENGTH[mode]}개 연속`,
}))
const ruleOptions = [
  { id: 'basic', title: '기본 대국', description: '돌을 번갈아 놓아요.' },
  { id: 'skills', title: '스킬 대국 · 테스트', description: '카드를 받고 착수 전에 사용해요.' },
]

type Match =
  | { kind: 'basic'; game: GameState }
  | { kind: 'skills'; state: SkillGame; feedback?: { text: string; error?: boolean } }

function stoneColor(playerId: PlayerId): StoneColor {
  return playerId === LOCAL_PLAYER_IDS[0] ? 'black' : 'white'
}

function stoneLabel(playerId: PlayerId) {
  return stoneColor(playerId) === 'black' ? '흑돌' : '백돌'
}

function boardCells(board: Board) {
  const cells: Partial<Record<string, BoardCell>> = {}
  board.cells.forEach((line, row) => {
    line.forEach((stone, column) => {
      if (stone) cells[boardCoordinate({ row, column })] = { stone: stoneColor(stone.ownerId) }
    })
  })
  return cells
}

function gameStatus(game: GameState | null) {
  if (!game) return '모드를 선택하고 대국을 시작하세요.'
  const mode = `${WIN_LENGTH[game.mode]}목 모드`
  if (game.status === 'playing') {
    const player = game.players[game.turn.activeSeat]
    return `${mode} · ${game.turn.round}라운드 · ${stoneLabel(player.id)} 차례`
  }
  const result = game.result.kind === 'draw' ? '무승부' : `${stoneLabel(game.result.winnerId)} 승리`
  return `${mode} · ${result}`
}

function skillFeedback(before: SkillGame, after: SkillGame, action: LocalSkillAction) {
  if (action.type === 'place') return undefined
  if (before.response) {
    const { targetId, phase } = before.response
    if (action.type === 'card') return phase === 'before' ? '공격을 막았어요.' : '버린 카드를 복구했어요.'
    if (phase === 'after') return '버린 카드를 그대로 두었어요.'
    return after.hands[targetId].length < before.hands[targetId].length ? '상대 손패에서 카드 1장을 버렸어요.' : '버릴 카드가 없었어요.'
  }
  if (after.response?.phase === 'after') return '상대 손패에서 카드 1장을 버렸어요.'
  if (!after.response) return '버릴 카드가 없었어요.'
  return undefined
}

function playSkillAction(match: Extract<Match, { kind: 'skills' }>, action: LocalSkillAction): Match {
  const result = applyLocalSkillAction(match.state, action)
  if (!result.ok) return { ...match, feedback: { text: '지금은 이 행동을 할 수 없어요. 차례와 카드 사용 조건을 확인하세요.', error: true } }

  const text = skillFeedback(match.state, result.state, action)
  return { kind: 'skills', state: result.state, feedback: text ? { text } : undefined }
}

export function LocalGame() {
  const [mode, setMode] = useState<GameMode>('five-in-a-row')
  const [rules, setRules] = useState('basic')
  const [match, setMatch] = useState<Match | null>(null)
  const skills = match?.kind === 'skills' ? match : undefined
  const game = skills?.state.game ?? (match?.kind === 'basic' ? match.game : null)
  const response = skills?.state.response

  function start() {
    if (rules === 'skills') {
      const transition = startLocalSkillGame(mode, game)
      if (transition.ok) setMatch({ kind: 'skills', state: transition.state })
    } else {
      const transition = startLocalGame(mode, game)
      if (transition.ok) setMatch({ kind: 'basic', game: transition.state })
    }
  }

  function act(action: LocalSkillAction) {
    setMatch((current) => current?.kind === 'skills' ? playSkillAction(current, action) : current)
  }

  function place(position: Position) {
    setMatch((current) => {
      if (!current) return current
      if (current.kind === 'skills') return playSkillAction(current, { type: 'place', position })
      const transition = placeLocalStone(current.game, position)
      return transition.ok ? { kind: 'basic', game: transition.state } : current
    })
  }

  return (
    <section aria-labelledby="local-game-title" className="local-game" id="local-game">
      <div className="local-game__setup">
        <h2 id="local-game-title">로컬 2인 대국</h2>
        <GameChoices
          name="local-game-mode"
          legend={game ? '새 대국 모드' : '승리 모드'}
          options={modeOptions}
          value={mode}
          onChange={(value) => setMode(value as GameMode)}
        />
        <GameChoices name="local-game-rules" legend="대국 규칙" options={ruleOptions} value={rules} onChange={setRules} />
        <div className="local-game__actions">
          <Button onClick={start}>{game ? '새 대국' : '대국 시작'}</Button>
          <SkillCatalogButton />
        </div>
        <GameNotice>
          {skills && '스킬 테스트 · '}
          {response ? `${stoneLabel(response.targetId)} 방어 응답 대기` : gameStatus(game)}
        </GameNotice>
      </div>
      {game && (
        <div className="local-game__table" data-skills={Boolean(skills)}>
          <div className="local-game__board">
            <GomokuBoard
              cells={boardCells(game.board)}
              size={game.board.size}
              isSelectable={({ row, column }) => game.status === 'playing' && !response && game.board.cells[row][column] === null}
              onSelect={place}
            />
          </div>
          {skills && (
            <div className="local-game__hands">
              <LocalSkillHand state={skills.state} playerId={LOCAL_PLAYER_IDS[0]} side="black" onAction={act} />
              <LocalSkillHand state={skills.state} playerId={LOCAL_PLAYER_IDS[1]} side="white" onAction={act} />
              {skills.feedback && (
                <GameNotice tone={skills.feedback.error ? 'error' : 'info'} alert={skills.feedback.error}>
                  {skills.feedback.text}
                </GameNotice>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  )
}
