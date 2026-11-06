import { useId, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { Button } from './Button'
import { boardCoordinate } from './board-model'
import type { BoardCell, BoardPoint, BoardWall, StoneColor } from './board-model'
import './game-ui.css'

export function Stone({ color }: { color: StoneColor }) {
  return <span className={`game-stone game-stone--${color}`} aria-hidden="true" />
}

type GomokuBoardProps = {
  cells: Readonly<Partial<Record<string, BoardCell>>>
  size?: number
  walls?: readonly BoardWall[]
  selected?: BoardPoint
  isSelectable?: (point: BoardPoint) => boolean
  onSelect?: (point: BoardPoint) => void
}

export function GomokuBoard({ cells, size = 15, walls = [], selected, isSelectable, onSelect }: GomokuBoardProps) {
  const indices = Array.from({ length: size }, (_, index) => index)
  const [focus, setFocus] = useState<BoardPoint>(() => ({ row: Math.floor(size / 2), column: Math.floor(size / 2) }))
  const grid = useRef<HTMLDivElement>(null)
  const hint = useId()
  const boardId = useId()
  const [isZoomed, setIsZoomed] = useState(false)
  const activeRow = Math.min(focus.row, size - 1)
  const activeColumn = Math.min(focus.column, size - 1)

  function moveFocus(event: KeyboardEvent<HTMLButtonElement>, row: number, column: number) {
    switch (event.key) {
      case 'ArrowUp': row--; break
      case 'ArrowDown': row++; break
      case 'ArrowLeft': column--; break
      case 'ArrowRight': column++; break
      case 'Home': column = 0; if (event.ctrlKey) row = 0; break
      case 'End': column = size - 1; if (event.ctrlKey) row = size - 1; break
      default: return
    }

    event.preventDefault()
    row = Math.max(0, Math.min(row, size - 1))
    column = Math.max(0, Math.min(column, size - 1))
    grid.current?.querySelector<HTMLButtonElement>(`[data-point="${row}-${column}"]`)?.focus()
  }

  return (
    <div>
      <div className="game-board-toolbar">
        <p className="game-board-hint" id={hint}>방향키로 이동하고 Enter 또는 Space로 교차점을 선택하세요.</p>
        <Button variant="secondary" className="game-board-zoom" aria-controls={boardId} aria-pressed={isZoomed} onClick={() => setIsZoomed(!isZoomed)}>
          {isZoomed ? '전체 판' : '판 확대'}
        </Button>
      </div>
      <div id={boardId} className="game-board-scroll" data-zoomed={isZoomed}>
        <div className="game-board">
          <div className="game-board__columns" aria-hidden="true" style={{ gridTemplateColumns: `repeat(${size}, 1fr)` }}>
            {indices.map((column) => <span key={column}>{String.fromCharCode(65 + column)}</span>)}
          </div>
          <div className="game-board__rows" aria-hidden="true" style={{ gridTemplateRows: `repeat(${size}, 1fr)` }}>
            {indices.map((row) => <span key={row}>{row + 1}</span>)}
          </div>
          <div className="game-board__grid" role="grid" aria-label={`${size}×${size} 오목판`} aria-describedby={hint} ref={grid}>
            <svg className="game-board__lines" viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
              {indices.map((index) => (
                <path key={index} d={`M.5 ${index + .5}H${size - .5}M${index + .5} .5V${size - .5}`} />
              ))}
              {size === 15 && [[3, 3], [3, 11], [7, 7], [11, 3], [11, 11]].map(([x, y]) => (
                <circle key={`${x}-${y}`} cx={x + .5} cy={y + .5} r=".1" />
              ))}
              {walls.map(({ from, to }, index) => (
                <line key={index} className="game-board__wall" x1={from.column + .5} y1={from.row + .5} x2={to.column + .5} y2={to.row + .5} />
              ))}
            </svg>
            {indices.map((row) => (
              <div className="game-board__row" role="row" key={row} style={{ gridTemplateColumns: `repeat(${size}, 1fr)` }}>
                {indices.map((column) => {
                  const point = { row, column }
                  const coordinate = boardCoordinate(point)
                  const cell = cells[coordinate]
                  const isSelected = selected?.row === row && selected.column === column
                  const canSelect = Boolean(onSelect && (isSelectable?.(point) ?? true))
                  const contents = cell?.stone === 'black' ? '흑돌' : cell?.stone === 'white' ? '백돌' : '빈 교차점'
                  const label = [coordinate, contents, cell?.marker?.label, cell?.last && '마지막 수', cell?.winning && '승리 줄'].filter(Boolean).join(', ')

                  return (
                    <div role="gridcell" aria-selected={isSelected} key={column}>
                      <button
                        type="button"
                        className="game-board__point"
                        aria-label={label}
                        aria-disabled={!canSelect}
                        tabIndex={row === activeRow && column === activeColumn ? 0 : -1}
                        data-point={`${row}-${column}`}
                        data-selected={isSelected}
                        data-winning={cell?.winning}
                        onFocus={() => setFocus(point)}
                        onKeyDown={(event) => moveFocus(event, row, column)}
                        onClick={() => { if (canSelect) onSelect?.(point) }}
                      >
                        {cell?.stone && <Stone color={cell.stone} />}
                        {cell?.last && <span className="game-board__last" aria-hidden="true" />}
                        {cell?.marker && <span className="game-board__marker" aria-hidden="true">{cell.marker.symbol}</span>}
                      </button>
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
