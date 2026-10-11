// src/pages/Hoje.tsx
// Tela Hoje: Próxima mamada, botões rápidos Mamou agora, + Xixi / + Cocô, histórico com desfazer de 5s e resumo p/ pediatra

import React, { useEffect, useState, useMemo, useRef } from 'react'
import {
  Clock,
  Heart,
  AlertTriangle,
  RotateCcw,
  Trash2,
  Copy,
  Check,
  Info,
  Calendar,
  Sparkles,
  ChevronDown,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from '@/hooks/use-toast'
import {
  obterEspacoAtual,
  listarEventos,
  criarEvento,
  marcarEventoExcluido,
  restaurarEvento,
  EspacoRecord,
  EventoRecord,
} from '@/services/baby'
import {
  calcularProximaMamada,
  validarHorarioMamada,
  calcularTempoDesdeAnterior,
  ordenarMamadas,
  MamadaEvento,
} from '@/lib/regras/mamadas'
import {
  avaliarMetaFraldas,
  getMetaFraldasPorDia,
  AVISO_INFORMATIVO_PESO_FRALDAS,
} from '@/lib/regras/fraldas'
import { calcularDiaDeVida, formatarIdadeAmigavel } from '@/lib/regras/idade'
import {
  formatLocalTime,
  getLocalDayKey,
  getLocalWeekdayName,
  getLocalTodayDateString,
  getSaoPauloParts,
} from '@/lib/regras/fuso'
import { gerarResumoPediatra } from '@/lib/regras/relatorio'
import { useRealtime } from '@/hooks/use-realtime'

export default function Hoje() {
  const { user } = useAuth()
  const [espaco, setEspaco] = useState<EspacoRecord | null>(null)
  const [eventos, setEventos] = useState<EventoRecord[]>([])
  const [carregando, setCarregando] = useState(true)

  // Registro de mamada rápida
  const [ladoSelecionado, setLadoSelecionado] = useState<'esquerdo' | 'direito' | 'ambos' | ''>('')
  const [horarioManual, setHorarioManual] = useState('')
  const [erroHorario, setErroHorario] = useState<string | null>(null)
  const [salvandoMamada, setSalvandoMamada] = useState(false)

  // Desfazer exclusão lógica (5 segundos)
  const [eventoExcluidoRecente, setEventoExcluidoRecente] = useState<EventoRecord | null>(null)
  const undoTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Resumo copiado feedback
  const [copiado, setCopiado] = useState(false)
  const [mostrarTabelaFraldas, setMostrarTabelaFraldas] = useState(false)

  // Carregar dados iniciais
  const carregarDados = async () => {
    try {
      const esp = await obterEspacoAtual()
      setEspaco(esp)
      if (esp) {
        const evs = await listarEventos(esp.id)
        setEventos(evs)
      }
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    carregarDados()
  }, [])

  // Tempo real: assinatura SSE de eventos
  useRealtime<EventoRecord>(
    'eventos',
    (sub) => {
      if (!espaco || sub.record.espaco !== espaco.id) return

      if (sub.action === 'create') {
        setEventos((prev) => {
          if (prev.some((e) => e.id === sub.record.id)) return prev
          return [sub.record, ...prev]
        })
      } else if (sub.action === 'update') {
        setEventos((prev) =>
          prev.map((e) => (e.id === sub.record.id ? sub.record : e)).filter((e) => !e.deleted_at),
        )
      } else if (sub.action === 'delete') {
        setEventos((prev) => prev.filter((e) => e.id === sub.record.id))
      }
    },
    !!espaco,
  )

  const dataNascimento = espaco?.data_nascimento || '2026-10-09'
  const diaDeVida = useMemo(() => calcularDiaDeVida(dataNascimento), [dataNascimento])
  const intervaloMamada = espaco?.intervalo_mamada_minutos || 180
  const hojeKey = getLocalTodayDateString()

  // Filtrar eventos por dia de hoje e ativos
  const eventosAtivos = useMemo(() => eventos.filter((e) => !e.deleted_at), [eventos])

  // Mamadas
  const mamadasTodas: MamadaEvento[] = useMemo(() => {
    return eventosAtivos
      .filter((e) => e.tipo === 'mamada')
      .map((e) => ({
        id: e.id,
        inicio_em: e.inicio_em,
        lado: e.lado,
        criador_nome: e.criador_nome,
        deleted_at: e.deleted_at,
      }))
  }, [eventosAtivos])

  // Mamadas de hoje
  const mamadasHoje = useMemo(() => {
    return mamadasTodas.filter((m) => getLocalDayKey(m.inicio_em) === hojeKey)
  }, [mamadasTodas, hojeKey])

  // Fraldas de hoje
  const xixisHoje = useMemo(() => {
    return eventosAtivos.filter((e) => e.tipo === 'xixi' && getLocalDayKey(e.inicio_em) === hojeKey)
  }, [eventosAtivos, hojeKey])

  const cocosHoje = useMemo(() => {
    return eventosAtivos.filter((e) => e.tipo === 'coco' && getLocalDayKey(e.inicio_em) === hojeKey)
  }, [eventosAtivos, hojeKey])

  // Próxima mamada cálculo
  const proximaMamadaInfo = useMemo(() => {
    return calcularProximaMamada(mamadasTodas, intervaloMamada)
  }, [mamadasTodas, intervaloMamada])

  // Status das metas de fraldas
  const statusFraldas = useMemo(() => {
    return avaliarMetaFraldas(diaDeVida, xixisHoje.length, cocosHoje.length)
  }, [diaDeVida, xixisHoje.length, cocosHoje.length])

  // Registrar mamada agora ou manual
  const handleRegistrarMamada = async (horarioEspecifico?: string) => {
    if (!espaco) {
      toast({
        variant: 'destructive',
        title: 'Espaço não encontrado',
        description: 'Carregando dados da família, tente novamente em instantes.',
      })
      return
    }
    setErroHorario(null)

    let isoUtc = new Date().toISOString()

    if (horarioEspecifico) {
      const validacao = validarHorarioMamada(horarioEspecifico, hojeKey)
      if (!validacao.valido) {
        setErroHorario(validacao.erro || 'Horário inválido')
        return
      }
      isoUtc = validacao.isoUtc!
    }

    setSalvandoMamada(true)
    try {
      const novo = await criarEvento({
        espacoId: espaco.id,
        tipo: 'mamada',
        inicio_em: isoUtc,
        lado: ladoSelecionado || null,
      })

      // Atualiza estado local imediatamente se não duplicado
      setEventos((prev) => {
        if (prev.some((e) => e.id === novo.id)) return prev
        return [novo, ...prev]
      })
      setHorarioManual('')
      setLadoSelecionado('')

      toast({
        title: 'Mamada registrada',
        description: `Mamada registrada com sucesso${ladoSelecionado ? ` (lado ${ladoSelecionado})` : ''}.`,
      })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao salvar mamada'
      toast({
        variant: 'destructive',
        title: 'Não foi possível salvar',
        description: msg,
      })
    } finally {
      setSalvandoMamada(false)
    }
  }

  // Registrar fralda rápida (+ Xixi ou + Cocô)
  const handleRegistrarFralda = async (tipo: 'xixi' | 'coco') => {
    if (!espaco) {
      toast({
        variant: 'destructive',
        title: 'Espaço não encontrado',
        description: 'Carregando dados da família, tente novamente em instantes.',
      })
      return
    }
    try {
      const novo = await criarEvento({
        espacoId: espaco.id,
        tipo,
        inicio_em: new Date().toISOString(),
      })
      setEventos((prev) => {
        if (prev.some((e) => e.id === novo.id)) return prev
        return [novo, ...prev]
      })
      toast({
        title: tipo === 'xixi' ? 'Xixi registrado' : 'Cocô registrado',
        description: `Registro adicionado com sucesso.`,
      })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao salvar fralda'
      toast({
        variant: 'destructive',
        title: 'Não foi possível salvar',
        description: msg,
      })
    }
  }

  // Apagar evento com desfazer por 5 segundos
  const handleApagarEvento = async (evento: EventoRecord) => {
    if (undoTimeoutRef.current) {
      clearTimeout(undoTimeoutRef.current)
    }

    setEventoExcluidoRecente(evento)
    setEventos((prev) => prev.filter((e) => e.id !== evento.id))

    // Desfazimento por 5s
    undoTimeoutRef.current = setTimeout(async () => {
      try {
        await marcarEventoExcluido(evento.id)
      } catch (err) {
        console.warn('Erro ao apagar evento:', err)
      }
      setEventoExcluidoRecente(null)
    }, 5000)
  }

  const handleDesfazerExclusao = async () => {
    if (!eventoExcluidoRecente) return
    if (undoTimeoutRef.current) {
      clearTimeout(undoTimeoutRef.current)
    }
    const eventoRestaurado = eventoExcluidoRecente
    setEventoExcluidoRecente(null)
    setEventos((prev) => [eventoRestaurado, ...prev])
    try {
      await restaurarEvento(eventoRestaurado.id)
    } catch {
      /* intentionally ignored */
    }
  }

  // Copiar resumo para a pediatra
  const handleCopiarResumo = () => {
    const texto = gerarResumoPediatra({
      bebeNome: espaco?.nome || 'Sarah',
      dataNascimento: espaco?.data_nascimento || '2026-10-09',
      diaDeVida,
      mamadas: mamadasHoje,
      totalXixi: xixisHoje.length,
      totalCoco: cocosHoje.length,
    })

    navigator.clipboard.writeText(texto).then(() => {
      setCopiado(true)
      setTimeout(() => setCopiado(false), 3000)
    })
  }

  // Agrupamento de eventos por dia
  const eventosAgrupadosPorDia = useMemo(() => {
    const grupos: Record<string, EventoRecord[]> = {}
    for (const ev of eventosAtivos) {
      const dia = getLocalDayKey(ev.inicio_em)
      if (!grupos[dia]) grupos[dia] = []
      grupos[dia].push(ev)
    }

    // Ordenar dias descrescentes
    return Object.keys(grupos)
      .sort((a, b) => b.localeCompare(a))
      .map((diaKey) => {
        const evs = grupos[diaKey].sort(
          (a, b) => new Date(b.inicio_em).getTime() - new Date(a.inicio_em).getTime(),
        )
        const totalMamadas = evs.filter((e) => e.tipo === 'mamada').length
        const totalXixi = evs.filter((e) => e.tipo === 'xixi').length
        const totalCoco = evs.filter((e) => e.tipo === 'coco').length

        const partes = diaKey.split('-')
        const dataFormatada = `${partes[2]}/${partes[1]}`
        const diaSemana = getLocalWeekdayName(new Date(`${diaKey}T12:00:00.000Z`))

        return {
          diaKey,
          titulo: `${diaSemana}, ${dataFormatada}`,
          totais: `${totalMamadas} mamadas · ${totalXixi} xixi · ${totalCoco} cocô`,
          eventos: evs,
        }
      })
  }, [eventosAtivos])

  return (
    <div className="space-y-4 pb-8">
      {/* 1. CARTÃO PRÓXIMA MAMADA */}
      <div
        className={`rounded-[24px] p-5 shadow-sm border transition-all ${
          proximaMamadaInfo.estaAtrasada
            ? 'bg-amber-50/90 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800'
            : 'bg-card border-border'
        }`}
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Próxima mamada
          </span>
          {proximaMamadaInfo.estaAtrasada ? (
            <span className="flex items-center gap-1 text-xs font-bold text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/60 px-2.5 py-0.5 rounded-full">
              <AlertTriangle className="w-3.5 h-3.5" />
              Atenção
            </span>
          ) : (
            <span className="text-xs font-semibold text-primary">
              Intervalo de {intervaloMamada / 60}h
            </span>
          )}
        </div>

        {/* Horário grande e contagem regressiva */}
        <div className="flex items-baseline justify-between mt-1">
          <div className="text-4xl font-extrabold text-foreground tracking-tight">
            {proximaMamadaInfo.horarioProximaFormatado}
          </div>
          <div
            className={`text-sm font-bold ${
              proximaMamadaInfo.estaAtrasada ? 'text-amber-800 dark:text-amber-300' : 'text-primary'
            }`}
          >
            {proximaMamadaInfo.tempoTexto}
          </div>
        </div>

        {/* Barra de progresso */}
        <div className="mt-3">
          <Progress
            value={proximaMamadaInfo.progressoPercentual}
            className={`h-2 rounded-full ${
              proximaMamadaInfo.estaAtrasada ? '[&>div]:bg-amber-600' : '[&>div]:bg-primary'
            }`}
          />
        </div>

        {/* Sub-linhas informativas */}
        <div className="mt-4 pt-3 border-t border-border/60 flex items-center justify-between text-xs text-muted-foreground">
          <div>
            {proximaMamadaInfo.ultimaMamada ? (
              <span>
                Última: <strong>{formatLocalTime(proximaMamadaInfo.ultimaMamada.inicio_em)}</strong>
                {proximaMamadaInfo.ultimaMamada.lado
                  ? ` · lado ${proximaMamadaInfo.ultimaMamada.lado}`
                  : ''}
              </span>
            ) : (
              <span>Ainda sem registro anterior</span>
            )}
          </div>
          <div>
            Mamadas hoje: <strong>{mamadasHoje.length}</strong>{' '}
            <span className="text-muted-foreground/80">(meta 8 a 12)</span>
          </div>
        </div>
      </div>

      {/* 2. REGISTRAR MAMADA (SELEÇÃO DE LADO E BOTÃO GRANDE MAMOU AGORA) */}
      <div className="bg-card rounded-[24px] p-5 shadow-sm border border-border space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold text-foreground">Registrar mamada</span>
          <span className="text-xs text-muted-foreground">Lado (opcional)</span>
        </div>

        {/* Chips de lado: Esquerdo, Direito, Ambos */}
        <div className="grid grid-cols-3 gap-2">
          {(['esquerdo', 'direito', 'ambos'] as const).map((lado) => (
            <button
              key={lado}
              type="button"
              onClick={() => setLadoSelecionado((prev) => (prev === lado ? '' : lado))}
              className={`h-11 rounded-2xl text-xs font-bold transition-all border flex items-center justify-center gap-1.5 ${
                ladoSelecionado === lado
                  ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                  : 'bg-background hover:bg-muted/50 border-border text-foreground'
              }`}
            >
              <span className="capitalize">{lado}</span>
            </button>
          ))}
        </div>

        {/* Botão grande primário "Mamou agora" (>= 48px, visível sem rolar) */}
        <Button
          type="button"
          disabled={salvandoMamada}
          onClick={() => handleRegistrarMamada()}
          className="w-full h-14 rounded-2xl text-base font-extrabold bg-primary hover:bg-primary/95 text-primary-foreground shadow-sm flex items-center justify-center gap-2 tap-pop"
        >
          <Heart className="w-5 h-5 fill-primary-foreground" />
          <span>{salvandoMamada ? 'Registrando...' : 'Mamou agora'}</span>
        </Button>

        {/* Horário manual no passado */}
        <div className="pt-2">
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <Input
                type="text"
                placeholder="Horário manual (ex: 10:30)"
                value={horarioManual}
                onChange={(e) => {
                  setHorarioManual(e.target.value)
                  setErroHorario(null)
                }}
                className="h-11 rounded-2xl text-sm"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              disabled={!horarioManual || salvandoMamada}
              onClick={() => handleRegistrarMamada(horarioManual)}
              className="h-11 rounded-2xl text-xs font-bold px-4"
            >
              Registrar
            </Button>
          </div>
          {erroHorario && (
            <p className="text-xs text-destructive font-medium mt-1.5">{erroHorario}</p>
          )}
        </div>
      </div>

      {/* 3. FRALDAS DO DIA COM METAS POR DIA DE VIDA */}
      <div className="bg-card rounded-[24px] p-5 shadow-sm border border-border space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-foreground">Fraldas hoje</h3>
            <p className="text-xs text-muted-foreground">
              {statusFraldas.metaDetalhe.mensagemPadrao}
            </p>
          </div>
          <button
            onClick={() => setMostrarTabelaFraldas(true)}
            className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50"
            aria-label="Ver tabela de fraldas esperadas"
          >
            <Info className="w-4 h-4" />
          </button>
        </div>

        {/* Botões rápidos + Xixi e + Cocô */}
        <div className="grid grid-cols-2 gap-3">
          {/* Card Xixi */}
          <div className="bg-background rounded-2xl p-3.5 border border-border flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-muted-foreground">Xixi</span>
              <span className="text-2xl font-black text-foreground">{xixisHoje.length}</span>
            </div>
            <div className="mt-3">
              <Button
                type="button"
                onClick={() => handleRegistrarFralda('xixi')}
                className="w-full h-12 rounded-xl text-xs font-bold bg-secondary hover:bg-secondary/80 text-secondary-foreground border border-border/50 tap-pop"
              >
                + Xixi
              </Button>
            </div>
          </div>

          {/* Card Cocô */}
          <div className="bg-background rounded-2xl p-3.5 border border-border flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-muted-foreground">Cocô</span>
              <span className="text-2xl font-black text-foreground">{cocosHoje.length}</span>
            </div>
            <div className="mt-3">
              <Button
                type="button"
                onClick={() => handleRegistrarFralda('coco')}
                className="w-full h-12 rounded-xl text-xs font-bold bg-secondary hover:bg-secondary/80 text-secondary-foreground border border-border/50 tap-pop"
              >
                + Cocô
              </Button>
            </div>
          </div>
        </div>

        {/* Feedback da meta do dia */}
        <div className="bg-muted/40 rounded-2xl p-3 text-xs flex items-center justify-between">
          <span className="text-muted-foreground">
            Meta dia {diaDeVida}: mínimo {statusFraldas.metaXixi} xixis
          </span>
          <span
            className={`font-bold ${
              statusFraldas.atingiuMetaXixi
                ? 'text-emerald-700 dark:text-emerald-400'
                : 'text-amber-700 dark:text-amber-400'
            }`}
          >
            {statusFraldas.mensagemStatus}
          </span>
        </div>
      </div>

      {/* 4. RESUMO CURTO PARA A PEDIATRA */}
      <div className="bg-card rounded-[24px] p-5 shadow-sm border border-border space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-foreground">Resumo p/ Pediatra (hoje)</h3>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCopiarResumo}
            className="h-9 px-3 rounded-xl text-xs font-semibold flex items-center gap-1.5"
          >
            {copiado ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-emerald-600">Copiado!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copiar texto</span>
              </>
            )}
          </Button>
        </div>

        <div className="bg-muted/50 rounded-2xl p-3.5 font-mono text-xs text-foreground whitespace-pre-wrap leading-relaxed border border-border/40 select-all">
          {gerarResumoPediatra({
            bebeNome: espaco?.nome || 'Sarah',
            dataNascimento: espaco?.data_nascimento || '2026-10-09',
            diaDeVida,
            mamadas: mamadasHoje,
            totalXixi: xixisHoje.length,
            totalCoco: cocosHoje.length,
          })}
        </div>
      </div>

      {/* 5. HISTÓRICO AGRUPADO POR DIA */}
      <div className="space-y-4 pt-2">
        <h3 className="text-sm font-bold text-foreground px-1">Histórico de registros</h3>

        {eventosAgrupadosPorDia.length === 0 ? (
          <div className="bg-card rounded-[24px] p-8 text-center border border-border text-muted-foreground">
            <Heart className="w-8 h-8 text-primary/40 mx-auto mb-2" />
            <p className="text-sm font-semibold">Ainda não há registros.</p>
            <p className="text-xs mt-1">Que tal começar pela primeira mamada da Sarah?</p>
          </div>
        ) : (
          eventosAgrupadosPorDia.map((grupo) => (
            <div
              key={grupo.diaKey}
              className="bg-card rounded-[24px] overflow-hidden border border-border shadow-sm"
            >
              {/* Cabeçalho do dia com totais */}
              <div className="bg-muted/40 px-4 py-3 border-b border-border flex items-center justify-between">
                <span className="font-bold text-xs text-foreground capitalize">{grupo.titulo}</span>
                <span className="text-[11px] font-semibold text-muted-foreground">
                  {grupo.totais}
                </span>
              </div>

              {/* Lista cronológica do dia */}
              <div className="divide-y divide-border/50">
                {grupo.eventos.map((ev, index) => {
                  const evAnterior =
                    ev.tipo === 'mamada'
                      ? grupo.eventos.slice(index + 1).find((e) => e.tipo === 'mamada') || null
                      : null

                  const tempoDesde =
                    ev.tipo === 'mamada' && evAnterior
                      ? calcularTempoDesdeAnterior(
                          { id: ev.id, inicio_em: ev.inicio_em },
                          { id: evAnterior.id, inicio_em: evAnterior.inicio_em },
                        )
                      : null

                  return (
                    <div
                      key={ev.id}
                      className="px-4 py-3 flex items-center justify-between hover:bg-muted/20 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-9 h-9 rounded-2xl flex items-center justify-center font-bold text-xs ${
                            ev.tipo === 'mamada'
                              ? 'bg-primary/10 text-primary'
                              : ev.tipo === 'xixi'
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                                : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                          }`}
                        >
                          {ev.tipo === 'mamada' ? 'M' : ev.tipo === 'xixi' ? 'X' : 'C'}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-foreground">
                              {formatLocalTime(ev.inicio_em)}
                            </span>
                            <span className="text-xs font-semibold capitalize text-foreground">
                              {ev.tipo}
                              {ev.lado ? ` (${ev.lado})` : ''}
                            </span>
                            {tempoDesde && (
                              <span className="text-[11px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                                {tempoDesde}
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-muted-foreground mt-0.5">
                            registrado por {ev.criador_nome || 'Família'}
                          </div>
                        </div>
                      </div>

                      {/* Botão apagar */}
                      <button
                        onClick={() => handleApagarEvento(ev)}
                        className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                        aria-label="Apagar registro"
                        title="Apagar este registro"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Barra flutuante de Desfazer por 5 segundos */}
      {eventoExcluidoRecente && (
        <div className="fixed bottom-20 left-4 right-4 max-w-[520px] mx-auto z-50 bg-foreground text-background px-4 py-3 rounded-2xl shadow-lg flex items-center justify-between animate-fade-in-up">
          <span className="text-xs font-medium">Registro apagado.</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleDesfazerExclusao}
            className="h-8 px-3 rounded-xl text-xs font-bold bg-background text-foreground hover:bg-muted"
          >
            <RotateCcw className="w-3.5 h-3.5 mr-1" />
            Desfazer
          </Button>
        </div>
      )}

      {/* Modal explicativo da Tabela de Fraldas e perda de peso */}
      <Dialog open={mostrarTabelaFraldas} onOpenChange={setMostrarTabelaFraldas}>
        <DialogContent className="max-w-[480px] rounded-[24px]">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Expectativa de Fraldas por Dia</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 text-xs">
            <div className="border border-border rounded-2xl overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-muted font-bold">
                  <tr>
                    <th className="p-2.5">Dia de vida</th>
                    <th className="p-2.5">Xixi mínimo</th>
                    <th className="p-2.5">Fezes esperadas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  <tr>
                    <td className="p-2.5 font-semibold">Dia 1</td>
                    <td className="p-2.5">1</td>
                    <td className="p-2.5">mecônio</td>
                  </tr>
                  <tr>
                    <td className="p-2.5 font-semibold">Dia 2</td>
                    <td className="p-2.5">2</td>
                    <td className="p-2.5">mecônio</td>
                  </tr>
                  <tr>
                    <td className="p-2.5 font-semibold">Dia 3</td>
                    <td className="p-2.5">3</td>
                    <td className="p-2.5">em transição</td>
                  </tr>
                  <tr>
                    <td className="p-2.5 font-semibold">Dia 4</td>
                    <td className="p-2.5">4</td>
                    <td className="p-2.5">amareladas</td>
                  </tr>
                  <tr>
                    <td className="p-2.5 font-semibold">Dia 5+</td>
                    <td className="p-2.5">6 ou mais</td>
                    <td className="p-2.5">amareladas 3+</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-2xl p-3 text-amber-900 dark:text-amber-200 leading-relaxed">
              {AVISO_INFORMATIVO_PESO_FRALDAS}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
