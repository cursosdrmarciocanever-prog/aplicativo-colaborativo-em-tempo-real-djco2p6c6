// src/pages/Emergencia.tsx
// Entrada de emergência para o owner entrar no app enquanto o envio de e-mail (SMTP) não funciona

import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { KeyRound, Mail, ArrowRight, ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import pb from '@/lib/pocketbase/client'
import type { RecordModel } from 'pocketbase'

interface AuthEmergencyResponse {
  token: string
  record: RecordModel
  [key: string]: unknown
}

export default function Emergencia() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [codigo, setCodigo] = useState('')
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErro(null)

    const emailLimpo = email.trim().toLowerCase()
    const codigoLimpo = codigo.trim()

    if (!emailLimpo || !codigoLimpo) {
      setErro('Preencha o e-mail e o código de emergência.')
      return
    }

    setLoading(true)
    try {
      const res = await pb.send<AuthEmergencyResponse>('/backend/v1/acesso-emergencia', {
        method: 'POST',
        body: { email: emailLimpo, codigo: codigoLimpo },
      })

      if (res?.token && res?.record) {
        pb.authStore.save(res.token, res.record)
        navigate('/', { replace: true })
      } else {
        setErro('Resposta inválida do servidor. Tente novamente.')
      }
    } catch (err: unknown) {
      const pbErr = err as { data?: { message?: string }; message?: string }
      const mensagem =
        pbErr?.data?.message ||
        pbErr?.message ||
        'Código de emergência inválido, usado ou expirado.'
      setErro(mensagem)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-center justify-center w-full py-6">
      {/* Logotipo e acolhimento */}
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-amber-500/10 rounded-3xl flex items-center justify-center mx-auto mb-4 text-amber-600 shadow-sm border border-amber-500/20">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
          Entrada de emergência
        </h1>
        <p className="text-muted-foreground text-sm mt-2 max-w-[320px] mx-auto">
          Acesso reservado ao proprietário enquanto o serviço de e-mail estiver temporariamente
          indisponível.
        </p>
      </div>

      {/* Cartão de autenticação */}
      <div className="w-full bg-card rounded-[24px] p-6 shadow-sm border border-border">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-sm font-semibold">
              Seu e-mail
            </Label>
            <div className="relative">
              <Mail className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="marciocanever@hotmail.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-11 h-12 rounded-2xl bg-background text-base"
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="codigo" className="text-sm font-semibold">
              Código de emergência
            </Label>
            <div className="relative">
              <KeyRound className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="codigo"
                type="text"
                autoComplete="off"
                placeholder="Insira o código de emergência"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                className="pl-11 h-12 rounded-2xl bg-background text-sm font-mono"
                required
              />
            </div>
            {erro && <p className="text-xs text-destructive font-medium mt-1">{erro}</p>}
          </div>

          <div className="bg-muted/50 rounded-2xl p-3 text-xs text-muted-foreground">
            Este código é de uso único e possui validade limitada. Após a entrada, a sessão do
            proprietário será restaurada normalmente.
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full h-12 rounded-2xl text-base font-bold bg-primary hover:bg-primary/90 text-primary-foreground flex items-center justify-center gap-2 tap-pop"
          >
            <span>{loading ? 'Entrando...' : 'Entrar'}</span>
            <ArrowRight className="w-4 h-4" />
          </Button>
        </form>
      </div>
    </div>
  )
}
