import { useEffect, useId, useRef, useState } from 'react'
import { Button } from './Button'
import './MenuNavigation.css'

type MenuNavigationProps = {
  label: string
  items: readonly { href: string; label: string }[]
}

export function MenuNavigation({ label, items }: MenuNavigationProps) {
  const [isOpen, setIsOpen] = useState(false)
  const menuId = useId()
  const navRef = useRef<HTMLElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!isOpen) return

    function closeOnOutsidePress(event: PointerEvent) {
      if (event.target instanceof Node && !navRef.current?.contains(event.target)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('pointerdown', closeOnOutsidePress)
    return () => document.removeEventListener('pointerdown', closeOnOutsidePress)
  }, [isOpen])

  return (
    <nav
      ref={navRef}
      className="menu-navigation"
      aria-label={label}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setIsOpen(false)
      }}
      onKeyDown={(event) => {
        if (event.key !== 'Escape' || !isOpen) return
        event.preventDefault()
        setIsOpen(false)
        buttonRef.current?.focus()
      }}
    >
      <Button
        ref={buttonRef}
        variant="secondary"
        aria-expanded={isOpen}
        aria-controls={menuId}
        onClick={() => setIsOpen(!isOpen)}
      >
        <svg aria-hidden="true" width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path
            d={isOpen ? 'm5 5 10 10M15 5 5 15' : 'M3 5h14M3 10h14M3 15h14'}
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
        메뉴
      </Button>
      <ul id={menuId} className="menu-navigation__links" hidden={!isOpen}>
        {items.map((item) => (
          <li key={item.href}>
            <a href={item.href} onClick={() => setIsOpen(false)}>{item.label}</a>
          </li>
        ))}
      </ul>
    </nav>
  )
}
