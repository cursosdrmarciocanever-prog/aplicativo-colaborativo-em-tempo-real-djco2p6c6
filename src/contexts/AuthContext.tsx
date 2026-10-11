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
  loginMagicLink: (email: string) => Promise<void>
  logout: () => void
  refreshUser: () => void
  triggerSync: () => Promise<void>
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

  const loginMagicLink = async (email: string) => {
    const cleanEmail = email.trim().toLowerCase()
    // PocketBase email passwordless reset / verificação de email
    await pb.collection('users').requestPasswordReset(cleanEmail)
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
        loginMagicLink,
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
