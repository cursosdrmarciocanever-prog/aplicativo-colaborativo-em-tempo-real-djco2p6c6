// src/components/hoje/CronometroMamada.tsx
// Cronômetro de mamada: começa, mostra o tempo correndo e salva início, fim e lado.
// O estado fica neste aparelho (localStorage), então sobrevive a recarregar a página.

import { useEffect, useState } from 'react'
import { Play, Square, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatarCronometro } from '@/lib/regras/alimentacao'

type Lado = 'esquerdo' | 'direito' | 'ambos' | ''

interface EstadoCronometro {
  inicio: string // ISO UTC
  lado: Lado
}

const chave = (espacoId: string) => `cronometro_mamada_${espacoId}`

function ler(espacoId: string): EstadoCronometro | null {
  try {
    const bruto = localStorage.getItem(chave(espacoId))
    return bruto ? (JSON.parse(bruto) as EstadoCronometro) : null
  } catch {
    return null
  }
}

function gravar(espacoId: string, estado: EstadoCronometro | null) {
  try {
    if (estado) localStorage.setItem(chave(espacoId), JSON.stringify(estado))
    else localStorage.removeItem(chave(espacoId))
  } catch {
    /* sem armazenamento: o cronômetro vale só enquanto a tela estiver aberta */
  }
}

interface Props {
  espacoId: string
  ladoInicial: Lado
  salvando: boolean
  onTerminar: (dados: { inicio: string; fim: string; lado: Lado }) => Promise<boolean>
}

export default function CronometroMamada({ espacoId, ladoInicial, salvando, onTerminar }: Props) {
  const [estado, setEstado] = useState<EstadoCronometro | null>(() => ler(espacoId))
  const [agora, setAgora] = useState(() => Date.now())

  useEffect(() => {
    if (!estado) return
    const t = setInterval(() => setAgora(Date.now()), 1000)
    return () => clearInterval(t)
  }, [estado])

  const atualizar = (novo: EstadoCronometro | null) => {
    setEstado(novo)
    gravar(espacoId, novo)
  }

  if (!estado) {
    return (
      <Button
        type="button"
        variant="outline"
        onClick={() => {
          setAgora(Date.now())
          atualizar({ inicio: new Date().toISOString(), lado: ladoInicial })
        }}
        className="w-full h-12 rounded-2xl text-sm font-bold flex items-center justify-center gap-2"
      >
        <Play className="w-4 h-4" />
        Começar mamada com cronômetro
      </Button>
    )
  }

  const segundos = (agora - new Date(estado.inicio).getTime()) / 1000

  return (
    <div className="rounded-2xl border border-primary/40 bg-primary/5 p-4 space-y-3" role="timer">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wider text-primary">
          Mamando agora
        </span>
        <span className="text-3xl font-black tabular-nums text-foreground" aria-live="off">
          {formatarCronometro(segundos)}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2" aria-label="Lado">
        {(['esquerdo', 'direito', 'ambos'] as const).map((lado) => (
          <button
            key={lado}
            type="button"
            aria-pressed={estado.lado === lado}
            onClick={() => atualizar({ ...estado, lado: estado.lado === lado ? '' : lado })}
            className={`h-10 rounded-xl text-xs font-bold border capitalize ${
              estado.lado === lado
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background border-border text-foreground'
            }`}
          >
            {lado}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-[1fr_auto] gap-2">
        <Button
          type="button"
          disabled={salvando}
          onClick={async () => {
            const ok = await onTerminar({
              inicio: estado.inicio,
              fim: new Date().toISOString(),
              lado: estado.lado,
            })
            if (ok) atualizar(null)
          }}
          className="h-12 rounded-xl font-bold flex items-center justify-center gap-2"
        >
          <Square className="w-4 h-4 fill-current" />
          {salvando ? 'Salvando...' : 'Terminar e salvar'}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => atualizar(null)}
          className="h-12 rounded-xl px-3"
          aria-label="Cancelar cronômetro sem salvar"
          title="Cancelar sem salvar"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>
    </div>
  )
}
