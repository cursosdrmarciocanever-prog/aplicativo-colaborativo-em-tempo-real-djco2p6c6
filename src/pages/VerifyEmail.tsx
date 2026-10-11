// src/pages/VerifyEmail.tsx
// Rota pública /verify-email para confirmação de magic-link ou reset

import React, { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { CheckCircle2, AlertCircle, Heart } from 'lucide-react'
import { Button } from '@/components/ui/button'
import pb from '@/lib/pocketbase/client'

export default function VerifyEmail() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    if (!token) {
      setLoading(false)
      return
    }

    // Tentar confirmar verificação
    pb.collection('users')
      .confirmVerification(token)
      .then(() => {
        setLoading(false)
        setTimeout(() => navigate('/hoje'), 2000)
      })
      .catch((err) => {
        setErro('O link expirou ou já foi utilizado.')
        setLoading(false)
      })
  }, [token, navigate])

  return (
    <div className="w-full max-w-[420px] mx-auto py-8 text-center bg-card rounded-[24px] p-6 border border-border shadow-sm space-y-4">
      <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center text-primary mx-auto">
        <Heart className="w-7 h-7 fill-primary" />
      </div>

      <h1 className="text-xl font-bold text-foreground">Diário da Sarah</h1>

      {loading ? (
        <p className="text-sm text-muted-foreground">Validando seu link de acesso...</p>
      ) : erro ? (
        <div className="space-y-3">
          <p className="text-sm text-destructive font-medium">{erro}</p>
          <Button onClick={() => navigate('/')} className="h-11 rounded-2xl w-full">
            Voltar para o login
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
          <p className="text-sm font-semibold text-foreground">Acesso confirmado com sucesso!</p>
          <p className="text-xs text-muted-foreground">Redirecionando...</p>
        </div>
      )}
    </div>
  )
}
