// src/lib/regras/consulta.ts
// Utilidades de consulta: datas e números em pt-BR, pontos de crescimento e o resumo
// "Preparar consulta" (medidas com percentil, vacinas e dúvidas abertas).

import {
  escoreZ,
  formatarPercentil,
  ganhoDiario,
  idadeParaCurva,
  type Medida,
  type PontoMedido,
} from './crescimento'
import type { DoseComStatus } from './vacinas'

/** "2026-10-09" -> "09/10/2026" */
export function formatarDataBr(iso: string | undefined | null): string {
  if (!iso) return ''
  const [a, m, d] = iso.split('-')
  return `${d}/${m}/${a}`
}

/** Aceita "3,45", "3.45" ou "3450" (gramas) e devolve gramas; null se vazio ou inválido. */
export function lerPesoEmGramas(texto: string): number | null {
  const t = texto.trim().replace(',', '.')
  if (!t) return null
  const n = Number(t)
  if (!Number.isFinite(n) || n <= 0) return null
  return n >= 100 ? Math.round(n) : Math.round(n * 1000)
}

/** Aceita "50,5" ou "50.5"; null se vazio ou inválido. */
export function lerNumero(texto: string): number | null {
  const t = texto.trim().replace(',', '.')
  if (!t) return null
  const n = Number(t)
  return Number.isFinite(n) && n > 0 ? n : null
}

export function formatarNumero(n: number, casas = 1): string {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })
}

export interface ConsultaComMedidas {
  data: string
  peso_g?: number | null
  comprimento_cm?: number | null
  perimetro_cefalico_cm?: number | null
}

/** Pontos de crescimento: peso de nascimento + medidas das consultas. */
export function pontosDeCrescimento(params: {
  nascimento: string
  pesoNascimentoG?: number | null
  consultas: ConsultaComMedidas[]
}): PontoMedido[] {
  const pontos: PontoMedido[] = []
  if (params.pesoNascimentoG) {
    pontos.push({ data: params.nascimento, pesoKg: params.pesoNascimentoG / 1000 })
  }
  for (const c of params.consultas) {
    if (!c.peso_g && !c.comprimento_cm && !c.perimetro_cefalico_cm) continue
    pontos.push({
      data: c.data,
      pesoKg: c.peso_g ? c.peso_g / 1000 : null,
      comprimentoCm: c.comprimento_cm || null,
      perimetroCefalicoCm: c.perimetro_cefalico_cm || null,
    })
  }
  return pontos.sort((a, b) => a.data.localeCompare(b.data))
}

/** Última medida de cada tipo, com percentil. */
export function ultimasMedidas(
  pontos: PontoMedido[],
  nascimento: string,
  idadeGestacional?: number | null,
): { medida: Medida; valor: number; data: string; percentil: string }[] {
  const campos: [Medida, keyof PontoMedido][] = [
    ['peso', 'pesoKg'],
    ['comprimento', 'comprimentoCm'],
    ['perimetroCefalico', 'perimetroCefalicoCm'],
  ]
  const saida: { medida: Medida; valor: number; data: string; percentil: string }[] = []
  for (const [medida, campo] of campos) {
    const p = [...pontos].reverse().find((x) => typeof x[campo] === 'number' && (x[campo] as number) > 0)
    if (!p) continue
    const valor = p[campo] as number
    const { dias } = idadeParaCurva(nascimento, p.data, idadeGestacional)
    saida.push({ medida, valor, data: p.data, percentil: formatarPercentil(escoreZ(medida, dias, valor)) })
  }
  return saida
}

const NOME_CURTO: Record<Medida, string> = {
  peso: 'Peso',
  comprimento: 'Comprimento',
  perimetroCefalico: 'Perímetro cefálico',
}

function valorComUnidade(medida: Medida, valor: number): string {
  return medida === 'peso' ? `${formatarNumero(valor, 3)} kg` : `${formatarNumero(valor, 1)} cm`
}

/** Texto para levar (ou mandar) à pediatra. */
export function gerarResumoConsulta(params: {
  bebeNome: string
  nascimento: string
  idadeGestacional?: number | null
  idadeTexto: string
  hoje: string
  pontos: PontoMedido[]
  doses: DoseComStatus[]
  duvidasAbertas: string[]
}): string {
  const linhas: string[] = []
  linhas.push(`${params.bebeNome} · ${params.idadeTexto} · ${formatarDataBr(params.hoje)}`)
  linhas.push(`Nascimento: ${formatarDataBr(params.nascimento)}`)

  const medidas = ultimasMedidas(params.pontos, params.nascimento, params.idadeGestacional)
  if (medidas.length) {
    linhas.push('', 'Medidas mais recentes (curvas OMS):')
    for (const m of medidas) {
      linhas.push(
        `- ${NOME_CURTO[m.medida]}: ${valorComUnidade(m.medida, m.valor)} em ${formatarDataBr(m.data)} (${m.percentil})`,
      )
    }
    const ganho = ganhoDiario(params.pontos, params.nascimento)
    if (ganho) {
      linhas.push(`- Ganho de peso: ${ganho.gramasPorDia} g/dia nos últimos ${ganho.dias} dias`)
    }
  }

  const atrasadas = params.doses.filter((d) => d.status === 'atrasada' || d.status === 'agora')
  // Próximas: as dos próximos 30 dias ou, se não houver, as da próxima data do calendário
  const futuras = params.doses
    .filter((d) => d.status === 'proxima' || d.status === 'futura')
    .sort((a, b) => a.data.localeCompare(b.data))
  const proximas = futuras.filter((d) => d.status === 'proxima' || d.data === futuras[0].data)
  linhas.push('', 'Vacinas:')
  if (atrasadas.length) {
    linhas.push(`- Pendentes: ${atrasadas.map((d) => `${d.vacina} (${d.dose})`).join(', ')}`)
  } else {
    linhas.push('- Em dia até hoje')
  }
  if (proximas.length) {
    linhas.push(
      `- Próximas: ${proximas.map((d) => `${d.vacina} (${d.dose}) em ${formatarDataBr(d.data)}`).join(', ')}`,
    )
  }

  if (params.duvidasAbertas.length) {
    linhas.push('', 'Dúvidas:')
    params.duvidasAbertas.forEach((d, i) => linhas.push(`${i + 1}. ${d}`))
  }
  return linhas.join('\n')
}
