// src/components/hoje/RegistroMamadeira.tsx
// Registro de mamadeira (leite materno ou fórmula) e de ordenha, em mL.

import { useState } from 'react'
import { Milk } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { validarVolumeMl, type ConteudoMamadeira } from '@/lib/regras/alimentacao'

type Opcao = 'mamadeira_lm' | 'mamadeira_formula' | 'ordenha'

const OPCOES: { valor: Opcao; rotulo: string }[] = [
  { valor: 'mamadeira_lm', rotulo: 'Mamadeira · leite materno' },
  { valor: 'mamadeira_formula', rotulo: 'Mamadeira · fórmula' },
  { valor: 'ordenha', rotulo: 'Ordenha (tirou leite)' },
]

const ATALHOS = [30, 60, 90, 120]

interface Props {
  salvando: boolean
  onRegistrar: (dados: {
    tipo: 'mamadeira' | 'ordenha'
    ml: number
    conteudo: ConteudoMamadeira | null
  }) => Promise<boolean>
}

export default function RegistroMamadeira({ salvando, onRegistrar }: Props) {
  const [opcao, setOpcao] = useState<Opcao>('mamadeira_lm')
  const [ml, setMl] = useState('')
  const [erro, setErro] = useState<string | null>(null)

  const registrar = async () => {
    const v = validarVolumeMl(ml)
    if (!v.valido) {
      setErro(v.erro || 'Quantidade inválida')
      return
    }
    const ok = await onRegistrar({
      tipo: opcao === 'ordenha' ? 'ordenha' : 'mamadeira',
      ml: v.ml!,
      conteudo:
        opcao === 'ordenha' ? null : opcao === 'mamadeira_formula' ? 'formula' : 'leite_materno',
    })
    if (ok) {
      setMl('')
      setErro(null)
    }
  }

  return (
    <div className="bg-card rounded-[24px] p-5 shadow-sm border border-border space-y-3">
      <div className="flex items-center gap-2">
        <Milk className="w-4 h-4 text-primary" />
        <span className="text-sm font-bold text-foreground">Mamadeira e ordenha</span>
      </div>

      <div className="grid grid-cols-1 gap-2" role="radiogroup" aria-label="Tipo">
        {OPCOES.map((o) => (
          <button
            key={o.valor}
            type="button"
            role="radio"
            aria-checked={opcao === o.valor}
            onClick={() => setOpcao(o.valor)}
            className={`h-10 rounded-xl text-xs font-bold border text-left px-3 ${
              opcao === o.valor
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background border-border text-foreground'
            }`}
          >
            {o.rotulo}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {ATALHOS.map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => {
              setMl(String(v))
              setErro(null)
            }}
            className={`h-9 px-3 rounded-full text-xs font-bold border ${
              ml === String(v)
                ? 'bg-secondary border-primary text-foreground'
                : 'bg-background border-border text-muted-foreground'
            }`}
          >
            {v} mL
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Input
            inputMode="numeric"
            placeholder="Quantidade"
            aria-label="Quantidade em mL"
            value={ml}
            onChange={(e) => {
              setMl(e.target.value.replace(/\D/g, ''))
              setErro(null)
            }}
            className="h-11 rounded-2xl text-sm pr-10"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
            mL
          </span>
        </div>
        <Button
          type="button"
          disabled={salvando || !ml}
          onClick={registrar}
          className="h-11 rounded-2xl text-xs font-bold px-4"
        >
          Registrar
        </Button>
      </div>
      {erro && <p className="text-xs text-destructive font-medium">{erro}</p>}
      {opcao === 'mamadeira_lm' || opcao === 'mamadeira_formula' ? (
        <p className="text-[11px] text-muted-foreground">
          A mamadeira conta para o horário da próxima mamada.
        </p>
      ) : null}
    </div>
  )
}
