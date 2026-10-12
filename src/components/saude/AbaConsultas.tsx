// src/components/saude/AbaConsultas.tsx
// Registro de consultas: data, tipo, profissional, medidas (peso, comprimento, PC),
// orientações e próxima consulta. As medidas alimentam as curvas de crescimento.

import { useState } from 'react'
import { CalendarClock, ChevronDown, Pencil, Plus, Ruler, Stethoscope, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/hooks/use-toast'
import { formatarDataBr, formatarNumero, lerNumero, lerPesoEmGramas } from '@/lib/regras/consulta'
import {
  excluir,
  salvarConsulta,
  type ConsultaRecord,
  type TipoConsulta,
} from '@/services/saude'

const TIPOS: { valor: TipoConsulta; rotulo: string }[] = [
  { valor: 'rotina', rotulo: 'Rotina (puericultura)' },
  { valor: 'retorno', rotulo: 'Retorno' },
  { valor: 'urgencia', rotulo: 'Urgência / pronto-socorro' },
  { valor: 'especialista', rotulo: 'Especialista' },
]

const ROTULO_TIPO = Object.fromEntries(TIPOS.map((t) => [t.valor, t.rotulo])) as Record<TipoConsulta, string>

interface Props {
  espacoId: string
  hoje: string
  consultas: ConsultaRecord[]
  podeEscrever: boolean
  podeApagarTudo: boolean
  meuId: string
  aoMudar: () => void
}

interface Form {
  data: string
  tipo: TipoConsulta
  profissional: string
  peso: string
  comprimento: string
  pc: string
  orientacoes: string
  proxima: string
}

const vazio = (hoje: string, profissional = ''): Form => ({
  data: hoje,
  tipo: 'rotina',
  profissional,
  peso: '',
  comprimento: '',
  pc: '',
  orientacoes: '',
  proxima: '',
})

export default function AbaConsultas({
  espacoId,
  hoje,
  consultas,
  podeEscrever,
  podeApagarTudo,
  meuId,
  aoMudar,
}: Props) {
  const [aberto, setAberto] = useState(false)
  const [editando, setEditando] = useState<string | null>(null)
  const [form, setForm] = useState<Form>(() => vazio(hoje))
  const [salvando, setSalvando] = useState(false)
  const [expandida, setExpandida] = useState<string | null>(null)

  const campo = (k: keyof Form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  const novo = () => {
    setEditando(null)
    // Sugere o mesmo profissional da última consulta
    setForm(vazio(hoje, consultas[0]?.profissional || ''))
    setAberto(true)
  }

  const editar = (c: ConsultaRecord) => {
    setEditando(c.id)
    setForm({
      data: c.data,
      tipo: c.tipo,
      profissional: c.profissional || '',
      peso: c.peso_g ? formatarNumero(c.peso_g / 1000, 3) : '',
      comprimento: c.comprimento_cm ? formatarNumero(c.comprimento_cm, 1) : '',
      pc: c.perimetro_cefalico_cm ? formatarNumero(c.perimetro_cefalico_cm, 1) : '',
      orientacoes: c.orientacoes || '',
      proxima: c.proxima_consulta || '',
    })
    setAberto(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const salvar = async () => {
    const peso_g = lerPesoEmGramas(form.peso)
    const comprimento_cm = lerNumero(form.comprimento)
    const perimetro_cefalico_cm = lerNumero(form.pc)
    const erros: string[] = []
    if (!form.data || form.data > hoje) erros.push('A data da consulta não pode ser no futuro.')
    if (form.peso && (!peso_g || peso_g < 500 || peso_g > 30000)) erros.push('Peso: use kg (ex.: 3,45).')
    if (form.comprimento && (!comprimento_cm || comprimento_cm < 30 || comprimento_cm > 130))
      erros.push('Comprimento: use cm (ex.: 50,5).')
    if (form.pc && (!perimetro_cefalico_cm || perimetro_cefalico_cm < 20 || perimetro_cefalico_cm > 60))
      erros.push('Perímetro cefálico: use cm (ex.: 35).')
    if (form.proxima && form.proxima < form.data) erros.push('A próxima consulta deve ser depois desta.')
    if (erros.length) {
      toast({ title: 'Confira os dados', description: erros.join(' '), variant: 'destructive' })
      return
    }
    setSalvando(true)
    try {
      await salvarConsulta(
        espacoId,
        {
          data: form.data,
          tipo: form.tipo,
          profissional: form.profissional.trim(),
          peso_g,
          comprimento_cm,
          perimetro_cefalico_cm,
          orientacoes: form.orientacoes.trim(),
          proxima_consulta: form.proxima,
        },
        editando || undefined,
      )
      toast({ title: editando ? 'Consulta atualizada' : 'Consulta registrada' })
      setAberto(false)
      setEditando(null)
      aoMudar()
    } catch (err) {
      toast({ title: 'Não salvou', description: (err as Error).message, variant: 'destructive' })
    } finally {
      setSalvando(false)
    }
  }

  const remover = async (c: ConsultaRecord) => {
    if (!window.confirm(`Apagar a consulta de ${formatarDataBr(c.data)}?`)) return
    try {
      await excluir('consultas', c.id)
      aoMudar()
    } catch (err) {
      toast({ title: 'Não apagou', description: (err as Error).message, variant: 'destructive' })
    }
  }

  const proximaMarcada = consultas
    .map((c) => c.proxima_consulta)
    .filter((d): d is string => !!d && d >= hoje)
    .sort()[0]

  return (
    <div className="space-y-4">
      {proximaMarcada && (
        <div className="flex items-center gap-3 rounded-[22px] border border-primary/30 bg-primary/5 p-4">
          <CalendarClock className="w-5 h-5 text-primary shrink-0" />
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-primary">Próxima consulta</p>
            <p className="text-sm font-bold text-foreground">{formatarDataBr(proximaMarcada)}</p>
          </div>
        </div>
      )}

      {podeEscrever && !aberto && (
        <Button type="button" onClick={novo} className="w-full h-12 rounded-2xl text-sm font-bold gap-2">
          <Plus className="w-4 h-4" />
          Registrar consulta
        </Button>
      )}

      {aberto && (
        <div className="bg-card rounded-[22px] p-4 border border-primary/40 shadow-sm space-y-3">
          <h3 className="text-sm font-black text-foreground">
            {editando ? 'Editar consulta' : 'Nova consulta'}
          </h3>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-[11px] font-semibold text-muted-foreground space-y-1">
              <span>Data</span>
              <Input type="date" max={hoje} value={form.data} onChange={campo('data')} className="h-10 rounded-xl text-sm" />
            </label>
            <label className="text-[11px] font-semibold text-muted-foreground space-y-1">
              <span>Tipo</span>
              <select
                value={form.tipo}
                onChange={campo('tipo')}
                className="h-10 w-full rounded-xl border border-input bg-background px-2 text-sm text-foreground"
              >
                {TIPOS.map((t) => (
                  <option key={t.valor} value={t.valor}>
                    {t.rotulo}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <Input
            placeholder="Pediatra / profissional"
            value={form.profissional}
            onChange={campo('profissional')}
            maxLength={120}
            className="h-10 rounded-xl text-sm"
          />

          <div>
            <p className="text-[11px] font-bold text-muted-foreground mb-1 flex items-center gap-1">
              <Ruler className="w-3.5 h-3.5" /> Medidas (opcional)
            </p>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  ['peso', 'Peso (kg)', '3,45'],
                  ['comprimento', 'Compr. (cm)', '50,5'],
                  ['pc', 'PC (cm)', '35'],
                ] as const
              ).map(([k, rotulo, ex]) => (
                <label key={k} className="text-[11px] font-semibold text-muted-foreground space-y-1">
                  <span>{rotulo}</span>
                  <Input
                    inputMode="decimal"
                    placeholder={ex}
                    value={form[k]}
                    onChange={campo(k)}
                    className="h-10 rounded-xl text-sm tabular-nums"
                  />
                </label>
              ))}
            </div>
          </div>

          <Textarea
            placeholder="Orientações da pediatra (alimentação, vitaminas, exames pedidos...)"
            value={form.orientacoes}
            onChange={campo('orientacoes')}
            maxLength={4000}
            className="min-h-[90px] rounded-xl text-sm"
          />
          <label className="text-[11px] font-semibold text-muted-foreground space-y-1 block">
            <span>Próxima consulta (opcional)</span>
            <Input type="date" min={form.data} value={form.proxima} onChange={campo('proxima')} className="h-10 rounded-xl text-sm" />
          </label>

          <div className="grid grid-cols-[1fr_auto] gap-2">
            <Button type="button" disabled={salvando} onClick={salvar} className="h-11 rounded-xl text-sm font-bold">
              {salvando ? 'Salvando...' : 'Salvar consulta'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setAberto(false)
                setEditando(null)
              }}
              className="h-11 rounded-xl text-sm"
            >
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {consultas.length === 0 && !aberto && (
        <p className="text-sm text-muted-foreground text-center py-6">
          Nenhuma consulta registrada ainda.
        </p>
      )}

      <ul className="space-y-2">
        {consultas.map((c) => {
          const aberta = expandida === c.id
          const medidas = [
            c.peso_g ? `${formatarNumero(c.peso_g / 1000, 3)} kg` : null,
            c.comprimento_cm ? `${formatarNumero(c.comprimento_cm, 1)} cm` : null,
            c.perimetro_cefalico_cm ? `PC ${formatarNumero(c.perimetro_cefalico_cm, 1)} cm` : null,
          ].filter(Boolean)
          const podeMexer = podeEscrever
          const podeApagar = podeEscrever && (podeApagarTudo || c.criador === meuId)
          return (
            <li key={c.id} className="bg-card rounded-[22px] border border-border shadow-sm">
              <button
                type="button"
                onClick={() => setExpandida(aberta ? null : c.id)}
                className="w-full text-left p-4 flex items-start gap-3"
                aria-expanded={aberta}
              >
                <div className="w-9 h-9 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <Stethoscope className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-foreground">
                    {formatarDataBr(c.data)} · {ROTULO_TIPO[c.tipo]}
                  </p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {[c.profissional, ...medidas].filter(Boolean).join(' · ') || 'Sem medidas'}
                  </p>
                </div>
                <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${aberta ? 'rotate-180' : ''}`} />
              </button>
              {aberta && (
                <div className="px-4 pb-4 space-y-2">
                  {c.orientacoes ? (
                    <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed bg-muted/40 rounded-2xl p-3">
                      {c.orientacoes}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">Sem orientações anotadas.</p>
                  )}
                  {c.proxima_consulta && (
                    <p className="text-xs text-muted-foreground">
                      Próxima consulta: <strong>{formatarDataBr(c.proxima_consulta)}</strong>
                    </p>
                  )}
                  <p className="text-[11px] text-muted-foreground">
                    Registrado por {c.criador_nome || 'Família'}
                  </p>
                  {(podeMexer || podeApagar) && (
                    <div className="flex gap-2 pt-1">
                      {podeMexer && (
                        <Button type="button" variant="outline" onClick={() => editar(c)} className="h-9 rounded-xl text-xs gap-1">
                          <Pencil className="w-3.5 h-3.5" /> Editar
                        </Button>
                      )}
                      {podeApagar && (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => remover(c)}
                          className="h-9 rounded-xl text-xs gap-1 text-destructive"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Apagar
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
