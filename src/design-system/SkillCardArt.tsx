import type { StoneColor } from './board-model'
export type SkillArtwork = 'snipe' | 'nullify' | 'shield' | 'disarm'
export function SkillCardArt({ kind, side }: { kind: SkillArtwork; side: StoneColor }) {
  const own = side === 'black' ? '#101726' : '#edf4ff'
  const opponent = side === 'black' ? '#edf4ff' : '#101726'
  return <svg className="play-skill-card__art" viewBox="0 0 100 100" fill="none" aria-hidden="true" focusable="false">
    {kind === 'snipe' && <>
      <circle cx="50" cy="50" r="29" stroke="currentColor" strokeWidth="1.8" />
      <path d="M50 10v22m0 36v22M10 50h22m36 0h22" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="50" cy="50" r="13" fill={opponent} stroke="currentColor" />
      <path d="m41 41 18 18m0-18L41 59" stroke="currentColor" strokeWidth="2" />
    </>}
    {kind === 'shield' && <>
      <path d="m50 10 30 14v25c0 19-30 37-30 37S20 68 20 49V24Z" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="50" cy="46" r="13" fill={own} stroke="currentColor" />
      <path d="m39 70 8 6 15-16" stroke="currentColor" strokeWidth="1.8" />
    </>}
    {kind === 'nullify' && <>
      <path d="m14 75 27-50M14 75l17-6m-17 6-3-17" stroke="currentColor" strokeWidth="1.8" />
      <rect x="48" y="20" width="32" height="52" rx="4" transform="rotate(12 64 46)" stroke="currentColor" strokeWidth="1.8" />
      <path d="m57 34 13 22m3-19L54 54" stroke="currentColor" strokeWidth="2.5" />
    </>}
    {kind === 'disarm' && <>
      <rect x="15" y="30" width="26" height="43" rx="3" transform="rotate(-12 28 51)" stroke="currentColor" strokeWidth="1.6" />
      <rect x="38" y="27" width="26" height="43" rx="3" fill="#111c30" stroke="currentColor" strokeWidth="1.6" />
      <rect x="63" y="15" width="26" height="43" rx="3" transform="rotate(17 76 36)" fill="#23213e" stroke="currentColor" strokeWidth="1.6" />
      <path d="M71 70 88 82m-1-11 1 11-12 1" stroke="currentColor" strokeWidth="1.8" />
    </>}
  </svg>
}
