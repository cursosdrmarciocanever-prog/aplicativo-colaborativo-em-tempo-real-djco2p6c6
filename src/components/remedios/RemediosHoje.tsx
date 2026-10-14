// src/components/remedios/RemediosHoje.tsx
// Doses de hoje: o que falta dar, o que já foi dado (e por quem) e os remédios "se necessário".
// Um toque em "Dei" avisa a família inteira e impede que a dose seja dada duas vezes.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, Clock, Pill, Undo2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from '@/hooks/use-toast'
import pb from '@/lib/pocketbase/client'
import {
  dosesDoDia,
  horaLocal,
  situacaoSos,
  type DoseDoDia,
  type SituacaoDose,
} from '@/lib/regras/medicacoes'
import {
  acompanharRemedios,
  desfazerDose,
  listarDosesRecentes,
  listarMedicacoes,
  registrarDose,
  type DoseRecord,
  type MedicacaoRecord,
} from '@/services/remedios'

const ESTILO: Record<SituacaoDose, { rotulo: string; classe: string }> = {
  dada: { rotulo: 'Dada', classe: 'text-emerald-700 dark:text-emerald-400' },
  pulada: { rotulo: 'Pulada', classe: 'text-muted-foreground' },
  atrasada: { rotulo: 'Atrasada', classe: 'text-amber-700 dark:text-amber-400' },
  agora: { rotulo: 'Agora', classe: 'text-primary' },
  proxima: { rotulo: 'Em breve', classe: 'text-sky-700 dark:text-sky-400' },
  mais_tarde: { rotulo: 'Mais tarde', classe: 'text-muted-foreground' },
}

interface Props {
  espacoId: string
  podeEscrever: boolean
  /** Na tela Hoje: some quando não há remédio cadastrado. */
  esconderSeVazio?: boolean
}

