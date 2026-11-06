import type { GameOption } from '../design-system/GameControls'
import type { BoardCell } from '../design-system/board-model'
import { skillCards } from '../features/skill-catalog/cards'

export { skillCards }

export const exampleBoard: Record<string, BoardCell> = {
  H7: { stone: 'white' },
  G8: { stone: 'white' },
  H8: { stone: 'black' },
  I8: { stone: 'black', marker: { label: '보호막 적용', symbol: '보' } },
  J8: { stone: 'white', last: true },
  H9: { stone: 'black' },
  I9: { stone: 'white' },
  J9: { stone: 'black' },
  K10: { marker: { label: '잠긴 교차점', symbol: '잠' } },
}

export const modes: GameOption[] = [
  { id: '5', title: '5목', description: '자기 돌을 정확히 5개 연속으로 이으면 승리합니다.' },
  { id: '6', title: '6목', description: '자기 돌을 정확히 6개 연속으로 이으면 승리합니다.' },
]

export const augments: GameOption[] = [
  { id: 'draw', title: '반응 드로우', description: '상대가 공격 스킬을 사용하면 스킬카드 1장을 얻습니다.' },
  { id: 'tempo', title: '템포', description: '자신의 기존 승리 목표보다 한 목 적게 완성하면 승리합니다.' },
  { id: 'pack', title: '카드뭉치', description: '스킬카드 4장을 즉시 얻습니다.' },
  { id: 'queen', title: '여왕의 기개', description: '판 위의 돌 하나를 포획할 수 있는 체스 퀸으로 바꿉니다.' },
  { id: 'mine', title: '광산', description: '돌을 3개 놓을 때마다 스킬카드 1장을 얻습니다.' },
  { id: 'fortify', title: '요새화', description: '승리 목표보다 한 목 짧은 줄에 속한 돌이 공격 스킬에 면역이 됩니다.' },
  { id: 'stealth', title: '은신', description: '자신이 놓은 돌이 숨겨졌다가 다음 턴에 공개됩니다.' },
  { id: 'reserve', title: '시간 비축', description: '내 턴을 한 번 건너뛴 뒤 다음 턴에 두 번 행동할 수 있습니다.' },
  { id: 'entropy', title: '엔트로피', description: '오목이 완성되지 않는 범위에서 모든 돌의 색을 무작위로 바꿉니다.' },
  { id: 'perfect', title: '완벽주의자', description: '목표 길이의 줄을 두 개 완성해야 하며, 매 턴 두 번 행동합니다.' },
]

export const exampleHand = skillCards.filter((card) => ['snipe', 'lock', 'shield'].includes(card.id))
