// src/services/baby.ts
// Serviços para carregar espaço do bebê, membros, eventos e convites

import pb from '@/lib/pocketbase/client'
import {
  enqueueMutation,
  dequeueMutation,
  getPendingMutations,
  setCachedData,
  getCachedData,
} from '@/lib/offline/db'
import { ehFalhaTransitoria, ehRegistroDuplicado, novoIdLocal } from '@/lib/offline/id'
import type { ConteudoMamadeira, CorCoco } from '@/lib/regras/alimentacao'

export type Papel = 'owner' | 'editor' | 'viewer'
export type TipoEvento = 'mamada' | 'mamadeira' | 'ordenha' | 'xixi' | 'coco' | 'peso' | 'nota'

export interface EspacoRecord {
  id: string
  nome: string
  data_nascimento?: string
  hora_nascimento?: string
  peso_nascimento_g?: number
  idade_gestacional_semanas?: number
  intervalo_mamada_minutos?: number
  criador: string
  created: string
  updated: string
}

export interface MembroRecord {
  id: string
  espaco?: string
  espaco_rel?: string
  usuario: string
  papel: 'owner' | 'editor' | 'viewer' | 'admin' | 'membro'
  created: string
  expand?: {
    usuario?: {
      id: string
      name: string
      email: string
      avatar?: string
    }
  }
}

export interface ConviteRecord {
  id: string
  espaco?: string
  espaco_rel?: string
  email?: string
  token: string
  papel?: 'owner' | 'editor' | 'viewer'
  criador: string
  expira_em: string
  usada_em?: string
  created: string
  expand?: {
    criador?: {
      name: string
      email: string
    }
  }
}

import type { RecordModel } from 'pocketbase'

export interface EventoRecord extends RecordModel {
  id: string
  espaco: string
  tipo: TipoEvento
  inicio_em: string // ISO UTC
  fim_em?: string | null // ISO UTC (mamada com cronômetro)
  lado?: 'esquerdo' | 'direito' | 'ambos' | '' | null
  ml?: number | null
  conteudo?: ConteudoMamadeira | '' | null
  coco_cor?: CorCoco | '' | null
  observacao?: string
  criador: string
  criador_nome?: string
  deleted_at?: string | null
  created: string
  updated: string
  _pendingOffline?: boolean
}
export interface AuditoriaRecord {
  id: string
  espaco: string
  acao: string
  usuario: string
  usuario_nome?: string
  detalhe?: string
  created: string
}

/**
 * Busca o bebê do usuário atual (o vínculo mais recente em membros).
 */
export async function obterEspacoAtual(): Promise<EspacoRecord | null> {
  const user = pb.authStore.record
  if (!user) return null

  try {
    const membros = await pb.collection('membros').getFullList<MembroRecord>({
      filter: pb.filter('usuario = {:u} && espaco_rel != ""', { u: user.id }),
      sort: '-created',
    })
    for (const m of membros) {
      try {
        const espaco = await pb.collection('espacos').getOne<EspacoRecord>(m.espaco_rel!)
        await setCachedData('espaco_atual', espaco)
        await setCachedData(`papel_${espaco.id}`, normalizarPapel(m.papel))
        return espaco
      } catch {
        // vínculo órfão: tenta o próximo
      }
    }
    return null
  } catch (err) {
    console.warn('Erro ao obter espaço online, usando cache:', err)
    return await getCachedData<EspacoRecord>('espaco_atual')
  }
}

function normalizarPapel(papel: MembroRecord['papel']): Papel {
  if (papel === 'admin') return 'owner'
  if (papel === 'membro') return 'editor'
  return papel
}

/**
 * Papel do usuário atual no bebê (para esconder ações que o servidor recusaria).
 */
