// src/components/Layout.tsx
// Layout principal do Diário da Sarah: Top App Bar, Faixa de Contexto, Container max-w-560px e Bottom Nav fixa

import React, { useEffect, useState } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import {
  Heart,
  Settings,
  Clock,
  BookOpen,
  Stethoscope,
  Award,
  Menu,
  Users,
  Image as ImageIcon,
  FileText,
  ChevronRight,
  Moon,
  Sun,
} from 'lucide-react'
import { SyncIndicator } from './SyncIndicator'
import { obterEspacoAtual, EspacoRecord } from '@/services/baby'
import { formatarIdadeAmigavel } from '@/lib/regras/idade'
import { useAuth } from '@/contexts/AuthContext'
import { alternarNoturno, noturnoAtivo, ouvirTema } from '@/lib/tema'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'

export default function Layout() {
  const { isAuthenticated, isLoading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [espaco, setEspaco] = useState<EspacoRecord | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [noturno, setNoturno] = useState(() => noturnoAtivo())

  // Acompanha trocas de tema feitas aqui ou em Ajustes
  useEffect(() => ouvirTema(() => setNoturno(noturnoAtivo())), [])

  // Redirecionamento de rotas protegidas se não autenticado
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      if (
        location.pathname !== '/' &&
        !location.pathname.startsWith('/verify-email') &&
        !location.pathname.startsWith('/convite')
      ) {
        navigate('/', { replace: true })
      }
    }
  }, [isAuthenticated, isLoading, location.pathname, navigate])

  // Carregar dados do bebê
  useEffect(() => {
    if (isAuthenticated) {
      obterEspacoAtual().then((e) => {
        setEspaco(e)
      })
    }
  }, [isAuthenticated])

  // Se estiver na tela de login '/', não renderiza a navegação completa
  const isLoginPage =
    location.pathname === '/' ||
    location.pathname.startsWith('/verify-email') ||
    location.pathname.startsWith('/convite')

  if (isLoginPage) {
    return (
      <main className="min-h-screen bg-background text-foreground flex flex-col justify-center items-center px-4 py-8">
        <div className="w-full max-w-[480px]">
          <Outlet />
        </div>
      </main>
    )
  }

  const nomeBebe = espaco?.nome || 'Sarah'
  const dataNascimento = espaco?.data_nascimento || '2026-10-09'
  const idadeInfo = formatarIdadeAmigavel(dataNascimento, espaco?.idade_gestacional_semanas)

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center">
      {/* Top App Bar fixa no topo */}
      <header className="w-full bg-card/90 backdrop-blur border-b border-border sticky top-0 z-40 transition-colors">
        <div className="max-w-[560px] mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary"
              aria-hidden="true"
            >
              <Heart className="w-4 h-4 fill-primary" />
            </div>
            <div>
              <span className="font-bold text-base tracking-tight text-foreground block leading-tight">
                Diário da {nomeBebe}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <SyncIndicator />
            <button
              onClick={() => {
                alternarNoturno()
                setNoturno(noturnoAtivo())
              }}
              className="w-10 h-10 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
              aria-label={noturno ? 'Desligar modo noturno' : 'Ligar modo noturno'}
              aria-pressed={noturno}
              title={noturno ? 'Desligar modo noturno' : 'Modo noturno'}
            >
              {noturno ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            <button
              onClick={() => navigate('/ajustes')}
              className="w-10 h-10 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
              aria-label="Ajustes e configurações"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Faixa de contexto da idade do bebê */}
        <div className="bg-primary/5 dark:bg-primary/10 border-t border-primary/10 py-1.5 px-4 text-center">
          <p className="text-xs font-semibold text-primary tracking-wide">
            {idadeInfo.faixaContexto}
            {idadeInfo.idadeCorrigidaTexto ? ` · ${idadeInfo.idadeCorrigidaTexto}` : ''}
          </p>
        </div>
      </header>

      {/* Conteúdo Principal — largura máxima de 560px centrada */}
      <main className="w-full max-w-[560px] flex-1 px-4 py-4 pb-24">
        <Outlet />
      </main>

      {/* Barra de Navegação Inferior Fixa com Fundo Fosco */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 bg-card/90 backdrop-blur-md border-t border-border"
        aria-label="Navegação principal"
      >
        <div className="max-w-[560px] mx-auto px-2 h-16 flex items-center justify-around">
          {/* Tab Hoje */}
          <NavLink
            to="/hoje"
            className={({ isActive }) =>
              `flex flex-col items-center justify-center min-w-[54px] min-h-[48px] px-1 rounded-xl transition-all ${
                isActive
                  ? 'text-primary font-bold scale-105'
                  : 'text-muted-foreground hover:text-foreground'
              }`
            }
          >
            <Clock className="w-5 h-5 mb-0.5" />
            <span className="text-[11px] leading-tight">Hoje</span>
          </NavLink>

          {/* Tab Diário */}
          <NavLink
            to="/diario"
            className={({ isActive }) =>
              `flex flex-col items-center justify-center min-w-[54px] min-h-[48px] px-1 rounded-xl transition-all ${
                isActive
                  ? 'text-primary font-bold scale-105'
                  : 'text-muted-foreground hover:text-foreground'
              }`
            }
          >
            <BookOpen className="w-5 h-5 mb-0.5" />
            <span className="text-[11px] leading-tight">Diário</span>
          </NavLink>

          {/* Tab Saúde */}
          <NavLink
            to="/saude"
            className={({ isActive }) =>
              `flex flex-col items-center justify-center min-w-[54px] min-h-[48px] px-1 rounded-xl transition-all ${
                isActive
                  ? 'text-primary font-bold scale-105'
                  : 'text-muted-foreground hover:text-foreground'
              }`
            }
          >
            <Stethoscope className="w-5 h-5 mb-0.5" />
            <span className="text-[11px] leading-tight">Saúde</span>
          </NavLink>

          {/* Tab Marcos */}
          <NavLink
            to="/marcos"
            className={({ isActive }) =>
              `flex flex-col items-center justify-center min-w-[54px] min-h-[48px] px-1 rounded-xl transition-all ${
                isActive
                  ? 'text-primary font-bold scale-105'
                  : 'text-muted-foreground hover:text-foreground'
              }`
            }
          >
            <Award className="w-5 h-5 mb-0.5" />
            <span className="text-[11px] leading-tight">Marcos</span>
          </NavLink>

          {/* Tab Menu (Abre folha/sheet com Álbum, Pessoas, Ajustes) */}
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger asChild>
              <button
                type="button"
                className="flex flex-col items-center justify-center min-w-[54px] min-h-[48px] px-1 rounded-xl text-muted-foreground hover:text-foreground transition-all focus:outline-none"
                aria-label="Abrir menu de opções"
              >
                <Menu className="w-5 h-5 mb-0.5" />
                <span className="text-[11px] leading-tight">Menu</span>
              </button>
            </SheetTrigger>
            <SheetContent side="bottom" className="max-w-[560px] mx-auto rounded-t-[24px] p-6">
              <SheetHeader className="text-left mb-4">
                <SheetTitle className="text-lg font-bold flex items-center gap-2">
                  <Heart className="w-5 h-5 text-primary fill-primary" />
                  Família da {nomeBebe}
                </SheetTitle>
              </SheetHeader>

              <div className="space-y-2">
                <Button
                  variant="outline"
                  className="w-full justify-between h-13 px-4 text-left font-medium rounded-2xl"
                  onClick={() => {
                    setMenuOpen(false)
                    navigate('/pessoas')
                  }}
                >
                  <div className="flex items-center gap-3">
                    <Users className="w-5 h-5 text-primary" />
                    <div>
                      <div className="font-semibold text-sm">Pessoas e papéis</div>
                      <div className="text-xs text-muted-foreground">
                        Convidar familiares, doula e babá
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </Button>

                <Button
                  variant="outline"
                  className="w-full justify-between h-13 px-4 text-left font-medium rounded-2xl"
                  onClick={() => {
                    setMenuOpen(false)
                    navigate('/album')
                  }}
                >
                  <div className="flex items-center gap-3">
                    <ImageIcon className="w-5 h-5 text-primary" />
                    <div>
                      <div className="font-semibold text-sm">Álbum de memórias</div>
                      <div className="text-xs text-muted-foreground">
                        Fotos dos primeiros dias e mesversários
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </Button>

                <Button
                  variant="outline"
                  className="w-full justify-between h-13 px-4 text-left font-medium rounded-2xl"
                  onClick={() => {
                    setMenuOpen(false)
                    navigate('/ajustes')
                  }}
                >
                  <div className="flex items-center gap-3">
                    <Settings className="w-5 h-5 text-primary" />
                    <div>
                      <div className="font-semibold text-sm">Ajustes do bebê</div>
                      <div className="text-xs text-muted-foreground">
                        Dados de nascimento, intervalo e tema
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </Button>

                <Button
                  variant="ghost"
                  className="w-full justify-between h-12 px-4 text-left font-medium rounded-2xl text-muted-foreground"
                  onClick={() => {
                    setMenuOpen(false)
                    navigate('/hoje')
                  }}
                >
                  <div className="flex items-center gap-3">
                    <FileText className="w-5 h-5 text-primary" />
                    <span className="text-sm">Resumo p/ Pediatra (hoje)</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </nav>
    </div>
  )
}
