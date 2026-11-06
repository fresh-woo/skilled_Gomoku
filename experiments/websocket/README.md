# WebSocket 연결 실험

제품 서버가 아닌 폐기 가능한 단일 프로세스 실험이다. 게임 규칙·UI·제품 의존성을 변경하지 않는다. 설계와 미결 사항은 [통신 제안](../../docs/online-transport-proposal.md)을 참고한다.

Node.js 24가 있는 환경에서:

```sh
cd experiments/websocket
npm ci --ignore-scripts
npm test
npm start
```

`npm start`는 `ws://127.0.0.1:8787`에만 바인딩한다. 종료는 Ctrl+C다. 테스트는 임의 포트를 사용하고 종료 시 서버와 소켓을 닫는다. 패키지와 lockfile은 이 폴더에만 둔다. 루트 `npm ci`만으로는 실험 의존성이 설치되지 않는다.

브라우저 개발자 콘솔에서도 표준 API로 연결할 수 있다:

```js
const socket = new WebSocket('ws://127.0.0.1:8787')
socket.onmessage = ({ data }) => {
  const message = JSON.parse(data)
  // session.ready contains a secret. Do not log it.
  if (message.type === 'room.snapshot') console.log(message)
}
socket.onopen = () => socket.send(JSON.stringify({
  v: 1, type: 'room.join', requestId: crypto.randomUUID(), roomId: 'demo',
}))
```

`session.ready`의 `memberId`, `resumeToken`을 메모리에 보관한 뒤 기존 연결을 닫고, 새 소켓에서 `session.resume`에 `roomId`, `resumeToken`, `requestId`, `v: 1`을 보내면 같은 멤버로 최신 `room.snapshot`을 받는다. 활성 연결이 남아 있으면 `SESSION_ACTIVE`다. 실험의 유예 기간은 60초이며 제품의 포기·패배·대기 시간 규칙이 아니다.

## 구현 범위

- 실제 WebSocket 서버와 Node 24 표준 WebSocket 클라이언트의 연결.
- `room.join`, `session.resume`, `ping`; `session.ready`, `room.snapshot`, `pong`, `error`.
- 멤버 참가·연결 종료·재접속 때 방 revision 증가와 전체 멤버 스냅샷 공유. 재접속 시 토큰 소유자 신원 복구. 다른 방과 토큰 격리.
- 비정상 JSON·버전·메시지 종류와 잘못된/만료된 토큰 거부. 크기 4KiB, 방 20개, 방당 실험 멤버 16개 제한. 인원 제한은 게임의 2인 정원과 별개다.
- `contracts.ts`는 후속 게임 연결용 타입 제안이다. 런타임 실험은 게임 명령·게임 스냅샷을 지원하지 않는다.

## 검증과 한계

`npm test`의 두 통합 시나리오는 독립 WebSocket 클라이언트의 방 공유·격리, 끊김 동안 추가된 멤버의 상태 복구, 동일 신원, 활성 세션 충돌, 잘못된 메시지·토큰, 세션 만료를 검사한다. 서로 다른 실제 기기/브라우저, 반쯤 끊긴 TCP, 자동 재시도·백오프, heartbeat, 서버 재시작과 다중 인스턴스는 미검증이다.

방은 첫 참가 시 임시 생성되며 계정·초대 권한·자리·준비·시작·퇴장 계약은 없다. 메모리만 사용해 서버 재시작 시 방과 토큰이 모두 사라진다. 실험은 토큰을 회전하지 않으며 WSS, Origin 검사, 제품 인증, 요청 빈도 제한을 구현하지 않았다. 로컬 연결 확인용이며 외부에 배포하지 않는다. 중복 행동 방지·상태 버전 경쟁·플레이어별 비공개 정보 필터링은 제안만 했고 아직 게임에 연결하지 않았다.
