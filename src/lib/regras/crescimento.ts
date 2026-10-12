// src/lib/regras/crescimento.ts
// Escore z e percentil pelas curvas da OMS (meninas, 0 a 24 meses), idade corrigida
// para prematuros e sinais que valem conversar com a pediatra. Nunca é diagnóstico.

import { peso, comprimento, perimetroCefalico, type LMS } from './oms-meninas'

export type Medida = 'peso' | 'comprimento' | 'perimetroCefalico'

const TABELAS: Record<Medida, readonly LMS[]> = { peso, comprimento, perimetroCefalico }

export const ROTULO_MEDIDA: Record<Medida, { nome: string; unidade: string }> = {
  peso: { nome: 'Peso', unidade: 'kg' },
  comprimento: { nome: 'Comprimento', unidade: 'cm' },
  perimetroCefalico: { nome: 'Perímetro cefálico', unidade: 'cm' },
}

export const IDADE_MAXIMA_DIAS = 730 // 24 meses

/** Percentis desenhados no gráfico, como na Caderneta da Criança. */
export const PERCENTIS_CURVA = [3, 15, 50, 85, 97] as const

/** L, M e S interpolados para a idade em dias (fora de 0–730 devolve null). */
export function lmsNaIdade(medida: Medida, dias: number): [number, number, number] | null {
  const t = TABELAS[medida]
  if (!Number.isFinite(dias) || dias < 0 || dias > IDADE_MAXIMA_DIAS) return null
  for (let i = 0; i < t.length - 1; i++) {
    const [d0, l0, m0, s0] = t[i]
    const [d1, l1, m1, s1] = t[i + 1]
    if (dias >= d0 && dias <= d1) {
      const f = d1 === d0 ? 0 : (dias - d0) / (d1 - d0)
      return [l0 + (l1 - l0) * f, m0 + (m1 - m0) * f, s0 + (s1 - s0) * f]
    }
  }
  return null
}

export function escoreZ(medida: Medida, dias: number, valor: number): number | null {
  const lms = lmsNaIdade(medida, dias)
  if (!lms || !(valor > 0)) return null
  const [L, M, S] = lms
  return L === 0 ? Math.log(valor / M) / S : (Math.pow(valor / M, L) - 1) / (L * S)
}

/** Valor da medida que corresponde a um escore z (para desenhar as curvas). */
export function valorNoEscoreZ(medida: Medida, dias: number, z: number): number | null {
  const lms = lmsNaIdade(medida, dias)
  if (!lms) return null
  const [L, M, S] = lms
  return L === 0 ? M * Math.exp(S * z) : M * Math.pow(1 + L * S * z, 1 / L)
}

/** Distribuição normal acumulada (aproximação de Abramowitz e Stegun, erro < 1e-7). */
export function normalAcumulada(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z))
  const d = 0.3989423 * Math.exp((-z * z) / 2)
  const p =
    d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))))
  return z > 0 ? 1 - p : p
}

/** Escore z do percentil (inverso da normal, por bisseção; suficiente para desenhar). */
export function zDoPercentil(percentil: number): number {
  let lo = -6
  let hi = 6
  for (let i = 0; i < 60; i++) {
    const meio = (lo + hi) / 2
    if (normalAcumulada(meio) * 100 < percentil) lo = meio
    else hi = meio
  }
  return (lo + hi) / 2
}

export function percentil(z: number): number {
  return normalAcumulada(z) * 100
}

/** "P50", "P3", "abaixo de P0,1"... */
export function formatarPercentil(z: number | null): string {
  if (z === null) return '—'
  const p = percentil(z)
  if (p < 0.1) return 'abaixo de P0,1'
  if (p > 99.9) return 'acima de P99,9'
  if (p < 1 || p > 99) return `P${p.toFixed(1).replace('.', ',')}`
  return `P${Math.round(p)}`
}

export type Faixa = 'abaixo' | 'normal' | 'acima'

/** Faixa usual: entre P3 e P97 (z entre −1,88 e +1,88). */
export function faixaDoEscore(z: number): Faixa {
  if (z < -1.881) return 'abaixo'
  if (z > 1.881) return 'acima'
  return 'normal'
}

const MS_DIA = 24 * 3600 * 1000

/** Dias entre duas datas de calendário (AAAA-MM-DD), sem efeito de fuso. */
export function diasEntre(deIso: string, ateIso: string): number {
  const [a, b, c] = deIso.split('-').map(Number)
  const [x, y, z] = ateIso.split('-').map(Number)
  return Math.round((Date.UTC(x, y - 1, z) - Date.UTC(a, b - 1, c)) / MS_DIA)
}

/**
 * Idade usada nas curvas. Prematuro (< 37 semanas): idade corrigida para 40 semanas,
 * como recomenda a SBP até os 2 anos.
 */
export function idadeParaCurva(
  nascimento: string,
  data: string,
  idadeGestacionalSemanas?: number | null,
): { dias: number; corrigida: boolean } {
  const dias = diasEntre(nascimento, data)
  const ig = idadeGestacionalSemanas || 40
  if (ig < 37) return { dias: Math.max(0, dias - Math.round((40 - ig) * 7)), corrigida: true }
  return { dias, corrigida: false }
}

