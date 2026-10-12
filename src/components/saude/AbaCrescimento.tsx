// src/components/saude/AbaCrescimento.tsx
// Curvas da OMS (P3, P15, P50, P85, P97) com as medidas do bebê, percentil de cada
// medida, ganho de peso por dia e sinais para conversar com a pediatra.

import { useMemo, useState } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { AlertTriangle, Info, TrendingUp } from 'lucide-react'
import {
  IDADE_MAXIMA_DIAS,
  PERCENTIS_CURVA,
  ROTULO_MEDIDA,
  escoreZ,
  formatarPercentil,
  ganhoDiario,
  idadeParaCurva,
  valorNoEscoreZ,
  zDoPercentil,
  type Alerta,
  type Medida,
  type PontoMedido,
} from '@/lib/regras/crescimento'
import { formatarDataBr, formatarNumero } from '@/lib/regras/consulta'

const CAMPO: Record<Medida, keyof PontoMedido> = {
  peso: 'pesoKg',
  comprimento: 'comprimentoCm',
  perimetroCefalico: 'perimetroCefalicoCm',
}

const Z_CURVAS = PERCENTIS_CURVA.map((p) => ({ p, z: zDoPercentil(p) }))

interface Props {
  nascimento: string
  idadeGestacional?: number | null
  pontos: PontoMedido[]
  alertas: Alerta[]
  hoje: string
}

type Linha = { dia: number; bebe?: number; data?: string } & Record<string, number | string | undefined>

function rotuloMes(dia: number): string {
  const m = Math.round(dia / 30.4375)
  if (dia === 0) return 'nasc.'
  return `${m}m`
}

