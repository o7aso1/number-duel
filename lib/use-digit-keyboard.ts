'use client'

import { useEffect, useRef } from 'react'

type DigitKeyboardOptions = {
  enabled: boolean
  maxLength: number
  value: string
  onChange: (next: string) => void
  onSubmit?: () => void
}

/** Laptop/desktop: type digits 0–9, Backspace/Delete, Enter to submit. */
export function useDigitKeyboard({
  enabled,
  maxLength,
  value,
  onChange,
  onSubmit,
}: DigitKeyboardOptions) {
  const valueRef = useRef(value)
  const onChangeRef = useRef(onChange)
  const onSubmitRef = useRef(onSubmit)

  valueRef.current = value
  onChangeRef.current = onChange
  onSubmitRef.current = onSubmit

  useEffect(() => {
    if (!enabled) return

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return

      const target = e.target as HTMLElement | null
      if (target) {
        const tag = target.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
        if (target.isContentEditable) return
      }

      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault()
        const current = valueRef.current
        if (current.length >= maxLength) return
        onChangeRef.current(current + e.key)
        return
      }

      if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault()
        onChangeRef.current(valueRef.current.slice(0, -1))
        return
      }

      if (e.key === 'Enter') {
        e.preventDefault()
        onSubmitRef.current?.()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [enabled, maxLength])
}
