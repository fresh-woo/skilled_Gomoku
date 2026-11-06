import { applyCommand, startGame } from './game.ts'
import type {
  CommandRejection, GameCommand, GameMode, GameState, PlayerId, PlayingGame, TurnStarted,
} from './game.ts'

type TurnStart = Readonly<{ playerId: PlayerId; round: number }>

// Each scenario supplies its card definitions and timing explicitly.
type Skill =
  | Readonly<{ kind: 'discard'; response: 'before' | 'after' }>
  | Readonly<{ kind: 'guard' | 'delay'; at: TurnStart }>
  | Readonly<{ kind: 'cancel' | 'recover' }>

type Card = Readonly<{ id: number; skill: Skill }>
type Attack = Readonly<{ id: number; targetId: PlayerId }>
type Response = Attack & (
  | Readonly<{ phase: 'before' }>
  | Readonly<{ phase: 'after'; discarded: Card }>
)
type ScheduledEffect = Readonly<{ kind: 'guard' | 'discard'; at: TurnStart; targetId: PlayerId }>

export type SkillGame = Readonly<{
  game: GameState
  hands: Readonly<Record<PlayerId, readonly Card[]>>
  drawPile: readonly Skill[]
  nextDraw: number
  randomSeed: number
  response: Response | null
  effects: readonly ScheduledEffect[]
}>

type SkillCommand = GameCommand
  | Readonly<{ type: 'use-skill'; actorId: PlayerId; cardId: number; targetId: PlayerId }>
  | Readonly<{ type: 'respond'; actorId: PlayerId; attackId: number; cardId?: number }>

type Rejection = CommandRejection | 'invalid-player-order' | 'response-pending' |
  'invalid-response' | 'card-not-in-hand' | 'invalid-skill-timing' | 'invalid-target' | 'invalid-boundary'
type Transition =
  | Readonly<{ ok: true; state: SkillGame; events: readonly TurnStarted[] }>
  | Readonly<{ ok: false; reason: Rejection }>

function accept(state: SkillGame, events: readonly TurnStarted[] = []): Transition {
  return { ok: true, state, events }
}

function replaceHand(state: SkillGame, id: PlayerId, cards: readonly Card[]): SkillGame {
  return { ...state, hands: { ...state.hands, [id]: cards } }
}

function consume(state: SkillGame, playerId: PlayerId, cardId: number): SkillGame {
  return replaceHand(state, playerId, state.hands[playerId].filter((card) => card.id !== cardId))
}

function discard(state: SkillGame, targetId: PlayerId): { state: SkillGame; discarded?: Card } {
  const hand = state.hands[targetId]
  if (!hand.length) return { state }

  const guardIndex = state.effects.findIndex((effect) => effect.kind === 'guard' && effect.targetId === targetId)
  if (guardIndex !== -1) {
    return { state: { ...state, effects: state.effects.filter((_, index) => index !== guardIndex) } }
  }

  const randomSeed = (Math.imul(state.randomSeed, 1664525) + 1013904223) >>> 0
  const index = Math.floor((randomSeed / 0x100000000) * hand.length)
  const discarded = hand[index]
  return { state: { ...consume(state, targetId, discarded.id), randomSeed }, discarded }
}

function applyTurnStart(state: SkillGame, event: TurnStarted): SkillGame {
  const isDue = ({ at }: ScheduledEffect) => at.round === event.round && at.playerId === event.playerId
  const due = state.effects.filter(isDue)
  // For this scenario, expired guards leave before delayed effects run, then the turn grants a card.
  let next: SkillGame = { ...state, effects: state.effects.filter((effect) => !isDue(effect)) }
  for (const effect of due) {
    if (effect.kind === 'discard') next = discard(next, effect.targetId).state
  }

  const skill = next.drawPile[next.nextDraw]
  if (!skill) return next

  const hand = [...next.hands[event.playerId], { id: next.nextDraw, skill }]
  return { ...replaceHand(next, event.playerId, hand), nextDraw: next.nextDraw + 1 }
}

