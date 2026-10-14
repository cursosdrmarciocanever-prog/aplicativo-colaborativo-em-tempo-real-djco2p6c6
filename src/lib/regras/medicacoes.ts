// src/lib/regras/medicacoes.ts
// Remédios e vitaminas: horários do dia, situação de cada dose e intervalo mínimo
// entre doses "se necessário". Quem define remédio e dose é sempre a pediatra.

import { getLocalTodayDateString, getSaoPauloParts, localDateTimeToUtcIso } from './fuso'

export type TipoMedicacao = 'fixo' | 'sos'

export interface Medicacao {
  id: string
  nome: string
  dose: string // como a pediatra escreveu: "2 gotas", "400 UI", "2,5 mL"
  tipo: TipoMedicacao
  horarios: string[] // "HH:MM" (tipo fixo)
  intervalo_min_horas?: number | null // tipo sos: tempo mínimo entre doses
  inicio: string // AAAA-MM-DD
  fim?: string | null // AAAA-MM-DD (inclusive); vazio = uso contínuo
  ativo: boolean
  /** Quando foi cadastrado (PocketBase "AAAA-MM-DD HH:MM:SS.sssZ" ou ISO): doses de antes não contam. */
  created?: string
}

export interface DoseDada {
  id: string
  medicacao: string
  previsto: string // "AAAA-MM-DDTHH:MM" (horário de Brasília) ou "" para "se necessário"
  dada_em: string // ISO UTC
  status: 'dada' | 'pulada'
  criador?: string
  criador_nome?: string
}

/** Intervalos que dividem o dia em horários iguais todos os dias. */
export const INTERVALOS_HORAS = [4, 6, 8, 12, 24] as const

const HORA = /^([01]\d|2[0-3]):[0-5]\d$/

export function horarioValido(h: string): boolean {
  return HORA.test(h)
}

/** "A cada 8 h a partir das 06:00" -> ["06:00", "14:00", "22:00"] (ordenado). */
export function horariosPorIntervalo(primeira: string, intervaloHoras: number): string[] {
  if (!horarioValido(primeira) || !(intervaloHoras > 0) || 24 % intervaloHoras !== 0) return []
  const [h, m] = primeira.split(':').map(Number)
  const lista: string[] = []
  for (let i = 0; i < 24 / intervaloHoras; i++) {
    const hh = (h + i * intervaloHoras) % 24
    lista.push(`${String(hh).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
  }
  return lista.sort()
}

export function normalizarHorarios(horarios: string[]): string[] {
  return [...new Set(horarios.filter(horarioValido))].sort()
}

/** Está em uso neste dia (ativa e dentro de início/fim)? */
export function emUsoNoDia(m: Medicacao, dia: string): boolean {
  if (!m.ativo) return false
  if (m.inicio && dia < m.inicio) return false
  if (m.fim && dia > m.fim) return false
  return true
}

export type SituacaoDose = 'dada' | 'pulada' | 'atrasada' | 'agora' | 'proxima' | 'mais_tarde'

export interface DoseDoDia {
  medicacao: Medicacao
  previsto: string // "AAAA-MM-DDTHH:MM"
  horario: string // "HH:MM"
  situacao: SituacaoDose
  registro?: DoseDada
}

/** Até 30 min depois do horário a dose é "agora"; depois disso, "atrasada". */
export const TOLERANCIA_MIN = 30
/** "Próxima" = nas próximas 2 horas. */
const JANELA_PROXIMA_MIN = 120

export function chaveDoHorario(dia: string, horario: string): string {
  return `${dia}T${horario}`
}

/** Doses de horário fixo do dia, com a situação de cada uma. */
export function dosesDoDia(params: {
  medicacoes: Medicacao[]
  doses: DoseDada[]
  agora: Date
  dia?: string
}): DoseDoDia[] {
  const dia = params.dia || getLocalTodayDateString(params.agora)
  const porChave = new Map(
    params.doses.filter((d) => d.previsto).map((d) => [`${d.medicacao}|${d.previsto}`, d]),
  )
  const t = params.agora.getTime()
  const saida: DoseDoDia[] = []
  for (const m of params.medicacoes) {
    if (m.tipo !== 'fixo' || !emUsoNoDia(m, dia)) continue
    const cadastro = m.created ? new Date(m.created.replace(' ', 'T')).getTime() : 0
    for (const horario of normalizarHorarios(m.horarios)) {
      const previsto = chaveDoHorario(dia, horario)
      const registro = porChave.get(`${m.id}|${previsto}`)
      const quandoHorario = new Date(localDateTimeToUtcIso(dia, horario)).getTime()
      // Horário que já tinha passado havia mais de 30 min quando o remédio foi cadastrado
      // não vira "atrasada" (ex.: antibiótico receitado às 10h não cobra a dose das 6h)
      if (!registro && cadastro && quandoHorario < cadastro - TOLERANCIA_MIN * 60000) continue
      let situacao: SituacaoDose
      if (registro) situacao = registro.status
      else {
        const min = (t - quandoHorario) / 60000
        if (min > TOLERANCIA_MIN) situacao = 'atrasada'
        else if (min >= 0) situacao = 'agora'
        else if (-min <= JANELA_PROXIMA_MIN) situacao = 'proxima'
        else situacao = 'mais_tarde'
      }
      saida.push({ medicacao: m, previsto, horario, situacao, registro })
    }
  }
  return saida.sort((a, b) => a.horario.localeCompare(b.horario) || a.medicacao.nome.localeCompare(b.medicacao.nome))
}

/** Remédio "se necessário": última dose e a partir de quando pode repetir. */
export function situacaoSos(
  m: Medicacao,
  doses: DoseDada[],
  agora: Date,
): { ultima?: DoseDada; liberadaEm?: Date; podeAgora: boolean } {
  const ultima = doses
    .filter((d) => d.medicacao === m.id && d.status === 'dada')
    .sort((a, b) => b.dada_em.localeCompare(a.dada_em))[0]
  if (!ultima || !m.intervalo_min_horas) return { ultima, podeAgora: true }
  const liberadaEm = new Date(new Date(ultima.dada_em).getTime() + m.intervalo_min_horas * 3600_000)
  return { ultima, liberadaEm, podeAgora: agora >= liberadaEm }
}

/** Texto curto dos horários: "08:00 e 20:00", "a cada 8 h (06:00, 14:00, 22:00)". */
export function descreverHorarios(m: Pick<Medicacao, 'tipo' | 'horarios' | 'intervalo_min_horas'>): string {
  if (m.tipo === 'sos') {
    return m.intervalo_min_horas
      ? `Se necessário, com pelo menos ${m.intervalo_min_horas} h entre as doses`
      : 'Se necessário'
  }
  const h = normalizarHorarios(m.horarios)
  if (h.length === 0) return 'Sem horário'
  if (h.length === 1) return `1x ao dia, às ${h[0]}`
  const intervalo = 24 / h.length
  const regular = Number.isInteger(intervalo) && horariosPorIntervalo(h[0], intervalo).join() === h.join()
  const lista = h.slice(0, -1).join(', ') + ' e ' + h[h.length - 1]
  return regular ? `A cada ${intervalo} h (${lista})` : `${h.length}x ao dia: ${lista}`
}

/** Hora local "HH:MM" de um ISO (para "dada às ..."). */
export function horaLocal(iso: string): string {
  const { hour, minute } = getSaoPauloParts(iso)
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}
