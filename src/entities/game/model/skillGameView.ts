import type { SkillGame } from './skillGame'

// Presentation contract shared by local and online hands, without server-only state.
export type SkillView = Pick<SkillGame, 'game' | 'hands'> & {
  response: Pick<NonNullable<SkillGame['response']>, 'id' | 'targetId' | 'phase'> | null
}
