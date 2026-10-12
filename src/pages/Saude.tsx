// src/pages/Saude.tsx
// Rota /saude: painel de saúde (próxima vacina, últimas medidas, dúvidas), resumo para a
// consulta e as abas Vacinas, Crescimento, Consultas e Dúvidas.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  ClipboardCopy,
  ClipboardList,
  FileCheck2,
  MessageCircleQuestion,
  Pill,
  Ruler,
  Share2,
  Stethoscope,
  Syringe,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from '@/hooks/use-toast'
import { useAuth } from '@/contexts/AuthContext'
import { obterEspacoAtual, obterMeuPapel, type EspacoRecord, type Papel } from '@/services/baby'
import {
  acompanharSaude,
  listarConsultas,
  listarDuvidas,
  listarVacinas,
  type ConsultaRecord,
  type DuvidaRecord,
  type VacinaRecord,
} from '@/services/saude'
import { getLocalTodayDateString } from '@/lib/regras/fuso'
import { formatarIdadeAmigavel } from '@/lib/regras/idade'
import { avaliarCrescimento } from '@/lib/regras/crescimento'
import { resumoVacinal, rotuloIdade, statusDasDoses } from '@/lib/regras/vacinas'
import {
  formatarDataBr,
  formatarNumero,
  gerarResumoConsulta,
  pontosDeCrescimento,
  ultimasMedidas,
} from '@/lib/regras/consulta'
import AbaVacinas from '@/components/saude/AbaVacinas'
import AbaCrescimento from '@/components/saude/AbaCrescimento'
import AbaConsultas from '@/components/saude/AbaConsultas'
import AbaDuvidas from '@/components/saude/AbaDuvidas'

type Aba = 'vacinas' | 'crescimento' | 'consultas' | 'duvidas'

const ABAS: { id: Aba; rotulo: string; Icone: typeof Syringe }[] = [
  { id: 'vacinas', rotulo: 'Vacinas', Icone: Syringe },
  { id: 'crescimento', rotulo: 'Curvas', Icone: Ruler },
  { id: 'consultas', rotulo: 'Consultas', Icone: Stethoscope },
  { id: 'duvidas', rotulo: 'Dúvidas', Icone: MessageCircleQuestion },
]

