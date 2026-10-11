// src/pages/Onboarding.tsx
// Onboarding em 3 passos para configurar o bebê

import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Heart, Baby, Clock, Users, ArrowRight, ArrowLeft, Check, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useAuth } from '@/contexts/AuthContext'
import pb from '@/lib/pocketbase/client'
import { criarConvite } from '@/services/baby'

export default function Onboarding() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [loading, setLoading] = useState(false)

  // Passo 1: Dados do bebê
  const [nome, setNome] = useState('Sarah')
  const [dataNascimento, setDataNascimento] = useState('2026-10-09')
  const [horaNascimento, setHoraNascimento] = useState('a confirmar')
  const [pesoNascimentoG, setPesoNascimentoG] = useState('3250')
  const [idadeGestacional, setIdadeGestacional] = useState('39')

  // Passo 2: Intervalo de mamada
  const [presetIntervalo, setPresetIntervalo] = useState('180') // 3h padrão
  const [customIntervalo, setCustomIntervalo] = useState('')

  // Passo 3: Convidar primeira pessoa
  const [conviteEmail, setConviteEmail] = useState('')
  const [convitePapel, setConvitePapel] = useState<'editor' | 'viewer'>('editor')

  const handleNext = async () => {
    if (step === 1) {
      if (!nome.trim()) return
      setStep(2)
    } else if (step === 2) {
      setStep(3)
    } else if (step === 3) {
      await concluirOnboarding()
    }
  }

  const concluirOnboarding = async () => {
    if (!user) return
    setLoading(true)
    try {
      const intervalo =
        presetIntervalo === 'custom'
          ? parseInt(customIntervalo, 10) || 180
          : parseInt(presetIntervalo, 10) || 180

      // 1. Criar espaco
      const espaco = await pb.collection('espacos').create({
        nome: nome.trim(),
        data_nascimento: dataNascimento,
        hora_nascimento: horaNascimento,
        peso_nascimento_g: pesoNascimentoG ? parseInt(pesoNascimentoG, 10) : null,
        idade_gestacional_semanas: idadeGestacional ? parseInt(idadeGestacional, 10) : null,
        intervalo_mamada_minutos: intervalo,
        criador: user.id,
      })

      // 2. O servidor vincula quem criou como owner (hook em espacos)

      // 3. Convidar primeira pessoa se informado
      if (conviteEmail.trim()) {
        try {
          await criarConvite({
            espacoId: espaco.id,
            email: conviteEmail.trim(),
            papel: convitePapel,
          })
        } catch (err) {
          console.warn('Erro ao enviar convite inicial:', err)
        }
      }

      navigate('/hoje', { replace: true })
    } catch (err) {
      console.error('Erro ao concluir onboarding:', err)
      navigate('/hoje')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-[520px] mx-auto py-6">
      {/* Indicador de passos */}
      <div className="flex items-center justify-between mb-8 px-2">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm transition-all ${
                s === step
                  ? 'bg-primary text-primary-foreground shadow-sm scale-105'
                  : s < step
                    ? 'bg-primary/20 text-primary'
                    : 'bg-muted text-muted-foreground'
              }`}
            >
              {s < step ? <Check className="w-4 h-4" /> : s}
            </div>
            <span className="text-xs font-semibold hidden sm:inline">
              {s === 1 && 'Bebê'}
              {s === 2 && 'Mamadas'}
              {s === 3 && 'Família'}
            </span>
          </div>
        ))}
      </div>

      <div className="bg-card rounded-[24px] p-6 shadow-sm border border-border">
        {/* PASSO 1: Criar bebê */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                <Baby className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-foreground">Quem é o bebê?</h2>
                <p className="text-xs text-muted-foreground">
                  Vamos começar guardando os dados da pequena.
                </p>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <div>
                <Label htmlFor="nome" className="text-sm font-semibold">
                  Nome do bebê
                </Label>
                <Input
                  id="nome"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Nome do bebê"
                  className="h-12 rounded-2xl mt-1 text-base"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="dataNasc" className="text-sm font-semibold">
                    Data de nascimento
                  </Label>
                  <Input
                    id="dataNasc"
                    type="date"
                    value={dataNascimento}
                    onChange={(e) => setDataNascimento(e.target.value)}
                    className="h-12 rounded-2xl mt-1 text-base"
                  />
                </div>
                <div>
                  <Label htmlFor="horaNasc" className="text-sm font-semibold">
                    Horário de nascimento
                  </Label>
                  <Input
                    id="horaNasc"
                    value={horaNascimento}
                    onChange={(e) => setHoraNascimento(e.target.value)}
                    placeholder="a confirmar"
                    className="h-12 rounded-2xl mt-1 text-base"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="peso" className="text-sm font-semibold">
                    Peso ao nascer (g)
                  </Label>
                  <Input
                    id="peso"
                    type="number"
                    value={pesoNascimentoG}
                    onChange={(e) => setPesoNascimentoG(e.target.value)}
                    placeholder="Ex: 3250"
                    className="h-12 rounded-2xl mt-1 text-base"
                  />
                </div>
                <div>
                  <Label htmlFor="gestacional" className="text-sm font-semibold">
                    Idade gestacional (semanas)
                  </Label>
                  <Input
                    id="gestacional"
                    type="number"
                    value={idadeGestacional}
                    onChange={(e) => setIdadeGestacional(e.target.value)}
                    placeholder="Ex: 39"
                    className="h-12 rounded-2xl mt-1 text-base"
                  />
                </div>
              </div>

              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={() => navigate('/pessoas')}
                  className="text-xs text-primary font-semibold hover:underline"
                >
                  Já tem um convite da família? Entrar com convite
                </button>
              </div>
            </div>
          </div>
        )}

        {/* PASSO 2: Intervalo entre mamadas */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-foreground">Intervalo de mamadas</h2>
                <p className="text-xs text-muted-foreground">
                  Como a família prefere acompanhar os lembretes?
                </p>
              </div>
            </div>

            <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-2xl p-3.5 text-xs text-amber-900 dark:text-amber-200 leading-relaxed">
              <strong>Orientação típica:</strong> de 3 em 3 horas, contados do início de uma mamada
              ao início da próxima.
            </div>

            <div className="space-y-2 pt-2">
              <label
                className={`flex items-center justify-between p-3.5 rounded-2xl border cursor-pointer transition-all ${
                  presetIntervalo === '180'
                    ? 'border-primary bg-primary/5 text-primary font-bold'
                    : 'border-border hover:bg-muted/30'
                }`}
                onClick={() => setPresetIntervalo('180')}
              >
                <div>
                  <div className="text-sm">A cada 3 horas (Padrão recomendado)</div>
                  <div className="text-xs text-muted-foreground font-normal">
                    8 mamadas ao longo de 24 horas
                  </div>
                </div>
                <input
                  type="radio"
                  name="intervalo"
                  checked={presetIntervalo === '180'}
                  onChange={() => setPresetIntervalo('180')}
                  className="w-4 h-4 text-primary"
                />
              </label>

              <label
                className={`flex items-center justify-between p-3.5 rounded-2xl border cursor-pointer transition-all ${
                  presetIntervalo === '120'
                    ? 'border-primary bg-primary/5 text-primary font-bold'
                    : 'border-border hover:bg-muted/30'
                }`}
                onClick={() => setPresetIntervalo('120')}
              >
                <div>
                  <div className="text-sm">A cada 2 horas</div>
                  <div className="text-xs text-muted-foreground font-normal">
                    12 mamadas ao longo de 24 horas
                  </div>
                </div>
                <input
                  type="radio"
                  name="intervalo"
                  checked={presetIntervalo === '120'}
                  onChange={() => setPresetIntervalo('120')}
                  className="w-4 h-4 text-primary"
                />
              </label>

              <label
                className={`flex items-center justify-between p-3.5 rounded-2xl border cursor-pointer transition-all ${
                  presetIntervalo === '240'
                    ? 'border-primary bg-primary/5 text-primary font-bold'
                    : 'border-border hover:bg-muted/30'
                }`}
                onClick={() => setPresetIntervalo('240')}
              >
                <div>
                  <div className="text-sm">A cada 4 horas</div>
                  <div className="text-xs text-muted-foreground font-normal">
                    6 mamadas ao longo de 24 horas
                  </div>
                </div>
                <input
                  type="radio"
                  name="intervalo"
                  checked={presetIntervalo === '240'}
                  onChange={() => setPresetIntervalo('240')}
                  className="w-4 h-4 text-primary"
                />
              </label>

              <label
                className={`flex items-center justify-between p-3.5 rounded-2xl border cursor-pointer transition-all ${
                  presetIntervalo === 'custom'
                    ? 'border-primary bg-primary/5 text-primary font-bold'
                    : 'border-border hover:bg-muted/30'
                }`}
                onClick={() => setPresetIntervalo('custom')}
              >
                <div>
                  <div className="text-sm">Outro intervalo (em minutos)</div>
                  <div className="text-xs text-muted-foreground font-normal">Personalizado</div>
                </div>
                <input
                  type="radio"
                  name="intervalo"
                  checked={presetIntervalo === 'custom'}
                  onChange={() => setPresetIntervalo('custom')}
                  className="w-4 h-4 text-primary"
                />
              </label>

              {presetIntervalo === 'custom' && (
                <div className="pt-2">
                  <Input
                    type="number"
                    placeholder="Minutos (ex: 150)"
                    value={customIntervalo}
                    onChange={(e) => setCustomIntervalo(e.target.value)}
                    className="h-12 rounded-2xl text-base"
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* PASSO 3: Convidar a primeira pessoa */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-foreground">Convidar a família</h2>
                <p className="text-xs text-muted-foreground">
                  Convide o outro responsável, avós, doula ou babá.
                </p>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <div>
                <Label htmlFor="conviteEmail" className="text-sm font-semibold">
                  E-mail de quem você quer convidar (opcional)
                </Label>
                <Input
                  id="conviteEmail"
                  type="email"
                  value={conviteEmail}
                  onChange={(e) => setConviteEmail(e.target.value)}
                  placeholder="exemplo@familia.com"
                  className="h-12 rounded-2xl mt-1 text-base"
                />
              </div>

              <div>
                <Label htmlFor="papel" className="text-sm font-semibold">
                  Papel no app
                </Label>
                <Select
                  value={convitePapel}
                  onValueChange={(val: 'editor' | 'viewer') => setConvitePapel(val)}
                >
                  <SelectTrigger className="h-12 rounded-2xl mt-1 text-base">
                    <SelectValue placeholder="Selecione o papel" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="editor">
                      Editor (pode registrar mamadas e fraldas)
                    </SelectItem>
                    <SelectItem value="viewer">
                      Visualizador (apenas acompanha os registros)
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1.5">
                  Você já é Owner (pais) e tem controle total para editar, apagar e convidar.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Botões de Ação */}
        <div className="mt-8 pt-4 border-t border-border flex items-center justify-between gap-3">
          {step > 1 ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => setStep((s) => (s - 1) as 1 | 2 | 3)}
              className="h-12 px-5 rounded-2xl"
            >
              <ArrowLeft className="w-4 h-4 mr-1.5" />
              Voltar
            </Button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            {step === 3 && (
              <Button
                type="button"
                variant="ghost"
                onClick={concluirOnboarding}
                disabled={loading}
                className="h-12 px-4 rounded-2xl text-muted-foreground"
              >
                Pular por enquanto
              </Button>
            )}

            <Button
              type="button"
              onClick={handleNext}
              disabled={loading}
              className="h-12 px-6 rounded-2xl font-bold bg-primary hover:bg-primary/90 text-primary-foreground tap-pop"
            >
              {loading ? (
                'Salvando...'
              ) : step === 3 ? (
                'Concluir e ver Hoje'
              ) : (
                <>
                  Próximo
                  <ArrowRight className="w-4 h-4 ml-1.5" />
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
