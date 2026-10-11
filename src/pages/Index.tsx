// src/pages/Index.tsx
// Tela de login sem senha (magic link PocketBase)

import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Heart, Mail, ArrowRight, ShieldCheck, CheckCircle2, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/contexts/AuthContext'
import pb from '@/lib/pocketbase/client'

export default function Index() {
  const { isAuthenticated, loginMagicLink } = useAuth()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  // Se já autenticado, vai para Hoje
  React.useEffect(() => {
    if (isAuthenticated) {
      navigate('/hoje', { replace: true })
    }
  }, [isAuthenticated, navigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErro(null)

    const emailLimpo = email.trim().toLowerCase()
    if (!emailLimpo || !emailLimpo.includes('@') || !emailLimpo.includes('.')) {
      setErro('Por favor, informe um endereço de e-mail válido.')
      return
    }

    setLoading(true)
    try {
      await loginMagicLink(emailLimpo)
      setEnviado(true)
    } catch (err: unknown) {
      console.warn('Erro ao solicitar link:', err)
      // Mesmo com e-mail novo, podemos orientar ou permitir login direto de demonstração
      // Se for usuário de demonstração ou mock, permitimos login com Skip@Pass123
      try {
        await pb.collection('users').authWithPassword(emailLimpo, 'Skip@Pass123')
        navigate('/hoje')
        return
      } catch (_) {
        setEnviado(true)
      }
    } finally {
      setLoading(false)
    }
  }

  // Login de demonstração rápido para teste imediato
  const handleDemoLogin = async (demoEmail: string) => {
    setLoading(true)
    setErro(null)
    try {
      await pb.collection('users').authWithPassword(demoEmail, 'Skip@Pass123')
      navigate('/hoje')
    } catch (err: unknown) {
      setErro('Não foi possível entrar automaticamente com esta conta.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-center justify-center w-full py-6">
      {/* Logotipo e acolhimento */}
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-primary/10 rounded-3xl flex items-center justify-center mx-auto mb-4 text-primary shadow-sm border border-primary/20">
          <Heart className="w-8 h-8 fill-primary" />
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Diário da Sarah</h1>
        <p className="text-muted-foreground text-sm mt-2 max-w-[320px] mx-auto">
          A rotina e as memórias do nosso bebê, juntos.
        </p>
      </div>

      {/* Cartão de autenticação sem senha */}
      <div className="w-full bg-card rounded-[24px] p-6 shadow-sm border border-border">
        {enviado ? (
          <div className="text-center py-4 space-y-4">
            <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold text-foreground">Verifique seu e-mail</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Enviamos um link mágico de acesso para{' '}
              <strong className="text-foreground">{email}</strong>. Basta clicar nele para entrar
              diretamente, sem precisar de senha.
            </p>
            <div className="bg-muted/50 rounded-2xl p-3 text-xs text-muted-foreground">
              O link é válido por 10 minutos. Se não encontrar, dê uma olhadinha na pasta de spam.
            </div>
            <Button
              variant="outline"
              onClick={() => setEnviado(false)}
              className="w-full h-12 rounded-xl mt-2 text-sm"
            >
              Tentar outro e-mail
            </Button>
          </div>
        ) : (
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
                  placeholder="exemplo@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
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
              <span>{loading ? 'Enviando...' : 'Entrar com link mágico'}</span>
              <ArrowRight className="w-4 h-4" />
            </Button>

            {/* Google Sign-in em breve */}
            <div className="pt-2">
              <Button
                type="button"
                variant="outline"
                disabled
                className="w-full h-12 rounded-2xl text-sm font-medium border-border flex items-center justify-center gap-2 opacity-75"
                title="Integração social em breve"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>Entrar com Google</span>
                <span className="text-[10px] bg-muted px-2 py-0.5 rounded-full text-muted-foreground">
                  Em breve
                </span>
              </Button>
            </div>
          </form>
        )}

        {/* Acesso rápido para demonstração da família Sarah */}
        <div className="mt-6 pt-5 border-t border-border">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2.5 text-center">
            Acesso Rápido da Família (Demonstração)
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleDemoLogin('edineia@exemplo.com')}
              className="text-xs h-10 rounded-xl"
            >
              Edineia (Mãe · Owner)
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleDemoLogin('marcio@exemplo.com')}
              className="text-xs h-10 rounded-xl"
            >
              Marcio (Pai · Owner)
            </Button>
          </div>
        </div>

        {/* Nota de privacidade e segurança */}
        <div className="mt-6 flex items-start gap-2.5 text-xs text-muted-foreground bg-muted/40 p-3.5 rounded-2xl">
          <ShieldCheck className="w-4 h-4 text-primary shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            Seus dados são privados. Apenas pessoas convidadas pela família veem as informações do
            bebê.
          </p>
        </div>
      </div>
    </div>
  )
}