export default function AbaCrescimento({ nascimento, idadeGestacional, pontos, alertas, hoje }: Props) {
  const [medida, setMedida] = useState<Medida>('peso')

  const { dados, ticks, medidosDaMedida, corrigida } = useMemo(() => {
    const campo = CAMPO[medida]
    const medidos = pontos
      .filter((p) => typeof p[campo] === 'number' && (p[campo] as number) > 0)
      .map((p) => {
        const idade = idadeParaCurva(nascimento, p.data, idadeGestacional)
        return { dia: idade.dias, valor: p[campo] as number, data: p.data, corrigida: idade.corrigida }
      })
      .filter((p) => p.dia <= IDADE_MAXIMA_DIAS)

    const idadeHoje = idadeParaCurva(nascimento, hoje, idadeGestacional).dias
    const ultimo = Math.max(idadeHoje, ...medidos.map((m) => m.dia), 0)
    // Mostra até 2 meses à frente da idade atual (mínimo 4 meses, máximo 24)
    const fim = Math.min(IDADE_MAXIMA_DIAS, Math.max(122, Math.ceil((ultimo + 61) / 30.4375) * 30.4375))
    const passo = fim <= 183 ? 7 : 15

    const linhas = new Map<number, Linha>()
    const adicionarCurva = (dia: number) => {
      const linha: Linha = linhas.get(dia) || { dia }
      for (const { p, z } of Z_CURVAS) linha[`p${p}`] = valorNoEscoreZ(medida, dia, z) ?? undefined
      linhas.set(dia, linha)
    }
    for (let d = 0; d <= fim; d += passo) adicionarCurva(Math.round(d))
    adicionarCurva(Math.round(fim))
    for (const m of medidos) {
      const linha = linhas.get(m.dia) || { dia: m.dia }
      for (const { p, z } of Z_CURVAS) linha[`p${p}`] = valorNoEscoreZ(medida, m.dia, z) ?? undefined
      linha.bebe = m.valor
      linha.data = m.data
      linhas.set(m.dia, linha)
    }
    const meses: number[] = []
    const intervalo = fim > 400 ? 3 : fim > 200 ? 2 : 1
    for (let m = 0; m * 30.4375 <= fim + 1; m += intervalo) meses.push(Math.round(m * 30.4375))
    return {
      dados: [...linhas.values()].sort((a, b) => a.dia - b.dia),
      ticks: meses,
      medidosDaMedida: medidos,
      corrigida: medidos.some((m) => m.corrigida),
    }
  }, [medida, pontos, nascimento, idadeGestacional, hoje])

  const unidade = ROTULO_MEDIDA[medida].unidade
  const casas = medida === 'peso' ? 2 : 1
  const ultimoMedido = medidosDaMedida[medidosDaMedida.length - 1]
  const zUltimo = ultimoMedido ? escoreZ(medida, ultimoMedido.dia, ultimoMedido.valor) : null
  const ganho = medida === 'peso' ? ganhoDiario(pontos, nascimento) : null

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-1.5 bg-muted/50 p-1 rounded-2xl" role="tablist">
        {(Object.keys(ROTULO_MEDIDA) as Medida[]).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={medida === m}
            onClick={() => setMedida(m)}
            className={`h-9 rounded-xl text-[11px] font-bold ${
              medida === m ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
            }`}
          >
            {m === 'perimetroCefalico' ? 'Cabeça (PC)' : ROTULO_MEDIDA[m].nome}
          </button>
        ))}
      </div>

      <div className="bg-card rounded-[22px] p-4 border border-border shadow-sm">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              {ROTULO_MEDIDA[medida].nome} · última medida
            </p>
            {ultimoMedido ? (
              <p className="text-2xl font-black text-foreground tabular-nums">
                {formatarNumero(ultimoMedido.valor, casas)} {unidade}
                <span className="text-sm font-bold text-primary ml-2">{formatarPercentil(zUltimo)}</span>
              </p>
            ) : (
              <p className="text-sm text-muted-foreground mt-1">Nenhuma medida ainda.</p>
            )}
            {ultimoMedido && (
              <p className="text-[11px] text-muted-foreground">em {formatarDataBr(ultimoMedido.data)}</p>
            )}
          </div>
          {ganho && (
            <div className="text-right">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Ganho</p>
              <p className="text-lg font-black text-foreground tabular-nums">
                {ganho.gramasPorDia > 0 ? '+' : ''}
                {ganho.gramasPorDia} g/dia
              </p>
              <p className="text-[11px] text-muted-foreground">últimos {ganho.dias} dias</p>
            </div>
          )}
        </div>

        <div className="h-64 -ml-3" aria-label={`Curva de ${ROTULO_MEDIDA[medida].nome} da OMS`}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={dados} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid stroke="hsl(var(--muted-foreground) / 0.2)" strokeDasharray="2 4" vertical={false} />
              <XAxis
                dataKey="dia"
                type="number"
                domain={[0, 'dataMax']}
                ticks={ticks}
                tickFormatter={rotuloMes}
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                stroke="hsl(var(--muted-foreground) / 0.3)"
              />
              <YAxis
                domain={['auto', 'auto']}
                width={40}
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                stroke="hsl(var(--muted-foreground) / 0.3)"
                tickFormatter={(v: number) => formatarNumero(v, medida === 'peso' ? 1 : 0)}
              />
              <Tooltip
                contentStyle={{
                  background: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: 12,
                  fontSize: 12,
                  color: 'hsl(var(--foreground))',
                }}
                labelFormatter={(dia) => `${rotuloMes(Number(dia))} (${dia} dias)`}
                formatter={(valor, nome) => [
                  `${formatarNumero(Number(valor), casas)} ${unidade}`,
                  nome === 'bebe' ? 'Medida' : String(nome).toUpperCase(),
                ]}
              />
              {Z_CURVAS.map(({ p }) => (
                <Line
                  key={p}
                  type="monotone"
                  dataKey={`p${p}`}
                  dot={false}
                  isAnimationActive={false}
                  stroke={p === 50 ? 'hsl(var(--muted-foreground))' : 'hsl(var(--muted-foreground) / 0.45)'}
                  strokeWidth={p === 50 ? 1.5 : 1}
                  strokeDasharray={p === 3 || p === 97 ? '4 3' : undefined}
                  connectNulls
                />
              ))}
              <ReferenceLine
                x={idadeParaCurva(nascimento, hoje, idadeGestacional).dias}
                stroke="hsl(var(--primary) / 0.35)"
                strokeDasharray="3 3"
              />
              <Line
                type="linear"
                dataKey="bebe"
                stroke="hsl(var(--primary))"
                strokeWidth={2.5}
                dot={{ r: 4, fill: 'hsl(var(--primary))', strokeWidth: 0 }}
                activeDot={{ r: 6 }}
                connectNulls
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <p className="text-[10px] text-muted-foreground mt-2 leading-relaxed">
          Linhas cinza: percentis 3, 15, 50 (mais forte), 85 e 97 da OMS para meninas. Pontos
          coloridos: medidas da bebê. Linha tracejada vertical: hoje.
          {corrigida ? ' Idade corrigida (prematura).' : ''}
        </p>
      </div>

      {alertas.length > 0 && (
        <div className="space-y-2">
          {alertas.map((a, i) => (
            <div
              key={i}
              className={`flex items-start gap-2 rounded-2xl border p-3 text-xs ${
                a.nivel === 'atencao'
                  ? 'border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200'
                  : 'border-border bg-muted/40 text-foreground'
              }`}
            >
              {a.nivel === 'atencao' ? (
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              ) : (
                <Info className="w-4 h-4 shrink-0 mt-0.5" />
              )}
              <span className="leading-relaxed">{a.mensagem}</span>
            </div>
          ))}
        </div>
      )}

      {medidosDaMedida.length > 0 && (
        <div className="bg-card rounded-[22px] p-4 border border-border shadow-sm">
          <h3 className="text-sm font-black text-foreground flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            Histórico
          </h3>
          <ul className="divide-y divide-border">
            {[...medidosDaMedida].reverse().map((m) => (
              <li key={`${m.data}-${m.dia}-${m.valor}`} className="py-2 flex items-center justify-between text-sm">
                <span className="text-muted-foreground text-xs">{formatarDataBr(m.data)}</span>
                <span className="font-bold text-foreground tabular-nums">
                  {formatarNumero(m.valor, casas)} {unidade}
                </span>
                <span className="text-xs font-bold text-primary w-24 text-right">
                  {formatarPercentil(escoreZ(medida, m.dia, m.valor))}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-[11px] text-muted-foreground leading-relaxed px-1">
        Referência: Padrões de Crescimento Infantil da OMS (2006), os mesmos da Caderneta da
        Criança. Percentil é uma comparação com outras bebês da mesma idade, não uma nota. A
        tendência ao longo do tempo importa mais do que uma medida isolada; quem interpreta é a
        pediatra.
      </p>
    </div>
  )
}