export async function obterMeuPapel(espacoId: string): Promise<Papel> {
  const user = pb.authStore.record
  if (!user) return 'viewer'
  try {
    const m = await pb
      .collection('membros')
      .getFirstListItem<MembroRecord>(
        pb.filter('usuario = {:u} && espaco_rel = {:e}', { u: user.id, e: espacoId }),
      )
    const papel = normalizarPapel(m.papel)
    await setCachedData(`papel_${espacoId}`, papel)
    return papel
  } catch {
    return (await getCachedData<Papel>(`papel_${espacoId}`)) || 'viewer'
  }
}

/**
 * Atualiza dados do bebê
 */
export async function atualizarEspaco(
  id: string,
  dados: Partial<Omit<EspacoRecord, 'id' | 'created' | 'updated'>>,
): Promise<EspacoRecord> {
  const result = await pb.collection('espacos').update<EspacoRecord>(id, dados)
  await setCachedData('espaco_atual', result)
  return result
}

/**
 * Lista membros do espaço
 */
export async function listarMembros(espacoId: string): Promise<MembroRecord[]> {
  try {
    const list = await pb.collection('membros').getFullList<MembroRecord>({
      filter: pb.filter('espaco_rel = {:e}', { e: espacoId }),
      sort: 'created',
      expand: 'usuario',
    })
    await setCachedData(`membros_${espacoId}`, list)
    return list
  } catch (err) {
    const cached = await getCachedData<MembroRecord[]>(`membros_${espacoId}`)
    return cached || []
  }
}

/**
 * Lista convites pendentes
 */
export async function listarConvites(espacoId: string): Promise<ConviteRecord[]> {
  try {
    return await pb.collection('convites').getFullList<ConviteRecord>({
      filter: pb.filter('espaco_rel = {:e} && usada_em = ""', { e: espacoId }),
      sort: '-created',
      expand: 'criador',
    })
  } catch {
    return []
  }
}

/**
 * Cria novo convite (o token e a validade de até 7 dias são definidos pelo servidor)
 */
export async function criarConvite(params: {
  espacoId: string
  email?: string
  papel: Papel
  validadeDias?: number
}): Promise<ConviteRecord> {
  const user = pb.authStore.record
  if (!user) throw new Error('Não autenticado')

  const dias = Math.min(params.validadeDias || 7, 7)
  const record = await pb.collection('convites').create<ConviteRecord>({
    espaco_rel: params.espacoId,
    email: params.email ? params.email.trim().toLowerCase() : '',
    papel: params.papel,
    criador: user.id,
    expira_em: new Date(Date.now() + dias * 24 * 60 * 60 * 1000).toISOString(),
  })

  await registrarAuditoria({
    espacoId: params.espacoId,
    acao: 'convite_criado',
    detalhe: `Convite criado para ${params.email || 'link aberto'} com papel ${params.papel}`,
  })

  return record
}

/**
 * Revoga um convite
 */
export async function revogarConvite(conviteId: string, espacoId: string): Promise<void> {
  await pb.collection('convites').delete(conviteId)
  try {
    await registrarAuditoria({
      espacoId,
      acao: 'convite_revogado',
      detalhe: `Convite ${conviteId} revogado`,
    })
  } catch {
    /* intentionally ignored */
  }
}

/**
 * Remove um membro
 */
export async function removerMembro(
  membroId: string,
  _espacoId?: string,
  _nomeMembro?: string,
): Promise<void> {
  // A auditoria da remoção é registrada pelo servidor (hook em membros).
  await pb.collection('membros').delete(membroId)
}

/**
 * Aceitar convite via rota customizada do backend
 */
export async function aceitarConvite(
  token: string,
): Promise<{ success: boolean; message: string; papel?: string }> {
  try {
    const res = await pb.send<{ success: boolean; message: string; papel?: string }>(
      '/backend/v1/convites/aceitar',
      {
        method: 'POST',
        body: { token },
      },
    )
    return res
  } catch (err: unknown) {
    const anyErr = err as { data?: { message?: string }; message?: string }
    const msg = anyErr?.data?.message || anyErr?.message || 'Falha ao aceitar convite'
    throw new Error(msg)
  }
}

