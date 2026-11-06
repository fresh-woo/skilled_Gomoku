import './lobby.css'

const stones = [
  [5, 6, 'black'], [6, 6, 'black'], [7, 6, 'black'], [8, 6, 'black'],
  [5, 5, 'white'], [6, 7, 'white'], [7, 5, 'white'], [8, 7, 'white'],
  [4, 8, 'black'], [9, 4, 'white'],
] as const

function NeonBoard() {
  return <div className="neon-scene" aria-hidden="true">
    <div className="neon-scene__orbit" />
    <div className="neon-scene__board">
      <svg viewBox="0 0 480 480" fill="none">
        <defs>
          <radialGradient id="lobby-black" cx="30%" cy="20%"><stop stopColor="#525f79" /><stop offset="1" stopColor="#0d1528" /></radialGradient>
          <radialGradient id="lobby-white" cx="30%" cy="20%"><stop stopColor="#fff" /><stop offset="1" stopColor="#b6c6df" /></radialGradient>
          <filter id="lobby-glow"><feGaussianBlur stdDeviation="5" /></filter>
        </defs>
        <rect x="2" y="2" width="476" height="476" rx="24" fill="#101c31" stroke="#3b5476" />
        {Array.from({ length: 15 }, (_, i) => <path key={i} d={`M${44 + i * 28} 44v392M44 ${44 + i * 28}h392`} stroke="#31435e" strokeWidth="1" />)}
        {[3, 7, 11].flatMap(x => [3, 7, 11].map(y => <circle key={`${x}-${y}`} cx={44 + x * 28} cy={44 + y * 28} r="2.5" fill="#627596" />))}
        <path d="M184 212h112" stroke="#51f5dc" strokeWidth="13" opacity=".5" filter="url(#lobby-glow)" />
        <path d="M184 212h112" stroke="#51f5dc" strokeWidth="2" />
        {stones.map(([x, y, side]) => <g key={`${x}-${y}`}>
          <ellipse cx={46 + x * 28} cy={49 + y * 28} rx="13" ry="12" fill="#030917" opacity=".6" />
          <circle cx={44 + x * 28} cy={44 + y * 28} r="12" fill={`url(#lobby-${side})`} stroke={side === 'black' ? '#70829d' : '#edf4ff'} />
        </g>)}
        <circle cx="296" cy="212" r="13" stroke="#51f5dc" strokeWidth="2" strokeDasharray="4 4" />
        <path d="M288 212h16m-8-8v16" stroke="#51f5dc" />
      </svg>
    </div>
    <div className="neon-scene__skill neon-scene__skill--attack">
      <span>ATTACK / 01</span>
      <svg viewBox="0 0 80 80" fill="none"><circle cx="40" cy="40" r="22" stroke="currentColor" strokeWidth="2" /><path d="M40 10v60M10 40h60m-38-8 16 16m0-16L32 48" stroke="currentColor" strokeWidth="2" /></svg>
      <strong>저격</strong>
    </div>
    <div className="neon-scene__skill neon-scene__skill--defense">
      <span>DEFENSE / 02</span>
      <svg viewBox="0 0 80 80" fill="none"><path d="m40 10 25 12v22c0 13-25 27-25 27S15 57 15 44V22Z" stroke="currentColor" strokeWidth="2" /><path d="m28 39 9 9 17-20" stroke="currentColor" strokeWidth="2" /></svg>
      <strong>보호막</strong>
    </div>
    <div className="neon-scene__caption"><span /> THE NEXT MOVE IS YOURS</div>
  </div>
}

export function Lobby() {
  return <section className="neon-lobby" id="welcome" aria-labelledby="lobby-title" tabIndex={-1}>
    <div className="neon-lobby__inner">
      <div className="neon-lobby__copy">
        <p className="neon-lobby__eyebrow"><span /> CLASSIC BOARD. NEW STRATEGY.</p>
        <h1 id="lobby-title">한 수 너머의<br /><em>전략.</em></h1>
        <p className="neon-lobby__intro">익숙한 오목에, 판을 바꾸는 스킬 한 장.<br />돌을 놓고, 기회를 만들고, 다음 수를 뒤집으세요.</p>
        <div className="neon-lobby__actions">
          <a className="neon-lobby__play" href="#online-game">온라인 대국 <span aria-hidden="true">↗</span></a>
          <a className="neon-lobby__local" href="#local-game">로컬 2인 대국 <span aria-hidden="true">→</span></a>
        </div>
        <p className="neon-lobby__hint">방을 만들거나, 친구의 방 코드로 참가하세요.</p>
        <div className="neon-lobby__facts"><span><b>2</b> PLAYERS</span><span><b>5 / 6</b> IN A ROW</span><span><b>4</b> SKILLS</span></div>
      </div>
      <NeonBoard />
    </div>
    <div className="neon-lobby__footer"><span>BLACK × WHITE <i /> YOUR STRATEGY</span><a href="#online-game">대국 준비하기 <span aria-hidden="true">↓</span></a></div>
  </section>
}
