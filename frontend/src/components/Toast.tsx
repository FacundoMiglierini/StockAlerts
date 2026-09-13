import { createContext, use, useCallback, useState } from 'react'
import type { ReactNode } from 'react'
import { CheckCircleIcon, ErrorCircleIcon } from './icons'

type ToastKind = 'success' | 'error'

interface ToastItem {
  id: number
  kind: ToastKind
  message: string
}

interface ToastContextValue {
  showSuccess: (message: string) => void
  showError: (message: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const AUTO_DISMISS_MS = 4000

let nextId = 1

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const push = useCallback(
    (kind: ToastKind, message: string) => {
      const id = nextId++
      setToasts((prev) => [...prev, { id, kind, message }])
      setTimeout(() => dismiss(id), AUTO_DISMISS_MS)
    },
    [dismiss],
  )

  const showSuccess = useCallback((message: string) => push('success', message), [push])
  const showError = useCallback((message: string) => push('error', message), [push])

  return (
    <ToastContext value={{ showSuccess, showError }}>
      {children}
      <div className="toast-stack" role="status" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast toast-${toast.kind}`}>
            {toast.kind === 'success' ? <CheckCircleIcon /> : <ErrorCircleIcon />}
            <span>{toast.message}</span>
            <button type="button" className="toast-dismiss" aria-label="Dismiss" onClick={() => dismiss(toast.id)}>
              &times;
            </button>
          </div>
        ))}
      </div>
    </ToastContext>
  )
}

export function useToast(): ToastContextValue {
  const context = use(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}
