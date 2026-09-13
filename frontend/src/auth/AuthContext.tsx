import { createContext, use, useCallback, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { api, getToken, setToken } from '../api/client'
import type { CurrentUser } from '../types'

interface AuthContextValue {
  user: CurrentUser | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null)
  const [loading, setLoading] = useState(true)

  const refreshUser = useCallback(async () => {
    if (!getToken()) {
      setUser(null)
      return
    }
    try {
      const current = await api.get<CurrentUser>('/users/me')
      setUser(current)
    } catch {
      setToken(null)
      setUser(null)
    }
  }, [])

  useEffect(() => {
    refreshUser().finally(() => setLoading(false))
  }, [refreshUser])

  const login = useCallback(async (email: string, password: string) => {
    const result = await api.post<{ accessToken: string }>('/auth/login', { email, password })
    setToken(result.accessToken)
    await refreshUser()
  }, [refreshUser])

  const logout = useCallback(() => {
    setToken(null)
    setUser(null)
  }, [])

  return <AuthContext value={{ user, loading, login, logout, refreshUser }}>{children}</AuthContext>
}

export function useAuth(): AuthContextValue {
  const context = use(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
