// src/lib/tema.ts
// Aparência do app: claro, escuro, noturno (luz âmbar fraca para as mamadas de madrugada)
// ou automático. A escolha fica neste aparelho (localStorage).

export type Tema = 'claro' | 'escuro' | 'noturno' | 'auto'

/** No automático, o modo noturno liga sozinho neste intervalo (horário do aparelho). */
export const NOITE_INICIO_HORA = 19
export const NOITE_FIM_HORA = 7

const CHAVE = 'diario_tema'
const CHAVE_ANTERIOR = 'diario_tema_antes_noturno'

const COR_BARRA: Record<'claro' | 'escuro' | 'noturno', string> = {
  claro: '#de287b',
  escuro: '#0f1a1c',
  noturno: '#0d0705',
}

export function ehNoite(agora: Date = new Date()): boolean {
  const h = agora.getHours()
  return h >= NOITE_INICIO_HORA || h < NOITE_FIM_HORA
}

/** Aparência efetiva para uma escolha. No automático: noturno à noite, senão segue o sistema. */
export function resolverTema(
  tema: Tema,
  agora: Date = new Date(),
  sistemaEscuro = false,
): 'claro' | 'escuro' | 'noturno' {
  if (tema !== 'auto') return tema
  if (ehNoite(agora)) return 'noturno'
  return sistemaEscuro ? 'escuro' : 'claro'
}

function sistemaEscuro(): boolean {
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  } catch {
    return false
  }
}

export function lerTema(): Tema {
  try {
    const v = localStorage.getItem(CHAVE)
    if (v === 'claro' || v === 'escuro' || v === 'noturno' || v === 'auto') return v
  } catch {
    /* sem armazenamento */
  }
  return 'auto'
}

const ouvintes = new Set<(t: Tema) => void>()

export function ouvirTema(fn: (t: Tema) => void): () => void {
  ouvintes.add(fn)
  return () => ouvintes.delete(fn)
}

/** Aplica a aparência no documento (classes no <html> e cor da barra do celular). */
export function aplicarAparencia(tema: Tema = lerTema()) {
  const efetivo = resolverTema(tema, new Date(), sistemaEscuro())
  const root = document.documentElement
  root.classList.toggle('dark', efetivo !== 'claro')
  root.classList.toggle('noturno', efetivo === 'noturno')
  root.style.colorScheme = efetivo === 'claro' ? 'light' : 'dark'
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', COR_BARRA[efetivo])
  ouvintes.forEach((fn) => fn(tema))
}

export function salvarTema(tema: Tema) {
  try {
    localStorage.setItem(CHAVE, tema)
  } catch {
    /* vale só até fechar o app */
  }
  aplicarAparencia(tema)
}

export function noturnoAtivo(): boolean {
  return document.documentElement.classList.contains('noturno')
}

/** Botão rápido da lua: liga o noturno ou volta para a escolha anterior. */
export function alternarNoturno() {
  if (noturnoAtivo()) {
    let anterior: Tema = 'claro'
    try {
      const v = localStorage.getItem(CHAVE_ANTERIOR) as Tema | null
      if (v && v !== 'noturno') anterior = v
    } catch {
      /* usa claro */
    }
    // Se o anterior era automático e ainda é noite, ele religaria o noturno: vai para claro.
    if (resolverTema(anterior, new Date(), sistemaEscuro()) === 'noturno') anterior = 'claro'
    salvarTema(anterior)
  } else {
    try {
      localStorage.setItem(CHAVE_ANTERIOR, lerTema())
    } catch {
      /* ignora */
    }
    salvarTema('noturno')
  }
}

/** Liga a aparência na abertura do app e acompanha o relógio e o sistema no automático. */
export function iniciarTema() {
  aplicarAparencia()
  try {
    window
      .matchMedia('(prefers-color-scheme: dark)')
      .addEventListener('change', () => lerTema() === 'auto' && aplicarAparencia())
  } catch {
    /* navegador antigo */
  }
  setInterval(() => {
    if (lerTema() === 'auto') aplicarAparencia()
  }, 60_000)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') aplicarAparencia()
  })
}
