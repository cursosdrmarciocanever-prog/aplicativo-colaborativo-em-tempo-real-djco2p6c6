// src/pages/Pessoas.tsx
// Tela Pessoas: Convidar familiares, lista de membros com remoção, convites pendentes e revogação

import React, { useEffect, useState } from 'react'
import {
  Users,
  Mail,
  UserPlus,
  Shield,
  Trash2,
  Copy,
  Check,
  Clock,
  AlertCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { useAuth } from '@/contexts/AuthContext'
import {
  obterEspacoAtual,
  listarMembros,
  listarConvites,
  criarConvite,
  revogarConvite,
  removerMembro,
  EspacoRecord,
  MembroRecord,
  ConviteRecord,
} from '@/services/baby'
import { formatLocalDateShort } from '@/lib/regras/fuso'

export default function Pessoas() {
  const { user } = useAuth()
  const [espaco, setEspaco] = useState<EspacoRecord | null>(null)
  const [membros, setMembros] = useState<MembroRecord[]>([])
  const [convites, setConvites] = useState<ConviteRecord[]>([])
  const [carregando, setCarregando] = useState(true)

  // Form convite
  const [emailConvite, setEmailConvite] = useState('')
  const [papelConvite, setPapelConvite] = useState<'editor' | 'viewer'>('editor')
  const [restringirEmail, setRestringirEmail] = useState(false)
  const [enviandoConvite, setEnviandoConvite] = useState(false)
  const [conviteGeradoLink, setConviteGeradoLink] = useState<string | null>(null)
  const [linkCopiado, setLinkCopiado] = useState(false)
  const [mensagemSucesso, setMensagemSucesso] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  // Determinar se o usuário atual é owner
  const isOwner = React.useMemo(() => {
    if (!user || !membros.length) return true // fallback seguro
    const meuMembro = membros.find((m) => m.usuario === user.id)
    return meuMembro?.papel === 'owner' || meuMembro?.papel === 'admin'
  }, [user, membros])

  const carregarDados = async () => {
    try {
      const esp = await obterEspacoAtual()
      setEspaco(esp)
      if (esp) {
        const [mList, cList] = await Promise.all([listarMembros(esp.id), listarConvites(esp.id)])
        setMembros(mList)
        setConvites(cList)
      }
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    carregarDados()
  }, [])

  const handleCriarConvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!espaco) return
    setErro(null)
    setMensagemSucesso(null)

    setEnviandoConvite(true)
    try {
      const convite = await criarConvite({
        espacoId: espaco.id,
        email: restringirEmail ? emailConvite : undefined,
        papel: papelConvite,
        validadeDias: 7,
      })

      // Gerar link de convite completo
      const link = `${window.location.origin}/convite?token=${convite.token}`
      setConviteGeradoLink(link)
      setMensagemSucesso('Convite criado com sucesso! Validade de 7 dias e uso único.')
      setEmailConvite('')
      // Atualizar lista de convites
      const cList = await listarConvites(espaco.id)
      setConvites(cList)
    } catch (err: unknown) {
      setErro('Não foi possível gerar o convite.')
    } finally {
      setEnviandoConvite(false)
    }
  }

  const handleCopiarLink = (url: string) => {
    navigator.clipboard.writeText(url).then(() => {
      setLinkCopiado(true)
      setTimeout(() => setLinkCopiado(false), 3000)
    })
  }

  const handleRevogarConvite = async (id: string) => {
    if (!espaco) return
    try {
      await revogarConvite(id, espaco.id)
      setConvites((prev) => prev.filter((c) => c.id !== id))
    } catch {
      /* intentionally ignored */
    }
  }

  const handleRemoverMembro = async (membro: MembroRecord) => {
    if (!espaco) return
    // Owner não pode remover outro owner
    if (membro.papel === 'owner' || membro.papel === 'admin') {
      alert('Não é permitido remover outro administrador/owner da família.')
      return
    }

    const confirma = window.confirm(`Deseja remover este membro da família?`)
    if (!confirma) return

    try {
      await removerMembro(membro.id, espaco.id, membro.expand?.usuario?.name)
      setMembros((prev) => prev.filter((m) => m.id !== membro.id))
    } catch {
      /* intentionally ignored */
    }
  }

  return (
    <div className="space-y-6 pb-8">
      <div>
        <h1 className="text-2xl font-black text-foreground tracking-tight flex items-center gap-2">
          <Users className="w-6 h-6 text-primary" />
          Pessoas e Permissões
        </h1>
        <p className="text-xs text-muted-foreground mt-1">
          Apenas pessoas convidadas pelos pais têm acesso às informações do bebê.
        </p>
      </div>

      {/* Formulário de Convidar */}
      {isOwner && (
        <div className="bg-card rounded-[24px] p-5 shadow-sm border border-border space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
              <UserPlus className="w-4 h-4" />
            </div>
            <h2 className="text-sm font-bold text-foreground">Convidar nova pessoa</h2>
          </div>

          <form onSubmit={handleCriarConvite} className="space-y-3.5">
            <div>
              <Label htmlFor="email" className="text-xs font-semibold">
                E-mail do convidado
              </Label>
              <div className="relative mt-1">
                <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="exemplo@familia.com"
                  value={emailConvite}
                  onChange={(e) => setEmailConvite(e.target.value)}
                  className="pl-10 h-11 rounded-2xl text-sm"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="papel" className="text-xs font-semibold">
                Papel
              </Label>
              <Select
                value={papelConvite}
                onValueChange={(v: 'editor' | 'viewer') => setPapelConvite(v)}
              >
                <SelectTrigger className="h-11 rounded-2xl mt-1 text-sm">
                  <SelectValue placeholder="Selecione o papel" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="editor">
                    Editor (avós, doula, babá — pode registrar e editar)
                  </SelectItem>
                  <SelectItem value="viewer">Visualizador (apenas leitura)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between py-1">
              <div>
                <Label htmlFor="restringir" className="text-xs font-semibold block">
                  Restringir a este e-mail
                </Label>
                <span className="text-[11px] text-muted-foreground">
                  Apenas a conta com este e-mail poderá aceitar o convite
                </span>
              </div>
              <Switch
                id="restringir"
                checked={restringirEmail}
                onCheckedChange={setRestringirEmail}
                disabled={!emailConvite}
              />
            </div>

            {erro && <p className="text-xs text-destructive font-medium">{erro}</p>}

            <Button
              type="submit"
              disabled={enviandoConvite}
              className="w-full h-12 rounded-2xl font-bold bg-primary hover:bg-primary/90 text-primary-foreground tap-pop"
            >
              {enviandoConvite ? 'Gerando convite...' : 'Gerar convite (7 dias · uso único)'}
            </Button>
          </form>

          {/* Link gerado com botão de copiar */}
          {conviteGeradoLink && (
            <div className="mt-4 p-4 rounded-2xl bg-primary/5 border border-primary/20 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-primary">Link de convite pronto:</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleCopiarLink(conviteGeradoLink)}
                  className="h-8 px-2.5 rounded-xl text-xs font-semibold gap-1"
                >
                  {linkCopiado ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-600">Copiado!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copiar link</span>
                    </>
                  )}
                </Button>
              </div>
              <p className="text-xs font-mono text-muted-foreground break-all select-all bg-card p-2 rounded-xl border border-border/50">
                {conviteGeradoLink}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Lista de Membros da Família */}
      <div className="bg-card rounded-[24px] p-5 shadow-sm border border-border space-y-3">
        <h2 className="text-sm font-bold text-foreground flex items-center justify-between">
          <span>Membros com acesso ({membros.length})</span>
          <span className="text-xs font-normal text-muted-foreground">
            Colaborativo em tempo real
          </span>
        </h2>

        <div className="divide-y divide-border">
          {membros.map((m) => {
            const isMe = m.usuario === user?.id
            const nomeExibicao = m.expand?.usuario?.name || (isMe ? 'Você' : 'Membro da família')
            const emailExibicao = m.expand?.usuario?.email || ''

            return (
              <div key={m.id} className="py-3 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-foreground">{nomeExibicao}</span>
                    {isMe && (
                      <span className="text-[10px] font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                        Você
                      </span>
                    )}
                    <span className="text-xs font-medium text-muted-foreground capitalize">
                      · {m.papel === 'admin' ? 'Owner' : m.papel}
                    </span>
                  </div>
                  {emailExibicao && (
                    <div className="text-xs text-muted-foreground">{emailExibicao}</div>
                  )}
                </div>

                {isOwner && !isMe && m.papel !== 'owner' && m.papel !== 'admin' && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoverMembro(m)}
                    className="h-9 px-2 text-muted-foreground hover:text-destructive"
                    title="Remover membro"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Lista de Convites Pendentes */}
      {convites.length > 0 && (
        <div className="bg-card rounded-[24px] p-5 shadow-sm border border-border space-y-3">
          <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Clock className="w-4 h-4 text-muted-foreground" />
            Convites pendentes ({convites.length})
          </h2>

          <div className="divide-y divide-border">
            {convites.map((c) => {
              const urlConvite = `${window.location.origin}/convite?token=${c.token}`
              return (
                <div key={c.id} className="py-3 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold text-foreground">
                      {c.email ? c.email : 'Link aberto (qualquer convidado)'}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Papel: <strong className="capitalize">{c.papel || 'editor'}</strong> ·
                      Validade: {formatLocalDateShort(c.expira_em)}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleCopiarLink(urlConvite)}
                      className="h-8 px-2 text-xs"
                      title="Copiar link do convite"
                    >
                      <Copy className="w-3.5 h-3.5 mr-1" />
                      Copiar
                    </Button>

                    {isOwner && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRevogarConvite(c.id)}
                        className="h-8 px-2 text-xs text-muted-foreground hover:text-destructive"
                      >
                        Revogar
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
