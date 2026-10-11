// src/contexts/AuthContext.tsx
// Gerenciamento global de autenticação com PocketBase

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import type { RecordModel } from 'pocketbase'
import pb from '@/lib/pocketbase/client'
import { processarFilaOffline } from '@/services/baby'

export type SyncState = 'synced' | 'syncing' | 'offline'

interface AuthContextType {
  user: RecordModel | null
  isAuthenticated: boolean
  isLoading: boolean
  syncState: SyncState
  solicitarCodigo: (email: string) => Promise<string>
  entrarComCodigo: (otpId: string, codigo: string) => Promise<void>
  salvarNome: (nome: string) => Promise<void>
  logout: () => void
  refreshUser: () => void
  triggerSync: () => Promise<void>
}

function novaSenhaDescartavel(): string {
  const bytes = new Uint8Array(24)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<RecordModel | null>(pb.authStore.record)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [syncState, setSyncState] = useState<SyncState>(navigator.onLine ? 'synced' : 'offline')

  const triggerSync = useCallback(async () => {
    if (!navigator.onLine) {
      setSyncState('offline')
      return
    }
    setSyncState('syncing')
    try {
      await processarFilaOffline()
      setSyncState('synced')
    } catch {
      setSyncState('offline')
    }
  }, [])

  useEffect(() => {
    // Inscrever em mudanças no authStore
    const unsubscribe = pb.authStore.onChange((token, model) => {
      setUser(model)
    })

    // Detectar status de rede online/offline
    const handleOnline = () => {
      triggerSync()
    }

    const handleOffline = () => {
      setSyncState('offline')
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Tentar refrescar auth se existir token
    if (pb.authStore.isValid) {
      pb.collection('users')
        .authRefresh()
        .then((res) => {
          setUser(res.record)
        })
        .catch((err: unknown) => {
          // Apenas limpa a sessão se o backend responder com 401/403 explícito
          // Erros transitórios de rede (status 0, timeout) NÃO devem deslogar o usuário em um PWA offline-first
          const status = (err as { status?: number })?.status || 0
          if (status === 401 || status === 403) {
            console.warn('Sessão expirada no servidor PocketBase:', err)
            pb.authStore.clear()
            setUser(null)
          } else {
            console.warn('Falha transitória no authRefresh (mantendo sessão local):', err)
            // Mantém usuário atual gravado no authStore para funcionamento offline
            setUser(pb.authStore.record)
          }
        })
        .finally(() => {
          setIsLoading(false)
          triggerSync()
        })
    } else {
      setIsLoading(false)
    }

    return () => {
      unsubscribe()
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [triggerSync])

  // Login sem senha: o PocketBase envia um código de uso único (OTP) por e-mail.
  // Quem ainda não tem conta ganha uma com senha aleatória (o login por senha fica desativado).
  const solicitarCodigo = async (email: string): Promise<string> => {
    const cleanEmail = email.trim().toLowerCase()
    const senha = novaSenhaDescartavel()
    try {
      await pb
        .collection('users')
        .create({ email: cleanEmail, password: senha, passwordConfirm: senha })
    } catch {
      // Já existe conta para este e-mail: segue para o código.
    }
    const { otpId } = await pb.collection('users').requestOTP(cleanEmail)
    return otpId
  }

  const entrarComCodigo = async (otpId: string, codigo: string) => {
    const res = await pb.collection('users').authWithOTP(otpId, codigo)
    setUser(res.record)
  }

  const salvarNome = async (nome: string) => {
    const atual = pb.authStore.record
    if (!atual) throw new Error('Não autenticado')
    const atualizado = await pb.collection('users').update(atual.id, { name: nome })
    pb.authStore.save(pb.authStore.token, atualizado)
    setUser(atualizado)
  }

  const logout = () => {
    pb.authStore.clear()
    setUser(null)
  }

  const refreshUser = () => {
    setUser(pb.authStore.record)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        syncState,
        solicitarCodigo,
        entrarComCodigo,
        salvarNome,
        logout,
        refreshUser,
        triggerSync,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider')
  }
  return context
}
