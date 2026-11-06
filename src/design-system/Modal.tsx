import { useEffect, useId, useRef } from 'react'
import type { ReactNode } from 'react'
import { Button } from './Button'
import './game-ui.css'

type ModalProps = {
  title: string
  description?: string
  tone?: 'victory'
  children: ReactNode
  actions?: ReactNode
  onDismiss: () => void
}

export function Modal({ title, description, tone, children, actions, onDismiss }: ModalProps) {
  const dialog = useRef<HTMLDialogElement>(null)
  const id = useId()

  useEffect(() => {
    const element = dialog.current
    const previousFocus = document.activeElement
    element?.showModal()

    return () => {
      element?.close()
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus()
    }
  }, [])

  return (
    <dialog
      ref={dialog}
      className="game-modal"
      data-tone={tone}
      aria-labelledby={id}
      aria-describedby={description ? `${id}-description` : undefined}
      onCancel={(event) => { event.preventDefault(); onDismiss() }}
    >
      <header className="game-modal__header">
        <div className="game-modal__heading">
          {tone === 'victory' && (
            <svg className="game-modal__trophy" aria-hidden="true" width="48" height="48" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 3h10v5a5 5 0 0 1-10 0V3ZM7 5H3v2a4 4 0 0 0 4 4m10-6h4v2a4 4 0 0 1-4 4m-5 2v5m-4 3h8m-7 0v-1a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1" />
            </svg>
          )}
          <h2 id={id}>{title}</h2>
          {description && <p id={`${id}-description`}>{description}</p>}
        </div>
        <Button className="game-modal__close" variant="secondary" aria-label="닫기" onClick={onDismiss} autoFocus>
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 18 18">
            <path d="m4 4 10 10M14 4 4 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </Button>
      </header>
      <div className="game-modal__body">{children}</div>
      {actions && <footer className="game-modal__actions">{actions}</footer>}
    </dialog>
  )
}
