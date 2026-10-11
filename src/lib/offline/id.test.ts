import { describe, expect, it } from 'vitest'
import { ehFalhaTransitoria, ehRegistroDuplicado, novoIdLocal } from './id'

describe('ids gerados no aparelho', () => {
  it('têm o formato do PocketBase e não se repetem', () => {
    const ids = new Set(Array.from({ length: 2000 }, novoIdLocal))
    expect(ids.size).toBe(2000)
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]{15}$/)
  })

  it('reconhece reenvio duplicado', () => {
    const dup = { status: 400, response: { data: { id: { code: 'validation_not_unique' } } } }
    expect(ehRegistroDuplicado(dup)).toBe(true)
    expect(ehRegistroDuplicado({ status: 400, response: { data: {} } })).toBe(false)
  })

  it('separa falha de rede de recusa definitiva', () => {
    expect(ehFalhaTransitoria({ status: 0 })).toBe(true)
    expect(ehFalhaTransitoria({ status: 503 })).toBe(true)
    expect(ehFalhaTransitoria({ status: 403 })).toBe(false)
  })
})