export default function Saude() {
  const { user } = useAuth()
  const [params, setParams] = useSearchParams()
  const aba = (ABAS.find((a) => a.id === params.get('aba'))?.id || 'vacinas') as Aba

  const [espaco, setEspaco] = useState<EspacoRecord | null>(null)
  const [papel, setPapel] = useState<Papel>('viewer')
  const [vacinas, setVacinas] = useState<VacinaRecord[]>([])
  const [consultas, setConsultas] = useState<ConsultaRecord[]>([])
  const [duvidas, setDuvidas] = useState<DuvidaRecord[]>([])
  const [carregando, setCarregando] = useState(true)

  const recarregar = useCallback(async (esp: EspacoRecord) => {
    const [v, c, d] = await Promise.all([
      listarVacinas(esp.id),
      listarConsultas(esp.id),
      listarDuvidas(esp.id),
    ])
    setVacinas(v)
    setConsultas(c)
    setDuvidas(d)
  }, [])

  useEffect(() => {
    let desligar: (() => void) | undefined
    let ativo = true
    ;(async () => {
      const esp = await obterEspacoAtual()
      if (!ativo || !esp) {
        setCarregando(false)
        return
      }
      setEspaco(esp)
      const [p] = await Promise.all([obterMeuPapel(esp.id), recarregar(esp)])
      if (!ativo) return
      setPapel(p)
      setCarregando(false)
      desligar = acompanharSaude(esp.id, () => recarregar(esp))
    })()
    return () => {
      ativo = false
      desligar?.()
    }
  }, [recarregar])

  const hoje = getLocalTodayDateString()
  const nascimento = espaco?.data_nascimento || '2026-10-09'
  const nomeBebe = espaco?.nome || 'Sarah'
  const ig = espaco?.idade_gestacional_semanas

  const doses = useMemo(
    () => statusDasDoses({ nascimento, hoje, aplicadas: vacinas }),
    [nascimento, hoje, vacinas],
  )
  const extras = useMemo(() => vacinas.filter((v) => v.dose_id.startsWith('extra-')), [vacinas])
  const resumo = useMemo(() => resumoVacinal(doses), [doses])
  const pontos = useMemo(
    () =>
      pontosDeCrescimento({ nascimento, pesoNascimentoG: espaco?.peso_nascimento_g, consultas }),
    [nascimento, espaco?.peso_nascimento_g, consultas],
  )
  const alertas = useMemo(
    () =>
      avaliarCrescimento({
        nascimento,
        idadeGestacionalSemanas: ig,
        pesoNascimentoG: espaco?.peso_nascimento_g,
        pontos,
        hoje,
      }),
    [nascimento, ig, espaco?.peso_nascimento_g, pontos, hoje],
  )
  const medidas = useMemo(() => ultimasMedidas(pontos, nascimento, ig), [pontos, nascimento, ig])
  const pesoAtual = medidas.find((m) => m.medida === 'peso')
  const duvidasAbertas = duvidas.filter((d) => !d.respondida_em)

  const podeEscrever = papel === 'owner' || papel === 'editor'
  const meuId = user?.id || ''

  const mudarAba = (nova: Aba) => {
    const p = new URLSearchParams(params)
    p.set('aba', nova)
    setParams(p, { replace: true })
  }

  const prepararConsulta = async () => {
    const texto = gerarResumoConsulta({
      bebeNome: nomeBebe,
      nascimento,
      idadeGestacional: ig,
      idadeTexto: formatarIdadeAmigavel(nascimento, ig).faixaContexto,
      hoje,
      pontos,
      doses,
      duvidasAbertas: duvidasAbertas.map((d) => d.texto),
    })
    try {
      if (navigator.share) {
        await navigator.share({ title: `Consulta da ${nomeBebe}`, text: texto })
        return
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
    }
    try {
      await navigator.clipboard.writeText(texto)
      toast({ title: 'Resumo copiado', description: 'Cole no WhatsApp ou mostre na consulta.' })
    } catch {
      toast({ title: 'Não foi possível copiar', variant: 'destructive' })
    }
  }

  if (carregando) {
    return (
      <div className="py-10 text-center text-sm text-muted-foreground" role="status">
        Carregando saúde...
      </div>
    )
  }

  const pendentesAgora = resumo.pendentesAgora.length

  return (
    <div className="space-y-5 py-4">
      <div>
        <h1 className="text-2xl font-black text-foreground tracking-tight flex items-center gap-2">
          <Stethoscope className="w-6 h-6 text-primary" />
          Saúde da {nomeBebe}
        </h1>
        <p className="text-xs text-muted-foreground mt-1">
          Vacinas, consultas e crescimento, junto com a família.
        </p>
      </div>

      {/* Painel */}
      <div className="grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={() => mudarAba('vacinas')}
          className={`text-left rounded-[20px] p-3 border shadow-sm ${
            pendentesAgora
              ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800'
              : 'bg-card border-border'
          }`}
        >
          <Syringe className="w-4 h-4 text-primary mb-1" />
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Vacinas</p>
          {pendentesAgora ? (
            <p className="text-xs font-black text-amber-800 dark:text-amber-300 leading-tight">
              {pendentesAgora} para tomar
            </p>
          ) : resumo.proxima ? (
            <p className="text-xs font-black text-foreground leading-tight">
              {rotuloIdade(resumo.proxima.idadeMeses)}
              <span className="block font-semibold text-muted-foreground">
                {formatarDataBr(resumo.proxima.data).slice(0, 5)}
              </span>
            </p>
          ) : (
            <p className="text-xs font-black text-foreground">Em dia</p>
          )}
        </button>
        <button
          type="button"
          onClick={() => mudarAba('crescimento')}
          className="text-left rounded-[20px] p-3 border border-border bg-card shadow-sm"
        >
          <Ruler className="w-4 h-4 text-primary mb-1" />
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Peso</p>
          {pesoAtual ? (
            <p className="text-xs font-black text-foreground leading-tight tabular-nums">
              {formatarNumero(pesoAtual.valor, 2)} kg
              <span className="block font-semibold text-primary">{pesoAtual.percentil}</span>
            </p>
          ) : (
            <p className="text-xs font-semibold text-muted-foreground">Sem medida</p>
          )}
        </button>
        <button
          type="button"
          onClick={() => mudarAba('duvidas')}
          className="text-left rounded-[20px] p-3 border border-border bg-card shadow-sm"
        >
          <MessageCircleQuestion className="w-4 h-4 text-primary mb-1" />
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Dúvidas</p>
          <p className="text-xs font-black text-foreground leading-tight">
            {duvidasAbertas.length} {duvidasAbertas.length === 1 ? 'aberta' : 'abertas'}
          </p>
        </button>
      </div>

      <Button
        type="button"
        onClick={prepararConsulta}
        variant="outline"
        className="w-full h-12 rounded-2xl text-sm font-bold gap-2 border-primary/40"
      >
        {typeof navigator !== 'undefined' && 'share' in navigator ? (
          <Share2 className="w-4 h-4" />
        ) : (
          <ClipboardCopy className="w-4 h-4" />
        )}
        Preparar resumo para a consulta
      </Button>

      {/* Abas */}
      <div className="grid grid-cols-4 gap-1 bg-muted/50 p-1 rounded-2xl" role="tablist">
        {ABAS.map(({ id, rotulo, Icone }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={aba === id}
            onClick={() => mudarAba(id)}
            className={`h-11 rounded-xl text-[11px] font-bold flex flex-col items-center justify-center gap-0.5 ${
              aba === id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
            }`}
          >
            <Icone className="w-4 h-4" />
            {rotulo}
          </button>
        ))}
      </div>

      {espaco && aba === 'vacinas' && (
        <AbaVacinas
          espacoId={espaco.id}
          nomeBebe={nomeBebe}
          hoje={hoje}
          doses={doses}
          extras={extras}
          registros={vacinas}
          podeEscrever={podeEscrever}
          podeApagarTudo={papel === 'owner'}
          meuId={meuId}
          aoMudar={() => recarregar(espaco)}
        />
      )}
      {aba === 'crescimento' && (
        <AbaCrescimento
          nascimento={nascimento}
          idadeGestacional={ig}
          pontos={pontos}
          alertas={alertas}
          hoje={hoje}
        />
      )}
      {espaco && aba === 'consultas' && (
        <AbaConsultas
          espacoId={espaco.id}
          hoje={hoje}
          consultas={consultas}
          podeEscrever={podeEscrever}
          podeApagarTudo={papel === 'owner'}
          meuId={meuId}
          aoMudar={() => recarregar(espaco)}
        />
      )}
      {espaco && aba === 'duvidas' && (
        <AbaDuvidas
          espacoId={espaco.id}
          duvidas={duvidas}
          podeEscrever={podeEscrever}
          podeApagarTudo={papel === 'owner'}
          meuId={meuId}
          aoMudar={() => recarregar(espaco)}
        />
      )}

      <section className="pt-2">
        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2 px-1">
          Em breve
        </p>
        <div className="grid grid-cols-3 gap-2">
          {[
            { t: 'Triagens neonatais', I: FileCheck2 },
            { t: 'Medicações e vitaminas', I: Pill },
            { t: 'Exames', I: ClipboardList },
          ].map(({ t, I }) => (
            <div key={t} className="rounded-2xl border border-dashed border-border p-3 text-center">
              <I className="w-4 h-4 mx-auto text-muted-foreground mb-1" />
              <p className="text-[10px] font-semibold text-muted-foreground leading-tight">{t}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