/**
 * Carrega histórico de eventos (mamadas, fraldas) do espaço,
 * incluindo o que foi registrado neste aparelho e ainda não sincronizou.
 */
export async function listarEventos(espacoId: string): Promise<EventoRecord[]> {
  let lista: EventoRecord[]
  try {
    lista = await pb.collection('eventos').getFullList<EventoRecord>({
      filter: pb.filter('espaco = {:e} && deleted_at = ""', { e: espacoId }),
      sort: '-inicio_em',
    })
    await setCachedData(`eventos_${espacoId}`, lista)
  } catch (err) {
    console.warn('Erro ao listar eventos online, usando cache:', err)
    lista = (await getCachedData<EventoRecord[]>(`eventos_${espacoId}`)) || []
  }

  const pendentes = await getPendingMutations()
  const ids = new Set(lista.map((e) => e.id))
  for (const item of pendentes) {
    if (item.collection !== 'eventos' || item.action !== 'create') continue
    const dados = item.data as unknown as EventoRecord
    if (dados.espaco !== espacoId || ids.has(dados.id)) continue
    lista.push({ ...dados, _pendingOffline: true })
  }
  return lista.sort((a, b) => b.inicio_em.localeCompare(a.inicio_em))
}

/**
 * Mantém a cópia local dos registros em dia (para abrir sem internet com o que já se viu).
 * Os pendentes não entram: eles já moram na fila e são somados em listarEventos.
 */
export async function guardarEventosNoAparelho(espacoId: string, eventos: EventoRecord[]) {
  await setCachedData(
    `eventos_${espacoId}`,
    eventos.filter((e) => !e._pendingOffline),
  )
}

function erroAmigavel(err: unknown, padrao: string): Error {
  const status = (err as { status?: number })?.status || 0
  if (status === 401) {
    pb.authStore.clear()
    return new Error('Sessão expirada, entre novamente')
  }
  if (status === 403 || status === 404) {
    return new Error('Você não tem permissão para esta ação')
  }
  return new Error(padrao)
}

/**
 * Cria evento (mamada, xixi, cocô) com id gerado no aparelho.
 * Sem conexão, vai para a fila e sincroniza depois; reenvios nunca duplicam.
 */
export async function criarEvento(params: {
  espacoId: string
  tipo: TipoEvento
  inicio_em: string // ISO UTC
  fim_em?: string | null
  lado?: 'esquerdo' | 'direito' | 'ambos' | '' | null
  ml?: number | null
  conteudo?: ConteudoMamadeira | null
  coco_cor?: CorCoco | null
  observacao?: string
}): Promise<EventoRecord> {
  const user = pb.authStore.record
  if (!user || !pb.authStore.isValid) {
    throw new Error('Sessão expirada, entre novamente')
  }

  const agora = new Date().toISOString()
  const dados = {
    id: novoIdLocal(),
    espaco: params.espacoId,
    tipo: params.tipo,
    inicio_em: params.inicio_em,
    fim_em: params.fim_em || '',
    lado: (params.lado || '') as EventoRecord['lado'],
    ml: params.ml ?? null,
    conteudo: (params.conteudo || '') as EventoRecord['conteudo'],
    coco_cor: (params.coco_cor || '') as EventoRecord['coco_cor'],
    observacao: params.observacao || '',
    criador: user.id,
    criador_nome: (user.name as string) || (user.email as string) || 'Família',
    deleted_at: '',
  }

  const salvarNaFila = async (): Promise<EventoRecord> => {
    await enqueueMutation({
      id: `eventos:${dados.id}:create`,
      recordId: dados.id,
      collection: 'eventos',
      action: 'create',
      data: dados,
      createdAt: Date.now(),
      attempts: 0,
    })
    return {
      ...dados,
      collectionId: '',
      collectionName: 'eventos',
      created: agora,
      updated: agora,
      _pendingOffline: true,
    }
  }

  if (!navigator.onLine) return salvarNaFila()

  try {
    return await pb.collection('eventos').create<EventoRecord>(dados)
  } catch (err: unknown) {
    if (ehFalhaTransitoria(err)) {
      console.warn('Falha na rede ao criar evento, guardando neste aparelho:', err)
      return salvarNaFila()
    }
    throw erroAmigavel(err, 'Não foi possível salvar este registro')
  }
}

