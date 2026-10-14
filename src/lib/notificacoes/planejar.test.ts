// src/lib/notificacoes/planejar.test.ts
import { describe, expect, it } from 'vitest'
import { avisosDeRegistro, planejarAvisos, type EstadoBebe, type Inscricao } from './planejar'

const insc = (extra: Partial<Inscricao> = {}): Inscricao => ({
  id: 'i1',
  usuario: 'u1',
  espaco: 'e1',
  mamada: true,
  mamada_antes_min: 0,
  mamada_atraso: true,
  vacinas: true,
  consultas: true,
  familia: false,
  ...extra,
})

// Última mamada 09:00 de Brasília (12:00 UTC), intervalo 3h -> próxima 12:00 (15:00 UTC)
const bebe = (extra: Partial<EstadoBebe> = {}): EstadoBebe => ({
  espaco: { id: 'e1', nome: 'Sarah', data_nascimento: '2026-10-09', intervalo_mamada_minutos: 180 },
  ultimaMamada: { id: 'm1', tipo: 'mamada', inicio_em: '2026-10-14T12:00:00.000Z', lado: 'esquerdo' },
  vacinasAplicadas: [
    { id: 'a', dose_id: 'bcg', aplicada_em: '2026-10-09' },
    { id: 'b', dose_id: 'hepb-0', aplicada_em: '2026-10-09' },
  ],
  proximasConsultas: [],
  ...extra,
})

const em = (iso: string, b = bebe(), i = [insc()]) =>
  planejarAvisos({ agora: new Date(iso), bebe: b, inscricoes: i })

describe('aviso de mamada', () => {
  it('antes do horário, nada', () => {
    expect(em('2026-10-14T14:59:00.000Z')).toHaveLength(0)
  })

  it('na hora: um aviso com a última mamada e o lado', () => {
    const a = em('2026-10-14T15:00:30.000Z')
    expect(a).toHaveLength(1)
    expect(a[0].chave).toBe('mamada:m1:i1')
    expect(a[0].titulo).toBe('Sarah: hora da mamada')
    expect(a[0].corpo).toContain('Última às 09:00, peito esquerdo')
  })

  it('aviso antecipado conforme a preferência', () => {
    const a = em('2026-10-14T14:45:00.000Z', bebe(), [insc({ mamada_antes_min: 15 })])
    expect(a[0].titulo).toBe('Sarah: mamada às 12:00')
    expect(a[0].corpo).toContain('Faltam 15 min')
  })

  it('30 min depois: lembrete de atraso (a chave da mamada continua a mesma)', () => {
    const chaves = em('2026-10-14T15:31:00.000Z').map((a) => a.chave)
    expect(chaves).toEqual(['mamada:m1:i1', 'mamada-atraso:m1:i1'])
  })

  it('aviso velho (mais de 90 min) não é mandado', () => {
    expect(em('2026-10-14T18:00:00.000Z')).toHaveLength(0)
  })

  it('preferência desligada não recebe', () => {
    expect(em('2026-10-14T15:31:00.000Z', bebe(), [insc({ mamada: false, mamada_atraso: false })])).toHaveLength(0)
  })

  it('mamadeira conta para o horário', () => {
    const b = bebe({
      ultimaMamada: { id: 'm2', tipo: 'mamadeira', inicio_em: '2026-10-14T12:00:00.000Z', ml: 90 },
    })
    expect(em('2026-10-14T15:00:00.000Z', b)[0].corpo).toContain('mamadeira às 09:00 (90 mL)')
  })

  it('só inscrições do mesmo bebê', () => {
    expect(em('2026-10-14T15:00:00.000Z', bebe(), [insc({ espaco: 'outro' })])).toHaveLength(0)
  })
})

describe('vacinas e consultas', () => {
  const semMamada = bebe({ ultimaMamada: null })

  it('véspera da vacina, a partir das 9h', () => {
    // 2 meses = 09/12; véspera 08/12 às 09:00 de Brasília = 12:00 UTC
    expect(em('2026-12-08T11:59:00.000Z', semMamada)).toHaveLength(0)
    const a = em('2026-12-08T12:00:00.000Z', semMamada)
    expect(a).toHaveLength(1)
    expect(a[0].titulo).toBe('Amanhã tem vacina da Sarah')
    expect(a[0].corpo).toContain('Pentavalente')
    expect(a[0].corpo).toContain('Rotavírus')
  })

  it('no dia da vacina', () => {
    const a = em('2026-12-09T13:00:00.000Z', semMamada)
    expect(a.map((x) => x.chave)).toEqual(['vacina-dia:e1:2026-12-09:i1'])
  })

  it('vacina já aplicada não avisa', () => {
    const b = bebe({
      ultimaMamada: null,
      vacinasAplicadas: ['bcg', 'hepb-0', 'penta-1', 'vip-1', 'pneumo-1', 'rota-1'].map((d) => ({
        id: d,
        dose_id: d,
        aplicada_em: '2026-12-08',
      })),
    })
    expect(em('2026-12-09T13:00:00.000Z', b)).toHaveLength(0)
  })

  it('consulta: véspera e manhã do dia', () => {
    const b = bebe({ ultimaMamada: null, proximasConsultas: ['2026-10-19'] })
    expect(em('2026-10-18T13:00:00.000Z', b)[0].titulo).toBe('Amanhã: consulta da Sarah')
    expect(em('2026-10-19T10:30:00.000Z', b)[0].titulo).toBe('Hoje tem consulta da Sarah')
    expect(em('2026-10-19T16:00:00.000Z', b)).toHaveLength(0)
  })
})

describe('teste e registros da família', () => {
  it('teste pedido no app vira aviso', () => {
    const a = em('2026-10-14T13:00:10.000Z', bebe({ ultimaMamada: null }), [
      insc({ teste_em: '2026-10-14T13:00:00.000Z' }),
    ])
    expect(a[0].titulo).toBe('Notificações ativadas')
  })

  it('quem registrou não recebe; quem ativou "família" recebe', () => {
    const avisos = avisosDeRegistro({
      evento: {
        id: 'ev1',
        espaco: 'e1',
        tipo: 'mamada',
        lado: 'direito',
        inicio_em: '2026-10-14T06:10:00.000Z',
        criador: 'u1',
        criador_nome: 'Edineia',
      },
      nomeBebe: 'Sarah',
      inscricoes: [
        insc({ id: 'a', usuario: 'u1', familia: true }),
        insc({ id: 'b', usuario: 'u2', familia: true }),
        insc({ id: 'c', usuario: 'u3', familia: false }),
      ],
    })
    expect(avisos.map((a) => a.inscricaoId)).toEqual(['b'])
    expect(avisos[0].titulo).toBe('Sarah: mamada (peito direito)')
    expect(avisos[0].corpo).toBe('Edineia registrou às 03:10.')
  })
})
