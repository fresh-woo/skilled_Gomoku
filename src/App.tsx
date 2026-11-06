import { useState } from 'react'
import { Button } from './design-system/Button'
import { MenuNavigation } from './design-system/MenuNavigation'
import { GamePreview } from './game-preview/GamePreview'
import { LocalGame } from './features/local-game/ui/LocalGame'
import { OnlineGame } from './features/online-game/OnlineGame'
import './design-system/tokens.css'
import './App.css'

const navigationItems = [
  { href: '#welcome', label: '시작 화면' },
  { href: '#game-preview', label: '대국 미리보기' },
  { href: '#local-game', label: '로컬 대국' },
  { href: '#online-game', label: '온라인 대국' },
  { href: '#preview-button', label: '디자인 미리보기' },
]

function App() {
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)

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
          <MenuNavigation label="주 내비게이션" items={navigationItems} />
        </div>
      </header>
      <main>
        <div className="welcome" id="welcome" tabIndex={-1}>
          <h1>함께 두는 오목</h1>
          <p className="welcome__intro">한 화면에서 두 사람이 번갈아 돌을 놓습니다.</p>
          <div className="welcome__actions">
            <a className="button button--primary" href="#game-preview">대국 미리보기</a>
            <Button
              variant="secondary"
              id="preview-button"
              aria-expanded={isPreviewOpen}
              aria-controls="design-preview"
              onClick={() => setIsPreviewOpen(!isPreviewOpen)}
            >
              {isPreviewOpen ? '미리보기 닫기' : '디자인 미리보기'}
              <svg aria-hidden="true" width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path
                  d={isPreviewOpen ? 'm4.5 11 4.5-4.5 4.5 4.5' : 'm4.5 7 4.5 4.5L13.5 7'}
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </Button>
          </div>
          <section className="design-preview" id="design-preview" aria-labelledby="preview-title" hidden={!isPreviewOpen}>
            <h2 id="preview-title">버튼 상태</h2>
            <p>위 버튼에 마우스를 올리거나 Tab 키로 이동해 스타일을 확인해 보세요.</p>
            <Button disabled>비활성 버튼</Button>
          </section>
          <LocalGame />
          <OnlineGame />
        </div>
        <GamePreview />
      </main>
    </>
  )
}

export default App
