// src/lib/regras/regras.test.ts
// Testes unitários das regras de negócio puras (seção 5). Rode com: npm test

import { describe, expect, it } from 'vitest'
import {
  calcularProximaMamada,
  validarHorarioMamada,
  calcularTempoDesdeAnterior,
  ordenarMamadas,
  type MamadaEvento,
} from './mamadas'
import { getMetaFraldasPorDia, avaliarMetaFraldas } from './fraldas'
import { calcularDiaDeVida, formatarIdadeAmigavel } from './idade'
import { formatLocalTime, getLocalDayKey, localDateTimeToUtcIso } from './fuso'
import { gerarResumoPediatra } from './relatorio'

// 12:00 UTC = 09:00 em America/Sao_Paulo (UTC-3)
const mamada09: MamadaEvento = {
  id: '1',
  inicio_em: '2026-10-10T12:00:00.000Z',
  lado: 'esquerdo',
  criador_nome: 'Edineia',
}

describe('próxima mamada', () => {
  it('última às 09:00 com intervalo de 3 h: próxima às 12:00', () => {
    const p = calcularProximaMamada([mamada09], 180, new Date('2026-10-10T13:00:00.000Z'))
    expect(p.horarioProximaFormatado).toBe('12:00')
    expect(p.estaAtrasada).toBe(false)
    expect(p.tempoTexto).toContain('2h')
  })

  it('passou do horário: atenção e orientação para oferecer o peito', () => {
    const p = calcularProximaMamada([mamada09], 180, new Date('2026-10-10T15:30:00.000Z'))
    expect(p.estaAtrasada).toBe(true)
    expect(p.tempoTexto).toContain('passou há')
    expect(p.tempoTexto).toContain('acordar e oferecer o peito')
  })

  it('conta de início a início pela mamada mais recente (por inicio_em, não por criação)', () => {
    const registradaDepoisMasMaisAntiga: MamadaEvento = {
      id: 'zzz',
      inicio_em: '2026-10-10T09:00:00.000Z',
    }
    const p = calcularProximaMamada(
      [mamada09, registradaDepoisMasMaisAntiga],
      180,
      new Date('2026-10-10T13:00:00.000Z'),
    )
    expect(p.horarioProximaFormatado).toBe('12:00')
  })

  it('respeita intervalo configurável', () => {
    const p = calcularProximaMamada([mamada09], 120, new Date('2026-10-10T12:30:00.000Z'))
    expect(p.horarioProximaFormatado).toBe('11:00')
  })

  it('ordena da mais recente para a mais antiga', () => {
    const m10: MamadaEvento = { id: '2', inicio_em: '2026-10-10T15:00:00.000Z', lado: 'direito' }
    expect(ordenarMamadas([mamada09, m10])[0].id).toBe('2')
  })

  it('tempo desde a mamada anterior', () => {
    const m = { id: '2', inicio_em: '2026-10-10T15:05:00.000Z' }
    expect(calcularTempoDesdeAnterior(m, mamada09)).toBe('3h 5min após')
    expect(calcularTempoDesdeAnterior(m, null)).toBeNull()
  })
})

describe('horário manual', () => {
  const agora = new Date('2026-10-10T15:00:00.000Z') // 12:00 local

  it('aceita horário passado do dia', () => {
    expect(validarHorarioMamada('11:30', '2026-10-10', agora).valido).toBe(true)
  })

  it('rejeita horário futuro', () => {
    const r = validarHorarioMamada('14:00', '2026-10-10', agora)
    expect(r.valido).toBe(false)
    expect(r.erro).toBe('O horário não pode ser no futuro')
  })
})

describe('fraldas por dia de vida', () => {
  it.each([
    [1, 1, 'mecônio'],
    [2, 2, 'mecônio'],
    [3, 3, 'transição'],
    [4, 4, 'amarelad'],
    [5, 6, 'amarelad'],
    [30, 6, 'amarelad'],
  ])('dia %i: pelo menos %i xixi (%s)', (dia, xixi, coco) => {
    const meta = getMetaFraldasPorDia(dia)
    expect(meta.minimoXixi).toBe(xixi)
    expect(meta.cocoEsperado).toContain(coco)
  })

  it('mensagem de quanto falta e de meta atingida', () => {
    expect(avaliarMetaFraldas(2, 1, 1).mensagemStatus).toBe('Faltam 1 para a meta de hoje.')
    const ok = avaliarMetaFraldas(2, 2, 1)
    expect(ok.atingiuMetaXixi).toBe(true)
    expect(ok.mensagemStatus).toBe('Meta de hoje atingida.')
  })
})

