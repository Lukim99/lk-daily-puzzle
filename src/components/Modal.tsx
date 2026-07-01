import { type PropsWithChildren, useEffect } from 'react'

interface ModalProps extends PropsWithChildren {
  title: string
  eyebrow?: string
  onClose?: () => void
}

export function Modal({ title, eyebrow, onClose, children }: ModalProps) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose?.()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <div className='modal-backdrop' role='presentation' onMouseDown={onClose}>
      <section
        className='modal puzzle-cut'
        role='dialog'
        aria-modal='true'
        aria-labelledby='modal-title'
        onMouseDown={(event) => event.stopPropagation()}
      >
        {onClose && <button className='icon-button modal-close' onClick={onClose} aria-label='닫기'>×</button>}
        {eyebrow && <p className='eyebrow'>{eyebrow}</p>}
        <h2 id='modal-title'>{title}</h2>
        {children}
      </section>
    </div>
  )
}
