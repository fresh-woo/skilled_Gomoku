# GitHub와 Render 운영 방법

## 브랜치와 PR

- `main`은 검증된 통합 기준으로 유지한다. 기능은 `feat/...`, 수정은 `fix/...`, 배포 설정은 `chore/...` 브랜치에서 작업한다.
- 변경 단위로 `feat: ...`, `fix: ...`, `docs: ...` 형식으로 커밋하고 PR에서 문제·변경 행동·검증·남은 한계를 설명한다.
- PR에서 CI의 lint, test, build가 성공하고 변경 내용을 확인한 뒤 병합한다. 다른 사람의 미커밋 작업은 보존한다.
- `node_modules`, `dist`, `.env`, 인증 정보는 푸시하지 않는다. Render에서 소스를 받아 새로 설치·빌드한다. 배포 토큰이나 deploy hook URL도 GitHub에 넣지 않는다.

## 첫 시험 배포

사용자가 Render `My Workspace`의 무료 웹 서비스 한 개를 승인했다. DB 없이 메모리로 실행하는 시험 배포다. 서비스는 기존 Node 서버 한 개가 화면과 `/online` WebSocket을 함께 제공한다.

- 런타임: Node 24. 빌드: `npm ci --include=dev && npm run lint && npm test && npm run build`. 시작: `npm run server`.
- 환경: `HOST=0.0.0.0`. 포트는 Render의 `PORT`를 사용한다. 런타임은 검증한 Node 24 버전으로 지정한다.
- 공개 Origin은 Render의 `RENDER_EXTERNAL_URL`로 허용하며 별도 도메인은 `ALLOWED_ORIGINS`에 정확한 Origin을 추가한다.
- `/health`는 상태와 배포 커밋을 JSON으로 반환한다. 배포된 소스 SHA와 대조한다.
- 배포 확인: `npm run verify:online -- https://<실제 호스트> <배포 SHA>`. HTTP 화면·health와 실제 두 WebSocket 연결의 기본/스킬 대국·착수 동기화·비공개 손패·재접속을 검사한다. 토큰은 출력하지 않는다.

실제 서비스/브랜치/URL/배포 결과는 연결이 확인되면 작업 기록에 남긴다. 서비스 생성 응답을 곧바로 배포 성공으로 보고하지 않고 `live`와 공개 주소의 동작을 확인한다.

## 이후 배포 정책

목표 흐름은 `작업 브랜치 → PR → main 병합 → CI 통과 → 자동 배포`다. Render의 연결된 GitHub 공급자 설정에서 `After CI Checks Pass`를 선택하면 된다. 연결된 공급자가 없는 공개 repo URL 기반 서비스는 자동 배포가 지원되지 않으므로 수동 배포하며, 두 방식을 혼동하지 않는다. 실제 설정이 확인되기 전 자동 배포가 켜졌다고 보고하지 않는다.

현재 메모리 상태는 배포·재시작·무료 인스턴스 중지 때 사라진다. 대국 중 자동 배포 영향을 안내하고, 재시작 복구가 중요해지면 게임 상태와 요청 결과의 영속 저장을 다음 작업으로 한다. 공급자 기본의 무중단 배포는 메모리 게임의 승계를 보장하지 않는다.

배포 실패 시 첫 실패 단계의 빌드/런타임 로그를 확인한다. GitHub PR에서 원인을 수정하고 검사를 통과한 새 커밋을 배포한다. 이전 커밋으로 롤백해도 진행 중 대국은 복원되지 않는다.
