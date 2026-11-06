import type { SkillGame } from './skillGame'

// Presentation contract shared by local and online hands, without server-only state.
type Response = NonNullable<SkillGame['response']>
export type SkillView = Pick<SkillGame, 'game' | 'hands' | 'shields' | 'usedStoneSkills' | 'snipeOutcome'> & {
  response: Pick<Response, 'id' | 'targetId'> & (
    { phase: 'before' | 'after' } | Extract<Response, { phase: 'snipe' }>
  ) | null
}
