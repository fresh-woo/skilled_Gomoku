import { fortifiedPlayers } from './skillGame.ts'
import type { SkillGame } from './skillGame.ts'
import type { AugmentId } from './augments.ts'
import type { PlayerId } from './game.ts'

type Response = NonNullable<SkillGame['response']>
export type SkillView = Pick<SkillGame, 'game' | 'hands' | 'shields' | 'usedStoneSkills' | 'snipeOutcome'> & {
  response: Pick<Response, 'id' | 'targetId'> & (
    { phase: 'before' | 'after' } | Extract<Response, { phase: 'snipe' }>
  ) | null
  augment: {
    choices: readonly AugmentId[]
    owned: readonly AugmentId[]
    pending: boolean
    fortifiedPlayers: readonly PlayerId[]
  }
}

export function projectSkillGame(state: SkillGame, viewer: PlayerId): SkillView {
  const response = state.response
  return {
    game: state.game,
    hands: { [viewer]: state.hands[viewer] },
    response: response ? {
      id: response.id, targetId: response.targetId,
      ...(response.phase === 'snipe'
        ? { phase: response.phase, position: response.position, deadline: response.deadline }
        : { phase: response.phase }),
    } : null,
    shields: state.shields,
    usedStoneSkills: state.usedStoneSkills,
    snipeOutcome: state.snipeOutcome,
    augment: {
      choices: state.augmentOffer?.[viewer] ?? [],
      owned: state.augments[viewer],
      pending: state.augmentOffer !== null,
      fortifiedPlayers: fortifiedPlayers(state),
    },
  }
}
