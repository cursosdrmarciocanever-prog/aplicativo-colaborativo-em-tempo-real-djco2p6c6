// src/lib/regras/vacinas.ts
// Calendário Nacional de Vacinação da criança (PNI / Ministério da Saúde) até 4 anos,
// status de cada dose e exportação para a agenda do celular (.ics).
// O calendário muda com o tempo: a referência final é a Caderneta da Criança e a UBS.

import { diasEntre } from './crescimento'

export interface DoseCalendario {
  id: string // ex.: "penta-1" (é o que fica salvo em vacinas.dose_id)
  vacina: string
  dose: string
  idadeMeses: number // 0 = ao nascer
  protege: string
  /** Idade máxima para esta dose, em dias de vida (ex.: rotavírus). */
  limiteDias?: number
  nota?: string
}

export const AVISO_CALENDARIO =
  'Baseado no Calendário Nacional de Vacinação (PNI/Ministério da Saúde). Confira sempre na Caderneta da Criança e com a pediatra: o calendário pode mudar e há vacinas extras na rede particular.'

export const CALENDARIO_PNI: DoseCalendario[] = [
  { id: 'bcg', vacina: 'BCG', dose: 'Dose única', idadeMeses: 0, protege: 'Formas graves de tuberculose' },
  {
    id: 'hepb-0',
    vacina: 'Hepatite B',
    dose: 'Dose ao nascer',
    idadeMeses: 0,
    protege: 'Hepatite B',
    limiteDias: 30,
    nota: 'De preferência nas primeiras 24 horas de vida. Depois de 30 dias, a proteção segue com a Pentavalente.',
  },

  { id: 'penta-1', vacina: 'Pentavalente', dose: '1ª dose', idadeMeses: 2, protege: 'Difteria, tétano, coqueluche, Haemophilus b e hepatite B' },
  { id: 'vip-1', vacina: 'VIP (poliomielite inativada)', dose: '1ª dose', idadeMeses: 2, protege: 'Poliomielite' },
  { id: 'pneumo-1', vacina: 'Pneumocócica 10-valente', dose: '1ª dose', idadeMeses: 2, protege: 'Pneumonia, meningite e otite por pneumococo' },
  {
    id: 'rota-1',
    vacina: 'Rotavírus',
    dose: '1ª dose',
    idadeMeses: 2,
    protege: 'Diarreia grave por rotavírus',
    limiteDias: 105, // 3 meses e 15 dias
    nota: 'Só pode ser dada até 3 meses e 15 dias de vida.',
  },

  { id: 'menc-1', vacina: 'Meningocócica C', dose: '1ª dose', idadeMeses: 3, protege: 'Meningite meningocócica C' },

  { id: 'penta-2', vacina: 'Pentavalente', dose: '2ª dose', idadeMeses: 4, protege: 'Difteria, tétano, coqueluche, Haemophilus b e hepatite B' },
  { id: 'vip-2', vacina: 'VIP (poliomielite inativada)', dose: '2ª dose', idadeMeses: 4, protege: 'Poliomielite' },
  { id: 'pneumo-2', vacina: 'Pneumocócica 10-valente', dose: '2ª dose', idadeMeses: 4, protege: 'Pneumonia, meningite e otite por pneumococo' },
  {
    id: 'rota-2',
    vacina: 'Rotavírus',
    dose: '2ª dose',
    idadeMeses: 4,
    protege: 'Diarreia grave por rotavírus',
    limiteDias: 239, // 7 meses e 29 dias
    nota: 'Só pode ser dada até 7 meses e 29 dias de vida.',
  },

  { id: 'menc-2', vacina: 'Meningocócica C', dose: '2ª dose', idadeMeses: 5, protege: 'Meningite meningocócica C' },

  { id: 'penta-3', vacina: 'Pentavalente', dose: '3ª dose', idadeMeses: 6, protege: 'Difteria, tétano, coqueluche, Haemophilus b e hepatite B' },
  { id: 'vip-3', vacina: 'VIP (poliomielite inativada)', dose: '3ª dose', idadeMeses: 6, protege: 'Poliomielite' },
  {
    id: 'covid-1',
    vacina: 'Covid-19',
    dose: '1ª dose',
    idadeMeses: 6,
    protege: 'Covid-19',
    nota: 'O número de doses depende da vacina disponível na UBS. Se houver 3ª dose, registre como vacina extra.',
  },
  {
    id: 'influenza-1',
    vacina: 'Influenza (gripe)',
    dose: '1ª dose',
    idadeMeses: 6,
    protege: 'Gripe',
    nota: 'No primeiro ano são 2 doses com 30 dias de intervalo; depois, uma dose por ano.',
  },
  { id: 'covid-2', vacina: 'Covid-19', dose: '2ª dose', idadeMeses: 7, protege: 'Covid-19' },
  { id: 'influenza-2', vacina: 'Influenza (gripe)', dose: '2ª dose', idadeMeses: 7, protege: 'Gripe' },

  { id: 'fa-1', vacina: 'Febre amarela', dose: 'Dose inicial', idadeMeses: 9, protege: 'Febre amarela' },

  { id: 'scr-1', vacina: 'Tríplice viral', dose: '1ª dose', idadeMeses: 12, protege: 'Sarampo, caxumba e rubéola' },
  { id: 'pneumo-r', vacina: 'Pneumocócica 10-valente', dose: 'Reforço', idadeMeses: 12, protege: 'Pneumonia, meningite e otite por pneumococo' },
  {
    id: 'menc-r',
    vacina: 'Meningocócica',
    dose: 'Reforço',
    idadeMeses: 12,
    protege: 'Meningite meningocócica',
    nota: 'Meningocócica C ou ACWY, conforme a disponível na UBS.',
  },

  { id: 'dtp-r1', vacina: 'DTP (tríplice bacteriana)', dose: '1º reforço', idadeMeses: 15, protege: 'Difteria, tétano e coqueluche' },
  { id: 'vip-r', vacina: 'VIP (poliomielite inativada)', dose: 'Reforço', idadeMeses: 15, protege: 'Poliomielite' },
  { id: 'hepa', vacina: 'Hepatite A', dose: 'Dose única', idadeMeses: 15, protege: 'Hepatite A' },
  {
    id: 'tetraviral',
    vacina: 'Tetraviral',
    dose: 'Dose única',
    idadeMeses: 15,
    protege: 'Sarampo, caxumba, rubéola e catapora',
    nota: 'Pode ser substituída por tríplice viral (2ª dose) + varicela.',
  },

  { id: 'dtp-r2', vacina: 'DTP (tríplice bacteriana)', dose: '2º reforço', idadeMeses: 48, protege: 'Difteria, tétano e coqueluche' },
  { id: 'varicela-2', vacina: 'Varicela', dose: '2ª dose', idadeMeses: 48, protege: 'Catapora' },
  { id: 'fa-r', vacina: 'Febre amarela', dose: 'Reforço', idadeMeses: 48, protege: 'Febre amarela' },
]

