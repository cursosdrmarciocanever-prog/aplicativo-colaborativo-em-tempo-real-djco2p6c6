// src/pages/Index.tsx
// Login sem senha: código de uso único enviado por e-mail (OTP do PocketBase)

import React, { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Heart, Mail, ArrowRight, ShieldCheck, KeyRound, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/contexts/AuthContext'

type Etapa = 'email' | 'codigo' | 'nome'

export default function Index() {
  const { user, isAuthenticated, solicitarCodigo, entrarComCodigo, salvarNome } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const conviteToken = searchParams.get('convite')

  const [etapa, setEtapa] = useState<Etapa>('email')
  const [email, setEmail] = useState('')
  const [otpId, setOtpId] = useState('')
  const [codigo, setCodigo] = useState('')
  const [nome, setNome] = useState('')
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const seguir = React.useCallback(() => {
    navigate(conviteToken ? `/convite?token=${encodeURIComponent(conviteToken)}` : '/hoje', {
      replace: true,
    })
  }, [conviteToken, navigate])

  // Já autenticado: pede o nome uma vez (quem é novo) e segue.
  React.useEffect(() => {
    if (!isAuthenticated) return
    if (!user?.name) {
      setEtapa('nome')
      return
    }
    seguir()
  }, [isAuthenticated, user?.name, seguir])

  const enviarEmail = async (e: React.FormEvent) => {
    e.preventDefault()
    setErro(null)

    const emailLimpo = email.trim().toLowerCase()
    if (!emailLimpo || !emailLimpo.includes('@') || !emailLimpo.includes('.')) {
      setErro('Por favor, informe um endereço de e-mail válido.')
      return
    }

    setLoading(true)
    try {
      setOtpId(await solicitarCodigo(emailLimpo))
      setCodigo('')
      setEtapa('codigo')
    } catch (err: unknown) {
      console.warn('Erro ao solicitar código:', err)
      setErro('Não foi possível enviar o código agora. Tente de novo em instantes.')
    } finally {
      setLoading(false)
    }
  }

  const enviarCodigo = async (e: React.FormEvent) => {
    e.preventDefault()
    setErro(null)
    const limpo = codigo.replace(/\s/g, '')
    if (!limpo) {
      setErro('Digite o código que chegou no seu e-mail.')
      return
    }
    setLoading(true)
    try {
      await entrarComCodigo(otpId, limpo)
    } catch {
      setErro('Código incorreto ou expirado. Confira o e-mail ou peça um novo código.')
    } finally {
      setLoading(false)
    }
  }

  const enviarNome = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nome.trim()) {
      setErro('Conte como a família te chama.')
      return
    }
    setLoading(true)
    try {
      await salvarNome(nome.trim())
      seguir()
    } catch {
      setErro('Não foi possível salvar seu nome agora.')
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
        {etapa === 'codigo' ? (
          <form onSubmit={enviarCodigo} className="space-y-4">
            <div className="text-center space-y-2">
              <h2 className="text-xl font-bold text-foreground">Confira seu e-mail</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Enviamos um código de acesso para{' '}
                <strong className="text-foreground">{email.trim().toLowerCase()}</strong>.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="codigo" className="text-sm font-semibold">
                Código
              </Label>
              <div className="relative">
                <KeyRound className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="codigo"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="000000"
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value)}
                  className="pl-11 h-12 rounded-2xl bg-background text-lg tracking-[0.3em]"
                  autoFocus
                  required
                />
              </div>
              {erro && <p className="text-xs text-destructive font-medium mt-1">{erro}</p>}
            </div>
            <div className="bg-muted/50 rounded-2xl p-3 text-xs text-muted-foreground">
              O código vale por 10 minutos. Se não encontrar, dê uma olhadinha na pasta de spam.
            </div>
            <Button
              type="submit"
              disabled={loading}
              className="w-full h-12 rounded-2xl text-base font-bold bg-primary hover:bg-primary/90 text-primary-foreground flex items-center justify-center gap-2 tap-pop"
            >
              <span>{loading ? 'Entrando...' : 'Entrar'}</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setErro(null)
                setEtapa('email')
              }}
              className="w-full h-12 rounded-xl text-sm"
            >
              Usar outro e-mail ou pedir novo código
            </Button>
          </form>
        ) : etapa === 'nome' ? (
          <form onSubmit={enviarNome} className="space-y-4">
            <div className="text-center space-y-2">
              <h2 className="text-xl font-bold text-foreground">Que bom ter você aqui!</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Como a família te chama? Esse nome aparece em "registrado por".
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nome" className="text-sm font-semibold">
                Seu nome
              </Label>
              <div className="relative">
                <User className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="nome"
                  placeholder="Ex.: Vovó Maria"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  className="pl-11 h-12 rounded-2xl bg-background text-base"
                  maxLength={60}
                  autoFocus
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
              <span>{loading ? 'Salvando...' : 'Continuar'}</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
          </form>
        ) : (
          <form onSubmit={enviarEmail} className="space-y-4">
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
                  placeholder="seu@email.com"
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
              <span>{loading ? 'Enviando...' : 'Receber código por e-mail'}</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              Sem senha: a cada acesso enviamos um código de 6 números.
            </p>

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
