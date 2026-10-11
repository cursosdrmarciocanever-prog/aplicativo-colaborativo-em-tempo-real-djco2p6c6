// src/lib/regras/fuso.ts
// Conversões UTC <-> America/Sao_Paulo em funções puras

const TIMEZONE = 'America/Sao_Paulo'

/**
 * Converte Date ou string ISO para string de data/hora no fuso America/Sao_Paulo
 * Formato padrão: YYYY-MM-DDTHH:mm:ss
 */
export function getSaoPauloParts(dateInput: Date | string | number): {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
  dayOfWeek: number // 0 = Domingo, 1 = Segunda, ...
} {
  const d =
    typeof dateInput === 'string' || typeof dateInput === 'number' ? new Date(dateInput) : dateInput
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false,
    weekday: 'short',
  })

  const parts = formatter.formatToParts(d)
  let year = 1970
  let month = 1
  let day = 1
  let hour = 0
  let minute = 0
  let second = 0

  for (const p of parts) {
    if (p.type === 'year') year = parseInt(p.value, 10)
    if (p.type === 'month') month = parseInt(p.value, 10)
    if (p.type === 'day') day = parseInt(p.value, 10)
    if (p.type === 'hour') hour = parseInt(p.value, 10) % 24
    if (p.type === 'minute') minute = parseInt(p.value, 10)
    if (p.type === 'second') second = parseInt(p.value, 10)
  }

  // Pegar dia da semana em UTC local equivalente
  const dayOfWeek = new Date(Date.UTC(year, month - 1, day)).getUTCDay()

  return { year, month, day, hour, minute, second, dayOfWeek }
}

/**
 * Retorna o dia local atual no formato YYYY-MM-DD (America/Sao_Paulo)
 */
export function getLocalTodayDateString(referenceDate: Date = new Date()): string {
  const { year, month, day } = getSaoPauloParts(referenceDate)
  const mm = String(month).padStart(2, '0')
  const dd = String(day).padStart(2, '0')
  return `${year}-${mm}-${dd}`
}

/**
 * Converte data local (YYYY-MM-DD e HH:mm) em string ISO UTC
 * O fuso de Brasília atualmente é UTC-3 permanente (sem horário de verão desde 2019).
 */
export function localDateTimeToUtcIso(dateStr: string, timeStr: string): string {
  // Ex: dateStr "2026-10-10", timeStr "09:00"
  // America/Sao_Paulo é UTC-3 => 09:00 local = 12:00:00.000Z UTC
  const [year, month, day] = dateStr.split('-').map(Number)
  const [hour, minute] = timeStr.split(':').map(Number)

  // Calcula o offset real no timezone America/Sao_Paulo
  // Cria um UTC hipotético e subtrai a diferença
  const localTarget = new Date(Date.UTC(year, month - 1, day, hour, minute, 0))
  // Descobrir o offset real do fuso na data específica
  const parts = getSaoPauloParts(localTarget)
  const backToUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  )
  const offsetDiffMs = localTarget.getTime() - backToUtc

  const resultUtc = new Date(localTarget.getTime() + offsetDiffMs)
  return resultUtc.toISOString()
}

/**
 * Formata um ISO UTC para exibição de horário (HH:MM) no fuso local
 */
export function formatLocalTime(utcIso: string): string {
  if (!utcIso) return '--:--'
  const { hour, minute } = getSaoPauloParts(utcIso)
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

/**
 * Formata um ISO UTC para exibição de data curta (DD/MM) no fuso local
 */
export function formatLocalDateShort(utcIso: string): string {
  if (!utcIso) return ''
  const { day, month } = getSaoPauloParts(utcIso)
  return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}`
}

/**
 * Retorna nome do dia da semana em pt-BR (ex: "sábado", "domingo")
 */
export function getLocalWeekdayName(utcIsoOrDate: string | Date): string {
  const dias = [
    'domingo',
    'segunda-feira',
    'terça-feira',
    'quarta-feira',
    'quinta-feira',
    'sexta-feira',
    'sábado',
  ]
  const { dayOfWeek } = getSaoPauloParts(utcIsoOrDate)
  return dias[dayOfWeek] || ''
}

/**
 * Retorna chave de dia local no formato YYYY-MM-DD para agrupamentos
 */
export function getLocalDayKey(utcIso: string): string {
  if (!utcIso) return ''
  const { year, month, day } = getSaoPauloParts(utcIso)
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}
