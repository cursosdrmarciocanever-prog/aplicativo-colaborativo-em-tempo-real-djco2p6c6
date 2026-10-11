// src/lib/regras/relatorio.ts
// Formatação do resumo para a pediatra (formato compactado solicitado)

import { MamadaEvento } from './mamadas'
import {
  formatLocalTime,
  formatLocalDateShort,
  getLocalWeekdayName,
  getSaoPauloParts,
} from './fuso'
import { calcularDiaDeVida } from './idade'

export interface ResumoPediatraParams {
  bebeNome: string
  dataNascimento: string // YYYY-MM-DD
  dataRelatorio?: string // YYYY-MM-DD
  diaDeVida: number
  mamadas: MamadaEvento[]
  totalXixi: number
  totalCoco: number
}

/**
 * Gera texto curto para copiar e levar à pediatra:
 *
 * Formato especificado no briefing:
 * "Sarah, nascida em 09/10/2026. Mamadas e fraldas."
 * "sábado, 10/10 (dia 2 de vida): 8 mamadas, 6 xixi, 3 cocô"
 * "Mamadas: 09:00, 12:05 E, 15:10 D, ..."
 */
export function gerarResumoPediatra(params: ResumoPediatraParams): string {
  const { bebeNome, dataNascimento, diaDeVida, mamadas, totalXixi, totalCoco } = params

  const [anoN, mesN, diaN] = (dataNascimento || '2026-10-09').split('-')
  const dataNascimentoFormatada = `${diaN}/${mesN}/${anoN}`

  // Formatar data do dia em pt-BR
  const agora = new Date()
  const diaSemana = getLocalWeekdayName(agora)
  const { day, month } = getSaoPauloParts(agora)
  const dataCurta = `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}`

  const totalMamadas = mamadas.filter((m) => !m.deleted_at).length

  // Montar lista de horários de mamada: 09:00, 12:05 E, 15:10 D
  // Ordenar cronologicamente para exibição no relatório
  const mamadasOrdenadasCronologico = [...mamadas]
    .filter((m) => !m.deleted_at)
    .sort((a, b) => new Date(a.inicio_em).getTime() - new Date(b.inicio_em).getTime())

  const listaHorarios = mamadasOrdenadasCronologico.map((m) => {
    const hora = formatLocalTime(m.inicio_em)
    let ladoAbrev = ''
    if (m.lado === 'esquerdo') ladoAbrev = ' E'
    else if (m.lado === 'direito') ladoAbrev = ' D'
    else if (m.lado === 'ambos') ladoAbrev = ' Ambos'
    return `${hora}${ladoAbrev}`
  })

  const mamadasLinha =
    listaHorarios.length > 0
      ? `Mamadas: ${listaHorarios.join(', ')}`
      : 'Mamadas: nenhuma registrada'

  const linhas = [
    `${bebeNome}, nascida em ${dataNascimentoFormatada}. Mamadas e fraldas.`,
    `${diaSemana}, ${dataCurta} (dia ${diaDeVida} de vida): ${totalMamadas} mamadas, ${totalXixi} xixi, ${totalCoco} cocô`,
    mamadasLinha,
  ]

  return linhas.join('\n')
}
