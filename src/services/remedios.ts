// src/services/remedios.ts
// Remédios e vitaminas: cadastro e doses dadas (com a família vendo em tempo real).

import type { RecordModel } from 'pocketbase'
import pb from '@/lib/pocketbase/client'
import { getCachedData, setCachedData } from '@/lib/offline/db'
import type { DoseDada, Medicacao, TipoMedicacao } from '@/lib/regras/medicacoes'

export interface MedicacaoRecord extends RecordModel, Medicacao {
  espaco: string
  observacao?: string
  criador: string
  criador_nome?: string
}

export interface DoseRecord extends RecordModel, DoseDada {
  espaco: string
}

function autor() {
  const u = pb.authStore.record
  if (!u) throw new Error('Sessão expirada, entre novamente')
  return { criador: u.id, criador_nome: (u.name as string) || (u.email as string) || 'Família' }
}

function erroAmigavel(err: unknown, padrao: string): Error {
  const e = err as { status?: number; response?: { data?: Record<string, { code?: string }> } }
  const status = e?.status ?? 0
  if (status === 0) return new Error('Sem internet agora. Tente de novo quando a conexão voltar.')
  if (status === 401) return new Error('Sessão expirada, entre novamente')
  if (status === 403 || status === 404) return new Error('Você não tem permissão para esta ação')
  if (status === 400) {
    const dados = e?.response?.data || {}
    if (Object.values(dados).some((v) => v?.code === 'validation_not_unique')) {
      return new Error('Esta dose já foi registrada por alguém da família.')
    }
    return new Error('Confira os dados preenchidos.')
  }
  return new Error(padrao)
}

export async function listarMedicacoes(espacoId: string): Promise<MedicacaoRecord[]> {
  const chave = `medicacoes_${espacoId}`
  try {
    const lista = await pb.collection('medicacoes').getFullList<MedicacaoRecord>({
      filter: pb.filter('espaco = {:e}', { e: espacoId }),
      sort: '-ativo,nome',
    })
    await setCachedData(chave, lista)
    return lista
  } catch {
    return (await getCachedData<MedicacaoRecord[]>(chave)) || []
  }
}

/** Doses dos últimos 3 dias (hoje + o necessário para o intervalo do "se necessário"). */
export async function listarDosesRecentes(espacoId: string): Promise<DoseRecord[]> {
  const chave = `doses_${espacoId}`
  try {
    const lista = await pb.collection('medicacao_doses').getFullList<DoseRecord>({
      filter: pb.filter('espaco = {:e} && dada_em >= {:d}', {
        e: espacoId,
        d: new Date(Date.now() - 3 * 24 * 3600_000).toISOString(),
      }),
      sort: '-dada_em',
    })
    await setCachedData(chave, lista)
    return lista
  } catch {
    return (await getCachedData<DoseRecord[]>(chave)) || []
  }
}

export interface DadosMedicacao {
  nome: string
  dose: string
  tipo: TipoMedicacao
  horarios: string[]
  intervalo_min_horas: number | null
  inicio: string
  fim: string
  observacao: string
  ativo: boolean
}

export async function salvarMedicacao(espacoId: string, dados: Partial<DadosMedicacao>, id?: string) {
  try {
    if (id) return await pb.collection('medicacoes').update<MedicacaoRecord>(id, dados)
    return await pb
      .collection('medicacoes')
      .create<MedicacaoRecord>({ espaco: espacoId, ativo: true, ...autor(), ...dados })
  } catch (err) {
    throw erroAmigavel(err, 'Não foi possível salvar o remédio.')
  }
}

export async function excluirMedicacao(id: string) {
  try {
    await pb.collection('medicacoes').delete(id)
  } catch (err) {
    throw erroAmigavel(err, 'Não foi possível apagar.')
  }
}

export async function registrarDose(
  espacoId: string,
  medicacaoId: string,
  previsto: string,
  status: 'dada' | 'pulada' = 'dada',
): Promise<DoseRecord> {
  try {
    return await pb.collection('medicacao_doses').create<DoseRecord>({
      espaco: espacoId,
      medicacao: medicacaoId,
      previsto,
      dada_em: new Date().toISOString(),
      status,
      ...autor(),
    })
  } catch (err) {
    throw erroAmigavel(err, 'Não foi possível registrar a dose.')
  }
}

export async function desfazerDose(id: string) {
  try {
    await pb.collection('medicacao_doses').delete(id)
  } catch (err) {
    throw erroAmigavel(err, 'Não foi possível desfazer.')
  }
}

/** Avisa quando alguém da família dá uma dose ou muda um remédio. */
export function acompanharRemedios(espacoId: string, aoMudar: () => void): () => void {
  const desligar: (() => void)[] = []
  let ativo = true
  for (const c of ['medicacoes', 'medicacao_doses'] as const) {
    pb.collection(c)
      .subscribe('*', (e) => {
        if ((e.record as { espaco?: string }).espaco === espacoId) aoMudar()
      })
      .then((fn) => {
        if (ativo) desligar.push(fn)
        else fn()
      })
      .catch(() => {
        /* sem tempo real: atualiza ao reabrir */
      })
  }
  return () => {
    ativo = false
    desligar.forEach((fn) => fn())
  }
}
