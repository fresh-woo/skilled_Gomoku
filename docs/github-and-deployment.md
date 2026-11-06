# GitHub와 Render 운영 방법

## 브랜치와 PR

- `main`은 검증된 통합 기준으로 유지한다. 기능은 `feat/...`, 수정은 `fix/...`, 배포 설정은 `chore/...` 브랜치에서 작업한다.
- 변경 단위로 `feat: ...`, `fix: ...`, `docs: ...` 형식으로 커밋하고 PR에서 문제·변경 행동·검증·남은 한계를 설명한다.
- PR에서 CI의 lint, test, build가 성공하고 변경 내용을 확인한 뒤 병합한다. 다른 사람의 미커밋 작업은 보존한다.
- `node_modules`, `dist`, `.env`, 인증 정보는 푸시하지 않는다. Render에서 소스를 받아 새로 설치·빌드한다. 배포 토큰이나 deploy hook URL도 GitHub에 넣지 않는다.

## 첫 시험 배포

2026-11-07 배포 결과:

| 항목 | 실제 설정 |
| --- | --- |
| 공개 주소 | [Skilled Gomoku](https://skilled-gomoku.onrender.com/#online-game) |
| 상태/소스 확인 | [health](https://skilled-gomoku.onrender.com/health) |
| 서비스 관리 | [Render Dashboard](https://dashboard.render.com/web/srv-dbn116u1egvs73dqa75g) |
| 워크스페이스/플랜 | My Workspace / free / 싱가포르 / 단일 인스턴스 |
| 배포 소스 | `fresh-woo/skilled_Gomoku`의 `main` |
| 최초 공개 검증 커밋 | `c69582679fdc2ad4c772c6fa9add9321a3c8ec45` ([PR #4](https://github.com/fresh-woo/skilled_Gomoku/pull/4)) |
| Node | 24.22.2 |
| 자동 배포 설정 | 메타데이터는 `autoDeploy=yes`, `autoDeployTrigger=commit`. 실제 push 트리거는 아래 검증 결과 참고 |
| 플랫폼 상태 확인 | 기본 TCP 검사. HTTP `/health`는 별도로 공개 검증 |

최초 배포가 Render에서 `live`가 된 뒤 공개 HTTPS 화면/health와 기본·스킬 WSS 대국의 두 클라이언트 착수 동기화, 손패 분리와 재접속 검증을 통과했다. GitHub main CI와 Render 빌드 안의 lint·테스트 34개·빌드도 성공했다.

사용자가 Render `My Workspace`의 무료 웹 서비스 한 개를 승인했다. DB 없이 메모리로 실행하는 시험 배포다. 서비스는 기존 Node 서버 한 개가 화면과 `/online` WebSocket을 함께 제공한다.

- 런타임: Node 24. 빌드: `npm ci --include=dev && npm run lint && npm test && npm run build`. 시작: `npm run server`.
- 환경: `HOST=0.0.0.0`. 포트는 Render의 `PORT`를 사용한다. 런타임은 검증한 Node 24 버전으로 지정한다.
- 공개 Origin은 Render의 `RENDER_EXTERNAL_URL`로 허용하며 별도 도메인은 `ALLOWED_ORIGINS`에 정확한 Origin을 추가한다.
- `/health`는 상태와 배포 커밋을 JSON으로 반환한다. 배포된 소스 SHA와 대조한다.
- 배포 확인: `npm run verify:online -- https://<실제 호스트> <배포 SHA>`. HTTP 화면·health와 실제 두 WebSocket 연결의 기본/스킬 대국·착수 동기화·비공개 손패·재접속을 검사한다. 토큰은 출력하지 않는다.

서비스 생성 응답을 곧바로 배포 성공으로 보고하지 않고 매번 `live`와 공개 주소의 동작을 확인한다. 최신 실행 커밋은 `/health`가 반환하는 값이 기준이다.

## 이후 배포 정책

목표 흐름은 `작업 브랜치 → PR CI 성공 확인 → main 병합 → Render 빌드·검사 → 배포`다. Render 빌드 명령 안에서도 lint·test·build를 실행하므로 검사 실패 시 새 버전을 배포하지 않는다. Render 자체의 `After CI Checks Pass` 대기 모드와는 다르다.

실제 검증에서는 [PR #5](https://github.com/fresh-woo/skilled_Gomoku/pull/5)를 CI 통과 후 main에 병합했지만 배포 목록에 새로운 Git push 기반 배포가 생성되지 않았다. 메타데이터가 자동 배포로 표시되는 것만으로 자동 반영을 보장하지 않는다. 현재 공개 서비스는 최초의 `c695826` 버전이고, 이후 main 변경은 배포 결과/운영 문서뿐이며 게임 코드는 동일하다.

GitHub 변경을 계속 반영하려면 Render Dashboard에서 Git 공급자·해당 레포 연결과 자동 배포 설정을 확인한다. 연결 완료 전에는 main 병합 후 서비스의 **Manual Deploy → Deploy latest commit**으로 반영하고 `/health` SHA와 공개 검증을 확인한다. 해당 대시보드 설정과 Git 공급자 연결은 아직 미완료다.

CI 대기 모드와 플랫폼의 HTTP `/health` 경로를 설정하려면 위 Render Dashboard의 Settings에서 수정한다. 현재 연결 도구는 해당 설정을 지원하지 않으며 대시보드는 별도 로그인이 필요해 이 두 설정은 변경하지 않았다. 자동 배포 설정 값과 실제 Git push 트리거 결과도 구분해 확인한다. Git 공급자 연결이 없는 공개 URL 기반 서비스는 수동 배포가 필요할 수 있다.

현재 메모리 상태는 배포·재시작·무료 인스턴스 중지 때 사라진다. 대국 중 자동 배포 영향을 안내하고, 재시작 복구가 중요해지면 게임 상태와 요청 결과의 영속 저장을 다음 작업으로 한다. 공급자 기본의 무중단 배포는 메모리 게임의 승계를 보장하지 않는다.

배포 실패 시 첫 실패 단계의 빌드/런타임 로그를 확인한다. GitHub PR에서 원인을 수정하고 검사를 통과한 새 커밋을 배포한다. 이전 커밋으로 롤백해도 진행 중 대국은 복원되지 않는다.
