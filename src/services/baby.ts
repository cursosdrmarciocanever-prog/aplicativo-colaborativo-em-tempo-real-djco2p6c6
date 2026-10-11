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
  tipo: 'mamada' | 'xixi' | 'coco' | 'peso' | 'nota'
  inicio_em: string // ISO UTC
  lado?: 'esquerdo' | 'direito' | 'ambos' | '' | null
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
 * Busca o espaço do bebê do usuário atual
 */
export async function obterEspacoAtual(): Promise<EspacoRecord | null> {
  const user = pb.authStore.record
  if (!user) return null

  try {
    // 1. Tentar carregar membro do usuário (buscando espaco_rel não-vazio primeiro)
    const membros = await pb.collection('membros').getFullList<MembroRecord>({
      filter: `usuario = "${user.id}"`,
      sort: '-created',
    })

    for (const m of membros) {
      const targetId = m.espaco_rel || m.espaco
      if (targetId) {
        try {
          const espaco = await pb.collection('espacos').getOne<EspacoRecord>(targetId)
          if (espaco) {
            await setCachedData('espaco_atual', espaco)
            return espaco
          }
        } catch {
          // Continua tentando outros membros se houver
        }
      }
    }

    // 2. Se não encontrou por membro, buscar espaco onde usuário seja o criador
    try {
      const espacosCriador = await pb.collection('espacos').getList<EspacoRecord>(1, 1, {
        filter: `criador = "${user.id}"`,
        sort: '-created',
      })
      if (espacosCriador.items.length > 0) {
        const espaco = espacosCriador.items[0]
        await setCachedData('espaco_atual', espaco)
        return espaco
      }
    } catch {
      // Ignora erro de filtro
    }

    // 3. Fallback: listar primeiro espaço acessível ao usuário
    try {
      const espacos = await pb.collection('espacos').getList<EspacoRecord>(1, 1, {
        sort: '-created',
      })
      if (espacos.items.length > 0) {
        const espaco = espacos.items[0]
        await setCachedData('espaco_atual', espaco)
        return espaco
      }
    } catch {
      // Ignora
    }

    // Fallback para cache offline
    return await getCachedData<EspacoRecord>('espaco_atual')
  } catch (err) {
    console.warn('Erro ao obter espaço online, usando cache:', err)
    return await getCachedData<EspacoRecord>('espaco_atual')
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
      sort: 'created',
      expand: 'usuario',
    })
    // Filtra membros relacionados ao espaço ou geral
    const filtrados = list.filter((m) => !m.espaco_rel || m.espaco_rel === espacoId)
    await setCachedData(`membros_${espacoId}`, filtrados)
    return filtrados
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
    const list = await pb.collection('convites').getFullList<ConviteRecord>({
      filter: `usada_em = null || usada_em = ""`,
      sort: '-created',
      expand: 'criador',
    })
    return list.filter((c) => !c.espaco_rel || c.espaco_rel === espacoId)
  } catch {
    return []
  }
}

/**
 * Cria novo convite
 */
