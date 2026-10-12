// src/components/saude/AbaVacinas.tsx
// Calendário vacinal com o status de cada dose, registro (data, lote, local),
// vacinas extras (rede particular) e exportação para a agenda do celular.

import { useMemo, useState } from 'react'
import { CalendarPlus, Check, ChevronDown, Plus, Syringe, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from '@/hooks/use-toast'
import {
  AVISO_CALENDARIO,
  eventosDeVacina,
  gerarIcs,
  rotuloIdade,
  type DoseComStatus,
  type StatusDose,
} from '@/lib/regras/vacinas'
import { formatarDataBr } from '@/lib/regras/consulta'
import { novoIdLocal } from '@/lib/offline/id'
import { excluir, registrarVacina, type VacinaRecord } from '@/services/saude'

const CHIP: Record<StatusDose, { texto: string; classe: string }> = {
  aplicada: {
    texto: 'Aplicada',
    classe: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300',
  },
  agora: {
    texto: 'Pode tomar',
    classe: 'bg-primary/15 text-primary',
  },
  atrasada: {
    texto: 'Atrasada',
    classe: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300',
  },
  proxima: {
    texto: 'Em breve',
    classe: 'bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300',
  },
  futura: { texto: 'Futura', classe: 'bg-muted text-muted-foreground' },
  prazo_encerrado: { texto: 'Prazo encerrado', classe: 'bg-muted text-muted-foreground' },
}

interface Props {
  espacoId: string
  nomeBebe: string
  hoje: string
  doses: DoseComStatus[]
  extras: VacinaRecord[]
  registros: VacinaRecord[]
  podeEscrever: boolean
  podeApagarTudo: boolean
  meuId: string
  aoMudar: () => void
}

export default function AbaVacinas({
  espacoId,
  nomeBebe,
  hoje,
  doses,
  extras,
  registros,
  podeEscrever,
  podeApagarTudo,
  meuId,
  aoMudar,
}: Props) {
  const [aberta, setAberta] = useState<string | null>(null)
  const [data, setData] = useState(hoje)
  const [lote, setLote] = useState('')
  const [local, setLocal] = useState('')
  const [nomeExtra, setNomeExtra] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [mostrarFuturas, setMostrarFuturas] = useState(false)

  const grupos = useMemo(() => {
    const m = new Map<number, DoseComStatus[]>()
    for (const d of doses) m.set(d.idadeMeses, [...(m.get(d.idadeMeses) || []), d])
    return [...m.entries()].sort(([a], [b]) => a - b)
  }, [doses])

  const porId = useMemo(() => new Map(registros.map((r) => [r.id, r])), [registros])

  const abrir = (id: string) => {
    setAberta(aberta === id ? null : id)
    setData(hoje)
    setLote('')
    setLocal('')
    setNomeExtra('')
  }

  const salvar = async (doseId: string, nome?: string) => {
    if (!data || data > hoje) {
      toast({ title: 'Data inválida', description: 'A data não pode ser no futuro.', variant: 'destructive' })
      return
    }
    setSalvando(true)
    try {
      await registrarVacina(espacoId, {
        dose_id: doseId,
        aplicada_em: data,
        lote: lote.trim(),
        local: local.trim(),
        nome,
      })
      toast({ title: 'Vacina registrada', description: formatarDataBr(data) })
      setAberta(null)
      aoMudar()
    } catch (err) {
      toast({ title: 'Não salvou', description: (err as Error).message, variant: 'destructive' })
    } finally {
      setSalvando(false)
    }
  }

  const remover = async (registroId: string) => {
    if (!window.confirm('Apagar este registro de vacina?')) return
    try {
      await excluir('vacinas', registroId)
      aoMudar()
    } catch (err) {
      toast({ title: 'Não apagou', description: (err as Error).message, variant: 'destructive' })
    }
  }

  const exportarAgenda = async () => {
    const eventos = eventosDeVacina(doses, nomeBebe, hoje)
    if (!eventos.length) {
      toast({ title: 'Nada a agendar', description: 'Todas as doses do calendário já estão registradas.' })
      return
    }
    const ics = gerarIcs(eventos)
    const arquivo = new File([ics], `vacinas-${nomeBebe.toLowerCase()}.ics`, { type: 'text/calendar' })
    try {
      if (navigator.canShare?.({ files: [arquivo] })) {
        await navigator.share({ files: [arquivo], title: `Vacinas da ${nomeBebe}` })
        return
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
    }
    const url = URL.createObjectURL(arquivo)
    const a = document.createElement('a')
    a.href = url
    a.download = arquivo.name
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
    toast({
      title: 'Agenda baixada',
      description: 'Abra o arquivo para adicionar as datas ao calendário do celular.',
    })
  }

  const podeApagar = (r?: VacinaRecord) => !!r && podeEscrever && (podeApagarTudo || r.criador === meuId)

  const formulario = (doseId: string, extra = false) => (
    <div className="mt-3 space-y-2 rounded-2xl bg-muted/40 p-3">
      {extra && (
        <Input
          placeholder="Nome da vacina (ex.: Meningocócica B)"
          value={nomeExtra}
          onChange={(e) => setNomeExtra(e.target.value)}
          className="h-10 rounded-xl text-sm"
          maxLength={100}
        />
      )}
      <div className="grid grid-cols-2 gap-2">
        <label className="text-[11px] font-semibold text-muted-foreground space-y-1">
          <span>Data</span>
          <Input
            type="date"
            value={data}
            max={hoje}
            onChange={(e) => setData(e.target.value)}
            className="h-10 rounded-xl text-sm"
          />
        </label>
        <label className="text-[11px] font-semibold text-muted-foreground space-y-1">
          <span>Lote (opcional)</span>
          <Input
            value={lote}
            onChange={(e) => setLote(e.target.value)}
            className="h-10 rounded-xl text-sm"
            maxLength={60}
          />
        </label>
      </div>
      <Input
        placeholder="Local (UBS, clínica, maternidade)"
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        className="h-10 rounded-xl text-sm"
        maxLength={120}
      />
      <Button
        type="button"
        disabled={salvando || (extra && nomeExtra.trim().length < 2)}
        onClick={() => salvar(doseId, extra ? nomeExtra.trim() : undefined)}
        className="w-full h-10 rounded-xl text-xs font-bold"
      >
        {salvando ? 'Salvando...' : 'Registrar vacina'}
      </Button>
    </div>
  )

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={exportarAgenda}
          className="flex-1 h-11 rounded-2xl text-xs font-bold gap-2"
        >
          <CalendarPlus className="w-4 h-4" />
          Pôr as datas na agenda do celular
        </Button>
      </div>

      {grupos.map(([meses, lista]) => {
        const todasFuturas = lista.every((d) => d.status === 'futura')
        if (todasFuturas && !mostrarFuturas && meses > 0) return null
        return (
          <section key={meses} className="bg-card rounded-[22px] p-4 border border-border shadow-sm">
            <div className="flex items-baseline justify-between mb-2">
              <h3 className="text-sm font-black text-foreground">{rotuloIdade(meses)}</h3>
              <span className="text-[11px] text-muted-foreground">{formatarDataBr(lista[0].data)}</span>
            </div>
            <ul className="divide-y divide-border">
              {lista.map((d) => {
                const reg = d.registroId ? porId.get(d.registroId) : undefined
                const chip = CHIP[d.status]
                return (
                  <li key={d.id} className="py-2.5">
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-foreground leading-tight">
                          {d.vacina} <span className="font-medium text-muted-foreground">· {d.dose}</span>
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">{d.protege}</p>
                        {d.status === 'aplicada' && reg && (
                          <p className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-1 font-semibold">
                            Aplicada em {formatarDataBr(reg.aplicada_em)}
                            {reg.lote ? ` · lote ${reg.lote}` : ''}
                            {reg.local ? ` · ${reg.local}` : ''}
                          </p>
                        )}
                        {d.nota && d.status !== 'aplicada' && (
                          <p className="text-[11px] text-muted-foreground mt-1 italic">{d.nota}</p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${chip.classe}`}>
                          {chip.texto}
                        </span>
                        {d.status === 'aplicada' && podeApagar(reg) && (
                          <button
                            type="button"
                            onClick={() => remover(reg!.id)}
                            className="text-muted-foreground hover:text-destructive p-1"
                            aria-label={`Apagar registro de ${d.vacina} ${d.dose}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {d.status !== 'aplicada' && podeEscrever && (
                          <button
                            type="button"
                            onClick={() => abrir(d.id)}
                            className="text-[11px] font-bold text-primary flex items-center gap-1"
                            aria-expanded={aberta === d.id}
                          >
                            <Check className="w-3.5 h-3.5" />
                            Registrar
                          </button>
                        )}
                      </div>
                    </div>
                    {aberta === d.id && formulario(d.id)}
                  </li>
                )
              })}
            </ul>
          </section>
        )
      })}

      <Button
        type="button"
        variant="ghost"
        onClick={() => setMostrarFuturas(!mostrarFuturas)}
        className="w-full h-10 rounded-2xl text-xs font-bold gap-1 text-muted-foreground"
      >
        <ChevronDown className={`w-4 h-4 transition-transform ${mostrarFuturas ? 'rotate-180' : ''}`} />
        {mostrarFuturas ? 'Esconder doses futuras' : 'Ver o calendário completo até 4 anos'}
      </Button>

      <section className="bg-card rounded-[22px] p-4 border border-border shadow-sm space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black text-foreground flex items-center gap-2">
            <Syringe className="w-4 h-4 text-primary" />
            Outras vacinas
          </h3>
          {podeEscrever && (
            <button
              type="button"
              onClick={() => abrir('extra')}
              className="text-[11px] font-bold text-primary flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              Adicionar
            </button>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground">
          Vacinas da rede particular ou doses extras (ex.: Meningocócica B, 3ª dose de Covid-19).
        </p>
        {aberta === 'extra' && formulario(`extra-${novoIdLocal()}`, true)}
        {extras.length > 0 && (
          <ul className="divide-y divide-border">
            {extras.map((r) => (
              <li key={r.id} className="py-2 flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-bold text-foreground">{r.nome || 'Vacina'}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {formatarDataBr(r.aplicada_em)}
                    {r.lote ? ` · lote ${r.lote}` : ''}
                    {r.local ? ` · ${r.local}` : ''}
                  </p>
                </div>
                {podeApagar(r) && (
                  <button
                    type="button"
                    onClick={() => remover(r.id)}
                    className="text-muted-foreground hover:text-destructive p-1"
                    aria-label={`Apagar ${r.nome}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-[11px] text-muted-foreground leading-relaxed px-1">{AVISO_CALENDARIO}</p>
    </div>
  )
}
