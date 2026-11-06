import { useEffect, useId, useRef } from 'react'
import type { ReactNode } from 'react'
import { Button } from './Button'
import './game-ui.css'

type ModalProps = {
  title: string
  description?: string
  children: ReactNode
  actions?: ReactNode
  onDismiss: () => void
}

export function Modal({ title, description, children, actions, onDismiss }: ModalProps) {
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
      aria-labelledby={id}
      aria-describedby={description ? `${id}-description` : undefined}
      onCancel={(event) => { event.preventDefault(); onDismiss() }}
    >
      <header className="game-modal__header">
        <div>
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