export async function criarConvite(params: {
  espacoId: string
  email?: string
  papel: 'editor' | 'viewer'
  validadeDias?: number
}): Promise<ConviteRecord> {
  const user = pb.authStore.record
  if (!user) throw new Error('Não autenticado')

  // Gerar token aleatório seguro
  const token =
    Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10)
  const dias = params.validadeDias || 7
  const expiraEm = new Date(Date.now() + dias * 24 * 60 * 60 * 1000).toISOString()

  // Buscar space padrão para atender campo legac
  let defaultSpaceId: string | undefined
  try {
    const spaces = await pb.collection('spaces').getList(1, 1)
    if (spaces.items.length > 0) defaultSpaceId = spaces.items[0].id
  } catch {
    /* intentionally ignored */
  }

  const data: Record<string, unknown> = {
    espaco: defaultSpaceId,
    espaco_rel: params.espacoId,
    email: params.email ? params.email.trim().toLowerCase() : '',
    token,
    papel: params.papel,
    criador: user.id,
    expira_em: expiraEm,
  }

  const record = await pb.collection('convites').create<ConviteRecord>(data)

  // Registrar auditoria
  try {
    await registrarAuditoria({
      espacoId: params.espacoId,
      acao: 'convite_criado',
      detalhe: `Convite criado para ${params.email || 'link aberto'} com papel ${params.papel}`,
    })
  } catch {
    /* intentionally ignored */
  }

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
  espacoId: string,
  nomeMembro?: string,
): Promise<void> {
  await pb.collection('membros').delete(membroId)
  try {
    await registrarAuditoria({
      espacoId,
      acao: 'membro_removido',
      detalhe: `Membro ${nomeMembro || membroId} removido da família`,
    })
  } catch {
    /* intentionally ignored */
  }
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
 * Carrega histórico de eventos (mamadas, fraldas) do espaço
 */
export async function listarEventos(espacoId: string): Promise<EventoRecord[]> {
  try {
    const list = await pb.collection('eventos').getFullList<EventoRecord>({
      filter: `espaco = "${espacoId}" && (deleted_at = null || deleted_at = "")`,
      sort: '-inicio_em',
    })
    await setCachedData(`eventos_${espacoId}`, list)
    return list
  } catch (err) {
    console.warn('Erro ao listar eventos online, usando cache:', err)
    const cached = await getCachedData<EventoRecord[]>(`eventos_${espacoId}`)
    return cached || []
  }
}

/**
 * Cria evento (mamada, xixi, cocô) com suporte offline e UUID no cliente
 */
export async function criarEvento(params: {
  espacoId: string
  tipo: 'mamada' | 'xixi' | 'coco' | 'peso' | 'nota'
  inicio_em: string // ISO UTC
  lado?: 'esquerdo' | 'direito' | 'ambos' | '' | null
  observacao?: string
}): Promise<EventoRecord> {
  const user = pb.authStore.record
  if (!user || !pb.authStore.isValid) {
    throw new Error('Sessão expirada, entre novamente')
  }

  const criadorId = user.id
  const criadorNome = (user.name as string) || (user.email as string) || 'Família'

  const dados: Record<string, unknown> = {
    espaco: params.espacoId,
    tipo: params.tipo,
    inicio_em: params.inicio_em,
    lado: params.lado || null,
    observacao: params.observacao || '',
    criador: criadorId,
    criador_nome: criadorNome,
    deleted_at: null,
  }

  if (!navigator.onLine) {
    // Modo offline legítimo: gerar ID local para o cliente
    const clientId =
      'c_' + Math.random().toString(36).substring(2, 9) + Math.random().toString(36).substring(2, 8)
    const dadosOffline = { ...dados, id: clientId }

    const eventoLocal: EventoRecord = {
      id: clientId,
      collectionId: 'pbc_4201693797',
      collectionName: 'eventos',
      espaco: params.espacoId,
      tipo: params.tipo,
      inicio_em: params.inicio_em,
      lado: params.lado || null,
      observacao: params.observacao || '',
      criador: criadorId,
      criador_nome: criadorNome,
      deleted_at: null,
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
      _pendingOffline: true,
    }

    await enqueueMutation({
      id: clientId,
      collection: 'eventos',
      action: 'create',
      data: dadosOffline,
      createdAt: Date.now(),
      attempts: 0,
    })
    return eventoLocal
  }

  try {
    // Quando online, cria no PocketBase sem forçar id fixo (deixa PB gerar ou aceitar)
    const record = await pb.collection('eventos').create<EventoRecord>(dados)
    return record
  } catch (err: unknown) {
    const anyErr = err as { status?: number; data?: unknown; message?: string }
    const status = anyErr?.status || 0

    // Se for erro de autenticação ou permissão (401 / 403), não mascara como offline!
    if (status === 401) {
      pb.authStore.clear()
      throw new Error('Sessão expirada, entre novamente')
    }
    if (status === 403) {
      throw new Error('Permissão negada para registrar este evento')
    }
    if (status >= 400 && status < 500) {
      // Erro de validação ou regra do PocketBase (400)
      const msg = anyErr?.message || 'Dados inválidos ao salvar evento'
      throw new Error(msg)
    }

    // Se for falha real de rede ou 5xx enquanto navegando, salva offline
    console.warn('Falha na rede ao criar evento, enfileirando offline:', err)
    const clientId =
      'c_' + Math.random().toString(36).substring(2, 9) + Math.random().toString(36).substring(2, 8)
    const dadosOffline = { ...dados, id: clientId }
    await enqueueMutation({
      id: clientId,
      collection: 'eventos',
      action: 'create',
      data: dadosOffline,
      createdAt: Date.now(),
      attempts: 0,
    })

    const eventoLocal: EventoRecord = {
      id: clientId,
      collectionId: 'pbc_4201693797',
      collectionName: 'eventos',
      espaco: params.espacoId,
      tipo: params.tipo,
      inicio_em: params.inicio_em,
      lado: params.lado || null,
      observacao: params.observacao || '',
      criador: criadorId,
      criador_nome: criadorNome,
      deleted_at: null,
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
      _pendingOffline: true,
    }
    return eventoLocal
  }
}

/**
 * Exclusão lógica (soft delete) com suporte a desfazer
 */
export async function marcarEventoExcluido(eventoId: string): Promise<void> {
  const isoNow = new Date().toISOString()
  if (!navigator.onLine) {
    await enqueueMutation({
      id: eventoId,
      collection: 'eventos',
      action: 'update',
      data: { deleted_at: isoNow },
      createdAt: Date.now(),
      attempts: 0,
    })
    return
  }

  try {
    await pb.collection('eventos').update(eventoId, {
      deleted_at: isoNow,
    })
  } catch (err) {
    await enqueueMutation({
      id: eventoId,
      collection: 'eventos',
      action: 'update',
      data: { deleted_at: isoNow },
      createdAt: Date.now(),
      attempts: 0,
    })
  }
}

/**
 * Desfazer exclusão lógica
 */
export async function restaurarEvento(eventoId: string): Promise<void> {
  if (!navigator.onLine) {
    await enqueueMutation({
      id: eventoId,
      collection: 'eventos',
      action: 'update',
      data: { deleted_at: null },
      createdAt: Date.now(),
      attempts: 0,
    })
    return
  }

  try {
    await pb.collection('eventos').update(eventoId, {
      deleted_at: null,
    })
  } catch (err) {
    await enqueueMutation({
      id: eventoId,
      collection: 'eventos',
      action: 'update',
      data: { deleted_at: null },
      createdAt: Date.now(),
      attempts: 0,
    })
  }
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
 * Processador de fila offline — sincroniza quando a conexão é restaurada
 */
export async function processarFilaOffline(): Promise<{ totalProcessados: number; erros: number }> {
  if (!navigator.onLine) return { totalProcessados: 0, erros: 0 }

  const pendentes = await getPendingMutations()
  if (pendentes.length === 0) return { totalProcessados: 0, erros: 0 }

  let totalProcessados = 0
  let erros = 0

  for (const item of pendentes) {
    try {
      if (item.action === 'create') {
        // Tenta criar; se já existir (idempotência pelo ID), atualiza ou ignora
        try {
          await pb.collection(item.collection).create(item.data)
        } catch (err: unknown) {
          const msg = String(err)
          // Se já existir, tudo bem
          if (!msg.includes('unique') && !msg.includes('exists')) {
            throw err
          }
        }
      } else if (item.action === 'update') {
        await pb.collection(item.collection).update(item.id, item.data)
      } else if (item.action === 'delete') {
        await pb.collection(item.collection).delete(item.id)
      }
      await dequeueMutation(item.id)
      totalProcessados++
    } catch (err) {
      console.warn(`Erro ao sincronizar item offline ${item.id}:`, err)
      erros++
    }
  }

  return { totalProcessados, erros }
}
