// src/pages/Diario.tsx
// Rota /diario: Linha do tempo de memórias, notas livres e perguntas para a pediatra (estado acolhedor em breve)

import React from 'react'
import { BookOpen, Heart, MessageSquare, Sparkles, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function Diario() {
  return (
    <div className="space-y-6 py-4">
      <div>
        <h1 className="text-2xl font-black text-foreground tracking-tight flex items-center gap-2">
          <BookOpen className="w-6 h-6 text-primary" />
          Diário da Sarah
        </h1>
        <p className="text-xs text-muted-foreground mt-1">
          Notas da rotina, perguntas para a pediatra e cartas para o futuro.
        </p>
      </div>

      <div className="bg-card rounded-[24px] p-8 text-center border border-border shadow-sm space-y-4">
        <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center text-primary mx-auto">
          <Heart className="w-7 h-7 fill-primary" />
        </div>
        <div className="space-y-1">
          <h2 className="text-lg font-bold text-foreground">Ainda não há registros no diário</h2>
          <p className="text-xs text-muted-foreground max-w-[340px] mx-auto leading-relaxed">
            Que tal escrever a primeira carta para a Sarah ou anotar uma dúvida para a próxima
            consulta?
          </p>
        </div>

        <div className="pt-2 flex flex-col sm:flex-row gap-2 justify-center">
          <Button
            type="button"
            variant="outline"
            disabled
            className="h-11 rounded-2xl text-xs font-semibold gap-2 opacity-75"
          >
            <Plus className="w-4 h-4 text-primary" />
            <span>Escrever carta / nota</span>
            <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded-full text-muted-foreground">
              Em breve
            </span>
          </Button>

          <Button
            type="button"
            variant="outline"
            disabled
            className="h-11 rounded-2xl text-xs font-semibold gap-2 opacity-75"
          >
            <MessageSquare className="w-4 h-4 text-primary" />
            <span>Dúvida p/ pediatra</span>
            <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded-full text-muted-foreground">
              Em breve
            </span>
          </Button>
        </div>
      </div>
    </div>
  )
}
