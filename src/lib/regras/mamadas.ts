// src/lib/regras/mamadas.ts
// Regras de negócio puras para mamadas

export interface MamadaEvento {
  id: string
  tipo?: 'mamada' | 'mamadeira' // mamadeira também conta para a próxima mamada
  inicio_em: string // ISO UTC
  fim_em?: string | null
  ml?: number | null
  lado?: 'esquerdo' | 'direito' | 'ambos' | '' | null
  criador_nome?: string
  deleted_at?: string | null
}

export interface ProximaMamadaInfo {
  ultimaMamada: MamadaEvento | null
  horarioProximaIso: string | null // ISO UTC
  horarioProximaFormatado: string // "HH:MM"
  estaAtrasada: boolean
  minutosRestantes: number // positivo se futuro, negativo se atrasado
  tempoTexto: string // "em 1h 12min" ou "passou há 25min — acordar e oferecer o peito"
  progressoPercentual: number // 0 a 100
  alertaAtrasoTexto: string | null
}

/**
 * Ordena mamadas pelo horário de início (inicio_em) do mais recente para o mais antigo.
 * Nunca pelo created.
 */
export function ordenarMamadas(mamadas: MamadaEvento[]): MamadaEvento[] {
  return [...mamadas]
    .filter((m) => !m.deleted_at)
    .sort((a, b) => new Date(b.inicio_em).getTime() - new Date(a.inicio_em).getTime())
}

/**
 * Calcula próxima mamada a partir da última mamada e do intervalo em minutos (padrão 180 min).
 * Intervalo é contado do INÍCIO de uma mamada ao INÍCIO da próxima.
 */
export function calcularProximaMamada(
  mamadas: MamadaEvento[],
  intervaloMinutos: number = 180,
  agoraDate: Date = new Date(),
): ProximaMamadaInfo {
  const ordenadas = ordenarMamadas(mamadas)
  if (ordenadas.length === 0) {
    return {
      ultimaMamada: null,
      horarioProximaIso: null,
      horarioProximaFormatado: '--:--',
      estaAtrasada: false,
      minutosRestantes: 0,
      tempoTexto: 'Nenhuma mamada registrada ainda',
      progressoPercentual: 0,
      alertaAtrasoTexto: null,
    }
  }

  const ultima = ordenadas[0]
  const ultimaInicioMs = new Date(ultima.inicio_em).getTime()
  const proximaMs = ultimaInicioMs + intervaloMinutos * 60 * 1000
  const proximaIso = new Date(proximaMs).toISOString()

  // Formatar HH:MM no fuso local
  const agoraMs = agoraDate.getTime()
  const diffMs = proximaMs - agoraMs
  const diffMinutosTotal = Math.round(diffMs / (60 * 1000))

  const estaAtrasada = diffMinutosTotal < 0
  const minutosAtrasados = Math.abs(diffMinutosTotal)

  // Progresso de 0 a 100% entre o início da última e o horário da próxima
  const decorridoMs = agoraMs - ultimaInicioMs
  const totalJanelaMs = intervaloMinutos * 60 * 1000
  let progresso = Math.min(100, Math.max(0, Math.round((decorridoMs / totalJanelaMs) * 100)))

  // Formata hora próxima em HH:MM local
  const proximaDate = new Date(proximaMs)
  const formatter = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  const horarioProximaFormatado = formatter.format(proximaDate)

  let tempoTexto = ''
  let alertaAtrasoTexto: string | null = null

  if (estaAtrasada) {
    const horas = Math.floor(minutosAtrasados / 60)
    const mins = minutosAtrasados % 60
    const atrasoFormatado =
      horas > 0 ? `${horas}h ${mins > 0 ? `${mins}min` : ''}`.trim() : `${mins}min`
    tempoTexto = `passou há ${atrasoFormatado} — acordar e oferecer o peito`
    alertaAtrasoTexto = `passou há ${atrasoFormatado} — acordar e oferecer o peito`
  } else {
    const horas = Math.floor(diffMinutosTotal / 60)
    const mins = diffMinutosTotal % 60
    if (horas > 0 && mins > 0) {
      tempoTexto = `em ${horas}h ${mins}min`
    } else if (horas > 0) {
      tempoTexto = `em ${horas}h`
    } else {
      tempoTexto = `em ${mins}min`
    }
  }

  return {
    ultimaMamada: ultima,
    horarioProximaIso: proximaIso,
    horarioProximaFormatado,
    estaAtrasada,
    minutosRestantes: diffMinutosTotal,
    tempoTexto,
    progressoPercentual: progresso,
    alertaAtrasoTexto,
  }
}

