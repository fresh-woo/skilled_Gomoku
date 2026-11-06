import { applyCommand, destroyStone, isBoardPosition, startGame } from './game.ts'
import { AUGMENTS, isFortified } from './augments.ts'
import type { AugmentId } from './augments.ts'
import type {
  CommandRejection, GameCommand, GameMode, GameState, PlayerId, PlayingGame, Position, TurnStarted,
} from './game.ts'

type TurnStart = Readonly<{ playerId: PlayerId; round: number }>

type Skill =
  | Readonly<{ kind: 'discard'; response: 'before' | 'after' }>
  | Readonly<{ kind: 'guard' | 'delay'; at: TurnStart }>
  | Readonly<{ kind: 'cancel' | 'recover' }>
  | Readonly<{ kind: 'snipe' | 'nullify' | 'shield' }>

const onlineSkills: readonly Skill[] = [
  { kind: 'snipe' }, { kind: 'nullify' }, { kind: 'shield' },
  { kind: 'discard', response: 'before' }, { kind: 'cancel' },
  { kind: 'recover' }, { kind: 'discard', response: 'after' },
]
export const ONLINE_SKILL_COUNT = onlineSkills.length
const fairDrawLimit = 0x100000000 - (0x100000000 % ONLINE_SKILL_COUNT)
type TurnSkill = 'snipe' | 'shield'
export const SNIPE_RESPONSE_MS = 15_000
const SHIELD_ROUNDS = 4

type Card = Readonly<{ id: number; skill: Skill }>
type Attack = Readonly<{ id: number; targetId: PlayerId }>
type Response = Attack & (
  | Readonly<{ phase: 'before' }>
  | Readonly<{ phase: 'after'; discarded: Card }>
  | Readonly<{ phase: 'snipe'; position: Position; deadline: number }>
)
type ScheduledEffect = Readonly<{ kind: 'guard' | 'discard'; at: TurnStart; targetId: PlayerId }>
type Shield = Readonly<{ position: Position; expiresRound: number }>

export type SkillGame = Readonly<{
  game: GameState
  hands: Readonly<Record<PlayerId, readonly Card[]>>
  drawPile: readonly Skill[] | null
  nextDraw: number
  randomSeed: number
  response: Response | null
  effects: readonly ScheduledEffect[]
  shields: readonly Shield[]
  usedStoneSkills: readonly TurnSkill[]
  snipeOutcome: 'destroyed' | 'shielded' | 'nullified' | null
  augments: Readonly<Record<PlayerId, readonly AugmentId[]>>
  augmentOffer: Readonly<Record<PlayerId, readonly AugmentId[]>> | null
}>

type SkillCommand = GameCommand
  | Readonly<{ type: 'use-skill'; actorId: PlayerId; cardId: number; targetId?: PlayerId; position?: Position }>
  | Readonly<{ type: 'respond'; actorId: PlayerId; attackId: number; cardId?: number; discardCardId?: number }>
  | Readonly<{ type: 'choose-augment'; actorId: PlayerId; augmentId: string; round: number }>

type Rejection = CommandRejection | 'invalid-player-order' | 'response-pending' |
  'invalid-response' | 'card-not-in-hand' | 'invalid-skill-timing' | 'invalid-target' | 'invalid-boundary' |
  'invalid-nullify-cost' | 'already-shielded' | 'response-expired' | 'skill-used-this-turn' |
  'augment-pending' | 'invalid-augment' | 'fortified-target'
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

function samePosition(a: Position, b: Position): boolean {
  return a.row === b.row && a.column === b.column
}

export function canTargetStone(state: Pick<SkillGame, 'game'>, actorId: PlayerId, kind: TurnSkill, position: Position): boolean {
  const { board } = state.game
  if (!isBoardPosition(board, position)) return false
  const stone = board.cells[position.row][position.column]
  if (!stone) return false
  return kind === 'snipe' ? stone.ownerId !== actorId : stone.ownerId === actorId
}

function roll(seed: number): number {
  return (Math.imul(seed, 1664525) + 1013904223) >>> 0
}

function drawOnlineCard(seed: number): { skill: Skill; randomSeed: number } {
  let randomSeed = seed
  // Reject the remainder of the 32-bit range before selecting a card by modulo.
  do { randomSeed = roll(randomSeed) } while (randomSeed >= fairDrawLimit)
  return { skill: onlineSkills[randomSeed % ONLINE_SKILL_COUNT], randomSeed }
}

function grantCard(state: SkillGame, playerId: PlayerId, skill: Skill): SkillGame {
  const hand = [...state.hands[playerId], { id: state.nextDraw, skill }]
  return { ...replaceHand(state, playerId, hand), nextDraw: state.nextDraw + 1 }
}

