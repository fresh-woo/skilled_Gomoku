import type { ComponentPropsWithRef } from 'react'
import './Button.css'

type ButtonProps = ComponentPropsWithRef<'button'> & {
  variant?: 'primary' | 'secondary'
}

export function Button({
  variant = 'primary',
  type = 'button',
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      type={type}
      className={['button', `button--${variant}`, className].filter(Boolean).join(' ')}
    />
  )
}
