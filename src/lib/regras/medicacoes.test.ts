// src/lib/regras/medicacoes.test.ts
import { describe, expect, it } from 'vitest'
import {
  descreverHorarios,
  dosesDoDia,
  horariosPorIntervalo,
  situacaoSos,
  type Medicacao,
} from './medicacoes'

const vitD: Medicacao = {
  id: 'vd',
  nome: 'Vitamina D',
  dose: '2 gotas',
  tipo: 'fixo',
  horarios: ['09:00'],
  inicio: '2026-10-16',
  ativo: true,
}
const anti: Medicacao = {
  id: 'ab',
  nome: 'Antibiótico',
  dose: '2,5 mL',
  tipo: 'fixo',
  horarios: horariosPorIntervalo('06:00', 8),
  inicio: '2026-10-16',
  fim: '2026-10-22',
  ativo: true,
}

describe('horários', () => {
  it('a cada N horas a partir de um horário', () => {
    expect(horariosPorIntervalo('06:00', 8)).toEqual(['06:00', '14:00', '22:00'])
    expect(horariosPorIntervalo('20:30', 12)).toEqual(['08:30', '20:30'])
    expect(horariosPorIntervalo('08:00', 5)).toEqual([]) // não divide o dia
  })

  it('descrição amigável', () => {
    expect(descreverHorarios(vitD)).toBe('1x ao dia, às 09:00')
    expect(descreverHorarios(anti)).toBe('A cada 8 h (06:00, 14:00 e 22:00)')
    expect(descreverHorarios({ tipo: 'fixo', horarios: ['08:00', '13:00'] })).toBe('2x ao dia: 08:00 e 13:00')
    expect(descreverHorarios({ tipo: 'sos', horarios: [], intervalo_min_horas: 6 })).toContain('6 h')
  })
})

describe('doses do dia', () => {
  // 14:20 em Brasília = 17:20 UTC
  const agora = new Date('2026-10-16T17:20:00.000Z')

  it('situação de cada dose e quem deu', () => {
    const lista = dosesDoDia({
      medicacoes: [vitD, anti],
      doses: [
        { id: 'd1', medicacao: 'vd', previsto: '2026-10-16T09:00', dada_em: '2026-10-16T12:05:00Z', status: 'dada', criador_nome: 'Edineia' },
      ],
      agora,
    })
    const s = Object.fromEntries(lista.map((d) => [`${d.medicacao.id} ${d.horario}`, d.situacao]))
    expect(s).toEqual({
      'ab 06:00': 'atrasada',
      'vd 09:00': 'dada',
      'ab 14:00': 'agora',
      'ab 22:00': 'mais_tarde',
    })
    expect(lista.find((d) => d.medicacao.id === 'vd')!.registro!.criador_nome).toBe('Edineia')
  })

  it('fora do período ou inativa não aparece', () => {
    expect(dosesDoDia({ medicacoes: [anti], doses: [], agora: new Date('2026-10-23T12:00:00Z') })).toHaveLength(0)
    expect(dosesDoDia({ medicacoes: [{ ...vitD, ativo: false }], doses: [], agora })).toHaveLength(0)
    expect(dosesDoDia({ medicacoes: [vitD], doses: [], agora: new Date('2026-10-15T12:00:00Z') })).toHaveLength(0)
  })

  it('horário anterior ao cadastro não vira "atrasada"', () => {
    // Antibiótico cadastrado às 10:39 de Brasília: a dose das 06:00 daquele dia não conta
    const l = dosesDoDia({
      medicacoes: [{ ...anti, created: '2026-10-16 13:39:00.000Z' }],
      doses: [],
      agora,
    })
    expect(l.map((d) => d.horario)).toEqual(['14:00', '22:00'])
    // Cadastrado 5 min depois do horário: ainda lembra daquela dose
    expect(
      dosesDoDia({ medicacoes: [{ ...vitD, created: '2026-10-16 12:05:00.000Z' }], doses: [], agora }).map((d) => d.situacao),
    ).toEqual(['atrasada'])
    // No dia seguinte, todos os horários valem
    expect(
      dosesDoDia({ medicacoes: [{ ...anti, created: '2026-10-16 13:39:00.000Z' }], doses: [], agora: new Date('2026-10-17T12:00:00Z') }),
    ).toHaveLength(3)
  })

  it('"próxima" nas 2 horas antes do horário', () => {
    const l = dosesDoDia({ medicacoes: [anti], doses: [], agora: new Date('2026-10-16T15:30:00Z') }) // 12:30
    expect(l.find((d) => d.horario === '14:00')!.situacao).toBe('proxima')
  })
})

describe('se necessário', () => {
  const sos: Medicacao = { id: 's', nome: 'Paracetamol', dose: 'conforme a pediatra', tipo: 'sos', horarios: [], intervalo_min_horas: 6, inicio: '2026-10-16', ativo: true }
  it('respeita o intervalo mínimo', () => {
    const doses = [{ id: 'x', medicacao: 's', previsto: '', dada_em: '2026-10-16T12:00:00Z', status: 'dada' as const }]
    expect(situacaoSos(sos, doses, new Date('2026-10-16T15:00:00Z')).podeAgora).toBe(false)
    const r = situacaoSos(sos, doses, new Date('2026-10-16T18:00:00Z'))
    expect(r.podeAgora).toBe(true)
    expect(r.liberadaEm!.toISOString()).toBe('2026-10-16T18:00:00.000Z')
    expect(situacaoSos(sos, [], new Date()).podeAgora).toBe(true)
  })
})
