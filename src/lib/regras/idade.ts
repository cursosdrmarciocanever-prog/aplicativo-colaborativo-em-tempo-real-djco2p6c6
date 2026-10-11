// src/lib/regras/idade.ts
// Regras de negócio puras para idade do bebê e dia de vida

import { getSaoPauloParts } from './fuso'

export interface IdadeAmigavel {
  diasDeVida: number
  idadeTexto: string // "Dia 2 de vida", "Semana 3 (21 dias)", "2 meses e 5 dias"
  faixaContexto: string // Texto compacto para a barra de contexto no topo
  semanas: number
  meses: number
  diasRestantes: number
  idadeCorrigidaTexto?: string | null
}

/**
 * Calcula o dia de vida:
 * O dia do nascimento é o DIA 1 no calendário local (America/Sao_Paulo).
 * Se nasceu em 09/10/2026:
 * - 09/10/2026 = Dia 1
 * - 10/10/2026 = Dia 2
 * - 11/10/2026 = Dia 3
 */
export function calcularDiaDeVida(
  dataNascimentoStr: string, // YYYY-MM-DD
  dataReferencia: Date = new Date(),
): number {
  if (!dataNascimentoStr) return 1

  const [anoNasc, mesNasc, diaNasc] = dataNascimentoStr.split('-').map(Number)
  const { year: anoRef, month: mesRef, day: diaRef } = getSaoPauloParts(dataReferencia)

  const utcNasc = Date.UTC(anoNasc, mesNasc - 1, diaNasc)
  const utcRef = Date.UTC(anoRef, mesRef - 1, diaRef)

  const diffMs = utcRef - utcNasc
  const diffDias = Math.floor(diffMs / (24 * 60 * 60 * 1000))

  // Dia de nascimento = dia 1
  return Math.max(1, diffDias + 1)
}

/**
 * Formata a idade amigável com evolução:
 * - Dias 1 a 13: "Dia N de vida"
 * - Semanas 2 a 8: "Semana S (N dias)"
 * - A partir de ~2 meses: "M meses e D dias"
 * - Suporta idade corrigida opcional se idade gestacional ao nascer < 37 semanas
 */
export function formatarIdadeAmigavel(
  dataNascimentoStr: string, // YYYY-MM-DD
  idadeGestacionalSemanas?: number | null,
  dataReferencia: Date = new Date(),
): IdadeAmigavel {
  const diasDeVida = calcularDiaDeVida(dataNascimentoStr, dataReferencia)

  const [anoNasc, mesNasc, diaNasc] = (dataNascimentoStr || '2026-10-09').split('-').map(Number)
  const { year: anoRef, month: mesRef, day: diaRef } = getSaoPauloParts(dataReferencia)

  // Cálculo de meses e dias corridos de calendário
  let meses = (anoRef - anoNasc) * 12 + (mesRef - mesNasc)
  let diasRestantes = diaRef - diaNasc
  if (diasRestantes < 0) {
    meses -= 1
    // Pega o número de dias do mês anterior
    const ultimoDiaMesAnterior = new Date(anoRef, mesRef - 1, 0).getDate()
    diasRestantes += ultimoDiaMesAnterior
  }

  const semanas = Math.floor(diasDeVida / 7)

  let idadeTexto = ''
  let faixaContexto = ''

  if (diasDeVida <= 14) {
    idadeTexto = `Dia ${diasDeVida} de vida`
    faixaContexto = `Dia ${diasDeVida} de vida`
  } else if (meses < 2) {
    const sem = Math.max(1, Math.floor((diasDeVida - 1) / 7) + 1)
    idadeTexto = `Semana ${sem} de vida (${diasDeVida} dias)`
    faixaContexto = `Semana ${sem} (${diasDeVida} dias)`
  } else {
    const mesesStr = meses === 1 ? '1 mês' : `${meses} meses`
    const diasStr = diasRestantes === 1 ? '1 dia' : `${diasRestantes} dias`

    if (diasRestantes === 0) {
      idadeTexto = mesesStr
      faixaContexto = mesesStr
    } else {
      idadeTexto = `${mesesStr} e ${diasStr}`
      faixaContexto = `${mesesStr} e ${diasStr}`
    }
  }

  // Idade corrigida se prematuro (< 37 semanas)
  let idadeCorrigidaTexto: string | null = null
  if (idadeGestacionalSemanas && idadeGestacionalSemanas < 37) {
    const semanasPrematuro = 40 - idadeGestacionalSemanas
    const diasPrematuro = semanasPrematuro * 7
    const diasCorrigidos = diasDeVida - diasPrematuro
    if (diasCorrigidos > 0) {
      const mesesCorrigidos = Math.floor(diasCorrigidos / 30.44)
      const diasRestantesCorr = Math.round(diasCorrigidos % 30.44)
      if (mesesCorrigidos > 0) {
        idadeCorrigidaTexto = `${mesesCorrigidos}m ${diasRestantesCorr}d corrigidos`
      } else {
        idadeCorrigidaTexto = `${diasCorrigidos} dias corrigidos`
      }
    } else {
      idadeCorrigidaTexto = 'Prematuro (pré-termo)'
    }
  }

  return {
    diasDeVida,
    idadeTexto,
    faixaContexto,
    semanas,
    meses: Math.max(0, meses),
    diasRestantes: Math.max(0, diasRestantes),
    idadeCorrigidaTexto,
  }
}
