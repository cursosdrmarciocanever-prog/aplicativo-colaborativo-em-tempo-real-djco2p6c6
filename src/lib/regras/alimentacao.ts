// src/lib/regras/alimentacao.ts
// Regras puras de mamadeira, ordenha, duração de mamada e cor do cocô.

export type ConteudoMamadeira = 'leite_materno' | 'formula'

export type CorCoco = 'meconio' | 'verde' | 'amarelo' | 'marrom' | 'clara' | 'sangue'

export const CORES_COCO: { valor: CorCoco; rotulo: string; amostra: string }[] = [
  { valor: 'meconio', rotulo: 'Preto (mecônio)', amostra: '#2b2a1f' },
  { valor: 'verde', rotulo: 'Verde', amostra: '#5f7a2e' },
  { valor: 'amarelo', rotulo: 'Amarelo', amostra: '#d9a521' },
  { valor: 'marrom', rotulo: 'Marrom', amostra: '#8a5a2b' },
  { valor: 'clara', rotulo: 'Clara / branca / cinza', amostra: '#e8e3d3' },
  { valor: 'sangue', rotulo: 'Com sangue', amostra: '#b3261e' },
]

export interface AvaliacaoCorCoco {
  nivel: 'ok' | 'atencao'
  mensagem: string | null
}

/**
 * Orientação informativa sobre a cor do cocô (referência: cartela de cor das fezes da
 * Caderneta da Criança). Nunca é diagnóstico: só sugere conversar com a pediatra.
 */
export function avaliarCorCoco(
  cor: CorCoco | '' | null | undefined,
  diaDeVida: number,
): AvaliacaoCorCoco {
  if (cor === 'clara') {
    return {
      nivel: 'atencao',
      mensagem:
        'Cocô claro, esbranquiçado ou cinza merece atenção: avise a pediatra hoje e leve a cartela de cores da Caderneta da Criança.',
    }
  }
  if (cor === 'sangue') {
    return {
      nivel: 'atencao',
      mensagem:
        'Sinais de sangue no cocô: converse com a pediatra. Se possível, guarde uma foto da fralda.',
    }
  }
  if (cor === 'meconio' && diaDeVida > 4) {
    return {
      nivel: 'atencao',
      mensagem: 'Cocô escuro como mecônio depois do 4º dia de vida: vale comentar com a pediatra.',
    }
  }
  return { nivel: 'ok', mensagem: null }
}

/** Duração entre início e fim, em texto curto ("15 min", "1h 05min"). */
export function formatarDuracao(
  inicioIso: string,
  fimIso: string | null | undefined,
): string | null {
  if (!fimIso) return null
  const min = Math.round((new Date(fimIso).getTime() - new Date(inicioIso).getTime()) / 60000)
  if (!Number.isFinite(min) || min <= 0) return null
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h === 0) return `${m} min`
  return `${h}h ${String(m).padStart(2, '0')}min`
}

/** Cronômetro em andamento ("12:05" ou "1:02:03"). */
export function formatarCronometro(segundosTotais: number): string {
  const s = Math.max(0, Math.floor(segundosTotais))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const seg = s % 60
  const mm = String(m).padStart(2, '0')
  const ss = String(seg).padStart(2, '0')
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}

export interface RegistroVolume {
  tipo: string
  ml?: number | null
  conteudo?: ConteudoMamadeira | '' | null
}

export interface TotaisVolume {
  mamadeiras: number
  mlMamadeira: number
  mlFormula: number
  mlLeiteMaterno: number
  ordenhas: number
  mlOrdenha: number
}

/** Soma mamadeiras e ordenhas de uma lista de registros (normalmente de um dia). */
export function totalizarVolumes(registros: RegistroVolume[]): TotaisVolume {
  const t: TotaisVolume = {
    mamadeiras: 0,
    mlMamadeira: 0,
    mlFormula: 0,
    mlLeiteMaterno: 0,
    ordenhas: 0,
    mlOrdenha: 0,
  }
  for (const r of registros) {
    const ml = r.ml && r.ml > 0 ? r.ml : 0
    if (r.tipo === 'mamadeira') {
      t.mamadeiras++
      t.mlMamadeira += ml
      if (r.conteudo === 'formula') t.mlFormula += ml
      else t.mlLeiteMaterno += ml
    } else if (r.tipo === 'ordenha') {
      t.ordenhas++
      t.mlOrdenha += ml
    }
  }
  return t
}

/** Volume válido para registrar (1 a 500 mL). */
export function validarVolumeMl(valor: string | number): {
  valido: boolean
  ml?: number
  erro?: string
} {
  const ml = typeof valor === 'number' ? valor : parseInt(String(valor).replace(/\D/g, ''), 10)
  if (!ml || ml < 1) return { valido: false, erro: 'Informe a quantidade em mL.' }
  if (ml > 500) return { valido: false, erro: 'Confira a quantidade: mais de 500 mL de uma vez.' }
  return { valido: true, ml }
}
