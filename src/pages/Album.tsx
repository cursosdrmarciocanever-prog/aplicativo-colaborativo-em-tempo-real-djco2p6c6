// src/pages/Album.tsx
// Rota /album: Galeria de fotos, mesversários e momentos especiais

import React from 'react'
import { Image as ImageIcon, Camera, Heart, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function Album() {
  return (
    <div className="space-y-6 py-4">
      <div>
        <h1 className="text-2xl font-black text-foreground tracking-tight flex items-center gap-2">
          <ImageIcon className="w-6 h-6 text-primary" />
          Álbum de Memórias
        </h1>
        <p className="text-xs text-muted-foreground mt-1">
          Guarde as fotos dos primeiros dias, mesversários e momentos inesquecíveis.
        </p>
      </div>

      <div className="bg-card rounded-[24px] p-8 text-center border border-border shadow-sm space-y-4">
        <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center text-primary mx-auto">
          <Camera className="w-8 h-8" />
        </div>
        <div className="space-y-1">
          <h2 className="text-lg font-bold text-foreground">Ainda não há fotos no álbum</h2>
          <p className="text-xs text-muted-foreground max-w-[320px] mx-auto leading-relaxed">
            As lembranças visuais do primeiro mês da Sarah ficarão organizadas cronologicamente
            aqui.
          </p>
        </div>

        <div className="pt-2">
          <Button
            type="button"
            variant="outline"
            disabled
            className="h-11 rounded-2xl text-xs font-semibold gap-2 opacity-75"
          >
            <Plus className="w-4 h-4 text-primary" />
            <span>Adicionar primeira foto</span>
            <span className="text-[10px] bg-muted px-2 py-0.5 rounded-full text-muted-foreground">
              Em breve
            </span>
          </Button>
        </div>
      </div>
    </div>
  )
}
