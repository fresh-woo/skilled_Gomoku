# 게임 규칙 모델 초안

[게임 기획](game-spec.md)과 [개발 로드맵](development-roadmap.md)의 1단계 설계다. 아래 타입은 2단계 구현을 위한 초안이다. 제품 규칙은 게임 기획을 기준으로 확정한다.

## 규칙과 화면·통신의 경계

- **규칙 모듈**은 판과 플레이어 상태, 명령 검증, 상태 전이와 결과를 관리하는 순수 TypeScript 모듈로 둔다. 같은 상태·명령·규칙 설정으로 같은 결과를 낸다. React, 네트워크, 시계에 의존하지 않는다.
- **대국 세션**은 상태를 보관하고 명령을 규칙 모듈에 전달한다. 로컬에서는 같은 프로세스에서 실행한다. 온라인에서는 신뢰할 수 있는 실행 주체가 규칙을 적용하고 인증된 세션에서 행동자 ID를 정한다. 방 참가, 전송, 재접속은 세션이나 통신 계층의 책임이다.
- **화면**은 세션에서 받은 표시용 상태를 렌더링하고 착수 등 플레이어 의도를 보낸다. UI가 미리 안내한 행동도 규칙 모듈에서 검증한다. 공통 UI와 토큰은 [디자인 시스템](design-system.md)을 재사용한다.

## 기본 게임 타입

```ts
type PlayerId = string
type Position = Readonly<{ row: number; column: number }>
type Stone = Readonly<{ ownerId: PlayerId }>
type Board = Readonly<{
  size: 15
  cells: readonly (readonly (Stone | null)[])[]
}>

type GameMode = 'five-in-a-row' | 'six-in-a-row'
type WinCondition = Readonly<{ lineLength: number }>
type Player = Readonly<{ id: PlayerId; winCondition: WinCondition }>
type TurnOrder<T> = readonly [T, T]
type Turn = Readonly<{
  round: number
  activeSeat: number
}>

type GameResult =
  | Readonly<{ kind: 'win'; winnerId: PlayerId }>
  | Readonly<{ kind: 'draw' }>
type GameState = Readonly<{ mode: GameMode; board: Board; players: TurnOrder<Player> }> & (
  | Readonly<{ status: 'playing'; turn: Turn }>
  | Readonly<{ status: 'finished'; result: GameResult }>
)

type GameCommand = Readonly<{
  type: 'place-stone'
  actorId: PlayerId
  position: Position
}>

type TurnStarted = Readonly<{
  type: 'turn-started'
  playerId: PlayerId
  round: number
  stoneGrant: 1
  skillCardGrant: 1
}>

type CommandRejection =
  | 'game-finished'
  | 'not-active-player'
  | 'invalid-position'
  | 'occupied-position'

type Transition<Reason extends string> =
  | Readonly<{ ok: true; state: GameState; events: readonly TurnStarted[] }>
  | Readonly<{ ok: false; reason: Reason }>

declare function startGame(
  mode: GameMode,
  playerIds: TurnOrder<PlayerId>,
): Transition<'invalid-player-order'>
declare function applyCommand(state: GameState, command: GameCommand): Transition<CommandRejection>
```

- **판과 돌**: 좌표는 0부터 시작하는 행·열로 제안한다. 초기화에서 15×15 행렬을 만들고 각 교차점을 `null`로 채운다. 돌의 소유자 ID를 화면의 돌 색상과 분리한다.
- **플레이어와 승리**: `mode`에 따라 개인별 `winCondition`의 초기 목표는 5 또는 6이다. 각 방향에서 착수점을 포함한 같은 소유자의 연속 구간 전체를 양쪽으로 센다. 어느 한 방향에서 구간 길이가 목표와 정확히 일치하면 승리한다. 목표보다 긴 줄을 만드는 착수도 유효하다.
- **턴과 라운드**: 규칙 모듈에는 선공과 후공의 ID를 순서대로 전달한다. 초기화에서 인원수와 ID 중복을 검사한다. `activeSeat`가 가리키는 자리가 턴 소유자다. 세션이 첫 대국의 선공을 무작위로 결정하고, 같은 두 사람의 재대국은 직전 순서를 뒤집어 전달한다. 로컬 검증은 고정 순서를 전달할 수 있다.
- **카드**: `TurnStarted`의 `skillCardGrant`는 카드 지급 시점을 드러내는 신호다. 첫 턴을 포함해 턴 진입마다 한 번 발생하며 게임 시작 보상과 구분한다. 카드 풀이 미정인 2단계에서는 이 신호를 검사한다. 실제 지급을 연결할 때는 카드 정의 ID와 손패 내 카드 인스턴스 ID를 구분하고 플레이어별 손패를 규칙 상태에서 관리한다. 지급과 상태 저장은 동일한 전이 안에서 처리해 알림 재전송이나 재접속으로 중복 지급되지 않게 한다.

## 기본 상태 전이

| 시점 | 규칙 모듈이 하는 일 |
| --- | --- |
| 대국 시작 | 빈 판을 만들고 1라운드 첫 턴에 진입한다. 이 진입에 대응하는 돌·카드 지급 신호를 한 번 생성한다. |
| 착수 요청 | 종료 여부, 행동자, 좌표의 정수 여부와 범위, 점유 여부를 확인한다. 거부 시 상태와 이벤트를 변경하지 않는다. |
| 착수 승인 | 돌을 놓고 가로·세로·두 대각선에서 착수한 플레이어의 승리 조건을 검사한다. 승리하면 대국을 종료한다. 승자가 없고 판이 가득 찼으면 무승부로 종료한다. |
| 다음 턴 | 대국이 계속되면 착수한 턴을 끝내고 다음 자리의 턴을 시작한다. 마지막 자리가 턴을 마쳤을 때만 라운드를 1 올린다. |