/** Data recomendada (AAAA-MM-DD): mesmo dia do mês do nascimento, N meses depois. */
export function dataRecomendada(nascimento: string, meses: number): string {
  const [a, m, d] = nascimento.split('-').map(Number)
  const alvo = new Date(Date.UTC(a, m - 1 + meses, 1))
  const ultimoDia = new Date(Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, 0)).getUTCDate()
  alvo.setUTCDate(Math.min(d, ultimoDia))
  return alvo.toISOString().slice(0, 10)
}

export function somarDias(dataIso: string, dias: number): string {
  const [a, m, d] = dataIso.split('-').map(Number)
  return new Date(Date.UTC(a, m - 1, d + dias)).toISOString().slice(0, 10)
}

export type StatusDose = 'aplicada' | 'atrasada' | 'agora' | 'proxima' | 'futura' | 'prazo_encerrado'

export interface DoseComStatus extends DoseCalendario {
  data: string // recomendada
  status: StatusDose
  aplicadaEm?: string
  registroId?: string
}

/** Janela para "agora" (data chegou) antes de virar "atrasada". */
const TOLERANCIA_DIAS = 30
/** "Próxima" = nos próximos 30 dias. */
const JANELA_PROXIMA_DIAS = 30

export function statusDasDoses(params: {
  nascimento: string
  hoje: string
  aplicadas: { id: string; dose_id: string; aplicada_em: string }[]
}): DoseComStatus[] {
  const porDose = new Map(params.aplicadas.map((a) => [a.dose_id, a]))
  return CALENDARIO_PNI.map((dose) => {
    const data = dataRecomendada(params.nascimento, dose.idadeMeses)
    const reg = porDose.get(dose.id)
    if (reg) {
      return { ...dose, data, status: 'aplicada' as const, aplicadaEm: reg.aplicada_em, registroId: reg.id }
    }
    const vida = diasEntre(params.nascimento, params.hoje)
    const faltam = diasEntre(params.hoje, data)
    let status: StatusDose
    if (dose.limiteDias !== undefined && vida > dose.limiteDias) status = 'prazo_encerrado'
    else if (faltam > JANELA_PROXIMA_DIAS) status = 'futura'
    else if (faltam > 0) status = 'proxima'
    else if (-faltam <= TOLERANCIA_DIAS) status = 'agora'
    else status = 'atrasada'
    return { ...dose, data, status }
  })
}

