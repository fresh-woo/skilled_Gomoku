import { useState } from 'react'
import { Button } from '../../../design-system/Button'
import { GameChoices, GameNotice } from '../../../design-system/GameControls'
import { GomokuBoard } from '../../../design-system/GomokuBoard'
import { boardCoordinate } from '../../../design-system/board-model'
import type { BoardCell } from '../../../design-system/board-model'
import { WIN_LENGTH } from '../../../entities/game/model/game'
import type { GameMode, GameState, PlayerId, Position } from '../../../entities/game/model/game'
import { actionSounds } from '../../../entities/game/model/soundEvents'
import type { GameSound } from '../../../entities/game/model/soundEvents'
import { useGameSounds } from '../../game-sound/useGameSounds'
import { LOCAL_PLAYER_IDS, placeLocalStone, startLocalGame } from '../model/localGame'
import './LocalGame.css'

const modeOptions = (Object.keys(WIN_LENGTH) as GameMode[]).map((mode) => ({
  id: mode,
  title: `${WIN_LENGTH[mode]}목`,
  description: `정확히 ${WIN_LENGTH[mode]}개 연속`,
}))

function stoneLabel(playerId: PlayerId) {
  return playerId === LOCAL_PLAYER_IDS[0] ? '흑돌' : '백돌'
}

export function LocalGame() {
  const [mode, setMode] = useState<GameMode>('five-in-a-row')
  const [match, setMatch] = useState<{ game: GameState; sounds?: readonly GameSound[] } | null>(null)
  const game = match?.game ?? null
  useGameSounds(match?.sounds)

  function start() {
    const transition = startLocalGame(mode, game)
    if (transition.ok) setMatch({ game: transition.state })
  }

  function place(position: Position) {
    setMatch((current) => {
      if (!current) return current
      const transition = placeLocalStone(current.game, position)
      return transition.ok ? { game: transition.state, sounds: actionSounds('place') } : current
    })
  }

  const cells: Record<string, BoardCell> = {}
  game?.board.cells.forEach((line, row) => line.forEach((stone, column) => {
    if (stone) {
      cells[boardCoordinate({ row, column })] = { stone: stone.ownerId === LOCAL_PLAYER_IDS[0] ? 'black' : 'white' }
    }
  }))

  return (
    <section aria-labelledby="local-game-title" className="local-game" id="local-game">
      <div className="local-game__setup">
        <span className="game-setup__eyebrow">02 / LOCAL MATCH</span>
        <h2 id="local-game-title">로컬 2인 대국</h2>
        <p>한 화면에서 번갈아 두는 오목. 옆자리 친구와 바로 시작하세요.</p>
        <GameChoices
          name="local-game-mode"
          legend={game ? '새 대국 모드' : '승리 모드'}
          options={modeOptions}
          value={mode}
          onChange={(value) => setMode(value as GameMode)}
        />
        <div className="local-game__actions">
          <Button onClick={start}>{game ? '새 대국' : '대국 시작'}</Button>
        </div>
        {!game && <GameNotice>모드를 선택하고 대국을 시작하세요.</GameNotice>}
      </div>
      {game && (
        <div className="local-game__table">
          <GameNotice>
            {game.status === 'playing'
              ? <><strong>{stoneLabel(game.players[game.turn.activeSeat].id)} 차례</strong> · {game.turn.round}라운드</>
              : <strong>{game.result.kind === 'draw' ? '무승부' : `${stoneLabel(game.result.winnerId)} 승리`}</strong>}
            {' · '}{WIN_LENGTH[game.mode]}목 모드
          </GameNotice>
          <GomokuBoard
            cells={cells}
            size={game.board.size}
            isSelectable={({ row, column }) => game.status === 'playing' && !game.board.cells[row][column]}
            onSelect={place}
          />
        </div>
      )}
    </section>
  )
}
