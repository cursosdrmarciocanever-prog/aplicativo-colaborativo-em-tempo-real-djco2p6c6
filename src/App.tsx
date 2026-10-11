/* Main App Component - Handles routing, auth provider and layout */
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from '@/components/ui/toaster'
import { Toaster as Sonner } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AuthProvider } from '@/contexts/AuthContext'

import Layout from './components/Layout'
import Index from './pages/Index'
import Onboarding from './pages/Onboarding'
import Hoje from './pages/Hoje'
import Pessoas from './pages/Pessoas'
import Ajustes from './pages/Ajustes'
import Diario from './pages/Diario'
import Saude from './pages/Saude'
import Marcos from './pages/Marcos'
import Album from './pages/Album'
import AceitarConvite from './pages/AceitarConvite'
import VerifyEmail from './pages/VerifyEmail'
import Emergencia from './pages/Emergencia'
import NotFound from './pages/NotFound'

const App = () => (
  <BrowserRouter>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner position="top-center" />
        <Routes>
          <Route element={<Layout />}>
            {/* Rota pública de login */}
            <Route path="/" element={<Index />} />

            {/* Rotas públicas de autenticação/convite */}
            <Route path="/convite" element={<AceitarConvite />} />
            <Route path="/verify-email" element={<VerifyEmail />} />
            <Route path="/emergencia" element={<Emergencia />} />

            {/* Rotas protegidas */}
            <Route path="/onboarding" element={<Onboarding />} />
            <Route path="/hoje" element={<Hoje />} />
            <Route path="/diario" element={<Diario />} />
            <Route path="/saude" element={<Saude />} />
            <Route path="/marcos" element={<Marcos />} />
            <Route path="/album" element={<Album />} />
            <Route path="/pessoas" element={<Pessoas />} />
            <Route path="/ajustes" element={<Ajustes />} />
          </Route>

          {/* Rota 404 amigável */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </TooltipProvider>
    </AuthProvider>
  </BrowserRouter>
)

export default App
