// src/pages/Marcos.tsx
// Rota /marcos: Marcos do neurodesenvolvimento da Sarah (sorriso, sustentar cabeça, balbucio)

import React from 'react'
import { Award, Sparkles, Smile, Eye, Activity } from 'lucide-react'

export default function Marcos() {
  const marcosExemplo = [
    {
      faixa: '0 a 1 mês',
      marco: 'Fixar o olhar e reagir a sons da família',
      desc: 'Reconhece a voz da mamãe e do papai, pisca para luz forte.',
    },
    {
      faixa: '2 meses',
      marco: 'Primeiro sorriso social espontâneo',
      desc: 'Sorri intencionalmente ao interagir com o rosto dos pais.',
    },
    {
      faixa: '3 meses',
      marco: 'Sustentar a cabecinha de bruços',
      desc: 'Força no pescoço e interesse no ambiente ao redor.',
    },
  ]

  return (
    <div className="space-y-6 py-4">
      <div>
        <h1 className="text-2xl font-black text-foreground tracking-tight flex items-center gap-2">
          <Award className="w-6 h-6 text-primary" />
          Marcos do Desenvolvimento
        </h1>
        <p className="text-xs text-muted-foreground mt-1">
          Acompanhe cada conquista e sorriso da Sarah.
        </p>
      </div>

      <div className="bg-card rounded-[24px] p-6 border border-border shadow-sm space-y-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary" />
          <h2 className="text-sm font-bold text-foreground">Primeiras conquistas esperadas</h2>
          <span className="text-[10px] bg-muted px-2 py-0.5 rounded-full text-muted-foreground ml-auto">
            Em breve
          </span>
        </div>

        <div className="divide-y divide-border/60">
          {marcosExemplo.map((item) => (
            <div key={item.marco} className="py-3 flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0 mt-0.5">
                <Smile className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[11px] font-bold text-primary uppercase tracking-wide block">
                  {item.faixa}
                </span>
                <span className="text-sm font-semibold text-foreground block mt-0.5">
                  {item.marco}
                </span>
                <span className="text-xs text-muted-foreground block mt-0.5 leading-relaxed">
                  {item.desc}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