/**
 * Validação de horário manual de mamada:
 * - Deve estar no formato HH:MM
 * - Deve ser horário do dia de hoje (ou data selecionada)
 * - Não pode estar no futuro (rejeitado com erro no campo)
 */
export function validarHorarioMamada(
  horarioStr: string,
  dataStr: string,
  agoraDate: Date = new Date(),
): { valido: boolean; erro?: string; isoUtc?: string } {
  if (!horarioStr || !horarioStr.match(/^\d{2}:\d{2}$/)) {
    return { valido: false, erro: 'Informe o horário no formato HH:MM' }
  }

  const [h, m] = horarioStr.split(':').map(Number)
  if (h < 0 || h > 23 || m < 0 || m > 59) {
    return { valido: false, erro: 'Horário inválido' }
  }

  // Gera o ISO em UTC considerando o fuso de SP
  const [ano, mes, dia] = dataStr.split('-').map(Number)
  // Timestamp em UTC
  const dataLocalTarget = new Date(Date.UTC(ano, mes - 1, dia, h, m, 0))
  // Offset de SP: -3h normalmente (+3h UTC)
  // 09:00 SP = 12:00 UTC
  // Vamos calcular com precisão
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false,
  })
  const parts = formatter.formatToParts(dataLocalTarget)
  let pY = ano,
    pM = mes,
    pD = dia,
    pH = 0,
    pMin = 0
  for (const p of parts) {
    if (p.type === 'year') pY = parseInt(p.value, 10)
    if (p.type === 'month') pM = parseInt(p.value, 10)
    if (p.type === 'day') pD = parseInt(p.value, 10)
    if (p.type === 'hour') pH = parseInt(p.value, 10) % 24
    if (p.type === 'minute') pMin = parseInt(p.value, 10)
  }
  const backMs = Date.UTC(pY, pM - 1, pD, pH, pMin, 0)
  const diffMs = dataLocalTarget.getTime() - backMs
  const isoUtc = new Date(dataLocalTarget.getTime() + diffMs).toISOString()

  const eventoMs = new Date(isoUtc).getTime()
  const agoraMs = agoraDate.getTime()

  if (eventoMs > agoraMs + 60 * 1000) {
    // tolerância de 1 min
    return { valido: false, erro: 'O horário não pode ser no futuro' }
  }

  return { valido: true, isoUtc }
}

/**
 * Calcula tempo decorrido desde a mamada anterior
 */
export function calcularTempoDesdeAnterior(
  mamadaAtual: MamadaEvento,
  mamadaAnterior: MamadaEvento | null,
): string | null {
  if (!mamadaAnterior) return null
  const atualMs = new Date(mamadaAtual.inicio_em).getTime()
  const anteriorMs = new Date(mamadaAnterior.inicio_em).getTime()
  const diffMin = Math.round((atualMs - anteriorMs) / (60 * 1000))
  if (diffMin <= 0) return null

  const h = Math.floor(diffMin / 60)
  const m = diffMin % 60
  if (h > 0 && m > 0) return `${h}h ${m}min após`
  if (h > 0) return `${h}h após`
  return `${m}min após`
}
