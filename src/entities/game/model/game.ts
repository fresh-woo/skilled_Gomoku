export const BOARD_SIZE = 15

export const WIN_LENGTH = {
  'five-in-a-row': 5,
  'six-in-a-row': 6,
} as const

export type GameMode = keyof typeof WIN_LENGTH
export type PlayerId = string
export type Position = Readonly<{ row: number; column: number }>
type Stone = Readonly<{ ownerId: PlayerId }>
export type Board = Readonly<{
  size: typeof BOARD_SIZE
  cells: readonly (readonly (Stone | null)[])[]
}>

type Player = Readonly<{
  id: PlayerId
  winCondition: Readonly<{ lineLength: number }>
}>
type GameBase = Readonly<{
  mode: GameMode
  board: Board
  players: readonly [Player, Player]
}>
export type PlayingGame = GameBase & Readonly<{
  status: 'playing'
  turn: Readonly<{ round: number; activeSeat: number }>
}>
type GameResult = Readonly<{ kind: 'win'; winnerId: PlayerId }> | Readonly<{ kind: 'draw' }>
export type GameState = PlayingGame | (GameBase & Readonly<{
  status: 'finished'
  result: GameResult
}>)

export type GameCommand = Readonly<{
  type: 'place-stone'
  actorId: PlayerId
  position: Position
}>
export type TurnStarted = Readonly<{
  type: 'turn-started'
  playerId: PlayerId
  round: number
  stoneGrant: 1
  skillCardGrant: 1
}>
export type CommandRejection =
  | 'game-finished'
  | 'not-active-player'
  | 'invalid-position'
  | 'occupied-position'

type Accepted<State extends GameState> = Readonly<{
  ok: true
  state: State
  events: readonly TurnStarted[]
}>
type Rejected<Reason extends string> = Readonly<{ ok: false; reason: Reason }>

function startTurn(game: GameBase, round: number, activeSeat: number): Accepted<PlayingGame> {
  return {
    ok: true,
    state: { ...game, status: 'playing', turn: { round, activeSeat } },
    events: [{
      type: 'turn-started',
      playerId: game.players[activeSeat].id,
      round,
      stoneGrant: 1,
      skillCardGrant: 1,
    }],
  }
}

export function startGame(
  mode: GameMode,
  playerIds: readonly PlayerId[],
): Accepted<PlayingGame> | Rejected<'invalid-player-order'> {
  const [first, second] = playerIds
  if (playerIds.length !== 2 || !first || !second || first === second) {
    return { ok: false, reason: 'invalid-player-order' }
  }

  const winCondition = { lineLength: WIN_LENGTH[mode] }
  const game: GameBase = {
    mode,
    board: {
      size: BOARD_SIZE,
      cells: Array.from({ length: BOARD_SIZE }, () => Array<Stone | null>(BOARD_SIZE).fill(null)),
    },
    players: [{ id: first, winCondition }, { id: second, winCondition }],
  }
  return startTurn(game, 1, 0)
}

const directions = [[0, 1], [1, 0], [1, 1], [1, -1]] as const

function countStones(
  board: Board,
  position: Position,
  playerId: PlayerId,
  rowStep: number,
  columnStep: number,
): number {
  let row = position.row + rowStep
  let column = position.column + columnStep
  let count = 0
  while (board.cells[row]?.[column]?.ownerId === playerId) {
    count += 1
    row += rowStep
    column += columnStep
  }
  return count
}

function hasWinningLine(board: Board, position: Position, player: Player): boolean {
  return directions.some(([rowStep, columnStep]) => {
    const forward = countStones(board, position, player.id, rowStep, columnStep)
    const backward = countStones(board, position, player.id, -rowStep, -columnStep)
    return 1 + forward + backward === player.winCondition.lineLength
  })
}

export function applyCommand(
  state: GameState,
  command: GameCommand,
): Accepted<GameState> | Rejected<CommandRejection> {
  if (state.status === 'finished') return { ok: false, reason: 'game-finished' }

  const { mode, players, turn } = state
  const player = players[turn.activeSeat]
  if (command.actorId !== player.id) return { ok: false, reason: 'not-active-player' }

  const { row, column } = command.position
  const { size } = state.board
  if (!Number.isInteger(row) || !Number.isInteger(column) ||
    row < 0 || row >= size || column < 0 || column >= size) {
    return { ok: false, reason: 'invalid-position' }
  }

  if (state.board.cells[row][column] !== null) return { ok: false, reason: 'occupied-position' }

  const cells = [...state.board.cells]
  const updatedRow = [...cells[row]]
  updatedRow[column] = { ownerId: player.id }
  cells[row] = updatedRow
  const board = { size, cells }
  const game = { mode, players, board }

  if (hasWinningLine(board, command.position, player)) {
    const result: GameResult = { kind: 'win', winnerId: player.id }
    return { ok: true, state: { ...game, status: 'finished', result }, events: [] }
  }

  if (cells.every((line) => line.every((stone) => stone !== null))) {
    const result: GameResult = { kind: 'draw' }
    return { ok: true, state: { ...game, status: 'finished', result }, events: [] }
  }

  const nextSeat = (turn.activeSeat + 1) % players.length
  const nextRound = nextSeat === 0 ? turn.round + 1 : turn.round
  return startTurn(game, nextRound, nextSeat)
}
