import type { GameOption, SkillCardData } from '../design-system/GameControls'
import type { BoardCell } from '../design-system/board-model'

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

const attacks = [
  ['push', '밀치기', '상대 돌을 선택한 8방향 중 한 칸으로 이동합니다.'],
  ['snipe', '저격', '선택한 상대 돌을 파괴합니다.'],
  ['wall', '단절', '돌과 돌 사이에 연결을 끊는 벽을 만듭니다.'],
  ['relocate', '후렴과', '대상의 돌을 무작위 위치로 옮깁니다.'],
  ['lock', '자물쇠', '선택한 위치에 2라운드 동안 돌을 놓을 수 없습니다.'],
  ['disarm', '무장해제', '상대의 스킬카드 1장을 무작위로 버리게 합니다.'],
  ['trap', '지뢰', '빈칸에 숨겨진 지뢰를 설치해 그 자리에 놓인 첫 돌을 제거합니다.'],
  ['isolate', '고립', '지정한 상대 돌 주변 8칸에 1라운드 동안 돌을 놓지 못하게 합니다.'],
  ['bomb', '시한폭탄', '공개된 폭탄을 두고 2라운드 후 사용자의 턴 종료에 주변 8칸의 돌을 제거합니다.'],
  ['banish', '추방', '상대 손패를 확인하고 카드 하나를 3라운드 동안 사용할 수 없게 합니다.'],
  ['expose', '약점노출', '지정한 상대 돌의 보호 효과를 해제합니다.'],
]

const defenses = [
  ['nullify', '무효화', '손의 다른 카드 1장을 버려 자신을 대상으로 한 공격 스킬을 무효화합니다.'],
  ['shield', '보호막', '내 돌 하나에 4라운드 동안 공격 스킬을 한 번 막는 보호막을 부여합니다.'],
  ['detect', '지뢰 탐지', '선택한 칸과 주변 8칸의 지뢰를 확인하고 제거합니다.'],
  ['cleanse', '정화', '내 돌이나 카드 하나에 적용된 해로운 지속효과를 해제합니다.'],
  ['restore', '복구', '공격으로 파괴된 내 돌을 원래 위치가 비어 있을 때 되돌립니다.'],
  ['redirect', '대신 맞기', '내 돌을 대상으로 한 공격을 조건에 맞는 다른 내 돌로 옮깁니다.'],
  ['delay', '시간 벌기', '공격 효과를 내 다음 턴 종료까지 미룹니다. 그때 대상이나 조건이 유효하지 않으면 효과가 사라집니다.'],
  ['booby-trap', '부비트랩', '지정한 내 돌에 상대 공격 스킬이 처음 적용되면 공격자의 카드 한 장을 무작위로 버리게 합니다.'],
  ['patch', '응급 수습', '내 돌이 파괴된 직후 인접 빈칸에 임시 돌을 놓습니다. 승리 판정에서 제외되며 내 다음 턴 시작에 사라집니다.'],
  ['barrier', '역장', '내 다음 턴 시작까지 이 돌을 공격하려면 공격자가 카드 한 장을 추가로 버려야 합니다.'],
]

export const skillCards: SkillCardData[] = [
  ...attacks.map(([id, title, description]): SkillCardData => ({ id, title, description, kind: '공격' })),
  ...defenses.map(([id, title, description]): SkillCardData => ({ id, title, description, kind: '방어' })),
]

export const exampleHand = skillCards.filter((card) => ['snipe', 'lock', 'shield'].includes(card.id))