기본 흐름은 `A → B → 다음 라운드 A`다. 자기 턴에 스킬을 쓰는 경우 착수 전에 처리한다. 방어 응답은 별도 턴으로 세지 않는다.

## 방어와 효과의 확장 경계

- `playing`에 정상 턴과 응답 대기를 구분하는 단계를 추가할 수 있다. 응답 대기에는 응답 창 ID, 공격자·대상·중단 지점을 담은 공격 맥락, 응답 자격이 있는 플레이어 ID를 저장하는 방안을 제안한다. 응답 명령은 해당 창의 응답 자격으로 검증한다.
- 무효화처럼 적용 전에 개입하는 방어와 복구처럼 파괴 후에만 가능한 방어는 재개 지점이 다르다. 공격 명령에서 해당 효과가 요구하는 지점에 응답 기회를 열고, 응답 처리가 끝나면 같은 턴의 저장된 지점에서 이어간다. 응답 대기 중 허용할 명령, 창 종료 조건과 미응답 처리, 방어 연쇄와 효과 우선순위는 3단계 기획에서 정한다.
- 즉시 효과는 현재 전이에서 처리한다. 지속 효과의 만료와 지연 효과의 발동은 확정된 턴·라운드 경계를 기준으로 표현한다. 응답 제한 시간이 확정되면 세션이 시간 만료를 명령으로 전달하도록 하고 규칙 모듈은 시스템 시각을 직접 읽지 않는다.
- 무작위 카드 획득이나 대상 선택을 구현할 때는 재현 가능한 난수 상태를 규칙에 전달한다. 성공한 전이와 함께 갱신하고 거부된 명령은 난수를 소비하지 않는다.
- 온라인에서는 전체 규칙 상태와 이벤트를 서버 측에 두고, 각 플레이어에게 허용된 필드만 뽑아 보낸다. 손패·지뢰·은신 정보와 난수 상태는 전달 전에 권한에 맞게 걸러낸다. 재접속에도 같은 공개 규칙을 적용한다. 명령 ID로 중복을 식별하고 상태 버전으로 오래된 명령을 검증하는 방안은 5단계에서 통신 계약과 함께 구체화한다.

## 3단계 테스트용 엔진

`src/entities/game/model/skillGame.ts`는 기존 착수 규칙 위에 손패, 응답 대기와 예약 효과를 추가한다. `startSkillGame`에 카드 순서와 난수 시드를 명시적으로 넘겨 테스트 대국을 만든다. 첫 턴을 포함한 턴 시작 이벤트에서 카드를 한 장씩 지급하며, 테스트 카드가 소진되면 지급 신호만 유지한다.

- 테스트 공격은 상대 손패의 카드 한 장을 무작위로 버린다. 공격 전에는 취소·지연, 공격 후에는 방금 버린 카드의 복구를 검증한다. 응답 대기 중에는 대상 플레이어만 해당 공격에 응답할 수 있다. 카드 없이 응답하면 현재 창을 닫고, 공격 전이었다면 공격을 처리한다.
- 테스트용 방어는 지정한 턴 시작까지 유효하며 버리기 효과를 한 번 막는다. 턴 시작에 만료를 먼저 처리하고 지연 효과를 실행한 뒤 카드를 지급한다. 이 순서와 테스트 카드의 효과는 검증용이다.
- 기존 로컬 대국은 기본 규칙을 사용한다. 실제 대국의 카드 풀, 응답 허용·종료 조건과 효과 우선순위는 게임 기획 확정 후 연결한다.

## 후속 범위

3인 대국은 향후 확장 후보다. 턴은 플레이어 ID와 순서 목록을 기준으로 진행한다. 3인 지원을 결정하면 시작 인원수, 재대국 선공 교대, 방어 응답 대상과 순서를 함께 검토한다.

카드 풀과 증강 지급 일정, 공격·방어 세부 사용 시점과 효과 순서, 온라인 서비스는 후속 단계의 결정 사항이다. 2단계에서 카드 획득은 지급 시점까지만 검증한다.

## 2단계 검증 기준

- 인원수가 2명이 아니거나 ID가 중복되면 시작을 거부한다. 두 플레이어의 턴 순서와 라운드 경계를 확인하고 매 턴에 지급 신호가 정확히 한 번 발생하는지 검증한다. 같은 두 사람이 재대국하면 직전 후공이 먼저 시작한다.
- 정상 착수, 다른 플레이어의 착수, 점유 칸, 판 가장자리와 범위 밖·비정수 좌표를 확인한다. 거부된 착수로 판·턴·라운드가 바뀌거나 지급이 다시 발생하면 안 된다.
- 두 모드에서 네 방향의 정확한 길이, 목표 미달, 목표 초과를 검증한다. 5목 모드에서 한 번에 6목, 6목 모드에서 한 번에 7목을 만드는 착수는 허용하고 그 줄로는 승리하지 않는지 확인한다. 마지막 빈칸에서 승리가 성립하면 승리로, 성립하지 않으면 무승부로 종료한다. 종료 후 착수를 거부하고 다음 턴 지급이 발생하지 않는지 확인한다.