export interface PontoMedido {
  data: string // AAAA-MM-DD
  pesoKg?: number | null
  comprimentoCm?: number | null
  perimetroCefalicoCm?: number | null
}

export interface Alerta {
  nivel: 'atencao' | 'info'
  mensagem: string
}

/** Sinais para comentar com a pediatra. Informativo, nunca diagnóstico. */
export function avaliarCrescimento(params: {
  nascimento: string
  idadeGestacionalSemanas?: number | null
  pesoNascimentoG?: number | null
  pontos: PontoMedido[]
  hoje: string
}): Alerta[] {
  const alertas: Alerta[] = []
  const pontos = [...params.pontos].sort((a, b) => a.data.localeCompare(b.data))
  const pesos = pontos.filter((p) => p.pesoKg && p.pesoKg > 0)
  const ultimoPeso = pesos[pesos.length - 1]
  const nasc = params.pesoNascimentoG ? params.pesoNascimentoG / 1000 : null

  if (nasc && ultimoPeso) {
    const diaDaMedida = diasEntre(params.nascimento, ultimoPeso.data)
    const variacao = (ultimoPeso.pesoKg! - nasc) / nasc
    if (diaDaMedida <= 14 && variacao <= -0.1) {
      alertas.push({
        nivel: 'atencao',
        mensagem: `Perda de ${Math.round(-variacao * 100)}% do peso de nascimento: a partir de 10% vale avisar a pediatra hoje.`,
      })
    } else if (diaDaMedida > 14 && variacao < 0) {
      alertas.push({
        nivel: 'atencao',
        mensagem:
          'Ainda abaixo do peso de nascimento depois de 2 semanas: converse com a pediatra.',
      })
    } else if (diaDaMedida <= 14 && variacao < 0) {
      alertas.push({
        nivel: 'info',
        mensagem: `Perda de ${Math.round(-variacao * 100)}% do peso de nascimento, o que é esperado nos primeiros dias (até cerca de 10%). O peso costuma voltar ao de nascimento em 10 a 14 dias.`,
      })
    }
  }

  const ultimo = pontos[pontos.length - 1]
  if (ultimo) {
    const { dias } = idadeParaCurva(params.nascimento, ultimo.data, params.idadeGestacionalSemanas)
    const valores: [Medida, number | null | undefined][] = [
      ['peso', ultimo.pesoKg],
      ['comprimento', ultimo.comprimentoCm],
      ['perimetroCefalico', ultimo.perimetroCefalicoCm],
    ]
    for (const [medida, valor] of valores) {
      if (!valor) continue
      const z = escoreZ(medida, dias, valor)
      if (z === null) continue
      const faixa = faixaDoEscore(z)
      if (faixa !== 'normal') {
        alertas.push({
          nivel: 'atencao',
          mensagem: `${ROTULO_MEDIDA[medida].nome} ${faixa === 'abaixo' ? 'abaixo do P3' : 'acima do P97'} na última medida: vale conferir com a pediatra.`,
        })
      }
    }
  }

  // Queda de duas faixas de percentil entre medidas de peso (cruzar duas linhas da curva)
  if (pesos.length >= 2) {
    const a = pesos[pesos.length - 2]
    const b = pesos[pesos.length - 1]
    const ia = idadeParaCurva(params.nascimento, a.data, params.idadeGestacionalSemanas).dias
    const ib = idadeParaCurva(params.nascimento, b.data, params.idadeGestacionalSemanas).dias
    const za = escoreZ('peso', ia, a.pesoKg!)
    const zb = escoreZ('peso', ib, b.pesoKg!)
    if (za !== null && zb !== null && ia >= 14 && za - zb >= 1.34) {
      alertas.push({
        nivel: 'atencao',
        mensagem:
          'O peso cruzou duas linhas de percentil para baixo desde a medida anterior: vale conversar com a pediatra.',
      })
    }
  }

  return alertas
}

/** Intervalo mínimo entre pesagens: balanças diferentes erram mais do que o ganho de 1 dia. */
export const INTERVALO_MINIMO_GANHO_DIAS = 7

/**
 * Ganho de peso médio por dia entre a última pesagem e a anterior com pelo menos 7 dias
 * de diferença. Com a data de nascimento, ignora a perda esperada das duas primeiras
 * semanas (não é "ganho negativo").
 */
export function ganhoDiario(
  pontos: PontoMedido[],
  nascimento?: string,
): { gramasPorDia: number; dias: number } | null {
  const pesos = [...pontos]
    .filter((p) => p.pesoKg && p.pesoKg > 0)
    .sort((a, b) => a.data.localeCompare(b.data))
  const b = pesos[pesos.length - 1]
  if (!b) return null
  const a = [...pesos]
    .reverse()
    .find((p) => diasEntre(p.data, b.data) >= INTERVALO_MINIMO_GANHO_DIAS)
  if (!a) return null
  const dias = diasEntre(a.data, b.data)
  const gramasPorDia = Math.round(((b.pesoKg! - a.pesoKg!) * 1000) / dias)
  if (nascimento && gramasPorDia < 0 && diasEntre(nascimento, b.data) <= 14) return null
  return { gramasPorDia, dias }
}
