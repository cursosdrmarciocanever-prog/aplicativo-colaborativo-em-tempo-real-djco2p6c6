// src/components/saude/AbaRemedios.tsx
// Cadastro dos remédios e vitaminas (como a pediatra receitou) + doses de hoje.

import { useCallback, useEffect, useState } from 'react'
import { Pause, Pencil, Play, Plus, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/hooks/use-toast'
import RemediosHoje from '@/components/remedios/RemediosHoje'
import {
  INTERVALOS_HORAS,
  descreverHorarios,
  horarioValido,
  horariosPorIntervalo,
  normalizarHorarios,
  type TipoMedicacao,
} from '@/lib/regras/medicacoes'
import { formatarDataBr } from '@/lib/regras/consulta'
import { somarDias } from '@/lib/regras/vacinas'
import {
  acompanharRemedios,
  excluirMedicacao,
  listarMedicacoes,
  salvarMedicacao,
  type MedicacaoRecord,
} from '@/services/remedios'

const SUGESTOES = ['Vitamina D', 'Ferro (sulfato ferroso)', 'Simeticona', 'Paracetamol', 'Dipirona']

type Modo = 'horarios' | 'intervalo' | 'sos'

interface Form {
  nome: string
  dose: string
  modo: Modo
  horarios: string[]
  novoHorario: string
  primeira: string
  intervalo: number
  intervaloSos: string
  inicio: string
  duracaoDias: string // vazio = uso contínuo
  observacao: string
}

const vazio = (hoje: string): Form => ({
  nome: '',
  dose: '',
  modo: 'horarios',
  horarios: ['09:00'],
  novoHorario: '',
  primeira: '08:00',
  intervalo: 8,
  intervaloSos: '',
  inicio: hoje,
  duracaoDias: '',
  observacao: '',
})

interface Props {
  espacoId: string
  hoje: string
  podeEscrever: boolean
  podeApagarTudo: boolean
  meuId: string
}

export default function AbaRemedios({ espacoId, hoje, podeEscrever, podeApagarTudo, meuId }: Props) {
  const [lista, setLista] = useState<MedicacaoRecord[]>([])
  const [aberto, setAberto] = useState(false)
  const [editando, setEditando] = useState<string | null>(null)
  const [form, setForm] = useState<Form>(() => vazio(hoje))
  const [salvando, setSalvando] = useState(false)

  const recarregar = useCallback(() => listarMedicacoes(espacoId).then(setLista), [espacoId])
  useEffect(() => {
    recarregar()
    return acompanharRemedios(espacoId, recarregar)
  }, [espacoId, recarregar])

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }))

  const novo = () => {
    setEditando(null)
    setForm(vazio(hoje))
    setAberto(true)
  }

  const editar = (m: MedicacaoRecord) => {
    const h = normalizarHorarios(m.horarios || [])
    const n = h.length
    const regular =
      n > 1 && 24 % n === 0 && horariosPorIntervalo(h[0], 24 / n).join() === h.join()
    setEditando(m.id)
    setForm({
      ...vazio(hoje),
      nome: m.nome,
      dose: m.dose,
      modo: m.tipo === 'sos' ? 'sos' : regular ? 'intervalo' : 'horarios',
      horarios: h.length ? h : ['09:00'],
      primeira: h[0] || '08:00',
      intervalo: regular ? 24 / n : 8,
      intervaloSos: m.intervalo_min_horas ? String(m.intervalo_min_horas) : '',
      inicio: m.inicio,
      duracaoDias: m.fim ? String(diasEntreInclusive(m.inicio, m.fim)) : '',
      observacao: m.observacao || '',
    })
    setAberto(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const horariosDoForm = (): string[] =>
    form.modo === 'intervalo'
      ? horariosPorIntervalo(form.primeira, form.intervalo)
      : form.modo === 'horarios'
        ? normalizarHorarios(form.horarios)
        : []

  const salvar = async () => {
    const horarios = horariosDoForm()
    const tipo: TipoMedicacao = form.modo === 'sos' ? 'sos' : 'fixo'
    const dias = form.duracaoDias ? parseInt(form.duracaoDias, 10) : 0
    const erros: string[] = []
    if (form.nome.trim().length < 2) erros.push('Informe o nome.')
    if (!form.dose.trim()) erros.push('Informe a dose como a pediatra receitou (ex.: 2 gotas).')
    if (tipo === 'fixo' && horarios.length === 0) erros.push('Escolha pelo menos um horário.')
    if (form.duracaoDias && !(dias >= 1 && dias <= 365)) erros.push('Duração: de 1 a 365 dias.')
    if (erros.length) {
      toast({ title: 'Confira os dados', description: erros.join(' '), variant: 'destructive' })
      return
    }
    setSalvando(true)
    try {
      await salvarMedicacao(
        espacoId,
        {
          nome: form.nome.trim(),
          dose: form.dose.trim(),
          tipo,
          horarios,
          intervalo_min_horas: tipo === 'sos' && form.intervaloSos ? Number(form.intervaloSos) : null,
          inicio: form.inicio,
          fim: dias ? somarDias(form.inicio, dias - 1) : '',
          observacao: form.observacao.trim(),
        },
        editando || undefined,
      )
      toast({ title: editando ? 'Remédio atualizado' : 'Remédio cadastrado' })
      setAberto(false)
      setEditando(null)
      recarregar()
    } catch (err) {
      toast({ title: 'Não salvou', description: (err as Error).message, variant: 'destructive' })
    } finally {
      setSalvando(false)
    }
  }

  const alternarAtivo = async (m: MedicacaoRecord) => {
    try {
      await salvarMedicacao(espacoId, { ativo: !m.ativo }, m.id)
      recarregar()
    } catch (err) {
      toast({ title: 'Não alterou', description: (err as Error).message, variant: 'destructive' })
    }
  }

  const apagar = async (m: MedicacaoRecord) => {
    if (!window.confirm(`Apagar ${m.nome} e o histórico de doses? Para só parar, use "Pausar".`)) return
    try {
      await excluirMedicacao(m.id)
      recarregar()
    } catch (err) {
      toast({ title: 'Não apagou', description: (err as Error).message, variant: 'destructive' })
    }
  }

  const previa = horariosDoForm()

  return (
    <div className="space-y-4">
      <RemediosHoje espacoId={espacoId} podeEscrever={podeEscrever} />

      {podeEscrever && !aberto && (
        <Button type="button" onClick={novo} className="w-full h-12 rounded-2xl text-sm font-bold gap-2">
          <Plus className="w-4 h-4" /> Cadastrar remédio ou vitamina
        </Button>
      )}

      {aberto && (
        <div className="bg-card rounded-[22px] p-4 border border-primary/40 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-foreground">{editando ? 'Editar remédio' : 'Novo remédio'}</h3>
            <button type="button" onClick={() => setAberto(false)} aria-label="Fechar" className="p-1 text-muted-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>

          {!editando && (
            <div className="flex flex-wrap gap-1.5">
              {SUGESTOES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => set('nome', s)}
                  className={`h-8 px-3 rounded-full text-[11px] font-bold border ${
                    form.nome === s ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-foreground'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          )}
          <Input
            placeholder="Nome (ex.: Vitamina D)"
            value={form.nome}
            onChange={(e) => set('nome', e.target.value)}
            maxLength={80}
            className="h-10 rounded-xl text-sm"
          />
          <Input
            placeholder="Dose como a pediatra receitou (ex.: 2 gotas, 400 UI, 2,5 mL)"
            value={form.dose}
            onChange={(e) => set('dose', e.target.value)}
            maxLength={80}
            className="h-10 rounded-xl text-sm"
          />

          <div className="grid grid-cols-3 gap-1.5 bg-muted/50 p-1 rounded-2xl" role="radiogroup" aria-label="Quando dar">
            {(
              [
                ['horarios', 'Horários'],
                ['intervalo', 'A cada N h'],
                ['sos', 'Se necessário'],
              ] as const
            ).map(([v, r]) => (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={form.modo === v}
                onClick={() => set('modo', v)}
                className={`h-9 rounded-xl text-[11px] font-bold ${
                  form.modo === v ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
                }`}
              >
                {r}
              </button>
            ))}
          </div>

          {form.modo === 'horarios' && (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-1.5">
                {normalizarHorarios(form.horarios).map((h) => (
                  <span key={h} className="h-8 pl-3 pr-1 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center gap-1">
                    {h}
                    <button
                      type="button"
                      onClick={() => set('horarios', form.horarios.filter((x) => x !== h))}
                      aria-label={`Tirar ${h}`}
                      className="p-1"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  type="time"
                  value={form.novoHorario}
                  onChange={(e) => set('novoHorario', e.target.value)}
                  className="h-10 rounded-xl text-sm"
                  aria-label="Novo horário"
                />
                <Button
                  type="button"
                  variant="outline"
                  disabled={!horarioValido(form.novoHorario)}
                  onClick={() => {
                    set('horarios', [...form.horarios, form.novoHorario])
                    set('novoHorario', '')
                  }}
                  className="h-10 rounded-xl text-xs font-bold"
                >
                  Adicionar
                </Button>
              </div>
            </div>
          )}

          {form.modo === 'intervalo' && (
            <div className="grid grid-cols-2 gap-2">
              <label className="text-[11px] font-semibold text-muted-foreground space-y-1">
                <span>A cada</span>
                <select
                  value={form.intervalo}
                  onChange={(e) => set('intervalo', Number(e.target.value))}
                  className="h-10 w-full rounded-xl border border-input bg-background px-2 text-sm text-foreground"
                >
                  {INTERVALOS_HORAS.map((h) => (
                    <option key={h} value={h}>
                      {h} horas
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-[11px] font-semibold text-muted-foreground space-y-1">
                <span>Primeira dose às</span>
                <Input type="time" value={form.primeira} onChange={(e) => set('primeira', e.target.value)} className="h-10 rounded-xl text-sm" />
              </label>
            </div>
          )}

          {form.modo === 'sos' && (
            <label className="text-[11px] font-semibold text-muted-foreground space-y-1 block">
              <span>Intervalo mínimo entre doses (horas, como a pediatra orientou)</span>
              <Input
                inputMode="numeric"
                value={form.intervaloSos}
                onChange={(e) => set('intervaloSos', e.target.value.replace(/\D/g, '').slice(0, 2))}
                className="h-10 rounded-xl text-sm"
                placeholder="ex.: 6"
              />
            </label>
          )}

          {form.modo !== 'sos' && (
            <p className="text-[11px] text-muted-foreground">
              {previa.length ? descreverHorarios({ tipo: 'fixo', horarios: previa }) : 'Escolha os horários.'}
            </p>
          )}

          <div className="grid grid-cols-2 gap-2">
            <label className="text-[11px] font-semibold text-muted-foreground space-y-1">
              <span>Começa em</span>
              <Input type="date" value={form.inicio} onChange={(e) => set('inicio', e.target.value)} className="h-10 rounded-xl text-sm" />
            </label>
            <label className="text-[11px] font-semibold text-muted-foreground space-y-1">
              <span>Por quantos dias</span>
              <Input
                inputMode="numeric"
                placeholder="contínuo"
                value={form.duracaoDias}
                onChange={(e) => set('duracaoDias', e.target.value.replace(/\D/g, '').slice(0, 3))}
                className="h-10 rounded-xl text-sm"
              />
            </label>
          </div>
          <Textarea
            placeholder="Observação (ex.: dar antes da mamada, agitar o frasco)"
            value={form.observacao}
            onChange={(e) => set('observacao', e.target.value)}
            maxLength={1000}
            className="min-h-[60px] rounded-xl text-sm"
          />
          <Button type="button" disabled={salvando} onClick={salvar} className="w-full h-11 rounded-xl font-bold">
            {salvando ? 'Salvando...' : 'Salvar'}
          </Button>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Use sempre o remédio, a dose e os horários que a pediatra receitou. O app só lembra e
            registra.
          </p>
        </div>
      )}

      {lista.length > 0 && (
        <section className="bg-card rounded-[22px] px-4 py-1 border border-border shadow-sm">
          <ul className="divide-y divide-border">
            {lista.map((m) => {
              const acabou = !!m.fim && m.fim < hoje
              const podeApagar = podeEscrever && (podeApagarTudo || m.criador === meuId)
              return (
                <li key={m.id} className={`py-3 ${m.ativo && !acabou ? '' : 'opacity-60'}`}>
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-foreground">
                        {m.nome} <span className="font-medium text-muted-foreground">· {m.dose}</span>
                      </p>
                      <p className="text-[11px] text-muted-foreground">{descreverHorarios(m)}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {!m.ativo
                          ? 'Pausado'
                          : acabou
                            ? `Terminou em ${formatarDataBr(m.fim)}`
                            : m.fim
                              ? `De ${formatarDataBr(m.inicio)} a ${formatarDataBr(m.fim)}`
                              : `Desde ${formatarDataBr(m.inicio)} · uso contínuo`}
                      </p>
                      {m.observacao && <p className="text-[11px] text-foreground mt-1 italic">{m.observacao}</p>}
                    </div>
                    {podeEscrever && (
                      <div className="flex items-center gap-0.5 shrink-0">
                        <button type="button" onClick={() => editar(m)} className="p-2 text-muted-foreground hover:text-foreground" aria-label={`Editar ${m.nome}`}>
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => alternarAtivo(m)}
                          className="p-2 text-muted-foreground hover:text-foreground"
                          aria-label={m.ativo ? `Pausar ${m.nome}` : `Retomar ${m.nome}`}
                          title={m.ativo ? 'Pausar' : 'Retomar'}
                        >
                          {m.ativo ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                        </button>
                        {podeApagar && (
                          <button type="button" onClick={() => apagar(m)} className="p-2 text-muted-foreground hover:text-destructive" aria-label={`Apagar ${m.nome}`}>
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      )}
    </div>
  )
}

function diasEntreInclusive(a: string, b: string): number {
  const [x, y, z] = a.split('-').map(Number)
  const [p, q, r] = b.split('-').map(Number)
  return Math.round((Date.UTC(p, q - 1, r) - Date.UTC(x, y - 1, z)) / 86400000) + 1
}