export default function RemediosHoje({ espacoId, podeEscrever, esconderSeVazio }: Props) {
  const [medicacoes, setMedicacoes] = useState<MedicacaoRecord[]>([])
  const [doses, setDoses] = useState<DoseRecord[]>([])
  const [agora, setAgora] = useState(() => new Date())
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [carregado, setCarregado] = useState(false)

  const recarregar = useCallback(async () => {
    const [m, d] = await Promise.all([listarMedicacoes(espacoId), listarDosesRecentes(espacoId)])
    setMedicacoes(m)
    setDoses(d)
    setCarregado(true)
  }, [espacoId])

  useEffect(() => {
    recarregar()
    const desligar = acompanharRemedios(espacoId, recarregar)
    const relogio = setInterval(() => setAgora(new Date()), 30_000)
    return () => {
      desligar()
      clearInterval(relogio)
    }
  }, [espacoId, recarregar])

  const doDia = useMemo(() => dosesDoDia({ medicacoes, doses, agora }), [medicacoes, doses, agora])
  const sos = medicacoes.filter((m) => m.ativo && m.tipo === 'sos')
  const meuId = pb.authStore.record?.id

  const dar = async (medId: string, previsto: string, status: 'dada' | 'pulada' = 'dada') => {
    setOcupado(`${medId}|${previsto}`)
    try {
      await registrarDose(espacoId, medId, previsto, status)
      await recarregar()
    } catch (err) {
      toast({ title: 'Não registrou', description: (err as Error).message, variant: 'destructive' })
      await recarregar()
    } finally {
      setOcupado(null)
    }
  }

  const desfazer = async (dose: DoseRecord | undefined) => {
    if (!dose) return
    try {
      await desfazerDose(dose.id)
      await recarregar()
    } catch (err) {
      toast({ title: 'Não desfez', description: (err as Error).message, variant: 'destructive' })
    }
  }

  if (!carregado) return null
  if (esconderSeVazio && doDia.length === 0 && sos.length === 0) return null

  const linha = (d: DoseDoDia) => {
    const e = ESTILO[d.situacao]
    const reg = d.registro as DoseRecord | undefined
    const pendente = d.situacao === 'agora' || d.situacao === 'atrasada' || d.situacao === 'proxima' || d.situacao === 'mais_tarde'
    const destaque = d.situacao === 'agora' || d.situacao === 'atrasada'
    return (
      <li
        key={`${d.medicacao.id}|${d.previsto}`}
        className={`flex items-center gap-3 py-2.5 ${destaque ? '' : ''}`}
      >
        <span className="text-sm font-black tabular-nums w-12 text-foreground">{d.horario}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-foreground leading-tight truncate">{d.medicacao.nome}</p>
          <p className="text-[11px] text-muted-foreground truncate">
            {d.medicacao.dose}
            {reg ? ` · ${reg.criador_nome || 'Família'} às ${horaLocal(reg.dada_em)}` : ''}
          </p>
        </div>
        {pendente && podeEscrever ? (
          <div className="flex items-center gap-1.5">
            <span className={`text-[10px] font-bold ${e.classe}`}>{e.rotulo}</span>
            <Button
              type="button"
              size="sm"
              variant={destaque ? 'default' : 'outline'}
              disabled={ocupado === `${d.medicacao.id}|${d.previsto}`}
              onClick={() => dar(d.medicacao.id, d.previsto)}
              className="h-9 rounded-xl text-xs font-bold gap-1 px-3"
            >
              <Check className="w-3.5 h-3.5" /> Dei
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <span className={`text-[11px] font-bold ${e.classe}`}>{e.rotulo}</span>
            {reg && podeEscrever && reg.criador === meuId && (
              <button
                type="button"
                onClick={() => desfazer(reg)}
                className="p-1 text-muted-foreground hover:text-foreground"
                aria-label={`Desfazer ${d.medicacao.nome} das ${d.horario}`}
                title="Desfazer"
              >
                <Undo2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </li>
    )
  }

  const faltam = doDia.filter((d) => d.situacao === 'agora' || d.situacao === 'atrasada').length

  return (
    <section className="bg-card rounded-[24px] p-4 border border-border shadow-sm" aria-label="Remédios de hoje">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-sm font-black text-foreground flex items-center gap-2">
          <Pill className="w-4 h-4 text-primary" />
          Remédios de hoje
          {faltam > 0 && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
              {faltam} para dar
            </span>
          )}
        </h2>
        <Link to="/saude?aba=remedios" className="text-[11px] font-bold text-primary">
          Gerenciar
        </Link>
      </div>

      {doDia.length === 0 && sos.length === 0 && (
        <p className="text-xs text-muted-foreground py-3">
          Nenhum remédio cadastrado. Cadastre a vitamina D ou o que a pediatra receitar em
          Saúde → Remédios.
        </p>
      )}

      {doDia.length > 0 && <ul className="divide-y divide-border">{doDia.map(linha)}</ul>}

      {sos.length > 0 && (
        <div className="mt-2 pt-2 border-t border-border space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Se necessário
          </p>
          {sos.map((m) => {
            const s = situacaoSos(m, doses, agora)
            return (
              <div key={m.id} className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-foreground truncate">{m.nome}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {m.dose}
                    {s.ultima ? ` · última às ${horaLocal(s.ultima.dada_em)} (${s.ultima.criador_nome || 'Família'})` : ''}
                  </p>
                  {!s.podeAgora && s.liberadaEm && (
                    <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> Próxima só a partir das{' '}
                      {horaLocal(s.liberadaEm.toISOString())}
                    </p>
                  )}
                </div>
                {podeEscrever && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={ocupado === `${m.id}|`}
                    onClick={() => {
                      if (
                        !s.podeAgora &&
                        !window.confirm(
                          `Ainda não passaram ${m.intervalo_min_horas} h desde a última dose de ${m.nome}. Registrar mesmo assim?`,
                        )
                      )
                        return
                      dar(m.id, '')
                    }}
                    className="h-9 rounded-xl text-xs font-bold gap-1 px-3"
                  >
                    <Check className="w-3.5 h-3.5" /> Dei agora
                  </Button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
