import React, { createContext, useContext, useEffect, useState } from 'react'
import { api, tokenStorage } from '../services/api'
import type { Usuario } from '../types'

interface AuthContextType {
  user: Usuario | null
  loading: boolean
  login: (email: string, senha: string) => Promise<void>
  register: (nome: string, email: string, senha: string) => Promise<void>
  logout: () => Promise<void>
  updateProfile: (data: { nome?: string; email?: string; senhaAtual?: string; novaSenha?: string }) => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<Usuario | null>(() => tokenStorage.getUser())
  const [loading, setLoading] = useState<boolean>(true)

  useEffect(() => {
    const checkAuth = async () => {
      const token = tokenStorage.getAccessToken()
      if (token) {
        try {
          const profile = await api.getMe()
          setUser(profile)
        } catch {
          // If token verification fails and refresh fails, user is cleared
          setUser(null)
        }
      } else {
        setUser(null)
      }
      setLoading(false)
    }

    checkAuth()

    const handleUnauthorized = () => {
      setUser(null)
    }

    window.addEventListener('auth:unauthorized', handleUnauthorized)
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized)
  }, [])

  const login = async (email: string, senha: string) => {
    const res = await api.login({ email, senha })
    setUser(res.user)
  }

  const register = async (nome: string, email: string, senha: string) => {
    const res = await api.register({ nome, email, senha })
    setUser(res.user)
  }

  const logout = async () => {
    await api.logout()
    setUser(null)
  }

  const updateProfile = async (data: { nome?: string; email?: string; senhaAtual?: string; novaSenha?: string }) => {
    const updated = await api.updateProfile(data)
    setUser(updated)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, updateProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider')
  }
  return context
}
