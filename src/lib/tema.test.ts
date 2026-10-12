// src/lib/tema.test.ts
import { describe, expect, it } from 'vitest'
import { ehNoite, resolverTema } from './tema'

// Horário do aparelho (local), como o celular mostra
const as = (h: number, m = 0) => new Date(2026, 9, 12, h, m)

describe('modo noturno', () => {
  it('noite vai das 19h às 7h', () => {
    expect(ehNoite(as(18, 59))).toBe(false)
    expect(ehNoite(as(19))).toBe(true)
    expect(ehNoite(as(3))).toBe(true)
    expect(ehNoite(as(6, 59))).toBe(true)
    expect(ehNoite(as(7))).toBe(false)
  })

  it('escolha fixa vale a qualquer hora', () => {
    expect(resolverTema('claro', as(3))).toBe('claro')
    expect(resolverTema('noturno', as(12))).toBe('noturno')
    expect(resolverTema('escuro', as(3))).toBe('escuro')
  })

  it('automático: noturno à noite, de dia segue o sistema', () => {
    expect(resolverTema('auto', as(2), false)).toBe('noturno')
    expect(resolverTema('auto', as(14), false)).toBe('claro')
    expect(resolverTema('auto', as(14), true)).toBe('escuro')
  })
})
