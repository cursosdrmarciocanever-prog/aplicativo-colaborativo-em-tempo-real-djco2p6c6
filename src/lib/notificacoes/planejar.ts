// src/lib/notificacoes/planejar.ts
// Decide quais avisos mandar agora (função pura, usada pelo serviço notificador).
// Cada aviso tem uma chave única: o notificador grava a chave antes de enviar, então
// reinícios e ciclos repetidos nunca mandam o mesmo aviso duas vezes.

import { formatLocalTime, getLocalTodayDateString, getSaoPauloParts } from '../regras/fuso'
import { formatarDataBr } from '../regras/consulta'
import { somarDias, statusDasDoses } from '../regras/vacinas'

export interface Inscricao {
  id: string
  usuario: string
  espaco: string
  mamada: boolean
  mamada_antes_min: number
  mamada_atraso: boolean
  vacinas: boolean
  consultas: boolean
  familia: boolean
  teste_em?: string
}

export interface UltimaMamada {
  id: string
  tipo: string // mamada | mamadeira
  inicio_em: string // ISO UTC
  lado?: string | null
  ml?: number | null
}

export interface EstadoBebe {
  espaco: {
    id: string
    nome: string
    data_nascimento?: string
    intervalo_mamada_minutos?: number
  }
  ultimaMamada?: UltimaMamada | null
  vacinasAplicadas: { id: string; dose_id: string; aplicada_em: string }[]
  proximasConsultas: string[] // AAAA-MM-DD
}

export interface Aviso {
  chave: string
  inscricaoId: string
  titulo: string
  corpo: string
  url: string
  tag: string
}

const MIN = 60_000
/** Depois desta janela um aviso perdido (servidor parado, por exemplo) não é mais mandado. */
const JANELA_MS = 90 * MIN
export const ATRASO_MAMADA_MIN = 30

const LADO: Record<string, string> = { esquerdo: 'peito esquerdo', direito: 'peito direito', ambos: 'os dois peitos' }

function descreverUltima(u: UltimaMamada): string {
  const hora = formatLocalTime(u.inicio_em)
  if (u.tipo === 'mamadeira') return `Última: mamadeira às ${hora}${u.ml ? ` (${u.ml} mL)` : ''}`
  return `Última às ${hora}${u.lado && LADO[u.lado] ? `, ${LADO[u.lado]}` : ''}`
}

function dentroDaJanela(agora: number, alvo: number): boolean {
  return agora >= alvo && agora - alvo <= JANELA_MS
}