describe('dia de vida e idade', () => {
  it('nascimento é o dia 1 no calendário local', () => {
    expect(calcularDiaDeVida('2026-10-09', new Date('2026-10-09T15:00:00.000Z'))).toBe(1)
    expect(calcularDiaDeVida('2026-10-09', new Date('2026-10-10T15:00:00.000Z'))).toBe(2)
    expect(calcularDiaDeVida('2026-10-09', new Date('2026-10-11T15:00:00.000Z'))).toBe(3)
  })

  it('23:30 em Brasília ainda é o mesmo dia, mesmo já sendo amanhã em UTC', () => {
    // 11/10 02:30 UTC = 10/10 23:30 local
    expect(calcularDiaDeVida('2026-10-09', new Date('2026-10-11T02:30:00.000Z'))).toBe(2)
  })

  it('idade amigável: dias, depois semanas, depois meses e dias', () => {
    const em = (iso: string) => formatarIdadeAmigavel('2026-10-09', 39, new Date(iso)).faixaContexto
    expect(em('2026-10-10T15:00:00Z')).toBe('Dia 2 de vida')
    expect(em('2026-10-29T15:00:00Z')).toBe('Semana 3 (21 dias)')
    expect(em('2026-12-14T15:00:00Z')).toBe('2 meses e 5 dias')
  })

  it('idade corrigida só para prematuros', () => {
    expect(formatarIdadeAmigavel('2026-10-09', 39).idadeCorrigidaTexto).toBeNull()
    expect(
      formatarIdadeAmigavel('2026-10-09', 34, new Date('2026-12-14T15:00:00Z')).idadeCorrigidaTexto,
    ).toBeTruthy()
  })
})

describe('fuso horário (grava UTC, mostra Brasília)', () => {
  it('converte UTC para horário local', () => {
    expect(formatLocalTime('2026-10-10T12:00:00.000Z')).toBe('09:00')
    expect(getLocalDayKey('2026-10-10T12:00:00.000Z')).toBe('2026-10-10')
    expect(getLocalDayKey('2026-10-11T02:30:00.000Z')).toBe('2026-10-10')
  })

  it('converte horário local para UTC', () => {
    expect(localDateTimeToUtcIso('2026-10-10', '09:00')).toBe('2026-10-10T12:00:00.000Z')
  })
})

describe('resumo para a pediatra', () => {
  it('segue o modelo curto', () => {
    const resumo = gerarResumoPediatra({
      bebeNome: 'Sarah',
      dataNascimento: '2026-10-09',
      diaDeVida: 2,
      mamadas: [mamada09],
      totalXixi: 2,
      totalCoco: 1,
    })
    expect(resumo).toContain('Sarah, nascida em 09/10/2026. Mamadas e fraldas.')
    expect(resumo).toContain('(dia 2 de vida): 1 mamadas, 2 xixi, 1 cocô')
    expect(resumo).toContain('Mamadas: 09:00 E')
    expect(resumo).not.toContain('Mamadeira')
  })

  it('inclui duração, mamadeira, ordenha e cor do cocô quando houver', () => {
    const resumo = gerarResumoPediatra({
      bebeNome: 'Sarah',
      dataNascimento: '2026-10-09',
      diaDeVida: 5,
      mamadas: [
        { ...mamada09, fim_em: '2026-10-10T12:20:00.000Z' },
        { id: 'b', tipo: 'mamadeira', inicio_em: '2026-10-10T15:00:00.000Z', ml: 60 },
      ],
      totalXixi: 6,
      totalCoco: 2,
      volumes: {
        mamadeiras: 1,
        mlMamadeira: 60,
        mlFormula: 60,
        mlLeiteMaterno: 0,
        ordenhas: 1,
        mlOrdenha: 90,
      },
      coresCoco: ['amarelo', 'amarelo', null],
    })
    expect(resumo).toContain('1 mamadas')
    expect(resumo).toContain('09:00 E (20 min)')
    expect(resumo).toContain('Mamadeira: 1x, 60 mL (fórmula 60 mL)')
    expect(resumo).toContain('Ordenha: 1x, 90 mL')
    expect(resumo).toContain('Cor do cocô: 2 amarelo')
  })
})
