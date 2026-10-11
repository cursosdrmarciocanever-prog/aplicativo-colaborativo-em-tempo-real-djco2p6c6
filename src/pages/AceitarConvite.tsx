// src/pages/AceitarConvite.tsx
// Página pública /convite?token=... para aceitar convite da família

import React, { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { Heart, CheckCircle2, AlertCircle, Users, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/AuthContext'
import { aceitarConvite } from '@/services/baby'

export default function AceitarConvite() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const navigate = useNavigate()
  const { user, isAuthenticated } = useAuth()

  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [sucesso, setSucesso] = useState(false)

  useEffect(() => {
    if (!token) {
      setErro('Token de convite não informado.')
    }
  }, [token])

  const handleAceitar = async () => {
    if (!token) return

    if (!isAuthenticated) {
      // Redireciona para o login guardando o token
      navigate(`/?convite=${token}`)
      return
    }

    setLoading(true)
    setErro(null)
    try {
      await aceitarConvite(token)
      setSucesso(true)
      setTimeout(() => {
        navigate('/hoje', { replace: true })
      }, 2000)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Não foi possível aceitar este convite.'
      setErro(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-[460px] mx-auto py-8">
      <div className="bg-card rounded-[24px] p-6 shadow-sm border border-border text-center space-y-4">
        <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center text-primary mx-auto">
          <Users className="w-7 h-7" />
        </div>

        <h1 className="text-xl font-bold text-foreground">Convite da Família da Sarah</h1>

        <p className="text-xs text-muted-foreground leading-relaxed">
          Você foi convidado para acompanhar e colaborar com a rotina da Sarah no app.
        </p>

        {sucesso ? (
          <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 p-4 rounded-2xl text-emerald-800 dark:text-emerald-200 space-y-2">
            <CheckCircle2 className="w-6 h-6 mx-auto text-emerald-600" />
            <p className="text-sm font-bold">Convite aceito com sucesso!</p>
            <p className="text-xs">Redirecionando para o Diário da Sarah...</p>
          </div>
        ) : erro ? (
          <div className="bg-destructive/10 border border-destructive/20 p-4 rounded-2xl text-destructive space-y-2">
            <AlertCircle className="w-6 h-6 mx-auto" />
            <p className="text-sm font-bold">{erro}</p>
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/')}
              className="mt-2 text-xs h-10 rounded-xl"
            >
              Ir para o início
            </Button>
          </div>
        ) : (
          <div className="pt-2 space-y-3">
            <Button
              type="button"
              disabled={loading || !token}
              onClick={handleAceitar}
              className="w-full h-12 rounded-2xl font-bold bg-primary hover:bg-primary/90 text-primary-foreground tap-pop"
            >
              {loading
                ? 'Aceitando convite...'
                : isAuthenticated
                  ? 'Aceitar convite e entrar'
                  : 'Entrar para aceitar convite'}
              <ArrowRight className="w-4 h-4 ml-1.5" />
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