/** Agrupa as doses por idade ("Ao nascer", "2 meses"...). */
export function rotuloIdade(meses: number): string {
  if (meses === 0) return 'Ao nascer'
  if (meses % 12 === 0) return `${meses / 12} ${meses === 12 ? 'ano' : 'anos'}`
  return `${meses} meses`
}

export function resumoVacinal(doses: DoseComStatus[]) {
  const pendentesAgora = doses.filter((d) => d.status === 'agora' || d.status === 'atrasada')
  const atrasadas = doses.filter((d) => d.status === 'atrasada')
  const aplicadas = doses.filter((d) => d.status === 'aplicada').length
  const proxima = doses
    .filter((d) => d.status === 'proxima' || d.status === 'futura')
    .sort((a, b) => a.data.localeCompare(b.data))[0]
  const proximasMesmaData = proxima
    ? doses.filter(
        (d) => d.data === proxima.data && (d.status === 'proxima' || d.status === 'futura'),
      )
    : []
  return { aplicadas, total: doses.length, pendentesAgora, atrasadas, proxima, proximasMesmaData }
}

// ---------- Agenda do celular (.ics) ----------

function escaparIcs(texto: string): string {
  return texto.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
}

/** Quebra linhas longas (RFC 5545: até 75 octetos; usamos 70 caracteres por segurança). */
function dobrar(linha: string): string {
  const partes: string[] = []
  let resto = linha
  while (resto.length > 70) {
    partes.push(resto.slice(0, 70))
    resto = ' ' + resto.slice(70)
  }
  partes.push(resto)
  return partes.join('\r\n')
}

export interface EventoAgenda {
  uid: string
  data: string // AAAA-MM-DD (evento de dia inteiro)
  titulo: string
  descricao: string
}

export function gerarIcs(eventos: EventoAgenda[], agora: Date = new Date()): string {
  const carimbo = agora.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  const linhas = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Diario da Sarah//PT-BR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ]
  for (const e of eventos) {
    const inicio = e.data.replace(/-/g, '')
    const fim = somarDias(e.data, 1).replace(/-/g, '')
    linhas.push(
      'BEGIN:VEVENT',
      `UID:${e.uid}@diario`,
      `DTSTAMP:${carimbo}`,
      `DTSTART;VALUE=DATE:${inicio}`,
      `DTEND;VALUE=DATE:${fim}`,
      dobrar(`SUMMARY:${escaparIcs(e.titulo)}`),
      dobrar(`DESCRIPTION:${escaparIcs(e.descricao)}`),
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${escaparIcs(e.titulo)}`,
      'TRIGGER:-PT15H', // véspera, às 9h
      'END:VALARM',
      'END:VEVENT',
    )
  }
  linhas.push('END:VCALENDAR')
  return linhas.join('\r\n') + '\r\n'
}

/** Um evento por data com as vacinas que ainda faltam (de hoje em diante). */
export function eventosDeVacina(
  doses: DoseComStatus[],
  nomeBebe: string,
  hoje: string,
): EventoAgenda[] {
  const porData = new Map<string, DoseComStatus[]>()
  for (const d of doses) {
    if (d.status === 'aplicada' || d.status === 'prazo_encerrado') continue
    // Atrasadas entram como lembrete para hoje
    const data = d.data < hoje ? hoje : d.data
    porData.set(data, [...(porData.get(data) || []), d])
  }
  return [...porData.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([data, lista]) => ({
      uid: `vacinas-${data}`,
      data,
      titulo: `Vacinas da ${nomeBebe}`,
      descricao:
        lista.map((d) => `• ${d.vacina} (${d.dose})`).join('\n') +
        '\n\nLeve a Caderneta da Criança. Confira o calendário na UBS.',
    }))
}
