// src/lib/regras/saude.test.ts
// Curvas da OMS, idade corrigida, alertas de crescimento, calendário vacinal e agenda .ics
import { describe, expect, it } from 'vitest'
import {
  avaliarCrescimento,
  escoreZ,
  formatarPercentil,
  ganhoDiario,
  idadeParaCurva,
  valorNoEscoreZ,
  zDoPercentil,
} from './crescimento'
import {
  CALENDARIO_PNI,
  dataRecomendada,
  eventosDeVacina,
  gerarIcs,
  resumoVacinal,
  statusDasDoses,
} from './vacinas'
import { gerarResumoConsulta, lerNumero, lerPesoEmGramas, pontosDeCrescimento } from './consulta'

describe('curvas da OMS (meninas)', () => {
  it('mediana tem escore z zero e percentil 50', () => {
    expect(escoreZ('peso', 0, 3.2322)).toBeCloseTo(0, 6)
    expect(formatarPercentil(escoreZ('comprimento', 730, 86.4153))).toBe('P50')
  })

  it('confere com as tabelas publicadas (z = −2 e +2 ao nascer)', () => {
    // Tabela OMS meninas, peso ao nascer: −2 DP = 2,4 kg; +2 DP = 4,2 kg
    expect(valorNoEscoreZ('peso', 0, -2)).toBeCloseTo(2.4, 1)
    expect(valorNoEscoreZ('peso', 0, 2)).toBeCloseTo(4.2, 1)
    // Perímetro cefálico ao nascer: −2 DP = 31,5 cm
    expect(valorNoEscoreZ('perimetroCefalico', 0, -2)).toBeCloseTo(31.5, 1)
  })

  it('percentis de referência', () => {
    expect(zDoPercentil(50)).toBeCloseTo(0, 3)
    expect(zDoPercentil(97)).toBeCloseTo(1.881, 2)
    expect(formatarPercentil(-5)).toBe('abaixo de P0,1')
  })

  it('fora de 0 a 24 meses não calcula', () => {
    expect(escoreZ('peso', 800, 12)).toBeNull()
  })

  it('idade corrigida só para prematuros', () => {
    expect(idadeParaCurva('2026-10-09', '2026-11-08', 39)).toEqual({ dias: 30, corrigida: false })
    expect(idadeParaCurva('2026-10-09', '2026-12-08', 34)).toEqual({ dias: 18, corrigida: true })
  })
})

describe('alertas de crescimento', () => {
  const base = { nascimento: '2026-10-09', pesoNascimentoG: 3250, hoje: '2026-10-20' }

  it('perda de até 10% nos primeiros dias é esperada (informativo)', () => {
    const a = avaliarCrescimento({ ...base, pontos: [{ data: '2026-10-12', pesoKg: 3.05 }] })
    expect(a).toHaveLength(1)
    expect(a[0].nivel).toBe('info')
  })

  it('perda de 10% ou mais pede atenção', () => {
    const a = avaliarCrescimento({ ...base, pontos: [{ data: '2026-10-12', pesoKg: 2.9 }] })
    expect(a.some((x) => x.nivel === 'atencao' && x.mensagem.includes('11%'))).toBe(true)
  })

  it('abaixo do peso de nascimento após 2 semanas pede atenção', () => {
    const a = avaliarCrescimento({ ...base, pontos: [{ data: '2026-10-30', pesoKg: 3.2 }] })
    expect(a.some((x) => x.mensagem.includes('2 semanas'))).toBe(true)
  })

  it('ganho diário entre as duas últimas pesagens', () => {
    expect(
      ganhoDiario([
        { data: '2026-10-20', pesoKg: 3.3 },
        { data: '2026-10-30', pesoKg: 3.6 },
      ]),
    ).toEqual({ gramasPorDia: 30, dias: 10 })
    // Perda dos primeiros dias não aparece como "ganho negativo"
    const inicio = [
      { data: '2026-10-09', pesoKg: 3.25 },
      { data: '2026-10-11', pesoKg: 3.05 },
    ]
    expect(ganhoDiario(inicio, '2026-10-09')).toBeNull()
    // Pesagens com menos de 7 dias de diferença: usa a anterior mais distante, ou nenhuma
    expect(ganhoDiario(inicio)).toBeNull()
    expect(
      ganhoDiario([
        { data: '2026-10-09', pesoKg: 3.25 },
        { data: '2026-10-19', pesoKg: 3.4 },
        { data: '2026-10-20', pesoKg: 3.5 },
      ]),
    ).toEqual({ gramasPorDia: 23, dias: 11 })
  })
})

