export type BoardPoint = { row: number; column: number }
export type StoneColor = 'black' | 'white'
export type BoardCell = {
  stone?: StoneColor
  marker?: { label: string; symbol: string }
  last?: boolean
  winning?: boolean
}
export type BoardWall = { from: BoardPoint; to: BoardPoint }

export function boardCoordinate({ row, column }: BoardPoint) {
  return `${String.fromCharCode(65 + column)}${row + 1}`
}
