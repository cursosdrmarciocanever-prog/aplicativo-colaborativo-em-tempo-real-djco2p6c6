// src/components/ajustes/Notificacoes.tsx
// Ativar e ajustar as notificações deste celular: mamada, vacinas, consultas e registros
// da família. Cada aparelho tem as próprias preferências.

import { useEffect, useState } from 'react'
import { Bell, BellOff, BellRing, Share } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { toast } from '@/hooks/use-toast'
import {
  ativarNotificacoes,
  desativarNotificacoes,
  inscricaoDesteAparelho,
  pedirTeste,
  salvarPreferencias,
  verificarSuporte,
  type InscricaoPush,
  type Preferencias,
  type Suporte,
} from '@/services/notificacoes'

const ANTECEDENCIA = [
  { min: 0, rotulo: 'Na hora' },
  { min: 15, rotulo: '15 min antes' },
  { min: 30, rotulo: '30 min antes' },
]

export default function Notificacoes({ espacoId, nomeBebe }: { espacoId: string; nomeBebe: string }) {
  const [suporte, setSuporte] = useState<Suporte>('ok')
  const [inscricao, setInscricao] = useState<InscricaoPush | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [ocupado, setOcupado] = useState(false)

  useEffect(() => {
    const s = verificarSuporte()
    setSuporte(s)
    if (s !== 'ok') {
      setCarregando(false)
      return
    }
    inscricaoDesteAparelho()
      .then(setInscricao)
      .finally(() => setCarregando(false))
  }, [])

  const ativar = async () => {
    setOcupado(true)
    try {
      const i = await ativarNotificacoes(espacoId)
      setInscricao(i)
      toast({ title: 'Notificações ativadas', description: 'Em instantes chega um aviso de teste.' })
    } catch (err) {
      setSuporte(verificarSuporte())
      toast({ title: 'Não ativou', description: (err as Error).message, variant: 'destructive' })
    } finally {
      setOcupado(false)
    }
  }

  const mudar = async (prefs: Partial<Preferencias>) => {
    if (!inscricao) return
    const anterior = inscricao
    setInscricao({ ...inscricao, ...prefs })
    try {
      setInscricao(await salvarPreferencias(inscricao.id, prefs))
    } catch {
      setInscricao(anterior)
      toast({ title: 'Não salvou', description: 'Confira a internet e tente de novo.', variant: 'destructive' })
    }
  }

  const testar = async () => {
    if (!inscricao) return
    try {
      await pedirTeste(inscricao.id)
      toast({ title: 'Teste pedido', description: 'O aviso chega em até meio minuto.' })
    } catch {
      toast({ title: 'Não foi possível pedir o teste', variant: 'destructive' })
    }
  }

  const desativar = async () => {
    if (!inscricao) return
    setOcupado(true)
    await desativarNotificacoes(inscricao.id)
    setInscricao(null)
    setOcupado(false)
  }

  const linha = (titulo: string, desc: string, campo: keyof Preferencias) => (
    <label className="flex items-start justify-between gap-3 py-2.5 cursor-pointer">
      <span>
        <span className="block text-sm font-semibold text-foreground">{titulo}</span>
        <span className="block text-[11px] text-muted-foreground leading-snug">{desc}</span>
      </span>
      <Switch
        checked={!!inscricao?.[campo]}
        onCheckedChange={(v) => mudar({ [campo]: v } as Partial<Preferencias>)}
        aria-label={titulo}
      />
    </label>
  )

  return (
    <div className="bg-card rounded-[24px] p-5 shadow-sm border border-border space-y-3">
      <div className="flex items-center gap-2">
        <Bell className="w-5 h-5 text-primary" />
        <h2 className="text-sm font-bold text-foreground">Notificações neste celular</h2>
      </div>

      {carregando ? (
        <p className="text-xs text-muted-foreground">Verificando...</p>
      ) : suporte === 'ios-instalar' ? (
        <div className="text-xs text-foreground space-y-2 leading-relaxed">
          <p>No iPhone, as notificações só funcionam com o app instalado:</p>
          <ol className="list-decimal pl-5 space-y-1 text-muted-foreground">
            <li>
              No Safari, toque em <Share className="inline w-3.5 h-3.5 -mt-0.5" /> <strong>Compartilhar</strong>
            </li>
            <li>
              Escolha <strong>Adicionar à Tela de Início</strong>
            </li>
            <li>Abra o Diário pelo ícone novo e volte aqui em Ajustes</li>
          </ol>
        </div>
      ) : suporte === 'sem-suporte' ? (
        <p className="text-xs text-muted-foreground">
          Este navegador não recebe notificações. No Android use o Chrome; no iPhone, instale o app
          na Tela de Início (iOS 16.4 ou mais novo).
        </p>
      ) : suporte === 'negado' ? (
        <div className="flex items-start gap-2 text-xs text-foreground">
          <BellOff className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            As notificações foram bloqueadas para o Diário. Libere nos ajustes do celular
            (iPhone: Ajustes &gt; Notificações &gt; Diário; Android: segure o ícone &gt; Informações
            do app &gt; Notificações) e volte aqui.
          </p>
        </div>
      ) : !inscricao ? (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground leading-relaxed">
            Receba no celular, mesmo com o app fechado: hora da mamada da {nomeBebe}, mamada
            atrasada, hora dos remédios, véspera das vacinas e das consultas.
          </p>
          <Button
            type="button"
            onClick={ativar}
            disabled={ocupado}
            className="w-full h-12 rounded-2xl font-bold gap-2"
          >
            <BellRing className="w-4 h-4" />
            {ocupado ? 'Ativando...' : 'Ativar notificações'}
          </Button>
        </div>
      ) : (
        <div className="space-y-1">
          <div className="divide-y divide-border">
            <div className="py-2.5">
              <label className="flex items-start justify-between gap-3 cursor-pointer">
                <span>
                  <span className="block text-sm font-semibold text-foreground">Hora da mamada</span>
                  <span className="block text-[11px] text-muted-foreground leading-snug">
                    Pelo intervalo combinado, contando do início da última mamada ou mamadeira.
                  </span>
                </span>
                <Switch
                  checked={inscricao.mamada}
                  onCheckedChange={(v) => mudar({ mamada: v })}
                  aria-label="Hora da mamada"
                />
              </label>
              {inscricao.mamada && (
                <div className="grid grid-cols-3 gap-1.5 mt-2" role="radiogroup" aria-label="Quando avisar">
                  {ANTECEDENCIA.map((a) => (
                    <button
                      key={a.min}
                      type="button"
                      role="radio"
                      aria-checked={inscricao.mamada_antes_min === a.min}
                      onClick={() => mudar({ mamada_antes_min: a.min })}
                      className={`h-9 rounded-xl text-[11px] font-bold border ${
                        inscricao.mamada_antes_min === a.min
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'border-border text-foreground'
                      }`}
                    >
                      {a.rotulo}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {linha('Mamada atrasada', 'Lembra 30 min depois do horário, se ninguém registrou.', 'mamada_atraso')}
            {linha('Remédios e vitaminas', 'Na hora de cada dose, se ninguém marcou como dada.', 'remedios')}
            {linha('Vacinas', 'Na véspera e no dia, às 9h.', 'vacinas')}
            {linha('Consultas', 'Na véspera (9h) e na manhã do dia.', 'consultas')}
            {linha(
              'Registros da família',
              'Quando outra pessoa registra mamada, fralda etc. (desligado por padrão).',
              'familia',
            )}
          </div>
          <div className="grid grid-cols-2 gap-2 pt-2">
            <Button type="button" variant="outline" onClick={testar} className="h-10 rounded-xl text-xs font-bold">
              Enviar teste
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={desativar}
              disabled={ocupado}
              className="h-10 rounded-xl text-xs font-bold text-muted-foreground"
            >
              Desativar aqui
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground leading-relaxed pt-1">
            Cada celular tem as próprias escolhas. Quem cuida junto precisa ativar no próprio
            celular também.
          </p>
        </div>
      )}
    </div>
  )
}
