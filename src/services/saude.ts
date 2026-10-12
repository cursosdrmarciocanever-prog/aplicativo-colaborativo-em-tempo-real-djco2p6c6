// src/services/saude.ts
// Vacinas aplicadas, consultas (com medidas) e dúvidas para a pediatra.
// Leitura com cópia no aparelho (abre sem internet); escrita precisa de conexão.

import type { RecordModel } from 'pocketbase'
import pb from '@/lib/pocketbase/client'
import { getCachedData, setCachedData } from '@/lib/offline/db'

export interface VacinaRecord extends RecordModel {
  espaco: string
  dose_id: string
  nome?: string
  aplicada_em: string // AAAA-MM-DD
  lote?: string
  local?: string
  observacao?: string
  criador: string
  criador_nome?: string
}

export type TipoConsulta = 'rotina' | 'retorno' | 'urgencia' | 'especialista'

export interface ConsultaRecord extends RecordModel {
  espaco: string
  data: string // AAAA-MM-DD
  tipo: TipoConsulta
  profissional?: string
  peso_g?: number | null
  comprimento_cm?: number | null
  perimetro_cefalico_cm?: number | null
  orientacoes?: string
  proxima_consulta?: string
  criador: string
  criador_nome?: string
}

export interface DuvidaRecord extends RecordModel {
  espaco: string
  texto: string
  resposta?: string
  respondida_em?: string
  criador: string
  criador_nome?: string
}

type Colecao = 'vacinas' | 'consultas' | 'duvidas'

const ORDEM: Record<Colecao, string> = {
  vacinas: 'aplicada_em',
  consultas: '-data',
  duvidas: '-created',
}

async function listar<T extends RecordModel>(colecao: Colecao, espacoId: string): Promise<T[]> {
  const chave = `${colecao}_${espacoId}`
  try {
    const lista = await pb.collection(colecao).getFullList<T>({
      filter: pb.filter('espaco = {:e}', { e: espacoId }),
      sort: ORDEM[colecao],
    })
    await setCachedData(chave, lista)
    return lista
  } catch (err) {
    console.warn(`Erro ao listar ${colecao} online, usando cache:`, err)
    return (await getCachedData<T[]>(chave)) || []
  }
}

function erroAmigavel(err: unknown): Error {
  const e = err as { status?: number; response?: { data?: Record<string, { code?: string }> } }
  const status = e?.status ?? 0
  if (status === 0) return new Error('Sem internet agora. Tente de novo quando a conexão voltar.')
  if (status === 401) return new Error('Sessão expirada, entre novamente')
  if (status === 403 || status === 404) return new Error('Você não tem permissão para esta ação')
  if (e?.response?.data?.dose_id?.code === 'validation_not_unique' || status === 400) {
    const dados = e?.response?.data || {}
    if (Object.values(dados).some((v) => v?.code === 'validation_not_unique')) {
      return new Error('Esta dose já está registrada.')
    }
    return new Error('Confira os dados preenchidos.')
  }
  return new Error('Não foi possível salvar agora. Tente de novo.')
}

function autor() {
  const u = pb.authStore.record
  if (!u) throw new Error('Sessão expirada, entre novamente')
  return { criador: u.id, criador_nome: (u.name as string) || (u.email as string) || 'Família' }
}

export const listarVacinas = (espacoId: string) => listar<VacinaRecord>('vacinas', espacoId)
export const listarConsultas = (espacoId: string) => listar<ConsultaRecord>('consultas', espacoId)
export const listarDuvidas = (espacoId: string) => listar<DuvidaRecord>('duvidas', espacoId)

export async function registrarVacina(
  espacoId: string,
  dados: Pick<VacinaRecord, 'dose_id' | 'aplicada_em'> &
    Partial<Pick<VacinaRecord, 'nome' | 'lote' | 'local' | 'observacao'>>,
): Promise<VacinaRecord> {
  try {
    return await pb.collection('vacinas').create<VacinaRecord>({ espaco: espacoId, ...autor(), ...dados })
  } catch (err) {
    throw erroAmigavel(err)
  }
}

export type DadosConsulta = Omit<
  ConsultaRecord,
  keyof RecordModel | 'espaco' | 'criador' | 'criador_nome'
>

export async function salvarConsulta(
  espacoId: string,
  dados: DadosConsulta,
  id?: string,
): Promise<ConsultaRecord> {
  try {
    if (id) return await pb.collection('consultas').update<ConsultaRecord>(id, dados)
    return await pb
      .collection('consultas')
      .create<ConsultaRecord>({ espaco: espacoId, ...autor(), ...dados })
  } catch (err) {
    throw erroAmigavel(err)
  }
}

export async function criarDuvida(espacoId: string, texto: string): Promise<DuvidaRecord> {
  try {
    return await pb
      .collection('duvidas')
      .create<DuvidaRecord>({ espaco: espacoId, ...autor(), texto: texto.trim() })
  } catch (err) {
    throw erroAmigavel(err)
  }
}

export async function responderDuvida(id: string, resposta: string): Promise<DuvidaRecord> {
  try {
    return await pb.collection('duvidas').update<DuvidaRecord>(id, {
      resposta: resposta.trim(),
      respondida_em: resposta.trim() ? new Date().toISOString() : '',
    })
  } catch (err) {
    throw erroAmigavel(err)
  }
}

export async function excluir(colecao: Colecao, id: string): Promise<void> {
  try {
    await pb.collection(colecao).delete(id)
  } catch (err) {
    throw erroAmigavel(err)
  }
}

/** Avisa quando alguém da família muda algo na saúde do bebê. Devolve a função de desligar. */
export function acompanharSaude(espacoId: string, aoMudar: () => void): () => void {
  const desligar: (() => void)[] = []
  let ativo = true
  for (const c of ['vacinas', 'consultas', 'duvidas'] as const) {
    pb.collection(c)
      .subscribe('*', (e) => {
        if ((e.record as { espaco?: string }).espaco === espacoId) aoMudar()
      })
      .then((fn) => {
        if (ativo) desligar.push(fn)
        else fn()
      })
      .catch(() => {
        /* sem tempo real: a lista atualiza ao reabrir */
      })
  }
  return () => {
    ativo = false
    desligar.forEach((fn) => fn())
  }
}
