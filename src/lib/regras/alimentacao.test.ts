import { describe, expect, it } from 'vitest'
import {
  avaliarCorCoco,
  formatarCronometro,
  formatarDuracao,
  totalizarVolumes,
  validarVolumeMl,
} from './alimentacao'

describe('cor do cocô', () => {
  it('cores habituais não geram aviso', () => {
    for (const cor of ['amarelo', 'verde', 'marrom'] as const) {
      expect(avaliarCorCoco(cor, 10).nivel).toBe('ok')
    }
  })

  it('mecônio é esperado nos primeiros dias e merece atenção depois do 4º', () => {
    expect(avaliarCorCoco('meconio', 2).nivel).toBe('ok')
    expect(avaliarCorCoco('meconio', 4).nivel).toBe('ok')
    expect(avaliarCorCoco('meconio', 6).nivel).toBe('atencao')
  })

  it('cocô claro e com sangue sempre sugerem conversar com a pediatra', () => {
    expect(avaliarCorCoco('clara', 1).mensagem).toContain('pediatra')
    expect(avaliarCorCoco('sangue', 20).mensagem).toContain('pediatra')
  })

  it('sem cor informada, sem aviso', () => {
    expect(avaliarCorCoco('', 10)).toEqual({ nivel: 'ok', mensagem: null })
  })
})

describe('duração e cronômetro', () => {
  it('formata duração da mamada', () => {
    expect(formatarDuracao('2026-10-10T12:00:00Z', '2026-10-10T12:15:00Z')).toBe('15 min')
    expect(formatarDuracao('2026-10-10T12:00:00Z', '2026-10-10T13:05:00Z')).toBe('1h 05min')
    expect(formatarDuracao('2026-10-10T12:00:00Z', null)).toBeNull()
    expect(formatarDuracao('2026-10-10T12:00:00Z', '2026-10-10T11:00:00Z')).toBeNull()
  })

  it('formata cronômetro em andamento', () => {
    expect(formatarCronometro(65)).toBe('01:05')
    expect(formatarCronometro(3723)).toBe('1:02:03')
    expect(formatarCronometro(-5)).toBe('00:00')
  })
})

describe('mamadeira e ordenha', () => {
  it('soma volumes por tipo e conteúdo', () => {
    const t = totalizarVolumes([
      { tipo: 'mamadeira', ml: 60, conteudo: 'formula' },
      { tipo: 'mamadeira', ml: 40, conteudo: 'leite_materno' },
      { tipo: 'ordenha', ml: 90 },
      { tipo: 'mamada' },
      { tipo: 'xixi' },
    ])
    expect(t).toEqual({
      mamadeiras: 2,
      mlMamadeira: 100,
      mlFormula: 60,
      mlLeiteMaterno: 40,
      ordenhas: 1,
      mlOrdenha: 90,
    })
  })

  it('valida volume', () => {
    expect(validarVolumeMl('60').ml).toBe(60)
    expect(validarVolumeMl('').valido).toBe(false)
    expect(validarVolumeMl(900).valido).toBe(false)
  })
})
