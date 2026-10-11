// src/pages/Saude.tsx
// Rota /saude: Hub de saúde da Sarah (Exames, Vacinas, Triagens, Consultas, Medicações, Crescimento)

import React from 'react'
import {
  Stethoscope,
  Syringe,
  ClipboardList,
  Calendar,
  Pill,
  TrendingUp,
  FileCheck2,
} from 'lucide-react'

export default function Saude() {
  const modulos = [
    {
      titulo: 'Vacinas',
      desc: 'Calendário vacinal completo e doses aplicadas',
      icon: Syringe,
    },
    {
      titulo: 'Triagens Neonatais',
      desc: 'Teste do pezinho, orelhinha, olhinho e coraçãozinho',
      icon: FileCheck2,
    },
    {
      titulo: 'Consultas Pediátricas',
      desc: 'Histórico de consultas, orientações e dúvidas respondidas',
      icon: Calendar,
    },
    {
      titulo: 'Curvas de Crescimento',
      desc: 'Evolução de peso, estatura e perímetro cefálico (OMS)',
      icon: TrendingUp,
    },
    {
      titulo: 'Medicações e Vitaminas',
      desc: 'Vitamina D, ferro e orientações prescritas',
      icon: Pill,
    },
    {
      titulo: 'Exames',
      desc: 'Resultados de sangue, ultrassom e laudos',
      icon: ClipboardList,
    },
  ]

  return (
    <div className="space-y-6 py-4">
      <div>
        <h1 className="text-2xl font-black text-foreground tracking-tight flex items-center gap-2">
          <Stethoscope className="w-6 h-6 text-primary" />
          Saúde do Bebê
        </h1>
        <p className="text-xs text-muted-foreground mt-1">
          Acompanhamento clínico, vacinas e consultas da Sarah.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {modulos.map((m) => {
          const Icon = m.icon
          return (
            <div
              key={m.titulo}
              className="bg-card rounded-[22px] p-4 border border-border shadow-sm flex items-start gap-3.5 relative overflow-hidden"
            >
              <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shrink-0 mt-0.5">
                <Icon className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold text-foreground">{m.titulo}</h2>
                  <span className="text-[10px] bg-muted px-2 py-0.5 rounded-full text-muted-foreground font-semibold">
                    Em breve
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{m.desc}</p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
