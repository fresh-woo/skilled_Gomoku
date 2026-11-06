import { MenuNavigation } from './design-system/MenuNavigation'
import { LocalGame } from './features/local-game/ui/LocalGame'
import { OnlineGame } from './features/online-game/OnlineGame'
import { SoundControl } from './features/game-sound/SoundControl'
import './design-system/tokens.css'
import './App.css'

const navigationItems = [
  { href: '#welcome', label: '시작 화면' },
  { href: '#local-game', label: '로컬 대국' },
  { href: '#online-game', label: '온라인 대국' },
]

function App() {
  return (
    <>
      <header className="site-header">
        <div className="site-header__inner">
          <a className="site-brand" href="#welcome">
            <svg aria-hidden="true" width="32" height="32" viewBox="0 0 32 32" fill="none">
              <rect width="32" height="32" rx="8" fill="currentColor" />
              <path d="M7 11h18M7 21h18M11 7v18M21 7v18" stroke="var(--color-on-accent)" opacity=".5" />
              <circle cx="11" cy="21" r="3.5" fill="var(--color-on-accent)" />
              <circle cx="21" cy="11" r="3.5" fill="var(--color-accent-pressed)" stroke="var(--color-on-accent)" />
            </svg>
            Skilled Gomoku
          </a>
          <div className="site-header__actions">
            <SoundControl />
            <MenuNavigation label="주 내비게이션" items={navigationItems} />
          </div>
        </div>
      </header>
      <main>
        <div className="welcome" id="welcome" tabIndex={-1}>
          <h1>함께 두는 오목</h1>
          <p className="welcome__intro">한 화면에서 두 사람이 번갈아 돌을 놓습니다.</p>
        </div>
        <OnlineGame />
        <LocalGame />
      </main>
    </>
  )
}

export default App