export function offerRoundAugments(state: SkillGame): SkillGame {
  const { game } = state
  if (state.augmentOffer || state.response || game.status !== 'playing' ||
    game.turn.activeSeat !== 0 || (game.turn.round - 1) % 5 !== 0) return state

  const pool = Object.keys(AUGMENTS) as AugmentId[]
  const offers = Object.fromEntries(game.players.map(({ id }) => [
    id, pool.filter((augment) => !state.augments[id].includes(augment)).slice(0, 3),
  ]))
  return Object.values(offers).some((choices) => choices.length > 0)
    ? { ...state, augmentOffer: offers }
    : state
}

function chooseAugment(state: SkillGame, actorId: PlayerId, requestedId: string): Transition {
  const offer = state.augmentOffer
  const choice = offer?.[actorId]?.find((id) => id === requestedId)
  if (!offer || !choice) return { ok: false, reason: 'invalid-augment' }

  const remaining = { ...offer, [actorId]: [] }
  let next: SkillGame = {
    ...state,
    augments: { ...state.augments, [actorId]: [...state.augments[actorId], choice] },
    augmentOffer: Object.values(remaining).some((choices) => choices.length > 0) ? remaining : null,
  }
  if (choice === 'card-bundle') {
    for (let count = 0; count < 4; count++) {
      const { skill, randomSeed } = drawOnlineCard(next.randomSeed)
      next = { ...grantCard(next, actorId, skill), randomSeed }
    }
  }
  return accept(next)
}

export function fortifiedPlayers(state: Pick<SkillGame, 'game' | 'augments'>): PlayerId[] {
  return state.game.players.filter(({ id }) => state.augments[id].includes('fortification')).map(({ id }) => id)
}

function discard(state: SkillGame, targetId: PlayerId): { state: SkillGame; discarded?: Card } {
  const hand = state.hands[targetId]
  if (!hand.length) return { state }

  const guardIndex = state.effects.findIndex((effect) => effect.kind === 'guard' && effect.targetId === targetId)
  if (guardIndex !== -1) {
    return { state: { ...state, effects: state.effects.filter((_, index) => index !== guardIndex) } }
  }

  const randomSeed = roll(state.randomSeed)
  const index = Math.floor((randomSeed / 0x100000000) * hand.length)
  const discarded = hand[index]
  return { state: { ...consume(state, targetId, discarded.id), randomSeed }, discarded }
}

function applyTurnStart(state: SkillGame, event: TurnStarted, drawIndex?: number): SkillGame {
  const isDue = ({ at }: ScheduledEffect) => at.round === event.round && at.playerId === event.playerId
  const due = state.effects.filter(isDue)
  // For this scenario, expired guards leave before delayed effects run, then the turn grants a card.
  let next: SkillGame = {
    ...state,
    effects: state.effects.filter((effect) => !isDue(effect)),
    shields: state.shields.filter(({ expiresRound }) => event.round < expiresRound),
  }
  for (const effect of due) {
    if (effect.kind === 'discard') next = discard(next, effect.targetId).state
  }

  if (next.drawPile) {
    const skill = next.drawPile[next.nextDraw]
    return skill ? grantCard(next, event.playerId, skill) : next
  }
  if (drawIndex !== undefined) {
    const skill = onlineSkills[drawIndex]
    return skill ? grantCard(next, event.playerId, skill) : next
  }
  const { skill, randomSeed } = drawOnlineCard(next.randomSeed)
  return { ...grantCard(next, event.playerId, skill), randomSeed }
}

