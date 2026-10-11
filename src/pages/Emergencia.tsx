// src/pages/Emergencia.tsx
// Entrada de emergência do owner (uso único) enquanto o envio de e-mail não funciona.
// Não há link para esta página no app.

import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { RecordModel } from 'pocketbase'
import { ArrowRight, KeyRound, Mail, ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import pb from '@/lib/pocketbase/client'

export default function Emergencia() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [codigo, setCodigo] = useState('')
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const entrar = async (e: React.FormEvent) => {
    e.preventDefault()
    setErro(null)
    setLoading(true)
    try {
      const res = await pb.send<{ token: string; record: RecordModel }>(
        '/backend/v1/acesso-emergencia',
        { method: 'POST', body: { email: email.trim(), codigo: codigo.trim() } },
      )
      pb.authStore.save(res.token, res.record)
      navigate('/', { replace: true })
    } catch (err: unknown) {
      const msg = (err as { data?: { message?: string } })?.data?.message
      setErro(msg || 'Não foi possível entrar. Confira o e-mail e o código.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-[460px] mx-auto py-8">
      <form
        onSubmit={entrar}
        className="bg-card rounded-[24px] p-6 shadow-sm border border-border space-y-4"
      >
        <div className="text-center space-y-2">
          <div className="w-12 h-12 bg-amber-100 dark:bg-amber-950/60 text-amber-700 rounded-full flex items-center justify-center mx-auto">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold text-foreground">Entrada de emergência</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Para os pais entrarem enquanto o envio de e-mail não funciona. O código vale uma única
            vez.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="email" className="text-sm font-semibold">
            Seu e-mail
          </Label>
          <div className="relative">
            <Mail className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="email"
              type="email"
              autoComplete="email"
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
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              className="pl-11 h-12 rounded-2xl bg-background text-base"
              required
            />
          </div>
          {erro && <p className="text-xs text-destructive font-medium mt-1">{erro}</p>}
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
  )
}
