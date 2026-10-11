// src/lib/regras/regras.test.ts
// Testes unitários para regras de negócio puras (mamadas, fraldas, idade, fuso, relatório)

import {
  calcularProximaMamada,
  validarHorarioMamada,
  calcularTempoDesdeAnterior,
  ordenarMamadas,
  MamadaEvento,
} from './mamadas'
import { getMetaFraldasPorDia, avaliarMetaFraldas, AVISO_INFORMATIVO_PESO_FRALDAS } from './fraldas'
import { calcularDiaDeVida, formatarIdadeAmigavel } from './idade'
import { formatLocalTime, getLocalDayKey, localDateTimeToUtcIso, getSaoPauloParts } from './fuso'
import { gerarResumoPediatra } from './relatorio'

export function runTests(): { total: number; passed: number; failed: number; errors: string[] } {
  let passed = 0
  let failed = 0
  const errors: string[] = []

  function assert(condition: boolean, desc: string) {
    if (condition) {
      passed++
    } else {
      failed++
      errors.push(`FALHA: ${desc}`)
    }
  }

  // 1. Testes de Próxima Mamada
  // Com última mamada 09:00 e intervalo 3h (180 min), a próxima mostra 12:00
  const mamada09: MamadaEvento = {
    id: '1',
    inicio_em: '2026-10-10T12:00:00.000Z', // 12:00 UTC = 09:00 em America/Sao_Paulo (UTC-3)
    lado: 'esquerdo',
    criador_nome: 'Edineia',
  }

  const proxima1 = calcularProximaMamada([mamada09], 180, new Date('2026-10-10T13:00:00.000Z')) // 10:00 local (em 2h)
  assert(
    proxima1.horarioProximaFormatado === '12:00',
    `Próxima mamada deve ser 12:00 (obtido: ${proxima1.horarioProximaFormatado})`,
  )
  assert(proxima1.estaAtrasada === false, 'Mamada às 10:00 não está atrasada para as 12:00')
  assert(proxima1.tempoTexto.includes('2h'), `Tempo deve ser ~2h (obtido: ${proxima1.tempoTexto})`)

  // Teste mamada atrasada
  const proximaAtrasada = calcularProximaMamada(
    [mamada09],
    180,
    new Date('2026-10-10T15:30:00.000Z'),
  ) // 12:30 local (30 min atrasada)
  assert(proximaAtrasada.estaAtrasada === true, 'Deve indicar mamada atrasada')
  assert(
    proximaAtrasada.tempoTexto.includes('passou há'),
    `Texto deve conter 'passou há' (obtido: ${proximaAtrasada.tempoTexto})`,
  )
  assert(
    proximaAtrasada.tempoTexto.includes('acordar e oferecer o peito'),
    'Texto deve orientar acordar e oferecer o peito',
  )

  // Teste ordenação por inicio_em (nunca por id/created)
  const mamada10: MamadaEvento = {
    id: '2',
    inicio_em: '2026-10-10T15:00:00.000Z',
    lado: 'direito',
  }
  const ordenadas = ordenarMamadas([mamada09, mamada10])
  assert(ordenadas[0].id === '2', 'A mamada mais recente deve ser a primeira')

  // 2. Teste de validação de horário de mamada
  const agoraSimulado = new Date('2026-10-10T15:00:00.000Z') // 12:00 local
  const validaPassado = validarHorarioMamada('11:30', '2026-10-10', agoraSimulado)
  assert(validaPassado.valido === true, 'Horário no passado (11:30 para 12:00) deve ser aceito')

  const validaFuturo = validarHorarioMamada('14:00', '2026-10-10', agoraSimulado)
  assert(validaFuturo.valido === false, 'Horário no futuro (14:00 para 12:00) deve ser rejeitado')
  assert(
    validaFuturo.erro === 'O horário não pode ser no futuro',
    'Mensagem de erro de horário futuro',
  )

  // 3. Teste de metas de fraldas por dia de vida
  // Dia 1 -> 1 xixi / mecônio
  const metaDia1 = getMetaFraldasPorDia(1)
  assert(metaDia1.minimoXixi === 1, 'Dia 1 deve esperar mínimo 1 xixi')
  assert(metaDia1.cocoEsperado.includes('mecônio'), 'Dia 1 fezes de mecônio')

  // Dia 2 -> 2 xixi
  const metaDia2 = getMetaFraldasPorDia(2)
  assert(metaDia2.minimoXixi === 2, 'Dia 2 deve esperar 2 xixis')

  // Dia 3 -> 3 xixi / transição
  const metaDia3 = getMetaFraldasPorDia(3)
  assert(metaDia3.minimoXixi === 3, 'Dia 3 deve esperar 3 xixis')

  // Dia 4 -> 4 xixi
  const metaDia4 = getMetaFraldasPorDia(4)
  assert(metaDia4.minimoXixi === 4, 'Dia 4 deve esperar 4 xixis')

  // Dia 5+ -> 6 xixi
  const metaDia5 = getMetaFraldasPorDia(5)
  assert(metaDia5.minimoXixi === 6, 'Dia 5+ deve esperar 6 ou mais xixis')

  // Mensagens de status de fraldas
  const statusMetaNaoAtingida = avaliarMetaFraldas(2, 1, 1)
  assert(statusMetaNaoAtingida.atingiuMetaXixi === false, '1 xixi no dia 2 não atinge meta')
  assert(
    statusMetaNaoAtingida.mensagemStatus === 'Faltam 1 para a meta de hoje.',
    `Mensagem de faltam fraldas (obtido: ${statusMetaNaoAtingida.mensagemStatus})`,
  )

  const statusMetaAtingida = avaliarMetaFraldas(2, 2, 1)
  assert(statusMetaAtingida.atingiuMetaXixi === true, '2 xixis no dia 2 atinge meta')
  assert(
    statusMetaAtingida.mensagemStatus === 'Meta de hoje atingida.',
    'Mensagem de meta atingida',
  )

  // 4. Teste de dia de vida (Nascimento = Dia 1)
  // Sarah nascida em 09/10/2026:
  // Em 09/10/2026 = Dia 1
  const diaVida1 = calcularDiaDeVida('2026-10-09', new Date('2026-10-09T15:00:00.000Z'))
  assert(diaVida1 === 1, `09/10/2026 deve ser dia 1 de vida (obtido: ${diaVida1})`)

  // Em 10/10/2026 = Dia 2
  const diaVida2 = calcularDiaDeVida('2026-10-09', new Date('2026-10-10T15:00:00.000Z'))
  assert(diaVida2 === 2, `10/10/2026 deve ser dia 2 de vida (obtido: ${diaVida2})`)

  // Em 11/10/2026 = Dia 3
  const diaVida3 = calcularDiaDeVida('2026-10-09', new Date('2026-10-11T15:00:00.000Z'))
  assert(diaVida3 === 3, `11/10/2026 deve ser dia 3 de vida (obtido: ${diaVida3})`)

  // 5. Teste de formato de idade amigável
  const idade10 = formatarIdadeAmigavel('2026-10-09', 39, new Date('2026-10-10T15:00:00.000Z'))
  assert(
    idade10.faixaContexto === 'Dia 2 de vida',
    `Faixa de contexto deve ser 'Dia 2 de vida' (obtido: ${idade10.faixaContexto})`,
  )

  // 6. Teste de fuso horário e conversão
  const horaFormatada = formatLocalTime('2026-10-10T12:00:00.000Z')
  assert(horaFormatada === '09:00', `12:00 UTC deve ser 09:00 em SP (obtido: ${horaFormatada})`)

  const diaKey = getLocalDayKey('2026-10-10T12:00:00.000Z')
  assert(diaKey === '2026-10-10', `Dia key local deve ser 2026-10-10 (obtido: ${diaKey})`)

  // 7. Teste de resumo p/ pediatra
  const resumo = gerarResumoPediatra({
    bebeNome: 'Sarah',
    dataNascimento: '2026-10-09',
    diaDeVida: 2,
    mamadas: [mamada09],
    totalXixi: 2,
    totalCoco: 1,
  })
  assert(
    resumo.includes('Sarah, nascida em 09/10/2026. Mamadas e fraldas.'),
    'Resumo deve ter cabeçalho padrão',
  )
  assert(
    resumo.includes('(dia 2 de vida): 1 mamadas, 2 xixi, 1 cocô'),
    `Resumo deve ter linha de totais (obtido: ${resumo})`,
  )
  assert(resumo.includes('Mamadas: 09:00 E'), 'Resumo deve listar horários com lado')

  return { total: passed + failed, passed, failed, errors }
}
