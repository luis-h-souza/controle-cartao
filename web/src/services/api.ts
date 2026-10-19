import type { AuthResponse, Cartao, Gasto, ResumoFinanceiro, Usuario } from '../types'

const API_BASE = '/api'

const TOKEN_KEY = 'controle_cartao_access_token'
const REFRESH_TOKEN_KEY = 'controle_cartao_refresh_token'
const USER_KEY = 'controle_cartao_user'

export const tokenStorage = {
  getAccessToken(): string | null {
    return localStorage.getItem(TOKEN_KEY)
  },
  getRefreshToken(): string | null {
    return localStorage.getItem(REFRESH_TOKEN_KEY)
  },
  getUser(): Usuario | null {
    const raw = localStorage.getItem(USER_KEY)
    if (!raw) return null
    try {
      return JSON.parse(raw)
    } catch {
      return null
    }
  },
  setSession(auth: AuthResponse) {
    localStorage.setItem(TOKEN_KEY, auth.accessToken)
    localStorage.setItem(REFRESH_TOKEN_KEY, auth.refreshToken)
    localStorage.setItem(USER_KEY, JSON.stringify(auth.user))
  },
  setTokens(accessToken: string, refreshToken: string) {
    localStorage.setItem(TOKEN_KEY, accessToken)
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken)
  },
  clearSession() {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(REFRESH_TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
  },
}

async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
  const token = tokenStorage.getAccessToken()
  const headers = new Headers(options.headers || {})

  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  let response = await fetch(url, { ...options, headers })

  // If 401 Unauthorized, try to refresh token once
  if (response.status === 401) {
    const refreshToken = tokenStorage.getRefreshToken()
    if (refreshToken) {
      try {
        const refreshRes = await fetch(`${API_BASE}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        })

        if (refreshRes.ok) {
          const data = await refreshRes.json()
          tokenStorage.setTokens(data.accessToken, data.refreshToken)

          // Retry original request with new access token
          headers.set('Authorization', `Bearer ${data.accessToken}`)
          response = await fetch(url, { ...options, headers })
        } else {
          tokenStorage.clearSession()
          window.dispatchEvent(new Event('auth:unauthorized'))
        }
      } catch {
        tokenStorage.clearSession()
        window.dispatchEvent(new Event('auth:unauthorized'))
      }
    }
  }

  return response
}

export const api = {
  // Auth
  async register(data: { nome: string; email: string; senha: string }): Promise<AuthResponse> {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error || 'Falha ao cadastrar')
    }
    const authData: AuthResponse = await res.json()
    tokenStorage.setSession(authData)
    return authData
  },

  async login(data: { email: string; senha: string }): Promise<AuthResponse> {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error || 'E-mail ou senha incorretos')
    }
    const authData: AuthResponse = await res.json()
    tokenStorage.setSession(authData)
    return authData
  },

  async logout(): Promise<void> {
    const refreshToken = tokenStorage.getRefreshToken()
    if (refreshToken) {
      await fetch(`${API_BASE}/auth/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      }).catch(() => {})
    }
    tokenStorage.clearSession()
  },

  async getMe(): Promise<Usuario> {
    const res = await fetchWithAuth(`${API_BASE}/auth/me`)
    if (!res.ok) throw new Error('Não autenticado')
    return res.json()
  },

  async updateProfile(data: {
    nome?: string
    email?: string
    senhaAtual?: string
    novaSenha?: string
  }): Promise<Usuario> {
    const res = await fetchWithAuth(`${API_BASE}/auth/me`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error || 'Falha ao atualizar perfil')
    }
    const updatedUser = await res.json()
    // Update local storage user data
    localStorage.setItem(USER_KEY, JSON.stringify(updatedUser))
    return updatedUser
  },

  // Cartões
  async getCartoes(): Promise<Cartao[]> {
    const res = await fetchWithAuth(`${API_BASE}/cartoes`)
    if (!res.ok) throw new Error('Falha ao buscar cartões')
    return res.json()
  },

  async createCartao(data: {
    nome: string
    bandeira?: string
    cor?: string
    limite: number
    diaFechamento: number
    diaVencimento: number
  }): Promise<Cartao> {
    const res = await fetchWithAuth(`${API_BASE}/cartoes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error || 'Falha ao criar cartão')
    }
    return res.json()
  },

  async updateCartao(id: string, data: {
    nome: string
    bandeira?: string
    cor?: string
    limite: number
    diaFechamento: number
    diaVencimento: number
  }): Promise<Cartao> {
    const res = await fetchWithAuth(`${API_BASE}/cartoes/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error || 'Falha ao atualizar cartão')
    }
    return res.json()
  },

  async deleteCartao(id: string): Promise<void> {
    const res = await fetchWithAuth(`${API_BASE}/cartoes/${id}`, {
      method: 'DELETE',
    })
    if (!res.ok) throw new Error('Falha ao excluir cartão')
  },

  // Gastos
  async getGastos(params?: { cartaoId?: string; categoria?: string }): Promise<Gasto[]> {
    const url = new URL(`${window.location.origin}${API_BASE}/gastos`)
    if (params?.cartaoId && params.cartaoId !== 'TODOS') {
      url.searchParams.set('cartaoId', params.cartaoId)
    }
    if (params?.categoria && params.categoria !== 'TODAS') {
      url.searchParams.set('categoria', params.categoria)
    }

    const res = await fetchWithAuth(url.toString())
    if (!res.ok) throw new Error('Falha ao buscar gastos')
    return res.json()
  },

  async getResumo(cartaoId?: string): Promise<ResumoFinanceiro> {
    const url = new URL(`${window.location.origin}${API_BASE}/gastos/resumo`)
    if (cartaoId && cartaoId !== 'TODOS') {
      url.searchParams.set('cartaoId', cartaoId)
    }
    const res = await fetchWithAuth(url.toString())
    if (!res.ok) throw new Error('Falha ao obter resumo financeiro')
    return res.json()
  },

  async createGasto(data: {
    descricao: string
    valor: number
    categoria: string
    dataCompra: string
    parcelas: number
    parcelaAtual: number
    cartaoId: string
    recorrente?: boolean
  }): Promise<Gasto> {
    const res = await fetchWithAuth(`${API_BASE}/gastos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error || 'Falha ao registrar gasto')
    }
    return res.json()
  },

  async deleteGasto(id: string): Promise<void> {
    const res = await fetchWithAuth(`${API_BASE}/gastos/${id}`, {
      method: 'DELETE',
    })
    if (!res.ok) throw new Error('Falha ao excluir gasto')
  },
}
