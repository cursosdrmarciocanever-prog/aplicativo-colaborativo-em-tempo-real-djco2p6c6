// src/components/saude/AbaDuvidas.tsx
// Dúvidas para a próxima consulta: qualquer pessoa da família anota quando lembra
// (inclusive de madrugada) e, na consulta, anota a resposta da pediatra.

import { useState } from 'react'
import { CheckCircle2, ChevronDown, MessageCircleQuestion, Send, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/hooks/use-toast'
import { formatLocalDateShort } from '@/lib/regras/fuso'
import { criarDuvida, excluir, responderDuvida, type DuvidaRecord } from '@/services/saude'

interface Props {
  espacoId: string
  duvidas: DuvidaRecord[]
  podeEscrever: boolean
  podeApagarTudo: boolean
  meuId: string
  aoMudar: () => void
}

export default function AbaDuvidas({ espacoId, duvidas, podeEscrever, podeApagarTudo, meuId, aoMudar }: Props) {
  const [texto, setTexto] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [respondendo, setRespondendo] = useState<string | null>(null)
  const [resposta, setResposta] = useState('')
  const [verRespondidas, setVerRespondidas] = useState(false)

  const abertas = duvidas.filter((d) => !d.respondida_em)
  const respondidas = duvidas.filter((d) => d.respondida_em)

  const adicionar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (texto.trim().length < 2) return
    setSalvando(true)
    try {
      await criarDuvida(espacoId, texto)
      setTexto('')
      aoMudar()
    } catch (err) {
      toast({ title: 'Não salvou', description: (err as Error).message, variant: 'destructive' })
    } finally {
      setSalvando(false)
    }
  }

  const salvarResposta = async (id: string) => {
    try {
      await responderDuvida(id, resposta)
      setRespondendo(null)
      setResposta('')
      aoMudar()
    } catch (err) {
      toast({ title: 'Não salvou', description: (err as Error).message, variant: 'destructive' })
    }
  }

  const remover = async (d: DuvidaRecord) => {
    if (!window.confirm('Apagar esta dúvida?')) return
    try {
      await excluir('duvidas', d.id)
      aoMudar()
    } catch (err) {
      toast({ title: 'Não apagou', description: (err as Error).message, variant: 'destructive' })
    }
  }

  const item = (d: DuvidaRecord) => {
    const podeApagar = podeEscrever && (podeApagarTudo || d.criador === meuId)
    return (
      <li key={d.id} className="py-3">
        <div className="flex items-start gap-2">
          {d.respondida_em ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
          ) : (
            <MessageCircleQuestion className="w-4 h-4 text-primary shrink-0 mt-0.5" />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground leading-snug">{d.texto}</p>
            <p className="text-[11px] text-muted-foreground">
              {d.criador_nome || 'Família'} · {formatLocalDateShort(d.created)}
            </p>
            {d.resposta && (
              <p className="text-sm text-foreground mt-1.5 bg-muted/40 rounded-xl p-2.5 whitespace-pre-wrap">
                {d.resposta}
              </p>
            )}
            {respondendo === d.id && (
              <div className="mt-2 space-y-2">
                <Textarea
                  autoFocus
                  placeholder="O que a pediatra respondeu?"
                  value={resposta}
                  onChange={(e) => setResposta(e.target.value)}
                  maxLength={2000}
                  className="min-h-[70px] rounded-xl text-sm"
                />
                <div className="flex gap-2">
                  <Button type="button" onClick={() => salvarResposta(d.id)} className="h-9 rounded-xl text-xs font-bold">
                    Salvar resposta
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setRespondendo(null)}
                    className="h-9 rounded-xl text-xs"
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            )}
            {podeEscrever && respondendo !== d.id && (
              <div className="flex gap-3 mt-1">
                <button
                  type="button"
                  onClick={() => {
                    setRespondendo(d.id)
                    setResposta(d.resposta || '')
                  }}
                  className="text-[11px] font-bold text-primary"
                >
                  {d.respondida_em ? 'Editar resposta' : 'Anotar resposta'}
                </button>
                {podeApagar && (
                  <button
                    type="button"
                    onClick={() => remover(d)}
                    className="text-[11px] font-bold text-muted-foreground hover:text-destructive flex items-center gap-1"
                  >
                    <Trash2 className="w-3 h-3" /> Apagar
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </li>
    )
  }

  return (
    <div className="space-y-4">
      {podeEscrever && (
        <form onSubmit={adicionar} className="flex gap-2">
          <Input
            placeholder="Anote uma dúvida para a pediatra..."
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            maxLength={500}
            className="h-12 rounded-2xl text-sm"
            aria-label="Nova dúvida"
          />
          <Button
            type="submit"
            disabled={salvando || texto.trim().length < 2}
            className="h-12 w-12 rounded-2xl shrink-0"
            aria-label="Adicionar dúvida"
          >
            <Send className="w-4 h-4" />
          </Button>
        </form>
      )}

      <section className="bg-card rounded-[22px] px-4 py-1 border border-border shadow-sm">
        {abertas.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            Nenhuma dúvida pendente. Anote aqui o que lembrar ao longo dos dias: tudo aparece no
            resumo da consulta.
          </p>
        ) : (
          <ul className="divide-y divide-border">{abertas.map(item)}</ul>
        )}
      </section>

      {respondidas.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setVerRespondidas(!verRespondidas)}
            className="w-full flex items-center justify-center gap-1 text-xs font-bold text-muted-foreground h-10"
          >
            <ChevronDown className={`w-4 h-4 transition-transform ${verRespondidas ? 'rotate-180' : ''}`} />
            {verRespondidas ? 'Esconder' : 'Ver'} {respondidas.length} já respondida
            {respondidas.length > 1 ? 's' : ''}
          </button>
          {verRespondidas && (
            <section className="bg-card rounded-[22px] px-4 py-1 border border-border shadow-sm">
              <ul className="divide-y divide-border">{respondidas.map(item)}</ul>
            </section>
          )}
        </div>
      )}
    </div>
  )
}
