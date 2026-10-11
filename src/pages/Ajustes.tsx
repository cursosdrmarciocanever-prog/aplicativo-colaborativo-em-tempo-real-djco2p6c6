// src/pages/Ajustes.tsx
// Tela Ajustes: Editar dados do bebê, tema (claro/escuro/auto), transparência LGPD, auditoria e sair

import React, { useEffect, useState } from 'react'
import {
  Settings,
  Baby,
  Moon,
  Sun,
  Laptop,
  ShieldCheck,
  LogOut,
  FileDown,
  Trash2,
  Clock,
  History,
  Check,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { useAuth } from '@/contexts/AuthContext'
import {
  obterEspacoAtual,
  atualizarEspaco,
  listarAuditoria,
  EspacoRecord,
  AuditoriaRecord,
} from '@/services/baby'
import { formatLocalTime, formatLocalDateShort } from '@/lib/regras/fuso'

export default function Ajustes() {
  const { user, logout } = useAuth()
  const [espaco, setEspaco] = useState<EspacoRecord | null>(null)
  const [auditoria, setAuditoria] = useState<AuditoriaRecord[]>([])

  // Campos de edição do bebê
  const [nome, setNome] = useState('')
  const [dataNascimento, setDataNascimento] = useState('')
  const [horaNascimento, setHoraNascimento] = useState('')
  const [pesoNascimentoG, setPesoNascimentoG] = useState('')
  const [idadeGestacional, setIdadeGestacional] = useState('')
  const [intervaloMamada, setIntervaloMamada] = useState('180')

  const [salvando, setSalvando] = useState(false)
  const [salvoComSucesso, setSalvoComSucesso] = useState(false)

  // Tema: claro / escuro / automático
  const [tema, setTema] = useState<'claro' | 'escuro' | 'auto'>('auto')

  useEffect(() => {
    obterEspacoAtual().then((esp) => {
      if (esp) {
        setEspaco(esp)
        setNome(esp.nome || 'Sarah')
        setDataNascimento(esp.data_nascimento || '2026-10-09')
        setHoraNascimento(esp.hora_nascimento || 'a confirmar')
        setPesoNascimentoG(esp.peso_nascimento_g ? String(esp.peso_nascimento_g) : '3250')
        setIdadeGestacional(
          esp.idade_gestacional_semanas ? String(esp.idade_gestacional_semanas) : '39',
        )
        setIntervaloMamada(
          esp.intervalo_mamada_minutos ? String(esp.intervalo_mamada_minutos) : '180',
        )

        listarAuditoria(esp.id).then((aud) => setAuditoria(aud))
      }
    })

    // Detectar tema salvo no localStorage
    const salvo = localStorage.getItem('diario_tema') as 'claro' | 'escuro' | 'auto' | null
    if (salvo) setTema(salvo)
  }, [])

  const aplicarTema = (novoTema: 'claro' | 'escuro' | 'auto') => {
    setTema(novoTema)
    localStorage.setItem('diario_tema', novoTema)

    const root = document.documentElement
    if (novoTema === 'escuro') {
      root.classList.add('dark')
    } else if (novoTema === 'claro') {
      root.classList.remove('dark')
    } else {
      // Automático: respeitar prefers-color-scheme
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        root.classList.add('dark')
      } else {
        root.classList.remove('dark')
      }
    }
  }

  const handleSalvarDados = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!espaco) return

    setSalvando(true)
    setSalvoComSucesso(false)
    try {
      const atualizado = await atualizarEspaco(espaco.id, {
        nome: nome.trim(),
        data_nascimento: dataNascimento,
        hora_nascimento: horaNascimento,
        peso_nascimento_g: pesoNascimentoG ? parseInt(pesoNascimentoG, 10) : undefined,
        idade_gestacional_semanas: idadeGestacional ? parseInt(idadeGestacional, 10) : undefined,
        intervalo_mamada_minutos: parseInt(intervaloMamada, 10) || 180,
      })
      setEspaco(atualizado)
      setSalvoComSucesso(true)
      setTimeout(() => setSalvoComSucesso(false), 3000)
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="space-y-6 pb-8">
      <div>
        <h1 className="text-2xl font-black text-foreground tracking-tight flex items-center gap-2">
          <Settings className="w-6 h-6 text-primary" />
          Ajustes
        </h1>
        <p className="text-xs text-muted-foreground mt-1">
          Configurações do bebê, aparência, privacidade e auditoria da família.
        </p>
      </div>

      {/* 1. DADOS DO BEBÊ */}
      <div className="bg-card rounded-[24px] p-5 shadow-sm border border-border space-y-4">
        <div className="flex items-center gap-2">
          <Baby className="w-5 h-5 text-primary" />
          <h2 className="text-sm font-bold text-foreground">Dados da {nome || 'Sarah'}</h2>
        </div>

        <form onSubmit={handleSalvarDados} className="space-y-3.5">
          <div>
            <Label htmlFor="nome" className="text-xs font-semibold">
              Nome do bebê
            </Label>
            <Input
              id="nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="h-11 rounded-2xl text-sm mt-1"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="dataNasc" className="text-xs font-semibold">
                Nascimento
              </Label>
              <Input
                id="dataNasc"
                type="date"
                value={dataNascimento}
                onChange={(e) => setDataNascimento(e.target.value)}
                className="h-11 rounded-2xl text-sm mt-1"
              />
            </div>
            <div>
              <Label htmlFor="horaNasc" className="text-xs font-semibold">
                Horário
              </Label>
              <Input
                id="horaNasc"
                value={horaNascimento}
                onChange={(e) => setHoraNascimento(e.target.value)}
                className="h-11 rounded-2xl text-sm mt-1"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="peso" className="text-xs font-semibold">
                Peso nascimento (g)
              </Label>
              <Input
                id="peso"
                type="number"
                value={pesoNascimentoG}
                onChange={(e) => setPesoNascimentoG(e.target.value)}
                className="h-11 rounded-2xl text-sm mt-1"
              />
            </div>
            <div>
              <Label htmlFor="intervalo" className="text-xs font-semibold">
                Intervalo mamada (min)
              </Label>
              <Input
                id="intervalo"
                type="number"
                value={intervaloMamada}
                onChange={(e) => setIntervaloMamada(e.target.value)}
                className="h-11 rounded-2xl text-sm mt-1"
              />
            </div>
          </div>

          <Button
            type="submit"
            disabled={salvando}
            className="w-full h-12 rounded-2xl font-bold bg-primary hover:bg-primary/90 text-primary-foreground tap-pop"
          >
            {salvando
              ? 'Salvando...'
              : salvoComSucesso
                ? 'Salvo com sucesso!'
                : 'Salvar dados do bebê'}
          </Button>
        </form>
      </div>

      {/* 2. TEMA DE APARÊNCIA */}
      <div className="bg-card rounded-[24px] p-5 shadow-sm border border-border space-y-3">
        <h2 className="text-sm font-bold text-foreground">Tema de aparência</h2>
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => aplicarTema('claro')}
            className={`h-11 rounded-2xl text-xs font-bold border flex items-center justify-center gap-1.5 transition-all ${
              tema === 'claro'
                ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                : 'border-border text-foreground hover:bg-muted/30'
            }`}
          >
            <Sun className="w-4 h-4" />
            <span>Claro</span>
          </button>

          <button
            type="button"
            onClick={() => aplicarTema('escuro')}
            className={`h-11 rounded-2xl text-xs font-bold border flex items-center justify-center gap-1.5 transition-all ${
              tema === 'escuro'
                ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                : 'border-border text-foreground hover:bg-muted/30'
            }`}
          >
            <Moon className="w-4 h-4" />
            <span>Escuro</span>
          </button>

          <button
            type="button"
            onClick={() => aplicarTema('auto')}
            className={`h-11 rounded-2xl text-xs font-bold border flex items-center justify-center gap-1.5 transition-all ${
              tema === 'auto'
                ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                : 'border-border text-foreground hover:bg-muted/30'
            }`}
          >
            <Laptop className="w-4 h-4" />
            <span>Auto</span>
          </button>
        </div>
      </div>

      {/* 3. TRANSPARÊNCIA E LGPD */}
      <div className="bg-card rounded-[24px] p-5 shadow-sm border border-border space-y-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-primary" />
          <h2 className="text-sm font-bold text-foreground">
            Quais dados são guardados e quem os vê
          </h2>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          O Diário da Sarah é um espaço privado e familiar. Apenas pessoas com convite explícito
          (gerado pelos pais) têm acesso aos registros de mamadas, fraldas e saúde. Seus dados nunca
          são vendidos, compartilhados com terceiros ou usados para publicidade. Os registros são
          armazenados em servidores protegidos com criptografia.
        </p>
      </div>

      {/* 4. REGISTRO DE AUDITORIA */}
      <div className="bg-card rounded-[24px] p-5 shadow-sm border border-border space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-primary" />
            <h2 className="text-sm font-bold text-foreground">Registro de Auditoria</h2>
          </div>
          <span className="text-[11px] text-muted-foreground">Convites e alterações</span>
        </div>

        {auditoria.length === 0 ? (
          <p className="text-xs text-muted-foreground py-2">
            Nenhum evento registrado ainda. Ações de convite e remoção aparecerão aqui.
          </p>
        ) : (
          <div className="divide-y divide-border/60 text-xs">
            {auditoria.map((item) => (
              <div key={item.id} className="py-2.5 flex items-start justify-between">
                <div>
                  <span className="font-semibold text-foreground block">
                    {item.detalhe || item.acao}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    por {item.usuario_nome || 'Usuário'}
                  </span>
                </div>
                <span className="text-[10px] text-muted-foreground shrink-0 ml-2">
                  {formatLocalDateShort(item.created)} {formatLocalTime(item.created)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 5. AÇÕES ESPECIAIS (MARCADAS COMO EM BREVE) */}
      <div className="space-y-2">
        <Button
          type="button"
          variant="outline"
          disabled
          className="w-full h-12 rounded-2xl text-xs font-semibold justify-between opacity-60"
        >
          <span className="flex items-center gap-2">
            <FileDown className="w-4 h-4" />
            Exportar tudo (JSON / CSV)
          </span>
          <span className="text-[10px] bg-muted px-2 py-0.5 rounded-full text-muted-foreground">
            Em breve
          </span>
        </Button>

        <Button
          type="button"
          variant="outline"
          disabled
          className="w-full h-12 rounded-2xl text-xs font-semibold justify-between opacity-60 text-destructive"
        >
          <span className="flex items-center gap-2">
            <Trash2 className="w-4 h-4" />
            Excluir tudo
          </span>
          <span className="text-[10px] bg-muted px-2 py-0.5 rounded-full text-muted-foreground">
            Em breve
          </span>
        </Button>
      </div>

      {/* 6. BOTÃO SAIR */}
      <div className="pt-2">
        <Button
          type="button"
          variant="ghost"
          onClick={() => logout()}
          className="w-full h-12 rounded-2xl text-sm font-semibold text-destructive hover:bg-destructive/10 flex items-center justify-center gap-2"
        >
          <LogOut className="w-4 h-4" />
          <span>Sair da conta</span>
        </Button>
      </div>
    </div>
  )
}