export function planejarAvisos(params: {
  agora: Date
  bebe: EstadoBebe
  inscricoes: Inscricao[]
}): Aviso[] {
  const { agora, bebe } = params
  const t = agora.getTime()
  const nome = bebe.espaco.nome || 'Bebê'
  const avisos: Aviso[] = []
  const inscricoes = params.inscricoes.filter((i) => i.espaco === bebe.espaco.id)

  // ---- Mamada (conta de início a início, mamadeira inclusive, como na tela Hoje) ----
  const u = bebe.ultimaMamada
  if (u) {
    const intervalo = bebe.espaco.intervalo_mamada_minutos || 180
    const proxima = new Date(u.inicio_em).getTime() + intervalo * MIN
    const horaProxima = formatLocalTime(new Date(proxima).toISOString())
    for (const i of inscricoes) {
      if (i.mamada) {
        const antes = Math.max(0, i.mamada_antes_min || 0)
        if (dentroDaJanela(t, proxima - antes * MIN)) {
          avisos.push({
            chave: `mamada:${u.id}:${i.id}`,
            inscricaoId: i.id,
            titulo: antes ? `${nome}: mamada às ${horaProxima}` : `${nome}: hora da mamada`,
            corpo: antes
              ? `Faltam ${antes} min. ${descreverUltima(u)}.`
              : `${descreverUltima(u)}. Intervalo de ${Math.round(intervalo / 60)}h.`,
            url: '/hoje',
            tag: 'mamada',
          })
        }
      }
      if (i.mamada_atraso && dentroDaJanela(t, proxima + ATRASO_MAMADA_MIN * MIN)) {
        avisos.push({
          chave: `mamada-atraso:${u.id}:${i.id}`,
          inscricaoId: i.id,
          titulo: `${nome}: mamada atrasada`,
          corpo: `Passou ${ATRASO_MAMADA_MIN} min do horário (${horaProxima}). Se estiver dormindo, vale acordar e oferecer o peito. Já mamou? Registre no app.`,
          url: '/hoje',
          tag: 'mamada',
        })
      }
    }
  }

  const hoje = getLocalTodayDateString(agora)
  const amanha = somarDias(hoje, 1)
  const { hour } = getSaoPauloParts(agora)

  // ---- Vacinas: véspera e dia, a partir das 9h ----
  if (bebe.espaco.data_nascimento && hour >= 9 && hour < 21) {
    const doses = statusDasDoses({
      nascimento: bebe.espaco.data_nascimento,
      hoje,
      aplicadas: bebe.vacinasAplicadas,
    }).filter((d) => d.status !== 'aplicada' && d.status !== 'prazo_encerrado')
    for (const [quando, data] of [
      ['vespera', amanha],
      ['dia', hoje],
    ] as const) {
      const lista = doses.filter((d) => d.data === data)
      if (!lista.length) continue
      const nomes = [...new Set(lista.map((d) => d.vacina))].join(', ')
      for (const i of inscricoes.filter((x) => x.vacinas)) {
        avisos.push({
          chave: `vacina-${quando}:${bebe.espaco.id}:${data}:${i.id}`,
          inscricaoId: i.id,
          titulo: quando === 'vespera' ? `Amanhã tem vacina da ${nome}` : `Hoje é dia de vacina da ${nome}`,
          corpo: `${nomes}. Leve a Caderneta da Criança.`,
          url: '/saude?aba=vacinas',
          tag: `vacina-${data}`,
        })
      }
    }
  }

  // ---- Consultas: véspera (9h às 21h) e manhã do dia (7h às 12h) ----
  for (const data of [...new Set(bebe.proximasConsultas)]) {
    const vespera = data === amanha && hour >= 9 && hour < 21
    const dia = data === hoje && hour >= 7 && hour < 12
    if (!vespera && !dia) continue
    for (const i of inscricoes.filter((x) => x.consultas)) {
      avisos.push({
        chave: `consulta-${vespera ? 'vespera' : 'dia'}:${bebe.espaco.id}:${data}:${i.id}`,
        inscricaoId: i.id,
        titulo: vespera ? `Amanhã: consulta da ${nome}` : `Hoje tem consulta da ${nome}`,
        corpo: `${formatarDataBr(data)}. Abra "Preparar resumo para a consulta" para levar medidas, vacinas e dúvidas.`,
        url: '/saude?aba=consultas',
        tag: `consulta-${data}`,
      })
    }
  }

  // ---- Teste pedido no app ----
  for (const i of inscricoes) {
    if (!i.teste_em) continue
    const pedido = new Date(i.teste_em).getTime()
    if (!dentroDaJanela(t, pedido)) continue
    avisos.push({
      chave: `teste:${i.id}:${i.teste_em}`,
      inscricaoId: i.id,
      titulo: 'Notificações ativadas',
      corpo: `Este celular vai receber os avisos do Diário da ${nome}.`,
      url: '/ajustes',
      tag: 'teste',
    })
  }

  return avisos
}

const ROTULO_TIPO: Record<string, string> = {
  mamada: 'mamada',
  mamadeira: 'mamadeira',
  ordenha: 'ordenha',
  xixi: 'xixi',
  coco: 'cocô',
  peso: 'peso',
  nota: 'uma anotação',
}

/** Aviso para a família quando alguém registra algo (quem registrou não recebe). */
export function avisosDeRegistro(params: {
  evento: {
    id: string
    espaco: string
    tipo: string
    inicio_em: string
    criador: string
    criador_nome?: string
    lado?: string | null
    ml?: number | null
  }
  nomeBebe: string
  inscricoes: Inscricao[]
}): Aviso[] {
  const { evento } = params
  const quem = evento.criador_nome || 'Alguém da família'
  let oque = ROTULO_TIPO[evento.tipo] || 'um registro'
  if (evento.tipo === 'mamada' && evento.lado && LADO[evento.lado]) oque += ` (${LADO[evento.lado]})`
  if ((evento.tipo === 'mamadeira' || evento.tipo === 'ordenha') && evento.ml) oque += ` de ${evento.ml} mL`
  return params.inscricoes
    .filter((i) => i.familia && i.espaco === evento.espaco && i.usuario !== evento.criador)
    .map((i) => ({
      chave: `registro:${evento.id}:${i.id}`,
      inscricaoId: i.id,
      titulo: `${params.nomeBebe}: ${oque}`,
      corpo: `${quem} registrou às ${formatLocalTime(evento.inicio_em)}.`,
      url: '/hoje',
      tag: `registro-${evento.tipo}`,
    }))
}
