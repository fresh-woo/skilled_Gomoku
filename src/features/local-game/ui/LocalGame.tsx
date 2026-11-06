import { useState } from 'react'
import { Button } from '../../../design-system/Button'
import { GameChoices, GameNotice } from '../../../design-system/GameControls'
import { GomokuBoard } from '../../../design-system/GomokuBoard'
import { boardCoordinate } from '../../../design-system/board-model'
import type { BoardCell, StoneColor } from '../../../design-system/board-model'
import { WIN_LENGTH } from '../../../entities/game/model/game'
import type { Board, GameMode, GameState, PlayerId, Position } from '../../../entities/game/model/game'
import { LOCAL_PLAYER_IDS, placeLocalStone, startLocalGame } from '../model/localGame'
import './LocalGame.css'

const modeOptions = (Object.keys(WIN_LENGTH) as GameMode[]).map((mode) => ({
  id: mode,
  title: `${WIN_LENGTH[mode]}목`,
  description: `정확히 ${WIN_LENGTH[mode]}개 연속`,
}))

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

export function LocalGame() {
  const [mode, setMode] = useState<GameMode>('five-in-a-row')
  const [game, setGame] = useState<GameState | null>(null)

  function start() {
    const transition = startLocalGame(mode, game)
    if (transition.ok) setGame(transition.state)
  }

  function place(position: Position) {
    setGame((current) => {
      if (!current) return current
      const transition = placeLocalStone(current, position)
      return transition.ok ? transition.state : current
    })
  }

  return (
    <section aria-labelledby="local-game-title" className="local-game" id="local-game">
      <h2 id="local-game-title">로컬 2인 대국</h2>
      <GameChoices
        name="local-game-mode"
        legend={game ? '새 대국 모드' : '승리 모드'}
        options={modeOptions}
        value={mode}
        onChange={(value) => setMode(value as GameMode)}
      />
      <Button onClick={start}>{game ? '새 대국' : '대국 시작'}</Button>
      <GameNotice>{gameStatus(game)}</GameNotice>
      {game && (
        <GomokuBoard
          cells={boardCells(game.board)}
          size={game.board.size}
          isSelectable={({ row, column }) => game.status === 'playing' && game.board.cells[row][column] === null}
          onSelect={place}
        />
      )}
    </section>
  )
}
