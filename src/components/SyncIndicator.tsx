// src/components/SyncIndicator.tsx
// Indicador discreto de sincronização no topo do app

import React from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { CheckCircle2, RefreshCw, WifiOff } from 'lucide-react'

export const SyncIndicator: React.FC = () => {
  const { syncState, triggerSync } = useAuth()

  if (syncState === 'offline') {
    return (
      <button
        onClick={() => triggerSync()}
        className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800 transition-colors"
        title="Sem conexão com a internet. Os registros estão salvos neste aparelho e serão sincronizados ao voltar."
        aria-label="Status de sincronização: Sem conexão, salvo neste aparelho"
      >
        <WifiOff className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
        <span>Sem conexão, salvo neste aparelho</span>
      </button>
    )
  }

  if (syncState === 'syncing') {
    return (
      <div
        className="flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium rounded-full bg-teal-50 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300 border border-teal-200 dark:border-teal-800"
        aria-label="Status de sincronização: Sincronizando..."
      >
        <RefreshCw className="w-3 h-3 text-teal-600 dark:text-teal-400 animate-spin" />
        <span>Sincronizando…</span>
      </div>
    )
  }

  return (
    <div
      className="flex items-center gap-1 px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      title="Todos os registros estão sincronizados em tempo real."
      aria-label="Status de sincronização: Sincronizado"
    >
      <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
      <span className="text-[11px]">Sincronizado</span>
    </div>
  )
}