describe('calendário vacinal', () => {
  it('data recomendada respeita meses curtos', () => {
    expect(dataRecomendada('2026-10-09', 2)).toBe('2026-12-09')
    expect(dataRecomendada('2026-01-31', 1)).toBe('2026-02-28')
  })

  it('status das doses', () => {
    const doses = statusDasDoses({
      nascimento: '2026-10-09',
      hoje: '2026-11-20',
      aplicadas: [{ id: 'r1', dose_id: 'bcg', aplicada_em: '2026-10-09' }],
    })
    const s = (id: string) => doses.find((d) => d.id === id)!.status
    expect(s('bcg')).toBe('aplicada')
    expect(s('hepb-0')).toBe('prazo_encerrado') // dose do nascimento: só até 30 dias
    expect(s('penta-1')).toBe('proxima') // 09/12, daqui a 19 dias
    expect(s('menc-1')).toBe('futura')
    expect(doses).toHaveLength(CALENDARIO_PNI.length)

    const depois = statusDasDoses({ nascimento: '2026-10-09', hoje: '2027-01-20', aplicadas: [] })
    const d = (id: string) => depois.find((x) => x.id === id)!.status
    expect(d('penta-1')).toBe('atrasada') // 42 dias depois da data
    expect(d('menc-1')).toBe('agora') // 09/01, há 11 dias
  })

  it('rotavírus fora do prazo não é mais "atrasada"', () => {
    const doses = statusDasDoses({ nascimento: '2026-01-01', hoje: '2026-05-01', aplicadas: [] })
    expect(doses.find((d) => d.id === 'rota-1')!.status).toBe('prazo_encerrado')
  })

  it('resumo mostra a próxima data e as vacinas dela', () => {
    const doses = statusDasDoses({
      nascimento: '2026-10-09',
      hoje: '2026-10-10',
      aplicadas: [
        { id: 'a', dose_id: 'bcg', aplicada_em: '2026-10-09' },
        { id: 'b', dose_id: 'hepb-0', aplicada_em: '2026-10-09' },
      ],
    })
    const r = resumoVacinal(doses)
    expect(r.aplicadas).toBe(2)
    expect(r.proxima?.data).toBe('2026-12-09')
    expect(r.proximasMesmaData.map((d) => d.id)).toEqual(['penta-1', 'vip-1', 'pneumo-1', 'rota-1'])
  })

  it('gera agenda .ics válida com lembrete na véspera', () => {
    const doses = statusDasDoses({ nascimento: '2026-10-09', hoje: '2026-10-10', aplicadas: [] })
    const eventos = eventosDeVacina(doses, 'Sarah', '2026-10-10')
    const ics = gerarIcs(eventos, new Date('2026-10-10T12:00:00Z'))
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true)
    expect(ics).toContain('DTSTART;VALUE=DATE:20261209')
    expect(ics).toContain('TRIGGER:-PT15H')
    expect(ics.split('\r\n').every((l) => l.length <= 75)).toBe(true)
    // BCG e hepatite B (ao nascer, ainda sem registro) viram lembrete para hoje
    expect(eventos[0].data).toBe('2026-10-10')
  })
})

describe('consulta', () => {
  it('lê peso em kg ou gramas, com vírgula', () => {
    expect(lerPesoEmGramas('3,45')).toBe(3450)
    expect(lerPesoEmGramas('3450')).toBe(3450)
    expect(lerPesoEmGramas('')).toBeNull()
    expect(lerNumero('50,5')).toBe(50.5)
  })

  it('resumo leva medidas com percentil, vacinas e dúvidas', () => {
    const pontos = pontosDeCrescimento({
      nascimento: '2026-10-09',
      pesoNascimentoG: 3250,
      consultas: [{ data: '2026-10-19', peso_g: 3400, comprimento_cm: 50.5 }],
    })
    const doses = statusDasDoses({
      nascimento: '2026-10-09',
      hoje: '2026-11-20',
      aplicadas: [
        { id: 'a', dose_id: 'bcg', aplicada_em: '2026-10-09' },
        { id: 'b', dose_id: 'hepb-0', aplicada_em: '2026-10-09' },
      ],
    })
    const texto = gerarResumoConsulta({
      bebeNome: 'Sarah',
      nascimento: '2026-10-09',
      idadeTexto: '1 mês e 11 dias',
      hoje: '2026-11-20',
      pontos,
      doses,
      duvidasAbertas: ['Pode dar banho todo dia?'],
    })
    expect(texto).toContain('Peso: 3,400 kg em 19/10/2026 (P')
    expect(texto).toContain('Ganho de peso: 15 g/dia nos últimos 10 dias')
    expect(texto).toContain('- Em dia até hoje')
    expect(texto).toContain('Pentavalente (1ª dose) em 09/12/2026')
    expect(texto).toContain('1. Pode dar banho todo dia?')
  })

  it('resumo sempre mostra a próxima data de vacina, mesmo distante', () => {
    const doses = statusDasDoses({
      nascimento: '2026-10-09',
      hoje: '2026-10-12',
      aplicadas: [
        { id: 'a', dose_id: 'bcg', aplicada_em: '2026-10-09' },
        { id: 'b', dose_id: 'hepb-0', aplicada_em: '2026-10-09' },
      ],
    })
    const texto = gerarResumoConsulta({
      bebeNome: 'Sarah',
      nascimento: '2026-10-09',
      idadeTexto: 'Dia 4 de vida',
      hoje: '2026-10-12',
      pontos: [],
      doses,
      duvidasAbertas: [],
    })
    expect(texto).toContain('Rotavírus (1ª dose) em 09/12/2026')
    expect(texto).not.toContain('Meningocócica C')
  })
})