export function startSkillGame(
  mode: GameMode,
  players: readonly PlayerId[],
  drawPile: readonly Skill[],
  randomSeed: number,
): Transition {
  const start = startGame(mode, players)
  if (!start.ok) return start

  const state: SkillGame = {
    game: start.state,
    hands: Object.fromEntries(players.map((id) => [id, []])),
    drawPile,
    nextDraw: 0,
    randomSeed: randomSeed >>> 0,
    response: null,
    effects: [],
  }
  return accept(start.events.reduce(applyTurnStart, state), start.events)
}

function isFutureTurnStart(game: PlayingGame, at: TurnStart): boolean {
  const seat = game.players.findIndex((player) => player.id === at.playerId)
  return seat !== -1 && Number.isSafeInteger(at.round) &&
    (at.round > game.turn.round || (at.round === game.turn.round && seat > game.turn.activeSeat))
}

function playSkill(
  state: SkillGame,
  game: PlayingGame,
  command: Extract<SkillCommand, { type: 'use-skill' }>,
): Transition {
  const { actorId, cardId, targetId } = command
  const card = state.hands[actorId].find(({ id }) => id === cardId)
  if (!card) return { ok: false, reason: 'card-not-in-hand' }

  const { skill } = card
  if (skill.kind === 'guard') {
    if (targetId !== actorId) return { ok: false, reason: 'invalid-target' }
    if (!isFutureTurnStart(game, skill.at)) return { ok: false, reason: 'invalid-boundary' }
    const next = consume(state, actorId, cardId)
    return accept({ ...next, effects: [...next.effects, { kind: 'guard', targetId, at: skill.at }] })
  }

  if (skill.kind !== 'discard') return { ok: false, reason: 'invalid-skill-timing' }
  if (targetId === actorId || !game.players.some((player) => player.id === targetId)) {
    return { ok: false, reason: 'invalid-target' }
  }

  const next = consume(state, actorId, cardId)
  const attack = { id: cardId, targetId }
  if (skill.response === 'before') return accept({ ...next, response: { ...attack, phase: 'before' } })

  const result = discard(next, targetId)
  const response: Response | null = result.discarded
    ? { ...attack, phase: 'after', discarded: result.discarded }
    : null
  return accept({ ...result.state, response })
}

function respond(
  state: SkillGame,
  game: PlayingGame,
  command: Extract<SkillCommand, { type: 'respond' }>,
): Transition {
  const { actorId, attackId, cardId } = command
  const response = state.response
  if (!response || response.id !== attackId || response.targetId !== actorId) {
    return { ok: false, reason: 'invalid-response' }
  }

  const resumed = { ...state, response: null }
  if (cardId === undefined) {
    return accept(response.phase === 'before' ? discard(resumed, actorId).state : resumed)
  }

  const card = state.hands[actorId].find(({ id }) => id === cardId)
  if (!card) return { ok: false, reason: 'card-not-in-hand' }

  const { skill } = card
  if (response.phase === 'before') {
    if (skill.kind === 'cancel') return accept(consume(resumed, actorId, cardId))
    if (skill.kind === 'delay') {
      if (!isFutureTurnStart(game, skill.at)) return { ok: false, reason: 'invalid-boundary' }
      return accept({
        ...consume(resumed, actorId, cardId),
        effects: [...resumed.effects, { kind: 'discard', at: skill.at, targetId: actorId }],
      })
    }
  } else if (skill.kind === 'recover') {
    const next = consume(resumed, actorId, cardId)
    return accept(replaceHand(next, actorId, [...next.hands[actorId], response.discarded]))
  }
  return { ok: false, reason: 'invalid-skill-timing' }
}

export function applySkillCommand(state: SkillGame, command: SkillCommand): Transition {
  const game = state.game
  if (game.status === 'finished') return { ok: false, reason: 'game-finished' }
  if (command.type === 'respond') return respond(state, game, command)
  if (state.response) return { ok: false, reason: 'response-pending' }
  if (command.type === 'use-skill') {
    if (command.actorId !== game.players[game.turn.activeSeat].id) {
      return { ok: false, reason: 'not-active-player' }
    }
    return playSkill(state, game, command)
  }

  const result = applyCommand(game, command)
  if (!result.ok) return result
  const next = { ...state, game: result.state }
  if (result.state.status === 'finished') return accept({ ...next, effects: [] }, result.events)
  return accept(result.events.reduce(applyTurnStart, next), result.events)
}