export function startSkillGame(
  mode: GameMode,
  players: readonly PlayerId[],
  drawPile: readonly Skill[] | null,
  randomSeed: number,
  drawIndex?: number,
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
    shields: [],
    usedStoneSkills: [],
    snipeOutcome: null,
    augments: Object.fromEntries(players.map((id) => [id, []])),
    augmentOffer: null,
  }
  return accept(start.events.reduce((next, event) => applyTurnStart(next, event, drawIndex), state), start.events)
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
  now: number,
): Transition {
  const { actorId, cardId, targetId } = command
  const card = state.hands[actorId].find(({ id }) => id === cardId)
  if (!card) return { ok: false, reason: 'card-not-in-hand' }

  const { skill } = card
  if (skill.kind === 'snipe' || skill.kind === 'shield') {
    const { position } = command
    if (!position || !canTargetStone(state, actorId, skill.kind, position)) {
      return { ok: false, reason: 'invalid-target' }
    }
    if (skill.kind === 'shield' && state.shields.some((shield) => samePosition(shield.position, position))) {
      return { ok: false, reason: 'already-shielded' }
    }
    if (skill.kind === 'snipe' && isFortified(game, position, fortifiedPlayers(state))) {
      return { ok: false, reason: 'fortified-target' }
    }
    if (state.usedStoneSkills.includes(skill.kind)) return { ok: false, reason: 'skill-used-this-turn' }
    const next: SkillGame = {
      ...consume(state, actorId, cardId),
      usedStoneSkills: [...state.usedStoneSkills, skill.kind],
      snipeOutcome: null,
    }
    if (skill.kind === 'shield') {
      return accept({
        ...next,
        shields: [...state.shields, { position, expiresRound: game.turn.round + SHIELD_ROUNDS }],
      })
    }
    const targetId = game.board.cells[position.row][position.column]!.ownerId
    return accept({
      ...next,
      response: { id: cardId, targetId, phase: 'snipe', position, deadline: now + SNIPE_RESPONSE_MS },
    })
  }
  if (skill.kind === 'guard') {
    if (targetId !== actorId) return { ok: false, reason: 'invalid-target' }
    if (!isFutureTurnStart(game, skill.at)) return { ok: false, reason: 'invalid-boundary' }
    const next = consume(state, actorId, cardId)
    return accept({ ...next, effects: [...next.effects, { kind: 'guard', targetId, at: skill.at }] })
  }

  if (skill.kind !== 'discard') return { ok: false, reason: 'invalid-skill-timing' }
  if (!targetId || targetId === actorId || !game.players.some((player) => player.id === targetId)) {
    return { ok: false, reason: 'invalid-target' }
  }

  const next = { ...consume(state, actorId, cardId), snipeOutcome: null }
  const attack = { id: cardId, targetId }
  if (skill.response === 'before') return accept({ ...next, response: { ...attack, phase: 'before' } })

  const result = discard(next, targetId)
  const response: Response | null = result.discarded
    ? { ...attack, phase: 'after', discarded: result.discarded }
    : null
  return accept({ ...result.state, response })
}

function resolveSnipe(state: SkillGame, game: PlayingGame, position: Position): SkillGame {
  if (state.shields.some((shield) => samePosition(shield.position, position))) {
    return {
      ...state, response: null, snipeOutcome: 'shielded',
      shields: state.shields.filter((shield) => !samePosition(shield.position, position)),
    }
  }
  const nextGame = destroyStone(game, position)
  return {
    ...state, game: nextGame, response: null, snipeOutcome: 'destroyed',
    shields: nextGame.status === 'finished' ? [] : state.shields,
  }
}

export function expireSnipe(state: SkillGame, now: number): SkillGame {
  const { game, response } = state
  if (game.status !== 'playing' || response?.phase !== 'snipe' || now < response.deadline) return state
  return resolveSnipe(state, game, response.position)
}

function respond(
  state: SkillGame,
  game: PlayingGame,
  command: Extract<SkillCommand, { type: 'respond' }>,
  now: number,
): Transition {
  const { actorId, attackId, cardId } = command
  const response = state.response
  if (!response || response.id !== attackId || response.targetId !== actorId) {
    return { ok: false, reason: 'invalid-response' }
  }

  if (response.phase === 'snipe') {
    if (now >= response.deadline) return { ok: false, reason: 'response-expired' }
    if (cardId === undefined) return accept(resolveSnipe(state, game, response.position))
    const hand = state.hands[actorId]
    const card = hand.find(({ id }) => id === cardId)
    if (!card) return { ok: false, reason: 'card-not-in-hand' }
    if (card.skill.kind !== 'nullify') return { ok: false, reason: 'invalid-skill-timing' }
    const { discardCardId } = command
    if (discardCardId === cardId || !hand.some(({ id }) => id === discardCardId)) {
      return { ok: false, reason: 'invalid-nullify-cost' }
    }
    const next = replaceHand(state, actorId, hand.filter(({ id }) => id !== cardId && id !== discardCardId))
    return accept({ ...next, response: null, snipeOutcome: 'nullified' })
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

export function applySkillCommand(state: SkillGame, command: SkillCommand, now = 0, drawIndex?: number): Transition {
  const game = state.game
  if (game.status === 'finished') return { ok: false, reason: 'game-finished' }
  if (command.type === 'choose-augment') {
    if (game.turn.round !== command.round) return { ok: false, reason: 'invalid-augment' }
    return chooseAugment(state, command.actorId, command.augmentId)
  }
  if (state.augmentOffer) return { ok: false, reason: 'augment-pending' }
  if (command.type === 'respond') return respond(state, game, command, now)
  if (state.response) return { ok: false, reason: 'response-pending' }
  if (command.type === 'use-skill') {
    if (command.actorId !== game.players[game.turn.activeSeat].id) {
      return { ok: false, reason: 'not-active-player' }
    }
    return playSkill(state, game, command, now)
  }

  const result = applyCommand(game, command)
  if (!result.ok) return result
  const next: SkillGame = { ...state, game: result.state, usedStoneSkills: [], snipeOutcome: null }
  if (result.state.status === 'finished') return accept({ ...next, effects: [], shields: [] }, result.events)
  return accept(result.events.reduce((current, event) => applyTurnStart(current, event, drawIndex), next), result.events)
}