async function atualizarEvento(eventoId: string, dados: Record<string, unknown>): Promise<void> {
  const enfileirar = () =>
    enqueueMutation({
      id: `eventos:${eventoId}:update`,
      recordId: eventoId,
      collection: 'eventos',
      action: 'update',
      data: dados,
      createdAt: Date.now(),
      attempts: 0,
    })

  if (!navigator.onLine) return enfileirar()
  try {
    await pb.collection('eventos').update(eventoId, dados)
  } catch (err) {
    if (ehFalhaTransitoria(err)) return enfileirar()
    throw erroAmigavel(err, 'Não foi possível atualizar este registro')
  }
}

/**
 * Exclusão lógica (soft delete): sincroniza a remoção para todos os aparelhos.
 */
export async function marcarEventoExcluido(eventoId: string): Promise<void> {
  await atualizarEvento(eventoId, { deleted_at: new Date().toISOString() })
}

/**
 * Desfazer exclusão lógica
 */
export async function restaurarEvento(eventoId: string): Promise<void> {
  await atualizarEvento(eventoId, { deleted_at: '' })
}

/**
 * Registrar auditoria
 */
export async function registrarAuditoria(params: {
  espacoId: string
  acao: string
  detalhe?: string
}): Promise<void> {
  const user = pb.authStore.record
  if (!user) return
  try {
    await pb.collection('auditoria').create({
      espaco: params.espacoId,
      acao: params.acao,
      usuario: user.id,
      usuario_nome: (user.name as string) || (user.email as string) || '',
      detalhe: params.detalhe || '',
    })
  } catch {
    /* intentionally ignored */
  }
}

/**
 * Listar registros de auditoria
 */
export async function listarAuditoria(espacoId: string): Promise<AuditoriaRecord[]> {
  try {
    const list = await pb.collection('auditoria').getList<AuditoriaRecord>(1, 50, {
      filter: `espaco = "${espacoId}"`,
      sort: '-created',
    })
    return list.items
  } catch {
    return []
  }
}

/**
 * Processador de fila offline — sincroniza quando a conexão é restaurada.
 * Recusa definitiva do servidor (ex.: sem permissão) descarta o item para não travar a fila.
 */
export async function processarFilaOffline(): Promise<{ totalProcessados: number; erros: number }> {
  if (!navigator.onLine) return { totalProcessados: 0, erros: 0 }

  const pendentes = (await getPendingMutations()).sort((a, b) => a.createdAt - b.createdAt)
  let totalProcessados = 0
  let erros = 0

  for (const item of pendentes) {
    const recordId = item.recordId || item.id
    try {
      if (item.action === 'create') {
        try {
          await pb.collection(item.collection).create(item.data)
        } catch (err) {
          if (!ehRegistroDuplicado(err)) throw err // já chegou antes: tudo certo
        }
      } else if (item.action === 'update') {
        await pb.collection(item.collection).update(recordId, item.data)
      } else if (item.action === 'delete') {
        await pb.collection(item.collection).delete(recordId)
      }
      await dequeueMutation(item.id)
      totalProcessados++
    } catch (err) {
      erros++
      if (ehFalhaTransitoria(err)) {
        console.warn(`Sem conexão para sincronizar ${item.id}, tentando depois:`, err)
        break
      }
      console.warn(`Servidor recusou ${item.id}; descartando da fila:`, err)
      await dequeueMutation(item.id)
    }
  }

  return { totalProcessados, erros }
}
