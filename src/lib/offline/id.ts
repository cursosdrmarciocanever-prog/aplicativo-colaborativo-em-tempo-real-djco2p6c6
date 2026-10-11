// src/lib/offline/id.ts
// IDs gerados no aparelho, no formato aceito pelo PocketBase (15 caracteres [a-z0-9]).
// O mesmo id vai em todo reenvio: o servidor recusa o segundo e nada duplica.

const ALFABETO = 'abcdefghijklmnopqrstuvwxyz0123456789'

export function novoIdLocal(): string {
  const bytes = new Uint8Array(15)
  crypto.getRandomValues(bytes)
  let id = ''
  for (const b of bytes) id += ALFABETO[b % ALFABETO.length]
  return id
}

/** O servidor já tem um registro com este id (reenvio de algo que já chegou). */
export function ehRegistroDuplicado(err: unknown): boolean {
  const e = err as { status?: number; response?: { data?: { id?: { code?: string } } } }
  return e?.status === 400 && e?.response?.data?.id?.code === 'validation_not_unique'
}

/** Falha de rede ou do servidor (vale tentar de novo depois), não recusa definitiva. */
export function ehFalhaTransitoria(err: unknown): boolean {
  const status = (err as { status?: number })?.status ?? 0
  return status === 0 || status >= 500 || status === 429
}
