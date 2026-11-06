# Skilled Gomoku

React와 TypeScript로 만드는 턴제 오목 게임입니다. 브라우저에서 로컬 또는 온라인 2인 대국을 플레이할 수 있습니다.

[온라인 대국 실행](https://skilled-gomoku.onrender.com/#online-game)에서 방을 만들고 상대에게 방 코드를 전달하세요. 무료 시험 서버로 첫 접속이 지연될 수 있으며 서버 재시작 시 진행 중 대국은 사라집니다.

## 시작하기

Node.js 24와 npm을 사용합니다 (`.nvmrc` 참고). 저장소를 받은 뒤 실행하세요.

```bash
npm ci
npm run dev
```

터미널에 표시된 주소를 열고 5목 또는 6목을 선택한 뒤 **대국 시작**을 누릅니다. 빈 교차점을 클릭하거나 방향키로 이동해 Enter 또는 Space를 눌러 착수합니다. **새 대국**을 누르면 판이 비워지고 선공이 바뀝니다.

로컬 대국은 기본 오목으로 진행합니다. 온라인에서는 방을 만들 때 **기본 대국** 또는 **스킬 대국**을 고를 수 있습니다. 스킬 대국에서는 저격·무효화·보호막과 무장해제·손패 복구를 같은 판에서 사용합니다. 판 위에 내 턴과 상대 턴을 표시하고, 방어할 수 있을 때는 손패로 이동할 수 있습니다. 온라인 대국의 **카드 도감 · 35장**에서 카드 삽화와 효과를 볼 수 있습니다.

주요 검사 명령입니다.

```bash
npm run lint       # 정적 검사
npm test           # 오목 규칙, 로컬 세션과 온라인 통합 검사
npm run build      # 타입 검사와 프로덕션 빌드
npm run preview    # 빌드 결과 확인 (먼저 build 실행)
```

## 구조와 작업 기록

가벼운 FSD 구조를 지향하며 실제 필요에 따라 `pages`, `widgets`, `features`, `entities`, `shared`를 추가합니다. 공통 디자인 토큰과 컴포넌트는 `src/design-system`에서 관리합니다. 게임 규칙, 화면, 네트워크 코드는 분리합니다.

기본 규칙은 `src/entities/game`에 있고, 로컬 세션과 대국 화면은 `src/features/local-game`에서 연결합니다.

- [AGENTS.md](AGENTS.md): 채팅 간 공통 작업 원칙
- [게임 기획](docs/game-spec.md): 게임 방향과 미확정 사항
- [개발 로드맵](docs/development-roadmap.md): 단계별 개발 순서와 개발 채팅 전달 내용
- [온라인 협업 가이드](docs/online-collaboration.md): 동료와의 역할, WebSocket 검토 및 통합 순서
- [온라인 통신 제안](docs/online-transport-proposal.md): 기술 선택지, 서버 상태·규칙 경계와 메시지 초안
- [디자인 시스템](docs/design-system.md): 디자인·개발 작업 경계와 UI 기준
- [작업 기록](docs/work-log.md): 현재 상태, 검증 및 다음 작업
- [설계 결정](docs/decisions.md): 주요 결정과 미확정 사항

## 커밋 규칙

기능 추가나 버그 수정 등 **하나의 목적을 가진 변경 단위**로 커밋합니다. 제목은 `종류: 변경 내용`으로 작성하며 한국어 또는 영어를 사용할 수 있습니다.

| 종류 | 용도 | 예시 |
| --- | --- | --- |
| `feat` | 기능 추가 | `feat: 대기방 참가 기능 추가` |
| `fix` | 버그 수정 | `fix: 턴이 중복 진행되는 문제 수정` |
| `refactor` | 동작 변경 없는 구조 개선 | `refactor: 게임 상태 로직 분리` |
| `style` | 동작에 영향을 주지 않는 서식 변경 | `style: 코드 형식 정리` |
| `design` | UI 및 시각 디자인 변경 | `design: 버튼 상태 스타일 추가` |
| `docs` | 문서 변경 | `docs: 실행 방법 보완` |
| `test` | 테스트 추가·수정 | `test: 승리 판정 검사 추가` |
| `chore` | 설정·의존성 등 기타 작업 | `chore: 초기 프로젝트 설정` |
| `ci` | 자동 검사·배포 설정 | `ci: 빌드 검사 추가` |

커밋 전 변경 내용을 확인하고 영향 범위에 맞는 검사를 실행합니다. 브랜치를 합치기 전에는 최신 변경과 충돌 여부, 빌드 결과를 확인하고 충돌이 발생하면 양쪽 변경 의도를 살펴 해결합니다. 비밀 키와 개인 정보는 커밋하지 않습니다.

## 온라인 기능

GitHub 브랜치·PR와 배포 운영 절차는 [GitHub와 Render 운영 방법](docs/github-and-deployment.md)을 참고합니다. 공개 배포의 상태와 커밋은 `/health`에서 확인하고, `npm run verify:online -- https://<실제 호스트> <배포 SHA>`로 통신을 검증할 수 있습니다.

온라인 2인 기본/스킬 테스트 대국을 사용할 수 있습니다. `npm run build` 후 `npm run server`를 실행하고 `http://127.0.0.1:8787/#online-game`에서 방을 만든 뒤 다른 탭/브라우저가 방 코드로 참가합니다. 개발 중에는 `npm run dev`도 별도 터미널에서 실행합니다. 다른 기기 접속, 재접속 범위와 서버 설정은 [온라인 실행 가이드](docs/online-play.md)를 참고하세요. 계정·DB 없이 실행되며 서버 재시작 시 대국은 사라집니다.

직접 운영하는 서버는 최소화할 예정입니다. 온라인 플레이에는 상태를 공유할 서비스가 필요하며, Supabase 등 관리형 서비스 사용 여부와 턴 검증 방식은 게임 기획을 확인한 뒤 결정합니다. 클라이언트 환경 변수에 비밀 키를 넣지 않습니다.

게임과 분리된 로컬 WebSocket 연결 실험은 [experiments/websocket](experiments/websocket/README.md)에 있습니다. Node.js 24에서 해당 폴더로 이동해 `npm ci --ignore-scripts`, `npm test`를 실행합니다. 제품 라이브러리·호스팅·DB를 확정한 구현은 아닙니다.
