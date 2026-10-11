// src/lib/regras/fraldas.ts
// Regras de negócio puras para fraldas e metas por dia de vida

export interface MetaFraldaDia {
  diaVida: number
  minimoXixi: number
  cocoEsperado: string
  mensagemPadrao: string
}

/**
 * Tabela exata de fraldas por dia de vida
 * Dia 1: 1 xixi / mecônio
 * Dia 2: 2 xixi / mecônio
 * Dia 3: 3 xixi / em transição
 * Dia 4: 4 xixi / amareladas
 * Dia 5+: 6 ou mais xixi / amareladas 3+
 */
export function getMetaFraldasPorDia(diaDeVida: number): MetaFraldaDia {
  const d = Math.max(1, diaDeVida)

  if (d === 1) {
    return {
      diaVida: 1,
      minimoXixi: 1,
      cocoEsperado: 'mecônio (escuro e pegajoso)',
      mensagemPadrao: 'Dia 1 de vida: esperado pelo menos 1 xixi e fezes de mecônio nas 24 h.',
    }
  }
  if (d === 2) {
    return {
      diaVida: 2,
      minimoXixi: 2,
      cocoEsperado: 'mecônio ou transição',
      mensagemPadrao: 'Dia 2 de vida: esperado pelo menos 2 xixis nas 24 h.',
    }
  }
  if (d === 3) {
    return {
      diaVida: 3,
      minimoXixi: 3,
      cocoEsperado: 'fezes em transição (esverdeadas)',
      mensagemPadrao: 'Dia 3 de vida: esperado pelo menos 3 xixis nas 24 h.',
    }
  }
  if (d === 4) {
    return {
      diaVida: 4,
      minimoXixi: 4,
      cocoEsperado: 'fezes amareladas',
      mensagemPadrao: 'Dia 4 de vida: esperado pelo menos 4 xixis nas 24 h.',
    }
  }

  // Dia 5+
  return {
    diaVida: d,
    minimoXixi: 6,
    cocoEsperado: 'fezes amareladas, 3 ou mais por dia',
    mensagemPadrao: `Dia ${d} de vida: esperado pelo menos 6 xixis nas 24 h.`,
  }
}

export interface StatusMetaFraldas {
  totalXixiHoje: number
  totalCocoHoje: number
  metaXixi: number
  atingiuMetaXixi: boolean
  faltamXixi: number
  mensagemStatus: string
  metaDetalhe: MetaFraldaDia
}

/**
 * Avalia o status da meta de xixi para o dia de vida
 */
export function avaliarMetaFraldas(
  diaDeVida: number,
  totalXixi: number,
  totalCoco: number,
): StatusMetaFraldas {
  const meta = getMetaFraldasPorDia(diaDeVida)
  const atingiu = totalXixi >= meta.minimoXixi
  const faltam = Math.max(0, meta.minimoXixi - totalXixi)

  let mensagemStatus = ''
  if (atingiu) {
    mensagemStatus = 'Meta de hoje atingida.'
  } else {
    mensagemStatus = `Faltam ${faltam} para a meta de hoje.`
  }

  return {
    totalXixiHoje: totalXixi,
    totalCocoHoje: totalCoco,
    metaXixi: meta.minimoXixi,
    atingiuMetaXixi: atingiu,
    faltamXixi: faltam,
    mensagemStatus,
    metaDetalhe: meta,
  }
}

/**
 * Texto informativo fixo sobre perda de peso e fraldas
 */
export const AVISO_INFORMATIVO_PESO_FRALDAS =
  'A perda de peso de até 7 a 10% até o 3º ao 5º dia é esperada; o peso de nascimento costuma ser recuperado em 10 a 14 dias. Avise a pediatra se houver sonolência que impeça acordar para mamar, urina alaranjada, icterícia subindo ou menos fraldas que o esperado.'
